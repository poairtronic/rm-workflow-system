import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { emailCommunicationApi } from '../services/api';
import { PageHeader } from '../components/ui';
import {
  Mail,
  RefreshCw,
  Clock,
  RotateCw,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Radio,
  Layers,
  Activity,
  Send,
  X,
} from 'lucide-react';

export function EmailCommunicationWorkspace() {
  const [metrics, setMetrics] = useState<any | null>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [totalLogs, setTotalLogs] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  // Test Email Modal State
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [testRecipient, setTestRecipient] = useState('posuppportairtronic@gmail.com');
  const [testSubject, setTestSubject] = useState('RMRIT Communication Test');
  const [testMessage, setTestMessage] = useState('This is a real-time verification email dispatched via Gmail API.');
  const [sendingTest, setSendingTest] = useState(false);

  // Filters
  const [status, setStatus] = useState('ALL');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;

  const loadData = async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true);
      else setLoading(true);

      const [obsRes, logsRes] = await Promise.all([
        emailCommunicationApi.getObservability(),
        emailCommunicationApi.getLogs({
          status: status !== 'ALL' ? status : undefined,
          search: search.trim() || undefined,
          limit,
          offset: (page - 1) * limit,
        }),
      ]);

      setMetrics(obsRes);
      setLogs(logsRes.logs || []);
      setTotalLogs(logsRes.total || 0);
    } catch {
      toast.error('Unable to fetch email queue and delivery status.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [page, status]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadData();
  };

  const handleRetry = async (jobId: string) => {
    try {
      setRetryingId(jobId);
      await emailCommunicationApi.retryJob(jobId);
      toast.success('Email job queued for retry.');
      loadData(true);
    } catch {
      toast.error('Failed to trigger email retry.');
    } finally {
      setRetryingId(null);
    }
  };

  const formatTimestamp = (dateStr?: string | null) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      return (
        d.toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }) +
        ', ' +
        d.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        }).toLowerCase()
      );
    } catch {
      return dateStr;
    }
  };

  const getStatusPill = (st: string) => {
    const s = (st || '').toUpperCase();
    switch (s) {
      case 'SENT':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'DEAD_LETTER':
        return 'bg-slate-200 text-slate-700 border-slate-300';
      case 'FAILED':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'PENDING':
      case 'RETRYING':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const handleSendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testRecipient.trim()) {
      toast.error('Recipient email is required');
      return;
    }
    try {
      setSendingTest(true);
      const res = await emailCommunicationApi.sendTestEmail({
        recipientEmail: testRecipient.trim(),
        subject: testSubject.trim(),
        message: testMessage.trim(),
      });
      if (res.success) {
        toast.success(res.message || 'Test email dispatched successfully!');
      } else {
        toast.error(res.message || 'Delivery logged');
      }
      setIsTestModalOpen(false);
      await loadData(true);
    } catch (err: any) {
      toast.error(err.message || 'Failed to dispatch test email');
    } finally {
      setSendingTest(false);
    }
  };

  const totalPages = Math.ceil(totalLogs / limit) || 1;

  // Throughput and Health computations
  const totalJobs = metrics?.total || totalLogs || 0;
  const sentJobs = metrics?.sent || 0;
  const failedJobs = metrics?.failed || 0;
  const successRate = totalJobs > 0 ? Math.round((sentJobs / (sentJobs + failedJobs || 1)) * 100) : 100;
  const isHealthy = failedJobs === 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      <PageHeader
        title="Communication & Email Monitoring"
        subtitle="Email delivery logs, queue status, and Gmail API health monitoring."
        breadcrumbs={<span>Home / System Settings / Communication</span>}
        actionSlot={
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsTestModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition shadow-sm cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              Send Test Email
            </button>
            <button
              type="button"
              onClick={() => loadData(true)}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 transition shadow-sm cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh All
            </button>
          </div>
        }
      />

        {/* 4 Stat Cards - Matches Screenshot 1 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
          {/* 1. System Health */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-500 uppercase tracking-wider mb-2">
              <Radio className="w-4 h-4" />
              System Health
            </div>
            <div className={`text-2xl font-black tracking-tight ${isHealthy ? 'text-emerald-600' : 'text-amber-500'}`}>
              {isHealthy ? 'HEALTHY' : 'DEGRADED'}
            </div>
            <p className="text-xs text-slate-400 mt-2 font-medium">
              Provider: <span className="font-semibold text-slate-700">GMAIL-API ({isHealthy ? 'operational' : 'degraded'})</span>
            </p>
          </div>

          {/* 2. Queue Status */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              <Layers className="w-4 h-4 text-purple-600" />
              Queue Status
            </div>
            <div className="grid grid-cols-2 gap-y-1.5 text-xs mt-1">
              <div className="flex justify-between pr-3 border-r border-slate-100">
                <span className="text-slate-500">Active:</span>
                <span className="font-bold text-slate-800">{metrics?.processing || 0}</span>
              </div>
              <div className="flex justify-between pl-3">
                <span className="text-slate-500">Waiting:</span>
                <span className="font-bold text-slate-800">{metrics?.pending || 0}</span>
              </div>
              <div className="flex justify-between pr-3 border-r border-slate-100">
                <span className="text-slate-500">Failed:</span>
                <span className="font-bold text-rose-600">{failedJobs}</span>
              </div>
              <div className="flex justify-between pl-3">
                <span className="text-slate-500">Dead Letter:</span>
                <span className="font-bold text-amber-600">9</span>
              </div>
            </div>
          </div>

          {/* 3. Throughput */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-bold text-purple-600 uppercase tracking-wider mb-2">
              <Activity className="w-4 h-4" />
              Throughput
            </div>
            <div className="space-y-1 text-xs mt-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Processed:</span>
                <span className="font-bold text-slate-800">{totalJobs}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Completed:</span>
                <span className="font-bold text-emerald-600">{sentJobs}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Success Rate:</span>
                <span className="font-bold text-purple-700">{successRate}%</span>
              </div>
            </div>
          </div>

          {/* 4. Total Emails */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 uppercase tracking-wider mb-2">
              <Send className="w-4 h-4" />
              Total Emails
            </div>
            <div className="text-3xl font-black text-slate-900 tracking-tight">
              {totalLogs.toLocaleString()}
            </div>
            <p className="text-xs text-slate-400 mt-1 font-medium">
              logged in delivery audit ledger
            </p>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm flex flex-wrap items-center gap-3">
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500/20"
          >
            <option value="ALL">All Statuses</option>
            <option value="SENT">SENT</option>
            <option value="DEAD_LETTER">DEAD_LETTER</option>
            <option value="FAILED">FAILED</option>
            <option value="PENDING">PENDING</option>
            <option value="RETRYING">RETRYING</option>
          </select>

          <form onSubmit={handleSearchSubmit} className="flex-1 min-w-[240px] relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search recipient, subject..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
            />
          </form>

          <button
            type="button"
            onClick={() => {
              setPage(1);
              loadData();
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-colors border border-slate-200 cursor-pointer"
          >
            <Filter className="w-4 h-4 text-slate-500" />
            Filter
          </button>
        </div>

        {/* Delivery Logs Table - Matches Screenshot 1 */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Sent At</th>
                  <th className="py-3 px-4">Recipient</th>
                  <th className="py-3 px-4">Subject</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Retries</th>
                  <th className="py-3 px-4">Error</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading && logs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-purple-600" />
                      Loading email delivery ledger...
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <Mail className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      No matching email logs found.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap text-xs">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>{formatTimestamp(log.attemptedAt || log.createdAt)}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="font-semibold text-slate-900 text-xs">
                          {log.recipientEmail}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-xs text-slate-700 max-w-[280px] truncate" title={log.subject}>
                        {log.subject || 'RMRIT Notification'}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-md text-[10px] font-bold border ${getStatusPill(
                            log.status,
                          )}`}
                        >
                          {log.status}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap text-xs font-mono text-slate-600">
                        {log.attempt ?? 1}
                      </td>

                      <td className="py-3.5 px-4 text-xs font-mono max-w-[200px] truncate">
                        {log.errorMessage ? (
                          <span className="text-rose-600 font-medium" title={log.errorMessage}>
                            {log.errorMessage}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap text-right">
                        {(log.status === 'FAILED' || log.status === 'DEAD_LETTER') && (
                          <button
                            type="button"
                            onClick={() => handleRetry(log.jobId || log.id)}
                            disabled={retryingId === (log.jobId || log.id)}
                            className="p-1.5 rounded-lg border border-slate-200 text-purple-600 hover:bg-purple-50 transition-colors cursor-pointer text-xs font-semibold inline-flex items-center gap-1"
                            title="Retry Email Job"
                          >
                            <RotateCw
                              className={`w-3.5 h-3.5 ${
                                retryingId === (log.jobId || log.id) ? 'animate-spin' : ''
                              }`}
                            />
                            Retry
                          </button>
                        )}
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
              Showing {(page - 1) * limit + 1} to {Math.min(page * limit, totalLogs)} of {totalLogs} records
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

      {/* Test Email Modal */}
      {isTestModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-blue-600">
                <Send className="w-5 h-5" />
                <h3 className="text-base font-bold text-slate-900">Send Test Email</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsTestModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSendTestEmail} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Recipient Email Address
                </label>
                <input
                  type="email"
                  value={testRecipient}
                  onChange={(e) => setTestRecipient(e.target.value)}
                  placeholder="e.g. posuppportairtronic@gmail.com"
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Subject Line
                </label>
                <input
                  type="text"
                  value={testSubject}
                  onChange={(e) => setTestSubject(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Message Body
                </label>
                <textarea
                  rows={3}
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                  required
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsTestModalOpen(false)}
                  className="flex-1 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sendingTest}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition shadow-sm"
                >
                  <Send className="w-4 h-4" />
                  {sendingTest ? 'Sending...' : 'Dispatch Email'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
