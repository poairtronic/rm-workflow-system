import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

export function AppLayout() {
  return (
    <div className="min-h-screen bg-[#f7f9fb]">
      <Sidebar />
      <TopBar />
      <main className="ml-[260px] mt-16 p-8 bg-[#f7f9fb] min-h-[calc(100vh-64px)]">
        <Outlet />
      </main>
    </div>
  );
}
