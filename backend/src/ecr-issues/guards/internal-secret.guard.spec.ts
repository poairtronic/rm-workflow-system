import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { InternalSecretGuard } from './internal-secret.guard.js';

describe('InternalSecretGuard', () => {
  let guard: InternalSecretGuard;
  let mockConfigService: any;

  beforeEach(() => {
    process.env.RM_INTERNAL_SECRET = 'test_secret_123';
    mockConfigService = {
      get: vi.fn().mockImplementation((key: string) => {
        if (key === 'RM_INTERNAL_SECRET') return 'test_secret_123';
        return undefined;
      }),
    };
    guard = new InternalSecretGuard(mockConfigService);
  });

  afterEach(() => {
    delete process.env.RM_INTERNAL_SECRET;
  });

  const createMockContext = (headers: Record<string, string>): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ headers }),
      }),
    } as unknown as ExecutionContext;
  };

  it('should allow activation when x-internal-secret header matches', () => {
    const context = createMockContext({ 'x-internal-secret': 'test_secret_123' });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should throw UnauthorizedException when x-internal-secret is wrong', () => {
    const context = createMockContext({ 'x-internal-secret': 'wrong_secret' });
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException when x-internal-secret is missing', () => {
    const context = createMockContext({});
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });
});
