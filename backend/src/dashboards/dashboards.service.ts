import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Not } from 'typeorm';
import { RmRequest, RmRequestStatus } from '../rm/entities/rm-request.entity.js';
import { SalesOrderComponent, ScStatus } from '../sc/entities/sc.entity.js';
import { MaterialIssue } from '../material-issue/entities/material-issue.entity.js';
import { AdditionalMaterialRequest, AdditionalRequestStatus } from '../additional-request/entities/additional-request.entity.js';

@Injectable()
export class DashboardsService {
  constructor(
    @InjectRepository(RmRequest)
    private rmRequestRepo: Repository<RmRequest>,
    @InjectRepository(SalesOrderComponent)
    private scRepo: Repository<SalesOrderComponent>,
    @InjectRepository(MaterialIssue)
    private issueRepo: Repository<MaterialIssue>,
    @InjectRepository(AdditionalMaterialRequest)
    private additionalRequestRepo: Repository<AdditionalMaterialRequest>,
  ) {}

  async getDesignerDashboard(userId: string) {
    const activeDrafts = await this.rmRequestRepo.count({
      where: { status: RmRequestStatus.DRAFT, createdById: userId },
    });
    const submittedRms = await this.rmRequestRepo.count({
      where: { status: RmRequestStatus.SUBMITTED, createdById: userId },
    });
    
    const totalSCAssociated = await this.scRepo.count({
      where: { status: Not(ScStatus.CLOSED) }
    });

    return {
      activeDrafts,
      submittedRms,
      totalSCAssociated
    };
  }

  async getStoresDashboard() {
    const pendingRmRequests = await this.rmRequestRepo.count({
      where: { status: RmRequestStatus.SUBMITTED },
    });
    const pendingAdditionalRequests = await this.additionalRequestRepo.count({
      where: { status: AdditionalRequestStatus.REQUESTED }
    });
    const approvedAdditionalToIssue = await this.additionalRequestRepo.count({
      where: { status: AdditionalRequestStatus.APPROVED }
    });

    return {
      pendingRmRequests,
      pendingAdditionalRequests,
      approvedAdditionalToIssue,
    };
  }

  async getProductionDashboard() {
    // Issues that are partially received or waiting to be received are tracked by SC status PARTIALLY_ISSUED / ISSUED
    const pendingReceipts = await this.scRepo.count({
      where: { status: In([ScStatus.ISSUED, ScStatus.PARTIALLY_ISSUED]) }
    });
    const activeBatches = await this.scRepo.count({
      where: { status: ScStatus.IN_PRODUCTION }
    });
    const additionalRequested = await this.additionalRequestRepo.count({
      where: { status: AdditionalRequestStatus.REQUESTED }
    });

    return {
      pendingReceipts,
      activeBatches,
      additionalRequested
    };
  }

  async getManagementDashboard() {
    const totalActiveScs = await this.scRepo.count({
      where: { status: Not(In([ScStatus.COMPLETED, ScStatus.CLOSED])) }
    });
    const totalCompletedScs = await this.scRepo.count({
      where: { status: ScStatus.COMPLETED }
    });
    const totalClosedScs = await this.scRepo.count({
      where: { status: ScStatus.CLOSED }
    });
    const totalExceptions = await this.additionalRequestRepo.count({
      where: { status: Not(In([AdditionalRequestStatus.CANCELLED, AdditionalRequestStatus.REJECTED])) }
    });

    return {
      totalActiveScs,
      totalCompletedScs,
      totalClosedScs,
      totalExceptions
    };
  }

  async getUnifiedOverview() {
    const dataSource = this.scRepo.manager.connection;

    // 1. Module 1: RM to Production Stats
    const scStatusRows = await dataSource.query(`
      SELECT status, COUNT(*)::int as count 
      FROM sales_order_components 
      GROUP BY status
    `);
    const scStatusMap: Record<string, number> = {};
    for (const row of scStatusRows) {
      scStatusMap[row.status] = Number(row.count);
    }

    const rmStatusRows = await dataSource.query(`
      SELECT status, COUNT(*)::int as count 
      FROM rm_requests 
      GROUP BY status
    `);
    const rmStatusMap: Record<string, number> = {};
    for (const row of rmStatusRows) {
      rmStatusMap[row.status] = Number(row.count);
    }

    const [consumptionSum] = await dataSource.query(`
      SELECT COUNT(*)::int as count, COALESCE(SUM(consumed_quantity), 0)::numeric as total_qty 
      FROM material_consumptions
    `);

    const [returnSum] = await dataSource.query(`
      SELECT COUNT(*)::int as count 
      FROM material_returns
    `);

    const recentScs = await dataSource.query(`
      SELECT sc.id, sc.sc_number, sc.product_name, sc.drawing_number, sc.target_quantity, sc.status, po.po_number, sc.created_at
      FROM sales_order_components sc
      LEFT JOIN purchase_orders po ON sc.po_id = po.id
      ORDER BY sc.created_at DESC
      LIMIT 8
    `);

    // 2. Module 2: Stock & Inventory Stats
    const [stockTotals] = await dataSource.query(`
      SELECT COUNT(*)::int as total_balances, COALESCE(SUM(current_quantity), 0)::numeric as total_stock_qty
      FROM stock_balances
    `);

    const txTypeRows = await dataSource.query(`
      SELECT transaction_type, COUNT(*)::int as count, COALESCE(SUM(quantity), 0)::numeric as total_qty
      FROM stock_transactions
      GROUP BY transaction_type
      ORDER BY count DESC
    `);

    const topStockItems = await dataSource.query(`
      SELECT p.id as product_id, p.name as product_name, p.code as product_code, p.uom, p.minimum_inventory,
             b.code as bin_code, b.name as bin_name,
             r.name as rack_name, w.name as warehouse_name,
             sb.current_quantity
      FROM stock_balances sb
      JOIN products p ON sb.product_id = p.id
      JOIN bins b ON sb.bin_id = b.id
      LEFT JOIN racks r ON b.rack_id = r.id
      LEFT JOIN warehouse_locations wl ON r.location_id = wl.id
      LEFT JOIN warehouses w ON wl.warehouse_id = w.id
      WHERE sb.current_quantity > 0
      ORDER BY sb.current_quantity DESC
      LIMIT 8
    `);

    const [lowStockCount] = await dataSource.query(`
      SELECT COUNT(*)::int as count
      FROM stock_balances sb
      JOIN products p ON sb.product_id = p.id
      WHERE sb.current_quantity < p.minimum_inventory AND p.minimum_inventory > 0
    `);

    // 3. Module 3: Delivery Challan Stats
    const dcStatusRows = await dataSource.query(`
      SELECT status, type, COUNT(*)::int as count
      FROM delivery_challans
      GROUP BY status, type
    `);

    const [dcTotals] = await dataSource.query(`
      SELECT COUNT(*)::int as total_dcs,
             COUNT(CASE WHEN status != 'CLOSED' THEN 1 END)::int as open_dcs,
             COUNT(CASE WHEN status = 'CLOSED' THEN 1 END)::int as closed_dcs
      FROM delivery_challans
    `);

    const [custodyTotals] = await dataSource.query(`
      SELECT COALESCE(SUM(dci.quantity_dispatched - dci.quantity_returned), 0)::numeric as total_custody_qty
      FROM delivery_challans dc
      JOIN delivery_challan_items dci ON dc.id = dci.challan_id
      WHERE dc.status != 'CLOSED'
    `);

    const vendorCustodyRows = await dataSource.query(`
      SELECT v.id as vendor_id, v.name as vendor_name, v.code as vendor_code,
             COALESCE(SUM(dci.quantity_dispatched - dci.quantity_returned), 0)::numeric as pending_qty,
             COUNT(DISTINCT dc.id)::int as open_dcs
      FROM delivery_challans dc
      JOIN vendors v ON dc.vendor_id = v.id
      JOIN delivery_challan_items dci ON dc.id = dci.challan_id
      WHERE dc.status != 'CLOSED'
      GROUP BY v.id, v.name, v.code
      ORDER BY pending_qty DESC
    `);

    const recentDcs = await dataSource.query(`
      SELECT dc.id, dc.challan_number, dc.type, dc.status, dc.dispatch_date, dc.expected_return_date,
             v.name as vendor_name,
             COALESCE(SUM(dci.quantity_dispatched), 0)::numeric as dispatched_qty,
             COALESCE(SUM(dci.quantity_returned), 0)::numeric as returned_qty,
             COALESCE(SUM(dci.quantity_dispatched - dci.quantity_returned), 0)::numeric as pending_qty
      FROM delivery_challans dc
      JOIN vendors v ON dc.vendor_id = v.id
      LEFT JOIN delivery_challan_items dci ON dc.id = dci.challan_id
      GROUP BY dc.id, dc.challan_number, dc.type, dc.status, dc.dispatch_date, dc.expected_return_date, v.name, dc.created_at
      ORDER BY dc.created_at DESC
      LIMIT 8
    `);

    return {
      summary: {
        activeShopFloorScs: (scStatusMap['IN_PRODUCTION'] || 0) + (scStatusMap['ISSUED'] || 0) + (scStatusMap['PARTIALLY_ISSUED'] || 0) + (scStatusMap['DRAFT'] || 0),
        totalStockQuantity: Number(stockTotals?.total_stock_qty || 0),
        totalCustodyUnits: Number(custodyTotals?.total_custody_qty || 0),
        openDeliveryChallans: Number(dcTotals?.open_dcs || 0),
        lowStockAlerts: Number(lowStockCount?.count || 0),
      },
      rmWorkflow: {
        scStatusMap,
        rmStatusMap,
        totalScs: Object.values(scStatusMap).reduce((a, b) => a + b, 0),
        totalConsumptions: Number(consumptionSum?.count || 0),
        totalConsumedQty: Number(consumptionSum?.total_qty || 0),
        totalReturns: Number(returnSum?.count || 0),
        recentScs,
      },
      stockInventory: {
        totalStockBalances: Number(stockTotals?.total_balances || 0),
        totalStockQuantity: Number(stockTotals?.total_stock_qty || 0),
        txTypeBreakdown: txTypeRows.map((r: any) => ({
          type: r.transaction_type,
          count: Number(r.count),
          quantity: Number(r.total_qty),
        })),
        topStockItems,
        lowStockCount: Number(lowStockCount?.count || 0),
      },
      deliveryChallan: {
        totalDcs: Number(dcTotals?.total_dcs || 0),
        openDcs: Number(dcTotals?.open_dcs || 0),
        closedDcs: Number(dcTotals?.closed_dcs || 0),
        totalCustodyQty: Number(custodyTotals?.total_custody_qty || 0),
        dcStatusBreakdown: dcStatusRows.map((r: any) => ({
          status: r.status,
          type: r.type,
          count: Number(r.count),
        })),
        vendorCustody: vendorCustodyRows.map((r: any) => ({
          vendorId: r.vendor_id,
          vendorName: r.vendor_name,
          vendorCode: r.vendor_code,
          pendingQty: Number(r.pending_qty),
          openDcs: Number(r.open_dcs),
        })),
        recentDcs,
      },
    };
  }
}

