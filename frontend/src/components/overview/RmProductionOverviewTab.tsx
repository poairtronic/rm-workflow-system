import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Link } from 'react-router-dom';
import { ArrowUpRight, CheckCircle2, Clock, PlayCircle, FileText } from 'lucide-react';
import type { OverviewRmWorkflowDto } from '../../types/overview.dto';

interface RmProductionOverviewTabProps {
  data: OverviewRmWorkflowDto;
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: '#64748b',             // Slate Gray
  SUBMITTED: '#8b5cf6',         // Vivid Purple
  STORES_PENDING: '#eab308',    // Amber / Golden Yellow
  PARTIALLY_ISSUED: '#06b6d4',  // Cyan / Sky Blue
  ISSUED: '#2563eb',            // Royal Blue
  IN_PRODUCTION: '#f97316',     // Vibrant Orange
  ADDITIONAL_REQUEST: '#ec4899',// Hot Pink / Magenta
  ACTIVE: '#6366f1',            // Indigo
  COMPLETED: '#10b981',         // Emerald Green
  CLOSED: '#334155',            // Dark Charcoal
  REJECTED: '#ef4444',          // Crimson Red
};

const FALLBACK_PALETTE = [
  '#6366f1', // Indigo
  '#ec4899', // Pink
  '#14b8a6', // Teal
  '#f43f5e', // Rose
  '#8b5cf6', // Violet
  '#0284c7', // Sky
  '#84cc16', // Lime
  '#a855f7', // Purple
  '#d97706', // Amber
  '#059669', // Emerald
];

export function RmProductionOverviewTab({ data }: RmProductionOverviewTabProps) {
  const pieData = Object.entries(data.scStatusMap).map(([status, count], idx) => {
    const key = status.toUpperCase().trim();
    const color = STATUS_COLORS[key] || FALLBACK_PALETTE[idx % FALLBACK_PALETTE.length];
    return {
      name: status.replace(/_/g, ' '),
      value: count,
      statusKey: status,
      color,
    };
  });

  const pipelineData = [
    { stage: 'Requisitions', count: Object.values(data.rmStatusMap).reduce((a, b) => a + b, 0), fill: '#6366f1' },
    { stage: 'Shop Floor SCs', count: data.totalScs, fill: '#3b82f6' },
    { stage: 'Consumptions', count: data.totalConsumptions, fill: '#f59e0b' },
    { stage: 'Surplus Returns', count: data.totalReturns, fill: '#10b981' },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* 4 Quick Stat Metric Tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-4">
        <div className="p-3.5 sm:p-4 bg-white dark:bg-[#121526] rounded-2xl border border-slate-200 dark:border-[#1e233d] shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-[#8896ab] mb-1.5 sm:mb-2">
            <span className="text-[10px] sm:text-xs font-semibold uppercase truncate">Total SC Orders</span>
            <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-500 shrink-0 ml-1" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white truncate">{data.totalScs}</p>
          <p className="text-[10px] sm:text-xs text-slate-500 dark:text-[#8896ab] mt-0.5 sm:mt-1 truncate">Components tracked</p>
        </div>

        <div className="p-3.5 sm:p-4 bg-white dark:bg-[#121526] rounded-2xl border border-slate-200 dark:border-[#1e233d] shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-[#8896ab] mb-1.5 sm:mb-2">
            <span className="text-[10px] sm:text-xs font-semibold uppercase truncate">Active In-Prod</span>
            <PlayCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-500 shrink-0 ml-1" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-amber-600 dark:text-amber-400 truncate">
            {data.scStatusMap['IN_PRODUCTION'] || 0}
          </p>
          <p className="text-[10px] sm:text-xs text-slate-500 dark:text-[#8896ab] mt-0.5 sm:mt-1 truncate">Machining / processing</p>
        </div>

        <div className="p-3.5 sm:p-4 bg-white dark:bg-[#121526] rounded-2xl border border-slate-200 dark:border-[#1e233d] shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-[#8896ab] mb-1.5 sm:mb-2">
            <span className="text-[10px] sm:text-xs font-semibold uppercase truncate">Completed SCs</span>
            <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-500 shrink-0 ml-1" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400 truncate">
            {data.scStatusMap['COMPLETED'] || 0}
          </p>
          <p className="text-[10px] sm:text-xs text-slate-500 dark:text-[#8896ab] mt-0.5 sm:mt-1 truncate">Ready for dispatch</p>
        </div>

        <div className="p-3.5 sm:p-4 bg-white dark:bg-[#121526] rounded-2xl border border-slate-200 dark:border-[#1e233d] shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-[#8896ab] mb-1.5 sm:mb-2">
            <span className="text-[10px] sm:text-xs font-semibold uppercase truncate">Material Consumed</span>
            <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-500 shrink-0 ml-1" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-blue-600 dark:text-blue-400 truncate">
            {Number(data.totalConsumedQty).toLocaleString()}
          </p>
          <p className="text-[10px] sm:text-xs text-slate-500 dark:text-[#8896ab] mt-0.5 sm:mt-1 truncate">{data.totalConsumptions} batches logged</p>
        </div>
      </div>

      {/* Visual Charts: Pie Chart & Funnel Bar Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* SC Status Distribution Pie Chart */}
        <div className="p-4 sm:p-5 bg-white dark:bg-[#121526] rounded-2xl border border-slate-200 dark:border-[#1e233d] shadow-xs flex flex-col w-full max-w-full min-w-0 overflow-hidden">
          <div className="flex items-center justify-between mb-3 sm:mb-4 gap-2">
            <div className="min-w-0">
              <h4 className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white truncate">Sales Order Status Distribution</h4>
              <p className="text-[10px] sm:text-xs text-slate-500 dark:text-[#8896ab] truncate">Live operational lifecycle stages of components</p>
            </div>
            <span className="text-[10px] sm:text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-[#1e233d] text-slate-700 dark:text-slate-300 shrink-0">
              Donut
            </span>
          </div>

          <div className="h-64 sm:h-72 w-full max-w-full min-w-0 overflow-hidden">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="42%"
                  innerRadius={52}
                  outerRadius={82}
                  paddingAngle={3}
                  className="cursor-pointer focus:outline-none"
                >
                  {pieData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} stroke="none" className="focus:outline-none" />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(val: any) => [`${val} SCs`, 'Count']}
                  contentStyle={{ backgroundColor: '#161a2e', borderRadius: '8px', border: '1px solid #283056', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)', fontSize: '12px' }}
                  itemStyle={{ color: '#f1f5f9' }}
                />
                <Legend
                  verticalAlign="bottom"
                  iconType="circle"
                  wrapperStyle={{ fontSize: '10px', paddingTop: '6px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Workflow Stage Volume Bar Chart */}
        <div className="p-4 sm:p-5 bg-white dark:bg-[#121526] rounded-2xl border border-slate-200 dark:border-[#1e233d] shadow-xs flex flex-col w-full max-w-full min-w-0 overflow-hidden">
          <div className="flex items-center justify-between mb-3 sm:mb-4 gap-2">
            <div className="min-w-0">
              <h4 className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white truncate">Workflow Execution Pipeline</h4>
              <p className="text-[10px] sm:text-xs text-slate-500 dark:text-[#8896ab] truncate">Volume across requisitions, floor & returns</p>
            </div>
            <span className="text-[10px] sm:text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-[#1e233d] text-slate-700 dark:text-slate-300 shrink-0">
              Bar Chart
            </span>
          </div>

          <div className="h-64 sm:h-72 w-full max-w-full min-w-0 overflow-hidden">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pipelineData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255, 255, 255, 0.08)" />
                <XAxis dataKey="stage" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: 'rgba(255, 255, 255, 0.04)' }}
                  formatter={(val: any) => [`${val} Records`, 'Volume']}
                  contentStyle={{ backgroundColor: '#161a2e', borderRadius: '8px', border: '1px solid #283056', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)', fontSize: '12px' }}
                  itemStyle={{ color: '#f1f5f9' }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]} className="cursor-pointer focus:outline-none" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Live Recent SC Table */}
      <div className="bg-white dark:bg-[#121526] rounded-2xl border border-slate-200 dark:border-[#1e233d] shadow-xs overflow-hidden">
        <div className="p-3.5 sm:p-4 border-b border-slate-200 dark:border-[#1e233d] flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h4 className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white truncate">Recent Shop Floor Components</h4>
            <p className="text-[10px] sm:text-xs text-slate-500 dark:text-[#8896ab] truncate">Live components active in the RM to Production pipeline</p>
          </div>
          <Link
            to="/governance/traceability"
            className="text-xs font-medium text-primary dark:text-indigo-400 hover:underline flex items-center gap-1 shrink-0"
          >
            Traceability
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto touch-pan-x">
          <table className="w-full text-left text-xs whitespace-nowrap min-w-[560px]">
            <thead className="bg-slate-50 dark:bg-[#0e111f] text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-[#1e233d]">
              <tr>
                <th className="py-2.5 px-3 sm:px-4">PO Number</th>
                <th className="py-2.5 px-3 sm:px-4">SC Number</th>
                <th className="py-2.5 px-3 sm:px-4">Component / Product</th>
                <th className="py-2.5 px-3 sm:px-4 text-right">Target Qty</th>
                <th className="py-2.5 px-3 sm:px-4 text-center">Status</th>
                <th className="py-2.5 px-3 sm:px-4 text-right">Created Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#1e233d] text-slate-700 dark:text-slate-300">
              {data.recentScs.map((sc) => (
                <tr key={sc.id} className="hover:bg-slate-50/80 dark:hover:bg-[#161a2e] transition-colors">
                  <td className="py-2.5 px-3 sm:px-4 font-mono font-medium text-slate-900 dark:text-white">
                    {sc.po_number || '—'}
                  </td>
                  <td className="py-2.5 px-3 sm:px-4 font-mono text-indigo-600 dark:text-indigo-400 font-medium">
                    {sc.sc_number}
                  </td>
                  <td className="py-2.5 px-3 sm:px-4 font-medium text-slate-800 dark:text-slate-200">
                    {sc.product_name}
                  </td>
                  <td className="py-2.5 px-3 sm:px-4 text-right font-semibold">
                    {Number(sc.target_quantity).toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3 sm:px-4 text-center">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        sc.status === 'COMPLETED'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                          : sc.status === 'IN_PRODUCTION'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                          : sc.status === 'ISSUED' || sc.status === 'PARTIALLY_ISSUED'
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                          : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      {sc.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 sm:px-4 text-right text-slate-500 dark:text-slate-400">
                    {new Date(sc.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

