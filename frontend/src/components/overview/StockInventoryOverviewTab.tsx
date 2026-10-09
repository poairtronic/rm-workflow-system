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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-xl border border-slate-200">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase">Total Stock Balance</span>
            <Box className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold text-slate-900">
            {Number(data.totalStockQuantity).toLocaleString()}
          </p>
          <p className="text-xs text-slate-500 mt-1">Aggregated physical inventory</p>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase">Active Warehouse Locations</span>
            <ArrowDownLeft className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl font-bold text-blue-600">
            {data.totalStockBalances}
          </p>
          <p className="text-xs text-slate-500 mt-1">Populated bin allocations</p>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase">Stock Transactions</span>
            <ArrowUpRightIcon className="w-4 h-4 text-indigo-500" />
          </div>
          <p className="text-2xl font-bold text-indigo-600">
            {totalMovementsCount}
          </p>
          <p className="text-xs text-slate-500 mt-1">Total movements tracked</p>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase">Low Stock Alerts</span>
            <AlertCircle className={`w-4 h-4 ${data.lowStockCount > 0 ? 'text-rose-500' : 'text-slate-400'}`} />
          </div>
          <p className={`text-2xl font-bold ${data.lowStockCount > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
            {data.lowStockCount}
          </p>
          <p className="text-xs text-slate-500 mt-1">Items below defined MSL</p>
        </div>
      </div>

      {/* Visual Charts: Bar Chart & Pie Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Movements by Type Bar Chart */}
        <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-sm font-semibold text-slate-900">Inventory Activity by Transaction Type</h4>
              <p className="text-xs text-slate-500">Frequency of stock-in, issues, consumptions, and returns</p>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
              Bar Chart
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="name"
                  interval={0}
                  angle={-15}
                  textAnchor="end"
                  tick={{ fontSize: 10, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: 'rgba(241, 245, 249, 0.6)' }}
                  formatter={(val: any) => [`${val} transactions`, 'Count']}
                  contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
                />
                <Bar dataKey="count" fill="#3b82f6" radius={[6, 6, 0, 0]} className="cursor-pointer focus:outline-none" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Stock Volumes Donut Chart */}
        <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-sm font-semibold text-slate-900">Highest Volume Stock Materials</h4>
              <p className="text-xs text-slate-500">Distribution among the top 5 stocked raw materials</p>
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
                  formatter={(val: any) => [`${Number(val).toLocaleString()} units`, 'Quantity']}
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
      </div>

      {/* Top Stock Items Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h4 className="text-sm font-semibold text-slate-900">Highest Stocked Materials & Locations</h4>
            <p className="text-xs text-slate-500">Live storage allocations in bins and warehouse zones</p>
          </div>
          <Link
            to="/inventory/stock"
            className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
          >
            Full Stock Overview
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-4">Item Code</th>
                <th className="py-2.5 px-4">Material / Product Name</th>
                <th className="py-2.5 px-4">Warehouse Zone</th>
                <th className="py-2.5 px-4">Bin Code</th>
                <th className="py-2.5 px-4 text-center">UOM</th>
                <th className="py-2.5 px-4 text-right">Current Stock</th>
                <th className="py-2.5 px-4 text-right">Min Stock (MSL)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {data.topStockItems.map((item) => {
                const currentQty = Number(item.current_quantity);
                const minQty = Number(item.minimum_inventory);
                const isLow = minQty > 0 && currentQty < minQty;

                return (
                  <tr key={item.product_id + item.bin_code} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 px-4 font-mono font-medium text-slate-900">
                      {item.product_code || '—'}
                    </td>
                    <td className="py-2.5 px-4 font-medium text-slate-800">
                      {item.product_name}
                    </td>
                    <td className="py-2.5 px-4 text-slate-600">
                      {item.warehouse_name || 'VELAN STORES'}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-indigo-600">
                      {item.bin_code}
                    </td>
                    <td className="py-2.5 px-4 text-center font-bold text-slate-500">
                      {item.uom || 'KG'}
                    </td>
                    <td className="py-2.5 px-4 text-right font-bold text-emerald-600">
                      {currentQty.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      {minQty > 0 ? (
                        <span className={`font-semibold ${isLow ? 'text-rose-600' : 'text-slate-500'}`}>
                          {minQty.toLocaleString()} {isLow && '⚠️'}
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

