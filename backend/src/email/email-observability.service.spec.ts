import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EmailObservabilityService } from './email-observability.service';
import { EmailJob } from './entities/email-job.entity';
import { EmailJobStatus } from './enums/email-job-status.enum';
import { EmailLog } from './entities/email-log.entity';

describe('EmailObservabilityService', () => {
  let service: EmailObservabilityService;

  const mockQueryBuilder = {
    select: vi.fn().mockReturnThis(),
    addSelect: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    getRawMany: vi.fn().mockResolvedValue([
      { status: 'SENT', count: '10' },
      { status: 'FAILED', count: '1' },
      { status: 'PENDING', count: '2' },
    ]),
    getCount: vi.fn().mockResolvedValue(5), // for sentToday
    getOne: vi.fn().mockResolvedValue({
      status: EmailJobStatus.SENT,
      sent_at: new Date('2026-11-18T10:00:00Z'),
      recipient_email: 'test@example.com',
      event_type: 'RM_ISSUED',
    }),
  };

  const mockEmailJobRepo = {
    createQueryBuilder: vi.fn(() => mockQueryBuilder),
    count: vi.fn().mockResolvedValue(5),
  };

  const mockEmailLogRepo = {
    createQueryBuilder: vi.fn(() => mockQueryBuilder),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailObservabilityService,
        {
          provide: getRepositoryToken(EmailJob),
          useValue: mockEmailJobRepo,
        },
        {
          provide: getRepositoryToken(EmailLog),
          useValue: mockEmailLogRepo,
        },
      ],
    }).compile();

    service = module.get<EmailObservabilityService>(EmailObservabilityService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return sentToday count in observability summary', async () => {
    const result = await service.getQueueObservability('Asia/Kolkata');
    expect(result).toBeDefined();
    expect(result.sentToday).toBe(5);
    expect(result.sent).toBe(10);
    expect(result.failed).toBe(1);
    expect(result.pending).toBe(2);
    expect(result.successRate).toBe(91); // Math.round(10 / (10 + 1) * 100) = 91%
    expect(result.sentLast24h).toBe(5);
    expect(result.systemHealth).toBeDefined();
  });
});
