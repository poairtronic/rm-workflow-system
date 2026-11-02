import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { io, Socket } from 'socket.io-client';
import { APP_CONFIG } from '../../app/config';
import { ecrIssuesService } from '../../services/ecrIssues.service';
import type { EcrIssuePending } from '../../types/ecrIssues.types';
import { LogOut, X } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ROUTE_CONFIG, isPathAllowedForUser } from '../../routeConfig';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ isOpen = false, onClose }: SidebarProps) {
  const { currentUser, logout } = useAuth();
  const location = useLocation();
  const queryClient = useQueryClient();

  // Fetch pending count from GET /api/ecr-issues
  const { data: ecrIssues = [] } = useQuery<EcrIssuePending[]>({
    queryKey: ['ecr-issues'],
    queryFn: () => ecrIssuesService.getEcrIssues(),
    enabled: !!currentUser,
    staleTime: 30000,
  });

  const pendingEcrCount = useMemo(() => {
    return (ecrIssues || []).filter((i) => i.status === 'PENDING').length;
  }, [ecrIssues]);

  // Update badge when socket event arrives
  useEffect(() => {
    if (!currentUser) return;
    const token = localStorage.getItem('rm_access_token');
    if (!token) return;

    const backendUrl = APP_CONFIG.apiBaseUrl || 'http://localhost:3000';
    const socket: Socket = io(backendUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
    });

    socket.on('notification', (payload: any) => {
      if (payload?.type === 'ECR_ISSUE') {
        queryClient.invalidateQueries({ queryKey: ['ecr-issues'] });
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [currentUser, queryClient]);

  // Close mobile drawer on route change
  useEffect(() => {
    if (isOpen && onClose) {
      onClose();
    }
  }, [location.pathname]);

  // Close mobile drawer on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && onClose) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const navItems = ROUTE_CONFIG.filter(item => {
    if (!item.isSidebar || !currentUser) return false;
    return isPathAllowedForUser(item.path, currentUser);
  });

  // Group items by `group` property
  const groupedItems = navItems.reduce((acc, item) => {
    const groupName = item.group || 'GENERAL';
    if (!acc[groupName]) acc[groupName] = [];
    acc[groupName].push(item);
    return acc;
  }, {} as Record<string, typeof navItems>);

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-40 md:hidden animate-in fade-in duration-200"
          aria-hidden="true"
        />
      )}

      {/* Responsive Sidebar / Mobile Slide-Over Drawer */}
      <aside
        className={`fixed top-0 bottom-0 left-0 w-[280px] md:w-[260px] bg-white dark:bg-[#0d0f1b] border-r border-slate-200 dark:border-[#1a1e33] z-50 md:z-30 flex flex-col transition-transform duration-200 ease-in-out ${
          isOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="h-16 flex items-center justify-between px-6 border-b border-slate-200 dark:border-[#1a1e33]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/15 border border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-black text-sm shadow-xs">
              V
            </div>
            <div>
              <span className="font-bold text-base tracking-tight text-slate-900 dark:text-white block leading-none">V-SMART</span>
              <span className="text-[10px] text-slate-400 dark:text-[#7a879e] font-medium tracking-wider uppercase">Material Governance</span>
            </div>
          </div>
          {/* Mobile Drawer Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#161a2e] transition-colors cursor-pointer"
            aria-label="Close navigation drawer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 p-3.5 overflow-y-auto space-y-4">
          {Object.entries(groupedItems).map(([group, items]) => (
            <div key={group} className="space-y-1">
              {group !== 'GENERAL' && group !== 'OVERVIEW' && (
                <h3 className="text-[11px] font-bold text-slate-400 dark:text-[#55627a] uppercase tracking-wider mb-1.5 px-3">
                  {group}
                </h3>
              )}
              <div className="space-y-0.5">
                {items.map((item) => {
                  const Icon = item.icon!;
                  return (
                    <NavLink
                      key={item.name}
                      to={item.path}
                      onClick={() => onClose?.()}
                      className={({ isActive }: { isActive: boolean }) =>
                        `flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                          isActive
                            ? 'bg-primary/10 text-primary dark:bg-indigo-500/15 dark:text-indigo-400 dark:border dark:border-indigo-500/25 shadow-xs'
                            : 'text-slate-600 dark:text-[#94a3b8] hover:bg-slate-50 dark:hover:bg-[#141829] hover:text-slate-900 dark:hover:text-slate-100'
                        }`
                      }
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="truncate flex-1">{item.name}</span>
                      {item.path === '/governance/ecr-issues' && pendingEcrCount > 0 && (
                        <span className="ml-auto px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                          {pendingEcrCount}
                        </span>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        
        {currentUser && (
          <div className="p-3.5 border-t border-slate-200 dark:border-[#1a1e33] bg-slate-50 dark:bg-[#0a0c16]">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs shrink-0">
                {(currentUser.name || currentUser.email).charAt(0).toUpperCase()}
              </div>
              <div className="overflow-hidden min-w-0">
                <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{currentUser.name || 'User'}</p>
                <p className="text-[10px] text-slate-500 dark:text-[#7a879e] font-medium capitalize truncate">{currentUser.role.toLowerCase().replace('_', ' ')}</p>
              </div>
            </div>
            <button 
              onClick={() => {
                onClose?.();
                logout();
              }}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 bg-white dark:bg-[#161a2e] border border-red-200 dark:border-rose-900/40 rounded-lg hover:bg-red-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer shadow-2xs"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
