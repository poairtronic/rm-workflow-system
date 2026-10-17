import { useState, useRef, useEffect } from 'react';
import {
  Printer,
  FileSpreadsheet,
  FileText,
  ChevronDown,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import {
  exportToExcel,
  exportToCsv,
  printReport,
  type ExportColumn,
} from '../../utils/exportUtils';

export interface ExportDropdownProps<T> {
  data: T[];
  columns: ExportColumn<T>[];
  fileName: string;
  reportTitle: string;
  reportSubtitle?: string;
  metadata?: Record<string, string | number>;
  orientation?: 'landscape' | 'portrait';
  variant?: 'toolbar' | 'button';
  size?: 'sm' | 'md';
  disabled?: boolean;
  className?: string;
  buttonLabel?: string;
}

export function ExportDropdown<T>({
  data,
  columns,
  fileName,
  reportTitle,
  reportSubtitle,
  metadata,
  orientation = 'landscape',
  variant = 'toolbar',
  disabled = false,
  className = '',
  buttonLabel = 'Export / Print',
}: ExportDropdownProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleExportExcel = () => {
    setIsOpen(false);
    if (!data || data.length === 0) {
      toast.error('No records available to export.');
      return;
    }
    try {
      toast.loading('Generating Excel spreadsheet...', { id: 'export-xlsx' });
      exportToExcel({
        data,
        columns,
        fileName,
        sheetName: reportTitle.slice(0, 31),
      });
      toast.success(`Exported ${data.length} records to Excel!`, { id: 'export-xlsx' });
    } catch (err: any) {
      toast.error(err.message || 'Failed to export Excel file.', { id: 'export-xlsx' });
    }
  };

  const handleExportCsv = () => {
    setIsOpen(false);
    if (!data || data.length === 0) {
      toast.error('No records available to export.');
      return;
    }
    try {
      toast.loading('Generating CSV file...', { id: 'export-csv' });
      exportToCsv({
        data,
        columns,
        fileName,
      });
      toast.success(`Exported ${data.length} records to CSV!`, { id: 'export-csv' });
    } catch (err: any) {
      toast.error(err.message || 'Failed to export CSV file.', { id: 'export-csv' });
    }
  };

  const handlePrint = () => {
    setIsOpen(false);
    if (!data || data.length === 0) {
      toast.error('No records available to print.');
      return;
    }
    try {
      toast.loading('Preparing print preview...', { id: 'print-report' });
      printReport({
        title: reportTitle,
        subtitle: reportSubtitle,
        columns,
        data,
        metadata,
        orientation,
      });
      setTimeout(() => {
        toast.dismiss('print-report');
      }, 1000);
    } catch (err: any) {
      toast.error(err.message || 'Failed to open print preview.', { id: 'print-report' });
    }
  };

  const baseButtonClasses =
    variant === 'toolbar'
      ? 'h-10 px-3 flex items-center gap-1.5 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold transition-colors shadow-2xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed'
      : 'inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-medium shadow-sm transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';

  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        disabled={disabled}
        className={`${baseButtonClasses}`}
        title="Export to Excel or Print as PDF"
      >
        <Printer className="w-3.5 h-3.5 text-slate-600" />
        <span>{buttonLabel}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1.5 w-56 rounded-xl bg-white shadow-xl ring-1 ring-slate-900/10 z-50 py-1.5 focus:outline-none divide-y divide-slate-100 animate-in fade-in zoom-in-95 duration-100">
          <div className="px-3 py-1.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Print & Export Options
            </p>
            <p className="text-[11px] text-slate-500 truncate">
              {data.length} record{data.length === 1 ? '' : 's'} selected
            </p>
          </div>

          <div className="py-1">
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center w-full px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition-colors text-left group"
            >
              <div className="w-6 h-6 rounded-md bg-blue-50 border border-blue-100 flex items-center justify-center mr-2.5 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <Printer className="w-3.5 h-3.5" />
              </div>
              <div>
                <div className="font-semibold text-slate-900 group-hover:text-blue-700">Print / Save as PDF</div>
                <div className="text-[10px] text-slate-400">Formatted print layout</div>
              </div>
            </button>

            <button
              type="button"
              onClick={handleExportExcel}
              className="flex items-center w-full px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 transition-colors text-left group"
            >
              <div className="w-6 h-6 rounded-md bg-emerald-50 border border-emerald-100 flex items-center justify-center mr-2.5 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                <FileSpreadsheet className="w-3.5 h-3.5" />
              </div>
              <div>
                <div className="font-semibold text-slate-900 group-hover:text-emerald-700">Export to Excel (.xlsx)</div>
                <div className="text-[10px] text-slate-400">Auto-formatted workbook</div>
              </div>
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              className="flex items-center w-full px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors text-left group"
            >
              <div className="w-6 h-6 rounded-md bg-slate-100 border border-slate-200 flex items-center justify-center mr-2.5 text-slate-600 group-hover:bg-slate-600 group-hover:text-white transition-colors">
                <FileText className="w-3.5 h-3.5" />
              </div>
              <div>
                <div className="font-semibold text-slate-900">Export to CSV (.csv)</div>
                <div className="text-[10px] text-slate-400">Standard raw data file</div>
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
