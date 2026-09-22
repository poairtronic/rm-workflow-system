import 'dotenv/config';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { DataSource } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '../src/auth/enums/role.enum.js';
import { User } from '../src/users/entities/user.entity.js';
import { PurchaseOrder } from '../src/po/entities/po.entity.js';
import { SalesOrderComponent, ScStatus } from '../src/sc/entities/sc.entity.js';
import { UploadedFile } from '../src/files/entities/uploaded-file.entity.js';
import { Attachment, AttachmentContext } from '../src/attachments/entities/attachment.entity.js';
import * as fs from 'fs';
import * as path from 'path';

describe('Phase 14.6 - File Authorization (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let jwtService: JwtService;

  let adminToken: string;
  let designerToken: string;
  let storesToken: string;
  let unauthorizedToken: string; // Token for a user with NO role or a role that is somehow not permitted (e.g. valid token but no roles)

  let adminUser: User;
  let designerUser: User;
  let storesUser: User;

  let po1: PurchaseOrder;
  let sc1: SalesOrderComponent;
  let sc2: SalesOrderComponent;

  let fileA: UploadedFile;
  let fileB: UploadedFile;
  let unattachedFile: UploadedFile;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    dataSource = app.get(DataSource);
    jwtService = app.get(JwtService);

    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();

    try {
      // Create test users
      const roleAdmin = await queryRunner.manager.findOneBy<{ id: string; name: string }>('roles', { name: UserRole.ADMIN });
      const roleDesigner = await queryRunner.manager.findOneBy<{ id: string; name: string }>('roles', { name: UserRole.DESIGNER });
      const roleStores = await queryRunner.manager.findOneBy<{ id: string; name: string }>('roles', { name: UserRole.STORES });

      const createUser = async (email: string, roleId: string) => {
        let user = await queryRunner.manager.findOneBy(User, { email });
        if (!user) {
          user = queryRunner.manager.create(User, {
            email,
            name: email.split('@')[0], // Add name to fix null constraint
            passwordHash: 'hash',
            roleId,
          });
          user = await queryRunner.manager.save(user);
        }
        return user;
      };

      adminUser = await createUser('admin_auth@example.com', roleAdmin!.id);
      designerUser = await createUser('designer_auth@example.com', roleDesigner!.id);
      storesUser = await createUser('stores_auth@example.com', roleStores!.id);

      adminToken = jwtService.sign({ sub: adminUser.id, email: adminUser.email, role: UserRole.ADMIN, roles: [UserRole.ADMIN] });
      designerToken = jwtService.sign({ sub: designerUser.id, email: designerUser.email, role: UserRole.DESIGNER, roles: [UserRole.DESIGNER] });
      storesToken = jwtService.sign({ sub: storesUser.id, email: storesUser.email, role: UserRole.STORES, roles: [UserRole.STORES] });
      unauthorizedToken = jwtService.sign({ sub: '00000000-0000-0000-0000-000000000000', email: 'none@example.com', role: 'UNKNOWN', roles: [] });

      const uniqueSuffix = Date.now().toString();

      // Create PO
      po1 = queryRunner.manager.create(PurchaseOrder, {
        poNumber: `PO-AUTH-${uniqueSuffix}`,
        customerId: (await queryRunner.manager.query(`SELECT id FROM customers LIMIT 1`))[0].id,
      });
      await queryRunner.manager.save(po1);

      // Create SCs
      sc1 = queryRunner.manager.create(SalesOrderComponent, {
        scNumber: `SC-AUTH-1-${uniqueSuffix}`,
        poId: po1.id,
        productName: 'Prod A',
        status: ScStatus.DRAFT,
      });
      sc2 = queryRunner.manager.create(SalesOrderComponent, {
        scNumber: `SC-AUTH-2-${uniqueSuffix}`,
        poId: po1.id,
        productName: 'Prod B',
        status: ScStatus.DRAFT,
      });
      await queryRunner.manager.save([sc1, sc2]);

      // Create physical test files
      const storageDir = path.join(process.cwd(), 'backend', '.storage');
      if (!fs.existsSync(storageDir)) fs.mkdirSync(storageDir, { recursive: true });

      const createFile = async (name: string, token: string) => {
        const pdfBuf = Buffer.from(`%PDF-1.4 content for ${name}`);
        const res = await request(app.getHttpServer())
          .post('/api/files')
          .set('Authorization', `Bearer ${token}`)
          .attach('file', pdfBuf, `${name}.pdf`);
        expect(res.status).toBe(201);
        return res.body;
      };

      fileA = await createFile('fileA', designerToken);
      fileB = await createFile('fileB', designerToken);
      unattachedFile = await createFile('unattachedFile', designerToken);

      // Attach FileA to SC1, FileB to SC2
      const attA = queryRunner.manager.create(Attachment, {
        fileId: fileA.id,
        context: AttachmentContext.SC,
        recordId: sc1.id,
        documentType: 'SPECIFICATION',
        createdById: designerUser.id,
      });
      const attB = queryRunner.manager.create(Attachment, {
        fileId: fileB.id,
        context: AttachmentContext.SC,
        recordId: sc2.id,
        documentType: 'SPECIFICATION',
        createdById: designerUser.id,
      });
      await queryRunner.manager.save([attA, attB]);

    } finally {
      await queryRunner.release();
    }
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Direct Generic File Access (IDOR Protection)', () => {
    it('AUTH-1: Unauthenticated user cannot access file', async () => {
      await request(app.getHttpServer())
        .get(`/api/files/${fileA.id}/download`)
        .expect(401);
    });

    it('AUTH-2: Unauthorized token (no valid roles) cannot access file', async () => {
      await request(app.getHttpServer())
        .get(`/api/files/${fileA.id}/download`)
        .set('Authorization', `Bearer ${unauthorizedToken}`)
        .expect(403);
    });

    it('AUTH-3: User with valid role CAN access file if attached to valid record', async () => {
      await request(app.getHttpServer())
        .get(`/api/files/${fileA.id}/download`)
        .set('Authorization', `Bearer ${designerToken}`)
        .expect(200)
        .expect(res => {
          expect(res.body).toHaveProperty('url');
        });
    });

    it('AUTH-4: Unattached file is accessible ONLY by creator or ADMIN', async () => {
      // Creator (designerUser)
      await request(app.getHttpServer())
        .get(`/api/files/${unattachedFile.id}/download`)
        .set('Authorization', `Bearer ${designerToken}`)
        .expect(200);

      // Admin
      await request(app.getHttpServer())
        .get(`/api/files/${unattachedFile.id}/download`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Non-creator, non-admin (storesUser)
      await request(app.getHttpServer())
        .get(`/api/files/${unattachedFile.id}/download`)
        .set('Authorization', `Bearer ${storesToken}`)
        .expect(403);
    });
  });

  describe('Cross-SC and Wrong Parent ID (Context Boundary Protection)', () => {
    it('AUTH-5: Cannot access FileB (SC2) through SC1 endpoint', async () => {
      // Fetch attachments for SC2 to get attachment ID
      const sc2Attachments = await request(app.getHttpServer())
        .get(`/api/sc/${sc2.id}/documents`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const attachmentIdB = sc2Attachments.body[0].id;

      // Attempt to access it through SC1
      await request(app.getHttpServer())
        .get(`/api/sc/${sc1.id}/documents/${attachmentIdB}/download`)
        .set('Authorization', `Bearer ${designerToken}`)
        .expect(404); // Or 403, depending on implementation (currently 404)
    });
  });

  describe('File Removal Security', () => {
    it('AUTH-6: Non-creator cannot physically DELETE file, even if they have attachment access', async () => {
      // storesUser has access to SC1 (since they are STORES), but did not create fileA
      await request(app.getHttpServer())
        .delete(`/api/files/${fileA.id}`)
        .set('Authorization', `Bearer ${storesToken}`)
        .expect(403);
    });

    it('AUTH-7: Creator CAN delete physical file', async () => {
      await request(app.getHttpServer())
        .delete(`/api/files/${unattachedFile.id}`)
        .set('Authorization', `Bearer ${designerToken}`)
        .expect(200);
    });
  });
});
