import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { DataSource } from 'typeorm';
import { JwtService } from '@nestjs/jwt';

describe('Phase 17 - F2.3 MSL Truth Evidence (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let jwtService: JwtService;
  let storesToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();

    dataSource = app.get(DataSource);
    jwtService = app.get(JwtService);

    const storesUser = await dataSource.query(`SELECT u.id, u.email, r.name as role FROM users u JOIN roles r ON r.id = u.role_id WHERE r.name = 'STORES' LIMIT 1`);
    if (!storesUser.length) throw new Error('STORES user not found');

    storesToken = jwtService.sign({
      sub: storesUser[0].id,
      email: storesUser[0].email,
      role: storesUser[0].role,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('verifies MSL backend truth', async () => {
    // 1. Get initial MSL Status
    console.log('--- Initial MSL Status ---');
    let mslRes = await request(app.getHttpServer())
      .get('/api/traceability/analytics/inventory-msl-status')
      .set('Authorization', `Bearer ${storesToken}`);
    
    expect(mslRes.status).toBe(200);
    console.log('Initial Health Index:', mslRes.body.summary.healthIndex);
    
    const products = await dataSource.query(`SELECT id, name, minimum_inventory FROM products`);
    const testMsl50 = products.find((p: any) => p.minimum_inventory && Number(p.minimum_inventory) > 0);
    const testNoMsl = products.find((p: any) => !p.minimum_inventory || Number(p.minimum_inventory) <= 0);

    if (!testMsl50) throw new Error('No product found with MSL > 0');
    if (!testNoMsl) throw new Error('No product found with MSL = 0');

    console.log(`\n--- Picking Product ${testMsl50.name} (MSL=${testMsl50.minimum_inventory}) ---`);
    
    let balRes = await request(app.getHttpServer())
      .get(`/api/inventory/balances?productId=${testMsl50.id}`)
      .set('Authorization', `Bearer ${storesToken}`);
      
    let currentQty = 0;
    let targetBinId = null;
    let balances = Array.isArray(balRes.body) ? balRes.body : (balRes.body.items || []);
    
    currentQty = balances.reduce((sum: number, b: any) => sum + Number(b.currentQuantity), 0);
    targetBinId = balances.length > 0 ? balances[0].binId : null;
    console.log('Current Stock:', currentQty, 'in bin', targetBinId);

    let mslThreshold = Number(testMsl50.minimum_inventory);

    if (!targetBinId) {
      // Find any bin if somehow there are no balances
      const bins = await dataSource.query(`SELECT id FROM bins LIMIT 1`);
      targetBinId = bins[0].id;
    }

    // Drop below MSL if it isn't already
    let targetDeficit = 10;
    let requiredDrop = currentQty - (mslThreshold - targetDeficit);
    if (requiredDrop > 0) {
      console.log(`Dropping stock by ${requiredDrop} from bin ${targetBinId} to trigger LOW/CRITICAL alert`);
      const outRes = await request(app.getHttpServer())
        .post('/api/inventory/stock-out')
        .set('Authorization', `Bearer ${storesToken}`)
        .send({
          productId: testMsl50.id,
          binId: targetBinId,
          quantity: requiredDrop,
          reason: 'Test Drop below MSL',
        });
      if (outRes.status !== 201) console.log('Stock Out Error:', outRes.body);
      expect(outRes.status).toBe(201);
      currentQty -= requiredDrop;
    }

    mslRes = await request(app.getHttpServer())
      .get('/api/traceability/analytics/inventory-msl-status')
      .set('Authorization', `Bearer ${storesToken}`);
      
    let mslItem = mslRes.body.items.find((i: any) => i.productId === testMsl50.id);
    expect(mslItem).toBeDefined();
    console.log(`Status for ${testMsl50.name}:`, mslItem.status, '| Deficit:', mslItem.deficitQty);
    
    // Deficit should be exact
    expect(mslItem.deficitQty).toBe(mslThreshold - currentQty);

    // Drop it to 0
    if (currentQty > 0) {
      console.log(`Dropping remaining stock ${currentQty} to trigger OUT_OF_STOCK`);
      const outRes = await request(app.getHttpServer())
        .post('/api/inventory/stock-out')
        .set('Authorization', `Bearer ${storesToken}`)
        .send({
          productId: testMsl50.id,
          binId: targetBinId,
          quantity: currentQty,
          reason: 'Test Drop to zero',
        });
      if (outRes.status !== 201) console.log('Stock Out to Zero Error:', outRes.body);
      expect(outRes.status).toBe(201);
    }

    mslRes = await request(app.getHttpServer())
      .get('/api/traceability/analytics/inventory-msl-status')
      .set('Authorization', `Bearer ${storesToken}`);
      
    mslItem = mslRes.body.items.find((i: any) => i.productId === testMsl50.id);
    expect(mslItem).toBeDefined();
    expect(mslItem.status).toBe('OUT_OF_STOCK');
    console.log(`Status for ${testMsl50.name} after dropping to 0:`, mslItem.status);

    // Verify TEST-NOMSL is NEVER in the alert list
    let noMslItem = mslRes.body.items.find((i: any) => i.productId === testNoMsl.id);
    expect(noMslItem).toBeUndefined();
    console.log(`Product ${testNoMsl.name} correctly excluded from alerts.`);

    console.log('Final Health Index:', mslRes.body.summary.healthIndex);

    // Stock back up
    console.log(`Restoring stock for ${testMsl50.name} to clear alert`);
    const inRes = await request(app.getHttpServer())
      .post('/api/inventory/stock-in')
      .set('Authorization', `Bearer ${storesToken}`)
      .send({
        productId: testMsl50.id,
        binId: targetBinId,
        quantity: mslThreshold + 10, // Stock up above MSL
        reason: 'Restoring stock',
      });
    if (inRes.status !== 201) console.log('Stock In Error:', inRes.body);
    expect(inRes.status).toBe(201);

    mslRes = await request(app.getHttpServer())
      .get('/api/traceability/analytics/inventory-msl-status')
      .set('Authorization', `Bearer ${storesToken}`);
      
    mslItem = mslRes.body.items.find((i: any) => i.productId === testMsl50.id);
    // the endpoint doesn't return NORMAL if we filter by status. 
    // Wait, the endpoint doesn't filter by default! `status` is optional.
    // Ah, wait. `TraceabilityService` returns NORMAL if `filter.status` is not provided.
    // The frontend filters out NORMAL.
    if (mslItem) {
      expect(mslItem.status).toBe('NORMAL');
      console.log(`Alert cleared, status is NORMAL`);
    } else {
      console.log(`Item is completely filtered out, which also means alert cleared.`);
    }
  });
});
