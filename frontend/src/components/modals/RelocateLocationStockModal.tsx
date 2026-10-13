import React, { useState, useEffect } from 'react';
import {
  Modal,
  Button,
  SearchSelect,
  type SearchSelectOption,
} from '../ui';
import {
  Truck,
  AlertTriangle,
  Package,
  Layers,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { masterDataService } from '../../services/masterDataService';
import type {
  Location,
  Warehouse,
  Bin,
  LocationActiveStock,
  RelocateAndDeleteLocationPayload,
} from '../../services/masterDataService';

interface RelocateLocationStockModalProps {
  isOpen: boolean;
  location: Location;
  warehouse?: Warehouse;
  activeStocks: LocationActiveStock[];
  onClose: () => void;
  onSuccess: () => void;
}

export function RelocateLocationStockModal({
  isOpen,
  location,
  warehouse: _warehouse,
  activeStocks,
  onClose,
  onSuccess,
}: RelocateLocationStockModalProps) {
  const [allBins, setAllBins] = useState<Bin[]>([]);
  const [isLoadingBins, setIsLoadingBins] = useState(true);
  const [targetBins, setTargetBins] = useState<Record<string, string>>({});
  const [bulkBinId, setBulkBinId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load available bins across all warehouses
  useEffect(() => {
    let isMounted = true;
    const fetchBins = async () => {
      try {
        setIsLoadingBins(true);
        const res = await masterDataService.getBins({
          pageSize: 1000,
          isActive: true,
        });
        if (isMounted) {
          setAllBins(res.data);
        }
      } catch (err: any) {
        console.error('Failed to load storage bins', err);
        if (isMounted) {
          toast.error('Failed to load eligible storage bins');
        }
      } finally {
        if (isMounted) {
          setIsLoadingBins(false);
        }
      }
    };

    if (isOpen) {
      fetchBins();
      setErrorMessage(null);
      setTargetBins({});
      setBulkBinId('');
    }

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  // Filter out any bins that reside within the location being deleted
  const eligibleBins = React.useMemo(() => {
    return allBins.filter(
      (b) =>
        b.rack?.locationId !== location.id &&
        b.rack?.location?.id !== location.id
    );
  }, [allBins, location.id]);

  // Transform eligible bins for SearchSelect
  const binOptions: SearchSelectOption[] = React.useMemo(() => {
    return eligibleBins.map((b) => {
      const whName = b.rack?.location?.warehouse?.name || 'Warehouse';
      const locName = b.rack?.location?.name || 'Location';
      const rackName = b.rack?.name || 'Rack';
      return {
        id: b.id,
        primary: `${b.code} (${b.name || 'Storage Unit'})`,
        secondary: `${whName} → ${locName} → ${rackName}`,
      };
    });
  }, [eligibleBins]);

  // Handle assigning target bin for a specific stock balance
  const handleAssignBin = (balanceId: string, binId: string) => {
    setTargetBins((prev) => ({
      ...prev,
      [balanceId]: binId,
    }));
  };

  // Bulk assign all items to one target bin
  const handleApplyBulkBin = () => {
    if (!bulkBinId) return;
    const nextMap: Record<string, string> = {};
    activeStocks.forEach((item) => {
      nextMap[item.balanceId] = bulkBinId;
    });
    setTargetBins(nextMap);
    toast.success('Assigned destination bin to all items');
  };

  // Check if all active stocks have a target bin selected
  const allAssigned =
    activeStocks.length > 0 &&
    activeStocks.every((s) => !!targetBins[s.balanceId]);

  const assignedCount = activeStocks.filter(
    (s) => !!targetBins[s.balanceId]
  ).length;

  // Handle submission of relocation and deletion
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allAssigned) {
      setErrorMessage('Please select a destination bin for each product.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);

      const payload: RelocateAndDeleteLocationPayload = {
        transfers: activeStocks.map((stock) => ({
          productId: stock.productId,
          sourceBinId: stock.currentBinId,
          targetBinId: targetBins[stock.balanceId],
          quantity: Number(stock.quantity),
        })),
      };

      const res = await masterDataService.relocateAndDeleteLocation(
        location.id,
        payload
      );
      toast.success(
        res.message ||
          `Successfully shifted ${activeStocks.length} product(s) and deleted location "${location.name}".`
      );
      onSuccess();
    } catch (err: any) {
      const msg =
        err.response?.data?.message ||
        err.message ||
        'Failed to relocate inventory and delete location.';
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={isSubmitting ? () => {} : onClose}
      title={
        <div className="flex items-center space-x-3 text-slate-900 dark:text-white">
          <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-lg text-slate-900 dark:text-white leading-tight">
              Shift Products & Delete Location
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Location{' '}
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                "{location.name}"
              </span>{' '}
              ({location.code})
            </p>
          </div>
        </div>
      }
      className="dark:bg-[#121526] dark:border dark:border-[#1e233d] sm:max-w-3xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Notice Banner */}
        <div className="p-4 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/90 dark:border-amber-900/50 flex items-start space-x-3.5">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900 dark:text-amber-200 space-y-1">
            <p className="font-bold text-sm">
              Active Inventory Stock Detected ({activeStocks.length} Product
              {activeStocks.length !== 1 ? 's' : ''})
            </p>
            <p className="leading-relaxed text-amber-800 dark:text-amber-300">
              This storage location cannot be deleted until all active inventory
              is relocated. Select destination racks and bins below to transfer
              these items. The system will atomically record transfer transactions
              in the stock movement ledger, update target balances, and delete this
              empty location.
            </p>
          </div>
        </div>

        {/* Error Alert if any */}
        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 flex items-start space-x-3 text-red-800 dark:text-red-200 text-xs">
            <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Unable to Complete Shift</p>
              <p className="mt-0.5">{errorMessage}</p>
            </div>
          </div>
        )}

        {/* Quick Bulk Assign (for multiple items) */}
        {activeStocks.length > 1 && eligibleBins.length > 0 && (
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0e111f] border border-slate-200/80 dark:border-[#1e233d] flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center space-x-2 min-w-0">
              <Layers className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Quick Action: Assign same destination bin to all products
              </span>
            </div>
            <div className="flex items-center space-x-2 w-full md:w-80 min-w-0 shrink-0">
              <div className="flex-1 min-w-0">
                <SearchSelect
                  options={binOptions}
                  value={bulkBinId}
                  onChange={(id) => setBulkBinId(id)}
                  placeholder="Select Common Bin..."
                  disabled={isLoadingBins || isSubmitting}
                />
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleApplyBulkBin}
                disabled={!bulkBinId || isSubmitting}
                className="shrink-0 cursor-pointer"
              >
                Apply All
              </Button>
            </div>
          </div>
        )}

        {/* Warning if no external bins are available */}
        {!isLoadingBins && eligibleBins.length === 0 && (
          <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-xs text-rose-800 dark:text-rose-200 flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">No Destination Bins Available</p>
              <p className="mt-1">
                There are no other active storage bins available outside of this
                location. Please create a new storage location or bins in another
                warehouse facility first before deleting this location.
              </p>
            </div>
          </div>
        )}

        {/* Products Table */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Products to Shift ({assignedCount} / {activeStocks.length} Assigned)
            </span>
            <span className="text-slate-500 dark:text-slate-400">
              Assign destination rack/bin for each product
            </span>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-[#1e233d] divide-y divide-slate-100 dark:divide-[#1e233d]">
            {activeStocks.map((stock, idx) => {
              const assignedBinId = targetBins[stock.balanceId];
              const isAssigned = !!assignedBinId;

              return (
                <div
                  key={stock.balanceId || `${stock.productId}_${idx}`}
                  className="p-4 bg-white dark:bg-[#121526] hover:bg-slate-50/60 dark:hover:bg-[#0e111f]/60 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4 first:rounded-t-xl last:rounded-b-xl"
                >
                  {/* Left: Product & Current Location Info */}
                  <div className="flex items-start space-x-3 flex-1 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0 mt-0.5">
                      <Package className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-sm text-slate-900 dark:text-white truncate">
                          {stock.productName}
                        </span>
                        <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {stock.productCode || 'RAW'}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                        <span>
                          Source Bin:{' '}
                          <strong className="text-slate-800 dark:text-slate-200 font-mono">
                            {stock.currentBinCode}
                          </strong>
                        </span>
                        {stock.currentRackCode && (
                          <span>
                            Rack:{' '}
                            <strong className="text-slate-800 dark:text-slate-200 font-mono">
                              {stock.currentRackCode}
                            </strong>
                          </span>
                        )}
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                          Qty: {stock.quantity} {stock.uom}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Target Bin Selector */}
                  <div className="w-full md:w-80 shrink-0 min-w-0">
                    <div className="flex items-center space-x-2 min-w-0">
                      <div className="flex-1 min-w-0">
                        <SearchSelect
                          options={binOptions}
                          value={assignedBinId || ''}
                          onChange={(id) => handleAssignBin(stock.balanceId, id)}
                          placeholder="Select Destination Rack / Bin..."
                          disabled={isLoadingBins || isSubmitting}
                        />
                      </div>
                      {isAssigned && (
                        <div
                          className="w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0"
                          title="Destination bin selected"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-slate-200 dark:border-[#1e233d]">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {allAssigned ? (
              <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> Ready to shift inventory and delete location.
              </span>
            ) : (
              <span>
                Please select destination bins for all {activeStocks.length}{' '}
                product(s) to proceed.
              </span>
            )}
          </div>

          <div className="flex items-center space-x-2.5 justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={isSubmitting}
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="danger"
              disabled={!allAssigned || isSubmitting || eligibleBins.length === 0}
              className="cursor-pointer font-semibold"
            >
              {isSubmitting ? (
                'Shifting Inventory...'
              ) : (
                <div className="flex items-center space-x-1.5">
                  <Truck className="w-4 h-4 mr-1" />
                  <span>Shift Stock & Delete Location</span>
                </div>
              )}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
