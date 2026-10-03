import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { validateSync } from 'class-validator';
import { DataSource, QueryFailedError } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { DeliveryChallan, DeliveryChallanType, DeliveryChallanStatus } from '../src/delivery-challan/entities/delivery-challan.entity.js';
import { DeliveryChallanItem } from '../src/delivery-challan/entities/delivery-challan-item.entity.js';
import { CreateDeliveryChallanDto } from '../src/delivery-challan/dto/create-delivery-challan.dto.js';
import { DeliveryChallanItemDto } from '../src/delivery-challan/dto/delivery-challan-item.dto.js';

describe('Phase 19.1 — Delivery Challan Domain Model & Database Schema', () => {
  let moduleFixture: TestingModule;
  let dataSource: DataSource;

  beforeAll(async () => {
    moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    dataSource = moduleFixture.get<DataSource>(DataSource);
  });

  afterAll(async () => {
    if (moduleFixture) {
      await moduleFixture.close();
    }
  });

  describe('DTO Validation Rules', () => {
    it('E2E-DC-001: Should validate mandatory fields for CreateDeliveryChallanDto', () => {
      const dto = new CreateDeliveryChallanDto();
      const errors = validateSync(dto);
      
      expect(errors.length).toBeGreaterThan(0);
      const propertyErrors = errors.map(e => e.property);
      expect(propertyErrors).toContain('type');
      expect(propertyErrors).toContain('vendorId');
      expect(propertyErrors).toContain('dispatchDate');
      expect(propertyErrors).toContain('expectedReturnDate');
      expect(propertyErrors).toContain('items');
    });

    it('E2E-DC-002: Should require scId and processId for PRODUCTION_PROCESS_OUTWARD type', () => {
      const dto = new CreateDeliveryChallanDto();
      dto.type = DeliveryChallanType.PRODUCTION_PROCESS_OUTWARD;
      dto.vendorId = 'b0b43528-91df-4f0e-bcae-ec3298c47b19';
      dto.dispatchDate = new Date().toISOString();
      dto.expectedReturnDate = new Date().toISOString();
      
      const item = new DeliveryChallanItemDto();
      item.productId = 'b0b43528-91df-4f0e-bcae-ec3298c47b19';
      item.binId = 'b0b43528-91df-4f0e-bcae-ec3298c47b19';
      item.quantityDispatched = 10.5;
      
      dto.items = [item];

      const errors = validateSync(dto);
      const propertyErrors = errors.map(e => e.property);
      
      // scId and processId must be present because type is PRODUCTION_PROCESS_OUTWARD
      expect(propertyErrors).toContain('scId');
      expect(propertyErrors).toContain('processId');
    });

    it('E2E-DC-003: Should NOT require scId and processId for GENERAL_INVENTORY_OUTWARD type', () => {
      const dto = new CreateDeliveryChallanDto();
      dto.type = DeliveryChallanType.GENERAL_INVENTORY_OUTWARD;
      dto.vendorId = 'b0b43528-91df-4f0e-bcae-ec3298c47b19';
      dto.dispatchDate = new Date().toISOString();
      dto.expectedReturnDate = new Date().toISOString();
      
      const item = new DeliveryChallanItemDto();
      item.productId = 'b0b43528-91df-4f0e-bcae-ec3298c47b19';
      item.binId = 'b0b43528-91df-4f0e-bcae-ec3298c47b19';
      item.quantityDispatched = 10.5;
      
      dto.items = [item];

      const errors = validateSync(dto);
      const propertyErrors = errors.map(e => e.property);
      
      // scId and processId are optional for GENERAL_INVENTORY_OUTWARD
      expect(propertyErrors).not.toContain('scId');
      expect(propertyErrors).not.toContain('processId');
    });

    it('E2E-DC-004: Should validate positive quantities in DeliveryChallanItemDto', () => {
      const item = new DeliveryChallanItemDto();
      item.productId = 'b0b43528-91df-4f0e-bcae-ec3298c47b19';
      item.binId = 'b0b43528-91df-4f0e-bcae-ec3298c47b19';
      item.quantityDispatched = -5; // Invalid

      const errors = validateSync(item);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('quantityDispatched');
      expect(errors[0].constraints).toHaveProperty('min');
    });
  });

  describe('Database Schema and Relations', () => {
    it('E2E-DC-005: Should reject saving DeliveryChallan with missing required foreign keys (vendor)', async () => {
      const repo = dataSource.getRepository(DeliveryChallan);
      
      const dc = repo.create({
        challanNumber: 'DC-TEST-001',
        type: DeliveryChallanType.GENERAL_INVENTORY_OUTWARD,
        // vendorId is missing
        dispatchDate: new Date(),
        expectedReturnDate: new Date(),
        status: DeliveryChallanStatus.OPEN,
      });

      await expect(repo.save(dc)).rejects.toThrow(QueryFailedError);
    });

    it('E2E-DC-006: Should enforce unique constraint on challanNumber', async () => {
      const vendorRepo = dataSource.getRepository('Vendor');
      const dcRepo = dataSource.getRepository(DeliveryChallan);

      // Create a dummy vendor to satisfy foreign key
      const vendor = vendorRepo.create({
        code: 'VND-DC-TEST',
        name: 'Test Vendor DC',
        isActive: true,
      });
      const savedVendor = await vendorRepo.save(vendor);

      const dc1 = dcRepo.create({
        challanNumber: 'DC-UNIQUE-001',
        type: DeliveryChallanType.GENERAL_INVENTORY_OUTWARD,
        vendorId: savedVendor.id,
        dispatchDate: new Date(),
        expectedReturnDate: new Date(),
        status: DeliveryChallanStatus.OPEN,
      });

      await dcRepo.save(dc1);

      const dc2 = dcRepo.create({
        challanNumber: 'DC-UNIQUE-001', // Duplicate
        type: DeliveryChallanType.GENERAL_INVENTORY_OUTWARD,
        vendorId: savedVendor.id,
        dispatchDate: new Date(),
        expectedReturnDate: new Date(),
        status: DeliveryChallanStatus.OPEN,
      });

      await expect(dcRepo.save(dc2)).rejects.toThrow(QueryFailedError);

      // Cleanup
      await dcRepo.delete(dc1.id);
      await vendorRepo.delete(savedVendor.id);
    });
  });
});
