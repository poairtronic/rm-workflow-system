import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EVENT_PRIORITY_MAP, resolveEventPriority } from './constants/email-priorities.js';
import { PERMITTED_EMAIL_EVENT_TYPES, EmailQueueService } from './email-queue.service.js';
import { EmailController } from './email.controller.js';
import { EmailObservabilityService } from './email-observability.service.js';
import { EmailJob } from './entities/email-job.entity.js';
import { EmailJobStatus } from './enums/email-job-status.enum.js';

describe('Priority Matrix & Pre-Deploy Safety Specifications', () => {
  describe('Task 1: Priority Tagging Completeness & Fail-Fast Verification', () => {
    it('MUST FAIL if any registered event code in PERMITTED_EMAIL_EVENT_TYPES lacks an explicit priority entry', () => {
      const missingEvents: string[] = [];

      for (const eventType of PERMITTED_EMAIL_EVENT_TYPES) {
        const priority = EVENT_PRIORITY_MAP[eventType];
        if (priority === undefined || typeof priority !== 'number') {
          missingEvents.push(eventType);
        }
      }

      expect(
        missingEvents,
        `The following registered event types lack an explicit priority entry in EVENT_PRIORITY_MAP: ${missingEvents.join(', ')}`,
      ).toEqual([]);
    });

    it('should assign correct priority tiers to standard events', () => {
      expect(EVENT_PRIORITY_MAP['PASSWORD_RESET']).toBe(1);
      expect(EVENT_PRIORITY_MAP['RM_SUBMITTED']).toBe(1);
      expect(EVENT_PRIORITY_MAP['MATERIAL_ISSUED']).toBe(1);
      expect(EVENT_PRIORITY_MAP['CONSUMABLE_APPROVAL_REQUESTED']).toBe(1);
      expect(EVENT_PRIORITY_MAP['CONSUMABLE_APPROVED']).toBe(1);
      expect(EVENT_PRIORITY_MAP['CONSUMABLE_REJECTED']).toBe(1);
      expect(EVENT_PRIORITY_MAP['TEST_EMAIL']).toBe(5);
      expect(EVENT_PRIORITY_MAP['CONSUMABLE_RECEIPT_OVERDUE']).toBe(9);
      expect(EVENT_PRIORITY_MAP['DC_OVERDUE']).toBe(9);
      expect(EVENT_PRIORITY_MAP['ALERT_DIGEST']).toBe(9);
    });

    it('should dynamically classify MSL_LOW_STOCK and MSL_OUT_OF_STOCK by trigger', () => {
      // Sweep-driven triggers -> Priority 9
      expect(resolveEventPriority('MSL_LOW_STOCK', { isSweep: true })).toBe(9);
      expect(resolveEventPriority('MSL_OUT_OF_STOCK', { isSweep: true })).toBe(9);
      expect(resolveEventPriority('MSL_LOW_STOCK', { source: 'SWEEP' })).toBe(9);
      expect(resolveEventPriority('MSL_LOW_STOCK', { metadata: { isSweep: true } })).toBe(9);

      // Event-driven stock transaction triggers -> Priority 5
      expect(resolveEventPriority('MSL_LOW_STOCK', { isSweep: false })).toBe(5);
      expect(resolveEventPriority('MSL_OUT_OF_STOCK', { isSweep: false })).toBe(5);
      expect(resolveEventPriority('MSL_LOW_STOCK', {})).toBe(5);
      expect(resolveEventPriority('MSL_OUT_OF_STOCK', undefined)).toBe(5);
    });

    it('should default unclassified event codes to Priority 5 at runtime', () => {
      expect(resolveEventPriority('UNCLASSIFIED_FUTURE_EVENT')).toBe(5);
      expect(resolveEventPriority('')).toBe(5);
    });

    it('should preserve existing priority on manual dashboard Retry (never reset to 5)', async () => {
      const mockJobP1: Partial<EmailJob> = {
        id: 'job-p1-id',
        status: EmailJobStatus.FAILED,
        priority: 1,
        attempts: 3,
        maxAttempts: 3,
        lastError: 'Temporary network failure',
      };

      const mockJobRepo = {
        findOne: vi.fn().mockResolvedValue(mockJobP1),
        save: vi.fn((job) => Promise.resolve(job)),
      };

      // EmailController constructor: (observability, audit, queue, provider, jobRepo, gmailProvider)
      const controller = new EmailController(
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        mockJobRepo as any,
        {} as any,
      );

      const result = await controller.retryJob('job-p1-id');

      expect(result.success).toBe(true);
      expect(result.job.priority).toBe(1); // Crucial: must preserve priority 1, NOT overwrite with 5
      expect(result.job.status).toBe(EmailJobStatus.PENDING);
      expect(mockJobP1.priority).toBe(1);
    });

    it('should claim Priority 1 jobs ahead of Priority 9 jobs in claimJobs', async () => {
      const p9Job: Partial<EmailJob> = {
        id: 'p9-older-job',
        priority: 9,
        createdAt: new Date(Date.now() - 3600000), // 1 hour ago
        status: EmailJobStatus.PENDING,
      };

      const p1Job: Partial<EmailJob> = {
        id: 'p1-newer-job',
        priority: 1,
        createdAt: new Date(), // just created
        status: EmailJobStatus.PENDING,
      };

      const queryRunnerMock = {
        connect: vi.fn(),
        startTransaction: vi.fn(),
        commitTransaction: vi.fn(),
        rollbackTransaction: vi.fn(),
        release: vi.fn(),
        manager: {
          find: vi.fn().mockResolvedValue([p1Job, p9Job]),
        },
        // Mock query returns P1 first (as enforced by ORDER BY COALESCE("priority", 5) ASC, "created_at" ASC)
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('SELECT') && sql.includes('FOR UPDATE SKIP LOCKED')) {
            expect(sql).toMatch(/COALESCE\("?priority"?, 5\) ASC/);
            return Promise.resolve([p1Job, p9Job]);
          }
          return Promise.resolve([]);
        }),
      };

      const dataSourceMock = {
        createQueryRunner: vi.fn(() => queryRunnerMock),
      };

      const queueService = new EmailQueueService(
        {
          findOne: vi.fn(),
          count: vi.fn().mockResolvedValue(50),
        } as any,
        dataSourceMock as any,
      );

      const claimed = await queueService.claimJobs(10, 'worker-test');
      expect(claimed.length).toBe(2);
      expect(claimed[0].id).toBe('p1-newer-job');
      expect(claimed[0].priority).toBe(1);
      expect(claimed[1].id).toBe('p9-older-job');
      expect(claimed[1].priority).toBe(9);
    });
  });

  describe('Task 2: NODE_ENV & Email Provider Safety', () => {
    let originalNodeEnv: string | undefined;
    let originalProviderType: string | undefined;
    let originalClientId: string | undefined;
    let originalSenderEmail: string | undefined;

    beforeEach(() => {
      originalNodeEnv = process.env.NODE_ENV;
      originalProviderType = process.env.EMAIL_PROVIDER_TYPE;
      originalClientId = process.env.GMAIL_CLIENT_ID;
      originalSenderEmail = process.env.GMAIL_SENDER_EMAIL;
    });

    afterEach(() => {
      process.env.NODE_ENV = originalNodeEnv;
      process.env.EMAIL_PROVIDER_TYPE = originalProviderType;
      process.env.GMAIL_CLIENT_ID = originalClientId;
      process.env.GMAIL_SENDER_EMAIL = originalSenderEmail;
    });

    it('should set testProviderInProduction = true when NODE_ENV=production and provider is TestEmailProvider', async () => {
      const mockQueryBuilder = {
        select: vi.fn().mockReturnThis(),
        addSelect: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        getRawMany: vi.fn().mockResolvedValue([]),
        getCount: vi.fn().mockResolvedValue(0),
        getOne: vi.fn().mockResolvedValue(null),
      };

      const mockEmailJobRepo = {
        createQueryBuilder: vi.fn(() => mockQueryBuilder),
        count: vi.fn().mockResolvedValue(0),
      };

      const observabilityService = new EmailObservabilityService(
        mockEmailJobRepo as any,
        { createQueryBuilder: vi.fn(() => mockQueryBuilder) } as any,
      );

      // Force production mode with test provider
      process.env.NODE_ENV = 'production';
      process.env.EMAIL_PROVIDER_TYPE = 'test';

      const summary = await observabilityService.getQueueObservability();
      expect(summary.testProviderInProduction).toBe(true);
      expect(summary.providerIdentityLabel).toBe('TEST PROVIDER ACTIVE IN PRODUCTION');
    });

    it('should set testProviderInProduction = false when NODE_ENV=production and provider is GMAIL-API', async () => {
      const mockQueryBuilder = {
        select: vi.fn().mockReturnThis(),
        addSelect: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        getRawMany: vi.fn().mockResolvedValue([]),
        getCount: vi.fn().mockResolvedValue(0),
        getOne: vi.fn().mockResolvedValue(null),
      };

      const mockEmailJobRepo = {
        createQueryBuilder: vi.fn(() => mockQueryBuilder),
        count: vi.fn().mockResolvedValue(0),
      };

      const observabilityService = new EmailObservabilityService(
        mockEmailJobRepo as any,
        { createQueryBuilder: vi.fn(() => mockQueryBuilder) } as any,
      );

      process.env.NODE_ENV = 'production';
      process.env.EMAIL_PROVIDER_TYPE = 'gmail';
      process.env.GMAIL_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';
      process.env.GMAIL_SENDER_EMAIL = 'posuppportairtronic@gmail.com';

      const summary = await observabilityService.getQueueObservability();
      expect(summary.testProviderInProduction).toBe(false);
      expect(summary.providerIdentityLabel).toBe('GMAIL-API (posuppportairtronic@gmail.com)');
    });

    it('should set testProviderInProduction = false when NODE_ENV=development and provider is TestEmailProvider', async () => {
      const mockQueryBuilder = {
        select: vi.fn().mockReturnThis(),
        addSelect: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        getRawMany: vi.fn().mockResolvedValue([]),
        getCount: vi.fn().mockResolvedValue(0),
        getOne: vi.fn().mockResolvedValue(null),
      };

      const mockEmailJobRepo = {
        createQueryBuilder: vi.fn(() => mockQueryBuilder),
        count: vi.fn().mockResolvedValue(0),
      };

      const observabilityService = new EmailObservabilityService(
        mockEmailJobRepo as any,
        { createQueryBuilder: vi.fn(() => mockQueryBuilder) } as any,
      );

      process.env.NODE_ENV = 'development';
      process.env.EMAIL_PROVIDER_TYPE = 'test';

      const summary = await observabilityService.getQueueObservability();
      expect(summary.testProviderInProduction).toBe(false);
      expect(summary.providerIdentityLabel).toBe('TEST-PROVIDER (mock)');
    });
  });
});
