import { describe, it, expect } from 'vitest';
import { ALL_ENTITIES } from '../config/data-source.js';
import {
  ConsumableRequest,
  ConsumablePaymentMode,
} from './entities/consumable-request.entity.js';
import {
  ConsumableRequestItem,
  ConsumableItemTrack,
  ConsumableItemStatus,
} from './entities/consumable-request-item.entity.js';

describe('Phase 24.1: Consumables Database Schema & Entity Relational Contracts', () => {
  it('should register ConsumableRequest and ConsumableRequestItem in ALL_ENTITIES', () => {
    expect(ALL_ENTITIES).toContain(ConsumableRequest);
    expect(ALL_ENTITIES).toContain(ConsumableRequestItem);
  });

  describe('ConsumableRequest Entity', () => {
    it('should instantiate correctly with required header fields', () => {
      const request = new ConsumableRequest();
      request.id = 'cr-uuid-1';
      request.requestCode = 'CR-2026-0001';
      request.paymentMode = ConsumablePaymentMode.CASH;
      request.endUserInVelan = 'Machine Bay 4 / CNC-02';
      request.requestedBy = 'Rajesh Kumar (EMP-104)';
      request.preparedBy = 'Rajesh Kumar';
      request.verifiedBy = 'Suresh Nair';
      request.approvedBy = 'Vikram Patel';
      request.remarks = 'Urgent tool insert request for batch B-402';

      expect(request.requestCode).toBe('CR-2026-0001');
      expect(request.paymentMode).toBe(ConsumablePaymentMode.CASH);
      expect(request.endUserInVelan).toBe('Machine Bay 4 / CNC-02');
      expect(request.requestedBy).toBe('Rajesh Kumar (EMP-104)');
      expect(request.preparedBy).toBe('Rajesh Kumar');
      expect(request.verifiedBy).toBe('Suresh Nair');
      expect(request.approvedBy).toBe('Vikram Patel');
    });

    it('should support CREDIT payment mode', () => {
      const request = new ConsumableRequest();
      request.paymentMode = ConsumablePaymentMode.CREDIT;
      expect(request.paymentMode).toBe(ConsumablePaymentMode.CREDIT);
    });
  });

  describe('ConsumableRequestItem Entity', () => {
    it('should instantiate an In-Stock line item correctly (Track A)', () => {
      const item = new ConsumableRequestItem();
      item.id = 'item-uuid-1';
      item.requestId = 'cr-uuid-1';
      item.productId = 'prod-uuid-1';
      item.productCode = 'CONS-OIL-01';
      item.description = 'Cutting Oil ISO VG 68';
      item.uom = 'LTR';
      item.isNewProduct = false;
      item.itemCategoryTrack = ConsumableItemTrack.STOCK_ITEM;
      item.stockAvailableAtRequest = 25;
      item.requestedQty = 5;
      item.status = ConsumableItemStatus.READY_FOR_ISSUE;

      expect(item.itemCategoryTrack).toBe(ConsumableItemTrack.STOCK_ITEM);
      expect(item.status).toBe(ConsumableItemStatus.READY_FOR_ISSUE);
      expect(item.stockAvailableAtRequest).toBe(25);
      expect(item.requestedQty).toBe(5);
      expect(item.isNewProduct).toBe(false);
    });

    it('should instantiate a Non-Stock / New Product line item with vendor context (Track B)', () => {
      const item = new ConsumableRequestItem();
      item.id = 'item-uuid-2';
      item.requestId = 'cr-uuid-1';
      item.productId = 'prod-uuid-new-1';
      item.productCode = 'CONS-TOOL-CNMG';
      item.description = 'CNMG 120408 Carbide Insert';
      item.uom = 'NOS';
      item.isNewProduct = true;
      item.itemCategoryTrack = ConsumableItemTrack.NON_STOCK_OR_NEW;
      item.stockAvailableAtRequest = 0;
      item.requestedQty = 20;
      item.status = ConsumableItemStatus.OPEN;

      // Vendor details
      item.isNewVendor = true;
      item.newVendorName = 'Sri Lakshmi Tooling Works';
      item.newVendorAddress = '42 Industrial Estate, Phase 2, Coimbatore';
      item.newVendorMobile = '+91 9876543210';
      item.newVendorPrice = 450.00;

      expect(item.itemCategoryTrack).toBe(ConsumableItemTrack.NON_STOCK_OR_NEW);
      expect(item.status).toBe(ConsumableItemStatus.OPEN);
      expect(item.isNewProduct).toBe(true);
      expect(item.isNewVendor).toBe(true);
      expect(item.newVendorName).toBe('Sri Lakshmi Tooling Works');
      expect(item.newVendorPrice).toBe(450.00);
    });

    it('should validate full state machine progression values', () => {
      const item = new ConsumableRequestItem();

      item.status = ConsumableItemStatus.OPEN;
      expect(item.status).toBe('OPEN');

      item.status = ConsumableItemStatus.PURCHASE_REQUESTED;
      item.prNumber = '151';
      item.printedAt = new Date();
      expect(item.status).toBe('PURCHASE_REQUESTED');
      expect(item.prNumber).toBe('151');
      expect(item.printedAt).toBeInstanceOf(Date);

      item.status = ConsumableItemStatus.PURCHASE_RECEIVED;
      item.realReceivedQty = 20;
      item.binId = 'bin-uuid-a1';
      item.purchaseReceivedAt = new Date();
      expect(item.status).toBe('PURCHASE_RECEIVED');
      expect(item.realReceivedQty).toBe(20);

      item.status = ConsumableItemStatus.ISSUED_TO_PRODUCTION;
      item.issuedQty = 20;
      item.issuedAt = new Date();
      expect(item.status).toBe('ISSUED_TO_PRODUCTION');
      expect(item.issuedQty).toBe(20);

      item.status = ConsumableItemStatus.RECEIVED_BY_PRODUCTION;
      item.productionReceivedAt = new Date();
      item.productionReceivedById = 'user-emp-104';
      expect(item.status).toBe('RECEIVED_BY_PRODUCTION');
      expect(item.productionReceivedById).toBe('user-emp-104');
    });
  });
});
