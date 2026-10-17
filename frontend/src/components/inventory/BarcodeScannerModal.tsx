import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Barcode,
  Search,
  X,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Printer,
  MapPin,
  Volume2,
  Volume1,
  VolumeX,
  ArrowDownLeft,
  ArrowUpRight,
  Zap,
  Plus,
  Minus,
  Check,
  Download,
  Link as LinkIcon,
  Activity,
} from 'lucide-react';
import { Button } from '../ui';
import { masterDataService } from '../../services/masterDataService';
import type { ProductWithStockDetails, Bin, Product } from '../../services/masterDataService';
import { inventoryService } from '../../services/inventoryService';
import { sanitizeBarcode } from '../../hooks/useBarcodeScanner';
import { BarcodeSvg } from '../common/BarcodeSvg';
import { BarcodeLabelModal } from './BarcodeLabelModal';
import { toast } from 'react-hot-toast';

export type SoundProfile = 'HIGH_NOISE' | 'STANDARD' | 'SUBTLE' | 'MUTE';

/**
 * Web Audio API synthesizer optimized for warehouse floor environments.
 * Synthesizes acoustic frequencies without needing audio file downloads.
 */
function playWarehouseSound(
  type: 'SCAN_SUCCESS' | 'TRANSACTION_SUCCESS' | 'ERROR' | 'DUPLICATE',
  profile: SoundProfile = 'STANDARD',
) {
  if (profile === 'MUTE') return;

  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    // Volume multiplier based on warehouse noise profile
    const gainMultiplier = profile === 'HIGH_NOISE' ? 2.0 : profile === 'SUBTLE' ? 0.4 : 1.0;

    if (type === 'SCAN_SUCCESS') {
      // High-pitch double chirp: 880Hz (A5) -> 1320Hz (E6)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(profile === 'HIGH_NOISE' ? 1046 : 880, ctx.currentTime);
      osc.frequency.setValueAtTime(profile === 'HIGH_NOISE' ? 1567 : 1320, ctx.currentTime + 0.07);
      gain.gain.setValueAtTime(0.12 * gainMultiplier, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } else if (type === 'TRANSACTION_SUCCESS') {
      // Pleasant triad chime: 523Hz (C5), 659Hz (E5), 784Hz (G5)
      const freqs = [523.25, 659.25, 783.99];
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        const targetFreq = freq * (profile === 'HIGH_NOISE' ? 1.25 : 1);
        osc.frequency.setValueAtTime(targetFreq, ctx.currentTime + idx * 0.05);
        gain.gain.setValueAtTime(0.1 * gainMultiplier, ctx.currentTime + idx * 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.05 + 0.28);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + idx * 0.05);
        osc.stop(ctx.currentTime + idx * 0.05 + 0.28);
      });
    } else if (type === 'ERROR') {
      // Low-pitch dual saw buzzer: 220Hz saw wave
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(profile === 'HIGH_NOISE' ? 260 : 220, ctx.currentTime);
      osc.frequency.setValueAtTime(180, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.16 * gainMultiplier, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } else if (type === 'DUPLICATE') {
      // Subtle double pulse warning: 440Hz
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      gain.gain.setValueAtTime(0.08 * gainMultiplier, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    }
  } catch (err) {
    console.debug('Web Audio feedback suppressed:', err);
  }
}

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialBarcode?: string;
  onSelectProduct?: (product: ProductWithStockDetails) => void;
  onTransactionComplete?: () => void;
}

interface ScanHistoryItem {
  barcode: string;
  timestamp: string;
  product?: ProductWithStockDetails;
  status: 'FOUND' | 'NOT_FOUND' | 'TRANSACTED';
  actionDetails?: {
    action: 'STOCK_IN' | 'STOCK_OUT';
    quantity: number;
    uom: string;
    binCode?: string;
  };
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  initialBarcode = '',
  onSelectProduct,
  onTransactionComplete,
}) => {
  const [barcodeInput, setBarcodeInput] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [foundProduct, setFoundProduct] = useState<ProductWithStockDetails | null>(null);
  const [unknownBarcode, setUnknownBarcode] = useState<string | null>(null);
  const [history, setHistory] = useState<ScanHistoryItem[]>([]);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);

  // Audio Profile State with persistent storage
  const [soundProfile, setSoundProfile] = useState<SoundProfile>(() => {
    return (localStorage.getItem('rm_scanner_sound_profile') as SoundProfile) || 'STANDARD';
  });

  // Visual Feedback Flash State
  const [flashState, setFlashState] = useState<'IDLE' | 'SUCCESS' | 'ERROR'>('IDLE');

  // Fast-Path Transaction States
  const [actionType, setActionType] = useState<'STOCK_IN' | 'STOCK_OUT'>('STOCK_IN');
  const [selectedBinId, setSelectedBinId] = useState<string>('');
  const [txnQuantity, setTxnQuantity] = useState<string>('1');
  const [txnRemarks, setTxnRemarks] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [continuousMode, setContinuousMode] = useState<boolean>(true);
  const [allMasterBins, setAllMasterBins] = useState<Bin[]>([]);
  const [showOtherBins, setShowOtherBins] = useState<boolean>(false);

  // Unregistered Barcode Onboarding States
  const [isLinkingOpen, setIsLinkingOpen] = useState<boolean>(false);
  const [linkSearchQuery, setLinkSearchQuery] = useState<string>('');
  const [allProductsList, setAllProductsList] = useState<Product[]>([]);
  const [selectedLinkProduct, setSelectedLinkProduct] = useState<Product | null>(null);
  const [isLinkingSubmitting, setIsLinkingSubmitting] = useState<boolean>(false);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const qtyInputRef = useRef<HTMLInputElement | null>(null);
  const lastLookupRef = useRef<{ code: string; time: number }>({ code: '', time: 0 });

  // Auto-Suggest Search States (search by barcode, code, or product name)
  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const [isSearchingSuggestions, setIsSearchingSuggestions] = useState<boolean>(false);
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggestionsBoxRef = useRef<HTMLDivElement | null>(null);

  // Close suggestions on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        suggestionsBoxRef.current &&
        !suggestionsBoxRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, []);

  // Update sound profile in localStorage
  const handleSoundProfileChange = (newProfile: SoundProfile) => {
    setSoundProfile(newProfile);
    localStorage.setItem('rm_scanner_sound_profile', newProfile);
    playWarehouseSound('SCAN_SUCCESS', newProfile);
    if (newProfile === 'MUTE') {
      toast('Scanner audio muted', { icon: '🔇' });
    } else if (newProfile === 'HIGH_NOISE') {
      toast('Loud warehouse floor audio enabled', { icon: '🔊' });
    } else {
      toast('Normal warehouse audio enabled', { icon: '🔉' });
    }
  };

  // Fetch all master warehouse bins once when modal opens
  useEffect(() => {
    if (isOpen && allMasterBins.length === 0) {
      masterDataService
        .getBins({ pageSize: 200, isActive: true })
        .then((res) => {
          setAllMasterBins(res.data || []);
        })
        .catch((err) => {
          console.debug('Failed to load master bins for scanner modal', err);
        });
    }
  }, [isOpen, allMasterBins.length]);

  // Load all products lazily when link mode opens
  useEffect(() => {
    if (isLinkingOpen && allProductsList.length === 0) {
      masterDataService
        .getProducts({ pageSize: 500, isActive: true })
        .then((res) => setAllProductsList(res.data || []))
        .catch((err) => console.debug('Failed to load products for linking', err));
    }
  }, [isLinkingOpen, allProductsList.length]);

  // Autofocus input when modal opens or state resets
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);

      if (initialBarcode && initialBarcode.trim()) {
        const sanitized = sanitizeBarcode(initialBarcode);
        setBarcodeInput(sanitized);
        handleLookup(sanitized);
      }
    } else {
      setFoundProduct(null);
      setUnknownBarcode(null);
      setBarcodeInput('');
      setTxnQuantity('1');
      setTxnRemarks('');
      setShowOtherBins(false);
      setIsLinkingOpen(false);
      setSelectedLinkProduct(null);
      setFlashState('IDLE');
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [isOpen, initialBarcode]);

  // Auto-resolve default bin when foundProduct changes or actionType changes
  useEffect(() => {
    if (foundProduct) {
      const balances = foundProduct.stockBalances || [];
      if (actionType === 'STOCK_OUT') {
        const positiveBin = balances.find((b) => Number(b.currentQuantity || 0) > 0);
        if (positiveBin) {
          setSelectedBinId(positiveBin.binId || positiveBin.bin?.id || '');
        } else if (balances.length > 0) {
          setSelectedBinId(balances[0].binId || balances[0].bin?.id || '');
        }
      } else {
        if (balances.length > 0) {
          setSelectedBinId(balances[0].binId || balances[0].bin?.id || '');
        } else if (allMasterBins.length > 0 && !selectedBinId) {
          setSelectedBinId(allMasterBins[0].id);
        }
      }

      setTxnQuantity('1');
      setTimeout(() => {
        qtyInputRef.current?.focus();
        qtyInputRef.current?.select();
      }, 80);
    }
  }, [foundProduct, actionType]);

  // Handle ESC, Ctrl+I, Ctrl+O shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isPrintModalOpen) {
          setIsPrintModalOpen(false);
          setTimeout(() => inputRef.current?.focus(), 50);
        } else if (isLinkingOpen) {
          setIsLinkingOpen(false);
        } else {
          onClose();
        }
      } else if (foundProduct && (e.ctrlKey || e.metaKey)) {
        if (e.key.toLowerCase() === 'i') {
          e.preventDefault();
          setActionType('STOCK_IN');
        } else if (e.key.toLowerCase() === 'o') {
          e.preventDefault();
          setActionType('STOCK_OUT');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isPrintModalOpen, isLinkingOpen, foundProduct, onClose]);

  // Handle typing search with debounced product suggestions
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
    setBarcodeInput(rawVal);

    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    const trimmed = rawVal.trim();
    if (trimmed.length >= 1) {
      setIsSearchingSuggestions(true);
      setShowSuggestions(true);
      searchDebounceRef.current = setTimeout(async () => {
        try {
          const res = await masterDataService.getProducts({
            search: trimmed,
            pageSize: 8,
            isActive: true,
          });
          setSuggestions(res.data || []);
        } catch (err) {
          console.debug('Failed to fetch product suggestions', err);
          setSuggestions([]);
        } finally {
          setIsSearchingSuggestions(false);
        }
      }, 200);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
      setIsSearchingSuggestions(false);
    }
  };

  // User selects an item from suggestions dropdown
  const handleSelectSuggestion = async (product: Product) => {
    setShowSuggestions(false);
    setSuggestions([]);
    const targetQuery = product.barcode || product.code || product.id;
    setBarcodeInput(product.barcode || product.code || product.name);
    if (targetQuery) {
      await handleLookup(targetQuery);
    }
  };

  // Lookup product by barcode or search query with Laser Debounce Guard
  const handleLookup = async (codeToSearch: string) => {
    setShowSuggestions(false);
    const sanitized = sanitizeBarcode(codeToSearch);
    if (!sanitized) {
      toast.error('Please enter or scan a barcode.');
      return;
    }

    // Debounce Guard: suppress duplicate laser trigger bounce (< 400ms)
    const now = Date.now();
    if (sanitized === lastLookupRef.current.code && now - lastLookupRef.current.time < 400) {
      console.debug('Suppressed duplicate scan lookup in modal:', sanitized);
      playWarehouseSound('DUPLICATE', soundProfile);
      return;
    }
    lastLookupRef.current = { code: sanitized, time: now };

    try {
      setIsLoading(true);
      setFoundProduct(null);
      setUnknownBarcode(null);
      setShowOtherBins(false);
      setIsLinkingOpen(false);

      let product: ProductWithStockDetails | null = null;
      try {
        product = await masterDataService.getProductByBarcode(sanitized);
      } catch (barcodeErr) {
        // Fallback: search products by stripped query (removing PRD- prefix if present)
        const stripped = sanitized.replace(/^PRD[-_:\s]+/i, '').trim();
        const queriesToTry = [codeToSearch.trim()];
        if (stripped && stripped !== codeToSearch.trim()) {
          queriesToTry.unshift(stripped);
        }

        for (const q of queriesToTry) {
          try {
            const searchRes = await masterDataService.getProducts({
              search: q,
              pageSize: 5,
              isActive: true,
            });
            if (searchRes.data && searchRes.data.length > 0) {
              const match = searchRes.data[0];
              const queryTarget = match.barcode || match.code || match.id;
              if (queryTarget) {
                product = await masterDataService.getProductByBarcode(queryTarget);
                // Proactively link barcode to product in background if unlinked
                if (!match.barcode) {
                  masterDataService.updateProduct(match.id, { barcode: sanitized }).catch(() => {});
                }
                break;
              }
            }
          } catch {
            // continue next attempt
          }
        }

        if (!product) {
          throw barcodeErr;
        }
      }

      setFoundProduct(product);
      setBarcodeInput(product.barcode || product.code || sanitized);
      playWarehouseSound('SCAN_SUCCESS', soundProfile);
      setHistory((prev) => [
        {
          barcode: product.barcode || sanitized,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          product,
          status: 'FOUND',
        },
        ...prev.slice(0, 19),
      ]);
      onSelectProduct?.(product);
    } catch (err: any) {
      console.warn(`Product not found for: "${sanitized}"`, err);
      setUnknownBarcode(sanitized);
      playWarehouseSound('ERROR', soundProfile);
      setFlashState('ERROR');
      setTimeout(() => setFlashState('IDLE'), 800);

      setHistory((prev) => [
        {
          barcode: sanitized,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          status: 'NOT_FOUND',
        },
        ...prev.slice(0, 19),
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowSuggestions(false);
    if (barcodeInput.trim()) {
      handleLookup(barcodeInput.trim());
    }
  };

  const handleReset = () => {
    setBarcodeInput('');
    setFoundProduct(null);
    setUnknownBarcode(null);
    setTxnQuantity('1');
    setTxnRemarks('');
    setShowOtherBins(false);
    setIsLinkingOpen(false);
    setSelectedLinkProduct(null);
    setSuggestions([]);
    setShowSuggestions(false);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  // Compute selected bin available stock
  const currentBinBalance = foundProduct?.stockBalances?.find(
    (b) => (b.binId || b.bin?.id) === selectedBinId,
  );
  const availableQtyInSelectedBin = Number(currentBinBalance?.currentQuantity || 0);
  const parsedQty = parseFloat(txnQuantity) || 0;
  const isInsufficientStock = actionType === 'STOCK_OUT' && parsedQty > availableQtyInSelectedBin;

  // Execute fast Stock In / Stock Out transaction
  const handleExecuteTransaction = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!foundProduct || isSubmitting) return;

    if (!selectedBinId) {
      toast.error('Please select a storage bin.');
      playWarehouseSound('ERROR', soundProfile);
      setFlashState('ERROR');
      setTimeout(() => setFlashState('IDLE'), 800);
      return;
    }

    if (isNaN(parsedQty) || parsedQty <= 0) {
      toast.error('Please enter a valid positive quantity.');
      playWarehouseSound('ERROR', soundProfile);
      setFlashState('ERROR');
      setTimeout(() => setFlashState('IDLE'), 800);
      return;
    }

    if (isInsufficientStock) {
      toast.error(
        `Cannot stock out ${parsedQty}: Selected bin only has ${availableQtyInSelectedBin} ${foundProduct.uom || 'units'}.`,
      );
      playWarehouseSound('ERROR', soundProfile);
      setFlashState('ERROR');
      setTimeout(() => setFlashState('IDLE'), 800);
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await inventoryService.scanStockTransaction({
        barcode: foundProduct.barcode || '',
        action: actionType,
        binId: selectedBinId,
        quantity: parsedQty,
        remarks: txnRemarks.trim() || undefined,
      });

      // Visual flash pulse and Triumph audio feedback
      playWarehouseSound('TRANSACTION_SUCCESS', soundProfile);
      setFlashState('SUCCESS');
      setTimeout(() => setFlashState('IDLE'), 800);

      toast.success(res.message || `Successfully processed ${actionType}`);

      // Resolve human bin code for history
      const binObj =
        foundProduct.stockBalances?.find((b) => (b.binId || b.bin?.id) === selectedBinId)?.bin ||
        allMasterBins.find((b) => b.id === selectedBinId);
      const binCode = binObj?.code || 'BIN';

      setHistory((prev) => [
        {
          barcode: foundProduct.barcode || '',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          product: foundProduct,
          status: 'TRANSACTED',
          actionDetails: {
            action: actionType,
            quantity: parsedQty,
            uom: foundProduct.uom || 'units',
            binCode,
          },
        },
        ...prev.slice(0, 19),
      ]);

      // Notify outside listeners
      window.dispatchEvent(new CustomEvent('inventory-updated'));
      onTransactionComplete?.();

      if (continuousMode) {
        // High-speed warehouse loop: Clear & immediately refocus scanner input
        setFoundProduct(null);
        setBarcodeInput('');
        setTxnQuantity('1');
        setTxnRemarks('');
        setShowOtherBins(false);
        setTimeout(() => {
          inputRef.current?.focus();
          inputRef.current?.select();
        }, 60);
      } else {
        // Live update balances for current product
        const updated = await masterDataService.getProductByBarcode(foundProduct.barcode || '');
        setFoundProduct(updated);
        setTxnQuantity('1');
        setTxnRemarks('');
      }
    } catch (err: any) {
      const errorMsg =
        err?.response?.data?.error?.message ||
        err?.response?.data?.message ||
        err?.message ||
        'Failed to process transaction';
      toast.error(`Transaction Error: ${errorMsg}`);
      playWarehouseSound('ERROR', soundProfile);
      setFlashState('ERROR');
      setTimeout(() => setFlashState('IDLE'), 800);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Link unregistered barcode to existing product
  const handleLinkProductSubmit = async () => {
    if (!unknownBarcode || !selectedLinkProduct) {
      toast.error('Please select a product to link.');
      return;
    }

    try {
      setIsLinkingSubmitting(true);
      await masterDataService.updateProduct(selectedLinkProduct.id, {
        barcode: unknownBarcode,
      });

      toast.success(`Linked barcode "${unknownBarcode}" to product "${selectedLinkProduct.name}"!`);
      playWarehouseSound('TRANSACTION_SUCCESS', soundProfile);
      setIsLinkingOpen(false);
      setSelectedLinkProduct(null);

      // Immediately look up the newly linked product
      handleLookup(unknownBarcode);
    } catch (err: any) {
      const errorMsg =
        err?.response?.data?.error?.message ||
        err?.response?.data?.message ||
        err?.message ||
        'Failed to link barcode';
      toast.error(`Linking Error: ${errorMsg}`);
      playWarehouseSound('ERROR', soundProfile);
    } finally {
      setIsLinkingSubmitting(false);
    }
  };

  // Export Shift Session CSV Log
  const handleExportCsv = () => {
    if (history.length === 0) {
      toast.error('No scan history to export.');
      return;
    }
    const headers = ['Timestamp', 'Barcode', 'Product Name', 'Product Code', 'Action', 'Quantity', 'UOM', 'Bin Code', 'Status'];
    const rows = history.map((h) => [
      `"${h.timestamp}"`,
      `"${h.barcode}"`,
      `"${(h.product?.name || '').replace(/"/g, '""')}"`,
      `"${h.product?.code || ''}"`,
      `"${h.actionDetails?.action || ''}"`,
      `"${h.actionDetails?.quantity || ''}"`,
      `"${h.actionDetails?.uom || ''}"`,
      `"${h.actionDetails?.binCode || ''}"`,
      `"${h.status}"`,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `warehouse_scan_log_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Session scan log downloaded.');
  };

  // Filter products for linking
  const filteredLinkProducts = useMemo(() => {
    const q = linkSearchQuery.trim().toLowerCase();
    if (!q) return allProductsList.slice(0, 8);
    return allProductsList
      .filter((p) => p.name.toLowerCase().includes(q) || (p.code || '').toLowerCase().includes(q))
      .slice(0, 8);
  }, [allProductsList, linkSearchQuery]);

  // Floor Shift Statistics
  const sessionStats = useMemo(() => {
    let inQty = 0;
    let outQty = 0;
    let txCount = 0;
    history.forEach((h) => {
      if (h.status === 'TRANSACTED' && h.actionDetails) {
        txCount++;
        if (h.actionDetails.action === 'STOCK_IN') inQty += h.actionDetails.quantity;
        if (h.actionDetails.action === 'STOCK_OUT') outQty += h.actionDetails.quantity;
      }
    });
    return { totalScans: history.length, txCount, inQty, outQty };
  }, [history]);

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
        <div
          onClick={(e) => {
            const targetEl = e.target as HTMLElement;
            // Keep autofocus alive unless clicking interactive buttons/inputs/selects or suggestions
            if (
              !targetEl.closest('button') &&
              !targetEl.closest('input') &&
              !targetEl.closest('select') &&
              !suggestionsBoxRef.current?.contains(targetEl)
            ) {
              if (foundProduct) {
                qtyInputRef.current?.focus();
              } else {
                inputRef.current?.focus();
              }
            }
          }}
          className={`relative w-full max-w-3xl bg-white dark:bg-[#121526] rounded-2xl shadow-2xl transition-all duration-200 overflow-hidden flex flex-col max-h-[92vh] ${
            flashState === 'SUCCESS'
              ? 'border-4 border-emerald-500 ring-8 ring-emerald-500/30 shadow-[0_0_50px_rgba(16,185,129,0.35)]'
              : flashState === 'ERROR'
              ? 'border-4 border-rose-500 ring-8 ring-rose-500/30 shadow-[0_0_50px_rgba(244,63,94,0.35)]'
              : 'border border-slate-200 dark:border-slate-800'
          }`}
        >
          {/* Header with Hardware Armed Status & Sound Profiles */}
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-[#0c0e1a]">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <Barcode className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    Hardware Barcode Scanner
                  </h2>
                  <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-mono text-[11px] font-semibold">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Wedge Armed</span>
                  </div>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Physical USB / Bluetooth Scanner &bull; Fast-Path Stock In/Out &bull; Debounce Guard Armed
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Interactive Sound Profile Selector */}
              <div className="flex items-center gap-1 p-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0e111f] shadow-2xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1.5 hidden md:inline select-none">
                  Beep:
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSoundProfileChange('HIGH_NOISE');
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 active:scale-95 ${
                    soundProfile === 'HIGH_NOISE'
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 shadow-2xs'
                      : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                  title="High-Noise Warehouse Floor Mode (Click to switch to Loud audio)"
                >
                  <Volume2 className="w-3.5 h-3.5 text-amber-600" />
                  <span className="hidden sm:inline">Loud</span>
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSoundProfileChange('STANDARD');
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 active:scale-95 ${
                    soundProfile === 'STANDARD'
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 shadow-2xs'
                      : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                  title="Standard Warehouse Audio Feedback (Click to switch to Normal audio)"
                >
                  <Volume1 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Normal</span>
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSoundProfileChange('MUTE');
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 active:scale-95 ${
                    soundProfile === 'MUTE'
                      ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 shadow-2xs'
                      : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                  title="Mute Audio Feedback (Click to Mute)"
                >
                  <VolumeX className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Mute</span>
                </button>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {/* High-Contrast Scanner Input Box with Auto-Suggest Dropdown */}
            <form onSubmit={handleBarcodeSubmit} className="relative z-30">
              <div className="relative flex items-center">
                <Barcode className="w-5 h-5 text-blue-600 dark:text-blue-400 absolute left-4 pointer-events-none" />
                <input
                  ref={inputRef}
                  type="text"
                  value={barcodeInput}
                  onChange={handleInputChange}
                  onFocus={() => {
                    if (suggestions.length > 0 && barcodeInput.trim().length >= 1) {
                      setShowSuggestions(true);
                    }
                  }}
                  placeholder="Scan barcode, or search by product name, code (e.g. RM-0001), or barcode..."
                  className="w-full h-12 pl-12 pr-28 rounded-xl border-2 border-blue-500/60 focus:border-blue-600 dark:border-blue-500/40 dark:focus:border-blue-400 bg-white dark:bg-[#0e111f] text-sm sm:text-base font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-950 shadow-inner"
                  autoFocus
                />
                <div className="absolute right-2 flex items-center gap-1.5">
                  {barcodeInput && (
                    <button
                      type="button"
                      onClick={handleReset}
                      className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg cursor-pointer"
                      title="Clear input"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  )}
                  <Button type="submit" size="sm" disabled={isLoading || !barcodeInput.trim()}>
                    {isLoading ? <span className="animate-spin mr-1">⟳</span> : <Search className="w-3.5 h-3.5 mr-1" />}
                    Lookup
                  </Button>
                </div>
              </div>

              {/* Auto-Suggest Dropdown List (Search by Barcode, Code, or Name) */}
              {showSuggestions && barcodeInput.trim().length >= 1 && (
                <div
                  ref={suggestionsBoxRef}
                  className="absolute left-0 right-0 top-full mt-1.5 z-40 bg-white dark:bg-[#121526] border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl overflow-hidden max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 animate-in fade-in slide-in-from-top-1 duration-150"
                >
                  {isSearchingSuggestions ? (
                    <div className="p-4 text-center text-xs text-slate-500 dark:text-slate-400 flex items-center justify-center gap-2">
                      <span className="w-3.5 h-3.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      <span>Searching products by name, code, or barcode...</span>
                    </div>
                  ) : suggestions.length > 0 ? (
                    <>
                      <div className="px-3.5 py-1.5 bg-slate-50 dark:bg-slate-900/60 text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center justify-between">
                        <span>Matching Products ({suggestions.length})</span>
                        <span className="text-[10px] text-slate-400">Click to select item</span>
                      </div>
                      {suggestions.map((p) => (
                        <div
                          key={p.id}
                          onClick={() => handleSelectSuggestion(p)}
                          className="px-4 py-3 hover:bg-blue-50/80 dark:hover:bg-blue-950/50 cursor-pointer transition-colors flex items-center justify-between gap-3 group"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm text-slate-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400">
                                {p.name}
                              </span>
                              {p.family?.name && (
                                <span className="text-[11px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                  {p.family.name}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                              <span>Code: <strong className="font-mono text-slate-700 dark:text-slate-300">{p.code || '—'}</strong></span>
                              {p.uom && <span>UOM: <strong className="text-slate-700 dark:text-slate-300">{p.uom}</strong></span>}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {p.barcode ? (
                              <span className="inline-flex items-center gap-1 font-mono text-xs font-bold px-2 py-1 rounded bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900">
                                <Barcode className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                                {p.barcode}
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400 italic">No Barcode</span>
                            )}
                            <Button size="sm" variant="secondary" className="text-xs h-7 px-2.5">
                              Select
                            </Button>
                          </div>
                        </div>
                      ))}
                    </>
                  ) : (
                    <div className="p-4 text-center text-xs text-slate-500 dark:text-slate-400">
                      No products found matching &ldquo;{barcodeInput}&rdquo;. You can still scan a barcode with your hardware scanner.
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 mt-1.5 px-1">
                <span className="flex items-center gap-1">
                  <Activity className="w-3 h-3 text-emerald-500" />
                  Scanner wedge active &bull; Auto-sanitizes ASCII bytes &bull; 400ms bounce guard
                </span>
                <span className="font-mono">Shortcuts: [Ctrl+I] Stock In &bull; [Ctrl+O] Stock Out</span>
              </div>
            </form>

            {/* Display State: 1. Idle Awaiting Scan */}
            {!isLoading && !foundProduct && !unknownBarcode && (
              <div className="py-12 flex flex-col items-center justify-center text-center rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0c0e1a]/50">
                <div className="relative w-20 h-20 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-4">
                  <Barcode className="w-10 h-10" />
                  <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 ring-4 ring-white dark:ring-[#121526] animate-pulse" />
                </div>
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
                  Ready for Hardware Scan
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mt-1">
                  Aim handheld laser scanner at product sticker. 1-click Fast-Path action engine with zero manual data entry.
                </p>
              </div>
            )}

            {/* Display State: 2. Product Found & Action Panel */}
            {foundProduct && (
              <div className="space-y-4 animate-in fade-in duration-150">
                {/* Product Summary Header Card */}
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-[#0e111f] flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 flex items-center justify-center font-bold">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900 dark:text-white">
                          {foundProduct.name}
                        </span>
                        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-white dark:bg-[#121526] text-blue-700 dark:text-blue-300 border border-slate-200 dark:border-slate-700">
                          {foundProduct.barcode}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        <span>Code: <strong className="font-mono text-slate-700 dark:text-slate-300">{foundProduct.code || '—'}</strong></span>
                        <span>Total Inventory: <strong className="text-slate-900 dark:text-white font-semibold">{Number(foundProduct.totalQuantity || 0).toLocaleString()} {foundProduct.uom || 'NOS'}</strong></span>
                        <span>
                          MSL:{' '}
                          <span className={Number(foundProduct.totalQuantity || 0) < Number(foundProduct.minimumInventory || 0) ? 'text-amber-600 font-bold' : 'text-emerald-600 font-bold'}>
                            {foundProduct.minimumInventory ? `${foundProduct.minimumInventory} ${foundProduct.uom || 'NOS'}` : '0'}
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setIsPrintModalOpen(true)}
                    className="cursor-pointer text-xs"
                  >
                    <Printer className="w-3.5 h-3.5 mr-1" />
                    Print Sticker
                  </Button>
                </div>

                {/* FAST-PATH ACTION PANEL */}
                <div className="p-5 rounded-2xl border-2 border-blue-500/30 dark:border-blue-500/20 bg-gradient-to-b from-blue-50/30 via-white to-white dark:from-blue-950/20 dark:via-[#121526] dark:to-[#121526] shadow-sm space-y-4">
                  {/* Action Mode Toggle & Continuous Loop Setting */}
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    {/* Action Segmented Switch */}
                    <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => setActionType('STOCK_IN')}
                        className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                          actionType === 'STOCK_IN'
                            ? 'bg-emerald-600 text-white shadow-md ring-2 ring-emerald-500/30'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        <ArrowDownLeft className="w-4 h-4" />
                        <span>Stock In</span>
                        <kbd className="text-[10px] font-mono px-1 py-0.2 rounded bg-black/20 text-white/90">I</kbd>
                      </button>

                      <button
                        type="button"
                        onClick={() => setActionType('STOCK_OUT')}
                        className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                          actionType === 'STOCK_OUT'
                            ? 'bg-rose-600 text-white shadow-md ring-2 ring-rose-500/30'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        <ArrowUpRight className="w-4 h-4" />
                        <span>Stock Out</span>
                        <kbd className="text-[10px] font-mono px-1 py-0.2 rounded bg-black/20 text-white/90">O</kbd>
                      </button>
                    </div>

                    {/* Continuous Scan Loop Checkbox */}
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={continuousMode}
                        onChange={(e) => setContinuousMode(e.target.checked)}
                        className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                      />
                      <span className="flex items-center gap-1">
                        <Zap className="w-3.5 h-3.5 text-amber-500" />
                        Continuous Mode (Hands-Free Loop)
                      </span>
                    </label>
                  </div>

                  {/* Bin Selection Grid / Dropdown */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-blue-500" />
                        <span>Target Storage Bin {actionType === 'STOCK_OUT' && '(From which bin)'}</span>
                      </label>
                      {foundProduct.stockBalances && foundProduct.stockBalances.length > 0 && actionType === 'STOCK_IN' && (
                        <button
                          type="button"
                          onClick={() => setShowOtherBins((prev) => !prev)}
                          className="text-xs text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                        >
                          {showOtherBins ? 'Show Primary Bins' : '+ Choose Another Warehouse Bin'}
                        </button>
                      )}
                    </div>

                    {/* Product Existing Bins Radio Cards */}
                    {!showOtherBins && foundProduct.stockBalances && foundProduct.stockBalances.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {foundProduct.stockBalances.map((sb) => {
                          const binId = sb.binId || sb.bin?.id || '';
                          const isSelected = selectedBinId === binId;
                          const currentQty = Number(sb.currentQuantity || 0);
                          const isDisabledStockOut = actionType === 'STOCK_OUT' && currentQty <= 0;

                          return (
                            <button
                              key={sb.id}
                              type="button"
                              disabled={isDisabledStockOut}
                              onClick={() => setSelectedBinId(binId)}
                              className={`p-3 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                                isDisabledStockOut
                                  ? 'opacity-40 cursor-not-allowed border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900'
                                  : isSelected
                                  ? actionType === 'STOCK_IN'
                                    ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/40 ring-2 ring-emerald-500/20'
                                    : 'border-rose-500 bg-rose-50/60 dark:bg-rose-950/40 ring-2 ring-rose-500/20'
                                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121526] hover:border-blue-400'
                              }`}
                            >
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300">
                                    {sb.bin?.code || 'BIN'}
                                  </span>
                                  <span className="text-xs text-slate-500 dark:text-slate-400">
                                    {sb.bin?.rack?.code ? `Rack ${sb.bin.rack.code}` : ''}
                                  </span>
                                </div>
                                <div className="text-[11px] text-slate-400 mt-0.5">
                                  {sb.bin?.rack?.location?.warehouse?.name || 'Main Warehouse'}
                                </div>
                              </div>

                              <div className="text-right">
                                <div className="text-sm font-bold font-mono text-slate-900 dark:text-white">
                                  {currentQty.toLocaleString()}
                                </div>
                                <div className="text-[10px] text-slate-400">
                                  {foundProduct.uom || 'units'} {isDisabledStockOut ? '(Empty)' : 'avail'}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      /* Fallback / Master Warehouse Bins Dropdown */
                      <div className="space-y-1">
                        <select
                          value={selectedBinId}
                          onChange={(e) => setSelectedBinId(e.target.value)}
                          className="w-full h-11 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0e111f] text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                        >
                          <option value="">-- Select Warehouse Storage Bin --</option>
                          {allMasterBins.map((bin) => (
                            <option key={bin.id} value={bin.id}>
                              {bin.code} ({bin.name || 'Standard Bin'})
                            </option>
                          ))}
                        </select>
                        <p className="text-[11px] text-slate-400">
                          {foundProduct.stockBalances?.length === 0
                            ? 'No stock records currently exist for this item. Select any storage bin to receive initial inventory.'
                            : 'Selecting an alternate warehouse bin for Stock In.'}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Quantity Input with Fast Increment Steppers */}
                  <form onSubmit={handleExecuteTransaction} className="space-y-3">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                          Quantity to {actionType === 'STOCK_IN' ? 'Receive (+)' : 'Deduct (-)'}
                        </label>
                        {actionType === 'STOCK_OUT' && (
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            Available in selected bin: <strong className="text-slate-900 dark:text-white font-mono">{availableQtyInSelectedBin} {foundProduct.uom || 'units'}</strong>
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Minus Step */}
                        <button
                          type="button"
                          onClick={() => {
                            const val = Math.max(1, (parseFloat(txnQuantity) || 1) - 1);
                            setTxnQuantity(String(val));
                          }}
                          className="w-12 h-12 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0e111f] flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold text-lg cursor-pointer transition-colors"
                        >
                          <Minus className="w-5 h-5" />
                        </button>

                        {/* Numeric Input */}
                        <div className="relative flex-1">
                          <input
                            ref={qtyInputRef}
                            type="number"
                            step="any"
                            min="0.001"
                            value={txnQuantity}
                            onChange={(e) => setTxnQuantity(e.target.value)}
                            placeholder="Qty"
                            className={`w-full h-12 px-4 pr-16 rounded-xl border-2 text-center text-2xl font-mono font-bold text-slate-900 dark:text-white bg-white dark:bg-[#0e111f] focus:outline-none transition-colors ${
                              isInsufficientStock
                                ? 'border-rose-500 focus:ring-4 focus:ring-rose-100 dark:focus:ring-rose-950'
                                : actionType === 'STOCK_IN'
                                ? 'border-emerald-500/70 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100 dark:focus:ring-emerald-950'
                                : 'border-rose-500/70 focus:border-rose-600 focus:ring-4 focus:ring-rose-100 dark:focus:ring-rose-950'
                            }`}
                          />
                          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold font-mono text-slate-400 uppercase pointer-events-none">
                            {foundProduct.uom || 'units'}
                          </span>
                        </div>

                        {/* Plus Step */}
                        <button
                          type="button"
                          onClick={() => {
                            const val = (parseFloat(txnQuantity) || 0) + 1;
                            setTxnQuantity(String(val));
                          }}
                          className="w-12 h-12 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0e111f] flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold text-lg cursor-pointer transition-colors"
                        >
                          <Plus className="w-5 h-5" />
                        </button>
                      </div>

                      {/* Quick Quantity Buttons */}
                      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        <span className="text-[11px] font-semibold text-slate-400 mr-1">Quick Qty:</span>
                        {[1, 5, 10, 25, 50, 100].map((q) => (
                          <button
                            key={q}
                            type="button"
                            onClick={() => setTxnQuantity(String(q))}
                            className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-slate-100 dark:bg-slate-800 hover:bg-blue-100 hover:text-blue-800 dark:hover:bg-blue-950 dark:hover:text-blue-300 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                          >
                            +{q}
                          </button>
                        ))}
                        {actionType === 'STOCK_OUT' && availableQtyInSelectedBin > 0 && (
                          <button
                            type="button"
                            onClick={() => setTxnQuantity(String(availableQtyInSelectedBin))}
                            className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 hover:bg-rose-200 transition-colors cursor-pointer ml-auto"
                          >
                            Max ({availableQtyInSelectedBin})
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Insufficient Stock Warning Alert */}
                    {isInsufficientStock && (
                      <div className="p-3 rounded-xl border border-rose-300 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 text-xs text-rose-800 dark:text-rose-200 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                        <span>
                          <strong>Insufficient Stock:</strong> Requested quantity ({parsedQty}) exceeds available balance ({availableQtyInSelectedBin} {foundProduct.uom || 'units'}).
                        </span>
                      </div>
                    )}

                    {/* Remarks (Discreet) */}
                    <div>
                      <input
                        type="text"
                        value={txnRemarks}
                        onChange={(e) => setTxnRemarks(e.target.value)}
                        placeholder="Optional scan remarks or operator note..."
                        className="w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0e111f] text-xs text-slate-700 dark:text-slate-300 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    {/* Big Action Submit Button */}
                    <button
                      type="submit"
                      disabled={isSubmitting || !selectedBinId || parsedQty <= 0 || isInsufficientStock}
                      className={`w-full h-12 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md ${
                        actionType === 'STOCK_IN'
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20 active:scale-[0.99] disabled:bg-slate-300 dark:disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed'
                          : 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/20 active:scale-[0.99] disabled:bg-slate-300 dark:disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed'
                      }`}
                    >
                      {isSubmitting ? (
                        <>
                          <span className="animate-spin mr-1">⟳</span>
                          <span>Recording {actionType}...</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4" />
                          <span>
                            {actionType === 'STOCK_IN'
                              ? `Confirm Stock In (+${parsedQty || 0} ${foundProduct.uom || 'units'})`
                              : `Confirm Stock Out (-${parsedQty || 0} ${foundProduct.uom || 'units'})`}
                          </span>
                          <kbd className="text-[10px] font-mono px-2 py-0.5 rounded bg-black/20 text-white/90 ml-2">
                            Press [ENTER]
                          </kbd>
                        </>
                      )}
                    </button>
                  </form>
                </div>

                {/* Scannable Barcode Vector Preview */}
                <div className="pt-1 flex justify-center">
                  <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-2xs">
                    <BarcodeSvg
                      value={foundProduct.barcode || ''}
                      width={1.3}
                      height={32}
                      fontSize={11}
                      margin={2}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Display State: 3. Unknown Barcode with Floor Onboarding */}
            {unknownBarcode && (
              <div className="p-5 rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/40 dark:bg-amber-950/20 space-y-4 animate-in fade-in duration-150">
                <div className="flex items-start space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-amber-100">
                      Unregistered Barcode Scanned
                    </h3>
                    <p className="text-xs text-slate-700 dark:text-amber-200 mt-1 leading-relaxed">
                      Barcode{' '}
                      <strong className="font-mono text-sm bg-white dark:bg-[#121526] px-2 py-0.5 rounded border border-amber-300 dark:border-amber-800 text-slate-900 dark:text-white">
                        {unknownBarcode}
                      </strong>{' '}
                      does not match any product in the system catalog.
                    </p>
                  </div>
                </div>

                {/* Linking Flow Accordion */}
                {isLinkingOpen ? (
                  <div className="p-4 rounded-xl border border-amber-300 dark:border-amber-800 bg-white dark:bg-[#121526] space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <LinkIcon className="w-3.5 h-3.5 text-blue-600" />
                        Link {unknownBarcode} to Existing Product
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsLinkingOpen(false)}
                        className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>

                    <input
                      type="text"
                      value={linkSearchQuery}
                      onChange={(e) => setLinkSearchQuery(e.target.value)}
                      placeholder="Search product by name or code..."
                      className="w-full h-10 px-3 rounded-lg border border-slate-300 dark:border-slate-700 text-xs bg-slate-50 dark:bg-[#0e111f] focus:outline-none focus:ring-2 focus:ring-blue-500"
                      autoFocus
                    />

                    <div className="max-h-40 overflow-y-auto space-y-1">
                      {filteredLinkProducts.map((p) => {
                        const isSelected = selectedLinkProduct?.id === p.id;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setSelectedLinkProduct(p)}
                            className={`w-full p-2 rounded-lg text-left text-xs flex items-center justify-between transition-colors cursor-pointer ${
                              isSelected
                                ? 'bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-200 font-bold border border-blue-300'
                                : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            <span>{p.name}</span>
                            <span className="font-mono text-[11px] text-slate-400">{p.code}</span>
                          </button>
                        );
                      })}
                    </div>

                    {selectedLinkProduct && (
                      <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                        <Button
                          size="sm"
                          disabled={isLinkingSubmitting}
                          onClick={handleLinkProductSubmit}
                          className="cursor-pointer"
                        >
                          {isLinkingSubmitting ? 'Linking...' : `Link to ${selectedLinkProduct.name}`}
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-3 pt-2">
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => setIsLinkingOpen(true)}
                      className="cursor-pointer"
                    >
                      <LinkIcon className="w-3.5 h-3.5 mr-1.5" />
                      Link to Existing Product
                    </Button>
                    <Button size="sm" variant="secondary" onClick={handleReset} className="cursor-pointer">
                      <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                      Scan Another Barcode
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Session Scan History with Shift Analytics & CSV Export */}
            {history.length > 0 && (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
                {/* Session Shift Analytics Bar */}
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0e111f] border border-slate-200 dark:border-slate-800 flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-3 text-xs">
                    <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                      <Activity className="w-3.5 h-3.5 text-blue-500" />
                      Shift Log:
                    </span>
                    <span className="text-slate-600 dark:text-slate-400">
                      Total: <strong className="font-mono text-slate-900 dark:text-white">{sessionStats.totalScans}</strong>
                    </span>
                    <span className="text-emerald-700 dark:text-emerald-400">
                      Inward: <strong className="font-mono">+{sessionStats.inQty}</strong>
                    </span>
                    <span className="text-rose-700 dark:text-rose-400">
                      Outward: <strong className="font-mono">-{sessionStats.outQty}</strong>
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleExportCsv}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-white dark:bg-[#121526] border border-slate-200 dark:border-slate-700 hover:border-blue-400 text-slate-700 dark:text-slate-300 flex items-center gap-1.5 cursor-pointer shadow-2xs"
                      title="Download Shift Scan Log as CSV"
                    >
                      <Download className="w-3 h-3 text-blue-600" />
                      <span>Export CSV</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setHistory([])}
                      className="text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {history.map((item, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setBarcodeInput(item.barcode);
                        handleLookup(item.barcode);
                      }}
                      className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-600 bg-white dark:bg-[#121526] flex items-center justify-between text-left transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center space-x-2.5">
                        <span className="text-[10px] font-mono text-slate-400">{item.timestamp}</span>
                        <span className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200">
                          {item.barcode}
                        </span>
                        {item.product && (
                          <span className="text-xs text-slate-600 dark:text-slate-400 font-medium truncate max-w-xs">
                            &bull; {item.product.name}
                          </span>
                        )}
                        {item.actionDetails && (
                          <span
                            className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded ${
                              item.actionDetails.action === 'STOCK_IN'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                            }`}
                          >
                            {item.actionDetails.action === 'STOCK_IN' ? '+' : '-'}
                            {item.actionDetails.quantity} {item.actionDetails.uom} ({item.actionDetails.binCode})
                          </span>
                        )}
                      </div>

                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          item.status === 'TRANSACTED'
                            ? item.actionDetails?.action === 'STOCK_IN'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                            : item.status === 'FOUND'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                        }`}
                      >
                        {item.status}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0c0e1a] flex items-center justify-between text-xs text-slate-500">
            <span>
              Tip: Press <kbd className="font-mono bg-white dark:bg-[#121526] px-1 py-0.5 rounded border border-slate-300 dark:border-slate-700">ESC</kbd> to exit scanner mode
            </span>
            <Button variant="secondary" size="sm" onClick={onClose}>
              Close Scanner
            </Button>
          </div>
        </div>
      </div>

      {/* Printable Label Modal Sub-Dialog */}
      {foundProduct && isPrintModalOpen && (
        <BarcodeLabelModal
          isOpen={isPrintModalOpen}
          products={[foundProduct]}
          onClose={() => setIsPrintModalOpen(false)}
        />
      )}
    </>
  );
};
