import { useState } from 'react';
import { FileText, Download, Calendar, FileSpreadsheet } from 'lucide-react';
import { api, reportApi } from '../services/api';

export function ReportGeneratorWorkspace() {
  const [format, setFormat] = useState<'csv' | 'excel'>('excel');
  const [reportType, setReportType] = useState('traceability');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  const handleExport = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const dateStamp = new Date().toISOString().split('T')[0];

    try {
      if (format === 'excel') {
        let blob: Blob;
        let filename: string;

        if (reportType === 'traceability') {
          blob = await reportApi.exportTraceabilityExcel();
          filename = `SC_PO_Traceability_${dateStamp}.xlsx`;
        } else if (reportType === 'stock-movement') {
          blob = await reportApi.exportStockMovementExcel();
          filename = `Stock_Movement_${dateStamp}.xlsx`;
        } else if (reportType === 'vendor-sla') {
          blob = await reportApi.exportVendorSlaExcel();
          filename = `Vendor_SLA_Tracker_${dateStamp}.xlsx`;
        } else {
          throw new Error('Unsupported Excel report type');
        }

        downloadBlob(blob, filename);
      } else {
        // Raw CSV Export
        const response = await api.get<any[]>(`/api/reports/${reportType}`);
        
        if (!Array.isArray(response) || response.length === 0) {
          setError('No data found for this report type.');
          setLoading(false);
          return;
        }

        // Convert JSON array to CSV string
        const headers = Object.keys(response[0]).join(',');
        const rows = response.map((row: any) => 
          Object.values(row).map(val => `"${val}"`).join(',')
        );
        const csvContent = [headers, ...rows].join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        downloadBlob(blob, `${reportType}_export_${dateStamp}.csv`);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to generate report. You might lack permissions.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-[800px] mx-auto w-full pb-24 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
          <FileText className="w-6 h-6 text-primary" />
          Enterprise Report Generator
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Configure and export executive multi-tab Excel workbooks or raw CSV data extracts for audit, finance, and operational reviews.
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
          <h2 className="text-[15px] font-semibold text-slate-900 uppercase tracking-wide">
            Report Parameters
          </h2>
        </div>
        
        <form onSubmit={handleExport} className="p-6">
          <div className="space-y-6">
            
            {/* Export Format Selector */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Export Format</label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => {
                    setFormat('excel');
                    if (!['traceability', 'stock-movement', 'vendor-sla'].includes(reportType)) {
                      setReportType('traceability');
                    }
                  }}
                  className={`flex items-center justify-center gap-2 h-11 rounded-lg border text-sm font-semibold transition-all ${
                    format === 'excel'
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-800 shadow-sm ring-1 ring-emerald-600'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  Executive Multi-Tab Excel (.xlsx)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFormat('csv');
                    if (!['process-wise', 'item-wise', 'rm-consumption'].includes(reportType)) {
                      setReportType('process-wise');
                    }
                  }}
                  className={`flex items-center justify-center gap-2 h-11 rounded-lg border text-sm font-semibold transition-all ${
                    format === 'csv'
                      ? 'border-primary bg-primary/5 text-primary shadow-sm ring-1 ring-primary'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Download className="w-4 h-4 text-primary" />
                  Raw CSV Table (.csv)
                </button>
              </div>
            </div>

            {/* Report Type */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Report Type</label>
              <select 
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-white shadow-sm"
              >
                {format === 'excel' ? (
                  <>
                    <option value="traceability">SC & PO Traceability (3 Tabs: SC Summary, RM Requirements, Consumption Audit)</option>
                    <option value="stock-movement">Stock Movement & Balances (2 Tabs: Current Balances, Ledger)</option>
                    <option value="vendor-sla">Vendor SLA & Outward DC Tracker (2 Tabs: Active DCs, SLA Breaches)</option>
                  </>
                ) : (
                  <>
                    <option value="process-wise">Process-wise Summary (Raw CSV)</option>
                    <option value="item-wise">Item-wise Ledger (Raw CSV)</option>
                    <option value="rm-consumption">RM Consumption Analysis (Raw CSV)</option>
                  </>
                )}
              </select>
            </div>

            {/* Date Range */}
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Start Date (Optional)</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full h-10 pl-10 pr-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-white shadow-sm"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">End Date (Optional)</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    min={startDate}
                    className="w-full h-10 pl-10 pr-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-white shadow-sm"
                  />
                </div>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm border border-red-200">
                {error}
              </div>
            )}
            
            <div className="pt-4 border-t border-slate-100 flex items-center justify-end">
              <button 
                type="submit"
                disabled={loading}
                className={`inline-flex items-center gap-2 px-6 h-10 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm disabled:opacity-50 ${
                  format === 'excel' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-primary hover:bg-primary-dark'
                }`}
              >
                <Download className="w-4 h-4" />
                {loading ? 'Generating...' : format === 'excel' ? 'Generate & Export Excel' : 'Generate & Export CSV'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
