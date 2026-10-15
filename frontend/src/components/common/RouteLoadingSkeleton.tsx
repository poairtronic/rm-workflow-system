export function RouteLoadingSkeleton() {
  return (
    <div className="w-full space-y-6 animate-pulse" role="status" aria-label="Loading workspace...">
      {/* Top Header Shimmer */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="h-7 w-52 bg-slate-200 dark:bg-slate-800 rounded-lg" />
          <div className="h-4 w-72 bg-slate-100 dark:bg-slate-800/60 rounded" />
        </div>
        <div className="flex gap-2.5">
          <div className="h-9 w-24 bg-slate-200 dark:bg-slate-800 rounded-lg" />
          <div className="h-9 w-32 bg-slate-200 dark:bg-slate-800 rounded-lg" />
        </div>
      </div>

      {/* 4-Stat Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3.5 shadow-xs"
          >
            <div className="flex justify-between items-center">
              <div className="h-4 w-24 bg-slate-200 dark:bg-slate-800 rounded" />
              <div className="h-8 w-8 bg-slate-100 dark:bg-slate-800/80 rounded-lg" />
            </div>
            <div className="h-8 w-20 bg-slate-200 dark:bg-slate-800 rounded-lg" />
            <div className="h-3 w-32 bg-slate-100 dark:bg-slate-800/60 rounded" />
          </div>
        ))}
      </div>

      {/* Main Table / Grid Container Shimmer */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-slate-100 dark:border-slate-800 gap-3">
          <div className="h-5 w-40 bg-slate-200 dark:bg-slate-800 rounded" />
          <div className="flex gap-2">
            <div className="h-8 w-44 bg-slate-100 dark:bg-slate-800 rounded-lg" />
            <div className="h-8 w-20 bg-slate-200 dark:bg-slate-800 rounded-lg" />
          </div>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex items-center justify-between py-3.5 gap-4">
              <div className="h-4 w-1/4 bg-slate-100 dark:bg-slate-800/80 rounded" />
              <div className="h-4 w-1/6 bg-slate-100 dark:bg-slate-800/70 rounded hidden sm:block" />
              <div className="h-4 w-1/6 bg-slate-100 dark:bg-slate-800/70 rounded hidden md:block" />
              <div className="h-4 w-20 bg-slate-100 dark:bg-slate-800/70 rounded" />
              <div className="h-6 w-20 bg-slate-200 dark:bg-slate-800 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
