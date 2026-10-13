import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { ErrorBoundary } from './ErrorBoundary';

export function AppLayout() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#090a10] text-slate-900 dark:text-slate-100 overflow-x-clip transition-colors duration-150">
      <Sidebar />
      <TopBar />
      <main className="ml-[260px] mt-16 p-8 bg-[#F8FAFC] dark:bg-[#090a10] min-h-[calc(100vh-64px)] max-w-[calc(100vw-260px)] transition-colors duration-150">
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </main>
    </div>
  );
}
