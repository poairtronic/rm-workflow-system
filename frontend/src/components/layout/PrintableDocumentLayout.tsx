import { Outlet } from 'react-router-dom';

export function PrintableDocumentLayout() {
  return (
    <div className="min-h-screen bg-slate-100 print:bg-white print:m-0 print:p-0">
      <Outlet />
    </div>
  );
}
