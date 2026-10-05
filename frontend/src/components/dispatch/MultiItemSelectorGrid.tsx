import { useState } from 'react';
import { useFieldArray, useFormContext } from 'react-hook-form';
import { Search, Plus, Trash2, AlertCircle } from 'lucide-react';
import type { CreateDeliveryChallanDto } from '../../types/delivery-challan.dto';

// Mock inventory catalog
const CATALOG = [
  { materialCode: 'CONS-GLV-M', name: 'Nitrile Gloves (Medium)', uom: 'NOS', maxStock: 500, bins: ['BIN-C1', 'BIN-C2'] },
  { materialCode: 'CONS-WPR-01', name: 'Industrial Wipers', uom: 'NOS', maxStock: 200, bins: ['BIN-W1'] },
  { materialCode: 'LUB-HL-32', name: 'Hydraulic Oil 32', uom: 'LTR', maxStock: 50, bins: ['BIN-L1'] },
];

export function MultiItemSelectorGrid() {
  const { register, control, watch } = useFormContext<CreateDeliveryChallanDto>();
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items'
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState(CATALOG);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const handleSearch = (term: string) => {
    setSearchTerm(term);
    const filtered = CATALOG.filter(item => 
      item.materialCode.toLowerCase().includes(term.toLowerCase()) ||
      item.name.toLowerCase().includes(term.toLowerCase())
    );
    setSearchResults(filtered);
    setIsSearchOpen(true);
  };

  const addItem = (item: typeof CATALOG[0]) => {
    append({ 
      materialCode: item.materialCode, 
      sourceBinId: item.bins[0], 
      batchNumber: 'N/A', 
      quantity: 1, 
      uom: item.uom,
      // @ts-ignore - Temporary local state for validation
      _maxStock: item.maxStock 
    });
    setSearchTerm('');
    setIsSearchOpen(false);
  };

  const items = watch('items') || [];

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 mb-6">
      <div className="flex items-center justify-between mb-6 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-[15px] font-semibold text-slate-900 uppercase tracking-wide">Payload Selector</h2>
          <p className="text-xs text-slate-500 mt-1">Search catalog and select items for dispatch</p>
        </div>
      </div>

      {/* Catalog Search Bar */}
      <div className="relative mb-6 max-w-md">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
            onFocus={() => setIsSearchOpen(true)}
            placeholder="Search material code or name..."
            className="w-full h-10 pl-9 pr-4 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary focus:bg-white transition-colors"
          />
        </div>
        
        {isSearchOpen && searchResults.length > 0 && (
          <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
            {searchResults.map((item) => (
              <button
                key={item.materialCode}
                type="button"
                onClick={() => addItem(item)}
                className="w-full text-left px-4 py-3 hover:bg-slate-50 border-b border-slate-100 last:border-0 flex items-center justify-between"
              >
                <div>
                  <p className="text-sm font-medium text-slate-900">{item.name}</p>
                  <p className="text-xs text-slate-500">{item.materialCode}</p>
                </div>
                <Plus className="w-4 h-4 text-primary" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Dynamic Grid */}
      <div className="overflow-x-auto w-full">
        <table className="w-full text-sm text-left whitespace-nowrap">
          <thead className="h-10 bg-slate-50 border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-2 w-1/3">Item Details</th>
              <th className="px-4 py-2 w-1/4">Source Bin</th>
              <th className="px-4 py-2 text-right w-32">Available</th>
              <th className="px-4 py-2 text-right w-32">Dispatch Qty</th>
              <th className="px-4 py-2 w-20">UOM</th>
              <th className="px-4 py-2 text-center w-16">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {fields.map((field: any, index) => {
              const maxStock = field._maxStock || 100;
              const currentQty = Number(items[index]?.quantity || 0);
              const isError = currentQty > maxStock;

              return (
                <tr key={field.id} className="h-14">
                  <td className="px-4 py-2">
                    <p className="font-medium text-slate-900">{field.materialCode}</p>
                  </td>
                  <td className="px-4 py-2">
                    <select
                      {...register(`items.${index}.sourceBinId` as const, { required: 'Required' })}
                      className="w-full h-9 px-3 rounded-md bg-white border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    >
                      <option value={field.sourceBinId}>{field.sourceBinId}</option>
                    </select>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <span className="tabular-nums font-medium text-slate-600">{maxStock}</span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex flex-col items-end">
                      <input
                        type="number"
                        step="0.1"
                        {...register(`items.${index}.quantity` as const, { 
                          required: 'Required',
                          min: { value: 0.1, message: 'Invalid' },
                          validate: val => val <= maxStock || 'Exceeds stock'
                        })}
                        className={`w-24 h-9 px-3 rounded-md bg-white border text-sm text-right tabular-nums focus:outline-none focus:ring-2 ${
                          isError 
                            ? 'border-red-600 ring-1 ring-red-600 text-red-700' 
                            : 'border-slate-200 text-slate-900 focus:ring-primary focus:border-transparent'
                        }`}
                      />
                      {isError && (
                        <span className="text-[10px] text-red-600 mt-0.5 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" /> Exceeds balance
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <span className="text-slate-600 font-medium">{field.uom}</span>
                  </td>
                  <td className="px-4 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
            
            {fields.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                  No items added. Search the catalog above to add items to the payload.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
