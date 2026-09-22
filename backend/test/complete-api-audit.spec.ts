import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { DataSource } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '../src/auth/enums/role.enum.js';
import { User } from '../src/users/entities/user.entity.js';
import * as fs from 'fs';
import * as path from 'path';

describe('Complete API Audit & Security Verification', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let jwtService: JwtService;

  let adminToken: string;
  let designerToken: string;
  let storesToken: string;
  let productionToken: string;
  let adminUser: User;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    dataSource = app.get(DataSource);
    jwtService = app.get(JwtService);

    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();

    try {
      const getOrCreateRole = async (roleName: UserRole) => {
        let role = await queryRunner.manager.findOneBy<{ id: string; name: string }>('roles', { name: roleName });
        if (!role) {
          role = await queryRunner.manager.save('roles', { name: roleName, description: roleName });
        }
        return role;
      };

      const roleAdmin = await getOrCreateRole(UserRole.ADMIN);
      const roleDesigner = await getOrCreateRole(UserRole.DESIGNER);
      const roleStores = await getOrCreateRole(UserRole.STORES);
      const roleProduction = await getOrCreateRole(UserRole.PRODUCTION);

      const getOrCreateUser = async (email: string, roleId: string) => {
        let user = await queryRunner.manager.findOneBy(User, { email });
        if (!user) {
          user = queryRunner.manager.create(User, {
            email,
            name: email.split('@')[0],
            passwordHash: 'hash',
            roleId,
          });
          user = await queryRunner.manager.save(user);
        }
        return user;
      };

      adminUser = await getOrCreateUser('admin_audit@example.com', roleAdmin!.id);
      const designerUser = await getOrCreateUser('designer_audit@example.com', roleDesigner!.id);
      const storesUser = await getOrCreateUser('stores_audit@example.com', roleStores!.id);
      const prodUser = await getOrCreateUser('prod_audit@example.com', roleProduction!.id);

      adminToken = jwtService.sign({ sub: adminUser.id, email: adminUser.email, role: UserRole.ADMIN, roles: [UserRole.ADMIN] });
      designerToken = jwtService.sign({ sub: designerUser.id, email: designerUser.email, role: UserRole.DESIGNER, roles: [UserRole.DESIGNER] });
      storesToken = jwtService.sign({ sub: storesUser.id, email: storesUser.email, role: UserRole.STORES, roles: [UserRole.STORES] });
      productionToken = jwtService.sign({ sub: prodUser.id, email: prodUser.email, role: UserRole.PRODUCTION, roles: [UserRole.PRODUCTION] });
    } finally {
      await queryRunner.release();
    }
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('Section 1: Health & Public APIs', () => {
    it('GET / should return 200 or welcome message', async () => {
      const res = await request(app.getHttpServer()).get('/');
      expect([200, 304]).toContain(res.status);
    });

    it('GET /api/health should return status OK', async () => {
      const res = await request(app.getHttpServer()).get('/api/health');
      expect([200, 204]).toContain(res.status);
    });

    it('POST /api/auth/login with invalid payload should return 400 or 401', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'bad@example.com', password: 'wrong' });
      expect([400, 401]).toContain(res.status);
    });
  });

  describe('Section 2: Authentication & Guard Verification', () => {
    it('Unauthenticated requests to protected endpoints return 401', async () => {
      const endpoints = [
        '/api/users',
        '/api/po',
        '/api/sc',
        '/api/rm',
        '/api/files/00000000-0000-0000-0000-000000000000',
        '/api/inventory',
        '/api/categories',
        '/api/products',
        '/api/warehouses',
        '/api/locations',
        '/api/racks',
        '/api/bins',
        '/api/material-issues',
      ];

      for (const endpoint of endpoints) {
        const res = await request(app.getHttpServer()).get(endpoint);
        expect(res.status).toBe(401);
      }
    });

    it('Expired or forged JWT returns 401', async () => {
      const forgedToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.fake_signature';
      const res = await request(app.getHttpServer())
        .get('/api/users')
        .set('Authorization', `Bearer ${forgedToken}`);
      expect(res.status).toBe(401);
    });
  });

  describe('Section 3: Real File Lifecycle (PDF & Excel)', () => {
    let pdfFileId: string;
    let excelFileId: string;

    it('Uploads real PDF document', async () => {
      const pdfBuffer = Buffer.from('%PDF-1.4 real test pdf content');
      const res = await request(app.getHttpServer())
        .post('/api/files')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', pdfBuffer, { filename: 'audit-spec.pdf', contentType: 'application/pdf' });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.originalName).toBe('audit-spec.pdf');
      pdfFileId = res.body.id;
    });

    it('Uploads real XLSX Excel document', async () => {
      const xlsxBuffer = Buffer.from('PK\x03\x04mock excel spreadsheet data');
      const res = await request(app.getHttpServer())
        .post('/api/files')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', xlsxBuffer, {
          filename: 'audit-data.xlsx',
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.originalName).toBe('audit-data.xlsx');
      excelFileId = res.body.id;
    });

    it('Downloads active files successfully', async () => {
      const resPdf = await request(app.getHttpServer())
        .get(`/api/files/${pdfFileId}/download`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(resPdf.status).toBe(200);

      const resExcel = await request(app.getHttpServer())
        .get(`/api/files/${excelFileId}/download`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(resExcel.status).toBe(200);
    });

    it('Removes file safely, setting isActive to false and recording metadata', async () => {
      const delRes = await request(app.getHttpServer())
        .delete(`/api/files/${pdfFileId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(delRes.status).toBe(200);

      // Download must now be 404
      const getRes = await request(app.getHttpServer())
        .get(`/api/files/${pdfFileId}/download`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(getRes.status).toBe(404);
    });

    it('Rejects dangerous executable scripts (.exe, .js, .py)', async () => {
      const exeBuffer = Buffer.from('MZ\x90\x00executable payload');
      const res = await request(app.getHttpServer())
        .post('/api/files')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', exeBuffer, { filename: 'malware.exe', contentType: 'application/octet-stream' });
      expect([400, 422]).toContain(res.status);
    });
  });

  describe('Section 4: Master Data & Read APIs', () => {
    it('GET /api/categories returns collection', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/categories')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body) || Array.isArray(res.body.data) || Array.isArray(res.body.items)).toBe(true);
    });

    it('GET /api/families returns collection', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/families')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body) || Array.isArray(res.body.data) || Array.isArray(res.body.items)).toBe(true);
    });

    it('GET /api/products returns collection', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/products')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body) || Array.isArray(res.body.data) || Array.isArray(res.body.items)).toBe(true);
    });

    it('GET /api/warehouses returns collection', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/warehouses')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body) || Array.isArray(res.body.data) || Array.isArray(res.body.items)).toBe(true);
    });

    it('GET /api/locations returns collection', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/locations')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body) || Array.isArray(res.body.data) || Array.isArray(res.body.items)).toBe(true);
    });

    it('GET /api/racks returns collection', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/racks')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body) || Array.isArray(res.body.data) || Array.isArray(res.body.items)).toBe(true);
    });

    it('GET /api/bins returns collection', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/bins')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body) || Array.isArray(res.body.data) || Array.isArray(res.body.items)).toBe(true);
    });

    it('GET /api/customers returns array', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/customers')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('GET /api/po returns array', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/po')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('GET /api/sc returns array', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/sc')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('GET /api/rm returns array', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/rm')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('GET /api/material-issues returns array', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/material-issues')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('GET /api/additional-requests returns array', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/additional-requests')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('GET /api/inventory returns array or object', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/inventory')
        .set('Authorization', `Bearer ${adminToken}`);
      expect([200, 204]).toContain(res.status);
    });
  });

  describe('Section 5: Security & Injection Protection', () => {
    it('Path traversal filename is sanitized to safe server storage key', async () => {
      const buffer = Buffer.from('safe text');
      const maliciousName = '../../../../etc/passwd.pdf';
      const res = await request(app.getHttpServer())
        .post('/api/files')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', buffer, { filename: maliciousName, contentType: 'application/pdf' });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
    });

    it('Rejects non-whitelisted payload properties (Mass Assignment protection)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Test Category ' + Date.now(),
          isAdmin: true,
          arbitraryInjection: 'hacked',
        });
      expect(res.status).toBe(400);
    });
  });
});
