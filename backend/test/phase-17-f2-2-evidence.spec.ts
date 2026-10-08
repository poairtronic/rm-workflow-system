import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { DataSource } from 'typeorm';
import { JwtService } from '@nestjs/jwt';

describe('F2.2 Evidence - Stock In / Out / Adjust (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let jwtService: JwtService;

  let storesToken: string;
  let productId: string;
  let binId: string;
  let initialBalance: number;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();

    dataSource = app.get(DataSource);
    jwtService = app.get(JwtService);

    const storesUser = await dataSource.query(
      `SELECT u.id, u.email, r.name as role FROM users u JOIN roles r ON r.id = u.role_id WHERE r.name = 'STORES' LIMIT 1`,
    );
    storesToken = jwtService.sign({
      sub: storesUser[0].id,
      userId: storesUser[0].id,
      email: storesUser[0].email,
      role: storesUser[0].role,
      roles: [storesUser[0].role],
    });

    // Pick seeded product + bin
    const rows = await dataSource.query(`
      SELECT sb.id, sb.product_id, sb.bin_id, sb.current_quantity, p.name as product_name, b.code as bin_code
      FROM stock_balances sb
      JOIN products p ON sb.product_id = p.id
      JOIN bins b ON sb.bin_id = b.id
      WHERE sb.current_quantity > 0
      ORDER BY sb.current_quantity DESC
      LIMIT 1
    `);

    productId = rows[0].product_id;
    binId = rows[0].bin_id;
    initialBalance = Number(rows[0].current_quantity);
  });

  afterAll(async () => {
    await app.close();
  });

  it('1. Stock In 100 with reason "F2.2 test restock" (+100)', async () => {
    const payload = {
      productId,
      binId,
      quantity: 100,
      reason: 'F2.2 test restock',
      remarks: 'Automated test stock-in',
    };

    const res = await request(app.getHttpServer())
      .post('/api/inventory/stock-in')
      .set('Authorization', `Bearer ${storesToken}`)
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.body.transaction).toBeDefined();
    expect(res.body.transaction.transactionType).toBe('STOCK_IN');
    expect(Number(res.body.transaction.quantity)).toBe(100);
    expect(res.body.transaction.reason).toBe('F2.2 test restock');

    const [dbBalance] = await dataSource.query(
      `SELECT current_quantity FROM stock_balances WHERE product_id = $1 AND bin_id = $2`,
      [productId, binId],
    );
    expect(Number(dbBalance.current_quantity)).toBe(initialBalance + 100);
  });

  it('2. Stock Out 10 with reason "F2.2 test issue" (-10)', async () => {
    const payload = {
      productId,
      binId,
      quantity: 10,
      reason: 'F2.2 test issue',
      remarks: 'Automated test stock-out',
    };

    const res = await request(app.getHttpServer())
      .post('/api/inventory/stock-out')
      .set('Authorization', `Bearer ${storesToken}`)
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.body.transaction).toBeDefined();
    expect(res.body.transaction.transactionType).toBe('STOCK_OUT');
    expect(Number(res.body.transaction.quantity)).toBe(10);
    expect(res.body.transaction.reason).toBe('F2.2 test issue');

    const [dbBalance] = await dataSource.query(
      `SELECT current_quantity FROM stock_balances WHERE product_id = $1 AND bin_id = $2`,
      [productId, binId],
    );
    expect(Number(dbBalance.current_quantity)).toBe(initialBalance + 100 - 10);
  });

  it('3. Attempt Stock Out with empty reason (Expect 400)', async () => {
    const payload = {
      productId,
      binId,
      quantity: 5,
      reason: '',
    };

    const res = await request(app.getHttpServer())
      .post('/api/inventory/stock-out')
      .set('Authorization', `Bearer ${storesToken}`)
      .send(payload);

    expect(res.status).toBe(400);
  });

  it('4. Attempt Stock Out exceeding available balance (Expect 400)', async () => {
    const payload = {
      productId,
      binId,
      quantity: 999999,
      reason: 'F2.2 attempt exceeding',
    };

    const res = await request(app.getHttpServer())
      .post('/api/inventory/stock-out')
      .set('Authorization', `Bearer ${storesToken}`)
      .send(payload);

    expect(res.status).toBe(400);
  });

  it('5. Adjustment: reduce by 5 with reason "F2.2 test adjustment" (-5)', async () => {
    const [beforeBalance] = await dataSource.query(
      `SELECT current_quantity FROM stock_balances WHERE product_id = $1 AND bin_id = $2`,
      [productId, binId],
    );
    const beforeQty = Number(beforeBalance.current_quantity);

    const payload = {
      productId,
      binId,
      quantity: 5,
      direction: 'DECREASE',
      reason: 'F2.2 test adjustment',
      remarks: 'Automated test adjust decrease',
    };

    const res = await request(app.getHttpServer())
      .post('/api/inventory/adjustment')
      .set('Authorization', `Bearer ${storesToken}`)
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.body.transaction).toBeDefined();
    expect(res.body.transaction.transactionType).toBe('ADJUSTMENT');
    expect(res.body.transaction.adjustmentDirection).toBe('DECREASE');
    expect(Number(res.body.transaction.quantity)).toBe(5);

    const [afterBalance] = await dataSource.query(
      `SELECT current_quantity FROM stock_balances WHERE product_id = $1 AND bin_id = $2`,
      [productId, binId],
    );
    expect(Number(afterBalance.current_quantity)).toBe(beforeQty - 5);
  });

  it('6. Confirm transactions appear in F2.1 ledger view', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/inventory/transactions?productId=${productId}&pageSize=50`)
      .set('Authorization', `Bearer ${storesToken}`);

    expect(res.status).toBe(200);
    const txList = res.body.data;
    expect(txList.length).toBeGreaterThanOrEqual(3);

    const stockInTx = txList.find((t: any) => t.reason === 'F2.2 test restock');
    const stockOutTx = txList.find((t: any) => t.reason === 'F2.2 test issue');
    const adjustTx = txList.find((t: any) => t.reason === 'F2.2 test adjustment');

    expect(stockInTx).toBeDefined();
    expect(stockOutTx).toBeDefined();
    expect(adjustTx).toBeDefined();
  });
});
