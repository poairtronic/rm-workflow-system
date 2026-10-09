import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Link } from 'react-router-dom';
import { ArrowUpRight, CheckCircle2, Clock, PlayCircle, FileText } from 'lucide-react';
import type { OverviewRmWorkflowDto } from '../../types/overview.dto';

interface RmProductionOverviewTabProps {
  data: OverviewRmWorkflowDto;
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: '#94a3b8',
  PARTIALLY_ISSUED: '#38bdf8',
  ISSUED: '#3b82f6',
  IN_PRODUCTION: '#f59e0b',
  COMPLETED: '#10b981',
  CLOSED: '#64748b',
};

export function RmProductionOverviewTab({ data }: RmProductionOverviewTabProps) {
  const pieData = Object.entries(data.scStatusMap).map(([status, count]) => ({
    name: status.replace(/_/g, ' '),
    value: count,
    statusKey: status,
    color: STATUS_COLORS[status] || '#cbd5e1',
  }));

  const pipelineData = [
    { stage: 'Requisitions', count: Object.values(data.rmStatusMap).reduce((a, b) => a + b, 0), fill: '#6366f1' },
    { stage: 'Shop Floor SCs', count: data.totalScs, fill: '#3b82f6' },
    { stage: 'Consumptions', count: data.totalConsumptions, fill: '#f59e0b' },
    { stage: 'Surplus Returns', count: data.totalReturns, fill: '#10b981' },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* 4 Quick Stat Metric Tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-xl border border-slate-200">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase">Total SC Orders</span>
            <FileText className="w-4 h-4 text-indigo-500" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{data.totalScs}</p>
          <p className="text-xs text-slate-500 mt-1">Components tracked</p>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase">Active In-Production</span>
            <PlayCircle className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-bold text-amber-600">
            {data.scStatusMap['IN_PRODUCTION'] || 0}
          </p>
          <p className="text-xs text-slate-500 mt-1">Under machining / processing</p>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase">Completed SCs</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold text-emerald-600">
            {data.scStatusMap['COMPLETED'] || 0}
          </p>
          <p className="text-xs text-slate-500 mt-1">Ready for dispatch or stock</p>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase">Material Consumed</span>
            <Clock className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl font-bold text-blue-600">
            {Number(data.totalConsumedQty).toLocaleString()}
          </p>
          <p className="text-xs text-slate-500 mt-1">{data.totalConsumptions} batches logged</p>
        </div>
      </div>

      {/* Visual Charts: Pie Chart & Funnel Bar Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* SC Status Distribution Pie Chart */}
        <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-sm font-semibold text-slate-900">Sales Order Status Distribution</h4>
              <p className="text-xs text-slate-500">Live operational lifecycle stages of components</p>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
              Pie / Donut
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={3}
                  className="cursor-pointer focus:outline-none"
                >
                  {pieData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} stroke="#ffffff" strokeWidth={2} className="focus:outline-none" />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(val: any) => [`${val} SCs`, 'Count']}
                  contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
                />
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  iconType="circle"
                  wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Workflow Stage Volume Bar Chart */}
        <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-sm font-semibold text-slate-900">Workflow Execution Pipeline</h4>
              <p className="text-xs text-slate-500">Volume across requisitions, shop floor, consumptions & returns</p>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
              Bar Chart
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pipelineData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="stage" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: 'rgba(241, 245, 249, 0.6)' }}
                  formatter={(val: any) => [`${val} Records`, 'Volume']}
                  contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]} className="cursor-pointer focus:outline-none" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Live Recent SC Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h4 className="text-sm font-semibold text-slate-900">Recent Shop Floor Components</h4>
            <p className="text-xs text-slate-500">Live components active in the RM to Production pipeline</p>
          </div>
          <Link
            to="/governance/traceability"
            className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
          >
            Full SC Traceability
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-4">PO Number</th>
                <th className="py-2.5 px-4">SC Number</th>
                <th className="py-2.5 px-4">Component / Product</th>
                <th className="py-2.5 px-4 text-right">Target Qty</th>
                <th className="py-2.5 px-4 text-center">Status</th>
                <th className="py-2.5 px-4 text-right">Created Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {data.recentScs.map((sc) => (
                <tr key={sc.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-2.5 px-4 font-mono font-medium text-slate-900">
                    {sc.po_number || '—'}
                  </td>
                  <td className="py-2.5 px-4 font-mono text-indigo-600 font-medium">
                    {sc.sc_number}
                  </td>
                  <td className="py-2.5 px-4 font-medium text-slate-800">
                    {sc.product_name}
                  </td>
                  <td className="py-2.5 px-4 text-right font-semibold">
                    {Number(sc.target_quantity).toLocaleString()}
                  </td>
                  <td className="py-2.5 px-4 text-center">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        sc.status === 'COMPLETED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : sc.status === 'IN_PRODUCTION'
                          ? 'bg-amber-100 text-amber-800'
                          : sc.status === 'ISSUED' || sc.status === 'PARTIALLY_ISSUED'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {sc.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-right text-slate-500">
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

