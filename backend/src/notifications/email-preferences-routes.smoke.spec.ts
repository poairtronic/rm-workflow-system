import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { EmailPreferencesController } from './email-preferences.controller.js';
import { EmailPreferencesService } from './email-preferences.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';

describe('EmailPreferencesController — Route Smoke Test', () => {
  let app: INestApplication;

  const mockEmailPreferencesService = {
    getMode: vi.fn().mockResolvedValue({ mode: 'OFF' }),
    getRoleMatrix: vi.fn().mockResolvedValue({
      mode: 'OFF',
      roles: [],
      events: [],
      matrix: {},
    }),
    getEvents: vi.fn().mockResolvedValue([]),
    getUsers: vi.fn().mockResolvedValue([]),
    getUserPreferences: vi.fn().mockResolvedValue({
      mode: 'OFF',
      user: {
        id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        name: 'Test User',
        email: 'test@example.com',
        role: { id: 'r1', name: 'STORES' },
        isActive: true,
      },
      legacyEmailOff: false,
      events: [],
    }),
    getAuditLogs: vi.fn().mockResolvedValue({
      entries: [],
      nextCursor: null,
    }),
    getSweeps: vi.fn().mockResolvedValue([]),
    updateSweep: vi.fn().mockResolvedValue({
      eventCode: 'DC_PENDING_2_DAYS',
      enabled: true,
      thresholdHours: 48,
      mode: 'OFF',
    }),
    previewSweep: vi.fn().mockResolvedValue({
      eventCode: 'DC_PENDING_2_DAYS',
      matchCount: 0,
      sample: [],
      mode: 'OFF',
    }),
    getSkips: vi.fn().mockResolvedValue({
      entries: [],
      nextCursor: null,
    }),
    getSkipsSummary: vi.fn().mockResolvedValue({
      days: 7,
      totalSkips: 0,
      byReason: {},
      byEvent: {},
    }),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [EmailPreferencesController],
      providers: [
        {
          provide: EmailPreferencesService,
          useValue: mockEmailPreferencesService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('asserts GET /api/email-preferences/mode returns non-404 (200 OK)', async () => {
    const res = await request(app.getHttpServer()).get('/api/email-preferences/mode');
    expect(res.status).not.toBe(404);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ mode: 'OFF' });
  });

  it('asserts GET /api/email-preferences/roles returns non-404 (200 OK)', async () => {
    const res = await request(app.getHttpServer()).get('/api/email-preferences/roles');
    expect(res.status).not.toBe(404);
    expect(res.status).toBe(200);
    expect(res.body.mode).toBe('OFF');
  });

  it('asserts GET /api/email-preferences/events returns non-404 (200 OK)', async () => {
    const res = await request(app.getHttpServer()).get('/api/email-preferences/events');
    expect(res.status).not.toBe(404);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('asserts GET /api/email-preferences/users returns non-404 (200 OK)', async () => {
    const res = await request(app.getHttpServer()).get('/api/email-preferences/users');
    expect(res.status).not.toBe(404);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('asserts GET /api/email-preferences/users/:id returns non-404 (200 OK)', async () => {
    const testUuid = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
    const res = await request(app.getHttpServer()).get(
      `/api/email-preferences/users/${testUuid}`,
    );
    expect(res.status).not.toBe(404);
    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(testUuid);
  });

  it('asserts GET /api/email-preferences/audit returns non-404 (200 OK)', async () => {
    const res = await request(app.getHttpServer()).get('/api/email-preferences/audit');
    expect(res.status).not.toBe(404);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('entries');
  });

  it('asserts GET /api/email-preferences/sweeps returns non-404 (200 OK)', async () => {
    const res = await request(app.getHttpServer()).get('/api/email-preferences/sweeps');
    expect(res.status).not.toBe(404);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('asserts PUT /api/email-preferences/sweeps/:eventCode returns non-404 (200 OK)', async () => {
    const res = await request(app.getHttpServer())
      .put('/api/email-preferences/sweeps/DC_PENDING_2_DAYS')
      .send({ enabled: true, thresholdHours: 48 });
    expect(res.status).not.toBe(404);
    expect(res.status).toBe(200);
    expect(res.body.enabled).toBe(true);
  });

  it('asserts GET /api/email-preferences/sweeps/:eventCode/preview returns non-404 (200 OK)', async () => {
    const res = await request(app.getHttpServer()).get(
      '/api/email-preferences/sweeps/DC_PENDING_2_DAYS/preview',
    );
    expect(res.status).not.toBe(404);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('matchCount');
  });

  it('asserts GET /api/email-preferences/skips returns non-404 (200 OK)', async () => {
    const res = await request(app.getHttpServer()).get('/api/email-preferences/skips');
    expect(res.status).not.toBe(404);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('entries');
  });

  it('asserts GET /api/email-preferences/skips/summary returns non-404 (200 OK)', async () => {
    const res = await request(app.getHttpServer()).get('/api/email-preferences/skips/summary');
    expect(res.status).not.toBe(404);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('totalSkips');
  });
});
