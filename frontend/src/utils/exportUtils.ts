import * as XLSX from 'xlsx';

export interface ExportColumn<T> {
  header: string;
  key?: keyof T;
  accessor?: (item: T) => string | number | null | undefined;
  isNumeric?: boolean;
}

/**
 * Cleanly extracts a cell value for an item using accessor or key
 */
function getCellValue<T>(item: T, col: ExportColumn<T>): string | number {
  if (col.accessor) {
    const val = col.accessor(item);
    return val ?? '';
  }
  if (col.key && item[col.key] !== undefined && item[col.key] !== null) {
    const val = item[col.key];
    if (typeof val === 'object') {
      return JSON.stringify(val);
    }
    return val as any;
  }
  return '';
}

/**
 * Exports data to an Excel (.xlsx) file
 */
export function exportToExcel<T>({
  data,
  columns,
  fileName = 'v_smart_export',
  sheetName = 'Sheet1',
}: {
  data: T[];
  columns: ExportColumn<T>[];
  fileName?: string;
  sheetName?: string;
}) {
  if (!data || data.length === 0) {
    throw new Error('No data available to export.');
  }

  // Build row objects for XLSX
  const rows = data.map((item) => {
    const row: Record<string, string | number> = {};
    columns.forEach((col) => {
      row[col.header] = getCellValue(item, col);
    });
    return row;
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);

  // Auto-fit column widths
  const colWidths = columns.map((col) => {
    let maxLen = col.header.length;
    data.slice(0, 100).forEach((item) => {
      const val = String(getCellValue(item, col) ?? '');
      if (val.length > maxLen) {
        maxLen = val.length;
      }
    });
    return { wch: Math.min(Math.max(maxLen + 3, 12), 40) };
  });
  worksheet['!cols'] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31));

  const safeFileName = fileName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const dateStamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `${safeFileName}_${dateStamp}.xlsx`);
}

/**
 * Exports data to a CSV file
 */
export function exportToCsv<T>({
  data,
  columns,
  fileName = 'v_smart_export',
}: {
  data: T[];
  columns: ExportColumn<T>[];
  fileName?: string;
}) {
  if (!data || data.length === 0) {
    throw new Error('No data available to export.');
  }

  const escapeCsv = (val: string | number) => {
    const str = String(val ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const headers = columns.map((c) => escapeCsv(c.header)).join(',');
  const rows = data.map((item) =>
    columns.map((c) => escapeCsv(getCellValue(item, c))).join(',')
  );

  const csvContent = '\uFEFF' + [headers, ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const safeFileName = fileName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const dateStamp = new Date().toISOString().slice(0, 10);
  link.download = `${safeFileName}_${dateStamp}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Triggers a dedicated printable report layout that can be printed or saved directly as PDF
 */
export function printReport<T>({
  title,
  subtitle,
  columns,
  data,
  metadata,
  orientation = 'landscape',
}: {
  title: string;
  subtitle?: string;
  columns: ExportColumn<T>[];
  data: T[];
  metadata?: Record<string, string | number>;
  orientation?: 'landscape' | 'portrait';
}) {
  if (!data || data.length === 0) {
    throw new Error('No data available to print.');
  }

  const dateStr = new Date().toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const metaHtml = metadata
    ? `
    <div class="meta-tags">
      ${Object.entries(metadata)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(
          ([k, v]) => `
          <div class="meta-tag">
            <span class="meta-label">${k}:</span>
            <span class="meta-value">${v}</span>
          </div>`
        )
        .join('')}
    </div>`
    : '';

  const tableHeaders = columns
    .map(
      (c) => `<th class="${c.isNumeric ? 'text-right' : 'text-left'}">${c.header}</th>`
    )
    .join('');

  const tableRows = data
    .map((item) => {
      const cells = columns
        .map((col) => {
          const val = getCellValue(item, col);
          const displayVal = val !== '' && val !== null && val !== undefined ? String(val) : '—';
          return `<td class="${col.isNumeric ? 'text-right' : 'text-left'}">${displayVal}</td>`;
        })
        .join('');
      return `<tr>${cells}</tr>`;
    })
    .join('');

  const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title} — V-SMART Report</title>
    <style>
      @page {
        size: ${orientation};
        margin: 10mm 8mm;
      }
      * {
        box-sizing: border-box;
      }
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        color: #0f172a;
        margin: 0;
        padding: 16px;
        background: #ffffff;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .no-print {
        display: flex;
        align-items: center;
        justify-content: space-between;
        background: #1e293b;
        color: #ffffff;
        padding: 10px 16px;
        border-radius: 8px;
        margin-bottom: 16px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      }
      .no-print button {
        border: none;
        padding: 8px 16px;
        border-radius: 6px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        transition: opacity 0.2s;
      }
      .btn-print {
        background: #2563eb;
        color: white;
      }
      .btn-print:hover {
        background: #1d4ed8;
      }
      .btn-close {
        background: #475569;
        color: white;
        margin-left: 8px;
      }
      .btn-close:hover {
        background: #334155;
      }
      .report-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        border-bottom: 2px solid #2563eb;
        padding-bottom: 10px;
        margin-bottom: 12px;
      }
      .brand-title {
        font-size: 16px;
        font-weight: 800;
        color: #1e3a8a;
        letter-spacing: -0.01em;
        margin: 0 0 4px 0;
        text-transform: uppercase;
      }
      .report-title {
        font-size: 15px;
        font-weight: 700;
        color: #0f172a;
        margin: 0 0 2px 0;
      }
      .report-subtitle {
        font-size: 11.5px;
        color: #64748b;
        margin: 0;
      }
      .meta-box {
        text-align: right;
        font-size: 11px;
        color: #64748b;
        line-height: 1.45;
      }
      .meta-box strong {
        color: #0f172a;
      }
      .meta-tags {
        display: flex;
        flex-wrap: wrap;
        gap: 12px 20px;
        padding: 8px 12px;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        margin-bottom: 12px;
        font-size: 11px;
      }
      .meta-label {
        color: #64748b;
        font-weight: 500;
      }
      .meta-value {
        color: #0f172a;
        font-weight: 700;
        margin-left: 4px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 4px;
      }
      thead {
        display: table-header-group;
      }
      tbody {
        display: table-row-group;
      }
      tr {
        page-break-inside: auto;
        break-inside: auto;
      }
      tr:nth-child(even) {
        background: #f8fafc;
      }
      th {
        border: 1px solid #cbd5e1;
        padding: 6px 8px;
        background: #f1f5f9;
        color: #1e293b;
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        white-space: nowrap;
      }
      td {
        border: 1px solid #e2e8f0;
        padding: 5px 8px;
        font-size: 10.5px;
        color: #334155;
        font-variant-numeric: tabular-nums;
      }
      .text-right {
        text-align: right;
      }
      .text-left {
        text-align: left;
      }
      .footer-note {
        margin-top: 14px;
        padding-top: 8px;
        border-top: 1px solid #e2e8f0;
        display: flex;
        justify-content: space-between;
        font-size: 10px;
        color: #94a3b8;
      }
      @media print {
        .no-print {
          display: none !important;
        }
        body {
          padding: 0;
          background: #ffffff;
        }
        tr {
          page-break-inside: auto !important;
          break-inside: auto !important;
        }
      }
    </style>
    <script>
      function doPrint() {
        try {
          window.focus();
          window.print();
        } catch (e) {
          console.error('Print trigger error:', e);
        }
      }
      // Safe delayed trigger after document render
      window.addEventListener('load', function() {
        setTimeout(function() {
          try {
            window.focus();
            window.print();
          } catch (e) {
            console.warn('Auto print deferred to manual button:', e);
          }
        }, 350);
      });
    </script>
  </head>
  <body>
    <div class="no-print">
      <div>
        <strong>Print Preview / Export</strong> — ${data.length} records ready to print or save as PDF.
      </div>
      <div>
        <button class="btn-print" onclick="doPrint()">🖨️ Print / Save as PDF</button>
        <button class="btn-close" onclick="window.close()">✕ Close</button>
      </div>
    </div>

    <div class="report-header">
      <div>
        <div class="brand-title">V-SMART Material Governance</div>
        <h1 class="report-title">${title}</h1>
        ${subtitle ? `<p class="report-subtitle">${subtitle}</p>` : ''}
      </div>
      <div class="meta-box">
        <div>Generated: <strong>${dateStr}</strong></div>
        <div>Total Records: <strong>${data.length}</strong></div>
        <div>Status: <strong>Official System Ledger</strong></div>
      </div>
    </div>

    ${metaHtml}

    <table>
      <thead>
        <tr>${tableHeaders}</tr>
      </thead>
      <tbody>
        ${tableRows}
      </tbody>
    </table>

    <div class="footer-note">
      <span>Generated via V-SMART Material Governance System</span>
      <span>Confidential — Internal Company Use Only</span>
    </div>
  </body>
</html>`;

  // Standard same-origin window ensures Edge, Chrome, Safari & Firefox render smoothly without freezing
  let printWindow: Window | null = null;
  try {
    printWindow = window.open('', '_blank');
  } catch (e) {
    console.warn('window.open prevented by browser:', e);
  }

  if (printWindow && printWindow.document) {
    try {
      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();
      return;
    } catch (e) {
      console.warn('Direct document write error, falling back to off-screen frame:', e);
    }
  }

  // Fallback if popup blockers prevented window.open: Use off-screen iframe (NOT opacity:0 which hangs Edge)
  const existingFrame = document.getElementById('vsmart-print-frame');
  if (existingFrame) existingFrame.remove();

  const iframe = document.createElement('iframe');
  iframe.id = 'vsmart-print-frame';
  iframe.style.position = 'absolute';
  iframe.style.top = '-99999px';
  iframe.style.left = '-99999px';
  iframe.style.width = '1024px';
  iframe.style.height = '768px';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document || iframe.contentDocument;
  if (doc) {
    doc.open();
    // Remove inline auto-print script from iframe to avoid competing dual print calls
    const cleanHtml = html.replace(/window\.addEventListener\('load'[\s\S]*?\}\);/g, '');
    doc.write(cleanHtml);
    doc.close();

    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (e) {
        console.error('Iframe print error:', e);
      } finally {
        setTimeout(() => {
          iframe.remove();
        }, 2000);
      }
    }, 450);
  }
}
