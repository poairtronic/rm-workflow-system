import { mockBins } from '../../types/telemetry';
import { MapPin } from 'lucide-react';

interface Props {
  selectedBinId: string;
  onSelectBinId: (id: string) => void;
}

export function SourceBinSelector({ selectedBinId, onSelectBinId }: Props) {

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <MapPin className="w-5 h-5 text-slate-500" />
        <h2 className="text-[15px] font-semibold text-slate-900 mb-4 uppercase tracking-wide">Source Location Topology</h2>
      </div>
      
      <div className="flex flex-col sm:flex-row gap-3">
        {mockBins.map((bin) => {
          const isActive = bin.binId === selectedBinId;
          return (
            <button
              key={bin.binId}
              onClick={() => onSelectBinId(bin.binId)}
              className={`flex-1 flex flex-col items-start p-3 rounded-lg border text-left transition-all ${
                isActive
                  ? 'border-primary bg-primary/5 ring-1 ring-primary'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <span className={`text-xs font-semibold uppercase tracking-wider mb-1 ${isActive ? 'text-primary' : 'text-slate-500'}`}>
                {bin.binId}
              </span>
              <span className="text-sm font-medium text-slate-900 truncate w-full">
                {bin.materialSpec}
              </span>
              <span className="text-xs text-slate-500 mt-2 font-medium">
                Warehouse 1 &rarr; Bay B &rarr; {bin.binId.split('-')[2]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
