import { Test, TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GeneralIssueController } from './general-issue.controller.js';
import { GeneralIssueService } from './general-issue.service.js';
import { UserRole } from '../auth/enums/role.enum.js';
import { Reflector } from '@nestjs/core';

describe('GeneralIssueController — RBAC & Business Rules (Phase 17.2)', () => {
  let controller: GeneralIssueController;
  let service: GeneralIssueService;
  let reflector: Reflector;

  const mockService = {
    createIssue: vi.fn(),
    findAll: vi.fn(),
    findOne: vi.fn(),
    cancelIssue: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GeneralIssueController],
      providers: [
        {
          provide: GeneralIssueService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<GeneralIssueController>(GeneralIssueController);
    service = module.get<GeneralIssueService>(GeneralIssueService);
    reflector = new Reflector();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('Rule 7: Who Can Create (RBAC)', () => {
    it('should restrict createIssue endpoint to STORES and ADMIN only', () => {
      const roles = reflector.get<string[]>('roles', controller.createIssue);
      expect(roles).toBeDefined();
      expect(roles).toEqual([UserRole.STORES, UserRole.ADMIN]);
      expect(roles).not.toContain(UserRole.DESIGNER);
      expect(roles).not.toContain(UserRole.PRODUCTION);
      expect(roles).not.toContain(UserRole.SENIOR_MANAGER);
      expect(roles).not.toContain(UserRole.GENERAL_MANAGER);
    });

    it('should delegate createIssue to service with actor userId', async () => {
      const dto = {
        reason: 'Internal maintenance',
        items: [{ productId: 'p1', binId: 'b1', quantityIssued: 10 }],
      };
      const req = { user: { userId: 'stores-user-uuid' } };

      mockService.createIssue.mockResolvedValue({ id: 'new-issue-id' });

      const result = await controller.createIssue(dto as any, req);
      expect(service.createIssue).toHaveBeenCalledWith(dto, 'stores-user-uuid');
      expect(result).toEqual({ id: 'new-issue-id' });
    });
  });

  describe('Rule 8: Who Can View (RBAC)', () => {
    it('should permit all operational and monitoring roles to view all general issues', () => {
      const roles = reflector.get<string[]>('roles', controller.findAll);
      expect(roles).toBeDefined();
      expect(roles).toContain(UserRole.ADMIN);
      expect(roles).toContain(UserRole.STORES);
      expect(roles).toContain(UserRole.PRODUCTION);
      expect(roles).toContain(UserRole.DESIGNER);
      expect(roles).toContain(UserRole.SENIOR_MANAGER);
      expect(roles).toContain(UserRole.GENERAL_MANAGER);
    });

    it('should permit all operational and monitoring roles to view single general issue', () => {
      const roles = reflector.get<string[]>('roles', controller.findOne);
      expect(roles).toBeDefined();
      expect(roles).toContain(UserRole.ADMIN);
      expect(roles).toContain(UserRole.STORES);
      expect(roles).toContain(UserRole.PRODUCTION);
      expect(roles).toContain(UserRole.DESIGNER);
      expect(roles).toContain(UserRole.SENIOR_MANAGER);
      expect(roles).toContain(UserRole.GENERAL_MANAGER);
    });
  });

  describe('Rule 10 & 11: Reversal / Cancellation Permissions (RBAC)', () => {
    it('should restrict cancelIssue endpoint to STORES and ADMIN only', () => {
      const roles = reflector.get<string[]>('roles', controller.cancelIssue);
      expect(roles).toBeDefined();
      expect(roles).toEqual([UserRole.STORES, UserRole.ADMIN]);
      expect(roles).not.toContain(UserRole.DESIGNER);
      expect(roles).not.toContain(UserRole.PRODUCTION);
      expect(roles).not.toContain(UserRole.SENIOR_MANAGER);
      expect(roles).not.toContain(UserRole.GENERAL_MANAGER);
    });

    it('should delegate cancellation to service with actor userId and remarks', async () => {
      const req = { user: { userId: 'admin-user-uuid' } };
      mockService.cancelIssue.mockResolvedValue({ id: 'issue-cancelled' });

      const result = await controller.cancelIssue('issue-1', { remarks: 'Wrong batch' }, req);
      expect(service.cancelIssue).toHaveBeenCalledWith('issue-1', 'admin-user-uuid', 'Wrong batch');
      expect(result).toEqual({ id: 'issue-cancelled' });
    });
  });
});
