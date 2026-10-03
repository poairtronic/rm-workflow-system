import { useState, useEffect } from 'react';
import { X, ShoppingCart, AlertCircle } from 'lucide-react';
import type { MslExceptionRow } from '../../types/inventory';

interface EmergencyRequisitionDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  item: MslExceptionRow | null;
  onSubmit: (item: MslExceptionRow, quantity: number, vendor: string, urgency: string) => void;
}

export function EmergencyRequisitionDrawer({ isOpen, onClose, item, onSubmit }: EmergencyRequisitionDrawerProps) {
  const [quantity, setQuantity] = useState<string>('');
  const [vendor, setVendor] = useState<string>('');
  const [urgency, setUrgency] = useState<string>('ASAP');

  useEffect(() => {
    if (item && isOpen) {
      const deficit = item.mslTarget - item.currentStock;
      setQuantity(deficit > 0 ? deficit.toString() : '');
      setVendor('');
      setUrgency('ASAP');
    }
  }, [item, isOpen]);

  if (!isOpen || !item) return null;

  const deficit = item.mslTarget - item.currentStock;
  const isCritical = item.severity === 'CRITICAL';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(item, parseFloat(quantity), vendor, urgency);
  };

  return (
    <>
      <div 
        className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40 transition-opacity" 
        onClick={onClose}
      />
      <div className="fixed inset-y-0 right-0 w-96 bg-white shadow-[0_10px_15px_-3px_rgba(0,0,0,0.08),0_4px_6px_-4px_rgba(0,0,0,0.04)] z-50 flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2 text-slate-900">
            <ShoppingCart className="w-5 h-5 text-primary" />
            <h2 className="font-semibold tracking-tight">Generate Emergency PO</h2>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1.5 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Item Context */}
        <div className="p-5 border-b border-slate-100 bg-white">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-[11px] font-bold text-slate-500 tracking-wider uppercase mb-1">{item.materialCode}</p>
              <h3 className="text-sm font-semibold text-slate-900">{item.description}</h3>
            </div>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider
              ${isCritical ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-amber-100 text-amber-700 border border-amber-200'}`}>
              {isCritical ? 'CRITICAL' : 'LOW STOCK'}
            </span>
          </div>

          <div className={`flex items-center gap-2 p-3 rounded-lg text-sm tabular-nums border ${isCritical ? 'bg-red-50 border-red-100' : 'bg-amber-50 border-amber-100'}`}>
            <AlertCircle className={`w-4 h-4 ${isCritical ? 'text-red-500' : 'text-amber-500'}`} />
            <div className="flex-1 flex justify-between font-medium">
              <span className={isCritical ? 'text-red-900' : 'text-amber-900'}>
                Current: {item.currentStock.toFixed(1)} {item.unit}
              </span>
              <span className={isCritical ? 'text-red-600' : 'text-amber-600'}>
                Deficit: {deficit.toFixed(1)} {item.unit}
              </span>
            </div>
          </div>
        </div>

        {/* Form Controls */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 flex flex-col gap-5 bg-white">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Order Quantity ({item.unit})
            </label>
            <input
              type="number"
              required
              min={deficit > 0 ? deficit : 0}
              step="0.01"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm tabular-nums text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-shadow"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Primary Vendor
            </label>
            <select
              required
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
              className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-shadow"
            >
              <option value="" disabled>Select approved supplier...</option>
              <option value="Apex Processors">Apex Processors</option>
              <option value="Zenith Dye Works">Zenith Dye Works</option>
              <option value="Global Metals Inc.">Global Metals Inc.</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Urgency / SLA Target
            </label>
            <select
              required
              value={urgency}
              onChange={(e) => setUrgency(e.target.value)}
              className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-shadow"
            >
              <option value="ASAP">ASAP (Expedited - 24h)</option>
              <option value="Standard">Standard (3-5 Days)</option>
              <option value="Next Week">Next Week</option>
            </select>
          </div>
        </form>

        {/* Footer */}
        <div className="p-5 border-t border-slate-200 bg-slate-50 flex flex-col gap-3">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!vendor || !quantity}
            className="w-full h-10 flex justify-center items-center gap-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            Authorize & Generate PO
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full h-10 flex justify-center items-center bg-white text-slate-700 border border-slate-200 text-sm font-semibold rounded-lg hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-200 transition-all"
          >
            Cancel
          </button>
        </div>
        
      </div>
    </>
  );
}
