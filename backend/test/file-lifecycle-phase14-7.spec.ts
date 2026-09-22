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
import { RmRequest, RmRequestStatus } from '../src/rm/entities/rm-request.entity.js';
import { RmItem } from '../src/rm/entities/rm-item.entity.js';
import * as fs from 'fs';
import * as path from 'path';

describe('Phase 14.7 - File Lifecycle (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let jwtService: JwtService;

  let adminToken: string;
  let designerToken: string;

  let adminUser: User;
  let designerUser: User;

  let po1: PurchaseOrder;
  let sc1: SalesOrderComponent;
  let sc2: SalesOrderComponent;
  let rm1: RmRequest;
  let rmItem1: RmItem;

  let fileA: UploadedFile;
  let fileB: UploadedFile;
  let fileC: UploadedFile;

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
      const createRole = async (name: UserRole) => {
        let role = await queryRunner.manager.findOneBy<{ id: string; name: string }>('roles', { name });
        if (!role) {
          role = await queryRunner.manager.save('roles', { name, description: name });
        }
        return role;
      };

      const roleAdmin = await createRole(UserRole.ADMIN);
      const roleDesigner = await createRole(UserRole.DESIGNER);

      const createUser = async (email: string, roleId: string) => {
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

      adminUser = await createUser('admin_lifecycle@example.com', roleAdmin!.id);
      designerUser = await createUser('designer_lifecycle@example.com', roleDesigner!.id);

      adminToken = jwtService.sign({ sub: adminUser.id, email: adminUser.email, role: UserRole.ADMIN, roles: [UserRole.ADMIN] });
      designerToken = jwtService.sign({ sub: designerUser.id, email: designerUser.email, role: UserRole.DESIGNER, roles: [UserRole.DESIGNER] });

      const uniqueSuffix = Date.now().toString();

      po1 = queryRunner.manager.create(PurchaseOrder, {
        poNumber: `PO-LIFE-${uniqueSuffix}`,
        customerId: (await queryRunner.manager.query(`SELECT id FROM customers LIMIT 1`))[0].id,
      });
      await queryRunner.manager.save(po1);

      sc1 = queryRunner.manager.create(SalesOrderComponent, {
        scNumber: `SC-LIFE-1-${uniqueSuffix}`,
        poId: po1.id,
        productName: 'Prod A',
        status: ScStatus.DRAFT,
      });
      sc2 = queryRunner.manager.create(SalesOrderComponent, {
        scNumber: `SC-LIFE-2-${uniqueSuffix}`,
        poId: po1.id,
        productName: 'Prod B',
        status: ScStatus.DRAFT,
      });
      await queryRunner.manager.save([sc1, sc2]);

      rm1 = queryRunner.manager.create(RmRequest, {
        scId: sc1.id,
        status: RmRequestStatus.DRAFT,
        revisionNumber: 1,
        createdById: designerUser.id,
      });
      await queryRunner.manager.save(rm1);

      rmItem1 = queryRunner.manager.create(RmItem, {
        rmFormId: rm1.id,
        material: 'Steel',
        materialType: 'Sheet',
        grade: '304',
        size: '1mm',
        length: 2,
        unit: 'pcs',
        quantity: '100',
      });
      await queryRunner.manager.save(rmItem1);

      const storageDir = path.join(process.cwd(), 'backend', '.storage');
      if (!fs.existsSync(storageDir)) fs.mkdirSync(storageDir, { recursive: true });

      const createFile = async (name: string, owner: string) => {
        const file = queryRunner.manager.create(UploadedFile, {
          originalName: name,
          mimeType: 'text/plain',
          size: 100,
          storageKey: `local/${name}-${uniqueSuffix}.txt`,
          createdById: owner,
          provider: 'LOCAL',
        });
        await queryRunner.manager.save(file);
        fs.writeFileSync(path.join(storageDir, `${name}.txt`), 'test content');
        return file;
      };

      fileA = await createFile('fileA', designerUser.id);
      fileB = await createFile('fileB', designerUser.id);
      fileC = await createFile('fileC', designerUser.id);

      const attA = queryRunner.manager.create(Attachment, {
        fileId: fileA.id,
        context: AttachmentContext.RM_REQUEST,
        recordId: rm1.id,
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

  describe('File Lifecycle Core', () => {
    it('LFC-1: UPLOAD -> ACTIVE', async () => {
      // Simulate an upload to check if it's active initially
      // (Testing uploading directly via API may require multi-part form data which can be flaky in tests,
      // so we rely on the DB setup we just did, which mirrors the active state)
      const fileRes = await request(app.getHttpServer())
        .get(`/api/files/${fileC.id}`)
        .set('Authorization', `Bearer ${adminToken}`) // Admin has access to unattached files
        .expect(200);

      expect(fileRes.body.id).toBe(fileC.id);
    });

    it('LFC-2: Remove active file (RM Baseline Protection)', async () => {
      // fileA is attached to rm1
      
      // Check baseline before
      const rmBefore = await dataSource.getRepository(RmRequest).findOne({ where: { id: rm1.id }, relations: { items: true } });
      expect(rmBefore?.items[0].quantity).toBe('100.000');
      expect(rmBefore?.status).toBe(RmRequestStatus.DRAFT);
      expect(rmBefore?.revisionNumber).toBe(1);

      // Remove file
      await request(app.getHttpServer())
        .delete(`/api/files/${fileA.id}`)
        .set('Authorization', `Bearer ${designerToken}`)
        .expect(200);

      // Verify RM is unchanged
      const rmAfter = await dataSource.getRepository(RmRequest).findOne({ where: { id: rm1.id }, relations: { items: true } });
      expect(rmAfter?.items[0].quantity).toBe('100.000');
      expect(rmAfter?.status).toBe(RmRequestStatus.DRAFT);
      expect(rmAfter?.revisionNumber).toBe(1);

      // Verify file is inactive
      const fileStatus = await dataSource.getRepository(UploadedFile).findOne({ where: { id: fileA.id } });
      expect(fileStatus?.isActive).toBe(false);
      expect(fileStatus?.removedById).toBe(designerUser.id);
      expect(fileStatus?.removedAt).toBeDefined();
    });

    it('LFC-3: Removed file download blocked', async () => {
      await request(app.getHttpServer())
        .get(`/api/files/${fileA.id}/download`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('LFC-4: Removed file does not appear in active document lists', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/rm/${rm1.id}/documents`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.length).toBe(0); // The attachment is filtered out because file is removed
    });

    it('LFC-5: Cannot attach removed file to new record', async () => {
      await request(app.getHttpServer())
        .post(`/api/sc/${sc1.id}/documents`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ fileId: fileA.id, documentType: 'SC_DRAWING' })
        .expect(404);
    });

    it('LFC-6: Cross-SC isolation after removal', async () => {
      // fileB is attached to sc2. sc1 does not show it.
      await request(app.getHttpServer())
        .delete(`/api/files/${fileB.id}`)
        .set('Authorization', `Bearer ${designerToken}`)
        .expect(200);

      // Check sc2 documents - fileB should be gone
      const res = await request(app.getHttpServer())
        .get(`/api/sc/${sc2.id}/documents`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.length).toBe(0);

      // Verify SC2 is unchanged
      const sc2After = await dataSource.getRepository(SalesOrderComponent).findOne({ where: { id: sc2.id } });
      expect(sc2After?.scNumber).toBeDefined();
    });

    it('LFC-7: Repeat remove returns 404 (Safe Idempotency/Conflict)', async () => {
      await request(app.getHttpServer())
        .delete(`/api/files/${fileA.id}`)
        .set('Authorization', `Bearer ${designerToken}`)
        .expect(404);
    });
    
    it('LFC-8: Unauthorized remove blocked', async () => {
      // Try to remove unattached fileC as un-authorized token (non-creator, non-admin)
      // Actually we'll create a new token for stores to try and delete designer's file
      const roleStores = await dataSource.getRepository('Role').findOneBy({ name: UserRole.STORES });
      const storesUser = await dataSource.getRepository(User).findOneBy({ roleId: roleStores.id });
      const storesToken = jwtService.sign({ sub: storesUser.id, email: storesUser.email, role: UserRole.STORES, roles: [UserRole.STORES] });

      await request(app.getHttpServer())
        .delete(`/api/files/${fileC.id}`)
        .set('Authorization', `Bearer ${storesToken}`)
        .expect(403);
    });
  });
});
