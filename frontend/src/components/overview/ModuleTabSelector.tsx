import { Layers, Warehouse, Truck } from 'lucide-react';

export type OverviewTabKey = 'rm-workflow' | 'stock-inventory' | 'delivery-challan';

interface ModuleTabSelectorProps {
  activeTab: OverviewTabKey;
  onChange: (tab: OverviewTabKey) => void;
  counts: {
    scs: number;
    stock: number;
    dcs: number;
  };
}

export function ModuleTabSelector({ activeTab, onChange, counts }: ModuleTabSelectorProps) {
  const tabs = [
    {
      key: 'rm-workflow' as const,
      label: 'RM to Production',
      desc: 'Requisitions, Issues, Floor WIP & Completion',
      icon: Layers,
      badge: `${counts.scs} SCs`,
    },
    {
      key: 'stock-inventory' as const,
      label: 'Stock & Inventory',
      desc: 'Warehouse Balances, Movements & MSL',
      icon: Warehouse,
      badge: `${counts.stock.toLocaleString()} Total Stock`,
    },
    {
      key: 'delivery-challan' as const,
      label: 'Delivery Challan (DC)',
      desc: 'Vendor Dispatches, Custody & Returns',
      icon: Truck,
      badge: `${counts.dcs} Open DCs`,
    },
  ];

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 p-1.5 bg-slate-100 dark:bg-[#0e111f] rounded-2xl border border-slate-200 dark:border-[#1e233d]">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        const Icon = tab.icon;
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            className={`flex-1 flex items-center justify-between p-3 sm:p-3.5 min-h-[44px] rounded-xl text-left transition-all font-medium cursor-pointer ${
              isActive
                ? 'bg-white dark:bg-[#161a2e] text-slate-900 dark:text-white shadow-xs border border-slate-200/80 dark:border-[#283056] ring-1 ring-slate-900/5 dark:ring-indigo-500/20'
                : 'bg-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-[#161a2e]/60 border border-transparent'
            }`}
          >
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1 mr-2">
              <div
                className={`p-2 rounded-lg shrink-0 transition-colors ${
                  isActive
                    ? 'bg-primary/10 dark:bg-indigo-500/20 text-primary dark:text-indigo-400'
                    : 'bg-slate-200 dark:bg-[#1e233d] text-slate-600 dark:text-slate-400'
                }`}
              >
                <Icon className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-semibold truncate leading-tight">{tab.label}</p>
                <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 font-normal truncate mt-0.5">{tab.desc}</p>
              </div>
            </div>
            <span
              className={`text-[10px] sm:text-xs px-2 py-0.5 rounded-full shrink-0 font-semibold transition-colors ${
                isActive
                  ? 'bg-slate-900 dark:bg-indigo-600 text-white'
                  : 'bg-slate-200 dark:bg-[#1e233d] text-slate-600 dark:text-slate-300'
              }`}
            >
              {tab.badge}
            </span>
          </button>
        );
      })}
    </div>
  );
}

