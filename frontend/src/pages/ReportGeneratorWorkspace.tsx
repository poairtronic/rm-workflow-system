import { useState } from 'react';
import { FileText, Download, Calendar } from 'lucide-react';
import { reportApi } from '../services/api';

export function ReportGeneratorWorkspace() {
  const [reportType, setReportType] = useState('process_summary');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleExport = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    try {
      const response = await reportApi.exportReport(reportType, startDate, endDate);
      
      // Handle file download
      const url = window.URL.createObjectURL(response);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${reportType}_${startDate}_to_${endDate}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to generate report. Please try again.');
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
                <option value="process_summary">Process-wise Summary</option>
                <option value="item_ledger">Item-wise Ledger</option>
                <option value="rm_consumption">RM Consumption Analysis</option>
              </select>
            </div>

            {/* Date Range */}
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Start Date</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full h-10 pl-10 pr-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-white shadow-sm"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">End Date</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    type="date"
                    required
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
            
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-sm font-medium text-amber-600 bg-amber-50 px-3 py-1 rounded-md border border-amber-200">
                Reporting module coming soon
              </span>
              <button 
                type="button"
                disabled={true}
                className="inline-flex items-center gap-2 px-6 h-10 bg-slate-200 text-slate-400 text-sm font-semibold rounded-lg cursor-not-allowed shadow-none"
              >
                <Download className="w-4 h-4" />
                Generate & Export
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
