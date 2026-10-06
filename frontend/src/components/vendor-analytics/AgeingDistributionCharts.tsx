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
import type { AgeingBucket } from '../../types/vendor-analytics.dto';

interface AgeingDistributionChartsProps {
  data: AgeingBucket[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload as AgeingBucket;
    return (
      <div className="bg-white border border-slate-200 rounded-lg shadow-md p-4 min-w-[200px]">
        <p className="text-sm font-semibold text-slate-900 mb-3 border-b border-slate-100 pb-2">{label}</p>
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs text-slate-500 uppercase tracking-wider">Open DCs:</span>
          <span className="font-bold tabular-nums text-slate-900">{data.dcCount}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-slate-500 uppercase tracking-wider">Value Trapped:</span>
          <span className="font-bold tabular-nums text-slate-900">${data.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
      </div>
    );
  }
  return null;
};

export function AgeingDistributionCharts({ data = [] }: AgeingDistributionChartsProps) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 mb-6">
      <h3 className="text-[15px] font-semibold text-slate-900 uppercase tracking-wide mb-6 pb-4 border-b border-slate-100">
        DC Ageing Risk Distribution
      </h3>
      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
            <XAxis 
              dataKey="name" 
              tick={{ fontSize: 12, fill: '#64748B', fontWeight: 500 }} 
              axisLine={false} 
              tickLine={false} 
              dy={10}
            />
            <YAxis 
              yAxisId="left"
              tick={{ fontSize: 12, fill: '#64748B' }} 
              axisLine={false} 
              tickLine={false} 
              dx={-10}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: '#F1F5F9', opacity: 0.5 }} />
            <Bar yAxisId="left" dataKey="dcCount" name="Open DCs" radius={[6, 6, 0, 0]} barSize={50}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
