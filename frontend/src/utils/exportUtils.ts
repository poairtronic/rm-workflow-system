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

  // Create iframe for reliable printing without popup blocking
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    throw new Error('Unable to initialize print preview.');
  }

  const metaHtml = metadata
    ? `
    <div style="display: flex; flex-wrap: wrap; gap: 16px 24px; padding: 10px 14px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; margin-bottom: 16px; font-size: 11px;">
      ${Object.entries(metadata)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(
          ([k, v]) => `
          <div>
            <span style="color: #64748b; font-weight: 500;">${k}:</span>
            <span style="color: #0f172a; font-weight: 700; margin-left: 4px;">${v}</span>
          </div>`
        )
        .join('')}
    </div>`
    : '';

  const tableHeaders = columns
    .map(
      (c) => `
      <th style="
        border: 1px solid #cbd5e1;
        padding: 7px 10px;
        background: #f1f5f9;
        color: #1e293b;
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        text-align: ${c.isNumeric ? 'right' : 'left'};
        white-space: nowrap;
      ">
        ${c.header}
      </th>`
    )
    .join('');

  const tableRows = data
    .map((item, idx) => {
      const bg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
      const cells = columns
        .map((col) => {
          const val = getCellValue(item, col);
          const displayVal = val !== '' && val !== null && val !== undefined ? String(val) : '—';
          return `
            <td style="
              border: 1px solid #e2e8f0;
              padding: 6px 10px;
              font-size: 11px;
              color: #334155;
              text-align: ${col.isNumeric ? 'right' : 'left'};
              font-variant-numeric: tabular-nums;
            ">
              ${displayVal}
            </td>`;
        })
        .join('');
      return `<tr style="background: ${bg}; page-break-inside: avoid;">${cells}</tr>`;
    })
    .join('');

  const dateStr = new Date().toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${title}</title>
        <style>
          @page {
            size: ${orientation};
            margin: 12mm 10mm;
          }
          * {
            box-sizing: border-box;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            color: #0f172a;
            margin: 0;
            padding: 12px;
            background: #ffffff;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .report-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #2563eb;
            padding-bottom: 12px;
            margin-bottom: 14px;
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
            font-size: 14px;
            font-weight: 700;
            color: #0f172a;
            margin: 0 0 2px 0;
          }
          .report-subtitle {
            font-size: 11px;
            color: #64748b;
            margin: 0;
          }
          .meta-box {
            text-align: right;
            font-size: 10.5px;
            color: #64748b;
            line-height: 1.4;
          }
          .meta-box strong {
            color: #0f172a;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 6px;
          }
          thead {
            display: table-header-group;
          }
          tbody {
            display: table-row-group;
          }
          tr {
            page-break-inside: avoid;
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
        </style>
      </head>
      <body>
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
    </html>
  `;

  doc.open();
  doc.write(html);
  doc.close();

  setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    // Cleanup after print dialog closes
    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 2000);
  }, 300);
}
