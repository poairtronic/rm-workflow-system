import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { auditLogsApi } from '../services/api';
import { PageHeader } from '../components/ui';
import {
  Search,
  Download,
  RefreshCw,
  Clock,
  User,
  X,
  ChevronLeft,
  ChevronRight,
  Database,
} from 'lucide-react';

export function AuditLogsWorkspace() {
  const [logs, setLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [module, setModule] = useState('ALL');
  const [action, setAction] = useState('ALL');
  const [page, setPage] = useState(1);
  const limit = 20;

  // Detail Modal
  const [selectedLog, setSelectedLog] = useState<any | null>(null);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const res = await auditLogsApi.getLogs({
        search: search.trim() || undefined,
        module: module !== 'ALL' ? module : undefined,
        action: action !== 'ALL' ? action : undefined,
        limit,
        offset: (page - 1) * limit,
      });

      setLogs(res.logs || []);
      setTotal(res.total || 0);
    } catch {
      toast.error('Failed to load audit logs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page, module, action]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchLogs();
  };

  const handleExportCsv = async () => {
    try {
      toast.loading('Generating CSV export...', { id: 'csv-export' });
      const blob = await auditLogsApi.exportCsv({
        search: search.trim() || undefined,
        module: module !== 'ALL' ? module : undefined,
        action: action !== 'ALL' ? action : undefined,
      });

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `v_smart_audit_logs_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success('Audit logs CSV exported!', { id: 'csv-export' });
    } catch {
      toast.error('Failed to export CSV.', { id: 'csv-export' });
    }
  };

  const formatTimestamp = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }) + ', ' + d.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      }).toLowerCase();
    } catch {
      return dateStr;
    }
  };

  const getActionBadge = (act: string) => {
    const a = (act || '').toUpperCase();
    switch (a) {
      case 'CREATE':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'UPDATE':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'DELETE':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'ISSUE':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'RETURN':
      case 'VERIFY':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'DELIVER':
        return 'bg-sky-50 text-sky-700 border-sky-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <div className="space-y-6 w-full pb-16">
      <PageHeader
        title="Audit Logs"
        subtitle="Comprehensive system event tracking for compliance, security, and traceability."
        breadcrumbs={<span>Home / System Settings / Audit Logs</span>}
        actionSlot={
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={fetchLogs}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 transition shadow-sm cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              className="flex items-center gap-2 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition shadow-sm cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>
          </div>
        }
      />

        {/* Filter and Search Bar */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm flex flex-wrap items-center gap-3">
          <form onSubmit={handleSearchSubmit} className="flex-1 min-w-[240px] relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search audit logs..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
            />
          </form>

          {/* Module Filter */}
          <select
            value={module}
            onChange={(e) => {
              setModule(e.target.value);
              setPage(1);
            }}
            className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500/20"
          >
            <option value="ALL">All Modules</option>
            <option value="DeliveryChallan">Delivery Challan (DC)</option>
            <option value="RMRequisition">RM Requisitions</option>
            <option value="InventoryStock">Stores &amp; Stock</option>
            <option value="ApplicationSetting">System Configuration</option>
            <option value="User">User Management</option>
            <option value="NOTIFICATIONS">Notifications</option>
          </select>

          {/* Action Filter */}
          <select
            value={action}
            onChange={(e) => {
              setAction(e.target.value);
              setPage(1);
            }}
            className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500/20"
          >
            <option value="ALL">All Actions</option>
            <option value="CREATE">CREATE</option>
            <option value="UPDATE">UPDATE</option>
            <option value="DELETE">DELETE</option>
            <option value="ISSUE">ISSUE</option>
            <option value="RETURN">RETURN</option>
            <option value="VERIFY">VERIFY</option>
            <option value="DELIVER">DELIVER</option>
          </select>

          <button
            type="button"
            onClick={() => {
              setPage(1);
              fetchLogs();
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-colors border border-slate-200 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Audit Logs Table - Matches Screenshot 5 */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Timestamp ↓</th>
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Module</th>
                  <th className="py-3 px-4">Record</th>
                  <th className="py-3 px-4">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading && logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-purple-600" />
                      Loading audit records...
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      <Database className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      No matching audit logs found.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr
                      key={log.id}
                      onClick={() => setSelectedLog(log)}
                      className="hover:bg-slate-50/70 transition-colors cursor-pointer group"
                    >
                      <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap text-xs">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>{formatTimestamp(log.timestamp)}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-semibold text-slate-800 text-xs">
                            {log.user?.name || 'System Admin'}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            ({log.user?.department ? log.user.department.substring(0, 8) : 'ADM'})
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-md text-[10px] font-bold border ${getActionBadge(
                            log.actionType,
                          )}`}
                        >
                          {log.actionType}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="text-xs font-semibold text-slate-700">
                          {log.entityName}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap font-mono text-xs text-slate-500">
                        {log.entityId ? (
                          <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-600 font-mono">
                            {log.entityId.length > 18 ? log.entityId.substring(0, 16) + '...' : log.entityId}
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap text-xs text-slate-400 font-mono">
                        {log.ipAddress || '127.0.0.1'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">
              Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} records
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-white disabled:opacity-40 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-semibold text-slate-700 px-2">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-white disabled:opacity-40 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

      {/* Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Audit Event Details
                </h3>
                <span className="text-xs text-slate-500 font-mono">
                  Log ID: {selectedLog.id}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl">
                <div>
                  <span className="text-slate-400 block font-semibold">Entity / Module</span>
                  <span className="text-slate-800 font-bold text-sm">{selectedLog.entityName}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-semibold">Action Type</span>
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold border ${getActionBadge(selectedLog.actionType)}`}>
                    {selectedLog.actionType}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-semibold">Record ID / Ref</span>
                  <span className="text-slate-800 font-mono">{selectedLog.entityId}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-semibold">Actor / User</span>
                  <span className="text-slate-800 font-medium">{selectedLog.user?.name} ({selectedLog.user?.email})</span>
                </div>
              </div>

              {selectedLog.oldValues && Object.keys(selectedLog.oldValues).length > 0 && (
                <div>
                  <span className="font-bold text-slate-600 block mb-1">Previous Values (Before Action)</span>
                  <pre className="p-3 bg-rose-50/50 border border-rose-100 rounded-xl text-rose-800 overflow-x-auto text-[11px] font-mono">
                    {JSON.stringify(selectedLog.oldValues, null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.newValues && Object.keys(selectedLog.newValues).length > 0 && (
                <div>
                  <span className="font-bold text-slate-600 block mb-1">New Values (Recorded State)</span>
                  <pre className="p-3 bg-emerald-50/50 border border-emerald-100 rounded-xl text-emerald-800 overflow-x-auto text-[11px] font-mono">
                    {JSON.stringify(selectedLog.newValues, null, 2)}
                  </pre>
                </div>
              )}

              <div>
                <span className="font-bold text-slate-600 block mb-1">System Metadata</span>
                <pre className="p-3 bg-slate-100 rounded-xl text-slate-700 overflow-x-auto text-[11px] font-mono">
                  {JSON.stringify(selectedLog.metadata, null, 2)}
                </pre>
              </div>
            </div>

            <div className="mt-6 pt-3 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold text-xs transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
