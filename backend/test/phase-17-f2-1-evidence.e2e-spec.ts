import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { DataSource } from 'typeorm';
import { JwtService } from '@nestjs/jwt';

describe('F2.1 Evidence (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let jwtService: JwtService;

  let storesToken: string;
  let designerToken: string;

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
    storesToken = jwtService.sign({ userId: storesUser[0].id, email: storesUser[0].email, role: storesUser[0].role });

    const designerUser = await dataSource.query(`SELECT u.id, u.email, r.name as role FROM users u JOIN roles r ON r.id = u.role_id WHERE r.name = 'DESIGNER' LIMIT 1`);
    designerToken = jwtService.sign({ userId: designerUser[0].id, email: designerUser[0].email, role: designerUser[0].role });
  });

  afterAll(async () => {
    await app.close();
  });

  it('1. GET /api/inventory/balances vs direct SQL SELECT', async () => {
    // Call the API
    const res = await request(app.getHttpServer())
      .get('/api/inventory/balances?pageSize=50')
      .set('Authorization', `Bearer ${storesToken}`);
    
    expect(res.status).toBe(200);
    const apiBalances = res.body.data;

    // Direct SQL
    const dbBalances = await dataSource.query(`
      SELECT b.id, b.product_id, b.current_quantity, p.name as product_name
      FROM stock_balances b
      LEFT JOIN products p ON p.id = b.product_id
      WHERE b.current_quantity > 0
    `);

    console.log('--- EVIDENCE 1: BALANCES SIDE-BY-SIDE ---');
    console.log('API Balances:', JSON.stringify(apiBalances.map((b: any) => ({
      productName: b.productName,
      currentQuantity: b.currentQuantity
    })), null, 2));

    console.log('DB Balances:', JSON.stringify(dbBalances.map((b: any) => ({
      productName: b.product_name,
      currentQuantity: Number(b.current_quantity)
    })), null, 2));

    expect(apiBalances.length).toBeGreaterThan(0);
    apiBalances.forEach((apiRow: any) => {
      const dbRow = dbBalances.find((d: any) => d.id === apiRow.id);
      expect(Number(apiRow.currentQuantity)).toEqual(Number(dbRow.current_quantity));
    });
  });

  it('2. Ledger for one product matches stock_transactions', async () => {
    // Pick a product that has transactions
    const tx = await dataSource.query(`SELECT product_id FROM stock_transactions WHERE product_id IS NOT NULL LIMIT 1`);
    if (tx.length === 0) {
      console.log('No transactions found for evidence.');
      return;
    }
    const targetProductId = tx[0].product_id;

    const res = await request(app.getHttpServer())
      .get(`/api/inventory/transactions?productId=${targetProductId}&pageSize=50`)
      .set('Authorization', `Bearer ${storesToken}`);
    
    expect(res.status).toBe(200);
    const apiTx = res.body.data;

    const dbTx = await dataSource.query(`
      SELECT id, transaction_type as type, quantity
      FROM stock_transactions
      WHERE product_id = $1
      ORDER BY created_at DESC, id DESC
    `, [targetProductId]);

    console.log(`--- EVIDENCE 2: LEDGER FOR PRODUCT ${targetProductId} ---`);
    console.log('API Transactions:', JSON.stringify(apiTx.map((t: any) => ({ id: t.id, type: t.transactionType, qty: t.quantity })), null, 2));
    console.log('DB Transactions:', JSON.stringify(dbTx.map((t: any) => ({ id: t.id, type: t.type, qty: Number(t.quantity) })), null, 2));

    expect(apiTx.length).toEqual(dbTx.length);
    apiTx.forEach((aTx: any, i: number) => {
      expect(aTx.id).toEqual(dbTx[i].id);
      expect(Number(aTx.quantity)).toEqual(Number(dbTx[i].quantity));
    });
  });

  it('3. Designer (non-STORES/ADMIN) CAN view balances and transactions (read-only allowed by route)', async () => {
    const resBalances = await request(app.getHttpServer())
      .get('/api/inventory/balances?pageSize=5')
      .set('Authorization', `Bearer ${designerToken}`);
    expect(resBalances.status).toBe(200); // Because DESIGNER is in the Roles decorator

    const resTx = await request(app.getHttpServer())
      .get('/api/inventory/transactions?pageSize=5')
      .set('Authorization', `Bearer ${designerToken}`);
    expect(resTx.status).toBe(200);

    console.log('--- EVIDENCE 3: DESIGNER ROLE ACCESS ---');
    console.log('DESIGNER can access GET /api/inventory/balances -> Status:', resBalances.status);
    console.log('DESIGNER can access GET /api/inventory/transactions -> Status:', resTx.status);
  });
});
