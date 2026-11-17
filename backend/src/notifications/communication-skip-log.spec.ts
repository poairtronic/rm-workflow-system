import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CommunicationService } from './communication.service.js';

describe('CommunicationService — Phase 6 Skip Logging', () => {
  let service: CommunicationService;
  let notificationRepoMock: any;
  let userRepoMock: any;
  let roleRepoMock: any;
  let emailQueueServiceMock: any;
  let notificationsServiceMock: any;
  let templateServiceMock: any;
  let emailIdempotencyServiceMock: any;
  let recipientServiceMock: any;
  let notificationsGatewayMock: any;
  let notificationPreferenceServiceMock: any;
  let emailSkipLogServiceMock: any;

  beforeEach(() => {
    notificationRepoMock = {
      findOne: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockReturnValue({}),
      save: vi.fn().mockResolvedValue({}),
    };
    userRepoMock = {};
    roleRepoMock = {};
    emailQueueServiceMock = {
      enqueueJob: vi.fn().mockResolvedValue({ id: 'job-1' }),
    };
    notificationsServiceMock = {
      getGlobalWorkflowEmailEnabled: vi.fn().mockResolvedValue(true),
      getConsumableEmailAlertsEnabled: vi.fn().mockResolvedValue(true),
    };
    templateServiceMock = {
      render: vi.fn().mockReturnValue({
        templateKey: 'RM_SUBMITTED',
        subject: 'Sub',
        text: 'Txt',
        html: '<p>Html</p>',
      }),
    };
    emailIdempotencyServiceMock = {
      generateKey: vi.fn().mockReturnValue('idemp-key'),
    };
    recipientServiceMock = {
      resolveRecipients: vi.fn().mockResolvedValue([
        { id: 'u-1', email: 'u1@example.com', name: 'User 1', isActive: true },
      ]),
      findActiveUsersByRoles: vi.fn().mockResolvedValue([
        { id: 'u-1', email: 'u1@example.com', name: 'User 1', isActive: true },
      ]),
    };
    notificationsGatewayMock = {
      broadcastNotification: vi.fn(),
    };
    notificationPreferenceServiceMock = {
      getMode: vi.fn().mockResolvedValue('ON'),
      resolveRecipients: vi.fn().mockResolvedValue([
        { id: 'u-1', email: 'u1@example.com', name: 'User 1', isActive: true },
      ]),
      resolveRecipientsDetailed: vi.fn().mockResolvedValue({
        recipients: [{ id: 'u-1', email: 'u1@example.com', name: 'User 1', isActive: true }],
        skipped: [
          {
            user: { id: 'u-2', email: 'u2@example.com', name: 'User 2' },
            reason: 'OVERRIDE_OFF',
          },
        ],
      }),
    };
    emailSkipLogServiceMock = {
      logSkips: vi.fn().mockResolvedValue(undefined),
    };

    service = new CommunicationService(
      notificationRepoMock,
      userRepoMock,
      roleRepoMock,
      emailQueueServiceMock,
      notificationsServiceMock,
      templateServiceMock,
      emailIdempotencyServiceMock,
      recipientServiceMock,
      notificationsGatewayMock,
      notificationPreferenceServiceMock,
      emailSkipLogServiceMock,
    );
  });

  it('global switch OFF -> logs one GLOBAL_OFF row per event, no per-user rows', async () => {
    notificationsServiceMock.getGlobalWorkflowEmailEnabled.mockResolvedValue(false);

    const result = await service.sendEvent({
      eventType: 'RM_SUBMITTED',
      entityType: 'RM_REQUEST',
      entityId: 'rm-101',
      metadata: {},
    });

    expect(result.emailJobs).toHaveLength(0);
    expect(emailSkipLogServiceMock.logSkips).toHaveBeenCalledWith([
      {
        eventCode: 'RM_SUBMITTED',
        reason: 'GLOBAL_OFF',
        entityId: 'rm-101',
        mode: 'ON',
      },
    ]);
  });

  it('consumable gate OFF -> logs CONSUMABLE_GATE_OFF row for consumable events only', async () => {
    notificationsServiceMock.getConsumableEmailAlertsEnabled.mockResolvedValue(false);

    const result = await service.sendEvent({
      eventType: 'CONSUMABLE_PENDING_2_DAYS',
      entityType: 'CONSUMABLE_REQUEST',
      entityId: 'cr-202',
      metadata: {},
    });

    expect(result.emailJobs).toHaveLength(0);
    expect(emailSkipLogServiceMock.logSkips).toHaveBeenCalledWith([
      {
        eventCode: 'CONSUMABLE_PENDING_2_DAYS',
        reason: 'CONSUMABLE_GATE_OFF',
        entityId: 'cr-202',
        mode: 'ON',
      },
    ]);
  });

  it('mode ON -> logs user-level skips returned by resolveRecipientsDetailed', async () => {
    const result = await service.sendEvent({
      eventType: 'RM_SUBMITTED',
      entityType: 'RM_REQUEST',
      entityId: 'rm-303',
      metadata: {},
    });

    expect(result.emailJobs).toHaveLength(1);
    expect(emailSkipLogServiceMock.logSkips).toHaveBeenCalledWith([
      {
        eventCode: 'RM_SUBMITTED',
        recipientUserId: 'u-2',
        recipientName: 'User 2',
        recipientEmail: 'u2@example.com',
        reason: 'OVERRIDE_OFF',
        entityId: 'rm-303',
        mode: 'ON',
      },
    ]);
  });

  it('mode OFF and SHADOW -> no user-level rows logged', async () => {
    // Mode OFF
    notificationPreferenceServiceMock.getMode.mockResolvedValue('OFF');
    recipientServiceMock.findActiveUsersByRoles.mockResolvedValue([
      { id: 'u-legacy', email: 'legacy@example.com', name: 'Legacy' },
    ]);

    await service.sendEvent({
      eventType: 'RM_SUBMITTED',
      entityType: 'RM_REQUEST',
      entityId: 'rm-404',
      metadata: {},
    });

    expect(notificationPreferenceServiceMock.resolveRecipientsDetailed).not.toHaveBeenCalled();
    expect(emailSkipLogServiceMock.logSkips).not.toHaveBeenCalled();

    // Mode SHADOW
    emailSkipLogServiceMock.logSkips.mockClear();
    notificationPreferenceServiceMock.getMode.mockResolvedValue('SHADOW');
    notificationPreferenceServiceMock.resolveRecipients.mockResolvedValue([
      { id: 'u-legacy', email: 'legacy@example.com', name: 'Legacy' },
    ]);

    await service.sendEvent({
      eventType: 'RM_SUBMITTED',
      entityType: 'RM_REQUEST',
      entityId: 'rm-505',
      metadata: {},
    });

    expect(emailSkipLogServiceMock.logSkips).not.toHaveBeenCalled();
  });

  it('logging failure (repository throws) -> email jobs are still enqueued, recipients unchanged', async () => {
    emailSkipLogServiceMock.logSkips.mockRejectedValue(new Error('Skip log table locked'));

    const result = await service.sendEvent({
      eventType: 'RM_SUBMITTED',
      entityType: 'RM_REQUEST',
      entityId: 'rm-606',
      metadata: {},
    });

    // The email was still processed and enqueued
    expect(result.emailJobs).toHaveLength(1);
    expect(emailQueueServiceMock.enqueueJob).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientUserId: 'u-1',
      }),
    );
  });
});
