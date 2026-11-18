import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EmailWorkerService } from './email-worker.service.js';
import { GmailApiProvider } from './providers/gmail-api.provider.js';
import { TestEmailProvider } from './providers/test-email.provider.js';

describe('Task 3: Dev/Prod Quota Isolation Guard', () => {
  let mockQueueService: any;
  let mockTemplateResolver: any;
  let mockConfigService: any;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    mockQueueService = {
      claimJobs: vi.fn().mockResolvedValue([]),
      getSentCountLast24Hours: vi.fn().mockResolvedValue(0),
    };
    mockTemplateResolver = {};
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('should block worker start in non-production when GmailApiProvider is selected without override', async () => {
    delete process.env.VITEST;
    delete process.env.NODE_ENV;

    mockConfigService = {
      get: vi.fn((key: string) => {
        if (key === 'NODE_ENV') return 'development';
        if (key === 'ALLOW_REAL_EMAIL_IN_DEV') return 'false';
        return undefined;
      }),
    };

    const gmailProvider = new GmailApiProvider();
    const worker = new EmailWorkerService(
      mockQueueService,
      mockTemplateResolver,
      gmailProvider,
      mockConfigService,
    );

    const warnSpy = vi.spyOn((worker as any).logger, 'warn');
    const startSpy = vi.spyOn(worker, 'start');

    await worker.onModuleInit();

    expect(worker.isEnabled).toBe(false);
    expect(startSpy).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[DEV_QUOTA_GUARD] EmailWorkerService startup BLOCKED'),
    );
  });

  it('should allow worker start in production with GmailApiProvider', async () => {
    delete process.env.VITEST;
    process.env.NODE_ENV = 'production';

    mockConfigService = {
      get: vi.fn((key: string) => {
        if (key === 'NODE_ENV') return 'production';
        return undefined;
      }),
    };

    const gmailProvider = new GmailApiProvider();
    const worker = new EmailWorkerService(
      mockQueueService,
      mockTemplateResolver,
      gmailProvider,
      mockConfigService,
    );

    const startSpy = vi.spyOn(worker, 'start').mockImplementation(() => {});

    await worker.onModuleInit();

    expect(worker.isEnabled).toBe(true);
    expect(startSpy).toHaveBeenCalledWith(true);
  });

  it('should allow worker start in non-production when ALLOW_REAL_EMAIL_IN_DEV=true is set and log warning', async () => {
    delete process.env.VITEST;
    delete process.env.NODE_ENV;

    mockConfigService = {
      get: vi.fn((key: string) => {
        if (key === 'NODE_ENV') return 'development';
        if (key === 'ALLOW_REAL_EMAIL_IN_DEV') return 'true';
        return undefined;
      }),
    };

    const gmailProvider = new GmailApiProvider();
    const worker = new EmailWorkerService(
      mockQueueService,
      mockTemplateResolver,
      gmailProvider,
      mockConfigService,
    );

    const warnSpy = vi.spyOn((worker as any).logger, 'warn');
    const startSpy = vi.spyOn(worker, 'start').mockImplementation(() => {});

    await worker.onModuleInit();

    expect(worker.isEnabled).toBe(true);
    expect(startSpy).toHaveBeenCalledWith(true);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[DEV_QUOTA_GUARD] WARNING: ALLOW_REAL_EMAIL_IN_DEV=true is active'),
    );
  });

  it('should always allow worker with TestEmailProvider in development', async () => {
    delete process.env.VITEST;
    delete process.env.NODE_ENV;

    mockConfigService = {
      get: vi.fn((key: string) => {
        if (key === 'NODE_ENV') return 'development';
        return undefined;
      }),
    };

    const testProvider = new TestEmailProvider();
    const worker = new EmailWorkerService(
      mockQueueService,
      mockTemplateResolver,
      testProvider,
      mockConfigService,
    );

    const startSpy = vi.spyOn(worker, 'start').mockImplementation(() => {});

    await worker.onModuleInit();

    expect(worker.isEnabled).toBe(true);
    expect(startSpy).toHaveBeenCalledWith(true);
  });
});
