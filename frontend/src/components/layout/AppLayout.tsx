import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { ErrorBoundary } from './ErrorBoundary';

export function AppLayout() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] overflow-x-clip">
      <Sidebar />
      <TopBar />
      <main className="ml-[260px] mt-16 p-8 bg-[#F8FAFC] min-h-[calc(100vh-64px)] max-w-[calc(100vw-260px)]">
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </main>
    </div>
  );
}
