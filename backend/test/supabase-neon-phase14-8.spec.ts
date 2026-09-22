import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as jwt from 'jsonwebtoken';
import { Client } from 'pg';
import { ConfigService } from '@nestjs/config';
import { SupabaseStorageProvider } from '../src/files/storage/supabase-storage.provider.js';
import { FilesModule } from '../src/files/files.module.js';

const BASE_URL = 'http://localhost:3000/api';
let adminToken = '';
let designerToken = '';
let pgClient: Client;

const ADMIN_ID = '55555555-5555-5555-5555-555555555555';
const DESIGNER_ID = '66666666-6666-6666-6666-666666666666';

describe('Phase 14.8 — Supabase Storage + Neon Production Integration', () => {
  beforeAll(async () => {
    pgClient = new Client(
      process.env.DATABASE_URL ||
        'postgresql://postgres:postgres@127.0.0.1:5432/rm_workflow_db',
    );
    await pgClient.connect();

    // Ensure ADMIN & DESIGNER roles and users exist
    const adminRoleRes = await pgClient.query(
      `SELECT id FROM roles WHERE name = 'ADMIN' LIMIT 1`,
    );
    let adminRoleId = adminRoleRes.rows[0]?.id;
    if (!adminRoleId) {
      const ins = await pgClient.query(
        `INSERT INTO roles (name) VALUES ('ADMIN') RETURNING id`,
      );
      adminRoleId = ins.rows[0].id;
    }

    const designerRoleRes = await pgClient.query(
      `SELECT id FROM roles WHERE name = 'DESIGNER' LIMIT 1`,
    );
    let designerRoleId = designerRoleRes.rows[0]?.id;
    if (!designerRoleId) {
      const ins = await pgClient.query(
        `INSERT INTO roles (name) VALUES ('DESIGNER') RETURNING id`,
      );
      designerRoleId = ins.rows[0].id;
    }

    await pgClient.query(
      `INSERT INTO users (id, name, email, password_hash, role_id) 
       VALUES ($1, 'Admin 14.8', 'admin148@test.com', 'pwd_hash', $2) 
       ON CONFLICT (id) DO NOTHING`,
      [ADMIN_ID, adminRoleId],
    );

    await pgClient.query(
      `INSERT INTO users (id, name, email, password_hash, role_id) 
       VALUES ($1, 'Designer 14.8', 'designer148@test.com', 'pwd_hash', $2) 
       ON CONFLICT (id) DO NOTHING`,
      [DESIGNER_ID, designerRoleId],
    );

    const secret =
      process.env.JWT_SECRET ||
      'your_development_jwt_secret_min_32_characters';
    adminToken = jwt.sign(
      { sub: ADMIN_ID, email: 'admin148@test.com', roles: ['ADMIN'] },
      secret,
      { expiresIn: '1h' },
    );
    designerToken = jwt.sign(
      { sub: DESIGNER_ID, email: 'designer148@test.com', roles: ['DESIGNER'] },
      secret,
      { expiresIn: '1h' },
    );
  });

  afterAll(async () => {
    await pgClient.end();
  });

  // --------------------------------------------------------------------------
  // 1. Production Config & Fail-Fast Verification
  // --------------------------------------------------------------------------
  it('P14_8_01: StorageProvider unit initialization throws when Supabase credentials missing', () => {
    const mockConfig = new ConfigService({
      SUPABASE_URL: '',
      SUPABASE_SERVICE_ROLE_KEY: '',
    });
    const provider = new SupabaseStorageProvider(mockConfig);
    expect(() =>
      (provider as any).getClient(),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Error: Supabase client configuration missing. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.]`,
    );
  });

  // --------------------------------------------------------------------------
  // 2. Real PDF Document Operations
  // --------------------------------------------------------------------------
  it('P14_8_02: Upload real PDF document, verify metadata in DB and storage key model', async () => {
    const pdfBuffer = Buffer.from(
      '%PDF-1.4 %âãÏÓ\n1 0 obj <</Type /Catalog /Pages 2 0 R>> endobj 2 0 obj <</Type /Pages /Kinds [] /Count 0>> endobj trailer <</Root 1 0 R>> %%EOF',
    );
    const formData = new FormData();
    formData.append(
      'file',
      new Blob([pdfBuffer], { type: 'application/pdf' }),
      'Specification_Drawing.pdf',
    );

    const uploadRes = await fetch(`${BASE_URL}/files`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${designerToken}` },
      body: formData,
    });

    expect(uploadRes.status).toBe(201);
    const data = await uploadRes.json();

    expect(data.id).toBeDefined();
    expect(data.originalName).toBe('Specification_Drawing.pdf');
    expect(data.mimeType).toBe('application/pdf');

    // Query DB to verify Neon metadata
    const dbRes = await pgClient.query(
      `SELECT * FROM uploaded_files WHERE id = $1`,
      [data.id],
    );
    expect(dbRes.rows.length).toBe(1);
    const fileRow = dbRes.rows[0];

    expect(fileRow.created_by_id).toBe(DESIGNER_ID);
    expect(fileRow.is_active).toBe(true);
    expect(fileRow.storage_key).toContain(DESIGNER_ID);
    expect(fileRow.storage_key).not.toContain('..');
  });

  // --------------------------------------------------------------------------
  // 3. Real Excel Document Operations (.xlsx / .xls)
  // --------------------------------------------------------------------------
  it('P14_8_03: Upload real Excel spreadsheet (.xlsx), verify MIME validation and metadata', async () => {
    const excelBuffer = Buffer.from('PK\x03\x04[mock xlsx spreadsheet content]');
    const formData = new FormData();
    formData.append(
      'file',
      new Blob([excelBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
      'BOM_Material_List.xlsx',
    );

    const uploadRes = await fetch(`${BASE_URL}/files`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${designerToken}` },
      body: formData,
    });

    expect(uploadRes.status).toBe(201);
    const data = await uploadRes.json();

    expect(data.id).toBeDefined();
    expect(data.originalName).toBe('BOM_Material_List.xlsx');
    expect(data.mimeType).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );

    // Verify Neon metadata
    const dbRes = await pgClient.query(
      `SELECT * FROM uploaded_files WHERE id = $1`,
      [data.id],
    );
    expect(dbRes.rows.length).toBe(1);
    expect(dbRes.rows[0].original_name).toBe('BOM_Material_List.xlsx');
  });

  it('P14_8_04: Upload legacy Excel spreadsheet (.xls), verify acceptance', async () => {
    const xlsBuffer = Buffer.from('\xD0\xCF\x11\xE0[mock xls binary content]');
    const formData = new FormData();
    formData.append(
      'file',
      new Blob([xlsBuffer], { type: 'application/vnd.ms-excel' }),
      'PO_Summary.xls',
    );

    const uploadRes = await fetch(`${BASE_URL}/files`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: formData,
    });

    expect(uploadRes.status).toBe(201);
    const data = await uploadRes.json();
    expect(data.originalName).toBe('PO_Summary.xls');
  });

  // --------------------------------------------------------------------------
  // 4. Executable / Unapproved File Type Blocking
  // --------------------------------------------------------------------------
  it('P14_8_05: Reject executable script upload (.exe, .js, .py)', async () => {
    const formData = new FormData();
    formData.append(
      'file',
      new Blob(['import os; os.system("echo hack")'], {
        type: 'text/x-python',
      }),
      'exploit.py',
    );

    const res = await fetch(`${BASE_URL}/files`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: formData,
    });

    expect(res.status).toBe(422); // UNPROCESSABLE_ENTITY
  });

  // --------------------------------------------------------------------------
  // 5. Download & Soft Delete Operations
  // --------------------------------------------------------------------------
  it('P14_8_06: Request download URL for uploaded document', async () => {
    const formData = new FormData();
    formData.append(
      'file',
      new Blob(['%PDF-1.4 download test'], { type: 'application/pdf' }),
      'Download_Doc.pdf',
    );

    const uploadRes = await fetch(`${BASE_URL}/files`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: formData,
    });

    const fileId = (await uploadRes.json()).id;

    const dlRes = await fetch(`${BASE_URL}/files/${fileId}/download`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(dlRes.status).toBe(200);
    const dlBody = await dlRes.json();
    expect(dlBody.url).toBeDefined();
  });

  it('P14_8_07: Soft-delete document and verify removed_by_id and removed_at metadata in DB', async () => {
    const formData = new FormData();
    formData.append(
      'file',
      new Blob(['%PDF-1.4 delete test'], { type: 'application/pdf' }),
      'SoftDelete_Doc.pdf',
    );

    const uploadRes = await fetch(`${BASE_URL}/files`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: formData,
    });
    const fileId = (await uploadRes.json()).id;

    // Delete file
    const delRes = await fetch(`${BASE_URL}/files/${fileId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(delRes.status).toBe(200);

    // Verify DB metadata soft-delete columns
    const dbRes = await pgClient.query(
      `SELECT is_active, removed_by_id, removed_at FROM uploaded_files WHERE id = $1`,
      [fileId],
    );

    expect(dbRes.rows[0].is_active).toBe(false);
    expect(dbRes.rows[0].removed_by_id).toBe(ADMIN_ID);
    expect(dbRes.rows[0].removed_at).not.toBeNull();
  });

  // --------------------------------------------------------------------------
  // 6. Security & Business Data Integrity Protection
  // --------------------------------------------------------------------------
  it('P14_8_08: Block access for unauthenticated users', async () => {
    const res = await fetch(`${BASE_URL}/files/00000000-0000-0000-0000-000000000000`);
    expect(res.status).toBe(401);
  });

  it('P14_8_09: Business data baseline regression protection (File ops leave relational DB untouched)', async () => {
    // Count rows in relational tables before file ops
    const usersBefore = (await pgClient.query(`SELECT COUNT(*) FROM users`)).rows[0].count;
    const poBefore = (await pgClient.query(`SELECT COUNT(*) FROM purchase_orders`)).rows[0].count;
    const scBefore = (await pgClient.query(`SELECT COUNT(*) FROM sales_order_components`)).rows[0].count;

    // Perform file upload and soft delete
    const formData = new FormData();
    formData.append(
      'file',
      new Blob(['%PDF-1.4 integrity check'], { type: 'application/pdf' }),
      'Integrity_Doc.pdf',
    );

    const uploadRes = await fetch(`${BASE_URL}/files`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: formData,
    });
    const fileId = (await uploadRes.json()).id;

    await fetch(`${BASE_URL}/files/${fileId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    // Count rows after file ops
    const usersAfter = (await pgClient.query(`SELECT COUNT(*) FROM users`)).rows[0].count;
    const poAfter = (await pgClient.query(`SELECT COUNT(*) FROM purchase_orders`)).rows[0].count;
    const scAfter = (await pgClient.query(`SELECT COUNT(*) FROM sales_order_components`)).rows[0].count;

    expect(usersAfter).toBe(usersBefore);
    expect(poAfter).toBe(poBefore);
    expect(scAfter).toBe(scBefore);
  });
});
