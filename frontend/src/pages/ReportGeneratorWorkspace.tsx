import { useState } from 'react';
import { FileText, Download, Calendar } from 'lucide-react';
import { api } from '../services/api';

export function ReportGeneratorWorkspace() {
  const [reportType, setReportType] = useState('process-wise');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleExport = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    
    try {
      // In this Phase 8.2 implementation, the backend returns raw JSON.
      // We are ignoring dates for now since the backend endpoints get all data.
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
      
      // Handle file download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${reportType}_export.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to generate report. You might lack permissions.');
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
          Configure and export comprehensive data extracts for audit, finance, and operational reviews.
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
            
            {/* Report Type */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Report Type</label>
              <select 
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-white shadow-sm"
              >
                <option value="process-wise">Process-wise Summary</option>
                <option value="item-wise">Item-wise Ledger</option>
                <option value="rm-consumption">RM Consumption Analysis</option>
              </select>
            </div>

            {/* Date Range (visual only for now, can be wired up backend later if needed) */}
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
                className="inline-flex items-center gap-2 px-6 h-10 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary-dark transition-colors shadow-sm disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                {loading ? 'Generating...' : 'Generate & Export CSV'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
