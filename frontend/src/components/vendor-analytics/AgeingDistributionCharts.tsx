import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';
import type { VendorDcAgeingDistributionDto, ChartAgeingBucket } from '../../types/vendor-analytics.dto';

interface AgeingDistributionChartsProps {
  distribution?: VendorDcAgeingDistributionDto;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload as ChartAgeingBucket;
    return (
      <div className="bg-white border border-slate-200 rounded-lg shadow-md p-4 min-w-[200px]">
        <p className="text-sm font-semibold text-slate-900 mb-2 border-b border-slate-100 pb-1.5">{label}</p>
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs text-slate-500 uppercase tracking-wider">Open DCs:</span>
          <span className="font-bold tabular-nums text-slate-900">{data.dcCount}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-slate-500 uppercase tracking-wider">Custody Balance:</span>
          <span className="font-bold tabular-nums text-slate-900">{data.balanceQty} units</span>
        </div>
      </div>
    );
  }
  return null;
};

export function AgeingDistributionCharts({ distribution }: AgeingDistributionChartsProps) {
  const chartData: ChartAgeingBucket[] = [
    {
      name: '< 7 Days',
      dcCount: distribution?.lessThan7Days?.count ?? 0,
      balanceQty: distribution?.lessThan7Days?.totalBalanceQty ?? 0,
      color: '#3B82F6', // Blue
    },
    {
      name: '7 - 14 Days',
      dcCount: distribution?.sevenTo14Days?.count ?? 0,
      balanceQty: distribution?.sevenTo14Days?.totalBalanceQty ?? 0,
      color: '#10B981', // Emerald
    },
    {
      name: '15 - 30 Days',
      dcCount: distribution?.fifteenTo30Days?.count ?? 0,
      balanceQty: distribution?.fifteenTo30Days?.totalBalanceQty ?? 0,
      color: '#F59E0B', // Amber
    },
    {
      name: '> 30 Days',
      dcCount: distribution?.moreThan30Days?.count ?? 0,
      balanceQty: distribution?.moreThan30Days?.totalBalanceQty ?? 0,
      color: '#EF4444', // Red
    },
  ];

  const totalOpenDcs = chartData.reduce((sum, item) => sum + item.dcCount, 0);

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 mb-6">
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
        <div>
          <h3 className="text-[15px] font-semibold text-slate-900 uppercase tracking-wide">
            DC Ageing Risk Distribution
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Breakdown of active delivery challans by time elapsed since dispatch
          </p>
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
          Total Open DCs: {totalOpenDcs}
        </span>
      </div>

      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 20, right: 30, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
            <XAxis 
              dataKey="name" 
              tick={{ fontSize: 12, fill: '#64748B', fontWeight: 500 }} 
              axisLine={false} 
              tickLine={false} 
              dy={8}
            />
            <YAxis 
              allowDecimals={false}
              tick={{ fontSize: 12, fill: '#64748B' }} 
              axisLine={false} 
              tickLine={false} 
              dx={-8}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: '#F8FAFC', opacity: 0.8 }} />
            <Bar dataKey="dcCount" name="Open DCs" radius={[6, 6, 0, 0]} barSize={52}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Legend & Summary Footer */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-slate-100 mt-2">
        {chartData.map((bucket) => (
          <div key={bucket.name} className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: bucket.color }} />
            <div>
              <p className="text-xs font-medium text-slate-500">{bucket.name}</p>
              <p className="text-sm font-bold text-slate-900">
                {bucket.dcCount} <span className="text-xs font-normal text-slate-400">({bucket.balanceQty} units)</span>
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
