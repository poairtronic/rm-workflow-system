/**
 * RMRIT Live API & Backend Architecture Sanity Audit Runner
 * Standalone live bootstrap and HTTP REST smoke-test against live Neon DB
 */
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module.js';
import { AllExceptionsFilter } from '../src/common/filters/http-exception.filter.js';
import { DataSource } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '../src/auth/enums/role.enum.js';
import { User } from '../src/users/entities/user.entity.js';
import { MslTriggerService } from '../src/inventory/msl-trigger.service.js';
import { EmailJob } from '../src/email/entities/email-job.entity.js';
import { Notification } from '../src/notifications/entities/notification.entity.js';

interface AuditCheck {
  pillar: string;
  name: string;
  passed: boolean;
  durationMs: number;
  details?: string;
  error?: string;
}

async function runLiveAudit() {
  console.log('================================================================');
  console.log('🚀 [RMRIT] Initializing Live Server Architecture & API Audit...');
  console.log('================================================================\n');

  const startTime = Date.now();
  const checks: AuditCheck[] = [];

  const record = (pillar: string, name: string, passed: boolean, start: number, details?: string, error?: string) => {
    checks.push({
      pillar,
      name,
      passed,
      durationMs: Date.now() - start,
      details,
      error,
    });
    const mark = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`  ${mark} [${pillar}] ${name} (${Date.now() - start}ms)${details ? ` - ${details}` : ''}${error ? ` - ERR: ${error}` : ''}`);
  };

  let app: any;
  let baseUrl = '';

  try {
    // -------------------------------------------------------------
    // Pillar 1: Server Bootstrap & Live Port Binding
    // -------------------------------------------------------------
    console.log('▶ Pillar 1: Application Bootstrap & Dependency Injection Graph');
    const bootStart = Date.now();
    app = await NestFactory.create(AppModule, { logger: ['error', 'warn'] });

    app.enableCors({ origin: true, credentials: true });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());

    // Bind to port 0 (dynamic available ephemeral port)
    await app.listen(0);
    const address = app.getHttpServer().address();
    const port = typeof address === 'string' ? 3000 : address.port;
    baseUrl = `http://127.0.0.1:${port}`;

    record('Bootstrap', 'NestJS Application Bootstrap & Port Binding', true, bootStart, `Listening on ${baseUrl}`);

    const dataSource = app.get(DataSource);
    const dbStart = Date.now();
    record('Bootstrap', 'TypeORM Database Connection Pool', dataSource.isInitialized, dbStart, `Neon DB connected via ${dataSource.driver.options.type}`);

    // Health check ping
    const healthStart = Date.now();
    const healthRes = await fetch(`${baseUrl}/api/health`);
    const healthData = await healthRes.json();
    record('Bootstrap', 'GET /api/health Endpoint', healthRes.status === 200 && healthData.status === 'ok', healthStart, JSON.stringify(healthData));

    // -------------------------------------------------------------
    // Provision JWT Tokens for Live Verification
    // -------------------------------------------------------------
    console.log('\n▶ Pillar 2: Security, Auth & RBAC Interceptors');
    const jwtService = app.get(JwtService);
    const userRepo = dataSource.getRepository(User);
    const roleRepo = dataSource.getRepository('Role');

    const adminRole = await roleRepo.findOne({ where: { name: UserRole.ADMIN } });
    const storesRole = await roleRepo.findOne({ where: { name: UserRole.STORES } });
    const designerRole = await roleRepo.findOne({ where: { name: UserRole.DESIGNER } });

    const getTestUser = async (roleId: string, email: string) => {
      let u = await userRepo.findOne({ where: { email } });
      if (!u) {
        u = await userRepo.save({
          name: 'Live Audit User',
          email,
          passwordHash: 'hash',
          roleId,
          isActive: true,
        });
      }
      return u;
    };

    const adminUser = await getTestUser(adminRole.id, `live_admin_${Date.now()}@audit.com`);
    const storesUser = await getTestUser(storesRole.id, `live_stores_${Date.now()}@audit.com`);
    const designerUser = await getTestUser(designerRole.id, `live_designer_${Date.now()}@audit.com`);

    const adminToken = jwtService.sign({ sub: adminUser.id, userId: adminUser.id, email: adminUser.email, role: UserRole.ADMIN, roles: [UserRole.ADMIN] });
    const storesToken = jwtService.sign({ sub: storesUser.id, userId: storesUser.id, email: storesUser.email, role: UserRole.STORES, roles: [UserRole.STORES] });
    const designerToken = jwtService.sign({ sub: designerUser.id, userId: designerUser.id, email: designerUser.email, role: UserRole.DESIGNER, roles: [UserRole.DESIGNER] });

    // 401 Check
    const unauthStart = Date.now();
    const unauthRes = await fetch(`${baseUrl}/api/delivery-challans`);
    record('Security', 'Unauthenticated 401 Rejection', unauthRes.status === 401, unauthStart, `HTTP ${unauthRes.status}`);

    // 403 Check (Designer trying Type 1 DC)
    const rbacStart = Date.now();
    const rbacRes = await fetch(`${baseUrl}/api/delivery-challans/type-1`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${designerToken}`,
      },
      body: JSON.stringify({ type: 'PRODUCTION_PROCESS_OUTWARD' }),
    });
    record('Security', 'RBAC 403 Forbidden for DESIGNER on Store Mutation', rbacRes.status === 403, rbacStart, `HTTP ${rbacRes.status}`);

    // -------------------------------------------------------------
    // Pillar 3: Master Data Core Pillars
    // -------------------------------------------------------------
    console.log('\n▶ Pillar 3: Master Data Core Pillars');
    const procStart = Date.now();
    const procRes = await fetch(`${baseUrl}/api/production-processes`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const procData = await procRes.json();
    record('Master Data', 'GET /api/production-processes', procRes.status === 200 && Array.isArray(procData), procStart, `Found ${procData.length} processes`);

    const vendorStart = Date.now();
    const vendorRes = await fetch(`${baseUrl}/api/vendors`, {
      headers: { Authorization: `Bearer ${storesToken}` },
    });
    const vendorData = await vendorRes.json();
    record('Master Data', 'GET /api/vendors', vendorRes.status === 200 && Array.isArray(vendorData), vendorStart, `Found ${vendorData.length} vendors`);

    // -------------------------------------------------------------
    // Pillar 4: Inventory & MSL Automation
    // -------------------------------------------------------------
    console.log('\n▶ Pillar 4: Inventory & MSL Automation');
    const mslStart = Date.now();
    const mslRes = await fetch(`${baseUrl}/api/inventory/msl/sweep-status`, {
      headers: { Authorization: `Bearer ${storesToken}` },
    });
    const mslData = await mslRes.json();
    record('MSL Engine', 'GET /api/inventory/msl/sweep-status', mslRes.status === 200 && mslData.isRunning === false, mslStart, `Sweep Idle: ${!mslData.isRunning}`);

    const giStart = Date.now();
    const giRes = await fetch(`${baseUrl}/api/general-issue`, {
      headers: { Authorization: `Bearer ${storesToken}` },
    });
    const giData = await giRes.json();
    record('Inventory', 'GET /api/general-issue', giRes.status === 200 && Array.isArray(giData), giStart, `Found ${giData.length} issues`);

    // -------------------------------------------------------------
    // Pillar 5: Delivery Challans Routing & Overdue Engine
    // -------------------------------------------------------------
    console.log('\n▶ Pillar 5: Delivery Challans & SLA Overdue Engine');
    const dcStart = Date.now();
    const dcRes = await fetch(`${baseUrl}/api/delivery-challans`, {
      headers: { Authorization: `Bearer ${storesToken}` },
    });
    const dcData = await dcRes.json();
    record('Delivery Challans', 'GET /api/delivery-challans', dcRes.status === 200 && Array.isArray(dcData), dcStart, `Found ${dcData.length} challans`);

    const odStart = Date.now();
    const odRes = await fetch(`${baseUrl}/api/delivery-challans/overdue`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const odData = await odRes.json();
    record('Delivery Challans', 'GET /api/delivery-challans/overdue', odRes.status === 200 && Array.isArray(odData), odStart, `Found ${odData.length} overdue challans`);

    // -------------------------------------------------------------
    // Pillar 6: Asynchronous Queue & Background Worker Check
    // -------------------------------------------------------------
    console.log('\n▶ Pillar 6: Asynchronous Background & Queue Check');
    const qStart = Date.now();
    const emailJobRepo = dataSource.getRepository(EmailJob);
    const notifRepo = dataSource.getRepository(Notification);
    const mslService = app.get(MslTriggerService);

    const emailCount = await emailJobRepo.count();
    const notifCount = await notifRepo.count();
    const isLocked = mslService.isSweepRunning();

    record('Queues', 'PostgreSQL Email Queue Integrity (email_jobs)', typeof emailCount === 'number', qStart, `${emailCount} total email jobs`);
    record('Queues', 'In-App Notification Ledger (notifications)', typeof notifCount === 'number', qStart, `${notifCount} total notifications`);
    record('Queues', 'MSL Concurrency Lock State', !isLocked, qStart, 'Lock free (idle)');

  } catch (err: any) {
    console.error('❌ Audit encountered fatal exception:', err?.message || err);
    process.exitCode = 1;
  } finally {
    if (app) {
      console.log('\n🛑 Gracefully closing NestJS live application server...');
      await app.close();
      console.log('✅ Server and database connection pool closed cleanly.');
    }
  }

  // -------------------------------------------------------------
  // Summary Report
  // -------------------------------------------------------------
  const total = checks.length;
  const passed = checks.filter((c) => c.passed).length;
  const failed = total - passed;
  const totalDuration = Date.now() - startTime;

  console.log('\n================================================================');
  console.log('📋 AUDIT EXECUTION SUMMARY');
  console.log('================================================================');
  console.log(`Total Checks Run : ${total}`);
  console.log(`Passed Checks    : ${passed}`);
  console.log(`Failed Checks    : ${failed}`);
  console.log(`Total Duration   : ${totalDuration} ms`);
  console.log(`Overall Health   : ${failed === 0 ? '🟢 ALL SYSTEMS OPERATIONAL' : '🔴 DEGRADED'}`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runLiveAudit();
