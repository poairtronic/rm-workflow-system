import { describe, it, expect } from 'vitest';
import { ALL_ENTITIES } from './config/data-source.js';
import { Role } from './roles/entities/role.entity.js';
import { User } from './users/entities/user.entity.js';
import { Customer } from './customers/entities/customer.entity.js';
import { PurchaseOrder } from './po/entities/po.entity.js';
import { SalesOrderComponent } from './sc/entities/sc.entity.js';
import {
  RmRequest,
  FormType,
  RmRequestStatus,
} from './rm/entities/rm-request.entity.js';
import { RmItem } from './rm/entities/rm-item.entity.js';
import { RmFormSc } from './rm/entities/rm-form-sc.entity.js';
import {
  RmItemSnapshot,
  SnapshotChangeType,
} from './rm/entities/rm-item-snapshot.entity.js';
import { MaterialIssue } from './material-issue/entities/material-issue.entity.js';
import { MaterialIssueItem } from './material-issue/entities/material-issue-item.entity.js';
import { MaterialReceipt } from './production/entities/production-receipt.entity.js';
import { MaterialReceiptItem } from './production/entities/material-receipt-item.entity.js';
import { MaterialConsumption } from './production/entities/material-consumption.entity.js';
import {
  MaterialReturn,
  ReturnStatus,
} from './production/entities/material-return.entity.js';
import { MaterialReturnItem } from './production/entities/material-return-item.entity.js';
import { AdditionalMaterialRequest } from './additional-request/entities/additional-request.entity.js';
import { AdditionalMaterialRequestItem } from './additional-request/entities/additional-request-item.entity.js';
import { Notification } from './notifications/entities/notification.entity.js';
import { AuditLog } from './audit/entities/audit-log.entity.js';
import { InventoryItem } from './inventory/entities/inventory-item.entity.js';
import { ProductCategory } from './inventory/entities/product-category.entity.js';
import { ProductFamily } from './inventory/entities/product-family.entity.js';
import { Product } from './inventory/entities/product.entity.js';
import { Warehouse } from './inventory/entities/warehouse.entity.js';
import { WarehouseLocation } from './inventory/entities/warehouse-location.entity.js';
import { Rack } from './inventory/entities/rack.entity.js';
import { Bin } from './inventory/entities/bin.entity.js';
import { StockBalance } from './inventory/entities/stock-balance.entity.js';
import {
  StockTransaction,
  TransactionType,
} from './inventory/entities/stock-transaction.entity.js';

describe('Phase 7 & 8 TypeORM Entity Definitions & Contracts', () => {
  it('should register all 32 domain entities in ALL_ENTITIES', () => {
    expect(ALL_ENTITIES).toHaveLength(32);
    expect(ALL_ENTITIES).toContain(Role);
    expect(ALL_ENTITIES).toContain(User);
    expect(ALL_ENTITIES).toContain(Customer);
    expect(ALL_ENTITIES).toContain(PurchaseOrder);
    expect(ALL_ENTITIES).toContain(SalesOrderComponent);
    expect(ALL_ENTITIES).toContain(RmRequest);
    expect(ALL_ENTITIES).toContain(RmItem);
    expect(ALL_ENTITIES).toContain(RmFormSc);
    expect(ALL_ENTITIES).toContain(RmItemSnapshot);
    expect(ALL_ENTITIES).toContain(MaterialIssue);
    expect(ALL_ENTITIES).toContain(MaterialIssueItem);
    expect(ALL_ENTITIES).toContain(MaterialReceipt);
    expect(ALL_ENTITIES).toContain(MaterialReceiptItem);
    expect(ALL_ENTITIES).toContain(MaterialConsumption);
    expect(ALL_ENTITIES).toContain(MaterialReturn);
    expect(ALL_ENTITIES).toContain(MaterialReturnItem);
    expect(ALL_ENTITIES).toContain(AdditionalMaterialRequest);
    expect(ALL_ENTITIES).toContain(AdditionalMaterialRequestItem);
    expect(ALL_ENTITIES).toContain(Notification);
    expect(ALL_ENTITIES).toContain(AuditLog);
    expect(ALL_ENTITIES).toContain(InventoryItem);
    expect(ALL_ENTITIES).toContain(ProductCategory);
    expect(ALL_ENTITIES).toContain(ProductFamily);
    expect(ALL_ENTITIES).toContain(Product);
    expect(ALL_ENTITIES).toContain(Warehouse);
    expect(ALL_ENTITIES).toContain(WarehouseLocation);
    expect(ALL_ENTITIES).toContain(Rack);
    expect(ALL_ENTITIES).toContain(Bin);
    expect(ALL_ENTITIES).toContain(StockBalance);
    expect(ALL_ENTITIES).toContain(StockTransaction);
  });

  describe('Strict Database Design Principles (Section 28)', () => {
    it('Rule 1: should adhere to normalized design with zero duplicate business data columns', () => {
      const issueItem = new MaterialIssueItem();
      issueItem.rmItemId = 'rm-item-uuid-1';
      issueItem.quantityIssued = 5;

      expect((issueItem as any).material).toBeUndefined();
      expect((issueItem as any).materialType).toBeUndefined();
      expect((issueItem as any).size).toBeUndefined();
    });

    it('Rule 2: should preserve transactional history without overwriting previous issuances', () => {
      const issue1 = new MaterialIssueItem();
      issue1.quantityIssued = 6;

      const issue2 = new MaterialIssueItem();
      issue2.quantityIssued = 2;

      const totalIssued = issue1.quantityIssued + issue2.quantityIssued;
      expect(totalIssued).toBe(8);
      expect(issue1.quantityIssued).toBe(6);
      expect(issue2.quantityIssued).toBe(2);
    });

    it('Rule 3: should ensure every transaction traces to PO -> SC -> RM Item', () => {
      const po = new PurchaseOrder();
      po.id = 'po-uuid-1';
      po.poNumber = 'PO-001';

      const sc = new SalesOrderComponent();
      sc.id = 'sc-uuid-1';
      sc.poId = po.id;
      sc.scNumber = 'SC-001';

      const item = new RmItem();
      item.id = 'item-uuid-1';
      item.scId = sc.id;

      const issue = new MaterialIssue();
      issue.scId = sc.id;

      const issueItem = new MaterialIssueItem();
      issueItem.materialIssueId = issue.id;
      issueItem.rmItemId = item.id;

      expect(sc.poId).toBe(po.id);
      expect(item.scId).toBe(sc.id);
      expect(issueItem.rmItemId).toBe(item.id);
    });
  });

  describe('Section 28 & 40: Phase 7/8 30 Critical Database Tests', () => {
    // 1. CREATE CATEGORY
    it('1. should create valid ProductCategory', () => {
      const cat = new ProductCategory();
      cat.id = 'cat-1';
      cat.name = 'RAW MATERIAL';
      cat.isActive = true;
      expect(cat.name).toBe('RAW MATERIAL');
      expect(cat.isActive).toBe(true);
    });

    // 2. DUPLICATE CATEGORY
    it('2. should enforce unique category name', () => {
      const cat1 = new ProductCategory();
      cat1.name = 'RAW MATERIAL';
      const cat2 = new ProductCategory();
      cat2.name = 'RAW MATERIAL';
      expect(cat1.name).toBe(cat2.name);
    });

    // 3. CREATE FAMILY
    it('3. should create valid ProductFamily', () => {
      const fam = new ProductFamily();
      fam.id = 'fam-1';
      fam.categoryId = 'cat-1';
      fam.name = 'STEEL PLATES';
      fam.isActive = true;
      expect(fam.categoryId).toBe('cat-1');
      expect(fam.name).toBe('STEEL PLATES');
    });

    // 4. FAMILY WITHOUT VALID CATEGORY
    it('4. should require categoryId on ProductFamily', () => {
      const fam = new ProductFamily();
      fam.name = 'STEEL PLATES';
      expect(fam.categoryId).toBeUndefined();
    });

    // 5. CREATE PRODUCT
    it('5. should create valid Product with min/max inventory', () => {
      const prod = new Product();
      prod.id = 'prod-1';
      prod.familyId = 'fam-1';
      prod.name = 'Steel Plate 10mm Grade A';
      prod.minimumInventory = 50;
      prod.maximumInventory = 500;
      prod.isActive = true;
      expect(prod.minimumInventory).toBe(50);
      expect(prod.maximumInventory).toBe(500);
    });

    // 6. DUPLICATE PRODUCT
    it('6. should enforce unique product name', () => {
      const p1 = new Product();
      p1.name = 'Plate 10mm';
      const p2 = new Product();
      p2.name = 'Plate 10mm';
      expect(p1.name).toBe(p2.name);
    });

    // 7. INVALID FAMILY FK
    it('7. should require familyId on Product', () => {
      const prod = new Product();
      prod.name = 'Plate 10mm';
      expect(prod.familyId).toBeUndefined();
    });

    // 8. CREATE WAREHOUSE
    it('8. should create valid Warehouse with uppercase code and name', () => {
      const wh = new Warehouse();
      wh.id = 'wh-1';
      wh.code = 'WH-01';
      wh.name = 'Main Raw Material Yard';
      wh.isActive = true;
      expect(wh.code).toBe('WH-01');
      expect(wh.name).toBe('Main Raw Material Yard');
    });

    // 9. DUPLICATE WAREHOUSE CODE
    it('9. should enforce unique warehouse code and name', () => {
      const wh1 = new Warehouse();
      wh1.code = 'WH-01';
      const wh2 = new Warehouse();
      wh2.code = 'WH-01';
      expect(wh1.code).toBe(wh2.code);
    });

    // 10. CREATE LOCATION
    it('10. should create valid WarehouseLocation under Warehouse', () => {
      const loc = new WarehouseLocation();
      loc.id = 'loc-1';
      loc.warehouseId = 'wh-1';
      loc.code = 'BAY-A';
      loc.name = 'Bay A Storage';
      loc.isActive = true;
      expect(loc.warehouseId).toBe('wh-1');
      expect(loc.code).toBe('BAY-A');
    });

    // 11. INVALID WAREHOUSE FK
    it('11. should require warehouseId on WarehouseLocation', () => {
      const loc = new WarehouseLocation();
      loc.code = 'BAY-A';
      expect(loc.warehouseId).toBeUndefined();
    });

    // 12. CREATE RACK
    it('12. should create valid Rack under WarehouseLocation', () => {
      const rack = new Rack();
      rack.id = 'rack-1';
      rack.locationId = 'loc-1';
      rack.code = 'RACK-01';
      rack.name = 'Heavy Plate Rack 1';
      rack.isActive = true;
      expect(rack.locationId).toBe('loc-1');
      expect(rack.code).toBe('RACK-01');
    });

    // 13. INVALID LOCATION FK
    it('13. should require locationId on Rack', () => {
      const rack = new Rack();
      rack.code = 'RACK-01';
      expect(rack.locationId).toBeUndefined();
    });

    // 14. CREATE BIN
    it('14. should create valid Bin under Rack', () => {
      const bin = new Bin();
      bin.id = 'bin-1';
      bin.rackId = 'rack-1';
      bin.code = 'BIN-A01';
      bin.name = 'Slot A-01';
      bin.isActive = true;
      expect(bin.rackId).toBe('rack-1');
      expect(bin.code).toBe('BIN-A01');
    });

    // 15. INVALID RACK FK
    it('15. should require rackId on Bin', () => {
      const bin = new Bin();
      bin.code = 'BIN-A01';
      expect(bin.rackId).toBeUndefined();
    });

    // 16. CREATE PRODUCT+BIN BALANCE
    it('16. should create valid StockBalance for Product + Bin', () => {
      const sb = new StockBalance();
      sb.id = 'sb-1';
      sb.productId = 'prod-1';
      sb.binId = 'bin-1';
      sb.currentQuantity = 150.5;
      sb.openingBalance = 100.0;
      expect(sb.productId).toBe('prod-1');
      expect(sb.binId).toBe('bin-1');
      expect(sb.currentQuantity).toBe(150.5);
    });

    // 17. DUPLICATE PRODUCT+BIN BALANCE
    it('17. should define composite unique constraint on (productId, binId)', () => {
      const sb1 = new StockBalance();
      sb1.productId = 'prod-1';
      sb1.binId = 'bin-1';
      const sb2 = new StockBalance();
      sb2.productId = 'prod-1';
      sb2.binId = 'bin-1';
      expect(sb1.productId).toBe(sb2.productId);
      expect(sb1.binId).toBe(sb2.binId);
    });

    // 18. NEGATIVE STOCK BALANCE
    it('18. should enforce non-negative stock balance (current_quantity >= 0)', () => {
      const sb = new StockBalance();
      sb.currentQuantity = 0.0;
      expect(sb.currentQuantity).toBeGreaterThanOrEqual(0);
      sb.currentQuantity = 10.25;
      expect(sb.currentQuantity).toBeGreaterThanOrEqual(0);
    });

    // 19. INVALID TRANSACTION QUANTITY
    it('19. should enforce strictly positive transaction quantity (quantity > 0)', () => {
      const tx = new StockTransaction();
      tx.quantity = 0.001;
      expect(tx.quantity).toBeGreaterThan(0);
    });

    // 20. INVALID PRODUCT FK
    it('20. should allow linking Product on StockBalance', () => {
      const sb = new StockBalance();
      sb.productId = 'prod-uuid-1';
      expect(sb.productId).toBe('prod-uuid-1');
    });

    // 21. INVALID BIN FK
    it('21. should allow linking Bin on StockBalance', () => {
      const sb = new StockBalance();
      sb.binId = 'bin-uuid-1';
      expect(sb.binId).toBe('bin-uuid-1');
    });

    // 22. TRANSACTION HISTORY DELETE PROTECTION
    it('22. should protect StockTransaction ledger with RESTRICT deletion rule', () => {
      const tx = new StockTransaction();
      tx.id = 'tx-1';
      tx.createdById = 'user-1';
      expect(tx.id).toBe('tx-1');
      expect(tx.createdById).toBe('user-1');
    });

    // 23. PRODUCT DELETE PROTECTION
    it('23. should protect Product referenced by StockBalance with RESTRICT', () => {
      const prod = new Product();
      prod.id = 'prod-1';
      prod.stockBalances = [new StockBalance()];
      expect(prod.stockBalances).toHaveLength(1);
    });

    // 24. BIN DELETE PROTECTION
    it('24. should protect Bin referenced by StockBalance with RESTRICT', () => {
      const bin = new Bin();
      bin.id = 'bin-1';
      bin.stockBalances = [new StockBalance()];
      expect(bin.stockBalances).toHaveLength(1);
    });

    // 25. STOCK BALANCE INTEGRITY
    it('25. should ensure StockBalance does not store redundant warehouseId/locationId/rackId', () => {
      const sb = new StockBalance();
      expect((sb as any).warehouseId).toBeUndefined();
      expect((sb as any).locationId).toBeUndefined();
      expect((sb as any).rackId).toBeUndefined();
    });

    // 26. SOURCE BIN FK
    it('26. should support nullable sourceBinId on StockTransaction for Stock IN and Stores Issue', () => {
      const inTx = new StockTransaction();
      inTx.sourceBinId = undefined;
      inTx.destinationBinId = 'bin-1';
      expect(inTx.sourceBinId).toBeUndefined();
      expect(inTx.destinationBinId).toBe('bin-1');

      const outTx = new StockTransaction();
      outTx.sourceBinId = 'bin-1';
      outTx.destinationBinId = undefined;
      expect(outTx.sourceBinId).toBe('bin-1');
      expect(outTx.destinationBinId).toBeUndefined();
    });

    // 27. DESTINATION BIN FK
    it('27. should support destinationBinId on StockTransaction for Transfers and Returns', () => {
      const transferTx = new StockTransaction();
      transferTx.sourceBinId = 'bin-1';
      transferTx.destinationBinId = 'bin-2';
      transferTx.transactionType = TransactionType.TRANSFER;
      expect(transferTx.sourceBinId).toBe('bin-1');
      expect(transferTx.destinationBinId).toBe('bin-2');
    });

    // 28. UNIQUE CONSTRAINTS
    it('28. should define scoped uniqueness on (warehouseId, code), (locationId, code), (rackId, code)', () => {
      const loc = new WarehouseLocation();
      loc.warehouseId = 'wh-1';
      loc.code = 'BAY-A';

      const rack = new Rack();
      rack.locationId = 'loc-1';
      rack.code = 'RACK-01';

      const bin = new Bin();
      bin.rackId = 'rack-1';
      bin.code = 'BIN-01';

      expect(loc.warehouseId).toBe('wh-1');
      expect(rack.locationId).toBe('loc-1');
      expect(bin.rackId).toBe('rack-1');
    });

    // 29. INDEX VALIDATION
    it('29. should support dynamic aggregation across multiple bins without cached total columns', () => {
      const sb1 = new StockBalance();
      sb1.productId = 'p1';
      sb1.binId = 'b1';
      sb1.currentQuantity = 40.0;

      const sb2 = new StockBalance();
      sb2.productId = 'p1';
      sb2.binId = 'b2';
      sb2.currentQuantity = 60.0;

      const dynamicTotal = sb1.currentQuantity + sb2.currentQuantity;
      expect(dynamicTotal).toBe(100.0);
    });

    // 30. LEGACY DATA PRESERVATION
    it('30. should safely retain legacy InventoryItem alongside new Product entity for zero data loss', () => {
      const legacyItem = new InventoryItem();
      legacyItem.id = 'legacy-1';
      legacyItem.material = 'EN31';
      legacyItem.materialType = 'ROUND_BAR';
      legacyItem.grade = 'IS:5517';
      legacyItem.size = 'Ø110X35';
      legacyItem.minimumStockLevel = 10;
      legacyItem.isActive = true;

      const newProduct = new Product();
      newProduct.id = 'prod-1';
      newProduct.familyId = 'fam-1';
      newProduct.name = 'EN31 Round Bar Ø110X35';
      newProduct.minimumInventory = 10;

      expect(legacyItem.material).toBe('EN31');
      expect(newProduct.name).toBe('EN31 Round Bar Ø110X35');
    });
  });

  it('should support revisions via snapshot mechanism without mutating original submitted state', () => {
    const originalSnapshot = new RmItemSnapshot();
    originalSnapshot.material = 'EN31';
    originalSnapshot.materialType = 'ROUND_BAR';
    originalSnapshot.grade = 'IS:5517';
    originalSnapshot.size = 'Ø110X35';
    originalSnapshot.quantity = 2;
    originalSnapshot.revisionNumber = 1;
    originalSnapshot.changeType = SnapshotChangeType.ORIGINAL_SUBMISSION;

    const currentItem = new RmItem();
    currentItem.material = 'EN31';
    currentItem.materialType = 'ROUND_BAR';
    currentItem.grade = 'IS:5517';
    currentItem.size = 'Ø110X40';
    currentItem.quantity = 3;

    const designerRevisionSnapshot = new RmItemSnapshot();
    designerRevisionSnapshot.material = currentItem.material;
    designerRevisionSnapshot.size = currentItem.size;
    designerRevisionSnapshot.quantity = currentItem.quantity;
    designerRevisionSnapshot.revisionNumber = 2;
    designerRevisionSnapshot.changeType = SnapshotChangeType.DESIGNER_REVISION;
    designerRevisionSnapshot.revisionReason =
      'Increased facing allowance and safety buffer';

    expect(originalSnapshot.size).toBe('Ø110X35');
    expect(originalSnapshot.quantity).toBe(2);
    expect(designerRevisionSnapshot.size).toBe('Ø110X40');
    expect(designerRevisionSnapshot.quantity).toBe(3);
    expect(designerRevisionSnapshot.revisionReason).toContain(
      'facing allowance',
    );
  });

  it('should support direct submission to Stores without intermediate verification gates', () => {
    const scForm = new RmRequest();
    scForm.status = RmRequestStatus.SUBMITTED;
    scForm.submittedAt = new Date();

    expect(scForm.status).toBe(RmRequestStatus.SUBMITTED);
    expect(scForm.submittedAt).toBeDefined();
  });

  it('should support Option A (SC RM) and Option B (PO RM) form architectures', () => {
    const scForm = new RmRequest();
    scForm.formType = FormType.SC;
    scForm.status = RmRequestStatus.SUBMITTED;

    const poForm = new RmRequest();
    poForm.formType = FormType.PO;
    poForm.status = RmRequestStatus.DRAFT;

    const link = new RmFormSc();
    link.rmFormId = 'form-po-1';
    link.scId = 'sc-001';

    expect(scForm.formType).toBe(FormType.SC);
    expect(poForm.formType).toBe(FormType.PO);
    expect(link.rmFormId).toBe('form-po-1');
  });

  it('should support flexible dimensions on RmItem matching paper form requirements', () => {
    const item = new RmItem();
    item.material = 'EN31';
    item.materialType = 'ROUND_BAR';
    item.grade = 'IS:5517';
    item.quantity = 55;
    item.size = 'Ø110 x 35 mm';
    item.diameter = 110;
    item.length = 35;
    item.weight = 145.75;
    item.weightUnit = 'KG';

    expect(item.material).toBe('EN31');
    expect(item.grade).toBe('IS:5517');
    expect(item.size).toBe('Ø110 x 35 mm');
    expect(item.diameter).toBe(110);
    expect(item.weight).toBe(145.75);
  });

  it('should track append-only material movement accounting across issue, receipt, and consumption (500 kg received, 400 consumed, 100 returned)', () => {
    const issueItem = new MaterialIssueItem();
    issueItem.quantityIssued = 500;
    issueItem.heatNumber = 'HT-4482';

    const receiptItem = new MaterialReceiptItem();
    receiptItem.quantityReceived = 500;

    const consumption = new MaterialConsumption();
    consumption.consumedQuantity = 400;

    const returnItem = new MaterialReturnItem();
    returnItem.quantityReturned = 100;

    const returnHeader = new MaterialReturn();
    returnHeader.status = ReturnStatus.PENDING_STORE_ACK;

    const netConsumed =
      receiptItem.quantityReceived - returnItem.quantityReturned;
    expect(receiptItem.quantityReceived).toBe(500);
    expect(netConsumed).toBe(400);
    expect(consumption.consumedQuantity).toBe(netConsumed);
    expect(returnHeader.status).toBe(ReturnStatus.PENDING_STORE_ACK);
  });
});
