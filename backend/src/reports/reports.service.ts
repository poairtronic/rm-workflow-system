import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SalesOrderComponent } from '../sc/entities/sc.entity.js';
import { RmItem } from '../rm/entities/rm-item.entity.js';
import { MaterialIssue } from '../material-issue/entities/material-issue.entity.js';
import { MaterialConsumption } from '../production/entities/material-consumption.entity.js';
import { StockBalance } from '../inventory/entities/stock-balance.entity.js';
import { StockTransaction } from '../inventory/entities/stock-transaction.entity.js';
import { DeliveryChallan } from '../delivery-challan/entities/delivery-challan.entity.js';
import { ExcelReportService } from './excel/excel-report.service.js';
import { PdfGeneratorService } from './pdf/pdf-generator.service.js';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(SalesOrderComponent)
    private scRepo: Repository<SalesOrderComponent>,
    @InjectRepository(RmItem)
    private rmItemRepo: Repository<RmItem>,
    @InjectRepository(MaterialIssue)
    private materialIssueRepo: Repository<MaterialIssue>,
    @InjectRepository(MaterialConsumption)
    private consumptionRepo: Repository<MaterialConsumption>,
    @InjectRepository(StockBalance)
    private stockBalanceRepo: Repository<StockBalance>,
    @InjectRepository(StockTransaction)
    private stockTxRepo: Repository<StockTransaction>,
    @InjectRepository(DeliveryChallan)
    private challanRepo: Repository<DeliveryChallan>,
    private readonly excelReportService: ExcelReportService,
    private readonly pdfGeneratorService: PdfGeneratorService,
  ) {}

  async getProcessWiseReport() {
    const data = await this.scRepo.find({
      relations: {
        purchaseOrder: true,
        materialIssues: true,
        materialConsumptions: true
      },
      order: { createdAt: 'DESC' }
    });
    
    return data.map(sc => ({
      scNumber: sc.scNumber,
      poNumber: sc.purchaseOrder?.poNumber || 'N/A',
      productName: sc.productName,
      status: sc.status,
      targetQuantity: Number(sc.targetQuantity),
      createdAt: sc.createdAt,
      completedAt: sc.completedAt
    }));
  }

  async getItemWiseReport() {
    const data = await this.rmItemRepo.find({
      relations: {
        salesOrderComponent: true
      },
      order: { createdAt: 'DESC' }
    });

    return data.map(item => ({
      itemId: item.id,
      material: item.material,
      grade: item.grade,
      quantity: Number(item.quantity),
      unit: item.weightUnit, // using weightUnit instead of unit
      scNumber: item.salesOrderComponent?.scNumber || 'N/A',
      createdAt: item.createdAt
    }));
  }

  async getRmConsumptionReport() {
    const data = await this.consumptionRepo.find({
      relations: {
        salesOrderComponent: true,
        recordedBy: true,
        rmItem: true
      },
      order: { recordedAt: 'DESC' }
    });

    return data.map(c => ({
      consumptionId: c.id,
      scNumber: c.salesOrderComponent?.scNumber || 'N/A',
      material: c.rmItem?.material || 'Unknown',
      quantityConsumed: Number(c.consumedQuantity),
      consumptionDate: c.recordedAt,
      consumedBy: c.recordedBy?.name || 'Unknown'
    }));
  }

  /**
   * Generates Consolidated SC & PO Traceability Multi-Tab Excel Workbook
   */
  async getTraceabilityExcel(archiveToStorage = false, userId = 'SYSTEM') {
    const scs = await this.getProcessWiseReport();
    const rmItems = await this.getItemWiseReport();
    const consumptions = await this.getRmConsumptionReport();

    const buffer = await this.excelReportService.buildTraceabilityWorkbook({
      scs,
      rmItems,
      consumptions,
    });

    let storageMeta: { downloadUrl: string; storageKey: string } | undefined;
    if (archiveToStorage) {
      try {
        storageMeta = await this.excelReportService.archiveWorkbook(
          buffer,
          'SC_PO_Traceability_Report',
          userId,
        );
      } catch (err: any) {
        console.error('[ReportsService] Archive workbook failed:', err?.message || err);
      }
    }

    return {
      buffer,
      filename: `SC_PO_Traceability_Report_${new Date().toISOString().split('T')[0]}.xlsx`,
      ...storageMeta,
    };
  }

  /**
   * Generates Stock Movement & Balances Multi-Tab Excel Workbook
   */
  async getStockMovementExcel(archiveToStorage = false, userId = 'SYSTEM') {
    const balances = await this.stockBalanceRepo.find({
      relations: { product: true, bin: true },
      order: { updatedAt: 'DESC' },
      take: 1000,
    });

    const balanceData = balances.map((b) => ({
      productName: b.product?.name || 'N/A',
      category: (b.product as any)?.category || 'Raw Materials',
      binCode: b.bin?.code || 'N/A',
      currentQuantity: Number(b.currentQuantity) || 0,
      openingBalance: Number(b.openingBalance) || 0,
      updatedAt: b.updatedAt,
    }));

    const transactions = await this.stockTxRepo.find({
      relations: { product: true, destinationBin: true, createdBy: true },
      order: { createdAt: 'DESC' },
      take: 1000,
    });

    const txData = transactions.map((tx) => ({
      id: tx.id,
      createdAt: tx.createdAt,
      productName: tx.product?.name || 'N/A',
      transactionType: tx.transactionType,
      quantity: Number(tx.quantity) || 0,
      destinationBin: tx.destinationBin?.code || 'N/A',
      referenceType: (tx as any).referenceType || 'N/A',
      remarks: tx.remarks || '',
      operator: tx.createdBy?.name || 'SYSTEM',
    }));

    const buffer = await this.excelReportService.buildStockMovementWorkbook({
      balances: balanceData,
      transactions: txData,
    });

    let storageMeta: { downloadUrl: string; storageKey: string } | undefined;
    if (archiveToStorage) {
      try {
        storageMeta = await this.excelReportService.archiveWorkbook(
          buffer,
          'Stock_Movement_Report',
          userId,
        );
      } catch (err: any) {
        // Non-blocking storage upload failure
      }
    }

    return {
      buffer,
      filename: `Stock_Movement_Report_${new Date().toISOString().split('T')[0]}.xlsx`,
      ...storageMeta,
    };
  }

  /**
   * Generates Vendor SLA & Delivery Challan Tracker Multi-Tab Excel Workbook
   */
  async getVendorSlaExcel(archiveToStorage = false, userId = 'SYSTEM') {
    const challans = await this.challanRepo.find({
      relations: { vendor: true, sc: true, process: true, items: true },
      order: { dispatchDate: 'DESC' },
      take: 1000,
    });

    const now = new Date();
    const challanData = challans.map((dc) => {
      const totalQty = (dc.items || []).reduce(
        (acc, it) => acc + Number(it.quantityDispatched || 0),
        0,
      );
      return {
        challanNumber: dc.challanNumber,
        type: dc.type,
        vendorName: dc.vendor?.name || 'N/A',
        scNumber: dc.sc?.scNumber || 'N/A',
        process: dc.process?.name || 'N/A',
        dispatchDate: dc.dispatchDate,
        expectedReturnDate: dc.expectedReturnDate,
        status: dc.status,
        totalDispatchedQty: totalQty,
      };
    });

    const slaBreaches = challans
      .filter((dc) => dc.status !== 'CLOSED' && dc.status !== 'RETURNED' && dc.expectedReturnDate)
      .map((dc) => {
        const expected = new Date(dc.expectedReturnDate!);
        const overdueMs = now.getTime() - expected.getTime();
        const overdueDays = Math.max(0, Math.floor(overdueMs / (1000 * 60 * 60 * 24)));
        let slaStatus = 'ON_TIME';
        if (overdueDays > 0) {
          slaStatus = 'OVERDUE';
        } else if (overdueDays >= -2) {
          slaStatus = 'APPROACHING_SLA';
        }
        return {
          challanNumber: dc.challanNumber,
          vendorName: dc.vendor?.name || 'N/A',
          process: dc.process?.name || 'N/A',
          dispatchDate: dc.dispatchDate,
          expectedReturnDate: dc.expectedReturnDate,
          overdueDays,
          slaStatus,
        };
      });

    const buffer = await this.excelReportService.buildVendorSlaWorkbook({
      challans: challanData,
      slaBreaches,
    });

    let storageMeta: { downloadUrl: string; storageKey: string } | undefined;
    if (archiveToStorage) {
      try {
        storageMeta = await this.excelReportService.archiveWorkbook(
          buffer,
          'Vendor_SLA_Tracker',
          userId,
        );
      } catch (err: any) {
        // Non-blocking storage upload failure
      }
    }

    return {
      buffer,
      filename: `Vendor_SLA_Tracker_${new Date().toISOString().split('T')[0]}.xlsx`,
      ...storageMeta,
    };
  }

  /**
   * Generates low-RAM PDF for Delivery Challan
   */
  async getDeliveryChallanPdf(
    challanId: string,
    archiveToStorage = false,
    userId = 'SYSTEM',
  ) {
    const challan = await this.challanRepo.findOne({
      where: { id: challanId },
      relations: {
        vendor: true,
        sc: true,
        process: true,
        items: true,
        createdBy: true,
      },
    });

    if (!challan) {
      throw new NotFoundException(`Delivery Challan ${challanId} not found`);
    }

    const buffer = await this.pdfGeneratorService.generateDeliveryChallanPdf(challan);

    let storageMeta: { downloadUrl: string; storageKey: string } | undefined;
    if (archiveToStorage) {
      try {
        storageMeta = await this.pdfGeneratorService.archivePdf(
          buffer,
          'challan',
          challan.id,
          userId,
        );
      } catch (err: any) {
        console.error('[ReportsService] PDF archive failed:', err?.message || err);
      }
    }

    return {
      buffer,
      filename: `Challan_${challan.challanNumber}.pdf`,
      ...storageMeta,
    };
  }

  /**
   * Generates low-RAM PDF for Material Issue Slip
   */
  async getMaterialIssueSlipPdf(
    issueId: string,
    archiveToStorage = false,
    userId = 'SYSTEM',
  ) {
    const issue = await this.materialIssueRepo.findOne({
      where: { id: issueId },
      relations: {
        salesOrderComponent: true,
        items: true,
        issuedBy: true,
      },
    });

    if (!issue) {
      throw new NotFoundException(`Material Issue Slip ${issueId} not found`);
    }

    const buffer = await this.pdfGeneratorService.generateMaterialIssueSlipPdf(issue);

    let storageMeta: { downloadUrl: string; storageKey: string } | undefined;
    if (archiveToStorage) {
      try {
        storageMeta = await this.pdfGeneratorService.archivePdf(
          buffer,
          'issue-slip',
          issue.id,
          userId,
        );
      } catch (err: any) {
        console.error('[ReportsService] PDF archive failed:', err?.message || err);
      }
    }

    return {
      buffer,
      filename: `IssueSlip_${issue.issueNumber}.pdf`,
      ...storageMeta,
    };
  }
}

