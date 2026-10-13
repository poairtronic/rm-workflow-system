import React, { useState, useRef, useEffect } from 'react';
import { Barcode, Printer, Copy, Check } from 'lucide-react';
import { BarcodeSvg } from '../common/BarcodeSvg';
import type { Product } from '../../services/masterDataService';
import { toast } from 'react-hot-toast';

interface BarcodeBadgeProps {
  product: Product;
  onPrint?: (product: Product) => void;
}

export const BarcodeBadge: React.FC<BarcodeBadgeProps> = ({ product, onPrint }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  const barcodeValue = product.barcode || `PRD-${product.code || 'ITEM'}`;

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(barcodeValue);
    setCopied(true);
    toast.success(`Copied "${barcodeValue}" to clipboard`);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative inline-block" ref={popoverRef}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-mono font-semibold bg-slate-100 hover:bg-blue-50 text-slate-800 hover:text-blue-700 border border-slate-200 hover:border-blue-300 transition-colors cursor-pointer group"
        title="Click to view & print barcode"
      >
        <Barcode className="w-3.5 h-3.5 text-slate-500 group-hover:text-blue-600 shrink-0" />
        <span>{product.barcode || '—'}</span>
      </button>

      {/* Popover Card */}
      {isOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute z-40 left-0 top-full mt-1.5 w-64 bg-white dark:bg-[#121526] rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 p-3.5 space-y-2.5 animate-in fade-in zoom-in-95 duration-100"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Code 128 Barcode
            </span>
            <div className="flex items-center space-x-1">
              <button
                type="button"
                onClick={handleCopy}
                className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title="Copy Barcode Value"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
              {onPrint && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen(false);
                    onPrint(product);
                  }}
                  className="p-1 rounded-md text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors cursor-pointer"
                  title="Print Sticker Label"
                >
                  <Printer className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Barcode Render */}
          <div className="bg-white rounded-lg p-2 border border-slate-200 flex flex-col items-center justify-center">
            <BarcodeSvg
              value={barcodeValue}
              width={1.4}
              height={38}
              fontSize={11}
              margin={2}
            />
          </div>

          {/* Details */}
          <div className="text-[11px] space-y-0.5 text-slate-600 dark:text-slate-400">
            <div className="font-semibold text-slate-900 dark:text-white truncate">
              {product.name}
            </div>
            <div className="flex justify-between text-[10px]">
              <span>Code: <strong className="font-mono">{product.code || '—'}</strong></span>
              <span>UOM: <strong className="font-mono">{product.uom || 'KG'}</strong></span>
            </div>
          </div>

          {/* Quick Print Button */}
          {onPrint && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen(false);
                onPrint(product);
              }}
              className="w-full h-7 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950 dark:hover:bg-blue-900 dark:text-blue-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Sticker Label</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};

