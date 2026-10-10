import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Truck, CheckCircle2, AlertCircle, Clock, Printer } from 'lucide-react';
import type { OverviewDeliveryChallanDto } from '../../types/overview.dto';

interface DeliveryChallanOverviewTabProps {
  data: OverviewDeliveryChallanDto;
}

const DC_STATUS_COLORS: Record<string, string> = {
  DISPATCHED: '#f59e0b',
  PARTIALLY_RETURNED: '#3b82f6',
  CLOSED: '#10b981',
  RETURNED: '#06b6d4',
};

export function DeliveryChallanOverviewTab({ data }: DeliveryChallanOverviewTabProps) {
  const pieData = data.dcStatusBreakdown.map((item) => ({
    name: `${item.status.replace(/_/g, ' ')} (${item.type === 'PRODUCTION_PROCESS_OUTWARD' ? 'T1' : 'T2'})`,
    value: item.count,
    color: DC_STATUS_COLORS[item.status] || '#94a3b8',
  }));

  const vendorBarData = data.vendorCustody.map((v) => ({
    name: v.vendorName,
    pendingQty: v.pendingQty,
    openDcs: v.openDcs,
  }));

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* 4 Quick Stat Metric Tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-xl border border-slate-200">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase">Total Challans</span>
            <Truck className="w-4 h-4 text-indigo-500" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{data.totalDcs}</p>
          <p className="text-xs text-slate-500 mt-1">Dispatches registered</p>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase">Active Outside</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-bold text-amber-600">{data.openDcs}</p>
          <p className="text-xs text-slate-500 mt-1">Awaiting return & verification</p>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase">Units in Custody</span>
            <AlertCircle className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl font-bold text-blue-600">
            {Number(data.totalCustodyQty).toLocaleString()}
          </p>
          <p className="text-xs text-slate-500 mt-1">Net physical parts at vendors</p>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase">Closed & Verified</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold text-emerald-600">{data.closedDcs}</p>
          <p className="text-xs text-slate-500 mt-1">Fully reconciled in store</p>
        </div>
      </div>

      {/* Visual Charts: Pie Chart & Bar Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Challan Status Breakdown Donut Chart */}
        <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-sm font-semibold text-slate-900">Delivery Challan Lifecycle Breakdown</h4>
              <p className="text-xs text-slate-500">Distribution across dispatched, partially returned & closed</p>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
              Donut Chart
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
                  formatter={(val: any) => [`${val} Challans`, 'Count']}
                  contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
                />
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  iconType="circle"
                  wrapperStyle={{ fontSize: '10px', paddingTop: '8px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Vendor Custody Units Bar Chart */}
        <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-sm font-semibold text-slate-900">Custody Material by Vendor</h4>
              <p className="text-xs text-slate-500">Net physical units currently pending return at vendor facilities</p>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
              Bar Chart
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={vendorBarData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: 'rgba(241, 245, 249, 0.6)' }}
                  formatter={(val: any) => [`${Number(val).toLocaleString()} units`, 'Pending in Custody']}
                  contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
                />
                <Bar dataKey="pendingQty" fill="#f59e0b" radius={[6, 6, 0, 0]} className="cursor-pointer focus:outline-none" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Active Circulating Delivery Challans Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h4 className="text-sm font-semibold text-slate-900">Active Delivery Challans in Circulation</h4>
            <p className="text-xs text-slate-500">Recent dispatches and open return cycles</p>
          </div>
          <Link
            to="/governance/vendor-analytics"
            className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
          >
            Vendor Analytics & SLAs
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-4">Challan Number</th>
                <th className="py-2.5 px-4">DC Type</th>
                <th className="py-2.5 px-4">Vendor</th>
                <th className="py-2.5 px-4 text-right">Dispatched</th>
                <th className="py-2.5 px-4 text-right">Returned</th>
                <th className="py-2.5 px-4 text-right">Net Pending</th>
                <th className="py-2.5 px-4 text-center">Status</th>
                <th className="py-2.5 px-4 text-right">Dispatch Date</th>
                <th className="py-2.5 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {data.recentDcs.map((dc) => {
                const pending = Number(dc.pending_qty);
                return (
                  <tr key={dc.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 px-4 font-mono font-medium text-indigo-600">
                      {dc.challan_number}
                    </td>
                    <td className="py-2.5 px-4 text-slate-600">
                      {dc.type === 'PRODUCTION_PROCESS_OUTWARD' ? 'Type 1 (Process)' : 'Type 2 (General)'}
                    </td>
                    <td className="py-2.5 px-4 font-medium text-slate-800">
                      {dc.vendor_name}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      {Number(dc.dispatched_qty).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-4 text-right text-emerald-600 font-medium">
                      {Number(dc.returned_qty).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-4 text-right font-bold text-amber-600">
                      {pending > 0 ? pending.toLocaleString() : '0'}
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          dc.status === 'CLOSED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : dc.status === 'PARTIALLY_RETURNED'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {dc.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right text-slate-500">
                      {new Date(dc.dispatch_date).toLocaleDateString()}
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => window.open(`/dispatch/delivery-challan/${dc.id}/print`, '_blank')}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 transition-colors cursor-pointer"
                        title="Print Supplier DC"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        Print
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

