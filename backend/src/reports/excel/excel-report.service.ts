import { Injectable, Logger, Optional } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { FilesService } from '../../files/files.service.js';

@Injectable()
export class ExcelReportService {
  private readonly logger = new Logger(ExcelReportService.name);

  constructor(@Optional() private readonly filesService?: FilesService) {}

  /**
   * Applies corporate V-SMART navy styling, frozen headers, and auto-column width
   */
  public applyWorksheetFormatting(sheet: ExcelJS.Worksheet) {
    sheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];

    const headerRow = sheet.getRow(1);
    headerRow.height = 26;
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E3A8A' }, // V-SMART Navy
      };
      cell.font = {
        name: 'Segoe UI',
        bold: true,
        color: { argb: 'FFFFFFFF' },
        size: 11,
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
        left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      };
    });

    // Auto-fit column widths with safety bounds (12 to 48)
    sheet.columns.forEach((column) => {
      let maxLen = column.header ? String(column.header).length : 10;
      column.eachCell?.({ includeEmpty: false }, (cell, rowNumber) => {
        if (rowNumber > 1) {
          const valStr = cell.value != null ? String(cell.value) : '';
          if (valStr.length > maxLen) maxLen = valStr.length;
        }
      });
      column.width = Math.min(Math.max(maxLen + 4, 12), 48);
    });

    // Format data rows with borders & vertical center
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        row.height = 20;
        row.eachCell((cell) => {
          cell.alignment = { vertical: 'middle' };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          };
        });
      }
    });
  }

  /**
   * Generates Consolidated SC & PO Traceability Workbook (3 Tabs)
   */
  async buildTraceabilityWorkbook(data: {
    scs: any[];
    rmItems: any[];
    consumptions: any[];
  }): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'V-SMART Industrial Traceability System';
    workbook.created = new Date();

    // Tab 1: SC & PO Summary
    const summarySheet = workbook.addWorksheet('SC_PO_Summary');
    summarySheet.columns = [
      { header: 'SC Number', key: 'scNumber' },
      { header: 'PO Number', key: 'poNumber' },
      { header: 'Product Name', key: 'productName' },
      { header: 'Target Quantity', key: 'targetQuantity' },
      { header: 'Status', key: 'status' },
      { header: 'Created Date', key: 'createdAt' },
      { header: 'Completed Date', key: 'completedAt' },
    ];
    (data.scs || []).forEach((sc) => {
      summarySheet.addRow({
        scNumber: sc.scNumber || 'N/A',
        poNumber: sc.poNumber || 'N/A',
        productName: sc.productName || 'N/A',
        targetQuantity: Number(sc.targetQuantity) || 0,
        status: sc.status || 'OPEN',
        createdAt: sc.createdAt ? new Date(sc.createdAt).toISOString().split('T')[0] : 'N/A',
        completedAt: sc.completedAt ? new Date(sc.completedAt).toISOString().split('T')[0] : 'N/A',
      });
    });
    this.applyWorksheetFormatting(summarySheet);

    // Tab 2: RM Items
    const rmSheet = workbook.addWorksheet('RM_Requirements');
    rmSheet.columns = [
      { header: 'SC Number', key: 'scNumber' },
      { header: 'Item ID', key: 'itemId' },
      { header: 'Material', key: 'material' },
      { header: 'Grade', key: 'grade' },
      { header: 'Required Qty', key: 'quantity' },
      { header: 'Unit', key: 'unit' },
      { header: 'Created Date', key: 'createdAt' },
    ];
    (data.rmItems || []).forEach((rm) => {
      rmSheet.addRow({
        scNumber: rm.scNumber || 'N/A',
        itemId: rm.itemId || 'N/A',
        material: rm.material || 'N/A',
        grade: rm.grade || 'N/A',
        quantity: Number(rm.quantity) || 0,
        unit: rm.unit || 'KG',
        createdAt: rm.createdAt ? new Date(rm.createdAt).toISOString().split('T')[0] : 'N/A',
      });
    });
    this.applyWorksheetFormatting(rmSheet);

    // Tab 3: Consumption Audit
    const consSheet = workbook.addWorksheet('Consumption_Audit');
    consSheet.columns = [
      { header: 'Consumption ID', key: 'consumptionId' },
      { header: 'SC Number', key: 'scNumber' },
      { header: 'Material', key: 'material' },
      { header: 'Consumed Qty', key: 'quantityConsumed' },
      { header: 'Consumed Date', key: 'consumptionDate' },
      { header: 'Consumed By', key: 'consumedBy' },
    ];
    (data.consumptions || []).forEach((c) => {
      consSheet.addRow({
        consumptionId: c.consumptionId || 'N/A',
        scNumber: c.scNumber || 'N/A',
        material: c.material || 'N/A',
        quantityConsumed: Number(c.quantityConsumed) || 0,
        consumptionDate: c.consumptionDate ? new Date(c.consumptionDate).toISOString().replace('T', ' ').slice(0, 19) : 'N/A',
        consumedBy: c.consumedBy || 'N/A',
      });
    });
    this.applyWorksheetFormatting(consSheet);

    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  /**
   * Generates Stock Movement & Balances Report (2 Tabs)
   */
  async buildStockMovementWorkbook(data: {
    balances: any[];
    transactions: any[];
  }): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'V-SMART Industrial Traceability System';
    workbook.created = new Date();

    // Tab 1: Current Stock Balances
    const balSheet = workbook.addWorksheet('Current_Stock_Balances');
    balSheet.columns = [
      { header: 'Product Name', key: 'productName' },
      { header: 'Category', key: 'category' },
      { header: 'Bin Code', key: 'binCode' },
      { header: 'Current Quantity', key: 'currentQuantity' },
      { header: 'Opening Balance', key: 'openingBalance' },
      { header: 'Last Updated', key: 'updatedAt' },
    ];
    (data.balances || []).forEach((b) => {
      balSheet.addRow({
        productName: b.productName || 'N/A',
        category: b.category || 'N/A',
        binCode: b.binCode || 'N/A',
        currentQuantity: Number(b.currentQuantity) || 0,
        openingBalance: Number(b.openingBalance) || 0,
        updatedAt: b.updatedAt ? new Date(b.updatedAt).toISOString().split('T')[0] : 'N/A',
      });
    });
    this.applyWorksheetFormatting(balSheet);

    // Tab 2: Stock Transactions Ledger
    const txSheet = workbook.addWorksheet('Stock_Transactions_Ledger');
    txSheet.columns = [
      { header: 'Transaction ID', key: 'id' },
      { header: 'Timestamp', key: 'createdAt' },
      { header: 'Product Name', key: 'productName' },
      { header: 'Transaction Type', key: 'transactionType' },
      { header: 'Quantity', key: 'quantity' },
      { header: 'Destination Bin', key: 'destinationBin' },
      { header: 'Reference Type', key: 'referenceType' },
      { header: 'Remarks', key: 'remarks' },
      { header: 'Operator', key: 'operator' },
    ];
    (data.transactions || []).forEach((tx) => {
      txSheet.addRow({
        id: tx.id || 'N/A',
        createdAt: tx.createdAt ? new Date(tx.createdAt).toISOString().replace('T', ' ').slice(0, 19) : 'N/A',
        productName: tx.productName || 'N/A',
        transactionType: tx.transactionType || 'N/A',
        quantity: Number(tx.quantity) || 0,
        destinationBin: tx.destinationBin || 'N/A',
        referenceType: tx.referenceType || 'N/A',
        remarks: tx.remarks || '',
        operator: tx.operator || 'SYSTEM',
      });
    });
    this.applyWorksheetFormatting(txSheet);

    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  /**
   * Generates Vendor SLA & Delivery Challan Tracker (2 Tabs)
   */
  async buildVendorSlaWorkbook(data: {
    challans: any[];
    slaBreaches: any[];
  }): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'V-SMART Industrial Traceability System';
    workbook.created = new Date();

    // Tab 1: Active Challans
    const challanSheet = workbook.addWorksheet('Active_Challans');
    challanSheet.columns = [
      { header: 'Challan Number', key: 'challanNumber' },
      { header: 'Type', key: 'type' },
      { header: 'Vendor Name', key: 'vendorName' },
      { header: 'SC Number', key: 'scNumber' },
      { header: 'Process', key: 'process' },
      { header: 'Dispatch Date', key: 'dispatchDate' },
      { header: 'Expected Return Date', key: 'expectedReturnDate' },
      { header: 'Status', key: 'status' },
      { header: 'Total Dispatched Qty', key: 'totalDispatchedQty' },
    ];
    (data.challans || []).forEach((dc) => {
      challanSheet.addRow({
        challanNumber: dc.challanNumber || 'N/A',
        type: dc.type || 'N/A',
        vendorName: dc.vendorName || 'N/A',
        scNumber: dc.scNumber || 'N/A',
        process: dc.process || 'N/A',
        dispatchDate: dc.dispatchDate ? new Date(dc.dispatchDate).toISOString().split('T')[0] : 'N/A',
        expectedReturnDate: dc.expectedReturnDate ? new Date(dc.expectedReturnDate).toISOString().split('T')[0] : 'N/A',
        status: dc.status || 'N/A',
        totalDispatchedQty: Number(dc.totalDispatchedQty) || 0,
      });
    });
    this.applyWorksheetFormatting(challanSheet);

    // Tab 2: SLA Breach Analysis
    const breachSheet = workbook.addWorksheet('SLA_Breach_Analysis');
    breachSheet.columns = [
      { header: 'Challan Number', key: 'challanNumber' },
      { header: 'Vendor Name', key: 'vendorName' },
      { header: 'Process', key: 'process' },
      { header: 'Dispatch Date', key: 'dispatchDate' },
      { header: 'Expected Return', key: 'expectedReturnDate' },
      { header: 'Overdue Days', key: 'overdueDays' },
      { header: 'SLA Status', key: 'slaStatus' },
    ];
    (data.slaBreaches || []).forEach((b) => {
      breachSheet.addRow({
        challanNumber: b.challanNumber || 'N/A',
        vendorName: b.vendorName || 'N/A',
        process: b.process || 'N/A',
        dispatchDate: b.dispatchDate ? new Date(b.dispatchDate).toISOString().split('T')[0] : 'N/A',
        expectedReturnDate: b.expectedReturnDate ? new Date(b.expectedReturnDate).toISOString().split('T')[0] : 'N/A',
        overdueDays: Number(b.overdueDays) || 0,
        slaStatus: b.slaStatus || 'ON_TIME',
      });
    });
    this.applyWorksheetFormatting(breachSheet);

    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  /**
   * Optionally archives generated Excel workbook to Supabase Storage
   */
  async archiveWorkbook(
    buffer: Buffer,
    reportName: string,
    userId = 'SYSTEM',
  ): Promise<{ downloadUrl: string; storageKey: string }> {
    if (!this.filesService) {
      throw new Error('FilesService is not available for cloud storage archiving.');
    }
    const timestamp = Date.now();
    const safeName = reportName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const storageKey = `reports/excel/${safeName}_${timestamp}.xlsx`;

    await this.filesService.uploadRawBuffer(
      buffer,
      storageKey,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      userId,
      `${safeName}.xlsx`,
    );

    const downloadUrl = await this.filesService.getDownloadUrlByKey(storageKey);
    return { downloadUrl, storageKey };
  }
}
