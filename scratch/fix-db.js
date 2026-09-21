import { Client } from 'pg';

async function run() {
  const client = new Client({
    connectionString: 'postgresql://postgres:postgres@127.0.0.1:5432/rm_workflow_db',
  });
  await client.connect();

  // Find duplicates
  const res = await client.query(`
    SELECT sc_id, count(*)
    FROM additional_material_requests
    WHERE status IN ('REQUESTED', 'APPROVED')
    GROUP BY sc_id
    HAVING count(*) > 1
  `);

  console.log('Duplicates found:', res.rows);

  // For each duplicate sc_id, keep the latest one and mark others as REJECTED or delete them
  for (const row of res.rows) {
    const scId = row.sc_id;
    const reqs = await client.query(`
      SELECT id FROM additional_material_requests
      WHERE sc_id = $1 AND status IN ('REQUESTED', 'APPROVED')
      ORDER BY created_at DESC
    `, [scId]);

    // Keep the first one (reqs.rows[0]), update the rest
    for (let i = 1; i < reqs.rows.length; i++) {
      await client.query(`
        UPDATE additional_material_requests
        SET status = 'REJECTED'
        WHERE id = $1
      `, [reqs.rows[i].id]);
      console.log(`Updated ${reqs.rows[i].id} to REJECTED`);
    }
  }

  // Also fix material_issues duplicate INITIAL_ISSUE
  const res2 = await client.query(`
    SELECT sc_id, count(*)
    FROM material_issues
    WHERE issue_type = 'INITIAL_ISSUE'
    GROUP BY sc_id
    HAVING count(*) > 1
  `);
  console.log('Duplicate issues:', res2.rows);
  for (const row of res2.rows) {
    const scId = row.sc_id;
    const reqs = await client.query(`
      SELECT id FROM material_issues
      WHERE sc_id = $1 AND issue_type = 'INITIAL_ISSUE'
      ORDER BY created_at DESC
    `, [scId]);

    for (let i = 1; i < reqs.rows.length; i++) {
      await client.query(`
        DELETE FROM material_issue_items WHERE material_issue_id = $1
      `, [reqs.rows[i].id]);
      await client.query(`
        DELETE FROM material_issues WHERE id = $1
      `, [reqs.rows[i].id]);
      console.log(`Deleted duplicate material issue ${reqs.rows[i].id}`);
    }
  }

  await client.end();
}

run().catch(console.error);
