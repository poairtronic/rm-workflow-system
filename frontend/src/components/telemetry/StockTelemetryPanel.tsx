import { mockBins } from '../../types/telemetry';
import { Lock, Unlock, Database } from 'lucide-react';

export function StockTelemetryPanel({ selectedBinId }: { selectedBinId: string }) {
  // Simulating the selected bin
  const activeBin = mockBins.find(b => b.binId === selectedBinId) || mockBins[0];

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 mb-6 flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-slate-500" />
          <h2 className="text-[15px] font-semibold text-slate-900 mb-4 uppercase tracking-wide">Real-time Telemetry</h2>
        </div>
        
        {activeBin.isLocked ? (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-medium border border-amber-200 shadow-sm">
            <Lock className="w-3.5 h-3.5" />
            <span>BIN LOCKED (TX_ACTIVE)</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-medium border border-slate-200">
            <Unlock className="w-3.5 h-3.5" />
            <span>AVAILABLE</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="flex flex-col gap-1 border-r border-slate-200">
          <span className="text-xs uppercase font-medium text-slate-500 tracking-wider mb-1">Stock On Hand</span>
          <div className="text-2xl font-bold text-slate-900 tabular-nums">
            {activeBin.stockOnHand.toFixed(1)} <span className="text-sm font-medium text-slate-500 ml-0.5">KG</span>
          </div>
        </div>
        
        <div className="flex flex-col gap-1 border-r border-slate-200 pl-2">
          <span className="text-xs uppercase font-medium text-slate-500 tracking-wider mb-1">Allocated</span>
          <div className="text-2xl font-bold text-slate-900 tabular-nums">
            {activeBin.allocated.toFixed(1)} <span className="text-sm font-medium text-slate-500 ml-0.5">KG</span>
          </div>
        </div>

        <div className="flex flex-col gap-1 pl-2">
          <span className="text-xs uppercase font-medium text-slate-500 tracking-wider mb-1">Free Balance</span>
          <div className="text-2xl font-bold text-slate-900 tabular-nums">
            {activeBin.freeBalance.toFixed(1)} <span className="text-sm font-medium text-slate-500 ml-0.5">KG</span>
          </div>
        </div>
      </div>
      
      <div className="mt-5 bg-slate-50 rounded-lg p-3 border border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
        <span>Capacity Utilization</span>
        <span className="tabular-nums font-bold text-slate-700">
          {((activeBin.stockOnHand / activeBin.capacity) * 100).toFixed(1)}% ({activeBin.capacity} KG)
        </span>
      </div>
    </div>
  );
}
