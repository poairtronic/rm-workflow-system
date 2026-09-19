import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UnauthorizedException } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { AuthService } from './auth.service.js';
import { UserRole } from './enums/role.enum.js';
import { User } from '../users/entities/user.entity.js';

describe('AuthService', () => {
  let authService: AuthService;
  let jwtService: JwtService;

  const mockUserRepo = {
    findOne: vi.fn(),
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

  it('should validate credentials and login successfully for active user with valid password', async () => {
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
    expect(result.user.email).toBe('designer@airtronic.com');
    expect(result.user.role).toBe('DESIGNER');
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

  it('should create dev test tokens for roles', () => {
    const result = authService.createDevTestToken(UserRole.SENIOR_MANAGER);
    expect(result.accessToken).toContain('00000000-0000-0000-0000-000000000005');
    expect(result.user.role).toBe(UserRole.SENIOR_MANAGER);
  });
});

