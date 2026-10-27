import { useState } from 'react';
import { toast } from 'react-hot-toast';
import {
  Trash2,
  CheckSquare,
  Square,
  RotateCcw,
  ShieldAlert,
  Layers,
  Truck,
  Box,
  ShoppingCart,
  Database,
  Bell,
  Info,
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { systemSettingsApi } from '../../services/api';
import { extractErrorMessage } from '../../utils/extractErrorMessage';

interface ResetSystemDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface ModuleOption {
  key: string;
  label: string;
  desc: string;
  category: 'workflow' | 'dc' | 'inventory' | 'consumable' | 'master' | 'logs';
}

const MODULE_OPTIONS: ModuleOption[] = [
  // Workflow & Requisitions
  { key: 'po_traceability', label: 'Purchase Orders (POs)', desc: 'Purges POs and cascades all related SCs, issues, receipts, consumptions, and DC lots', category: 'workflow' },
  { key: 'sc_traceability', label: 'Sales Order Components (SCs)', desc: 'Purges SC work orders and their downstream execution records', category: 'workflow' },
  { key: 'my_requisitions', label: 'My Requisitions', desc: 'Design RM requisitions, draft submissions, and item snapshots', category: 'workflow' },
  { key: 'rm_issue', label: 'RM Issue Lots & Dispatches', desc: 'Material issue records and line item lots dispatched to the shop floor', category: 'workflow' },
  { key: 'rm_receipt', label: 'RM Receipt & Queue', desc: 'Confirmed shop-floor material receipts and awaiting queue records', category: 'workflow' },
  { key: 'material_consumption', label: 'Material Consumption', desc: 'Shop-floor raw material consumption logs and stock deduction records', category: 'workflow' },
  { key: 'request_return_verify', label: 'RM Request & Return Verify', desc: 'Additional requests, scrap/excess material returns, and stores verification queue', category: 'workflow' },

  // Delivery Challan
  { key: 'dc', label: 'Delivery Challans (DC Type 1 & 2)', desc: 'All process dispatch and general delivery challan records and items', category: 'dc' },
  { key: 'dc_movements', label: 'DC Movements, Rework & QC', desc: 'Outward/inward scans, rework queue, and QC inspection evaluations', category: 'dc' },

  // Inventory & Stock
  { key: 'stock', label: 'Stock & Current Inventory', desc: 'On-hand balances, warehouse stock items, and MSL alert thresholds', category: 'inventory' },
  { key: 'stock_movement', label: 'Stock Movements & Transactions', desc: 'Material movement ledger entries, general issues, and transaction logs', category: 'inventory' },

  // Consumables
  { key: 'consumables', label: 'Consumable Requests', desc: 'Departmental non-RM consumable purchase and store requisitions', category: 'consumable' },
  { key: 'purchase_store_consumables', label: 'Purchase & Store Consumables', desc: 'Consumable inventory balances and store inward batches', category: 'consumable' },

  // Master Data
  { key: 'product', label: 'Products Master', desc: 'Product items, product families, and category definitions', category: 'master' },
  { key: 'vendor', label: 'Vendors Master', desc: 'Registered vendor partners, capability mappings, and SLA benchmark rules', category: 'master' },
  { key: 'warehouse_locations', label: 'Locations, Racks & Bins', desc: 'Storage locations, racks, and bin hierarchy (keeps parent Warehouses)', category: 'master' },
  { key: 'warehouse', label: 'Warehouses Master (Full)', desc: 'All warehouses, locations, racks, and bin entities', category: 'master' },
  { key: 'production_processes', label: 'Production Process Master', desc: 'Manufacturing process master definitions and sequencing steps', category: 'master' },

  // System Logs
  { key: 'notifications', label: 'In-App Notifications', desc: 'Historical notification alerts and delivery records', category: 'logs' },
  { key: 'audit_logs', label: 'Audit Trail Logs', desc: 'System security and action audit event records', category: 'logs' },
];

export function ResetSystemDataModal({ isOpen, onClose, onSuccess }: ResetSystemDataModalProps) {
  const [selected, setSelected] = useState<Record<string, boolean>>({
    po_traceability: true,
    sc_traceability: true,
    my_requisitions: true,
    rm_issue: true,
    rm_receipt: true,
    material_consumption: true,
    request_return_verify: true,
    dc: true,
    dc_movements: true,
    stock: true,
    stock_movement: true,
    consumables: true,
    purchase_store_consumables: true,
  });

  const [confirmInput, setConfirmInput] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const toggleOption = (key: string) => {
    setSelected((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // Presets
  const selectTransactionsOnly = () => {
    const next: Record<string, boolean> = {};
    MODULE_OPTIONS.forEach((opt) => {
      if (opt.category !== 'master' && opt.category !== 'logs') {
        next[opt.key] = true;
      }
    });
    setSelected(next);
  };

  const selectAll = () => {
    const next: Record<string, boolean> = {};
    MODULE_OPTIONS.forEach((opt) => {
      next[opt.key] = true;
    });
    setSelected(next);
  };

  const deselectAll = () => {
    setSelected({});
  };

  const selectedCount = Object.values(selected).filter(Boolean).length;
  const isResetEnabled = confirmInput.trim().toUpperCase() === 'RESET' && selectedCount > 0;

  const handleReset = async () => {
    if (!isResetEnabled) return;

    try {
      setSubmitting(true);
      const res = await systemSettingsApi.resetSystemData({
        ...selected,
        confirmationToken: 'RESET',
      });

      toast.success(res?.message || 'System test data successfully reset!');
      setConfirmInput('');
      onClose();
      if (onSuccess) {
        onSuccess();
      } else {
        setTimeout(() => {
          window.location.reload();
        }, 800);
      }
    } catch (err: any) {
      console.error('System reset failed', err);
      toast.error(
        extractErrorMessage(err, 'Failed to execute system data reset.'),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const renderCategory = (
    title: string,
    category: 'workflow' | 'dc' | 'inventory' | 'consumable' | 'master' | 'logs',
    icon: any,
  ) => {
    const options = MODULE_OPTIONS.filter((o) => o.category === category);
    const Icon = icon;

    return (
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
          <Icon className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
          <span>{title}</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {options.map((opt) => {
            const isChecked = !!selected[opt.key];
            return (
              <label
                key={opt.key}
                onClick={() => toggleOption(opt.key)}
                className={`flex items-start gap-2.5 p-2.5 rounded-lg border text-xs cursor-pointer select-none transition-all ${
                  isChecked
                    ? 'bg-rose-50/60 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/60 text-slate-900 dark:text-white'
                    : 'bg-white dark:bg-[#141829] border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                }`}
              >
                <div className="mt-0.5 text-rose-600 dark:text-rose-400">
                  {isChecked ? (
                    <CheckSquare className="w-4 h-4" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-400" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="font-bold flex items-center justify-between">
                    <span>{opt.label}</span>
                    {isChecked && (
                      <span className="text-[10px] font-semibold text-rose-600 dark:text-rose-400 bg-rose-100 dark:bg-rose-950/80 px-1.5 py-0.2 rounded">
                        Purge
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug mt-0.5">
                    {opt.desc}
                  </p>
                </div>
              </label>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      className="sm:max-w-3xl"
      title={
        <div className="flex items-center gap-2.5 text-rose-600 dark:text-rose-400">
          <div className="w-8 h-8 rounded-lg bg-rose-100 dark:bg-rose-950/60 flex items-center justify-center">
            <Trash2 className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-900 dark:text-white">
              Reset & Purge Test Data
            </h3>
            <p className="text-xs text-slate-500 font-normal">
              Select specific operational or master data to delete cleanly from the database.
            </p>
          </div>
        </div>
      }
      footer={
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 w-full">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            <strong>{selectedCount}</strong> module(s) selected for deletion
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 sm:flex-none px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleReset}
              disabled={!isResetEnabled || submitting}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-400 text-white rounded-lg text-xs font-bold shadow-xs transition-all cursor-pointer disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                  <span>Purging Data...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Permanently Purge Selected Data</span>
                </>
              )}
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-5 py-2 text-left">
        {/* Notice Banner */}
        <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900 dark:text-amber-200">
            <span className="font-bold">Admin Safeguard:</span> All user accounts, passwords, login
            credentials, and role-based permissions are <strong>strictly preserved</strong> and will
            never be deleted. Only selected manufacturing data is wiped.
          </div>
        </div>

        {/* PO Cascade Note */}
        {selected.po_traceability && (
          <div className="p-3 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/60 flex items-center gap-2.5 text-xs text-indigo-900 dark:text-indigo-200">
            <Info className="w-4 h-4 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
            <span>
              <strong>Cascade Active:</strong> Selecting Purchase Orders will automatically delete
              all dependent SCs, material issues, receipts, consumptions, and DC lots in atomic order.
            </span>
          </div>
        )}

        {/* Preset Selection Buttons */}
        <div className="flex items-center justify-between flex-wrap gap-2 pt-1 border-b border-slate-200 dark:border-slate-800 pb-3">
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
            Quick Selection:
          </span>
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={selectTransactionsOnly}
              className="px-2.5 py-1 text-xs font-semibold rounded-md bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:hover:bg-indigo-900/50 dark:text-indigo-300 transition-colors cursor-pointer"
            >
              Transactions & Workflows Only (Keep Masters)
            </button>
            <button
              type="button"
              onClick={selectAll}
              className="px-2.5 py-1 text-xs font-semibold rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
            >
              Select All
            </button>
            <button
              type="button"
              onClick={deselectAll}
              className="px-2.5 py-1 text-xs font-semibold rounded-md text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer"
            >
              Deselect All
            </button>
          </div>
        </div>

        {/* Checkbox Groups */}
        <div className="space-y-4 max-h-[46vh] overflow-y-auto pr-1">
          {renderCategory('Orders & Traceability', 'workflow', Layers)}
          {renderCategory('Delivery Challans & Vendor Workflows', 'dc', Truck)}
          {renderCategory('Inventory & Stock', 'inventory', Box)}
          {renderCategory('Consumables', 'consumable', ShoppingCart)}
          {renderCategory('Masters (Master Data)', 'master', Database)}
          {renderCategory('System Activity Logs', 'logs', Bell)}
        </div>

        {/* Confirmation Typing Input */}
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#141829] border border-slate-200 dark:border-slate-800 space-y-2">
          <label className="block text-xs font-bold text-slate-900 dark:text-white">
            Security Confirmation: Type <span className="font-mono text-rose-600 font-black">RESET</span> to confirm:
          </label>
          <input
            type="text"
            value={confirmInput}
            onChange={(e) => setConfirmInput(e.target.value)}
            placeholder="Type RESET in all caps"
            className="w-full px-3 py-2 text-xs font-mono font-bold border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
          />
        </div>
      </div>
    </Modal>
  );
}
