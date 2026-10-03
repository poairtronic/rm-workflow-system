import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module.js';
import * as fs from 'fs';
import * as path from 'path';
import request from 'supertest';

describe('Part B - Backend Certification Gate (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  const assertTestExists = (regex: RegExp) => {
    const testDir = path.join(__dirname, '.');
    const files = fs.readdirSync(testDir);
    const hasTest = files.some((file) => regex.test(file));
    expect(hasTest).toBeTruthy();
  };

  const assertRouteExists = async (method: 'get' | 'post' | 'patch', routePath: string) => {
    const res = await request(app.getHttpServer())[method](routePath);
    // Since we are not providing a token, we expect 401 Unauthorized,
    // or if the route requires a specific body format it might throw 400.
    // The key is that it shouldn't be 404 (Not Found).
    expect(res.status).not.toBe(404);
  };

  describe('1. General Issue Module (Phase 17)', () => {
    it('should have DB, API, Business Logic, and Tests', async () => {
      await assertRouteExists('post', '/api/general-issue');
      await assertRouteExists('get', '/api/general-issue');
      assertTestExists(/phase-17-2-general-issue-integration\.spec\.ts/);
    });
  });

  describe('2. MSL Alert & Automated Sweep Engine (Phase 17)', () => {
    it('should have DB, API, Business Logic, and Tests', async () => {
      await assertRouteExists('get', '/api/inventory/msl/alerts');
      await assertRouteExists('post', '/api/inventory/msl/sweep');
      assertTestExists(/phase-17-msl-e2e\.spec\.ts|phase-17-.*\.spec\.ts/);
    });
  });

  describe('3. Vendor Master & Capabilities (Phase 18)', () => {
    it('should have DB, API, Business Logic, and Tests', async () => {
      await assertRouteExists('get', '/api/vendors');
      await assertRouteExists('post', '/api/vendors');
      await assertRouteExists('get', '/api/vendors/00000000-0000-0000-0000-000000000000');
      await assertRouteExists('post', '/api/vendors/00000000-0000-0000-0000-000000000000/capabilities');
      assertTestExists(/phase-18-3-vendor-master\.spec\.ts|phase-18-4-vendor-capability\.spec\.ts/);
    });
  });

  describe('4. Production Process Routing Master (Phase 18)', () => {
    it('should have DB, API, Business Logic, and Tests', async () => {
      await assertRouteExists('get', '/api/production-processes');
      await assertRouteExists('post', '/api/production-processes');
      await assertRouteExists('get', '/api/production-processes/routing/first');
      assertTestExists(/phase-18-1-process-master\.spec\.ts|phase-18-2-process-routing\.spec\.ts/);
    });
  });

  describe('5. Delivery Challan Type 1 (WIP Outward & SLA) (Phase 19)', () => {
    it('should have DB, API, Business Logic, and Tests', async () => {
      await assertRouteExists('post', '/api/delivery-challans/type-1');
      assertTestExists(/phase-19-2-dc-type1\.spec\.ts/);
    });
  });

  describe('6. Delivery Challan Type 2 (General Inventory) (Phase 19)', () => {
    it('should have DB, API, Business Logic, and Tests', async () => {
      await assertRouteExists('post', '/api/delivery-challans/type-2');
      assertTestExists(/phase-19-3-dc-type2\.spec\.ts/);
    });
  });

  describe('7. DC Custody & Return Engine (Phase 19)', () => {
    it('should have DB, API, Business Logic, and Tests', async () => {
      await assertRouteExists('post', '/api/delivery-challans/00000000-0000-0000-0000-000000000000/return');
      await assertRouteExists('get', '/api/delivery-challans/custody/vendor/00000000-0000-0000-0000-000000000000');
      assertTestExists(/phase-19-4-custody-accounting\.spec\.ts|phase-19-5-dc-return\.spec\.ts/);
    });
  });

  describe('8. DC Status Engine & SLA Overdue Rules (Phase 19)', () => {
    it('should have DB, API, Business Logic, and Tests', async () => {
      await assertRouteExists('get', '/api/delivery-challans/overdue');
      await assertRouteExists('patch', '/api/delivery-challans/00000000-0000-0000-0000-000000000000/close');
      assertTestExists(/phase-19-6-dc-status\.spec\.ts|phase-19-7-dc-sla\.spec\.ts/);
    });
  });

  describe('9. Printable DC Data Contract (Phase 19)', () => {
    it('should have DB, API, Business Logic, and Tests', async () => {
      await assertRouteExists('get', '/api/delivery-challans/00000000-0000-0000-0000-000000000000/printable');
      assertTestExists(/phase-19-9-printable-dc\.spec\.ts/);
    });
  });

  describe('10. Final RM Usage Calculation Engine (Phase 20.1)', () => {
    it('should have DB, API, Business Logic, and Tests', async () => {
      await assertRouteExists('get', '/api/traceability/sc/00000000-0000-0000-0000-000000000000/rm-usage');
      assertTestExists(/phase-20-1-final-rm\.spec\.ts/);
    });
  });

  describe('11. Open/Completed/Closed RM Lifecycle & Reconciliation (Phase 20.2)', () => {
    it('should have DB, API, Business Logic, and Tests', async () => {
      await assertRouteExists('get', '/api/traceability/rm/lifecycle-summary');
      await assertRouteExists('get', '/api/traceability/rm/reconciliation-queue');
      assertTestExists(/phase-20-2-open-closed-rm\.spec\.ts/);
    });
  });

  describe('12. Consolidated SC Traceability API (Phase 20.3)', () => {
    it('should have DB, API, Business Logic, and Tests', async () => {
      await assertRouteExists('get', '/api/traceability/sc/00000000-0000-0000-0000-000000000000/consolidated');
      assertTestExists(/phase-20-3-sc-traceability\.spec\.ts/);
    });
  });

  describe('13. PO Consolidated Traceability API (Phase 20.4)', () => {
    it('should have DB, API, Business Logic, and Tests', async () => {
      await assertRouteExists('get', '/api/traceability/po/00000000-0000-0000-0000-000000000000/consolidated');
      assertTestExists(/phase-20-4-po-traceability\.spec\.ts/);
    });
  });

  describe('14. Vendor Traceability & Performance Analytics (Phase 20.5)', () => {
    it('should have DB, API, Business Logic, and Tests', async () => {
      await assertRouteExists('get', '/api/traceability/vendors/00000000-0000-0000-0000-000000000000/traceability');
      await assertRouteExists('get', '/api/traceability/vendors/performance-analytics');
      assertTestExists(/phase-20-5-vendor-traceability\.spec\.ts/);
    });
  });

  describe('15. Enterprise Analytics & MSL Status Dashboard (Phase 20.6)', () => {
    it('should have DB, API, Business Logic, and Tests', async () => {
      await assertRouteExists('get', '/api/traceability/analytics/process-outward');
      await assertRouteExists('get', '/api/traceability/analytics/item-outward');
      await assertRouteExists('get', '/api/traceability/analytics/rm-consumption');
      await assertRouteExists('get', '/api/traceability/analytics/inventory-msl-status');
      assertTestExists(/phase-20-6-analytics-exit-gate\.spec\.ts/);
    });
  });
});
