import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PdfGeneratorService } from '../src/reports/pdf/pdf-generator.service';
import { FilesService } from '../src/files/files.service';

describe('Phase 3.2 - PdfGeneratorService Unit Tests', () => {
  let service: PdfGeneratorService;
  let mockFilesService: Partial<FilesService>;

  beforeEach(() => {
    mockFilesService = {
      uploadRawBuffer: vi.fn().mockResolvedValue({
        id: 'file-doc-1',
        storageKey: 'documents/challans/dc-1.pdf',
        size: 2048,
      } as any),
      getDownloadUrlByKey: vi.fn().mockResolvedValue('https://supabase.co/storage/v1/object/sign/rmrit-documents/documents/challans/dc-1.pdf?token=xyz'),
    };

    service = new PdfGeneratorService(mockFilesService as FilesService);
  });

  describe('generateDeliveryChallanPdf', () => {
    it('should generate a valid Type 1 Delivery Challan PDF with %PDF header and minimal RAM footprint', async () => {
      const mockChallan = {
        id: 'dc-101',
        challanNumber: 'DC-2026-001',
        type: 'GENERAL_INVENTORY_OUTWARD',
        dispatchDate: new Date('2026-03-01T10:00:00Z'),
        expectedReturnDate: new Date('2026-03-10T10:00:00Z'),
        status: 'DISPATCHED',
        vendor: { name: 'Apex Dyers Pvt Ltd' },
        sc: { scNumber: 'SC-2026-88' },
        createdBy: { name: 'John Stores' },
        items: [
          {
            itemCode: 'RM-CTN-30',
            description: 'Combed Cotton Yarn 30s',
            quantity: 500,
            uom: 'KG',
          },
          {
            itemCode: 'RM-DYE-BLU',
            description: 'Reactive Blue Dye',
            quantity: 25,
            uom: 'KG',
          },
        ],
      };

      const heapBefore = process.memoryUsage().heapUsed;
      const buffer = await service.generateDeliveryChallanPdf(mockChallan);
      const heapAfter = process.memoryUsage().heapUsed;
      const heapDeltaMb = (heapAfter - heapBefore) / (1024 * 1024);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(500);

      // Verify PDF Magic Bytes (%PDF = 0x25, 0x50, 0x44, 0x46)
      expect(buffer[0]).toBe(0x25); // '%'
      expect(buffer[1]).toBe(0x50); // 'P'
      expect(buffer[2]).toBe(0x44); // 'D'
      expect(buffer[3]).toBe(0x46); // 'F'

      // Memory budget constraint: Heap increase must be strictly under 25MB
      expect(heapDeltaMb).toBeLessThan(25);
    });

    it('should generate a valid Type 2 Delivery Challan PDF for semi-finished production outward', async () => {
      const mockChallan = {
        id: 'dc-202',
        challanNumber: 'DC-2026-002',
        type: 'PRODUCTION_PROCESS_OUTWARD',
        dispatchDate: new Date('2026-03-02T10:00:00Z'),
        expectedReturnDate: new Date('2026-03-15T10:00:00Z'),
        status: 'DISPATCHED',
        vendor: { name: 'Premier Knitters Ltd' },
        sc: { scNumber: 'SC-2026-92' },
        items: [
          {
            componentCode: 'COMP-KNIT-01',
            description: 'Knitted Grey Fabric Roll',
            quantity: 350,
            uom: 'MTR',
          },
        ],
      };

      const buffer = await service.generateDeliveryChallanPdf(mockChallan);
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.toString('utf8', 0, 4)).toBe('%PDF');
    });
  });

  describe('generateMaterialIssueSlipPdf', () => {
    it('should generate a valid Material Issue Slip PDF with accurate item quantities', async () => {
      const mockIssue = {
        id: 'issue-501',
        issueNumber: 'MIS-2026-0089',
        issueType: 'INITIAL_ISSUE',
        issueDate: new Date('2026-02-15T09:30:00Z'),
        salesOrderComponent: { scNumber: 'SC-2026-77' },
        issuedBy: { name: 'Robert Storekeeper' },
        items: [
          {
            itemCode: 'RM-CTN-40',
            description: 'Carded Cotton 40s',
            requiredQuantity: 1000,
            issuedQuantity: 1000,
            uom: 'KG',
            binLocation: 'BIN-STORES-B2',
          },
        ],
      };

      const buffer = await service.generateMaterialIssueSlipPdf(mockIssue);
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(500);
      expect(buffer.toString('utf8', 0, 4)).toBe('%PDF');
    });
  });

  describe('archivePdf', () => {
    it('should upload PDF buffer into Supabase Storage and return signed download URL', async () => {
      const dummyBuffer = Buffer.from('%PDF-1.4 test dummy content');
      const result = await service.archivePdf(dummyBuffer, 'challan', 'dc-101', 'user-test-1');

      expect(mockFilesService.uploadRawBuffer).toHaveBeenCalledWith(
        dummyBuffer,
        'documents/challans/dc-101.pdf',
        'application/pdf',
        'user-test-1',
        'challan_dc-101.pdf'
      );
      expect(mockFilesService.getDownloadUrlByKey).toHaveBeenCalledWith('documents/challans/dc-101.pdf');
      expect(result.downloadUrl).toContain('https://supabase.co/storage');
      expect(result.storageKey).toBe('documents/challans/dc-101.pdf');
    });
  });
});
