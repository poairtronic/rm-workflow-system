import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { SystemResetService } from './system-reset.service.js';

describe('SystemResetService', () => {
  let service: SystemResetService;
  let queryMock: any;
  let queryRunnerMock: any;
  let dataSourceMock: any;

  beforeEach(() => {
    queryMock = vi.fn().mockResolvedValue([]);
    queryRunnerMock = {
      connect: vi.fn().mockResolvedValue(undefined),
      startTransaction: vi.fn().mockResolvedValue(undefined),
      commitTransaction: vi.fn().mockResolvedValue(undefined),
      rollbackTransaction: vi.fn().mockResolvedValue(undefined),
      release: vi.fn().mockResolvedValue(undefined),
      query: queryMock,
    };
    dataSourceMock = {
      createQueryRunner: vi.fn().mockReturnValue(queryRunnerMock),
    };

    service = new SystemResetService(dataSourceMock as any);
  });

  it('should reject when confirmation token is not "RESET"', async () => {
    await expect(
      service.resetSystemData(
        { confirmationToken: 'WRONG', po_traceability: true },
        'admin-user',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reject when no modules are selected', async () => {
    await expect(
      service.resetSystemData(
        { confirmationToken: 'RESET' },
        'admin-user',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('should execute transaction and truncate cascaded tables when po_traceability is selected', async () => {
    const res = await service.resetSystemData(
      { confirmationToken: 'RESET', po_traceability: true },
      'admin-user',
    );

    expect(res.success).toBe(true);
    expect(queryRunnerMock.startTransaction).toHaveBeenCalled();
    expect(queryMock).toHaveBeenCalled();
    expect(queryRunnerMock.commitTransaction).toHaveBeenCalled();
    expect(queryRunnerMock.release).toHaveBeenCalled();
    expect(res.purgedTables).toContain('purchase_orders');
    expect(res.purgedTables).toContain('sales_order_components');
  });

  it('should rollback transaction if query fails', async () => {
    queryMock.mockRejectedValueOnce(new Error('DB Error'));

    await expect(
      service.resetSystemData(
        { confirmationToken: 'RESET', stock: true },
        'admin-user',
      ),
    ).rejects.toThrow(BadRequestException);

    expect(queryRunnerMock.rollbackTransaction).toHaveBeenCalled();
    expect(queryRunnerMock.release).toHaveBeenCalled();
  });
});
