import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AlertDigestService, AlertDigestItem } from './alert-digest.service';
import { EmailQueueService } from './email-queue.service';
import { EmailWorkerService } from './email-worker.service';
import { EmailJob } from './entities/email-job.entity';
import { EmailJobStatus } from './enums/email-job-status.enum';
import { TestEmailProvider } from './providers/test-email.provider';
import { TemplateResolver } from './resolvers/template.resolver';

describe('V-SMART RM – Alert Digest, Priority Lane & Re-Alert Cooldown', () => {
  let alertDigestService: AlertDigestService;
  let mockAlertStateRepo: any;
  let mockShadowLogRepo: any;
  let mockSystemSettingRepo: any;
  let mockUserRepo: any;
  let mockEmailQueueService: any;
  let mockDataSource: any;
  let mockPreferenceService: any;
  let mockSkipLogService: any;
  let mockNotificationsService: any;

  // In-memory state tracking for tests
  let alertStateStore: Map<string, any>;
  let shadowLogs: any[];
  let enqueuedJobs: any[];
  let skipLogs: any[];

  // 5 test recipients
  const testRecipients = [
    { id: 'user-1-uuid', name: 'Stores User 1', email: 'stores1@example.com', isActive: true, role: { name: 'STORES' } },
    { id: 'user-2-uuid', name: 'Stores User 2', email: 'stores2@example.com', isActive: true, role: { name: 'STORES' } },
    { id: 'user-3-uuid', name: 'Stores User 3', email: 'stores3@example.com', isActive: true, role: { name: 'STORES' } },
    { id: 'user-4-uuid', name: 'Admin User 1', email: 'admin1@example.com', isActive: true, role: { name: 'ADMIN' } },
    { id: 'user-5-uuid', name: 'Admin User 2', email: 'admin2@example.com', isActive: true, role: { name: 'ADMIN' } },
  ];

  beforeEach(() => {
    alertStateStore = new Map();
    shadowLogs = [];
    enqueuedJobs = [];
    skipLogs = [];

    process.env.ALERT_DIGEST_MODE = 'ON';
    process.env.ALERT_REALERT_COOLDOWN_HOURS = '24';
    process.env.EMAIL_DAILY_LIMIT = '400';
    process.env.EMAIL_PRIORITY_RESERVE = '100';

    mockAlertStateRepo = {
      find: vi.fn(({ where }: any) => {
        const results = [];
        for (const [key, state] of alertStateStore.entries()) {
          if (where.eventCode && state.eventCode !== where.eventCode) continue;
          if (where.recipientUserId && state.recipientUserId !== where.recipientUserId) continue;
          results.push(state);
        }
        return Promise.resolve(results);
      }),
      findOne: vi.fn(),
      save: vi.fn((entity: any) => Promise.resolve(entity)),
      create: vi.fn((entity: any) => ({ id: `state-${Date.now()}`, ...entity })),
    };

    mockShadowLogRepo = {
      save: vi.fn((entity: any) => {
        shadowLogs.push(entity);
        return Promise.resolve(entity);
      }),
      create: vi.fn((entity: any) => ({ id: `shadow-${Date.now()}`, ...entity })),
    };

    mockSystemSettingRepo = {
      findOne: vi.fn(({ where }: any) => {
        if (where.key === 'ALERT_DIGEST_MODE') {
          return Promise.resolve({ key: 'ALERT_DIGEST_MODE', value: process.env.ALERT_DIGEST_MODE });
        }
        return Promise.resolve(null);
      }),
    };

    mockUserRepo = {
      createQueryBuilder: vi.fn(() => ({
        leftJoinAndSelect: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue(testRecipients),
      })),
    };

    mockEmailQueueService = {
      enqueueJob: vi.fn((jobData: any) => {
        const job = {
          id: `job-${enqueuedJobs.length + 1}`,
          status: EmailJobStatus.PENDING,
          attempts: 0,
          ...jobData,
        };
        enqueuedJobs.push(job);
        return Promise.resolve(job);
      }),
    };

    mockDataSource = {
      createQueryRunner: vi.fn(() => ({
        connect: vi.fn().mockResolvedValue(undefined),
        startTransaction: vi.fn().mockResolvedValue(undefined),
        commitTransaction: vi.fn().mockResolvedValue(undefined),
        rollbackTransaction: vi.fn().mockResolvedValue(undefined),
        release: vi.fn().mockResolvedValue(undefined),
        query: vi.fn((queryStr: string, params: any[]) => {
          if (queryStr.includes('INSERT INTO "alert_notification_state"')) {
            const [eventCode, entityType, entityId, recipientUserId] = params;
            const key = `${eventCode}:${entityType}:${entityId}:${recipientUserId}`;
            const existing = alertStateStore.get(key);
            if (existing) {
              existing.lastAlertedAt = new Date();
              existing.alertCount += 1;
            } else {
              alertStateStore.set(key, {
                id: `state-${Date.now()}`,
                eventCode,
                entityType,
                entityId,
                recipientUserId,
                lastAlertedAt: new Date(),
                alertCount: 1,
              });
            }
            return Promise.resolve([]);
          }
          return Promise.resolve([]);
        }),
      })),
    };

    mockPreferenceService = {
      resolveRecipientsDetailed: vi.fn().mockResolvedValue({
        recipients: testRecipients,
        skipped: [],
      }),
    };

    mockSkipLogService = {
      logSkips: vi.fn((entries: any[]) => {
        skipLogs.push(...entries);
        return Promise.resolve();
      }),
    };

    mockNotificationsService = {
      getGlobalWorkflowEmailEnabled: vi.fn().mockResolvedValue(true),
      getConsumableEmailAlertsEnabled: vi.fn().mockResolvedValue(true),
    };

    alertDigestService = new AlertDigestService(
      mockAlertStateRepo as any,
      mockShadowLogRepo as any,
      mockSystemSettingRepo as any,
      mockUserRepo as any,
      mockEmailQueueService as any,
      mockDataSource as any,
      mockPreferenceService as any,
      mockSkipLogService as any,
      mockNotificationsService as any,
    );
  });

  describe('Success Criterion 1: Digest Grouping (30 items x 5 recipients -> 5 jobs, not 150)', () => {
    it('should consolidate 30 consumable receipt overdue items across 5 recipients into exactly 5 digest jobs', async () => {
      // Generate 30 distinct consumable items
      const consumableItems: AlertDigestItem[] = Array.from({ length: 30 }, (_, i) => ({
        entityId: `consumable-item-${i + 1}`,
        entityType: 'CONSUMABLE_REQUEST_ITEM',
        itemRef: `PR. No. ${100 + i} (Consumable Tool ${i + 1})`,
        ageOrOverdue: `${24 + i}h overdue`,
        ownerOrVendor: `Vendor ${String.fromCharCode(65 + (i % 5))}`,
        directLink: '/consumables/purchase-store',
      }));

      const jobs = await alertDigestService.buildDigests('CONSUMABLE_RECEIPT_OVERDUE', consumableItems);

      // CRITICAL ASSERTION: Exactly 5 jobs (one per recipient), NOT 150!
      expect(jobs.length).toBe(5);
      expect(enqueuedJobs.length).toBe(5);

      // Verify each job targets one recipient and lists all 30 items
      jobs.forEach((job) => {
        expect(job.priority).toBe(9); // Priority 9 lane
        expect(job.subject).toBe('[V-SMART] Consumable Receipt Overdue (>24h) – 30 items');
        expect(job.bodyHtml).toContain('Consumable Tool 1');
        expect(job.bodyHtml).toContain('Consumable Tool 30');
      });

      // Verify alert_notification_state updated for all 30 items x 5 recipients = 150 state records
      expect(alertStateStore.size).toBe(150);
    });

    it('should consolidate full 82-item multi-sweep into at most 10 digest jobs', async () => {
      // 50 consumable items + 32 overdue DC items
      const consumableItems: AlertDigestItem[] = Array.from({ length: 50 }, (_, i) => ({
        entityId: `c-item-${i + 1}`,
        entityType: 'CONSUMABLE_REQUEST_ITEM',
        itemRef: `PR-${i + 1}`,
        ageOrOverdue: '48h overdue',
      }));

      const dcItems: AlertDigestItem[] = Array.from({ length: 32 }, (_, i) => ({
        entityId: `dc-item-${i + 1}`,
        entityType: 'DELIVERY_CHALLAN',
        itemRef: `SDC-2627-00${i + 1}`,
        ageOrOverdue: '5 days overdue',
      }));

      const consumableJobs = await alertDigestService.buildDigests('CONSUMABLE_RECEIPT_OVERDUE', consumableItems);
      const dcJobs = await alertDigestService.buildDigests('DC_OVERDUE', dcItems);

      const totalDigestJobs = consumableJobs.length + dcJobs.length;
      // 5 recipients x 2 event codes = exactly 10 digest jobs (instead of 82 x 5 = 410 discrete jobs!)
      expect(totalDigestJobs).toBeLessThanOrEqual(10);
      expect(totalDigestJobs).toBe(10);
    });
  });

  describe('Success Criterion 2: Re-alert Cooldown (Repeated sweep creates 0 new jobs)', () => {
    it('should create 0 new jobs when the same sweep runs twice within the 24h cooldown window', async () => {
      const items: AlertDigestItem[] = [
        { entityId: 'c-1', entityType: 'CONSUMABLE_REQUEST_ITEM', itemRef: 'Gloves', ageOrOverdue: '26h' },
        { entityId: 'c-2', entityType: 'CONSUMABLE_REQUEST_ITEM', itemRef: 'Drill Bit', ageOrOverdue: '30h' },
      ];

      // First run: enqueues 5 digest jobs
      const firstRunJobs = await alertDigestService.buildDigests('CONSUMABLE_RECEIPT_OVERDUE', items);
      expect(firstRunJobs.length).toBe(5);

      // Second run 1 hour later (within 24h cooldown)
      const secondRunJobs = await alertDigestService.buildDigests('CONSUMABLE_RECEIPT_OVERDUE', items);

      // CRITICAL ASSERTION: Exactly 0 new jobs created on second run!
      expect(secondRunJobs.length).toBe(0);

      // Verify cooldown skip logs were recorded
      const cooldownSkips = skipLogs.filter((s) => s.reason === 'COOLDOWN');
      expect(cooldownSkips.length).toBe(10); // 2 items x 5 recipients suppressed
    });
  });

  describe('Success Criterion 3: Item State Transition (Completed item drops out naturally)', () => {
    it('should exclude an item that changes state to completed from the next digest', async () => {
      // Simulate Item 1 and Item 2 initially pending
      const initialItems: AlertDigestItem[] = [
        { entityId: 'item-1', entityType: 'CONSUMABLE_REQUEST_ITEM', itemRef: 'Part A', ageOrOverdue: '25h' },
        { entityId: 'item-2', entityType: 'CONSUMABLE_REQUEST_ITEM', itemRef: 'Part B', ageOrOverdue: '25h' },
      ];

      await alertDigestService.buildDigests('CONSUMABLE_RECEIPT_OVERDUE', initialItems);

      // Fast-forward beyond cooldown
      alertStateStore.clear();

      // Now Item 1 is completed/received in the warehouse, so the sweep query returns ONLY Item 2
      const subsequentSweepItems: AlertDigestItem[] = [
        { entityId: 'item-2', entityType: 'CONSUMABLE_REQUEST_ITEM', itemRef: 'Part B', ageOrOverdue: '50h' },
      ];

      const nextDigestJobs = await alertDigestService.buildDigests('CONSUMABLE_RECEIPT_OVERDUE', subsequentSweepItems);

      expect(nextDigestJobs.length).toBe(5);
      nextDigestJobs.forEach((job) => {
        expect(job.subject).toBe('[V-SMART] Consumable Receipt Overdue (>24h) – 1 items');
        expect(job.bodyHtml).toContain('Part B');
        expect(job.bodyHtml).not.toContain('Part A'); // Part A has completely dropped out
      });
    });
  });

  describe('Success Criterion 4: EMAIL_PREFS_V2 Applied BEFORE Grouping', () => {
    it('should exclude users who have the event OFF from digests and record skip log rows', async () => {
      // User 2 and User 4 have event turned OFF
      mockPreferenceService.resolveRecipientsDetailed.mockResolvedValueOnce({
        recipients: [testRecipients[0], testRecipients[2], testRecipients[4]], // 3 users allowed
        skipped: [
          { user: testRecipients[1], reason: 'OVERRIDE_OFF' },
          { user: testRecipients[3], reason: 'LEGACY_USER_OFF' },
        ],
      });

      const items: AlertDigestItem[] = [
        { entityId: 'item-x', entityType: 'CONSUMABLE_REQUEST_ITEM', itemRef: 'Tool X', ageOrOverdue: '30h' },
      ];

      const jobs = await alertDigestService.buildDigests('CONSUMABLE_RECEIPT_OVERDUE', items);

      // Only 3 digests created (for the 3 enabled users)
      expect(jobs.length).toBe(3);
      const recipientEmails = jobs.map((j) => j.recipientEmail);
      expect(recipientEmails).not.toContain(testRecipients[1].email);
      expect(recipientEmails).not.toContain(testRecipients[3].email);

      // Verify skip log entries for PREF_OFF were recorded
      const prefOffSkips = skipLogs.filter((s) => s.reason === 'PREF_OFF');
      expect(prefOffSkips.length).toBe(2);
      expect(prefOffSkips.map((s) => s.recipientEmail)).toEqual(
        expect.arrayContaining(['stores2@example.com', 'admin1@example.com']),
      );
    });
  });

  describe('Success Criterion 5 & 6: Priority Lane & Daily Budget Reserve', () => {
    let mockJobRepo: any;
    let mockWorkerDataSource: any;
    let queueService: EmailQueueService;
    let workerService: EmailWorkerService;
    let mockTestProvider: TestEmailProvider;

    beforeEach(() => {
      mockTestProvider = new TestEmailProvider();

      mockJobRepo = {
        findOne: vi.fn(({ where }: any) => {
          const id = where?.id || 'job-id';
          return Promise.resolve({
            id,
            recipientEmail: 'dest@example.com',
            subject: 'Test Priority',
            bodyHtml: '<p>Test</p>',
            bodyText: 'Test',
            status: EmailJobStatus.PROCESSING,
            attempts: 1,
            maxAttempts: 3,
            priority: typeof id === 'string' && id.includes('p1') ? 1 : 9,
          });
        }),
        find: vi.fn(),
        save: vi.fn((job) => Promise.resolve(job)),
        create: vi.fn((job) => ({ id: `job-${Math.random()}`, ...job })),
        count: vi.fn().mockResolvedValue(0),
      };

      mockWorkerDataSource = {
        createQueryRunner: vi.fn(() => ({
          connect: vi.fn().mockResolvedValue(undefined),
          startTransaction: vi.fn().mockResolvedValue(undefined),
          commitTransaction: vi.fn().mockResolvedValue(undefined),
          rollbackTransaction: vi.fn().mockResolvedValue(undefined),
          release: vi.fn().mockResolvedValue(undefined),
          manager: {
            find: vi.fn((entity, options) => {
              const idFilter = options?.where?.id;
              let ids: string[] = [];
              if (Array.isArray(idFilter)) {
                ids = idFilter;
              } else if (idFilter && Array.isArray(idFilter.value)) {
                ids = idFilter.value;
              } else if (idFilter && Array.isArray(idFilter._value)) {
                ids = idFilter._value;
              } else if (idFilter && typeof idFilter === 'object') {
                ids = idFilter._value || idFilter.value || [];
              }
              return Promise.resolve(
                ids.map((id: string) => ({
                  id,
                  recipientEmail: 'dest@example.com',
                  subject: 'Test Priority',
                  bodyHtml: '<p>Test</p>',
                  bodyText: 'Test',
                  status: EmailJobStatus.PROCESSING,
                  attempts: 1,
                  maxAttempts: 3,
                  priority: id.includes('p1') ? 1 : 9,
                })),
              );
            }),
          },
          query: vi.fn((queryStr: string, params: any[]) => {
            // Simulate claim query
            if (queryStr.includes('SELECT "id"') && queryStr.includes('FROM "email_jobs"')) {
              const limit = params[2] || 10;
              // If maxPriority filter is active (<= 8), do NOT return priority-9 jobs
              if (queryStr.includes('COALESCE("priority", 5) <= 8')) {
                return Promise.resolve(
                  Array.from({ length: Math.min(limit, 5) }, (_, i) => ({ id: `p1-job-${i + 1}` })),
                );
              }
              // Normal claim: priority-1 first, then priority-9
              return Promise.resolve([
                { id: 'p1-job-1' },
                { id: 'p1-job-2' },
                { id: 'p9-digest-1' },
                { id: 'p9-digest-2' },
              ]);
            }
            if (queryStr.includes('UPDATE "email_jobs" SET "status" = $1')) {
              return Promise.resolve([[], 4]);
            }
            return Promise.resolve([]);
          }),
        })),
      };

      queueService = new EmailQueueService(mockJobRepo as any, mockWorkerDataSource as any);
      workerService = new EmailWorkerService(
        queueService,
        new TemplateResolver(),
        mockTestProvider,
      );
      workerService.sendIntervalMs = 0; // Disable delay for unit test speed
      workerService.dailyLimit = 400;
      workerService.priorityReserve = 100;
      workerService.start(false);
    });

    it('should claim Priority 1 (workflow) jobs before Priority 9 (digest) jobs', async () => {
      // In claim query: ORDER BY COALESCE("priority", 5) ASC, "created_at" ASC
      const claimed = await queueService.claimJobs(10, 'test-worker');

      expect(claimed.length).toBe(4);
      // Priority 1 jobs come first
      expect(claimed[0].priority).toBe(1);
      expect(claimed[1].priority).toBe(1);
      // Priority 9 jobs come after
      expect(claimed[2].priority).toBe(9);
      expect(claimed[3].priority).toBe(9);
    });

    it('should hold Priority-9 jobs at the reserve line (300/400) while Priority-1 still sends', async () => {
      // Simulate sentLast24h = 320 (exceeds 400 - 100 = 300)
      vi.spyOn(queueService, 'getSentCountLast24Hours').mockResolvedValue(320);

      const processed = await workerService.pollTick();

      // Only priority <= 8 (Priority 1 workflow jobs) claimed and processed!
      expect(processed).toBe(5);
      expect(mockTestProvider.sentMessages.length).toBe(5);
    });
  });

  describe('Success Criterion 7: ALERT_DIGEST_MODE = OFF', () => {
    it('should return mode OFF and perform no digest enqueueing', async () => {
      process.env.ALERT_DIGEST_MODE = 'OFF';
      const mode = await alertDigestService.getMode();
      expect(mode).toBe('OFF');

      const items: AlertDigestItem[] = [
        { entityId: 'c-off', entityType: 'CONSUMABLE_REQUEST_ITEM', itemRef: 'Part Off', ageOrOverdue: '24h' },
      ];

      const jobs = await alertDigestService.buildDigests('CONSUMABLE_RECEIPT_OVERDUE', items);
      expect(jobs.length).toBe(0); // In OFF mode, buildDigests enqueues 0 jobs
      expect(enqueuedJobs.length).toBe(0);
    });
  });

  describe('Success Criterion 8: ALERT_DIGEST_MODE = SHADOW', () => {
    it('should write entries to digest_shadow_log and enqueue zero digest emails', async () => {
      process.env.ALERT_DIGEST_MODE = 'SHADOW';
      const mode = await alertDigestService.getMode();
      expect(mode).toBe('SHADOW');

      const items: AlertDigestItem[] = [
        { entityId: 'shadow-item-1', entityType: 'CONSUMABLE_REQUEST_ITEM', itemRef: 'Part Shadow', ageOrOverdue: '25h' },
      ];

      const jobs = await alertDigestService.buildDigests('CONSUMABLE_RECEIPT_OVERDUE', items);

      // Zero digest emails enqueued in SHADOW mode
      expect(jobs.length).toBe(0);
      expect(enqueuedJobs.length).toBe(0);

      // Exactly 5 shadow log entries recorded (1 per recipient)
      expect(shadowLogs.length).toBe(5);
      expect(shadowLogs[0].eventCode).toBe('CONSUMABLE_RECEIPT_OVERDUE');
      expect(shadowLogs[0].itemCount).toBe(1);
      expect(shadowLogs[0].itemIds).toContain('shadow-item-1');
    });
  });

  describe('Task 4: First-Run Surge Preview (Read-Only)', () => {
    it('should compute exact first-run projection with empty cooldown and verify acceptability (jobs <= 15, rows <= 50)', async () => {
      const consumableItems: AlertDigestItem[] = Array.from({ length: 30 }, (_, i) => ({
        entityId: `cons-${i + 1}`,
        entityType: 'CONSUMABLE_REQUEST_ITEM',
        itemRef: `Consumable Item ${i + 1}`,
        ageOrOverdue: '26h',
      }));

      const dcItems: AlertDigestItem[] = Array.from({ length: 5 }, (_, i) => ({
        entityId: `dc-${i + 1}`,
        entityType: 'DELIVERY_CHALLAN',
        itemRef: `DC-${i + 1}`,
        ageOrOverdue: '2 days overdue',
      }));

      const preview = await alertDigestService.previewFirstRun([
        { eventCode: 'CONSUMABLE_RECEIPT_OVERDUE', items: consumableItems },
        { eventCode: 'DC_OVERDUE', items: dcItems },
      ]);

      expect(preview.totalItems).toBe(35);
      // Consumables: 5 recipients = 5 jobs. DC Overdue: 3 recipients = 3 jobs. Total = 8 jobs.
      expect(preview.totalJobs).toBeLessThanOrEqual(15);
      expect(preview.maxDigestRowCount).toBe(30);
      expect(preview.isAcceptable).toBe(true);
      expect(preview.violations.length).toBe(0);
      expect(preview.estimatedDispatchDurationSeconds).toBe(preview.totalJobs * 3);

      // Verify STRICTLY READ-ONLY: zero jobs enqueued, zero state modifications
      expect(enqueuedJobs.length).toBe(0);
    });

    it('should detect when an individual digest exceeds 50 rows and flag excess rows for link delegation', async () => {
      const largeItems: AlertDigestItem[] = Array.from({ length: 65 }, (_, i) => ({
        entityId: `bulk-${i + 1}`,
        entityType: 'CONSUMABLE_REQUEST_ITEM',
        itemRef: `Bulk Item ${i + 1}`,
        ageOrOverdue: '30h',
      }));

      const preview = await alertDigestService.previewFirstRun([
        { eventCode: 'CONSUMABLE_RECEIPT_OVERDUE', items: largeItems },
      ]);

      expect(preview.totalItems).toBe(65);
      expect(preview.maxDigestRowCount).toBe(65);
      expect(preview.breakdown[0].exceeds50Rows).toBe(true);
      // Acceptable because total jobs is 5 (<= 15) and HTML generator caps table at 50 with '+ M more' link
      expect(preview.isAcceptable).toBe(true);
    });
  });
});
