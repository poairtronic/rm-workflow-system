import { ValidationPipe } from '@nestjs/common';
import { CreateStockInDto } from '../src/inventory/dto/create-stock-in.dto.js';
import { GetTransactionFilterDto } from '../src/inventory/dto/get-transaction-filter.dto.js';

describe('Inventory DTO Validation', () => {
  let target: ValidationPipe;

  beforeEach(() => {
    target = new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    });
  });

  describe('CreateStockInDto', () => {
    it('should reject negative quantities', async () => {
      const dto = {
        quantity: -5,
        referenceType: 'MANUAL',
      };

      await expect(
        target.transform(dto, { type: 'body', metatype: CreateStockInDto }),
      ).rejects.toThrow('Bad Request Exception');
    });

    it('should reject zero quantities', async () => {
      const dto = {
        quantity: 0,
        referenceType: 'MANUAL',
      };

      await expect(
        target.transform(dto, { type: 'body', metatype: CreateStockInDto }),
      ).rejects.toThrow('Bad Request Exception');
    });

    it('should strip non-whitelisted fields like currentQuantity and createdById', async () => {
      const dto = {
        quantity: 10,
        referenceType: 'MANUAL',
        createdById: 'malicious-user',
        currentQuantity: 999,
        transactionType: 'STOCK_OUT',
      };

      await expect(
        target.transform(dto, { type: 'body', metatype: CreateStockInDto }),
      ).rejects.toThrow('Bad Request Exception');
    });

    it('should accept valid decimal quantities', async () => {
      const dto = {
        quantity: 10.125,
        referenceType: 'MANUAL',
      };

      const result = await target.transform(dto, {
        type: 'body',
        metatype: CreateStockInDto,
      });
      expect(result.quantity).toBe(10.125);
    });
  });

  describe('GetTransactionFilterDto', () => {
    it('should set default pagination values', async () => {
      const dto = {};
      const result = await target.transform(dto, {
        type: 'query',
        metatype: GetTransactionFilterDto,
      });
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(10);
    });

    it('should reject invalid page sizes', async () => {
      const dto = { pageSize: '999' }; // max is 100
      await expect(
        target.transform(dto, {
          type: 'query',
          metatype: GetTransactionFilterDto,
        }),
      ).rejects.toThrow('Bad Request Exception');
    });

    it('should parse valid Enums', async () => {
      const dto = { transactionType: 'STOCK_IN' };
      const result = await target.transform(dto, {
        type: 'query',
        metatype: GetTransactionFilterDto,
      });
      expect(result.transactionType).toBe('STOCK_IN');
    });

    it('should reject invalid Enums', async () => {
      const dto = { transactionType: 'INVALID_TYPE' };
      await expect(
        target.transform(dto, {
          type: 'query',
          metatype: GetTransactionFilterDto,
        }),
      ).rejects.toThrow('Bad Request Exception');
    });
  });
});
