import { Injectable, Logger, Optional } from '@nestjs/common';
import { createRequire } from 'module';
import { FilesService } from '../../files/files.service.js';

const require = createRequire(import.meta.url);
const pdfmake = require('pdfmake');

// Configure built-in standard 14 PDF fonts (zero external font downloads / low RAM)
pdfmake.setUrlAccessPolicy(() => false);
pdfmake.setLocalAccessPolicy(() => true);
pdfmake.setFonts({
  Helvetica: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique',
  },
});

@Injectable()
export class PdfGeneratorService {
  private readonly logger = new Logger(PdfGeneratorService.name);

  constructor(@Optional() private readonly filesService?: FilesService) {}

  /**
   * Generates low-RAM PDF for Type 1 or Type 2 Delivery Challan
   */
  async generateDeliveryChallanPdf(challan: any): Promise<Buffer> {
    const isType2 =
      challan.type?.includes('2') ||
      challan.type === 'PRODUCTION_PROCESS_OUTWARD';
    const typeLabel = isType2
      ? 'TYPE 2 (SEMI-FINISHED / PROCESS OUTWARD)'
      : 'TYPE 1 (RAW MATERIAL OUTWARD)';

    const items = challan.items || [];
    let totalQty = 0;

    const tableBody: any[][] = [
      [
        { text: '#', style: 'tableHeader', alignment: 'center' },
        { text: 'Item / Component', style: 'tableHeader' },
        { text: 'Description', style: 'tableHeader' },
        { text: 'UOM', style: 'tableHeader', alignment: 'center' },
        { text: 'Quantity', style: 'tableHeader', alignment: 'right' },
      ],
    ];

    items.forEach((item: any, index: number) => {
      const qty = Number(item.quantity || item.dispatchedQuantity || 0);
      totalQty += qty;
      tableBody.push([
        { text: String(index + 1), alignment: 'center' },
        { text: item.itemCode || item.componentCode || item.product?.code || 'N/A', bold: true },
        { text: item.description || item.product?.name || item.remarks || '-' },
        { text: item.uom || item.unit || 'PCS', alignment: 'center' },
        { text: qty.toLocaleString(), alignment: 'right' },
      ]);
    });

    // Total Row
    tableBody.push([
      { text: 'TOTAL DISPATCHED QUANTITY', colSpan: 4, bold: true, alignment: 'right' },
      {},
      {},
      {},
      { text: totalQty.toLocaleString(), bold: true, alignment: 'right' },
    ]);

    const docDefinition: any = {
      defaultStyle: {
        font: 'Helvetica',
        fontSize: 9,
        color: '#1E293B',
      },
      pageMargins: [40, 40, 40, 40],
      content: [
        // Company Header
        {
          columns: [
            {
              width: '*',
              stack: [
                { text: 'V-SMART MANUFACTURING SYSTEMS', style: 'companyName' },
                { text: 'Industrial Raw Material & Supply Chain Workflow Suite', style: 'companySubtitle' },
                { text: 'Factory Unit 1, Manufacturing Zone, Industrial Corridor', style: 'companyAddress' },
              ],
            },
            {
              width: 'auto',
              stack: [
                { text: 'DELIVERY CHALLAN', style: 'docBadge' },
                { text: typeLabel, style: 'docBadgeSub' },
              ],
              alignment: 'right',
            },
          ],
        },
        { canvas: [{ type: 'line', x1: 0, y1: 10, x2: 515, y2: 10, lineWidth: 1.5, lineColor: '#1E3A8A' }] },
        { text: '', margin: [0, 10] },

        // Challan Details Table
        {
          style: 'metaTable',
          table: {
            widths: ['25%', '25%', '25%', '25%'],
            body: [
              [
                { text: 'Challan Number:', bold: true, fillColor: '#F8FAFC' },
                { text: challan.challanNumber || 'N/A', bold: true, color: '#1E3A8A' },
                { text: 'Dispatch Date:', bold: true, fillColor: '#F8FAFC' },
                { text: challan.dispatchDate ? new Date(challan.dispatchDate).toISOString().split('T')[0] : 'N/A' },
              ],
              [
                { text: 'Vendor Name:', bold: true, fillColor: '#F8FAFC' },
                { text: challan.vendor?.name || challan.vendorName || 'N/A' },
                { text: 'Expected Return:', bold: true, fillColor: '#F8FAFC' },
                { text: challan.expectedReturnDate ? new Date(challan.expectedReturnDate).toISOString().split('T')[0] : 'N/A' },
              ],
              [
                { text: 'Sales Component (SC):', bold: true, fillColor: '#F8FAFC' },
                { text: challan.sc?.scNumber || challan.scNumber || 'N/A' },
                { text: 'Status:', bold: true, fillColor: '#F8FAFC' },
                { text: challan.status || 'DISPATCHED', bold: true },
              ],
            ],
          },
          layout: {
            hLineWidth: () => 0.5,
            vLineWidth: () => 0.5,
            hLineColor: () => '#CBD5E1',
            vLineColor: () => '#CBD5E1',
          },
        },

        { text: 'DISPATCHED MATERIALS & COMPONENTS', style: 'sectionHeader', margin: [0, 16, 0, 8] },

        // Items Table
        {
          table: {
            headerRows: 1,
            widths: ['8%', '27%', '40%', '10%', '15%'],
            body: tableBody,
          },
          layout: {
            fillColor: (rowIndex: number) => (rowIndex === 0 ? '#1E3A8A' : rowIndex % 2 === 0 ? '#F8FAFC' : null),
            hLineWidth: () => 0.5,
            vLineWidth: () => 0.5,
            hLineColor: () => '#E2E8F0',
            vLineColor: () => '#E2E8F0',
          },
        },

        { text: '', margin: [0, 20] },

        // Notes & Terms
        {
          stack: [
            { text: 'Terms & Conditions:', bold: true, fontSize: 8 },
            {
              text: '1. Materials dispatched strictly for job work processing as per terms. Not for sale.\n2. Quantity and quality must be verified immediately upon receipt.\n3. Goods must be processed and returned by the specified expected return date.',
              fontSize: 7.5,
              color: '#64748B',
              margin: [0, 4, 0, 0],
            },
          ],
        },

        { text: '', margin: [0, 30] },

        // Signatures
        {
          columns: [
            {
              stack: [
                { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 140, y2: 0, lineWidth: 0.5, lineColor: '#94A3B8' }] },
                { text: 'Prepared By (Stores)', fontSize: 8, bold: true, margin: [0, 4, 0, 0] },
                { text: challan.createdBy?.name || 'Stores Officer', fontSize: 7.5, color: '#64748B' },
              ],
            },
            {
              stack: [
                { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 140, y2: 0, lineWidth: 0.5, lineColor: '#94A3B8' }] },
                { text: 'Authorized Signatory', fontSize: 8, bold: true, margin: [0, 4, 0, 0] },
                { text: 'Factory Manager', fontSize: 7.5, color: '#64748B' },
              ],
              alignment: 'center',
            },
            {
              stack: [
                { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 140, y2: 0, lineWidth: 0.5, lineColor: '#94A3B8' }] },
                { text: "Receiver's Signature", fontSize: 8, bold: true, margin: [0, 4, 0, 0] },
                { text: 'Vendor Acknowledgment', fontSize: 7.5, color: '#64748B' },
              ],
              alignment: 'right',
            },
          ],
        },
      ],
      styles: {
        companyName: { fontSize: 13, bold: true, color: '#0F172A' },
        companySubtitle: { fontSize: 8, color: '#64748B', margin: [0, 2, 0, 0] },
        companyAddress: { fontSize: 7.5, color: '#94A3B8' },
        docBadge: { fontSize: 13, bold: true, color: '#1E3A8A' },
        docBadgeSub: { fontSize: 7.5, bold: true, color: '#64748B', margin: [0, 2, 0, 0] },
        sectionHeader: { fontSize: 10, bold: true, color: '#1E3A8A' },
        tableHeader: { bold: true, color: '#FFFFFF', fontSize: 8.5 },
      },
    };

    const pdfDoc = pdfmake.createPdf(docDefinition);
    return await pdfDoc.getBuffer();
  }

  /**
   * Generates low-RAM PDF for Material Issue Slip (Stores to Production)
   */
  async generateMaterialIssueSlipPdf(issue: any): Promise<Buffer> {
    const items = issue.items || [];
    let totalIssued = 0;

    const tableBody: any[][] = [
      [
        { text: '#', style: 'tableHeader', alignment: 'center' },
        { text: 'Material Code', style: 'tableHeader' },
        { text: 'Description', style: 'tableHeader' },
        { text: 'Required', style: 'tableHeader', alignment: 'right' },
        { text: 'Issued', style: 'tableHeader', alignment: 'right' },
        { text: 'UOM', style: 'tableHeader', alignment: 'center' },
        { text: 'Bin / Lot', style: 'tableHeader', alignment: 'center' },
      ],
    ];

    items.forEach((item: any, index: number) => {
      const issued = Number(item.issuedQuantity || item.quantity || 0);
      const req = Number(item.requiredQuantity || issued);
      totalIssued += issued;

      tableBody.push([
        { text: String(index + 1), alignment: 'center' },
        { text: item.itemCode || item.product?.code || item.material?.code || 'N/A', bold: true },
        { text: item.description || item.product?.name || item.material?.name || '-' },
        { text: req.toLocaleString(), alignment: 'right' },
        { text: issued.toLocaleString(), bold: true, alignment: 'right' },
        { text: item.uom || item.unit || 'KG', alignment: 'center' },
        { text: item.binLocation || item.bin?.code || item.lotNumber || 'STORES-A1', alignment: 'center' },
      ]);
    });

    tableBody.push([
      { text: 'TOTAL ISSUED QUANTITY', colSpan: 4, bold: true, alignment: 'right' },
      {},
      {},
      {},
      { text: totalIssued.toLocaleString(), bold: true, alignment: 'right' },
      {},
      {},
    ]);

    const docDefinition: any = {
      defaultStyle: {
        font: 'Helvetica',
        fontSize: 9,
        color: '#1E293B',
      },
      pageMargins: [40, 40, 40, 40],
      content: [
        {
          columns: [
            {
              width: '*',
              stack: [
                { text: 'V-SMART MANUFACTURING SYSTEMS', style: 'companyName' },
                { text: 'Internal Material Movement & Floor Transfer', style: 'companySubtitle' },
              ],
            },
            {
              width: 'auto',
              stack: [
                { text: 'MATERIAL ISSUE SLIP', style: 'docBadge' },
                { text: issue.issueType || 'STANDARD PRODUCTION ISSUE', style: 'docBadgeSub' },
              ],
              alignment: 'right',
            },
          ],
        },
        { canvas: [{ type: 'line', x1: 0, y1: 10, x2: 515, y2: 10, lineWidth: 1.5, lineColor: '#059669' }] },
        { text: '', margin: [0, 10] },

        // Meta details
        {
          table: {
            widths: ['25%', '25%', '25%', '25%'],
            body: [
              [
                { text: 'Issue Slip Number:', bold: true, fillColor: '#F8FAFC' },
                { text: issue.issueNumber || 'N/A', bold: true, color: '#059669' },
                { text: 'Issue Date:', bold: true, fillColor: '#F8FAFC' },
                { text: issue.issueDate ? new Date(issue.issueDate).toISOString().replace('T', ' ').slice(0, 16) : 'N/A' },
              ],
              [
                { text: 'Sales Component (SC):', bold: true, fillColor: '#F8FAFC' },
                { text: issue.salesOrderComponent?.scNumber || issue.scNumber || 'N/A', bold: true },
                { text: 'Issued By:', bold: true, fillColor: '#F8FAFC' },
                { text: issue.issuedBy?.name || 'Stores Officer' },
              ],
            ],
          },
          layout: {
            hLineWidth: () => 0.5,
            vLineWidth: () => 0.5,
            hLineColor: () => '#CBD5E1',
            vLineColor: () => '#CBD5E1',
          },
        },

        { text: 'ALLOCATED RAW MATERIAL ITEMS', style: 'sectionHeaderGreen', margin: [0, 16, 0, 8] },

        // Table
        {
          table: {
            headerRows: 1,
            widths: ['7%', '20%', '31%', '12%', '12%', '8%', '10%'],
            body: tableBody,
          },
          layout: {
            fillColor: (rowIndex: number) => (rowIndex === 0 ? '#059669' : rowIndex % 2 === 0 ? '#F0FDF4' : null),
            hLineWidth: () => 0.5,
            vLineWidth: () => 0.5,
            hLineColor: () => '#E2E8F0',
            vLineColor: () => '#E2E8F0',
          },
        },

        { text: '', margin: [0, 40] },

        // Signatures
        {
          columns: [
            {
              stack: [
                { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 140, y2: 0, lineWidth: 0.5, lineColor: '#94A3B8' }] },
                { text: 'Issued By (Stores)', fontSize: 8, bold: true, margin: [0, 4, 0, 0] },
                { text: issue.issuedBy?.name || 'Stores Department', fontSize: 7.5, color: '#64748B' },
              ],
            },
            {
              stack: [
                { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 140, y2: 0, lineWidth: 0.5, lineColor: '#94A3B8' }] },
                { text: 'Received By (Production)', fontSize: 8, bold: true, margin: [0, 4, 0, 0] },
                { text: 'Production Supervisor', fontSize: 7.5, color: '#64748B' },
              ],
              alignment: 'center',
            },
            {
              stack: [
                { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 140, y2: 0, lineWidth: 0.5, lineColor: '#94A3B8' }] },
                { text: 'Verified By (Quality Control)', fontSize: 8, bold: true, margin: [0, 4, 0, 0] },
                { text: 'QA / Audit Team', fontSize: 7.5, color: '#64748B' },
              ],
              alignment: 'right',
            },
          ],
        },
      ],
      styles: {
        companyName: { fontSize: 13, bold: true, color: '#0F172A' },
        companySubtitle: { fontSize: 8, color: '#64748B', margin: [0, 2, 0, 0] },
        docBadge: { fontSize: 13, bold: true, color: '#059669' },
        docBadgeSub: { fontSize: 7.5, bold: true, color: '#64748B', margin: [0, 2, 0, 0] },
        sectionHeaderGreen: { fontSize: 10, bold: true, color: '#059669' },
        tableHeader: { bold: true, color: '#FFFFFF', fontSize: 8.5 },
      },
    };

    const pdfDoc = pdfmake.createPdf(docDefinition);
    return await pdfDoc.getBuffer();
  }

  /**
   * Archives PDF directly to Supabase Storage bucket ('rmrit-documents')
   */
  async archivePdf(
    buffer: Buffer,
    documentType: 'challan' | 'issue-slip',
    documentId: string,
    userId = 'SYSTEM',
  ): Promise<{ downloadUrl: string; storageKey: string }> {
    if (!this.filesService) {
      throw new Error('FilesService is not available for PDF cloud archiving.');
    }

    const storageKey = `documents/${documentType}s/${documentId}.pdf`;
    const originalName = `${documentType}_${documentId}.pdf`;

    await this.filesService.uploadRawBuffer(
      buffer,
      storageKey,
      'application/pdf',
      userId,
      originalName,
    );

    const downloadUrl = await this.filesService.getDownloadUrlByKey(storageKey);
    return { downloadUrl, storageKey };
  }
}
