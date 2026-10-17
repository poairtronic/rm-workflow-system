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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-4">
        <div className="p-3.5 sm:p-4 bg-white dark:bg-[#121526] rounded-2xl border border-slate-200 dark:border-[#1e233d] shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-[#8896ab] mb-1.5 sm:mb-2">
            <span className="text-[10px] sm:text-xs font-semibold uppercase truncate">Total Challans</span>
            <Truck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-500 shrink-0 ml-1" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white truncate">{data.totalDcs}</p>
          <p className="text-[10px] sm:text-xs text-slate-500 dark:text-[#8896ab] mt-0.5 sm:mt-1 truncate">Dispatches registered</p>
        </div>

        <div className="p-3.5 sm:p-4 bg-white dark:bg-[#121526] rounded-2xl border border-slate-200 dark:border-[#1e233d] shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-[#8896ab] mb-1.5 sm:mb-2">
            <span className="text-[10px] sm:text-xs font-semibold uppercase truncate">Active Outside</span>
            <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-500 shrink-0 ml-1" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-amber-600 dark:text-amber-400 truncate">{data.openDcs}</p>
          <p className="text-[10px] sm:text-xs text-slate-500 dark:text-[#8896ab] mt-0.5 sm:mt-1 truncate">Awaiting return</p>
        </div>

        <div className="p-3.5 sm:p-4 bg-white dark:bg-[#121526] rounded-2xl border border-slate-200 dark:border-[#1e233d] shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-[#8896ab] mb-1.5 sm:mb-2">
            <span className="text-[10px] sm:text-xs font-semibold uppercase truncate">Units in Custody</span>
            <AlertCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-500 shrink-0 ml-1" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-blue-600 dark:text-blue-400 truncate">
            {Number(data.totalCustodyQty).toLocaleString()}
          </p>
          <p className="text-[10px] sm:text-xs text-slate-500 dark:text-[#8896ab] mt-0.5 sm:mt-1 truncate">Net physical parts</p>
        </div>

        <div className="p-3.5 sm:p-4 bg-white dark:bg-[#121526] rounded-2xl border border-slate-200 dark:border-[#1e233d] shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-[#8896ab] mb-1.5 sm:mb-2">
            <span className="text-[10px] sm:text-xs font-semibold uppercase truncate">Closed & Verified</span>
            <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-500 shrink-0 ml-1" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400 truncate">{data.closedDcs}</p>
          <p className="text-[10px] sm:text-xs text-slate-500 dark:text-[#8896ab] mt-0.5 sm:mt-1 truncate">Reconciled in store</p>
        </div>
      </div>

      {/* Visual Charts: Pie Chart & Bar Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Challan Status Breakdown Donut Chart */}
        <div className="p-4 sm:p-5 bg-white dark:bg-[#121526] rounded-2xl border border-slate-200 dark:border-[#1e233d] shadow-xs flex flex-col w-full max-w-full min-w-0 overflow-hidden">
          <div className="flex items-center justify-between mb-3 sm:mb-4 gap-2">
            <div className="min-w-0">
              <h4 className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white truncate">Delivery Challan Lifecycle</h4>
              <p className="text-[10px] sm:text-xs text-slate-500 dark:text-[#8896ab] truncate">Distribution across dispatched, partially returned & closed</p>
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
                  formatter={(val: any) => [`${val} Challans`, 'Count']}
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

        {/* Vendor Custody Units Bar Chart */}
        <div className="p-4 sm:p-5 bg-white dark:bg-[#121526] rounded-2xl border border-slate-200 dark:border-[#1e233d] shadow-xs flex flex-col w-full max-w-full min-w-0 overflow-hidden">
          <div className="flex items-center justify-between mb-3 sm:mb-4 gap-2">
            <div className="min-w-0">
              <h4 className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white truncate">Custody Material by Vendor</h4>
              <p className="text-[10px] sm:text-xs text-slate-500 dark:text-[#8896ab] truncate">Net physical units pending return at vendor facilities</p>
            </div>
            <span className="text-[10px] sm:text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-[#1e233d] text-slate-700 dark:text-slate-300 shrink-0">
              Bar Chart
            </span>
          </div>

          <div className="h-64 sm:h-72 w-full max-w-full min-w-0 overflow-hidden">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={vendorBarData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255, 255, 255, 0.08)" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: 'rgba(255, 255, 255, 0.04)' }}
                  formatter={(val: any) => [`${Number(val).toLocaleString()} units`, 'Pending in Custody']}
                  contentStyle={{ backgroundColor: '#161a2e', borderRadius: '8px', border: '1px solid #283056', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)', fontSize: '12px' }}
                  itemStyle={{ color: '#f1f5f9' }}
                />
                <Bar dataKey="pendingQty" fill="#f59e0b" radius={[6, 6, 0, 0]} className="cursor-pointer focus:outline-none" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Active Circulating Delivery Challans Table */}
      <div className="bg-white dark:bg-[#121526] rounded-2xl border border-slate-200 dark:border-[#1e233d] shadow-xs overflow-hidden">
        <div className="p-3.5 sm:p-4 border-b border-slate-200 dark:border-[#1e233d] flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h4 className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white truncate">Active Delivery Challans in Circulation</h4>
            <p className="text-[10px] sm:text-xs text-slate-500 dark:text-[#8896ab] truncate">Recent dispatches and open return cycles</p>
          </div>
          <Link
            to="/governance/vendor-analytics"
            className="text-xs font-medium text-primary dark:text-indigo-400 hover:underline flex items-center gap-1 shrink-0"
          >
            Vendor Analytics
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto touch-pan-x">
          <table className="w-full text-left text-xs whitespace-nowrap min-w-[620px]">
            <thead className="bg-slate-50 dark:bg-[#0e111f] text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-[#1e233d]">
              <tr>
                <th className="py-2.5 px-3 sm:px-4">Challan Number</th>
                <th className="py-2.5 px-3 sm:px-4">DC Type</th>
                <th className="py-2.5 px-3 sm:px-4">Vendor</th>
                <th className="py-2.5 px-3 sm:px-4 text-right">Dispatched</th>
                <th className="py-2.5 px-3 sm:px-4 text-right">Returned</th>
                <th className="py-2.5 px-3 sm:px-4 text-right">Net Pending</th>
                <th className="py-2.5 px-3 sm:px-4 text-center">Status</th>
                <th className="py-2.5 px-3 sm:px-4 text-right">Dispatch Date</th>
                <th className="py-2.5 px-3 sm:px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#1e233d] text-slate-700 dark:text-slate-300">
              {data.recentDcs.map((dc) => {
                const pending = Number(dc.pending_qty);
                return (
                  <tr key={dc.id} className="hover:bg-slate-50/80 dark:hover:bg-[#161a2e] transition-colors">
                    <td className="py-2.5 px-3 sm:px-4 font-mono font-medium text-indigo-600 dark:text-indigo-400">
                      {dc.challan_number}
                    </td>
                    <td className="py-2.5 px-3 sm:px-4 text-slate-600 dark:text-slate-400">
                      {dc.type === 'PRODUCTION_PROCESS_OUTWARD' ? 'Type 1 (Process)' : 'Type 2 (General)'}
                    </td>
                    <td className="py-2.5 px-3 sm:px-4 font-medium text-slate-800 dark:text-slate-200">
                      {dc.vendor_name}
                    </td>
                    <td className="py-2.5 px-3 sm:px-4 text-right">
                      {Number(dc.dispatched_qty).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 sm:px-4 text-right text-emerald-600 dark:text-emerald-400 font-medium">
                      {Number(dc.returned_qty).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 sm:px-4 text-right font-bold text-amber-600 dark:text-amber-400">
                      {pending > 0 ? pending.toLocaleString() : '0'}
                    </td>
                    <td className="py-2.5 px-3 sm:px-4 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          dc.status === 'CLOSED'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : dc.status === 'PARTIALLY_RETURNED'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                        }`}
                      >
                        {dc.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 sm:px-4 text-right text-slate-500 dark:text-slate-400">
                      {new Date(dc.dispatch_date).toLocaleDateString()}
                    </td>
                    <td className="py-2.5 px-3 sm:px-4 text-center">
                      <button
                        type="button"
                        onClick={() => window.open(`/dispatch/delivery-challan/${dc.id}/print`, '_blank')}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/60 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors cursor-pointer min-h-[32px]"
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

