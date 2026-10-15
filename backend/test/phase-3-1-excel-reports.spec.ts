import { describe, it, expect, vi, beforeEach } from 'vitest';
import ExcelJS from 'exceljs';
import { ExcelReportService } from '../src/reports/excel/excel-report.service';
import { FilesService } from '../src/files/files.service';

describe('Phase 3.1 - ExcelReportService Unit Tests', () => {
  let service: ExcelReportService;
  let mockFilesService: Partial<FilesService>;

  beforeEach(() => {
    mockFilesService = {
      uploadRawBuffer: vi.fn().mockResolvedValue({
        id: 'file-101',
        storageKey: 'reports/excel/test.xlsx',
        size: 1024,
      } as any),
      getDownloadUrlByKey: vi.fn().mockResolvedValue('https://supabase.co/storage/v1/object/sign/rmrit-documents/test.xlsx?token=xyz'),
    };

    service = new ExcelReportService(mockFilesService as FilesService);
  });

  describe('buildTraceabilityWorkbook', () => {
    it('should generate a 3-tab workbook with proper sheets, navy headers, and valid data rows', async () => {
      const mockScs = [
        {
          scNumber: 'SC-2026-001',
          poNumber: 'PO-9901',
          productName: 'Cotton Yarn 30s',
          targetQuantity: 1000,
          status: 'IN_PROGRESS',
          createdAt: '2026-01-10T08:00:00Z',
          completedAt: null,
        },
      ];

      const mockRmItems = [
        {
          scNumber: 'SC-2026-001',
          itemId: 'RM-CTN-30',
          material: 'Combed Cotton',
          requiredQty: 1200,
          unit: 'KG',
        },
      ];

      const mockConsumptions = [
        {
          consumptionId: 'CONS-001',
          scNumber: 'SC-2026-001',
          material: 'Combed Cotton',
          quantityConsumed: 400,
          consumptionDate: '2026-01-12T10:00:00Z',
          consumedBy: 'operator-1',
        },
      ];

      const buffer = await service.buildTraceabilityWorkbook({
        scs: mockScs,
        rmItems: mockRmItems,
        consumptions: mockConsumptions,
      });

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(100);

      // Verify Excel zip magic bytes (PK\x03\x04 = 0x50, 0x4B, 0x03, 0x04)
      expect(buffer[0]).toBe(0x50);
      expect(buffer[1]).toBe(0x4b);
      expect(buffer[2]).toBe(0x03);
      expect(buffer[3]).toBe(0x04);

      // Parse generated buffer to inspect internal worksheets and styling
      const parsedWorkbook = new ExcelJS.Workbook();
      await parsedWorkbook.xlsx.load(buffer);

      const sheetNames = parsedWorkbook.worksheets.map((s) => s.name);
      expect(sheetNames).toEqual(['SC_PO_Summary', 'RM_Requirements', 'Consumption_Audit']);

      // Check Header styling on Sheet 1
      const summarySheet = parsedWorkbook.getWorksheet('SC_PO_Summary');
      expect(summarySheet).toBeDefined();
      const headerCell = summarySheet!.getRow(1).getCell(1);
      expect(headerCell.fill).toBeDefined();
      expect((headerCell.fill as any).fgColor?.argb).toBe('FF1E3A8A'); // RMRIT Navy
      expect(headerCell.font?.bold).toBe(true);
      expect(headerCell.font?.color?.argb).toBe('FFFFFFFF'); // White font

      // Check Frozen row
      expect(summarySheet!.views[0].ySplit).toBe(1);

      // Check data row content
      const dataRow = summarySheet!.getRow(2);
      expect(dataRow.getCell(1).value).toBe('SC-2026-001');
      expect(dataRow.getCell(2).value).toBe('PO-9901');
      expect(dataRow.getCell(4).value).toBe(1000);
    });
  });

  describe('buildStockMovementWorkbook', () => {
    it('should generate a 2-tab workbook with Current_Stock_Balances and Stock_Transactions_Ledger', async () => {
      const mockBalances = [
        {
          productName: 'Cotton Yarn 30s',
          category: 'RAW_MATERIAL',
          binCode: 'BIN-A1',
          currentQuantity: 250,
          openingBalance: 200,
          updatedAt: '2026-02-01T12:00:00Z',
        },
      ];

      const mockTransactions = [
        {
          id: 'tx-1',
          productName: 'Cotton Yarn 30s',
          transactionType: 'GRN_RECEIPT',
          quantity: 250,
          destinationBin: 'BIN-A1',
          referenceType: 'GRN',
          remarks: 'Initial receipt',
          operator: 'stores-officer',
          createdAt: '2026-02-01T11:00:00Z',
        },
      ];

      const buffer = await service.buildStockMovementWorkbook({
        balances: mockBalances,
        transactions: mockTransactions,
      });

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer[0]).toBe(0x50);
      expect(buffer[1]).toBe(0x4b);

      const parsedWorkbook = new ExcelJS.Workbook();
      await parsedWorkbook.xlsx.load(buffer);
      const sheetNames = parsedWorkbook.worksheets.map((s) => s.name);
      expect(sheetNames).toEqual(['Current_Stock_Balances', 'Stock_Transactions_Ledger']);

      const balanceSheet = parsedWorkbook.getWorksheet('Current_Stock_Balances');
      expect(balanceSheet!.getRow(2).getCell(1).value).toBe('Cotton Yarn 30s');
      expect(balanceSheet!.getRow(2).getCell(4).value).toBe(250);
    });
  });

  describe('buildVendorSlaWorkbook', () => {
    it('should generate a 2-tab workbook with Active_Challans and SLA_Breach_Analysis', async () => {
      const mockChallans = [
        {
          challanNumber: 'DC-2026-008',
          vendorName: 'Apex Dyers',
          type: 'TYPE_1',
          status: 'DISPATCHED',
          process: 'Dyeing',
          totalDispatchedQty: 500,
          dispatchDate: '2026-03-01T09:00:00Z',
          expectedReturnDate: '2026-03-08T09:00:00Z',
        },
      ];

      const mockBreaches = [
        {
          challanNumber: 'DC-2026-002',
          vendorName: 'Super Knitters',
          process: 'Knitting',
          dispatchDate: '2026-02-01T09:00:00Z',
          expectedReturnDate: '2026-02-15T09:00:00Z',
          overdueDays: 14,
          slaStatus: 'BREACHED (CRITICAL)',
        },
      ];

      const buffer = await service.buildVendorSlaWorkbook({
        challans: mockChallans,
        slaBreaches: mockBreaches,
      });

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer[0]).toBe(0x50);
      expect(buffer[1]).toBe(0x4b);

      const parsedWorkbook = new ExcelJS.Workbook();
      await parsedWorkbook.xlsx.load(buffer);
      const sheetNames = parsedWorkbook.worksheets.map((s) => s.name);
      expect(sheetNames).toEqual(['Active_Challans', 'SLA_Breach_Analysis']);

      const breachSheet = parsedWorkbook.getWorksheet('SLA_Breach_Analysis');
      expect(breachSheet!.getRow(2).getCell(1).value).toBe('DC-2026-002');
      expect(breachSheet!.getRow(2).getCell(7).value).toBe('BREACHED (CRITICAL)');
    });
  });

  describe('archiveWorkbook', () => {
    it('should archive workbook buffer into Supabase Storage and return signed URL', async () => {
      const dummyBuffer = Buffer.from('test-buffer');
      const result = await service.archiveWorkbook(dummyBuffer, 'Traceability_Audit', 'user-admin-1');

      expect(mockFilesService.uploadRawBuffer).toHaveBeenCalledWith(
        dummyBuffer,
        expect.stringMatching(/^reports\/excel\/Traceability_Audit_\d+\.xlsx$/),
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'user-admin-1',
        'Traceability_Audit.xlsx'
      );
      expect(result.downloadUrl).toContain('https://supabase.co/storage');
      expect(result.storageKey).toMatch(/^reports\/excel\/Traceability_Audit_\d+\.xlsx$/);
    });
  });
});
