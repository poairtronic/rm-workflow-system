import { Scale, AlertCircle, CheckCircle2 } from 'lucide-react';
import type { ReconciliationMetrics } from '../../types/traceability.dto';

interface ZeroLossReconciliationProps {
  metrics: ReconciliationMetrics;
}

export function ZeroLossReconciliation({ metrics }: ZeroLossReconciliationProps) {
  const isDeficit = metrics.varianceKg < 0;
  const uom = metrics.uom || 'UOM';
  
  // Base styling depends on balance
  const containerStyle = metrics.isBalanced 
    ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800' 
    : isDeficit 
      ? 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800'
      : 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800';
      
  const headerBgStyle = metrics.isBalanced
    ? 'bg-emerald-100/50 dark:bg-emerald-900/30 border-emerald-200/70 dark:border-emerald-800'
    : isDeficit
      ? 'bg-rose-100/50 dark:bg-rose-900/30 border-rose-200/70 dark:border-rose-800'
      : 'bg-amber-100/50 dark:bg-amber-900/30 border-amber-200/70 dark:border-amber-800';

  const textStyle = metrics.isBalanced 
    ? 'text-emerald-900 dark:text-emerald-200' 
    : isDeficit 
      ? 'text-rose-900 dark:text-rose-200'
      : 'text-amber-900 dark:text-amber-200';

  const totalReturned = Number((metrics.totalReturnedUsableKg + metrics.totalScrapKg).toFixed(2));

  return (
    <div className={`border rounded-xl shadow-xs overflow-hidden ${containerStyle}`}>
      <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-4 border-b ${headerBgStyle}`}>
        <div className="flex items-center gap-2.5">
          <Scale className={`w-5 h-5 ${textStyle}`} />
          <h2 className={`text-[15px] font-bold uppercase tracking-wide ${textStyle}`}>
            Zero-Loss Mass Balance Reconciliation Audit
          </h2>
        </div>
        <div>
          {metrics.isBalanced ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Perfectly Balanced
            </span>
          ) : (
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${isDeficit ? 'bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200 border border-rose-300 dark:border-rose-700' : 'bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-700'}`}>
              <AlertCircle className="w-3.5 h-3.5" /> Variance Detected
            </span>
          )}
        </div>
      </div>

      <div className="p-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3 md:gap-4">
          {/* Issued (Input) */}
          <div className="flex-1 w-full bg-white dark:bg-[#121526] p-4 rounded-xl border border-slate-200/80 dark:border-[#1e233d] shadow-2xs text-center">
            <p className="text-xs uppercase tracking-wider mb-1.5 font-bold text-slate-500 dark:text-slate-400">
              Total Issued (Input)
            </p>
            <p className="text-2xl font-extrabold text-slate-900 dark:text-white tabular-nums">
              {metrics.totalIssuedKg.toFixed(2)} <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">{uom}</span>
            </p>
            <p className="text-[11px] text-slate-400 mt-1">Raw material issued to production</p>
          </div>
          
          <div className="text-2xl font-bold text-slate-400 select-none px-2 shrink-0 hidden md:block">=</div>
          <div className="text-xl font-bold text-slate-400 select-none py-1 md:hidden">=</div>

          {/* Consumed (Output) */}
          <div className="flex-1 w-full bg-white dark:bg-[#121526] p-4 rounded-xl border border-slate-200/80 dark:border-[#1e233d] shadow-2xs text-center">
            <p className="text-xs uppercase tracking-wider mb-1.5 font-bold text-slate-500 dark:text-slate-400">
              Consumed (Parts Output)
            </p>
            <p className="text-2xl font-extrabold text-slate-900 dark:text-white tabular-nums">
              {metrics.totalConsumedKg.toFixed(2)} <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">{uom}</span>
            </p>
            <p className="text-[11px] text-slate-400 mt-1">Net quantity consumed on shop floor</p>
          </div>
          
          <div className="text-2xl font-bold text-slate-400 select-none px-2 shrink-0 hidden md:block">+</div>
          <div className="text-xl font-bold text-slate-400 select-none py-1 md:hidden">+</div>

          {/* Returned (Output) */}
          <div className="flex-1 w-full bg-white dark:bg-[#121526] p-4 rounded-xl border border-slate-200/80 dark:border-[#1e233d] shadow-2xs text-center">
            <p className="text-xs uppercase tracking-wider mb-1.5 font-bold text-slate-500 dark:text-slate-400">
              Returned Material (Usable / Scrap)
            </p>
            <p className="text-2xl font-extrabold text-slate-900 dark:text-white tabular-nums">
              {totalReturned.toFixed(2)} <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">{uom}</span>
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Usable: <span className="font-semibold text-slate-700 dark:text-slate-300">{metrics.totalReturnedUsableKg.toFixed(2)} {uom}</span>
              {' • '}
              Scrap: <span className="font-semibold text-slate-700 dark:text-slate-300">{metrics.totalScrapKg.toFixed(2)} {uom}</span>
            </p>
          </div>
        </div>

        {/* Variance Callout */}
        {!metrics.isBalanced && (
          <div className={`mt-5 p-4 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3 border ${isDeficit ? 'bg-rose-100/70 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200' : 'bg-amber-100/70 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200'}`}>
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <div>
                <span className="text-sm font-bold uppercase tracking-wider">Unaccounted Material Variance:</span>
                <p className="text-xs opacity-90 mt-0.5">
                  Difference between total issued raw material and total accounted consumed & returned quantities.
                </p>
              </div>
            </div>
            <span className={`text-xl font-extrabold tabular-nums shrink-0 ${isDeficit ? 'text-rose-700 dark:text-rose-400' : 'text-amber-700 dark:text-amber-400'}`}>
              {metrics.varianceKg > 0 ? '+' : ''}{metrics.varianceKg.toFixed(2)} {uom}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
