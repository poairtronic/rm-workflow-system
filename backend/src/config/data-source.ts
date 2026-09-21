import { DataSource } from 'typeorm';
import { Role } from '../roles/entities/role.entity.js';
import { User } from '../users/entities/user.entity.js';
import { Customer } from '../customers/entities/customer.entity.js';
import { PurchaseOrder } from '../po/entities/po.entity.js';
import { SalesOrderComponent } from '../sc/entities/sc.entity.js';
import { RmRequest } from '../rm/entities/rm-request.entity.js';
import { RmItem } from '../rm/entities/rm-item.entity.js';
import { RmFormSc } from '../rm/entities/rm-form-sc.entity.js';
import { RmItemSnapshot } from '../rm/entities/rm-item-snapshot.entity.js';
import { MaterialIssue } from '../material-issue/entities/material-issue.entity.js';
import { MaterialIssueItem } from '../material-issue/entities/material-issue-item.entity.js';
import { MaterialReceipt } from '../production/entities/production-receipt.entity.js';
import { MaterialReceiptItem } from '../production/entities/material-receipt-item.entity.js';
import { MaterialConsumption } from '../production/entities/material-consumption.entity.js';
import { MaterialReturn } from '../production/entities/material-return.entity.js';
import { MaterialReturnItem } from '../production/entities/material-return-item.entity.js';
import { AdditionalMaterialRequest } from '../additional-request/entities/additional-request.entity.js';
import { AdditionalMaterialRequestItem } from '../additional-request/entities/additional-request-item.entity.js';
import { Notification } from '../notifications/entities/notification.entity.js';
import { AuditLog } from '../audit/entities/audit-log.entity.js';
import { InventoryItem } from '../inventory/entities/inventory-item.entity.js';
import { ProductCategory } from '../inventory/entities/product-category.entity.js';
import { ProductFamily } from '../inventory/entities/product-family.entity.js';
import { Product } from '../inventory/entities/product.entity.js';
import { Warehouse } from '../inventory/entities/warehouse.entity.js';
import { WarehouseLocation } from '../inventory/entities/warehouse-location.entity.js';
import { Rack } from '../inventory/entities/rack.entity.js';
import { Bin } from '../inventory/entities/bin.entity.js';
import { StockBalance } from '../inventory/entities/stock-balance.entity.js';
import { StockTransaction } from '../inventory/entities/stock-transaction.entity.js';
import { UploadedFile } from '../files/entities/uploaded-file.entity.js';

export const ALL_ENTITIES = [
  Role,
  User,
  Customer,
  PurchaseOrder,
  SalesOrderComponent,
  RmRequest,
  RmItem,
  RmFormSc,
  RmItemSnapshot,
  MaterialIssue,
  MaterialIssueItem,
  MaterialReceipt,
  MaterialReceiptItem,
  MaterialConsumption,
  MaterialReturn,
  MaterialReturnItem,
  AdditionalMaterialRequest,
  AdditionalMaterialRequestItem,
  Notification,
  AuditLog,
  InventoryItem,
  ProductCategory,
  ProductFamily,
  Product,
  Warehouse,
  WarehouseLocation,
  Rack,
  Bin,
  StockBalance,
  StockTransaction,
  UploadedFile,
];

const dbUrl =
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgres@localhost:5432/rm_workflow_db';
const isSsl =
  dbUrl.includes('sslmode=require') || process.env.NODE_ENV === 'production';

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: dbUrl,
  entities: ALL_ENTITIES,
  migrations: ['database/migrations/*.ts'],
  synchronize: false,
  ssl: isSsl ? { rejectUnauthorized: false } : false,
});
