import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EmailSkipLogService, SKIP_REASON_TEXTS } from './email-skip-log.service.js';
import { EmailSkipLog } from './entities/email-skip-log.entity.js';

describe('EmailSkipLogService', () => {
  let service: EmailSkipLogService;
  let skipLogRepoMock: any;
  let notificationEventRepoMock: any;
  let dataSourceMock: any;

  beforeEach(() => {
    skipLogRepoMock = {
      createQueryBuilder: vi.fn(),
      find: vi.fn(),
    };

    notificationEventRepoMock = {
      find: vi.fn().mockResolvedValue([
        { code: 'RM_SUBMITTED', label: 'Raw Material Requisition Submitted' },
        { code: 'MATERIAL_ISSUED', label: 'Material Issued to Production' },
      ]),
    };

    dataSourceMock = {};

    service = new EmailSkipLogService(
      skipLogRepoMock,
      notificationEventRepoMock,
      dataSourceMock,
    );
  });

  describe('generateDedupeKey', () => {
    it('creates accurate dedupe key format event:entity:user:reason', () => {
      const key = service.generateDedupeKey({
        eventCode: 'RM_SUBMITTED',
        entityId: 'rm-100',
        recipientUserId: 'user-1',
        reason: 'OVERRIDE_OFF',
        mode: 'ON',
      });
      expect(key).toBe('RM_SUBMITTED:rm-100:user-1:OVERRIDE_OFF');
    });

    it('handles missing recipientUserId with hyphen fallback', () => {
      const key = service.generateDedupeKey({
        eventCode: 'CONSUMABLE_RECEIPT_OVERDUE',
        entityId: 'item-200',
        reason: 'CONSUMABLE_GATE_OFF',
        mode: 'OFF',
      });
      expect(key).toBe('CONSUMABLE_RECEIPT_OVERDUE:item-200:-:CONSUMABLE_GATE_OFF');
    });
  });

  describe('logSkips', () => {
    it('does nothing when entries array is empty or null', async () => {
      await service.logSkips([]);
      expect(skipLogRepoMock.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('inserts records with orIgnore (ON CONFLICT DO NOTHING)', async () => {
      const mockQb = {
        insert: vi.fn().mockReturnThis(),
        into: vi.fn().mockReturnThis(),
        values: vi.fn().mockReturnThis(),
        orIgnore: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue({ raw: [], identifiers: [] }),
      };
      skipLogRepoMock.createQueryBuilder.mockReturnValue(mockQb);

      await service.logSkips([
        {
          eventCode: 'RM_SUBMITTED',
          recipientUserId: 'u-1',
          recipientName: 'User One',
          recipientEmail: 'one@example.com',
          reason: 'OVERRIDE_OFF',
          entityId: 'rm-1',
          mode: 'ON',
        },
      ]);

      expect(skipLogRepoMock.createQueryBuilder).toHaveBeenCalled();
      expect(mockQb.insert).toHaveBeenCalled();
      expect(mockQb.into).toHaveBeenCalledWith(EmailSkipLog);
      expect(mockQb.values).toHaveBeenCalledWith([
        expect.objectContaining({
          eventCode: 'RM_SUBMITTED',
          recipientUserId: 'u-1',
          dedupeKey: 'RM_SUBMITTED:rm-1:u-1:OVERRIDE_OFF',
        }),
      ]);
      expect(mockQb.orIgnore).toHaveBeenCalled();
      expect(mockQb.execute).toHaveBeenCalled();
    });

    it('catches repository failure, logs a warning, and NEVER throws', async () => {
      const mockQb = {
        insert: vi.fn().mockReturnThis(),
        into: vi.fn().mockReturnThis(),
        values: vi.fn().mockReturnThis(),
        orIgnore: vi.fn().mockReturnThis(),
        execute: vi.fn().mockRejectedValue(new Error('DB Connection Timeout')),
      };
      skipLogRepoMock.createQueryBuilder.mockReturnValue(mockQb);

      await expect(
        service.logSkips([
          {
            eventCode: 'RM_SUBMITTED',
            recipientUserId: 'u-1',
            reason: 'OVERRIDE_OFF',
            mode: 'ON',
          },
        ]),
      ).resolves.not.toThrow();
    });
  });

  describe('list', () => {
    it('applies filters, orders newest first, and maps eventLabel and reasonText', async () => {
      const now = new Date();
      const mockRows = [
        {
          id: 's-1',
          eventCode: 'RM_SUBMITTED',
          recipientUserId: 'u-1',
          recipientName: 'User One',
          recipientEmail: 'one@example.com',
          reason: 'OVERRIDE_OFF',
          entityId: 'rm-101',
          mode: 'ON',
          createdAt: now,
        },
      ];

      const mockQb = {
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        addOrderBy: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue(mockRows),
      };
      skipLogRepoMock.createQueryBuilder.mockReturnValue(mockQb);

      const result = await service.list({
        eventCode: 'RM_SUBMITTED',
        userId: 'u-1',
        reason: 'OVERRIDE_OFF',
        limit: 10,
      });

      expect(mockQb.andWhere).toHaveBeenCalledWith('skip.eventCode = :eventCode', { eventCode: 'RM_SUBMITTED' });
      expect(mockQb.andWhere).toHaveBeenCalledWith('skip.recipientUserId = :userId', { userId: 'u-1' });
      expect(mockQb.andWhere).toHaveBeenCalledWith('skip.reason = :reason', { reason: 'OVERRIDE_OFF' });
      expect(mockQb.orderBy).toHaveBeenCalledWith('skip.createdAt', 'DESC');

      expect(result.entries).toHaveLength(1);
      expect(result.entries[0]).toEqual({
        id: 's-1',
        eventCode: 'RM_SUBMITTED',
        eventLabel: 'Raw Material Requisition Submitted',
        recipientUserId: 'u-1',
        recipientName: 'User One',
        recipientEmail: 'one@example.com',
        reason: 'OVERRIDE_OFF',
        reasonText: SKIP_REASON_TEXTS.OVERRIDE_OFF,
        entityId: 'rm-101',
        mode: 'ON',
        createdAt: now.toISOString(),
      });
      expect(result.nextCursor).toBeNull();
    });

    it('returns nextCursor when rows count exceeds limit', async () => {
      const now = new Date();
      const mockRows = [
        { id: 's-1', eventCode: 'RM_SUBMITTED', reason: 'OVERRIDE_OFF', createdAt: now },
        { id: 's-2', eventCode: 'RM_SUBMITTED', reason: 'OVERRIDE_OFF', createdAt: new Date(now.getTime() - 1000) },
      ];

      const mockQb = {
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        addOrderBy: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue(mockRows),
      };
      skipLogRepoMock.createQueryBuilder.mockReturnValue(mockQb);

      const result = await service.list({ limit: 1 });
      expect(result.entries).toHaveLength(1);
      expect(result.nextCursor).toBeTruthy();

      const decoded = JSON.parse(Buffer.from(result.nextCursor!, 'base64').toString('utf8'));
      expect(decoded.id).toBe('s-1');
    });
  });

  describe('summary', () => {
    it('aggregates counts byReason and byEvent over N days', async () => {
      const mockQb = {
        select: vi.fn().mockReturnThis(),
        addSelect: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockReturnThis(),
        getRawMany: vi
          .fn()
          .mockResolvedValueOnce([
            { reason: 'OVERRIDE_OFF', count: '5' },
            { reason: 'GLOBAL_OFF', count: '2' },
          ])
          .mockResolvedValueOnce([
            { eventCode: 'RM_SUBMITTED', count: '5' },
            { eventCode: 'DC_PENDING_2_DAYS', count: '2' },
          ]),
      };
      skipLogRepoMock.createQueryBuilder.mockReturnValue(mockQb);

      const summary = await service.summary(7);
      expect(summary.days).toBe(7);
      expect(summary.total).toBe(7);
      expect(summary.byReason).toEqual({
        OVERRIDE_OFF: 5,
        GLOBAL_OFF: 2,
      });
      expect(summary.byEvent).toEqual({
        RM_SUBMITTED: 5,
        DC_PENDING_2_DAYS: 2,
      });
    });
  });

  describe('purgeOld', () => {
    it('deletes rows older than cutoff from email_skip_log only', async () => {
      const mockQb = {
        delete: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue({ affected: 42 }),
      };
      skipLogRepoMock.createQueryBuilder.mockReturnValue(mockQb);

      const affected = await service.purgeOld(30);
      expect(mockQb.delete).toHaveBeenCalled();
      expect(mockQb.from).toHaveBeenCalledWith(EmailSkipLog);
      expect(mockQb.where).toHaveBeenCalledWith('created_at < :cutoff', expect.any(Object));
      expect(affected).toBe(42);
    });

    it('catches error during purge and returns 0 without throwing', async () => {
      const mockQb = {
        delete: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        execute: vi.fn().mockRejectedValue(new Error('Purge lock timeout')),
      };
      skipLogRepoMock.createQueryBuilder.mockReturnValue(mockQb);

      const affected = await service.purgeOld(30);
      expect(affected).toBe(0);
    });
  });
});
