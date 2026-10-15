import { useState, useRef, useEffect, useMemo } from 'react';
import { Search, LogOut, KeyRound, X, Truck, Package, Settings, Building2, ExternalLink, Sun, Moon, Barcode } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { NotificationBell } from '../notifications/NotificationBell';
import { ChangePasswordModal } from '../auth/ChangePasswordModal';
import { deliveryChallanApi, productionProcessApi, api, unwrapList } from '../../services/api';
import { getCurrentTheme, applyTheme } from '../../utils/theme';
import { triggerBarcodeScanner } from '../../hooks/useBarcodeScanner';

interface TopBarProps {
  onOpenScanner?: () => void;
}

export function TopBar({ onOpenScanner }: TopBarProps = {}) {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [currentTheme, setCurrentTheme] = useState(() => getCurrentTheme());

  useEffect(() => {
    const handler = (e: any) => {
      setCurrentTheme(e.detail?.theme || getCurrentTheme());
    };
    window.addEventListener('theme-changed', handler);
    return () => window.removeEventListener('theme-changed', handler);
  }, []);

  const toggleTheme = () => {
    const nextTheme = currentTheme === 'Modern Dark' ? 'Enterprise Light' : 'Modern Dark';
    setCurrentTheme(nextTheme);
    applyTheme(nextTheme);
  };

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Data fetching for global search - only load when search modal is opened or user searches
  const isSearchActive = isOpen || searchQuery.trim().length > 0;

  const { data: challans = [] } = useQuery({
    queryKey: ['global-search-challans'],
    queryFn: async () => {
      try {
        const res = await deliveryChallanApi.getAll();
        return Array.isArray(res) ? res : (res as any)?.data || [];
      } catch {
        return [];
      }
    },
    enabled: isSearchActive,
    staleTime: 60000,
    retry: false,
  });

  const { data: rawMovements = [] } = useQuery({
    queryKey: ['global-search-movements'],
    queryFn: async () => {
      try {
        const res = await deliveryChallanApi.getAllMovements();
        return Array.isArray(res) ? res : (res as any)?.data || [];
      } catch {
        return [];
      }
    },
    enabled: isSearchActive,
    staleTime: 60000,
    retry: false,
  });

  const { data: processes = [] } = useQuery({
    queryKey: ['global-search-processes'],
    queryFn: async () => {
      try {
        const res = await productionProcessApi.getAll();
        return Array.isArray(res) ? res : (res as any)?.data || [];
      } catch {
        return [];
      }
    },
    enabled: isSearchActive,
    staleTime: 60000,
    retry: false,
  });

  const { data: vendors = [] } = useQuery({
    queryKey: ['global-search-vendors'],
    queryFn: async () => {
      try {
        const res = await productionProcessApi.getVendors();
        return Array.isArray(res) ? res : (res as any)?.data || [];
      } catch {
        return [];
      }
    },
    enabled: isSearchActive,
    staleTime: 60000,
    retry: false,
  });

  const { data: products = [] } = useQuery({
    queryKey: ['global-search-products'],
    queryFn: async () => {
      try {
        return unwrapList(await api.get<any[]>('/api/products'));
      } catch {
        return [];
      }
    },
    enabled: isSearchActive,
    staleTime: 60000,
    retry: false,
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

    // 1. Matched Delivery Challans & Dispatch Movements
    const matchedDcsMap = new Map<string, any>();

    // Search detailed movements (has Part #, Product Name, Vendor, Process, Notes)
    for (const m of rawMovements as any[]) {
      const isMatch =
        matchField(m.challanNumber) ||
        matchField(m.vendorName) ||
        matchField(m.vendorCode) ||
        matchField(m.partNumber) ||
        matchField(m.partName) ||
        matchField(m.productName) ||
        matchField(m.productCode) ||
        matchField(m.processName) ||
        matchField(m.notes);

      if (isMatch) {
        const key = `${m.challanNumber || 'DC'}-${m.partNumber || ''}-${m.productName || ''}`;
        if (!matchedDcsMap.has(key)) {
          matchedDcsMap.set(key, {
            id: m.id || key,
            challanNumber: m.challanNumber,
            vendorName: m.vendorName,
            processName: m.processName,
            partNumber: m.partNumber,
            productName: m.productName,
            notes: m.notes,
          });
        }
      }
    }

    // Also search full challans
    for (const dc of challans as any[]) {
      const isDcMatch =
        matchField(dc.challanNumber || dc.dcNumber) ||
        matchField(dc.vendorName || dc.vendor?.name) ||
        matchField(dc.processName || dc.process?.name || dc.process?.nomenclature) ||
        matchField(dc.notes) ||
        matchField(dc.sc?.scNumber || dc.sc?.productName);

      let itemPart = '';
      let itemProduct = '';
      let itemProcess = '';

      if (dc.items && Array.isArray(dc.items)) {
        for (const item of dc.items) {
          if (
            matchField(item.partNumber || item.part_number) ||
            matchField(item.partName || item.part_name) ||
            matchField(item.product?.name || item.productName) ||
            matchField(item.product?.code || item.productCode) ||
            matchField(item.processName || item.process?.name) ||
            matchField(item.description)
          ) {
            itemPart = item.partNumber || item.part_number || '';
            itemProduct = item.product?.name || item.productName || '';
            itemProcess = item.processName || item.process?.name || '';
            break;
          }
        }
      }

      if (isDcMatch || itemPart || itemProduct || itemProcess) {
        const key = dc.challanNumber || dc.dcNumber || dc.id;
        if (!matchedDcsMap.has(key)) {
          const firstItem = dc.items?.[0] || dc.groups?.[0]?.items?.[0];
          matchedDcsMap.set(key, {
            id: dc.id,
            challanNumber: dc.challanNumber || dc.dcNumber,
            vendorName: dc.vendorName || dc.vendor?.name,
            processName: itemProcess || dc.processName || dc.process?.name || dc.process?.nomenclature,
            partNumber: itemPart || firstItem?.partNumber,
            productName: itemProduct || firstItem?.productName || firstItem?.product?.name,
            notes: dc.notes,
          });
        }
      }
    }

    const matchedDcs = Array.from(matchedDcsMap.values()).slice(0, 6);

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
  }, [searchQuery, challans, rawMovements, processes, vendors, products]);

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
    <header className="fixed top-0 right-0 left-65 h-16 bg-white/90 dark:bg-[#0d0f1b]/90 backdrop-blur-md border-b border-slate-200 dark:border-[#1a1e33] z-20 flex items-center px-6 justify-between transition-colors duration-150">
      {/* Search Input Container */}
      <div className="flex items-center gap-4 flex-1" ref={dropdownRef}>
        <div className="relative group max-w-lg w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-[#55627a] group-focus-within:text-primary dark:group-focus-within:text-indigo-400 transition-colors" />
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
            className="w-full pl-9 pr-20 py-2 bg-slate-50 dark:bg-[#0e111f] border border-slate-200 dark:border-[#1e233d] rounded-lg text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-[#55627a] focus:outline-none focus:ring-2 focus:ring-primary/20 dark:focus:ring-indigo-500/20 focus:border-primary dark:focus:border-indigo-500 transition-all font-medium"
          />

          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setIsOpen(false);
                }}
                className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 p-0.5 rounded cursor-pointer"
                title="Clear"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            <kbd className="hidden sm:inline-block border border-slate-200 dark:border-[#1e233d] rounded px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 dark:text-[#7a879e] bg-white dark:bg-[#121526] shadow-2xs">
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
                          const part = dc.partNumber || dc.items?.[0]?.partNumber || dc.items?.[0]?.part_number || '';
                          const product = dc.productName || dc.items?.[0]?.productName || dc.items?.[0]?.product?.name || '';

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
                                <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                                  {process && <span className="bg-amber-50 text-amber-800 border border-amber-200/60 px-1.5 py-0.2 rounded font-medium">{process}</span>}
                                  {part && part !== '—' && <span className="font-mono bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded font-medium">Part: {part}</span>}
                                  {product && <span className="text-slate-600">Product: {product}</span>}
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
      
      <div className="flex items-center gap-3">
        {/* Quick Barcode Scanner Trigger Button */}
        <button
          type="button"
          onClick={() => {
            if (onOpenScanner) onOpenScanner();
            else triggerBarcodeScanner();
          }}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-blue-200 dark:border-blue-900/60 bg-blue-50/70 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-all font-medium text-xs shadow-2xs cursor-pointer group"
          title="Hardware Barcode Scanner (Press F2 or Ctrl+B)"
        >
          <Barcode className="w-4 h-4 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform" />
          <span className="hidden md:inline font-semibold">Scan Item</span>
          <kbd className="hidden sm:inline-block font-mono text-[10px] bg-white dark:bg-[#121526] px-1.5 py-0.2 rounded border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-300 shadow-2xs">
            F2
          </kbd>
        </button>

        {/* Instant Theme Toggle Button */}
        <button
          type="button"
          onClick={toggleTheme}
          className="p-2 rounded-lg text-slate-500 dark:text-[#8896ab] hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-[#161a2e] border border-transparent dark:border-[#1e233d]/60 transition-colors cursor-pointer"
          title={currentTheme === 'Modern Dark' ? 'Switch to Light Mode' : 'Switch to Modern Dark Mode'}
        >
          {currentTheme === 'Modern Dark' ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-slate-600" />
          )}
        </button>

        {currentUser && <NotificationBell onNavigateTarget={handleNavigateTarget} />}
        
        <div className="flex items-center gap-3 border-l border-slate-200 dark:border-[#1a1e33] pl-4">
          {currentUser && (
            <>
              <span className="text-xs font-bold px-2 py-0.5 bg-primary/10 dark:bg-indigo-500/15 text-primary dark:text-indigo-400 border border-transparent dark:border-indigo-500/20 rounded">
                {currentUser.role.replace('_', ' ')}
              </span>
              <button
                type="button"
                onClick={() => navigate('/profile')}
                className="flex flex-col text-right hover:opacity-80 transition-opacity cursor-pointer"
                title="View Profile & Settings"
              >
                <span className="text-sm font-semibold text-slate-900 dark:text-white">{currentUser.name || 'User'}</span>
              </button>
              <button 
                onClick={() => navigate('/settings')}
                className="p-1.5 rounded-lg text-slate-500 dark:text-[#8896ab] hover:text-primary dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-[#161a2e] transition-colors cursor-pointer"
                title="System Settings"
              >
                <Settings className="w-4 h-4" />
              </button>
              <button 
                onClick={() => navigate('/profile?tab=password')}
                className="p-1.5 rounded-lg text-slate-500 dark:text-[#8896ab] hover:text-primary dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-[#161a2e] transition-colors cursor-pointer"
                title="Change Password"
              >
                <KeyRound className="w-4 h-4" />
              </button>
              <button 
                onClick={logout}
                className="p-1.5 rounded-lg text-slate-500 dark:text-rose-400 hover:text-red-600 dark:hover:text-rose-300 hover:bg-red-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
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
