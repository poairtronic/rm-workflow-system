import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import type { PoMaterialChartData, PoStatusDistribution } from '../../types/po-traceability.dto';

interface PoMaterialChartsProps {
  materialData: PoMaterialChartData[];
  statusData: PoStatusDistribution[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg shadow-md p-3">
        <p className="text-sm font-semibold text-slate-900 mb-2">{label || payload[0]?.name}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-xs text-slate-600 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }}></span>
            <span className="capitalize">{entry.name}:</span>
            <span className="font-bold tabular-nums text-slate-900">
              {entry.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {entry.name.includes('Kg') || entry.dataKey?.includes('Kg') ? 'KG' : ''}
            </span>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export function PoMaterialCharts({ materialData, statusData }: PoMaterialChartsProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
      
      {/* Material Comparison Bar Chart */}
      <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl shadow-sm p-6">
        <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-6">
          RM Allocation vs. Consumption
        </h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={materialData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
              <XAxis dataKey="materialCategory" tick={{ fontSize: 12, fill: '#64748B' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: '#64748B' }} axisLine={false} tickLine={false} tickFormatter={(val) => `${val}kg`} />
              <Tooltip content={<CustomTooltip />} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
              <Bar dataKey="requestedKg" name="Requested" fill="#3B82F6" radius={[4, 4, 0, 0]} barSize={30} />
              <Bar dataKey="consumedKg" name="Consumed" fill="#10B981" radius={[4, 4, 0, 0]} barSize={30} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Status Distribution Donut */}
      <div className="lg:col-span-1 bg-white border border-slate-200 rounded-xl shadow-sm p-6 flex flex-col">
        <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-2">
          Component Status Mix
        </h3>
        <div className="flex-1 min-h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={statusData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
                nameKey="name"
              >
                {statusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                verticalAlign="bottom" 
                height={36} 
                iconType="circle"
                wrapperStyle={{ fontSize: '12px' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

    </div>
  );
}
