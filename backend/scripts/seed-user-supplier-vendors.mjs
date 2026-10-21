import 'dotenv/config';
import pg from 'pg';

const rawVendors = [
  {
    sNo: 1,
    name: 'M/S.National steel corpration',
    category: 'MS ONLY',
    address: 'NO,14,Mosque street padi chennai-50',
    contactPerson: 'Mr.Sundaraja',
    phone: '9677229227',
    email: null,
    paymentTerms: 'Immediate',
  },
  {
    sNo: 2,
    name: 'M/S.MOORTHY STEEL CENTRE',
    category: 'SS,EN-31',
    address: 'NO,40/3, Maariamman koil street angamuthu nagar padi ch-50',
    contactPerson: 'Mr.Durai',
    phone: '9884110847/9841512507',
    email: null,
    paymentTerms: '30-Days',
  },
  {
    sNo: 3,
    name: 'M/S.Goel steel',
    category: 'OHNS',
    address: 'NO,89,AMTH Road ambattur estate ch-58',
    contactPerson: 'Mr.Yogabalaji',
    phone: '7824088422/04442914848',
    email: 'info@goalsteel.com',
    paymentTerms: 'Against Proforma',
  },
  {
    sNo: 4,
    name: 'M/S.A.R.Traders',
    category: 'TOOLS',
    address: 'NO,727,MTH road mannurpet ch-50',
    contactPerson: 'Mr.Paulraj',
    phone: '9940090551/9003029024',
    email: 'artraders91@gmail.com',
    paymentTerms: '30-Days',
  },
  {
    sNo: 5,
    name: 'AH Traders',
    category: 'MS ONLY',
    address: 'no,198 M.T.H Road Padi. Chennai-50',
    contactPerson: 'Mr.Sahul',
    phone: '6369463033',
    email: null,
    paymentTerms: '15Days',
  },
  {
    sNo: 6,
    name: 'Rocky Traders',
    category: 'White hose -Parrys',
    address: 'No,38/106, Shopno,3 sembudoss street chennai-1',
    contactPerson: 'Mr.Kavirasan',
    phone: '9965890390',
    email: 'rockytraderschennai@gmail.com',
    paymentTerms: 'Immediate',
  },
  {
    sNo: 7,
    name: 'Madhu Agencies',
    category: 'Posters,saftey products,Stationary',
    address: 'D1/C, 1st floor 1 cross street Ambattur industrial chennai-58',
    contactPerson: 'Mr.Madhu',
    phone: '9551689500',
    email: 'info@madhuagencies.com',
    paymentTerms: '15 Days',
  },
  {
    sNo: 8,
    name: 'Choudhary Metal Corpration',
    category: 'Aluminium',
    address: '80/58,Mugappair road padi-chennai-50',
    contactPerson: 'Mr.Mahendrakumar',
    phone: '9444051249',
    email: null,
    paymentTerms: '30 -Days',
  },
  {
    sNo: 9,
    name: 'Chowatia Metal &Alloys',
    category: 'Silver Brasing Rod',
    address: '68/2,Newno,100/2,Armenian street Chennai-600001',
    contactPerson: null,
    phone: '9940046314',
    email: 'chowatia@gmail.com',
    paymentTerms: 'Immediate',
  },
  {
    sNo: 10,
    name: 'Kuberan Enterprises',
    category: 'Baklite Knob',
    address: 'Padi',
    contactPerson: null,
    phone: '7947424395',
    email: null,
    paymentTerms: 'Immediate',
  },
  {
    sNo: 11,
    name: 'Mask Street',
    category: 'Steel Tube forextn Steel Bush for D.C.M For Probe enclosure',
    address: 'Padi',
    contactPerson: null,
    phone: null,
    email: null,
    paymentTerms: 'Immediate',
  },
  {
    sNo: 12,
    name: 'Needle Bearings India',
    category: 'LM-Guide ,Rail & Ball bearings',
    address: 'Ambattur',
    contactPerson: null,
    phone: null,
    email: null,
    paymentTerms: 'Immediate',
  },
  {
    sNo: 13,
    name: 'Proxima/Yogeshwar',
    category: 'Carbide Bushes',
    address: null,
    contactPerson: 'Mr.Yogeswar',
    phone: '8329505940',
    email: null,
    paymentTerms: 'Immediate',
  },
  {
    sNo: 14,
    name: 'Sri Rajeswari Metals',
    category: 'SS-Sheets',
    address: 'Ambattur',
    contactPerson: 'Mr.Choudhary/Mr.Kamalesh',
    phone: '9043077147/6369095584',
    email: null,
    paymentTerms: 'Immediate',
  },
  {
    sNo: 15,
    name: 'Sanjay Enterprises',
    category: 'MS Bright Flat & Bar',
    address: 'Ambattur',
    contactPerson: null,
    phone: '8148509286',
    email: null,
    paymentTerms: 'Immediate',
  },
  {
    sNo: 16,
    name: 'Sriram Bearing Company',
    category: 'Carbide Balls',
    address: null,
    contactPerson: null,
    phone: '9677213529',
    email: null,
    paymentTerms: 'Immediate',
  },
  {
    sNo: 17,
    name: 'Sri Sati Metal',
    category: 'Aluminium round/Brass',
    address: 'Ambattur',
    contactPerson: null,
    phone: '9600007021',
    email: null,
    paymentTerms: 'Immediate',
  },
  {
    sNo: 18,
    name: 'WIN WIN Diamond Products',
    category: 'Diamond mounted /Wheel',
    address: 'Trichy',
    contactPerson: null,
    phone: '8056224669',
    email: null,
    paymentTerms: 'Proforma',
  },
];

async function seedVendors() {
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('✅ Connected to database for Supplier Vendors seeding.\n');

    // Get max numerical code from existing vendors
    const codeRes = await client.query(`
      SELECT code FROM vendors WHERE code ~ '^VND-[0-9]+$'
    `);
    let maxNum = 200;
    for (const row of codeRes.rows) {
      const n = parseInt(row.code.replace('VND-', ''), 10);
      if (!isNaN(n) && n > maxNum) {
        maxNum = n;
      }
    }

    console.log(`Starting vendor sequence from: VND-${maxNum + 1}`);

    let inserted = 0;
    let updated = 0;

    for (const v of rawVendors) {
      // Clean name for lookup
      const cleanName = v.name.trim();
      const notes = `Payment Terms: ${v.paymentTerms}`;

      // Check if vendor already exists (case-insensitive or partial match)
      const existing = await client.query(`
        SELECT id, code, name FROM vendors 
        WHERE LOWER(name) = LOWER($1) 
           OR LOWER(name) = LOWER($2)
           OR LOWER(name) LIKE LOWER($3)
        LIMIT 1
      `, [
        cleanName,
        cleanName.replace(/^M\/S\./i, '').trim(),
        `%${cleanName.replace(/^M\/S\./i, '').trim().slice(0, 15)}%`
      ]);

      if (existing.rows.length > 0) {
        const row = existing.rows[0];
        await client.query(`
          UPDATE vendors
          SET category = COALESCE($1, category),
              address = COALESCE($2, address),
              contact_person = COALESCE($3, contact_person),
              phone = COALESCE($4, phone),
              email = COALESCE($5, email),
              notes = $6,
              is_active = true,
              updated_at = NOW()
          WHERE id = $7
        `, [
          v.category,
          v.address,
          v.contactPerson,
          v.phone,
          v.email,
          notes,
          row.id
        ]);
        console.log(`[UPDATE] Updated existing vendor: "${row.name}" (${row.code})`);
        updated++;
      } else {
        maxNum++;
        const newCode = `VND-${String(maxNum).padStart(3, '0')}`;
        await client.query(`
          INSERT INTO vendors (
            code, name, category, address, contact_person, phone, email, notes, is_active
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
        `, [
          newCode,
          cleanName,
          v.category,
          v.address,
          v.contactPerson,
          v.phone,
          v.email,
          notes
        ]);
        console.log(`[INSERT] Created new vendor: "${cleanName}" (${newCode})`);
        inserted++;
      }
    }

    console.log(`\n🎉 Seeding complete! Inserted: ${inserted}, Updated: ${updated}, Total Processed: ${rawVendors.length}`);

    // Verify vendors in database
    const totalVendors = await client.query('SELECT count(*) FROM vendors WHERE is_active = true');
    console.log(`Total active vendors in DB now: ${totalVendors.rows[0].count}`);

  } catch (err) {
    console.error('❌ Error seeding supplier vendors:', err);
  } finally {
    await client.end();
  }
}

seedVendors();
