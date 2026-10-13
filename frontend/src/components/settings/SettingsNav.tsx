import { NavLink, useLocation } from 'react-router-dom';
import {
  Settings,
  User,
  KeyRound,
  Shield,
  Laptop,
  Clock,
  FileCheck2,
  Mail,
} from 'lucide-react';

interface SettingsNavProps {
  onTabSelect?: (tab: string) => void;
  activeExtraTab?: string;
}

export function SettingsNav({ onTabSelect, activeExtraTab }: SettingsNavProps) {
  const location = useLocation();

  const navItems = [
    {
      name: 'System Configuration',
      path: '/settings',
      icon: Settings,
      exact: true,
    },
    {
      name: 'Edit Profile',
      path: '/profile',
      icon: User,
    },
    {
      name: 'Change Password',
      path: '/profile?tab=password',
      icon: KeyRound,
      isAction: true,
      onClick: () => onTabSelect?.('password'),
    },
    {
      name: 'Security Dashboard',
      path: '/settings/security',
      icon: Shield,
      isExtra: true,
      tabKey: 'security',
    },
    {
      name: 'Active Sessions',
      path: '/settings/sessions',
      icon: Laptop,
      isExtra: true,
      tabKey: 'sessions',
    },
    {
      name: 'Login History',
      path: '/settings/login-history',
      icon: Clock,
      isExtra: true,
      tabKey: 'history',
    },
    {
      name: 'Audit Logs',
      path: '/audit-logs',
      icon: FileCheck2,
    },
    {
      name: 'Email & Communication',
      path: '/communication',
      icon: Mail,
    },
  ];

  return (
    <div className="w-64 bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm shrink-0 h-fit sticky top-24">
      <div className="px-3 py-2 mb-2">
        <h2 className="text-xs font-bold text-slate-400 tracking-wider uppercase">
          System Settings
        </h2>
      </div>

      <nav className="space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          
          if (item.isExtra && onTabSelect) {
            const isTabActive = activeExtraTab === item.tabKey;
            return (
              <button
                key={item.name}
                type="button"
                onClick={() => onTabSelect(item.tabKey!)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left ${
                  isTabActive
                    ? 'bg-purple-50 text-purple-700 font-semibold shadow-sm'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Icon className={`w-4 h-4 ${isTabActive ? 'text-purple-600' : 'text-slate-400'}`} />
                <span>{item.name}</span>
              </button>
            );
          }

          if (item.isAction) {
            return (
              <NavLink
                key={item.name}
                to={item.path}
                onClick={item.onClick}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  location.pathname === '/profile' && location.search.includes('password')
                    ? 'bg-purple-50 text-purple-700 font-semibold shadow-sm'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Icon className="w-4 h-4 text-slate-400" />
                <span>{item.name}</span>
              </NavLink>
            );
          }

          const isActive =
            location.pathname === item.path ||
            (item.path === '/settings' && location.pathname.startsWith('/settings/config'));

          return (
            <NavLink
              key={item.name}
              to={item.path}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? 'bg-purple-50 text-purple-700 font-semibold shadow-sm'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-purple-600' : 'text-slate-400'}`} />
              <span>{item.name}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
