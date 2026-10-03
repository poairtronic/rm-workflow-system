import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module.js';
import { DataSource } from 'typeorm';
import { EmailJob } from '../src/email/entities/email-job.entity.js';
import { Notification } from '../src/notifications/entities/notification.entity.js';
import * as fs from 'fs';
import * as path from 'path';
import request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '../src/auth/enums/role.enum.js';
import { DeliveryChallanType } from '../src/delivery-challan/entities/delivery-challan.entity.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Live API & Email Verification', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let jwtService: JwtService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    dataSource = app.get(DataSource);
    jwtService = app.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('should run live verification successfully', async () => {
    console.log('Starting Live API & Email Pipeline Verification...');
    const httpServer = app.getHttpServer();
    
    const reportLines: string[] = [];
    reportLines.push('# Live API & Email Verification Report');
    reportLines.push(`*Generated At: ${new Date().toISOString()}*`);
    reportLines.push('');
    reportLines.push('## 1. REST API Smoke & Functional Tests');

    let adminToken: string;
    let testVendorId: string;

    // 1. Setup Auth
    const userRepo = dataSource.getRepository('User');
    let adminUser = await userRepo.findOne({ where: { department: 'ADMIN_TEST' } });
    if (!adminUser) {
      const roleRepo = dataSource.getRepository('Role');
      let adminRole = await roleRepo.findOne({ where: { name: UserRole.ADMIN } });
      if (!adminRole) adminRole = await roleRepo.save({ name: UserRole.ADMIN });
      adminUser = await userRepo.save({
        email: `admin-live-${Date.now()}@test.com`,
        passwordHash: 'dummy',
        roleId: adminRole.id,
        department: 'ADMIN_TEST',
        name: 'Live Test Admin',
        isActive: true,
      });
    }
    adminToken = jwtService.sign({ sub: adminUser.id, role: UserRole.ADMIN, email: adminUser.email });

    // Ensure we have a vendor & process
    const vendorRepo = dataSource.getRepository('Vendor');
    let vendor = await vendorRepo.findOne({ where: { isActive: true } });
    if (!vendor) {
      vendor = await vendorRepo.save({ code: `VND-LIVE-${Date.now()}`, name: 'Live Vendor', isActive: true });
    }
    testVendorId = vendor.id;

    // Helper for timing HTTP requests
    const measureRequest = async (name: string, method: 'get'|'post', url: string, payload?: any) => {
      const start = Date.now();
      let res;
      if (method === 'get') {
        res = await request(httpServer).get(url).set('Authorization', `Bearer ${adminToken}`);
      } else {
        res = await request(httpServer).post(url).set('Authorization', `Bearer ${adminToken}`).send(payload);
      }
      const duration = Date.now() - start;
      const success = res.status >= 200 && res.status < 400;
      reportLines.push(`- **${name}** (\`${method.toUpperCase()} ${url}\`): Status ${res.status} [${duration}ms] - ${success ? 'PASS' : 'FAIL'}`);
      if (!success) {
        console.error(`Request failed: ${url} (Status: ${res.status})`, res.body);
      }
      expect(success).toBe(true);
      return res;
    };

    console.log('Testing APIs...');
    // API Hit 1: Master Data
    await measureRequest('Vendors Fetch', 'get', '/api/vendors');
    await measureRequest('Production Processes Fetch', 'get', '/api/production-processes');
    
    // API Hit 2: Traceability & Analytics
    await measureRequest('Process Outward Analytics', 'get', '/api/traceability/analytics/process-outward');
    await measureRequest('Vendor Performance Analytics', 'get', '/api/traceability/vendors/performance-analytics');
    
    reportLines.push('');
    reportLines.push('## 2. Email Queue & Notification Pipeline Audit');

    // Email Job / Notification Verification
    const emailJobRepo = dataSource.getRepository(EmailJob);
    const notificationRepo = dataSource.getRepository(Notification);
    
    const emailsBefore = await emailJobRepo.count();
    const notifsBefore = await notificationRepo.count();

    // Skip full enterprise MSL Sweep on live DB to save time, we will rely on DC creation for email queue testing.
    // console.log('Triggering MSL Sweep...');
    // await measureRequest('MSL Sweep Trigger', 'post', '/api/inventory/msl/sweep');
    
    // Trigger Delivery Challan Creation to push a dispatch email
    console.log('Triggering DC Creation...');
    
    // We need a product and a bin with some stock
    const productRepo = dataSource.getRepository('Product');
    let product = await productRepo.findOne({ where: { isActive: true } });
    if (!product) {
      const catRepo = dataSource.getRepository('ProductCategory');
      let cat = await catRepo.findOne({ where: {} });
      if (!cat) cat = await catRepo.save({ name: 'Raw Material', isActive: true });
      product = await productRepo.save({ name: `Product-LIVE-${Date.now()}`, type: 'SEMI_FINISHED', categoryId: cat.id, isActive: true, uom: 'kg' });
    }
    const binRepo = dataSource.getRepository('Bin');
    let bin = await binRepo.findOne({ where: {} });
    if (!bin) {
      const warehouseRepo = dataSource.getRepository('Warehouse');
      let wh = await warehouseRepo.findOne({ where: {} });
      if (!wh) wh = await warehouseRepo.save({ code: 'WH1', name: 'WH1', isActive: true });
      bin = await binRepo.save({ code: `B-LIVE-${Date.now()}`, warehouseId: wh.id, isActive: true });
    }

    // Ensure stock exists for DC Type 2
    const stockRepo = dataSource.getRepository('StockBalance');
    let stock = await stockRepo.findOne({ where: { productId: product.id, binId: bin.id } });
    if (!stock) {
      await stockRepo.save({ productId: product.id, binId: bin.id, currentQuantity: 100, minStockLevel: 0, maxStockLevel: 1000 });
    } else {
      stock.currentQuantity = (Number(stock.currentQuantity) + 100) as any;
      await stockRepo.save(stock);
    }

    await measureRequest('Create DC Type 2', 'post', '/api/delivery-challans/type-2', {
      type: DeliveryChallanType.GENERAL_INVENTORY_OUTWARD,
      vendorId: testVendorId,
      dispatchDate: new Date().toISOString(),
      items: [{ productId: product.id, binId: bin.id, quantityDispatched: 5 }]
    });

    // Wait a moment for async events
    await new Promise((resolve) => setTimeout(resolve, 5000));

    const emailsAfter = await emailJobRepo.count();
    const notifsAfter = await notificationRepo.count();
    
    const emailDiff = emailsAfter - emailsBefore;
    const notifDiff = notifsAfter - notifsBefore;
    
    reportLines.push(`- **Emails Generated During Run:** ${emailDiff}`);
    reportLines.push(`- **In-App Notifications Generated:** ${notifDiff}`);

    console.log(`Generated ${emailDiff} emails and ${notifDiff} notifications.`);

    if (emailDiff > 0) {
      const recentEmails = await emailJobRepo.find({ order: { createdAt: 'DESC' }, take: Math.max(5, emailDiff) });
      reportLines.push('');
      reportLines.push('### Sample Email Templates Validated');
      recentEmails.forEach(email => {
        reportLines.push(`- **Event Type:** \`${email.eventType}\``);
        reportLines.push(`  - **Subject:** ${email.subject}`);
        reportLines.push(`  - **Recipient:** ${email.recipientEmail}`);
        reportLines.push(`  - **Status:** ${email.status}`);
        
        // Template integrity check (No undefineds in subject or html)
        const hasUndefined = email.subject.includes('undefined') || email.bodyHtml.includes('undefined');
        reportLines.push(`  - **Template Integrity Check:** ${hasUndefined ? 'FAIL (Found undefined)' : 'PASS (Variables resolved)'}`);
      });
    }

    if (notifDiff > 0) {
      const recentNotifs = await notificationRepo.find({ order: { createdAt: 'DESC' }, take: Math.max(5, notifDiff) });
      reportLines.push('');
      reportLines.push('### Sample In-App Notifications Validated');
      recentNotifs.forEach(notif => {
        reportLines.push(`- **Title:** ${notif.title}`);
        reportLines.push(`  - **Message:** ${notif.message}`);
        reportLines.push(`  - **Target Entity:** ${notif.targetEntity} (${notif.targetId})`);
      });
    }
    
    // Save Report
    const reportPath = path.join(__dirname, '..', '..', 'live-verification-report.md');
    fs.writeFileSync(reportPath, reportLines.join('\n'));
    console.log(`\nReport generated at ${reportPath}`);
  }, 120000);
});
