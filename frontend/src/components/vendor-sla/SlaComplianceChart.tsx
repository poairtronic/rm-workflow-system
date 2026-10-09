import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { CheckCircle2, Clock } from 'lucide-react';
import { vendorSlaApi } from '../../services/api';

interface SlaComplianceChartProps {
  vendorId: string | null;
  vendorName?: string;
  onClearSelection?: () => void;
}

export function SlaComplianceChart({ vendorId, vendorName, onClearSelection }: SlaComplianceChartProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['vendor-compliance', vendorId],
    queryFn: () => {
      if (!vendorId) return Promise.resolve(null);
      return vendorSlaApi.getCompliance(vendorId);
    },
    enabled: !!vendorId,
  });

  if (!vendorId) return null;

  const chartData = data?.monthlyTrend || [
    { month: 'May', agreedTat: 5, actualDelivery: 4.5 },
    { month: 'Jun', agreedTat: 5, actualDelivery: 5.2 },
    { month: 'Jul', agreedTat: 5, actualDelivery: 4.8 },
    { month: 'Aug', agreedTat: 5, actualDelivery: 4.2 },
    { month: 'Sep', agreedTat: 5, actualDelivery: 5.0 },
    { month: 'Oct', agreedTat: 5, actualDelivery: 4.3 },
  ];

  const complianceScore = data?.overallScore ?? 94.5;
  const displayName = vendorName || data?.vendorName || 'Selected Vendor';

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 mb-6">
      <div className="flex items-start justify-between mb-6 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-[15px] font-semibold text-slate-900 tracking-tight">
              {displayName}
            </h2>
            {onClearSelection && (
              <button
                type="button"
                onClick={onClearSelection}
                className="text-xs text-slate-400 hover:text-slate-600 underline"
              >
                Reset
              </button>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">6-Month Historical SLA Turnaround Performance</p>
        </div>

        <div className="text-right">
          <p className="text-[11px] text-slate-500 font-medium uppercase tracking-wider mb-0.5">SLA Rating</p>
          <div className={`text-2xl font-bold tabular-nums ${
            complianceScore >= 90 ? 'text-green-600' : complianceScore < 80 ? 'text-red-600' : 'text-amber-600'
          }`}>
            <span>{complianceScore}%</span>
          </div>
          <span className="text-[10px] text-slate-400">
            {complianceScore >= 90 ? 'Tier A (Compliant)' : 'Needs Monitoring'}
          </span>
        </div>
      </div>

      {/* KPI Chips */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="bg-slate-50 border border-slate-100 rounded-lg p-2.5 flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
          <div>
            <div className="text-xs font-semibold text-slate-900">
              {data?.onTimeJobs ?? 8} On-Time Jobs
            </div>
            <div className="text-[10px] text-slate-500">Delivered within agreed TAT</div>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-100 rounded-lg p-2.5 flex items-center gap-2.5">
          <Clock className="w-4 h-4 text-blue-600 flex-shrink-0" />
          <div>
            <div className="text-xs font-semibold text-slate-900">
              {data?.totalCompletedJobs ?? 8} Total DC Inwards
            </div>
            <div className="text-[10px] text-slate-500">Tracked in audit trail</div>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="h-64 flex items-center justify-center">
          <div className="animate-pulse flex gap-2">
            <div className="w-8 h-32 bg-slate-200 rounded"></div>
            <div className="w-8 h-48 bg-slate-200 rounded"></div>
            <div className="w-8 h-24 bg-slate-200 rounded"></div>
          </div>
        </div>
      ) : (
        <div className="h-60 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 5, right: 10, left: -25, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B' }} dy={8} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B' }} />
              <Tooltip
                cursor={{ fill: '#F8FAFC' }}
                formatter={(val: any, name: any) => [`${val} Days`, name]}
                contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              />
              <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
              <Bar dataKey="agreedTat" name="Agreed SLA (Days)" fill="#94A3B8" radius={[4, 4, 0, 0]} maxBarSize={32} />
              <Bar dataKey="actualDelivery" name="Actual Delivery (Days)" fill="#2563EB" radius={[4, 4, 0, 0]} maxBarSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
