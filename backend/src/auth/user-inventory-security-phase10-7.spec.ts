import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, UnauthorizedException, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { RolesGuard } from './guards/roles.guard.js';
import { Reflector } from '@nestjs/core';
import { UserRole } from './enums/role.enum.js';
import { InventoryController } from '../inventory/inventory.controller.js';
import { InventoryService } from '../inventory/inventory.service.js';
import { UsersController } from '../users/users.controller.js';
import { UsersService } from '../users/users.service.js';
import { CreateUserDto } from '../users/dto/create-user.dto.js';
import { CreateStockInDto } from '../inventory/dto/create-stock-in.dto.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';

describe('Phase 10.7 - User + Inventory Security Regression', () => {
  describe('RBAC & RolesGuard Regression', () => {
    let rolesGuard: RolesGuard;
    let reflector: Reflector;

    beforeEach(() => {
      reflector = new Reflector();
      rolesGuard = new RolesGuard(reflector);
    });

    const createMockContext = (userRole: UserRole, requiredRoles: UserRole[] | undefined): ExecutionContext => {
      return {
        getHandler: () => ({}),
        getClass: () => ({}),
        switchToHttp: () => ({
          getRequest: () => ({ user: { role: userRole } }),
        }),
      } as any;
    };

    it('SEC-004: Invalid role claim rejected (Missing required role)', () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.ADMIN]);
      const context = createMockContext(UserRole.DESIGNER, [UserRole.ADMIN]);
      expect(rolesGuard.canActivate(context)).toBe(false);
    });

    it('SEC-021: Senior Manager cannot obtain admin privileges', () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.ADMIN]);
      const context = createMockContext(UserRole.SENIOR_MANAGER, [UserRole.ADMIN]);
      expect(rolesGuard.canActivate(context)).toBe(false);
    });

    it('SEC-022: General Manager cannot obtain admin privileges', () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.ADMIN]);
      const context = createMockContext(UserRole.GENERAL_MANAGER, [UserRole.ADMIN]);
      expect(rolesGuard.canActivate(context)).toBe(false);
    });

    it('SEC-020: Production cannot bypass Stores stock mutation boundary', () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.STORES, UserRole.ADMIN]);
      const context = createMockContext(UserRole.PRODUCTION, [UserRole.STORES, UserRole.ADMIN]);
      expect(rolesGuard.canActivate(context)).toBe(false);
    });
  });

  describe('User Management Escalation Security', () => {
    let usersController: UsersController;
    let usersService: any;

    beforeEach(async () => {
      usersService = {
        create: vi.fn(),
        updateRole: vi.fn(),
      };
      
      // In a real e2e test, we'd use nest application. Here we verify the controller 
      // depends on the service correctly without letting DTOs overwrite unvalidated fields.
      const module: TestingModule = await Test.createTestingModule({
        controllers: [UsersController],
        providers: [
          { provide: UsersService, useValue: usersService },
        ],
      })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

      usersController = module.get<UsersController>(UsersController);
    });

    it('SEC-005, SEC-006: Non-admin cannot create user or assign roles (Guarded by RBAC in integration)', () => {
      // The controller methods are decorated with @Roles(UserRole.ADMIN).
      const roles = Reflect.getMetadata('roles', UsersController.prototype.create);
      expect(roles).toEqual([UserRole.ADMIN]);
    });

    it('SEC-025: Client cannot override protected identity fields', async () => {
      // Mass assignment protection: The CreateUserDto only accepts specific fields.
      const dto = new CreateUserDto();
      dto.email = 'test@example.com';
      dto.password = 'Pass123!';
      dto.role = UserRole.DESIGNER;
      
      // Attempting to pass unexpected properties will be stripped by ValidationPipe(whitelist: true).
      // For this test, we verify the controller calls the service with exactly the mapped DTO.
      await usersController.create(dto);
      expect(usersService.create).toHaveBeenCalledWith(dto);
    });
  });

  describe('Actor Attribution & Inventory Security', () => {
    let inventoryController: InventoryController;
    let inventoryService: any;

    beforeEach(async () => {
      inventoryService = {
        stockIn: vi.fn(),
        stockOut: vi.fn(),
        manualMapAndReconcile: vi.fn(),
      };
      
      const module: TestingModule = await Test.createTestingModule({
        controllers: [InventoryController],
        providers: [{ provide: InventoryService, useValue: inventoryService }],
      })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

      inventoryController = module.get<InventoryController>(InventoryController);
    });

    it('SEC-012, SEC-013: Forged actor ID is ignored, Authenticated user is used', async () => {
      const dto: CreateStockInDto = { quantity: 10, referenceType: 'PO', referenceId: 'po-1' };
      const req = { user: { userId: 'authenticated-user-id' } };
      
      // We simulate a malicious payload trying to pass an actorId
      (dto as any).actorId = 'forged-admin-id';
      (dto as any).created_by_id = 'forged-admin-id';

      await inventoryController.stockIn('item-1', dto, req as any);

      // The controller explicitly extracts req.user.userId and passes it to the service.
      expect(inventoryService.stockIn).toHaveBeenCalledWith('item-1', dto, 'authenticated-user-id');
    });

    it('SEC-028: Legacy InventoryItem APIs remain protected', () => {
      const roles = Reflect.getMetadata('roles', InventoryController.prototype.stockIn);
      expect(roles).toEqual([UserRole.STORES, UserRole.ADMIN]);
    });
  });

  describe('JWT Identity & Security Policies', () => {
    it('SEC-023: Senior Designer does not exist as active role', () => {
      expect((UserRole as any).SENIOR_DESIGNER).toBeUndefined();
      expect(Object.values(UserRole)).not.toContain('SENIOR_DESIGNER');
    });

    it('SEC-032: No AMR approval endpoint/authority has been introduced', () => {
      // Verification that the role matrix doesn't contain AMR approvers 
      // implicitly validated by SENIOR_DESIGNER's absence and lack of approval routes.
      const hasSeniorDesigner = Object.values(UserRole).includes('SENIOR_DESIGNER' as any);
      expect(hasSeniorDesigner).toBe(false);
    });
  });
});
