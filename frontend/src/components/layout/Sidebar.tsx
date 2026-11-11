import { useEffect, useMemo, useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { io, Socket } from 'socket.io-client';
import { APP_CONFIG } from '../../app/config';
import { ecrIssuesService } from '../../services/ecrIssues.service';
import type { EcrIssuePending } from '../../types/ecrIssues.types';
import { mercIndentService } from '../../services/mercIndent.service';
import type { MercIndentSummary } from '../../types/mercIndent.types';
import { LogOut, X } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ROUTE_CONFIG, isPathAllowedForUser } from '../../routeConfig';

const MIN_SIDEBAR_WIDTH = 200;
const DEFAULT_SIDEBAR_WIDTH = 260;
const MAX_SIDEBAR_WIDTH = 480;

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ isOpen = false, onClose }: SidebarProps) {
  const { currentUser, logout } = useAuth();
  const location = useLocation();
  const queryClient = useQueryClient();

  // Resizable sidebar state with persistent local storage
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    if (typeof window === 'undefined') return DEFAULT_SIDEBAR_WIDTH;
    try {
      const saved = localStorage.getItem('vsmart_sidebar_width');
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= MIN_SIDEBAR_WIDTH && parsed <= MAX_SIDEBAR_WIDTH) {
          return parsed;
        }
      }
    } catch {}
    return DEFAULT_SIDEBAR_WIDTH;
  });

  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false);

  // Synchronize CSS custom property on documentElement
  useEffect(() => {
    document.documentElement.style.setProperty('--sidebar-width', `${sidebarWidth}px`);
  }, [sidebarWidth]);

  // Pointer drag event handlers for mouse and touch
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    isDraggingRef.current = true;
    setIsDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    const maxAllowed = Math.min(MAX_SIDEBAR_WIDTH, Math.floor(window.innerWidth * 0.5));
    const newWidth = Math.max(MIN_SIDEBAR_WIDTH, Math.min(maxAllowed, Math.round(e.clientX)));
    setSidebarWidth(newWidth);
    document.documentElement.style.setProperty('--sidebar-width', `${newWidth}px`);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    setIsDragging(false);
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    const maxAllowed = Math.min(MAX_SIDEBAR_WIDTH, Math.floor(window.innerWidth * 0.5));
    const finalWidth = Math.max(MIN_SIDEBAR_WIDTH, Math.min(maxAllowed, Math.round(e.clientX)));
    try {
      localStorage.setItem('vsmart_sidebar_width', finalWidth.toString());
    } catch {}
  };

  const handleResetWidth = () => {
    setSidebarWidth(DEFAULT_SIDEBAR_WIDTH);
    document.documentElement.style.setProperty('--sidebar-width', `${DEFAULT_SIDEBAR_WIDTH}px`);
    try {
      localStorage.setItem('vsmart_sidebar_width', DEFAULT_SIDEBAR_WIDTH.toString());
    } catch {}
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const maxAllowed = Math.min(MAX_SIDEBAR_WIDTH, Math.floor(window.innerWidth * 0.5));
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const next = Math.max(MIN_SIDEBAR_WIDTH, sidebarWidth - 10);
      setSidebarWidth(next);
      document.documentElement.style.setProperty('--sidebar-width', `${next}px`);
      try { localStorage.setItem('vsmart_sidebar_width', next.toString()); } catch {}
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      const next = Math.min(maxAllowed, sidebarWidth + 10);
      setSidebarWidth(next);
      document.documentElement.style.setProperty('--sidebar-width', `${next}px`);
      try { localStorage.setItem('vsmart_sidebar_width', next.toString()); } catch {}
    } else if (e.key === 'Home' || e.key === 'Enter') {
      e.preventDefault();
      handleResetWidth();
    }
  };

  // Window drag fallback cleanup
  useEffect(() => {
    if (!isDragging) return;
    const onGlobalPointerUp = () => {
      isDraggingRef.current = false;
      setIsDragging(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('pointerup', onGlobalPointerUp);
    window.addEventListener('pointercancel', onGlobalPointerUp);
    return () => {
      window.removeEventListener('pointerup', onGlobalPointerUp);
      window.removeEventListener('pointercancel', onGlobalPointerUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging]);

  // Fetch pending count from GET /api/ecr-issues (only if user has access to ECR Material Issue)
  const isEcrAllowed = Boolean(currentUser && isPathAllowedForUser('/governance/ecr-issues', currentUser));
  const { data: ecrIssues = [] } = useQuery<EcrIssuePending[]>({
    queryKey: ['ecr-issues'],
    queryFn: () => ecrIssuesService.getEcrIssues(),
    enabled: isEcrAllowed,
    staleTime: 30000,
    retry: false,
  });

  const pendingEcrCount = useMemo(() => {
    return isEcrAllowed ? (ecrIssues || []).filter((i) => i.status === 'PENDING').length : 0;
  }, [ecrIssues, isEcrAllowed]);

  // Fetch pending count from GET /api/merc-indents (only if user has access to MERC Indents)
  const isMercAllowed = Boolean(currentUser && isPathAllowedForUser('/governance/merc-indents', currentUser));
  const { data: mercIndents = [] } = useQuery<MercIndentSummary[]>({
    queryKey: ['merc-indents'],
    queryFn: () => mercIndentService.getMercIndents(),
    enabled: isMercAllowed,
    staleTime: 30000,
    retry: false,
  });

  const pendingMercCount = useMemo(() => {
    return isMercAllowed ? (mercIndents || []).filter((i) => i.status === 'PENDING' || i.status === 'PARTIAL').length : 0;
  }, [mercIndents, isMercAllowed]);

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
      if (payload?.type === 'ECR_ISSUE' && isEcrAllowed) {
        queryClient.invalidateQueries({ queryKey: ['ecr-issues'] });
      }
      if (payload?.type === 'MERC_INDENT' && isMercAllowed) {
        queryClient.invalidateQueries({ queryKey: ['merc-indents'] });
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [currentUser, queryClient, isEcrAllowed, isMercAllowed]);

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
        className={`fixed top-0 bottom-0 left-0 w-[280px] md:w-[260px] app-sidebar-fixed bg-white dark:bg-[#0d0f1b] border-r border-slate-200 dark:border-[#1a1e33] z-50 md:z-30 flex flex-col transition-transform duration-200 ease-in-out ${
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
                      {item.path === '/governance/merc-indents' && pendingMercCount > 0 && (
                        <span className="ml-auto px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                          {pendingMercCount}
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
        {/* Drag Resize Handle (Desktop Only) */}
        <div
          role="separator"
          tabIndex={0}
          aria-orientation="vertical"
          aria-label="Resize Sidebar Navigation"
          aria-valuenow={sidebarWidth}
          aria-valuemin={MIN_SIDEBAR_WIDTH}
          aria-valuemax={MAX_SIDEBAR_WIDTH}
          title="Drag to resize sidebar width • Double-click to reset"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onDoubleClick={handleResetWidth}
          onKeyDown={handleKeyDown}
          className="hidden md:flex absolute top-0 bottom-0 -right-1.5 w-3 cursor-col-resize z-50 items-center justify-center group select-none touch-none focus:outline-none"
        >
          {/* Subtle line indicator */}
          <div
            className={`absolute top-0 bottom-0 right-[5px] w-[2px] transition-colors duration-150 ${
              isDragging
                ? 'bg-indigo-600 dark:bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)]'
                : 'bg-transparent group-hover:bg-indigo-500/50 group-focus-visible:bg-indigo-500'
            }`}
          />
          {/* Subtle grip handle pill on hover/drag */}
          <div
            className={`w-1.5 h-7 rounded-full transition-all duration-150 flex items-center justify-center ${
              isDragging
                ? 'bg-indigo-600 dark:bg-indigo-400 shadow-md scale-110'
                : 'bg-slate-300 dark:bg-slate-600 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100'
            }`}
          />
        </div>
      </aside>

      {/* Invisible global overlay while dragging to prevent text selection / iframe interception */}
      {isDragging && (
        <div
          className="fixed inset-0 z-[9999] cursor-col-resize select-none bg-transparent"
          aria-hidden="true"
        />
      )}
    </>
  );
}
