import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EmailWorkerService } from './email-worker.service.js';
import { EmailQueueService } from './email-queue.service.js';
import { TestEmailProvider } from './providers/test-email.provider.js';

describe('EmailWorkerService & EmailQueueService - Wakeup & Idle Cap Tests', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('idleMaxIntervalMs should default to 60000 when EMAIL_WORKER_IDLE_MAX_MS is unset', () => {
    delete process.env.EMAIL_WORKER_IDLE_MAX_MS;
    const worker = new EmailWorkerService(
      {} as any,
      {} as any,
      new TestEmailProvider(),
      undefined,
    );
    expect((worker as any).idleMaxIntervalMs).toBe(60000);
  });

  it('idleMaxIntervalMs should respect EMAIL_WORKER_IDLE_MAX_MS from env', () => {
    process.env.EMAIL_WORKER_IDLE_MAX_MS = '900000';
    const worker = new EmailWorkerService(
      {} as any,
      {} as any,
      new TestEmailProvider(),
      undefined,
    );
    expect((worker as any).idleMaxIntervalMs).toBe(900000);
  });

  it('enqueueJob should trigger wake callback after successful save', async () => {
    const mockRepo: any = {
      create: vi.fn((data) => ({ ...data, id: 'job-123' })),
      findOne: vi.fn().mockResolvedValue(null),
      save: vi.fn().mockResolvedValue({ id: 'job-123', status: 'PENDING' }),
    };
    const mockIdempotency: any = {
      generateKey: vi.fn().mockReturnValue('key-123'),
    };
    const mockResolver: any = {
      resolveContent: vi.fn().mockReturnValue({ bodyText: 'txt', bodyHtml: '<p>txt</p>' }),
    };

    const queueService = new EmailQueueService(
      mockRepo,
      {} as any,
      mockIdempotency,
    );

    const wakeCb = vi.fn();
    queueService.registerWakeCallback(wakeCb);

    const result = await queueService.enqueueJob({
      recipientEmail: 'test@example.com',
      eventType: 'MATERIAL_ISSUED' as any,
      subject: 'Test Subject',
    });

    expect(result.id).toBe('job-123');
    expect(wakeCb).toHaveBeenCalledTimes(1);
  });

  it('enqueueJob should NOT trigger wake callback on idempotency cache hit', async () => {
    const existingJob = { id: 'existing-job', status: 'PENDING', idempotencyKey: 'dup-key' };
    const mockRepo: any = {
      create: vi.fn(),
      findOne: vi.fn().mockResolvedValue(existingJob),
      save: vi.fn(),
    };
    const mockIdempotency: any = {
      generateKey: vi.fn().mockReturnValue('dup-key'),
    };

    const queueService = new EmailQueueService(
      mockRepo,
      mockIdempotency,
      {} as any,
    );

    const wakeCb = vi.fn();
    queueService.registerWakeCallback(wakeCb);

    const result = await queueService.enqueueJob({
      recipientEmail: 'test@example.com',
      eventType: 'MATERIAL_ISSUED' as any,
      idempotencyKey: 'dup-key',
    });

    expect(result.id).toBe('existing-job');
    expect(wakeCb).not.toHaveBeenCalled();
    expect(mockRepo.save).not.toHaveBeenCalled();
  });

  it('enqueueJob should not fail if wakeWorker throws an unexpected error', async () => {
    const mockRepo: any = {
      create: vi.fn((data) => ({ ...data, id: 'job-456' })),
      findOne: vi.fn().mockResolvedValue(null),
      save: vi.fn().mockResolvedValue({ id: 'job-456', status: 'PENDING' }),
    };
    const mockIdempotency: any = {
      generateKey: vi.fn().mockReturnValue('key-456'),
    };
    const mockResolver: any = {
      resolveContent: vi.fn().mockReturnValue({ bodyText: 't', bodyHtml: 'h' }),
    };

    const queueService = new EmailQueueService(
      mockRepo,
      {} as any,
      mockIdempotency,
    );

    queueService.registerWakeCallback(() => {
      throw new Error('Callback boom!');
    });

    const result = await queueService.enqueueJob({
      recipientEmail: 'test@example.com',
      eventType: 'MATERIAL_ISSUED' as any,
      subject: 'Test Error Catch',
    });

    expect(result.id).toBe('job-456');
  });

  it('wakeImmediately should reset currentPollIntervalMs and schedule tick if running and not polling', () => {
    const worker = new EmailWorkerService(
      {} as any,
      {} as any,
      new TestEmailProvider(),
      undefined,
    );

    const scheduleSpy = vi.spyOn(worker as any, 'scheduleNextTick').mockImplementation(() => {});

    // When worker is not running:
    worker.wakeImmediately();
    expect(scheduleSpy).not.toHaveBeenCalled();

    // When worker is running and not polling:
    (worker as any).isRunning = true;
    (worker as any).isPolling = false;
    (worker as any).currentPollIntervalMs = 60000;
    worker.pollIntervalMs = 5000;

    worker.wakeImmediately();
    expect((worker as any).currentPollIntervalMs).toBe(5000);
    expect(scheduleSpy).toHaveBeenCalledWith(0);

    // When worker is running and already polling:
    scheduleSpy.mockClear();
    (worker as any).isPolling = true;
    (worker as any).currentPollIntervalMs = 30000;

    worker.wakeImmediately();
    expect((worker as any).currentPollIntervalMs).toBe(5000);
    expect(scheduleSpy).not.toHaveBeenCalled(); // finally block in pollTick handles rescheduling
  });
});
