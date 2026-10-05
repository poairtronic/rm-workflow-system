import { Scale, AlertCircle, CheckCircle2 } from 'lucide-react';
import type { ReconciliationMetrics } from '../../types/traceability.dto';

interface ZeroLossReconciliationProps {
  metrics: ReconciliationMetrics;
}

export function ZeroLossReconciliation({ metrics }: ZeroLossReconciliationProps) {
  const isDeficit = metrics.varianceKg < 0;
  
  // Base styling depends on balance
  const containerStyle = metrics.isBalanced 
    ? 'bg-emerald-50 border-emerald-200' 
    : isDeficit 
      ? 'bg-red-50 border-red-200'
      : 'bg-amber-50 border-amber-200';
      
  const textStyle = metrics.isBalanced 
    ? 'text-emerald-800' 
    : isDeficit 
      ? 'text-red-800'
      : 'text-amber-800';

  return (
    <div className={`border rounded-xl shadow-sm overflow-hidden mb-6 ${containerStyle}`}>
      <div className={`flex items-center gap-3 px-6 py-4 border-b ${metrics.isBalanced ? 'border-emerald-200/50' : isDeficit ? 'border-red-200/50' : 'border-amber-200/50'}`}>
        <Scale className={`w-5 h-5 ${textStyle}`} />
        <h2 className={`text-sm font-bold uppercase tracking-wide ${textStyle}`}>
          Zero-Loss Reconciliation Audit
        </h2>
        <div className="ml-auto">
          {metrics.isBalanced ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
              <CheckCircle2 className="w-3.5 h-3.5" /> Perfectly Balanced
            </span>
          ) : (
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${isDeficit ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>
              <AlertCircle className="w-3.5 h-3.5" /> Variance Detected
            </span>
          )}
        </div>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center text-center">
          {/* Issued (Input) */}
          <div className="bg-white/60 p-4 rounded-lg border border-white/40 shadow-sm">
            <p className="text-xs uppercase tracking-wider mb-1 font-semibold opacity-70">Total Issued</p>
            <p className="text-xl font-bold tabular-nums">{metrics.totalIssuedKg.toFixed(2)} <span className="text-sm font-medium">kg</span></p>
          </div>
          
          <div className="text-2xl font-bold opacity-40 select-none">=</div>

          {/* Consumed (Output) */}
          <div className="bg-white/60 p-4 rounded-lg border border-white/40 shadow-sm">
            <p className="text-xs uppercase tracking-wider mb-1 font-semibold opacity-70">Consumed</p>
            <p className="text-xl font-bold tabular-nums">{metrics.totalConsumedKg.toFixed(2)} <span className="text-sm font-medium">kg</span></p>
          </div>
          
          <div className="text-2xl font-bold opacity-40 select-none">+</div>

          {/* Returned (Output) */}
          <div className="bg-white/60 p-4 rounded-lg border border-white/40 shadow-sm">
            <p className="text-xs uppercase tracking-wider mb-1 font-semibold opacity-70">Returned (Scrap/Usable)</p>
            <p className="text-xl font-bold tabular-nums">{(metrics.totalReturnedUsableKg + metrics.totalScrapKg).toFixed(2)} <span className="text-sm font-medium">kg</span></p>
          </div>
        </div>

        {/* Variance Callout */}
        {!metrics.isBalanced && (
          <div className={`mt-6 p-4 rounded-lg flex items-center justify-between ${isDeficit ? 'bg-red-100/50' : 'bg-amber-100/50'}`}>
            <span className="text-sm font-semibold uppercase tracking-wider opacity-80">Unaccounted Variance:</span>
            <span className={`text-xl font-bold tabular-nums ${isDeficit ? 'text-red-600' : 'text-amber-600'}`}>
              {metrics.varianceKg > 0 ? '+' : ''}{metrics.varianceKg.toFixed(2)} kg
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
