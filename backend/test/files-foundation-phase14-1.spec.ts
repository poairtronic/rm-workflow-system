import 'dotenv/config';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as jwt from 'jsonwebtoken';
import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = 'http://localhost:3000/api';
let adminToken = '';
let pgClient: Client;
const ADMIN_ID = '55555555-5555-5555-5555-555555555555';

describe('Phase 14.1 - File Upload Foundation', () => {
  beforeAll(async () => {
    pgClient = new Client(
      process.env.DATABASE_URL ||
        'postgresql://postgres:postgres@127.0.0.1:5432/rm_workflow_db',
    );
    await pgClient.connect();

    // Ensure ADMIN user exists for tests
    const roleRes = await pgClient.query(`SELECT id FROM roles WHERE name = 'ADMIN' LIMIT 1`);
    let roleId = roleRes.rows[0]?.id;
    if (!roleId) {
      const insRole = await pgClient.query(`INSERT INTO roles (name) VALUES ('ADMIN') RETURNING id`);
      roleId = insRole.rows[0].id;
    }

    await pgClient.query(
      `INSERT INTO users (id, name, email, password_hash, role_id) 
       VALUES ($1, 'Admin', 'admin@filetest.com', 'pwd_hash', $2) 
       ON CONFLICT (id) DO NOTHING`,
      [ADMIN_ID, roleId]
    );

    const payload = { sub: ADMIN_ID, email: 'admin@filetest.com', roles: ['ADMIN'] };
    adminToken = jwt.sign(payload, process.env.JWT_SECRET || 'your_development_jwt_secret_min_32_characters', { expiresIn: '1h' });
  });

  afterAll(async () => {
    // Cleanup generated files
    const localDir = path.join(process.cwd(), '.storage');
    if (fs.existsSync(localDir)) {
      fs.rmSync(localDir, { recursive: true, force: true });
    }
    await pgClient.end();
  });

  it('F-01: Should reject unauthenticated upload', async () => {
    const formData = new FormData();
    formData.append('file', new Blob(['test file'], { type: 'text/plain' }), 'test.txt');

    const res = await fetch(`${BASE_URL}/files`, {
      method: 'POST',
      body: formData,
    });
    expect(res.status).toBe(401);
  });

  it('F-02: Should reject file with invalid MIME type', async () => {
    const formData = new FormData();
    // Only jpeg, jpg, png, pdf allowed
    formData.append('file', new Blob(['console.log("hello")'], { type: 'text/javascript' }), 'script.js');

    const res = await fetch(`${BASE_URL}/files`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
      body: formData,
    });
    expect(res.status).toBe(422); // UNPROCESSABLE_ENTITY
  });

  it('F-03: Should upload valid file and attribute to JWT user', async () => {
    const formData = new FormData();
    formData.append('file', new Blob(['%PDF-1.4 mock content'], { type: 'application/pdf' }), 'document.pdf');

    const res = await fetch(`${BASE_URL}/files`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
      body: formData,
    });
    
    expect(res.status).toBe(201);
    const body = await res.json();
    
    expect(body.id).toBeDefined();
    expect(body.originalName).toBe('document.pdf');
    expect(body.mimeType).toBe('application/pdf');

    // Verify DB
    const dbRes = await pgClient.query(`SELECT * FROM uploaded_files WHERE id = $1`, [body.id]);
    expect(dbRes.rows.length).toBe(1);
    const fileRow = dbRes.rows[0];
    expect(fileRow.created_by_id).toBe(ADMIN_ID); // User attribution verified
    expect(fileRow.is_active).toBe(true);
    expect(fileRow.storage_key).toContain(ADMIN_ID);
    
    // Check path traversal protection (safe names)
    expect(fileRow.storage_key).not.toContain('..');
  });

  it('F-04: Should retrieve file metadata', async () => {
    // 1. Upload first
    const formData = new FormData();
    formData.append('file', new Blob(['%PDF-mock'], { type: 'application/pdf' }), 'meta.pdf');
    const uploadRes = await fetch(`${BASE_URL}/files`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: formData,
    });
    const fileId = (await uploadRes.json()).id;

    // 2. Fetch metadata
    const metaRes = await fetch(`${BASE_URL}/files/${fileId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(metaRes.status).toBe(200);
    const meta = await metaRes.json();
    expect(meta.id).toBe(fileId);
    expect(meta.originalName).toBe('meta.pdf');
    expect(meta.createdBy).toBe(ADMIN_ID);
  });

  it('F-05: Should remove file and mark isActive false', async () => {
    const formData = new FormData();
    formData.append('file', new Blob(['%PDF-remove'], { type: 'application/pdf' }), 'remove.pdf');
    const uploadRes = await fetch(`${BASE_URL}/files`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: formData,
    });
    const fileId = (await uploadRes.json()).id;

    // Remove
    const delRes = await fetch(`${BASE_URL}/files/${fileId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(delRes.status).toBe(200);

    // Fetch should fail 404
    const metaRes = await fetch(`${BASE_URL}/files/${fileId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(metaRes.status).toBe(404);

    // DB should still have it but isActive = false
    const dbRes = await pgClient.query(`SELECT is_active FROM uploaded_files WHERE id = $1`, [fileId]);
    expect(dbRes.rows[0].is_active).toBe(false);
  });
});
