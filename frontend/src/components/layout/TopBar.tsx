import { useState, useRef, useEffect, useMemo } from 'react';
import { Search, LogOut, KeyRound, X, Truck, Package, Settings, Building2, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { NotificationBell } from '../notifications/NotificationBell';
import { ChangePasswordModal } from '../auth/ChangePasswordModal';
import { deliveryChallanApi, productionProcessApi, api, unwrapList } from '../../services/api';

export function TopBar() {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Data fetching for global search
  const { data: challans = [] } = useQuery({
    queryKey: ['global-search-challans'],
    queryFn: () => deliveryChallanApi.getAll(),
    staleTime: 60000,
  });

  const { data: processes = [] } = useQuery({
    queryKey: ['global-search-processes'],
    queryFn: () => productionProcessApi.getAll(),
    staleTime: 60000,
  });

  const { data: vendors = [] } = useQuery({
    queryKey: ['global-search-vendors'],
    queryFn: () => productionProcessApi.getVendors(),
    staleTime: 60000,
  });

  const { data: products = [] } = useQuery({
    queryKey: ['global-search-products'],
    queryFn: async () => unwrapList(await api.get<any[]>('/api/products')),
    staleTime: 60000,
  });

  // Hotkey listener: Ctrl+K or Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Click outside to dismiss dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Smart search match function with morphological stemming (e.g. "heating" matches "heat", "heat treatment")
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return null;

    const tokens = q.split(/\s+/).filter(Boolean);
    const matchField = (fieldVal?: string | null) => {
      if (!fieldVal) return false;
      const val = fieldVal.toLowerCase();
      if (val.includes(q)) return true;
      return tokens.some((t) => {
        if (val.includes(t)) return true;
        // Morphological endings (e.g. heating -> heat, turning -> turn)
        if (t.endsWith('ing') && t.length > 4 && val.includes(t.slice(0, -3))) return true;
        if (t.endsWith('ed') && t.length > 4 && val.includes(t.slice(0, -2))) return true;
        if (t === 'heating' && (val.includes('heat') || val.includes('ht'))) return true;
        if (t === 'ht' && val.includes('heat')) return true;
        return false;
      });
    };

    // 1. Matched Delivery Challans
    const matchedDcs = (challans as any[]).filter((dc) => {
      if (matchField(dc.challanNumber || dc.dcNumber)) return true;
      if (matchField(dc.vendorName || dc.vendor?.name)) return true;
      if (matchField(dc.processName || dc.process?.name || dc.process?.nomenclature)) return true;
      if (matchField(dc.notes)) return true;
      if (matchField(dc.sc?.scNumber || dc.sc?.productName)) return true;

      // Item level: Part Number, Product Name, Process
      if (dc.items && Array.isArray(dc.items)) {
        for (const item of dc.items) {
          if (matchField(item.partNumber || item.part_number)) return true;
          if (matchField(item.partName || item.part_name)) return true;
          if (matchField(item.product?.name || item.productName)) return true;
          if (matchField(item.product?.code || item.productCode)) return true;
          if (matchField(item.processName || item.process?.name)) return true;
          if (matchField(item.description)) return true;
        }
      }

      if (dc.groups && Array.isArray(dc.groups)) {
        for (const group of dc.groups) {
          if (matchField(group.processName || group.process?.name)) return true;
          if (group.items && Array.isArray(group.items)) {
            for (const item of group.items) {
              if (matchField(item.partNumber || item.part_number)) return true;
              if (matchField(item.partName || item.part_name)) return true;
              if (matchField(item.productName)) return true;
            }
          }
        }
      }
      return false;
    }).slice(0, 5);

    // 2. Matched Processes
    const matchedProcesses = (processes as any[]).filter((proc) => {
      return (
        matchField(proc.nomenclature) ||
        matchField(proc.name) ||
        matchField(proc.internalCode) ||
        matchField(proc.baseUom)
      );
    }).slice(0, 4);

    // 3. Matched Vendors
    const matchedVendors = (vendors as any[]).filter((v) => {
      return matchField(v.name) || matchField(v.code) || matchField(v.category);
    }).slice(0, 4);

    // 4. Matched Products
    const matchedProducts = (products as any[]).filter((p) => {
      return (
        matchField(p.name) ||
        matchField(p.code) ||
        matchField(p.family?.name) ||
        matchField(p.spec)
      );
    }).slice(0, 5);

    const totalCount =
      matchedDcs.length +
      matchedProcesses.length +
      matchedVendors.length +
      matchedProducts.length;

    return {
      dcs: matchedDcs,
      processes: matchedProcesses,
      vendors: matchedVendors,
      products: matchedProducts,
      totalCount,
    };
  }, [searchQuery, challans, processes, vendors, products]);

  const handleNavigateTarget = (targetEntity?: string | null, _targetId?: string | null) => {
    if (!targetEntity) return;
    
    switch (targetEntity) {
      case 'RM_REQUEST':
      case 'RM_REQUISITION':
        if (currentUser?.role === 'STORES') navigate('/stores/rm-issue');
        else if (currentUser?.role === 'PRODUCTION') navigate('/production/rm');
        else if (currentUser?.role === 'DESIGNER') navigate('/design/rm-creation');
        else navigate('/stores/rm-issue');
        break;
      case 'MATERIAL_ISSUE':
        if (currentUser?.role === 'PRODUCTION') navigate('/production/rm');
        else if (currentUser?.role === 'STORES') navigate('/stores/rm-issue');
        else navigate('/production/rm');
        break;
      case 'MATERIAL_RECEIPT':
        if (currentUser?.role === 'STORES') navigate('/stores/rm-issue');
        else if (currentUser?.role === 'PRODUCTION') navigate('/production/rm');
        break;
      case 'ADDITIONAL_REQUEST':
        if (currentUser?.role === 'STORES') navigate('/stores/extra-requests');
        else if (currentUser?.role === 'PRODUCTION') navigate('/production/rm');
        break;
      case 'MATERIAL_RETURN':
        if (currentUser?.role === 'STORES') navigate('/stores/returns-verify');
        else if (currentUser?.role === 'PRODUCTION') navigate('/production/rm');
        break;
      case 'DELIVERY_CHALLAN':
        navigate('/dispatch/returns');
        break;
      case 'PURCHASE_ORDER':
        navigate('/governance/po-traceability');
        break;
      case 'SIZE_CARD':
      case 'STYLE_CODE':
      case 'SC':
        navigate('/governance/traceability');
        break;
      default:
        console.warn('Unknown target entity for navigation:', targetEntity);
    }
  };

  const handleSelectResult = (path: string) => {
    setIsOpen(false);
    setSearchQuery('');
    navigate(path);
  };

  return (
    <header className="fixed top-0 right-0 left-65 h-16 bg-white/80 backdrop-blur border-b border-slate-200 z-20 flex items-center px-6 justify-between">
      {/* Search Input Container */}
      <div className="flex items-center gap-4 flex-1" ref={dropdownRef}>
        <div className="relative group max-w-lg w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" />
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            placeholder="Search Part #, Product Name, Vendor, Process Type (e.g. Heating)..."
            className="w-full pl-9 pr-20 py-2 bg-slate-50 border border-slate-200 rounded-md text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white transition-all font-medium"
          />

          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setIsOpen(false);
                }}
                className="text-slate-400 hover:text-slate-600 p-0.5 rounded"
                title="Clear"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            <kbd className="hidden sm:inline-block border border-slate-200 rounded px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 bg-white shadow-2xs">
              CTRL K
            </kbd>
          </div>

          {/* Live Search Results Dropdown */}
          {isOpen && searchQuery.trim().length > 0 && searchResults && (
            <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl max-h-[480px] overflow-y-auto z-50 divide-y divide-slate-100 animate-in fade-in-50 zoom-in-95 duration-150">
              
              {searchResults.totalCount === 0 ? (
                <div className="p-6 text-center text-slate-500 text-xs">
                  <p className="font-semibold text-slate-700 mb-1">No matching records found for "{searchQuery}"</p>
                  <p>Try searching with a Part Number, Product Name, Vendor Name, or Process Type (e.g. Heating / Heat Treatment).</p>
                </div>
              ) : (
                <>
                  {/* Delivery Challans */}
                  {searchResults.dcs.length > 0 && (
                    <div className="p-2">
                      <div className="px-3 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Truck className="w-3.5 h-3.5 text-blue-600" />
                        Delivery Challans ({searchResults.dcs.length})
                      </div>
                      <div className="space-y-1 mt-1">
                        {searchResults.dcs.map((dc: any) => {
                          const dcNum = dc.challanNumber || dc.dcNumber || 'DC';
                          const vendorName = dc.vendorName || dc.vendor?.name || 'External Vendor';
                          const process = dc.processName || dc.process?.name || dc.notes || '';
                          const firstItem = dc.items?.[0] || dc.groups?.[0]?.items?.[0];
                          const part = firstItem?.partNumber || firstItem?.productName || '';

                          return (
                            <button
                              key={dc.id}
                              type="button"
                              onClick={() => handleSelectResult(`/dispatch/returns`)}
                              className="w-full text-left p-2.5 rounded-lg hover:bg-slate-50 transition-colors flex items-center justify-between group cursor-pointer"
                            >
                              <div className="flex flex-col gap-0.5">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-bold text-xs text-blue-700">{dcNum}</span>
                                  <span className="text-xs font-semibold text-slate-800">{vendorName}</span>
                                </div>
                                <div className="text-[11px] text-slate-500 flex items-center gap-2">
                                  {process && <span className="bg-amber-50 text-amber-800 px-1.5 py-0.2 rounded font-medium">{process}</span>}
                                  {part && <span>Part: {part}</span>}
                                </div>
                              </div>
                              <ExternalLink className="w-3.5 h-3.5 text-slate-300 group-hover:text-blue-600 transition-colors shrink-0 ml-2" />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Processes */}
                  {searchResults.processes.length > 0 && (
                    <div className="p-2">
                      <div className="px-3 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Settings className="w-3.5 h-3.5 text-indigo-600" />
                        Manufacturing Processes ({searchResults.processes.length})
                      </div>
                      <div className="space-y-1 mt-1">
                        {searchResults.processes.map((proc: any) => (
                          <button
                            key={proc.id}
                            type="button"
                            onClick={() => handleSelectResult(`/governance/process-master`)}
                            className="w-full text-left p-2.5 rounded-lg hover:bg-slate-50 transition-colors flex items-center justify-between group cursor-pointer"
                          >
                            <div>
                              <div className="text-xs font-bold text-slate-900">{proc.nomenclature || proc.name}</div>
                              <div className="text-[11px] text-slate-500 font-mono">{proc.internalCode || proc.code} • UOM: {proc.baseUom || 'NOS'}</div>
                            </div>
                            <ExternalLink className="w-3.5 h-3.5 text-slate-300 group-hover:text-indigo-600 transition-colors shrink-0 ml-2" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Vendors */}
                  {searchResults.vendors.length > 0 && (
                    <div className="p-2">
                      <div className="px-3 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                        Vendors ({searchResults.vendors.length})
                      </div>
                      <div className="space-y-1 mt-1">
                        {searchResults.vendors.map((v: any) => (
                          <button
                            key={v.id}
                            type="button"
                            onClick={() => handleSelectResult(`/masters/vendors`)}
                            className="w-full text-left p-2.5 rounded-lg hover:bg-slate-50 transition-colors flex items-center justify-between group cursor-pointer"
                          >
                            <div>
                              <div className="text-xs font-bold text-slate-900">{v.name}</div>
                              <div className="text-[11px] text-slate-500">{v.code ? `[${v.code}] ` : ''}{v.category || 'External Vendor'}</div>
                            </div>
                            <ExternalLink className="w-3.5 h-3.5 text-slate-300 group-hover:text-emerald-600 transition-colors shrink-0 ml-2" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Products */}
                  {searchResults.products.length > 0 && (
                    <div className="p-2">
                      <div className="px-3 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Package className="w-3.5 h-3.5 text-purple-600" />
                        Products Master ({searchResults.products.length})
                      </div>
                      <div className="space-y-1 mt-1">
                        {searchResults.products.map((prod: any) => (
                          <button
                            key={prod.id}
                            type="button"
                            onClick={() => handleSelectResult(`/masters/products`)}
                            className="w-full text-left p-2.5 rounded-lg hover:bg-slate-50 transition-colors flex items-center justify-between group cursor-pointer"
                          >
                            <div>
                              <div className="text-xs font-bold text-slate-900">{prod.name}</div>
                              <div className="text-[11px] text-slate-500 font-mono">{prod.code || ''} {prod.uom ? `• ${prod.uom}` : ''}</div>
                            </div>
                            <ExternalLink className="w-3.5 h-3.5 text-slate-300 group-hover:text-purple-600 transition-colors shrink-0 ml-2" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

            </div>
          )}
        </div>
      </div>
      
      <div className="flex items-center gap-6">
        {currentUser && <NotificationBell onNavigateTarget={handleNavigateTarget} />}
        
        <div className="flex items-center gap-4 border-l border-slate-200 pl-6">
          {currentUser && (
            <>
              <span className="text-xs font-bold px-2 py-1 bg-primary/10 text-primary rounded">
                {currentUser.role.replace('_', ' ')}
              </span>
              <div className="flex flex-col text-right">
                <span className="text-sm font-medium text-slate-900">{currentUser.name || 'User'}</span>
              </div>
              <button 
                onClick={() => setIsChangePasswordOpen(true)}
                className="p-1.5 rounded-md text-slate-500 hover:text-primary hover:bg-slate-100 transition-colors cursor-pointer"
                title="Change Password"
              >
                <KeyRound className="w-4 h-4" />
              </button>
              <button 
                onClick={logout}
                className="p-1.5 rounded-md text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                title="Log out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      <ChangePasswordModal
        isOpen={isChangePasswordOpen}
        onClose={() => setIsChangePasswordOpen(false)}
      />
    </header>
  );
}
