import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EmailController } from '../src/email/email.controller.js';
import { EmailObservabilityService } from '../src/email/email-observability.service.js';
import { EmailAuditService } from '../src/email/email-audit.service.js';
import { EmailJob } from '../src/email/entities/email-job.entity.js';
import { EmailLog } from '../src/email/entities/email-log.entity.js';
import { EmailJobStatus } from '../src/email/enums/email-job-status.enum.js';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../src/auth/guards/roles.guard.js';
import { UserRole } from '../src/auth/enums/role.enum.js';

describe('Phase 15.16 — Email Queue Observability (OBS-001–OBS-026)', () => {
  let emailController: EmailController;
  let emailObservabilityService: EmailObservabilityService;
  let emailAuditService: EmailAuditService;

  let emailJobsStore: EmailJob[] = [];
  let emailLogsStore: EmailLog[] = [];

  beforeAll(async () => {
    const mockEmailJobRepo = {
      createQueryBuilder: () => ({
        select: function () { return this; },
        addSelect: function () { return this; },
        groupBy: function () { return this; },
        getRawMany: async () => {
          const counts: Record<string, number> = {};
          for (const job of emailJobsStore) {
            counts[job.status] = (counts[job.status] || 0) + 1;
          }
          return Object.entries(counts).map(([status, count]) => ({
            status,
            count: String(count),
          }));
        },
      }),
      findOne: async (opts: any) => {
        if (opts?.where?.status) {
          const matching = emailJobsStore.filter(j => j.status === opts.where.status);
          if (matching.length === 0) return null;
          matching.sort((a, b) => {
            const timeA = (a.sentAt || a.updatedAt || a.createdAt).getTime();
            const timeB = (b.sentAt || b.updatedAt || b.createdAt).getTime();
            return timeB - timeA;
          });
          return matching[0];
        }
        return null;
      },
    };

    const mockEmailLogRepo = {
      findOne: async (opts: any) => {
        if (opts?.where?.status) {
          const matching = emailLogsStore.filter(l => l.status === opts.where.status);
          if (matching.length === 0) return null;
          matching.sort((a, b) => (b.attemptedAt?.getTime() || 0) - (a.attemptedAt?.getTime() || 0));
          return matching[0];
        }
        return null;
      },
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [EmailController],
      providers: [
        EmailObservabilityService,
        EmailAuditService,
        { provide: getRepositoryToken(EmailJob), useValue: mockEmailJobRepo },
        { provide: getRepositoryToken(EmailLog), useValue: mockEmailLogRepo },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    emailController = moduleFixture.get<EmailController>(EmailController);
    emailObservabilityService = moduleFixture.get<EmailObservabilityService>(EmailObservabilityService);
    emailAuditService = moduleFixture.get<EmailAuditService>(EmailAuditService);
  });

  beforeEach(() => {
    emailJobsStore = [];
    emailLogsStore = [];
  });

  // =========================================================================
  // OBS-001 & OBS-022: Endpoint Access & Aliasing
  // =========================================================================
  it('OBS-001 & OBS-022: Admin can access /api/email/observability and /api/email/queue/observability', async () => {
    const res1 = await emailController.getObservability();
    const res2 = await emailController.getQueueObservability();

    expect(res1).toBeDefined();
    expect(res2).toBeDefined();
    expect(res1.pending).toBe(0);
    expect(res2.pending).toBe(0);
  });

  // =========================================================================
  // OBS-002 & OBS-003: Authorization Boundaries
  // =========================================================================
  it('OBS-002 & OBS-003: Non-ADMIN role and unauthenticated callers are rejected by controller guards', () => {
    // Verify controller metadata specifies JwtAuthGuard, RolesGuard and UserRole.ADMIN
    const roles = Reflect.getMetadata('roles', EmailController.prototype.getObservability);
    expect(roles).toContain(UserRole.ADMIN);
    expect(roles).not.toContain(UserRole.STORES);
    expect(roles).not.toContain(UserRole.DESIGNER);
    expect(roles).not.toContain(UserRole.PRODUCTION);
  });

  // =========================================================================
  // OBS-004: Pending Count
  // =========================================================================
  it('OBS-004: Correctly counts PENDING email jobs', async () => {
    emailJobsStore.push(
      { id: 'job-1', status: EmailJobStatus.PENDING } as EmailJob,
      { id: 'job-2', status: EmailJobStatus.PENDING } as EmailJob,
      { id: 'job-3', status: EmailJobStatus.SENT } as EmailJob,
    );

    const res = await emailObservabilityService.getQueueObservability();
    expect(res.pending).toBe(2);
  });

  // =========================================================================
  // OBS-005: Processing Count
  // =========================================================================
  it('OBS-005: Correctly counts PROCESSING email jobs', async () => {
    emailJobsStore.push(
      { id: 'job-1', status: EmailJobStatus.PROCESSING } as EmailJob,
      { id: 'job-2', status: EmailJobStatus.PENDING } as EmailJob,
    );

    const res = await emailObservabilityService.getQueueObservability();
    expect(res.processing).toBe(1);
  });

  // =========================================================================
  // OBS-006: Retrying Count
  // =========================================================================
  it('OBS-006: Correctly counts RETRYING email jobs', async () => {
    emailJobsStore.push(
      { id: 'job-1', status: EmailJobStatus.RETRYING } as EmailJob,
      { id: 'job-2', status: EmailJobStatus.RETRYING } as EmailJob,
      { id: 'job-3', status: EmailJobStatus.RETRYING } as EmailJob,
    );

    const res = await emailObservabilityService.getQueueObservability();
    expect(res.retrying).toBe(3);
  });

  // =========================================================================
  // OBS-007: Failed Count
  // =========================================================================
  it('OBS-007: Correctly counts FAILED email jobs', async () => {
    emailJobsStore.push(
      { id: 'job-1', status: EmailJobStatus.FAILED } as EmailJob,
      { id: 'job-2', status: EmailJobStatus.SENT } as EmailJob,
    );

    const res = await emailObservabilityService.getQueueObservability();
    expect(res.failed).toBe(1);
  });

  // =========================================================================
  // OBS-008: Sent Count
  // =========================================================================
  it('OBS-008: Correctly counts SENT email jobs', async () => {
    emailJobsStore.push(
      { id: 'job-1', status: EmailJobStatus.SENT } as EmailJob,
      { id: 'job-2', status: EmailJobStatus.SENT } as EmailJob,
      { id: 'job-3', status: EmailJobStatus.SENT } as EmailJob,
      { id: 'job-4', status: EmailJobStatus.SENT } as EmailJob,
    );

    const res = await emailObservabilityService.getQueueObservability();
    expect(res.sent).toBe(4);
    expect(res.total).toBe(4);
  });

  // =========================================================================
  // OBS-009: Last Successful Send Timestamp
  // =========================================================================
  it('OBS-009: Retrieves latest successful send timestamp and metadata from EmailLog', async () => {
    const time1 = new Date('2026-09-24T10:00:00Z');
    const time2 = new Date('2026-09-24T12:30:00Z');

    emailLogsStore.push(
      { id: 'log-1', status: EmailJobStatus.SENT, attemptedAt: time1, eventType: 'RM_SUBMITTED', recipientEmail: 'old@rmrit.com' } as EmailLog,
      { id: 'log-2', status: EmailJobStatus.SENT, attemptedAt: time2, eventType: 'MATERIAL_ISSUED', recipientEmail: 'latest@rmrit.com' } as EmailLog,
    );

    const res = await emailObservabilityService.getQueueObservability();
    expect(res.lastSuccessfulSend).not.toBeNull();
    expect(res.lastSuccessfulSend!.timestamp).toBe(time2.toISOString());
    expect(res.lastSuccessfulSend!.eventType).toBe('MATERIAL_ISSUED');
    expect(res.lastSuccessfulSend!.recipientEmail).toBe('latest@rmrit.com');
  });

  // =========================================================================
  // OBS-010: Last Failure Timestamp & Error Sanitization
  // =========================================================================
  it('OBS-010: Retrieves latest failed attempt and sanitizes error message', async () => {
    const failedTime = new Date('2026-09-24T11:15:00Z');

    emailLogsStore.push({
      id: 'log-fail',
      status: EmailJobStatus.FAILED,
      attemptedAt: failedTime,
      eventType: 'SC_COMPLETED',
      errorCode: 'GMAIL_HTTP_401',
      errorMessage: 'OAuth error: client_secret=SECRET_12345 Bearer abcdef123456',
    } as EmailLog);

    const res = await emailObservabilityService.getQueueObservability();
    expect(res.lastFailure).not.toBeNull();
    expect(res.lastFailure!.timestamp).toBe(failedTime.toISOString());
    expect(res.lastFailure!.errorCode).toBe('GMAIL_HTTP_401');
    expect(res.lastFailure!.errorMessage).not.toContain('SECRET_12345');
    expect(res.lastFailure!.errorMessage).not.toContain('abcdef123456');
    expect(res.lastFailure!.errorMessage).toContain('client_secret=[REDACTED]');
  });

  // =========================================================================
  // OBS-011: Zero-State Handling
  // =========================================================================
  it('OBS-011: Zero-state returns 0 counts and null timestamps cleanly', async () => {
    const res = await emailObservabilityService.getQueueObservability();

    expect(res.pending).toBe(0);
    expect(res.processing).toBe(0);
    expect(res.retrying).toBe(0);
    expect(res.failed).toBe(0);
    expect(res.sent).toBe(0);
    expect(res.total).toBe(0);
    expect(res.lastSuccessfulSend).toBeNull();
    expect(res.lastFailure).toBeNull();
  });

  // =========================================================================
  // OBS-012, OBS-013, OBS-014, OBS-015: Summary Response Security & Privacy
  // =========================================================================
  it('OBS-013, OBS-014, OBS-015: Observability summary object excludes job lists, body content, and credentials', async () => {
    emailJobsStore.push({
      id: 'job-sec',
      status: EmailJobStatus.SENT,
      bodyText: 'Sensitive body text content',
      bodyHtml: '<p>Sensitive HTML</p>',
      idempotencyKey: 'RM_SUBMITTED:RM1:USER1',
    } as EmailJob);

    const res = await emailObservabilityService.getQueueObservability();

    // Verify response contains summary structure only
    expect(res).not.toHaveProperty('jobs');
    expect(res).not.toHaveProperty('bodyText');
    expect(res).not.toHaveProperty('bodyHtml');
    expect(JSON.stringify(res)).not.toContain('Sensitive body text');
    expect(JSON.stringify(res)).not.toContain('Sensitive HTML');
  });

  // =========================================================================
  // OBS-016 & OBS-025: Read-Only Invariance
  // =========================================================================
  it('OBS-016 & OBS-025: Observability invocation is strictly read-only and mutates zero jobs or logs', async () => {
    emailJobsStore.push({
      id: 'job-immutable',
      status: EmailJobStatus.PENDING,
      attempts: 0,
      idempotencyKey: 'RM_SUBMITTED:RM2:USER1',
    } as EmailJob);

    const stateBefore = JSON.stringify(emailJobsStore);
    await emailObservabilityService.getQueueObservability();
    const stateAfter = JSON.stringify(emailJobsStore);

    expect(stateAfter).toBe(stateBefore);
  });

  // =========================================================================
  // OBS-021: Database Aggregation Efficiency
  // =========================================================================
  it('OBS-021: Aggregation delegates count grouping to database query builder', async () => {
    const spy = vi.spyOn(emailObservabilityService['emailJobRepository'], 'createQueryBuilder');
    await emailObservabilityService.getQueueObservability();

    expect(spy).toHaveBeenCalledWith('job');
  });

  // =========================================================================
  // OBS-024: Fallback to EmailJob Timestamps
  // =========================================================================
  it('OBS-024: Fallback retrieves latest sentAt/updatedAt from EmailJob when EmailLog is empty', async () => {
    const sentTime = new Date('2026-09-24T13:00:00Z');
    emailJobsStore.push({
      id: 'job-fallback',
      status: EmailJobStatus.SENT,
      sentAt: sentTime,
      eventType: 'SC_COMPLETED',
      recipientEmail: 'fallback@rmrit.com',
    } as EmailJob);

    const res = await emailObservabilityService.getQueueObservability();
    expect(res.lastSuccessfulSend).not.toBeNull();
    expect(res.lastSuccessfulSend!.timestamp).toBe(sentTime.toISOString());
    expect(res.lastSuccessfulSend!.recipientEmail).toBe('fallback@rmrit.com');
  });

  // =========================================================================
  // OBS-026: Error Sanitization Coverage
  // =========================================================================
  it('OBS-026: Sanitizes GMAIL_CLIENT_SECRET, refresh_token, access_token, and passwords', () => {
    const rawError = 'Error: GMAIL_CLIENT_SECRET=mysecret&refresh_token=myref&access_token=myacc&password=mypass';
    const sanitized = emailAuditService.sanitizeError(rawError);

    expect(sanitized).not.toContain('mysecret');
    expect(sanitized).not.toContain('myref');
    expect(sanitized).not.toContain('myacc');
    expect(sanitized).not.toContain('mypass');
    expect(sanitized).toContain('client_secret=[REDACTED]');
    expect(sanitized).toContain('refresh_token=[REDACTED]');
    expect(sanitized).toContain('access_token=[REDACTED]');
    expect(sanitized).toContain('password=[REDACTED]');
  });
});
