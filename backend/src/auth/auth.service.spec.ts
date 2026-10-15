import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UnauthorizedException } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { AuthService } from './auth.service.js';
import { UserRole } from './enums/role.enum.js';
import { User } from '../users/entities/user.entity.js';
import { RefreshToken } from './entities/refresh-token.entity.js';

describe('AuthService', () => {
  let authService: AuthService;
  let jwtService: JwtService;

  const mockUserRepo = {
    findOne: vi.fn(),
  };

  const mockRefreshTokenRepo = {
    create: vi.fn((dto) => ({ id: 'mock-token-uuid', ...dto })),
    save: vi.fn((entity) => Promise.resolve({ id: 'mock-token-uuid', ...entity })),
    findOne: vi.fn(),
    update: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: JwtService,
          useValue: {
            sign: (payload: any) => `mock-token-for-${payload.sub}`,
            verify: (_token: string) => ({
              sub: 'dev-1',
              email: 'test@example.com',
            }),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepo,
        },
        {
          provide: getRepositoryToken(RefreshToken),
          useValue: mockRefreshTokenRepo,
        },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    jwtService = module.get<JwtService>(JwtService);
  });

  it('should be defined', () => {
    expect(authService).toBeDefined();
    expect(jwtService).toBeDefined();
  });

  it('should sign a token for a given user', () => {
    const result = authService.signToken({
      userId: 'user-123',
      email: 'designer@example.com',
      role: UserRole.DESIGNER,
    });

    expect(result.accessToken).toBe('mock-token-for-user-123');
    expect(result.user.role).toBe(UserRole.DESIGNER);
  });

  it('should validate credentials and login successfully returning accessToken and refreshToken', async () => {
    const passwordHash = await bcrypt.hash('Secret@123', 10);
    mockUserRepo.findOne.mockResolvedValue({
      id: 'user-1',
      name: 'Rajesh Designer',
      email: 'designer@airtronic.com',
      passwordHash,
      isActive: true,
      role: { name: 'DESIGNER' },
      department: 'Design',
    });

    const result = await authService.login({
      email: 'designer@airtronic.com',
      password: 'Secret@123',
    });

    expect(result.accessToken).toBe('mock-token-for-user-1');
    expect(result.refreshToken).toBeDefined();
    expect(typeof result.refreshToken).toBe('string');
    expect(result.refreshToken.length).toBe(64); // 32 bytes hex
    expect(result.user.email).toBe('designer@airtronic.com');
    expect(result.user.role).toBe('DESIGNER');
    expect(mockRefreshTokenRepo.create).toHaveBeenCalled();
    expect(mockRefreshTokenRepo.save).toHaveBeenCalled();
  });

  it('should throw UnauthorizedException on invalid password', async () => {
    const passwordHash = await bcrypt.hash('Secret@123', 10);
    mockUserRepo.findOne.mockResolvedValue({
      id: 'user-1',
      email: 'designer@airtronic.com',
      passwordHash,
      isActive: true,
      role: { name: 'DESIGNER' },
    });

    await expect(
      authService.login({
        email: 'designer@airtronic.com',
        password: 'WrongPassword',
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException for inactive accounts', async () => {
    const passwordHash = await bcrypt.hash('Secret@123', 10);
    mockUserRepo.findOne.mockResolvedValue({
      id: 'user-1',
      email: 'inactive@airtronic.com',
      passwordHash,
      isActive: false,
      role: { name: 'DESIGNER' },
    });

    await expect(
      authService.login({
        email: 'inactive@airtronic.com',
        password: 'Secret@123',
      }),
    ).rejects.toThrow('User account is inactive');
  });

  it('should rotate a valid refresh token successfully', async () => {
    const rawToken = 'a'.repeat(64);
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    mockRefreshTokenRepo.findOne.mockResolvedValue({
      id: 'token-1',
      userId: 'user-1',
      tokenHash,
      expiresAt: new Date(Date.now() + 1000000),
      isRevoked: false,
      user: {
        id: 'user-1',
        name: 'Active User',
        email: 'active@airtronic.com',
        isActive: true,
        role: { name: 'STORES' },
      },
    });

    const result = await authService.rotateRefreshToken(rawToken);

    expect(result.accessToken).toBe('mock-token-for-user-1');
    expect(result.refreshToken).toBeDefined();
    expect(result.refreshToken).not.toBe(rawToken);
    expect(result.user.role).toBe('STORES');
  });

  it('should reject rotation and invalidate sessions if revoked token is reused (Compromise Detection)', async () => {
    const rawToken = 'b'.repeat(64);
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    mockRefreshTokenRepo.findOne.mockResolvedValue({
      id: 'token-revoked',
      userId: 'user-1',
      tokenHash,
      expiresAt: new Date(Date.now() + 1000000),
      isRevoked: true,
      user: { id: 'user-1', isActive: true },
    });

    await expect(
      authService.rotateRefreshToken(rawToken),
    ).rejects.toThrow('Revoked refresh token reused');

    expect(mockRefreshTokenRepo.update).toHaveBeenCalledWith(
      { userId: 'user-1' },
      { isRevoked: true },
    );
  });

  it('should reject rotation if refresh token is expired', async () => {
    const rawToken = 'c'.repeat(64);
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    mockRefreshTokenRepo.findOne.mockResolvedValue({
      id: 'token-expired',
      userId: 'user-1',
      tokenHash,
      expiresAt: new Date(Date.now() - 1000),
      isRevoked: false,
      user: { id: 'user-1', isActive: true },
    });

    await expect(
      authService.rotateRefreshToken(rawToken),
    ).rejects.toThrow('Refresh token expired');
  });

  it('should revoke a refresh token on logout', async () => {
    const rawToken = 'd'.repeat(64);
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const tokenRecord = {
      id: 'token-logout',
      tokenHash,
      isRevoked: false,
    };
    mockRefreshTokenRepo.findOne.mockResolvedValue(tokenRecord);

    const revoked = await authService.revokeRefreshToken(rawToken);
    expect(revoked).toBe(true);
    expect(tokenRecord.isRevoked).toBe(true);
    expect(mockRefreshTokenRepo.save).toHaveBeenCalledWith(tokenRecord);
  });

  it('should create dev test tokens for roles', () => {
    const result = authService.createDevTestToken(UserRole.SENIOR_MANAGER);
    expect(result.accessToken).toContain(
      '00000000-0000-0000-0000-000000000005',
    );
    expect(result.user.role).toBe(UserRole.SENIOR_MANAGER);
  });
});
