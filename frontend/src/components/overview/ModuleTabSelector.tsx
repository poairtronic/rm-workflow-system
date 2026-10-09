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
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 p-1.5 bg-slate-100 rounded-xl border border-slate-200">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        const Icon = tab.icon;
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            className={`flex-1 flex items-center justify-between p-3.5 rounded-lg text-left transition-all font-medium ${
              isActive
                ? 'bg-white text-slate-900 shadow-sm border border-slate-200/80 ring-1 ring-slate-900/5'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`p-2 rounded-md shrink-0 transition-colors ${
                  isActive ? 'bg-primary/10 text-primary' : 'bg-slate-200 text-slate-600'
                }`}
              >
                <Icon className="w-4 h-4" />
              </div>
              <div className="truncate">
                <p className="text-sm font-semibold truncate leading-tight">{tab.label}</p>
                <p className="text-xs text-slate-500 font-normal truncate mt-0.5">{tab.desc}</p>
              </div>
            </div>
            <span
              className={`text-xs px-2 py-0.5 rounded-full shrink-0 font-semibold transition-colors ${
                isActive ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-600'
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

