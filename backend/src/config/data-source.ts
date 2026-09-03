import { DataSource } from 'typeorm';
import { Role } from '../roles/entities/role.entity.js';
import { User } from '../users/entities/user.entity.js';
import { Customer } from '../customers/entities/customer.entity.js';
import { PurchaseOrder } from '../po/entities/po.entity.js';
import { SalesOrderComponent } from '../sc/entities/sc.entity.js';
import { RmRequest } from '../rm/entities/rm-request.entity.js';
import { RmItem } from '../rm/entities/rm-item.entity.js';
import { RmFormSc } from '../rm/entities/rm-form-sc.entity.js';
import { SeniorVerificationLog } from '../verification/entities/verification-log.entity.js';
import { MaterialIssue } from '../material-issue/entities/material-issue.entity.js';
import { ProductionReceipt } from '../production/entities/production-receipt.entity.js';
import { MaterialConsumption } from '../production/entities/material-consumption.entity.js';
import { MaterialReturn } from '../production/entities/material-return.entity.js';
import { AdditionalMaterialRequest } from '../additional-request/entities/additional-request.entity.js';
import { Notification } from '../notifications/entities/notification.entity.js';
import { AuditLog } from '../audit/entities/audit-log.entity.js';

export const ALL_ENTITIES = [
  Role,
  User,
  Customer,
  PurchaseOrder,
  SalesOrderComponent,
  RmRequest,
  RmItem,
  RmFormSc,
  SeniorVerificationLog,
  MaterialIssue,
  ProductionReceipt,
  MaterialConsumption,
  MaterialReturn,
  AdditionalMaterialRequest,
  Notification,
  AuditLog,
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
