import { Outlet } from 'react-router-dom';

export function PrintableDocumentLayout() {
  return (
    <div className="min-h-screen bg-slate-100 print:bg-white print:m-0 print:p-0">
      <main className="w-full max-w-[210mm] min-h-[297mm] mx-auto bg-white shadow-lg print:shadow-none print:w-full print:max-w-none print:min-h-0 print:m-0 print:p-0">
        <Outlet />
      </main>
    </div>
  );
}
