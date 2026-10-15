import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { RouteLoadingSkeleton } from '../common/RouteLoadingSkeleton';

export function PrintableDocumentLayout() {
  return (
    <div className="min-h-screen bg-slate-100 print:bg-white print:m-0 print:p-0">
      <Suspense fallback={<RouteLoadingSkeleton />}>
        <Outlet />
      </Suspense>
    </div>
  );
}
