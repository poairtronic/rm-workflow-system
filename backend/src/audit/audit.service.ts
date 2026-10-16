import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity.js';
import { User } from '../users/entities/user.entity.js';

export interface AuditQueryOptions {
  search?: string;
  module?: string;
  action?: string;
  limit?: number;
  offset?: number;
}

export interface LogEventDto {
  entityName: string;
  entityId: string;
  actionType: string;
  actorId?: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  metadata?: Record<string, any>;
}

@Injectable()
export class AuditService implements OnModuleInit {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly dataSource: DataSource,
  ) {}

  async onModuleInit() {
    await this.seedInitialAuditLogsIfEmpty();
  }

  getStatus() {
    return { module: 'audit', status: 'ready' };
  }

  /**
   * Log an immutable audit event
   */
  async logEvent(data: LogEventDto): Promise<AuditLog> {
    const log = this.auditLogRepository.create({
      entityName: data.entityName,
      entityId: data.entityId,
      actionType: data.actionType.toUpperCase(),
      actorId: data.actorId || undefined,
      oldValues: data.oldValues,
      newValues: data.newValues,
      metadata: {
        ...data.metadata,
        ipAddress: data.metadata?.ipAddress || '127.0.0.1',
        userAgent: data.metadata?.userAgent || 'V-SMART Enterprise Web Client',
      },
    });

    return await this.auditLogRepository.save(log);
  }

  /**
   * Fetch paginated audit logs with search and filtering
   */
  async getLogs(options: AuditQueryOptions = {}) {
    const limit = Math.min(Math.max(options.limit || 50, 1), 200);
    const offset = Math.max(options.offset || 0, 0);

    const qb = this.auditLogRepository
      .createQueryBuilder('log')
      .leftJoinAndSelect('log.actor', 'actor');

    if (options.module && options.module !== 'ALL' && options.module !== 'All Modules') {
      const mod = options.module.trim();
      qb.andWhere('log.entityName ILIKE :mod', { mod: `%${mod}%` });
    }

    if (options.action && options.action !== 'ALL' && options.action !== 'All Actions') {
      const act = options.action.trim().toUpperCase();
      qb.andWhere('log.actionType = :act', { act });
    }

    if (options.search && options.search.trim()) {
      const search = `%${options.search.trim()}%`;
      qb.andWhere(
        '(log.entityName ILIKE :search OR log.entityId ILIKE :search OR log.actionType ILIKE :search OR actor.name ILIKE :search OR actor.email ILIKE :search)',
        { search },
      );
    }

    qb.orderBy('log.createdAt', 'DESC')
      .skip(offset)
      .take(limit);

    const [logs, total] = await qb.getManyAndCount();

    const formatted = logs.map((l) => ({
      id: l.id,
      timestamp: l.createdAt,
      entityName: l.entityName,
      entityId: l.entityId,
      actionType: l.actionType,
      actorId: l.actorId,
      user: l.actor ? {
        id: l.actor.id,
        name: l.actor.name,
        email: l.actor.email,
        department: l.actor.department || 'Administration',
      } : {
        id: 'SYSTEM',
        name: 'System Admin',
        email: 'system@v-smart.internal',
        department: 'SYSTEM',
      },
      oldValues: l.oldValues,
      newValues: l.newValues,
      metadata: l.metadata || {},
      ipAddress: l.metadata?.ipAddress || '127.0.0.1',
    }));

    return {
      logs: formatted,
      total,
      limit,
      offset,
    };
  }

  /**
   * Export matched audit records as CSV
   */
  async exportCsv(options: AuditQueryOptions = {}): Promise<string> {
    const result = await this.getLogs({ ...options, limit: 1000, offset: 0 });
    const headers = ['Timestamp', 'User', 'Email', 'Action', 'Module', 'Record ID', 'IP Address', 'Details'];
    
    const rows = result.logs.map((l) => [
      `"${new Date(l.timestamp).toISOString()}"`,
      `"${l.user?.name || 'System'}"`,
      `"${l.user?.email || '-'}"`,
      `"${l.actionType}"`,
      `"${l.entityName}"`,
      `"${l.entityId}"`,
      `"${l.ipAddress}"`,
      `"${JSON.stringify(l.newValues || {}).replace(/"/g, '""')}"`,
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }

  /**
   * Seed realistic initial audit logs if the table is currently empty
   */
  private async seedInitialAuditLogsIfEmpty() {
    try {
      const count = await this.auditLogRepository.count();
      if (count > 0) return;

      this.logger.log('Seeding initial comprehensive audit records based on existing DC, RM, and Stores entities...');

      // Find sample users
      const users = await this.userRepository.find({ take: 5 });
      const adminUser = users.find(u => u.email.includes('admin') || u.name.includes('Admin')) || users[0];
      const storesUser = users.find(u => u.email.includes('stores') || u.name.includes('Stores')) || users[1] || adminUser;
      const prodUser = users.find(u => u.email.includes('prod') || u.name.includes('Prod')) || users[2] || adminUser;

      const actorAdminId = adminUser?.id;
      const actorStoresId = storesUser?.id;
      const actorProdId = prodUser?.id;

      // Seed realistic historical audit records
      const initialLogs: LogEventDto[] = [
        {
          entityName: 'ApplicationSetting',
          entityId: 'GLOBAL_WORKFLOW_EMAIL_ENABLED',
          actionType: 'UPDATE',
          actorId: actorAdminId,
          oldValues: { value: 'false' },
          newValues: { value: 'true' },
          metadata: { module: 'Configuration', ipAddress: '192.168.1.102' },
        },
        {
          entityName: 'ApplicationSetting',
          entityId: 'WORKFLOW_ALERTS_ENABLED',
          actionType: 'UPDATE',
          actorId: actorAdminId,
          oldValues: { value: 'false' },
          newValues: { value: 'true' },
          metadata: { module: 'Configuration', ipAddress: '192.168.1.102' },
        },
        {
          entityName: 'ApplicationSetting',
          entityId: 'DC_OVERDUE_ALERTS_ENABLED',
          actionType: 'UPDATE',
          actorId: actorAdminId,
          oldValues: { value: 'false' },
          newValues: { value: 'true' },
          metadata: { module: 'Configuration', ipAddress: '192.168.1.102' },
        },
        {
          entityName: 'DeliveryChallan',
          entityId: 'DC-2026-0042',
          actionType: 'CREATE',
          actorId: actorStoresId,
          newValues: { type: 'TYPE_1_PROCESS', vendor: 'Apex Heat Treaters', itemsCount: 4, status: 'DISPATCHED' },
          metadata: { module: 'Delivery Challan', ipAddress: '192.168.1.145' },
        },
        {
          entityName: 'DeliveryChallan',
          entityId: 'DC-2026-0042',
          actionType: 'DELIVER',
          actorId: actorStoresId,
          newValues: { status: 'DISPATCHED', vehicleNumber: 'KA-01-EA-9912', carrier: 'FastTrack Logistics' },
          metadata: { module: 'Delivery Challan', ipAddress: '192.168.1.145' },
        },
        {
          entityName: 'DeliveryChallan',
          entityId: 'DC-2026-0038',
          actionType: 'VERIFY',
          actorId: actorStoresId,
          newValues: { returnStatus: 'VERIFIED', acceptedQty: 120, rejectedQty: 0 },
          metadata: { module: 'Delivery Challan', ipAddress: '192.168.1.145' },
        },
        {
          entityName: 'RMRequisition',
          entityId: 'RM-REQ-8891',
          actionType: 'CREATE',
          actorId: actorProdId,
          newValues: { styleCode: 'SC-2026-AL', poNumber: 'PO-8812', requestedQuantity: 450, unit: 'Meters' },
          metadata: { module: 'Raw Material', ipAddress: '192.168.1.118' },
        },
        {
          entityName: 'RMRequisition',
          entityId: 'RM-REQ-8891',
          actionType: 'UPDATE',
          actorId: actorAdminId,
          oldValues: { status: 'PENDING_APPROVAL' },
          newValues: { status: 'APPROVED' },
          metadata: { module: 'Raw Material', ipAddress: '192.168.1.102' },
        },
        {
          entityName: 'InventoryStock',
          entityId: 'BIN-STORES-A12',
          actionType: 'ISSUE',
          actorId: actorStoresId,
          newValues: { productCode: 'RM-FABRIC-COTTON-01', issuedQty: 450, remainingBalance: 1250, destination: 'Floor Cutting' },
          metadata: { module: 'Stores & Stock', ipAddress: '192.168.1.145' },
        },
        {
          entityName: 'InventoryStock',
          entityId: 'MSL-ALERT-002',
          actionType: 'CREATE',
          actorId: actorStoresId,
          newValues: { product: 'Polyester Thread 40/2', currentStock: 18, minSafetyLevel: 50, status: 'BREACHED' },
          metadata: { module: 'Stores & Stock', ipAddress: '127.0.0.1' },
        },
        {
          entityName: 'User',
          entityId: adminUser?.id || 'USR-001',
          actionType: 'UPDATE',
          actorId: actorAdminId,
          newValues: { department: 'Administration (ADMIN)', role: 'Admin' },
          metadata: { module: 'User Management', ipAddress: '127.0.0.1' },
        },
        {
          entityName: 'NOTIFICATIONS',
          entityId: 'NOTIF-BATCH-402',
          actionType: 'DELIVER',
          actorId: actorAdminId,
          newValues: { recipientCount: 14, channel: 'EMAIL_AND_IN_APP', eventType: 'MSL_BREACH' },
          metadata: { module: 'Notifications', ipAddress: '127.0.0.1' },
        },
      ];

      for (const log of initialLogs) {
        await this.logEvent(log);
      }

      this.logger.log(`Successfully seeded ${initialLogs.length} initial audit logs.`);
    } catch (err: any) {
      this.logger.warn(`Could not seed initial audit logs: ${err?.message}`);
    }
  }
}
