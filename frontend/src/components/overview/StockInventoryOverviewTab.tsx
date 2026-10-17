import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Box, ArrowDownLeft, ArrowUpRight as ArrowUpRightIcon, AlertCircle } from 'lucide-react';
import type { OverviewStockInventoryDto } from '../../types/overview.dto';

interface StockInventoryOverviewTabProps {
  data: OverviewStockInventoryDto;
}

const TX_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#64748b', '#ef4444'
];

export function StockInventoryOverviewTab({ data }: StockInventoryOverviewTabProps) {
  const barData = data.txTypeBreakdown.slice(0, 6).map((tx) => ({
    name: tx.type.replace(/_/g, ' '),
    count: tx.count,
    quantity: tx.quantity,
  }));

  const pieData = data.topStockItems.slice(0, 5).map((item, idx) => ({
    name: item.product_name,
    value: Number(item.current_quantity),
    color: TX_COLORS[idx % TX_COLORS.length],
  }));

  const totalMovementsCount = data.txTypeBreakdown.reduce((sum, item) => sum + item.count, 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* 4 Quick Stat Metric Tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-4">
        <div className="p-3.5 sm:p-4 bg-white dark:bg-[#121526] rounded-2xl border border-slate-200 dark:border-[#1e233d] shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-[#8896ab] mb-1.5 sm:mb-2">
            <span className="text-[10px] sm:text-xs font-semibold uppercase truncate">Total Stock Balance</span>
            <Box className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-500 shrink-0 ml-1" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white truncate">
            {Number(data.totalStockQuantity).toLocaleString()}
          </p>
          <p className="text-[10px] sm:text-xs text-slate-500 dark:text-[#8896ab] mt-0.5 sm:mt-1 truncate">Physical inventory</p>
        </div>

        <div className="p-3.5 sm:p-4 bg-white dark:bg-[#121526] rounded-2xl border border-slate-200 dark:border-[#1e233d] shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-[#8896ab] mb-1.5 sm:mb-2">
            <span className="text-[10px] sm:text-xs font-semibold uppercase truncate">Warehouse Bins</span>
            <ArrowDownLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-500 shrink-0 ml-1" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-blue-600 dark:text-blue-400 truncate">
            {data.totalStockBalances}
          </p>
          <p className="text-[10px] sm:text-xs text-slate-500 dark:text-[#8896ab] mt-0.5 sm:mt-1 truncate">Bin allocations</p>
        </div>

        <div className="p-3.5 sm:p-4 bg-white dark:bg-[#121526] rounded-2xl border border-slate-200 dark:border-[#1e233d] shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-[#8896ab] mb-1.5 sm:mb-2">
            <span className="text-[10px] sm:text-xs font-semibold uppercase truncate">Stock Transactions</span>
            <ArrowUpRightIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-500 shrink-0 ml-1" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-indigo-600 dark:text-indigo-400 truncate">
            {totalMovementsCount}
          </p>
          <p className="text-[10px] sm:text-xs text-slate-500 dark:text-[#8896ab] mt-0.5 sm:mt-1 truncate">Movements tracked</p>
        </div>

        <div className="p-3.5 sm:p-4 bg-white dark:bg-[#121526] rounded-2xl border border-slate-200 dark:border-[#1e233d] shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-[#8896ab] mb-1.5 sm:mb-2">
            <span className="text-[10px] sm:text-xs font-semibold uppercase truncate">Low Stock Alerts</span>
            <AlertCircle className={`w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 ml-1 ${data.lowStockCount > 0 ? 'text-rose-500' : 'text-slate-400'}`} />
          </div>
          <p className={`text-xl sm:text-2xl font-bold truncate ${data.lowStockCount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'}`}>
            {data.lowStockCount}
          </p>
          <p className="text-[10px] sm:text-xs text-slate-500 dark:text-[#8896ab] mt-0.5 sm:mt-1 truncate">Below defined MSL</p>
        </div>
      </div>

      {/* Visual Charts: Bar Chart & Pie Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Movements by Type Bar Chart */}
        <div className="p-4 sm:p-5 bg-white dark:bg-[#121526] rounded-2xl border border-slate-200 dark:border-[#1e233d] shadow-xs flex flex-col w-full max-w-full min-w-0 overflow-hidden">
          <div className="flex items-center justify-between mb-3 sm:mb-4 gap-2">
            <div className="min-w-0">
              <h4 className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white truncate">Inventory Activity by Transaction Type</h4>
              <p className="text-[10px] sm:text-xs text-slate-500 dark:text-[#8896ab] truncate">Stock-in, issues, consumptions & returns</p>
            </div>
            <span className="text-[10px] sm:text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-[#1e233d] text-slate-700 dark:text-slate-300 shrink-0">
              Bar Chart
            </span>
          </div>

          <div className="h-64 sm:h-72 w-full max-w-full min-w-0 overflow-hidden">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 10, right: 10, left: -25, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255, 255, 255, 0.08)" />
                <XAxis
                  dataKey="name"
                  interval={0}
                  angle={-15}
                  textAnchor="end"
                  tick={{ fontSize: 9, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: 'rgba(255, 255, 255, 0.04)' }}
                  formatter={(val: any) => [`${val} transactions`, 'Count']}
                  contentStyle={{ backgroundColor: '#161a2e', borderRadius: '8px', border: '1px solid #283056', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)', fontSize: '12px' }}
                  itemStyle={{ color: '#f1f5f9' }}
                />
                <Bar dataKey="count" fill="#3b82f6" radius={[6, 6, 0, 0]} className="cursor-pointer focus:outline-none" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Stock Volumes Donut Chart */}
        <div className="p-4 sm:p-5 bg-white dark:bg-[#121526] rounded-2xl border border-slate-200 dark:border-[#1e233d] shadow-xs flex flex-col w-full max-w-full min-w-0 overflow-hidden">
          <div className="flex items-center justify-between mb-3 sm:mb-4 gap-2">
            <div className="min-w-0">
              <h4 className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white truncate">Highest Volume Stock Materials</h4>
              <p className="text-[10px] sm:text-xs text-slate-500 dark:text-[#8896ab] truncate">Top 5 stocked raw materials</p>
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
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={3}
                  className="cursor-pointer focus:outline-none"
                >
                  {pieData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} stroke="none" className="focus:outline-none" />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(val: any) => [`${Number(val).toLocaleString()} units`, 'Quantity']}
                  contentStyle={{ backgroundColor: '#161a2e', borderRadius: '8px', border: '1px solid #283056', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)', fontSize: '12px' }}
                  itemStyle={{ color: '#f1f5f9' }}
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
      </div>

      {/* Top Stock Items Table */}
      <div className="bg-white dark:bg-[#121526] rounded-2xl border border-slate-200 dark:border-[#1e233d] shadow-xs overflow-hidden">
        <div className="p-3.5 sm:p-4 border-b border-slate-200 dark:border-[#1e233d] flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h4 className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white truncate">Highest Stocked Materials & Locations</h4>
            <p className="text-[10px] sm:text-xs text-slate-500 dark:text-[#8896ab] truncate">Storage allocations in bins and zones</p>
          </div>
          <Link
            to="/inventory/stock"
            className="text-xs font-medium text-primary dark:text-indigo-400 hover:underline flex items-center gap-1 shrink-0"
          >
            Stock
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto touch-pan-x">
          <table className="w-full text-left text-xs whitespace-nowrap min-w-[620px]">
            <thead className="bg-slate-50 dark:bg-[#0e111f] text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-[#1e233d]">
              <tr>
                <th className="py-2.5 px-3 sm:px-4">Item Code</th>
                <th className="py-2.5 px-3 sm:px-4">Material / Product Name</th>
                <th className="py-2.5 px-3 sm:px-4">Warehouse Zone</th>
                <th className="py-2.5 px-3 sm:px-4">Bin Code</th>
                <th className="py-2.5 px-3 sm:px-4 text-center">UOM</th>
                <th className="py-2.5 px-3 sm:px-4 text-right">Current Stock</th>
                <th className="py-2.5 px-3 sm:px-4 text-right">Min Stock (MSL)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#1e233d] text-slate-700 dark:text-slate-300">
              {data.topStockItems.map((item) => {
                const currentQty = Number(item.current_quantity);
                const minQty = Number(item.minimum_inventory);
                const isLow = minQty > 0 && currentQty < minQty;

                return (
                  <tr key={item.product_id + item.bin_code} className="hover:bg-slate-50/80 dark:hover:bg-[#161a2e] transition-colors">
                    <td className="py-2.5 px-3 sm:px-4 font-mono font-medium text-slate-900 dark:text-white">
                      {item.product_code || '—'}
                    </td>
                    <td className="py-2.5 px-3 sm:px-4 font-medium text-slate-800 dark:text-slate-200">
                      {item.product_name}
                    </td>
                    <td className="py-2.5 px-3 sm:px-4 text-slate-600 dark:text-slate-400">
                      {item.warehouse_name || 'VELAN STORES'}
                    </td>
                    <td className="py-2.5 px-3 sm:px-4 font-mono text-indigo-600 dark:text-indigo-400">
                      {item.bin_code}
                    </td>
                    <td className="py-2.5 px-3 sm:px-4 text-center font-bold text-slate-500 dark:text-slate-400">
                      {item.uom || 'NOS'}
                    </td>
                    <td className="py-2.5 px-3 sm:px-4 text-right font-bold text-emerald-600 dark:text-emerald-400">
                      {currentQty.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 sm:px-4 text-right">
                      {minQty > 0 ? (
                        <span className={`font-semibold ${isLow ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500 dark:text-slate-400'}`}>
                          {minQty.toLocaleString()} {item.uom || 'NOS'} {isLow && '⚠️'}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
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

