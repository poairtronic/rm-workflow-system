import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { vi } from 'vitest';
import { GeneralIssueService } from './general-issue.service.js';
import { GeneralIssue, GeneralIssueStatus } from './entities/general-issue.entity.js';
import { GeneralIssueItem } from './entities/general-issue-item.entity.js';
import { DataSource } from 'typeorm';

describe('GeneralIssueService', () => {
  let service: GeneralIssueService;
  let mockIssueRepo: any;
  let mockItemRepo: any;
  let mockDataSource: any;

  beforeEach(async () => {
    mockIssueRepo = {
      create: vi.fn(),
      save: vi.fn(),
      find: vi.fn(),
      findOne: vi.fn(),
    };

    mockItemRepo = {
      create: vi.fn(),
      save: vi.fn(),
    };

    mockDataSource = {
      createQueryRunner: vi.fn().mockReturnValue({
        connect: vi.fn(),
        startTransaction: vi.fn(),
        commitTransaction: vi.fn(),
        rollbackTransaction: vi.fn(),
        release: vi.fn(),
        manager: {
          findOne: vi.fn(),
          query: vi.fn(),
          create: vi.fn(),
          save: vi.fn(),
        },
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GeneralIssueService,
        {
          provide: getRepositoryToken(GeneralIssue),
          useValue: mockIssueRepo,
        },
        {
          provide: getRepositoryToken(GeneralIssueItem),
          useValue: mockItemRepo,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<GeneralIssueService>(GeneralIssueService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createIssue', () => {
    it('should throw error if items are empty', async () => {
      await expect(service.createIssue({ reason: 'test', items: [] }, 'user1')).rejects.toThrow('General issue must contain at least one item.');
    });
  });
});
