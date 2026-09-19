import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { RolesGuard } from './guards/roles.guard.js';
import { UserRole } from './enums/role.enum.js';
import { ROLES_KEY } from './decorators/roles.decorator.js';

describe('RolesGuard - RBAC Security Matrix', () => {
  let rolesGuard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    rolesGuard = new RolesGuard(reflector);
  });

  const createMockContext = (user: any): ExecutionContext => {
    return {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as any;
  };

  it('RBAC-001: Unauthenticated user denied user management', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.ADMIN]);
    const context = createMockContext(undefined);
    expect(rolesGuard.canActivate(context)).toBe(false);
  });

  it('RBAC-002: DESIGNER cannot create user (requires ADMIN)', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.ADMIN]);
    const context = createMockContext({ role: UserRole.DESIGNER });
    expect(rolesGuard.canActivate(context)).toBe(false);
  });

  it('RBAC-003: STORES cannot create user (requires ADMIN)', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.ADMIN]);
    const context = createMockContext({ role: UserRole.STORES });
    expect(rolesGuard.canActivate(context)).toBe(false);
  });

  it('RBAC-004: PRODUCTION cannot create user (requires ADMIN)', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.ADMIN]);
    const context = createMockContext({ role: UserRole.PRODUCTION });
    expect(rolesGuard.canActivate(context)).toBe(false);
  });

  it('RBAC-005: SENIOR_MANAGER cannot create user (requires ADMIN)', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.ADMIN]);
    const context = createMockContext({ role: UserRole.SENIOR_MANAGER });
    expect(rolesGuard.canActivate(context)).toBe(false);
  });

  it('RBAC-006: GENERAL_MANAGER cannot create user (requires ADMIN)', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.ADMIN]);
    const context = createMockContext({ role: UserRole.GENERAL_MANAGER });
    expect(rolesGuard.canActivate(context)).toBe(false);
  });

  it('RBAC-007: ADMIN can create authorized user', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.ADMIN]);
    const context = createMockContext({ role: UserRole.ADMIN });
    expect(rolesGuard.canActivate(context)).toBe(true);
  });

  it('RBAC-008, 009, 010: Non-admin cannot assign ADMIN or change roles (via Guard protection on PATCH/PUT)', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.ADMIN]);
    const contextDesigner = createMockContext({ role: UserRole.DESIGNER });
    const contextStores = createMockContext({ role: UserRole.STORES });
    expect(rolesGuard.canActivate(contextDesigner)).toBe(false);
    expect(rolesGuard.canActivate(contextStores)).toBe(false);
  });

  it('RBAC-013: Role guard rejects unauthorized role', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue([
      UserRole.PRODUCTION,
    ]);
    const context = createMockContext({ role: UserRole.DESIGNER });
    expect(rolesGuard.canActivate(context)).toBe(false);
  });

  it('RBAC-014: JWT role tampering rejected (simulated invalid JWT structure)', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.ADMIN]);
    const context = createMockContext({ role: 'HACKED_ROLE' });
    expect(rolesGuard.canActivate(context)).toBe(false);
  });

  it('RBAC-017: Senior Manager cannot perform unauthorized write action', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue([
      UserRole.PRODUCTION,
      UserRole.STORES,
    ]);
    const context = createMockContext({ role: UserRole.SENIOR_MANAGER });
    expect(rolesGuard.canActivate(context)).toBe(false);
  });

  it('RBAC-018: General Manager cannot perform unauthorized write action', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue([
      UserRole.PRODUCTION,
      UserRole.STORES,
    ]);
    const context = createMockContext({ role: UserRole.GENERAL_MANAGER });
    expect(rolesGuard.canActivate(context)).toBe(false);
  });

  it('RBAC-019: Production cannot perform Stores Issue', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue([
      UserRole.STORES,
      UserRole.ADMIN,
    ]);
    const context = createMockContext({ role: UserRole.PRODUCTION });
    expect(rolesGuard.canActivate(context)).toBe(false);
  });

  it('RBAC-020: Designer cannot perform Stores Issue', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue([
      UserRole.STORES,
      UserRole.ADMIN,
    ]);
    const context = createMockContext({ role: UserRole.DESIGNER });
    expect(rolesGuard.canActivate(context)).toBe(false);
  });
});
