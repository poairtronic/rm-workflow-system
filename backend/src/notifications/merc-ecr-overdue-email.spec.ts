import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TemplateService } from '../email/template.service.js';
import { CommunicationService, PERMITTED_EMAIL_CONFIG } from './communication.service.js';
import { AlertSweepService, SWEEP_CONFIGS } from '../alert-sweeps/alert-sweeps.service.js';
import { UserRole } from '../auth/enums/role.enum.js';
import { LessThanOrEqual } from 'typeorm';

describe('MERC & ECR Overdue Email Verification (Separated & Non-Mutating)', () => {
  const templateService = new TemplateService();

  // =========================================================================
  // 1. MERC INDENT OVERDUE EMAIL TESTS (SEPARATE)
  // =========================================================================
  describe('Part 1: MERC Indent Overdue Email (>24h)', () => {
    describe('1.1 Email Template & Content Rendering', () => {
      it('renders MERC overdue email with correct subject, body, and action URL', () => {
        const payload = {
          recipientName: 'Ramu Stores',
          indentNumber: 'AGIPL-IND-2026-239',
          poNumber: 'PO-112',
          customerName: 'LGB Rework',
          hoursOverdue: 28,
          actionUrl: 'http://localhost:5173/governance/merc-indents/indent-1',
        };

        const result = templateService.render('MERC_INDENT_ISSUE_OVERDUE_24H', payload);

        expect(result.subject).toBe('[V-SMART] OVERDUE: MERC Indent Stores Issue Pending (>24h) - Indent AGIPL-IND-2026-239');
        expect(result.text).toContain('ALERT: MERC Indent AGIPL-IND-2026-239 (PO: PO-112, Customer: LGB Rework) has not been issued to Production for over 28 hours.');
        expect(result.text).toContain('http://localhost:5173/governance/merc-indents/indent-1');
        expect(result.html).toContain('MERC Indent Stores Issue Overdue Alert');
        expect(result.html).toContain('AGIPL-IND-2026-239');
        expect(result.html).toContain('PO-112');
        expect(result.html).toContain('LGB Rework');
        expect(result.html).toContain('28 hrs');
        expect(result.html).toContain('http://localhost:5173/governance/merc-indents/indent-1');
      });

      it('validates required variables for MERC email (indentNumber is mandatory)', () => {
        expect(() => {
          templateService.render('MERC_INDENT_ISSUE_OVERDUE_24H', {
            recipientName: 'Stores',
            // indentNumber missing
          });
        }).toThrow(/Missing required variable "indentNumber"/);
      });
    });

    describe('1.2 Recipient Authorization & Permission Rules', () => {
      it('authorizes STORES, SENIOR_MANAGER, and ADMIN roles for MERC overdue emails', () => {
        const config = PERMITTED_EMAIL_CONFIG['MERC_INDENT_ISSUE_OVERDUE_24H'];
        expect(config).toBeDefined();
        expect(config.recipientType).toBe('ROLES');
        expect(config.allowedRoles).toContain('STORES');
        expect(config.allowedRoles).toContain('SENIOR_MANAGER');
        expect(config.allowedRoles).toContain('ADMIN');
        expect(config.allowedRoles).not.toContain('PRODUCTION');
        expect(config.allowedRoles).not.toContain('DESIGNER');
      });

      it('dispatches email to authorized recipients and skips users with override OFF', async () => {
        const mockNotificationRepo = {
          create: vi.fn().mockImplementation((val) => val),
          createQueryBuilder: vi.fn().mockReturnValue({
            insert: vi.fn().mockReturnThis(),
            into: vi.fn().mockReturnThis(),
            values: vi.fn().mockReturnThis(),
            orIgnore: vi.fn().mockReturnThis(),
            execute: vi.fn().mockResolvedValue({ raw: [] }),
          }),
        };
        const mockUserRepo = { find: vi.fn() };
        const mockRoleRepo = { find: vi.fn() };
        const mockEmailQueue = {
          enqueueJob: vi.fn().mockResolvedValue({ id: 'job-1' }),
        };
        const mockNotificationsService = {
          getGlobalWorkflowEmailEnabled: vi.fn().mockResolvedValue(true),
          getConsumableEmailAlertsEnabled: vi.fn().mockResolvedValue(true),
        };
        const mockRecipientService = {
          resolveRecipients: vi.fn().mockResolvedValue([
            { id: 'user-stores-1', name: 'Ramu', email: 'ramu@velan.com', role: { name: UserRole.STORES }, isActive: true },
            { id: 'user-sm-1', name: 'Amritha', email: 'amritha@velan.com', role: { name: UserRole.SENIOR_MANAGER }, isActive: true },
          ]),
          findActiveUsersByRoles: vi.fn().mockResolvedValue([
            { id: 'user-stores-1', name: 'Ramu', email: 'ramu@velan.com', role: { name: UserRole.STORES }, isActive: true },
            { id: 'user-sm-1', name: 'Amritha', email: 'amritha@velan.com', role: { name: UserRole.SENIOR_MANAGER }, isActive: true },
          ]),
        };
        const mockPrefService = {
          getMode: vi.fn().mockResolvedValue('ON'),
          resolveRecipients: vi.fn().mockResolvedValue([
            // Only Ramu is enabled, Amritha has turned it OFF in preferences
            { id: 'user-stores-1', name: 'Ramu', email: 'ramu@velan.com', role: { name: UserRole.STORES }, isActive: true },
          ]),
          resolveRecipientsDetailed: vi.fn().mockResolvedValue({
            recipients: [{ id: 'user-stores-1', name: 'Ramu', email: 'ramu@velan.com', isActive: true }],
            skipped: [{ user: { id: 'user-sm-1', name: 'Amritha', email: 'amritha@velan.com', isActive: true }, reason: 'OVERRIDE_OFF' }],
          }),
        };

        const commService = new CommunicationService(
          mockNotificationRepo as any,
          mockUserRepo as any,
          mockRoleRepo as any,
          mockEmailQueue as any,
          mockNotificationsService as any,
          templateService,
          undefined,
          mockRecipientService as any,
          undefined,
          mockPrefService as any,
        );

        const result = await commService.sendEvent({
          eventType: 'MERC_INDENT_ISSUE_OVERDUE_24H',
          entityType: 'MERC_INDENT',
          entityId: 'indent-101',
          metadata: {
            indentNumber: 'AGIPL-IND-2026-239',
            poNumber: '112',
            customerName: 'LGB Rework',
            hoursOverdue: 26,
            actionUrl: 'http://localhost:5173/governance/merc-indents/indent-101',
          },
        });

        // Exactly 1 email queued for Ramu, zero for Amritha (who had override OFF)
        expect(mockEmailQueue.enqueueJob).toHaveBeenCalledTimes(1);
        expect(mockEmailQueue.enqueueJob).toHaveBeenCalledWith(
          expect.objectContaining({
            recipientEmail: 'ramu@velan.com',
            templateKey: 'MERC_INDENT_ISSUE_OVERDUE_24H',
          }),
        );
      });
    });

    describe('1.3 Alert Sweep & Overdue Detection Logic', () => {
      it('sweepMercIndentIssueOverdue finds only pending indents older than 24h and sends alert', async () => {
        const mockMercRepo = {
          find: vi.fn().mockResolvedValue([
            {
              id: 'indent-1',
              indentNumber: 'AGIPL-IND-2026-239',
              poNumber: '112',
              customerName: 'LGB Rework',
              status: 'PENDING',
              isDeleted: false,
              createdAt: new Date(Date.now() - 26 * 60 * 60 * 1000), // 26 hours ago
            },
          ]),
          count: vi.fn().mockResolvedValue(1),
        };

        const mockSystemSettingRepo = {
          findOne: vi.fn().mockImplementation(async ({ where }) => {
            if (where.key === 'MERC_INDENT_OVERDUE_ALERTS_ENABLED') return { key: where.key, value: 'true' };
            if (where.key === 'MERC_INDENT_OVERDUE_ALERT_HOURS') return { key: where.key, value: '24' };
            return null;
          }),
        };

        const mockCommService = {
          sendEvent: vi.fn().mockResolvedValue({ inAppNotifications: [], emailJobs: [] }),
        };

        const sweepService = new AlertSweepService(
          {} as any,
          mockSystemSettingRepo as any,
          {} as any,
          {} as any,
          {} as any,
          {} as any,
          {} as any,
          {} as any,
          mockCommService as any,
          {} as any,
          mockMercRepo as any,
          {} as any,
        );

        const count = await sweepService.sweepMercIndentIssueOverdue();

        expect(count).toBe(1);
        expect(mockMercRepo.find).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              status: 'PENDING',
              isDeleted: false,
            }),
          }),
        );
        expect(mockCommService.sendEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            eventType: 'MERC_INDENT_ISSUE_OVERDUE_24H',
            metadata: expect.objectContaining({
              indentNumber: 'AGIPL-IND-2026-239',
              poNumber: '112',
              customerName: 'LGB Rework',
            }),
          }),
        );
      });

      it('previewSweep correctly samples overdue MERC indents without mutating data', async () => {
        const mockMercRepo = {
          find: vi.fn().mockResolvedValue([
            {
              id: 'indent-1',
              indentNumber: 'AGIPL-IND-2026-239',
              poNumber: '112',
              customerName: 'LGB Rework',
              createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
            },
          ]),
          count: vi.fn().mockResolvedValue(3),
        };

        const mockSystemSettingRepo = {
          findOne: vi.fn().mockResolvedValue(null),
        };

        const sweepService = new AlertSweepService(
          {} as any,
          mockSystemSettingRepo as any,
          {} as any,
          {} as any,
          {} as any,
          {} as any,
          {} as any,
          {} as any,
          {} as any,
          {} as any,
          mockMercRepo as any,
          {} as any,
        );

        const preview = await sweepService.previewSweep('MERC_INDENT_ISSUE_OVERDUE_24H');

        expect(preview.matchCount).toBe(1);
        expect(preview.sample[0].referenceNumber).toBe('AGIPL-IND-2026-239');
        expect(preview.sample[0].hoursPending).toBeGreaterThanOrEqual(24);
        expect(preview.notYetTimedCount).toBe(3);
      });
    });
  });

  // =========================================================================
  // 2. ECR MATERIAL ISSUE OVERDUE EMAIL TESTS (SEPARATE)
  // =========================================================================
  describe('Part 2: ECR Material Issue Overdue Email (>24h)', () => {
    describe('2.1 Email Template & Content Rendering', () => {
      it('renders ECR overdue email with correct subject, body, component info, and action URL', () => {
        const payload = {
          recipientName: 'Sidharth Stores',
          reportNumber: 'AGIPL-2026-ERR-IN187',
          scNumber: '11',
          poNumber: '11',
          component: 'AIR PLUG GAUGE',
          quantityAffected: 1,
          hoursOverdue: 30,
          actionUrl: 'http://localhost:5173/governance/ecr-issues',
        };

        const result = templateService.render('ECR_MATERIAL_ISSUE_OVERDUE_24H', payload);

        expect(result.subject).toBe('[V-SMART] OVERDUE: ECR Material Stores Issue Pending (>24h) - Report AGIPL-2026-ERR-IN187');
        expect(result.text).toContain('ALERT: ECR Defect Report AGIPL-2026-ERR-IN187 for component "AIR PLUG GAUGE" (SC: 11, PO: 11) has not been issued to Production for over 30 hours.');
        expect(result.text).toContain('http://localhost:5173/governance/ecr-issues');
        expect(result.html).toContain('ECR Material Stores Issue Overdue Alert');
        expect(result.html).toContain('AGIPL-2026-ERR-IN187');
        expect(result.html).toContain('AIR PLUG GAUGE');
        expect(result.html).toContain('SC 11 / PO 11');
        expect(result.html).toContain('30 hrs');
        expect(result.html).toContain('http://localhost:5173/governance/ecr-issues');
      });

      it('validates required variables for ECR email (reportNumber is mandatory)', () => {
        expect(() => {
          templateService.render('ECR_MATERIAL_ISSUE_OVERDUE_24H', {
            recipientName: 'Stores',
            component: 'AIR PLUG GAUGE',
            // reportNumber missing
          });
        }).toThrow(/Missing required variable "reportNumber"/);
      });
    });

    describe('2.2 Recipient Authorization & Permission Rules', () => {
      it('authorizes STORES, SENIOR_MANAGER, and ADMIN roles for ECR overdue emails', () => {
        const config = PERMITTED_EMAIL_CONFIG['ECR_MATERIAL_ISSUE_OVERDUE_24H'];
        expect(config).toBeDefined();
        expect(config.recipientType).toBe('ROLES');
        expect(config.allowedRoles).toContain('STORES');
        expect(config.allowedRoles).toContain('SENIOR_MANAGER');
        expect(config.allowedRoles).toContain('ADMIN');
        expect(config.allowedRoles).not.toContain('PRODUCTION');
        expect(config.allowedRoles).not.toContain('DESIGNER');
      });

      it('dispatches email to authorized recipients and skips users with override OFF', async () => {
        const mockNotificationRepo = {
          create: vi.fn().mockImplementation((val) => val),
          createQueryBuilder: vi.fn().mockReturnValue({
            insert: vi.fn().mockReturnThis(),
            into: vi.fn().mockReturnThis(),
            values: vi.fn().mockReturnThis(),
            orIgnore: vi.fn().mockReturnThis(),
            execute: vi.fn().mockResolvedValue({ raw: [] }),
          }),
        };
        const mockUserRepo = { find: vi.fn() };
        const mockRoleRepo = { find: vi.fn() };
        const mockEmailQueue = {
          enqueueJob: vi.fn().mockResolvedValue({ id: 'job-ecr-1' }),
        };
        const mockNotificationsService = {
          getGlobalWorkflowEmailEnabled: vi.fn().mockResolvedValue(true),
          getConsumableEmailAlertsEnabled: vi.fn().mockResolvedValue(true),
        };
        const mockRecipientService = {
          resolveRecipients: vi.fn().mockResolvedValue([
            { id: 'user-stores-1', name: 'Sidharth', email: 'sidharth@velan.com', role: { name: UserRole.STORES }, isActive: true },
          ]),
          findActiveUsersByRoles: vi.fn().mockResolvedValue([
            { id: 'user-stores-1', name: 'Sidharth', email: 'sidharth@velan.com', role: { name: UserRole.STORES }, isActive: true },
          ]),
        };
        const mockPrefService = {
          getMode: vi.fn().mockResolvedValue('ON'),
          resolveRecipients: vi.fn().mockResolvedValue([
            { id: 'user-stores-1', name: 'Sidharth', email: 'sidharth@velan.com', role: { name: UserRole.STORES }, isActive: true },
          ]),
          resolveRecipientsDetailed: vi.fn().mockResolvedValue({
            recipients: [{ id: 'user-stores-1', name: 'Sidharth', email: 'sidharth@velan.com', isActive: true }],
            skipped: [],
          }),
        };

        const commService = new CommunicationService(
          mockNotificationRepo as any,
          mockUserRepo as any,
          mockRoleRepo as any,
          mockEmailQueue as any,
          mockNotificationsService as any,
          templateService,
          undefined,
          mockRecipientService as any,
          undefined,
          mockPrefService as any,
        );

        const result = await commService.sendEvent({
          eventType: 'ECR_MATERIAL_ISSUE_OVERDUE_24H',
          entityType: 'ECR_ISSUE',
          entityId: 'ecr-issue-101',
          metadata: {
            reportNumber: 'AGIPL-2026-ERR-IN187',
            scNumber: '11',
            poNumber: '11',
            component: 'AIR PLUG GAUGE',
            quantityAffected: 1,
            hoursOverdue: 25,
            actionUrl: 'http://localhost:5173/governance/ecr-issues',
          },
        });

        // Exactly 1 email queued for Sidharth
        expect(mockEmailQueue.enqueueJob).toHaveBeenCalledTimes(1);
        expect(mockEmailQueue.enqueueJob).toHaveBeenCalledWith(
          expect.objectContaining({
            recipientEmail: 'sidharth@velan.com',
            templateKey: 'ECR_MATERIAL_ISSUE_OVERDUE_24H',
          }),
        );
      });
    });

    describe('2.3 Alert Sweep & Overdue Detection Logic', () => {
      it('sweepEcrMaterialIssueOverdue finds only pending defect reports older than 24h and sends alert', async () => {
        const mockEcrRepo = {
          find: vi.fn().mockResolvedValue([
            {
              id: 'ecr-1',
              reportNumber: 'AGIPL-2026-ERR-IN187',
              scNumber: '11',
              poNumber: '11',
              component: 'AIR PLUG GAUGE',
              quantityAffected: 1,
              status: 'PENDING',
              isDeleted: false,
              createdAt: new Date(Date.now() - 36 * 60 * 60 * 1000), // 36 hours ago
            },
          ]),
          count: vi.fn().mockResolvedValue(1),
        };

        const mockSystemSettingRepo = {
          findOne: vi.fn().mockImplementation(async ({ where }) => {
            if (where.key === 'ECR_MATERIAL_OVERDUE_ALERTS_ENABLED') return { key: where.key, value: 'true' };
            if (where.key === 'ECR_MATERIAL_OVERDUE_ALERT_HOURS') return { key: where.key, value: '24' };
            return null;
          }),
        };

        const mockCommService = {
          sendEvent: vi.fn().mockResolvedValue({ inAppNotifications: [], emailJobs: [] }),
        };

        const sweepService = new AlertSweepService(
          {} as any,
          mockSystemSettingRepo as any,
          {} as any,
          {} as any,
          {} as any,
          {} as any,
          {} as any,
          {} as any,
          mockCommService as any,
          {} as any,
          {} as any,
          mockEcrRepo as any,
        );

        const count = await sweepService.sweepEcrMaterialIssueOverdue();

        expect(count).toBe(1);
        expect(mockEcrRepo.find).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              status: 'PENDING',
              isDeleted: false,
            }),
          }),
        );
        expect(mockCommService.sendEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            eventType: 'ECR_MATERIAL_ISSUE_OVERDUE_24H',
            metadata: expect.objectContaining({
              reportNumber: 'AGIPL-2026-ERR-IN187',
              component: 'AIR PLUG GAUGE',
              quantityAffected: 1,
            }),
          }),
        );
      });

      it('previewSweep correctly samples overdue ECR defect reports without mutating data', async () => {
        const mockEcrRepo = {
          find: vi.fn().mockResolvedValue([
            {
              id: 'ecr-1',
              reportNumber: 'AGIPL-2026-ERR-IN187',
              scNumber: '11',
              poNumber: '11',
              component: 'AIR PLUG GAUGE',
              quantityAffected: 1,
              createdAt: new Date(Date.now() - 36 * 60 * 60 * 1000),
            },
          ]),
          count: vi.fn().mockResolvedValue(0),
        };

        const mockSystemSettingRepo = {
          findOne: vi.fn().mockResolvedValue(null),
        };

        const sweepService = new AlertSweepService(
          {} as any,
          mockSystemSettingRepo as any,
          {} as any,
          {} as any,
          {} as any,
          {} as any,
          {} as any,
          {} as any,
          {} as any,
          {} as any,
          {} as any,
          mockEcrRepo as any,
        );

        const preview = await sweepService.previewSweep('ECR_MATERIAL_ISSUE_OVERDUE_24H');

        expect(preview.matchCount).toBe(1);
        expect(preview.sample[0].referenceNumber).toBe('AGIPL-2026-ERR-IN187');
        expect(preview.sample[0].details?.component).toBe('AIR PLUG GAUGE');
        expect(preview.sample[0].hoursPending).toBeGreaterThanOrEqual(24);
        expect(preview.notYetTimedCount).toBe(0);
      });
    });
  });
});
