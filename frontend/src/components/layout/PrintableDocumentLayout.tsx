import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { RouteLoadingSkeleton } from '../common/RouteLoadingSkeleton';

export function PrintableDocumentLayout() {
  return (
    <div className="min-h-screen bg-slate-100 print:bg-white print:m-0 print:p-0 print:min-h-0 print:h-auto print:overflow-visible print:block">
      <Suspense fallback={<RouteLoadingSkeleton />}>
        <Outlet />
      </Suspense>
    </div>
  );
}
