import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service.js';
import { UserRole } from './enums/role.enum.js';

describe('AuthService', () => {
  let authService: AuthService;
  let jwtService: JwtService;

  beforeEach(async () => {
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
      role: UserRole.DESIGN_USER,
    });

    expect(result.accessToken).toBe('mock-token-for-user-123');
    expect(result.user.role).toBe(UserRole.DESIGN_USER);
  });

  it('should create dev test tokens for roles', () => {
    const result = authService.createDevTestToken(UserRole.SENIOR_MANAGER);
    expect(result.accessToken).toContain('dev-senior_manager-1');
    expect(result.user.role).toBe(UserRole.SENIOR_MANAGER);
  });
});
