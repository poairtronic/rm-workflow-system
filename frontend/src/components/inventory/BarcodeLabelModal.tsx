import React, { useState } from 'react';
import {
  Printer,
  X,
  Settings2,
  Copy,
  Tag,
  Eye,
  Check,
  Building,
} from 'lucide-react';
import { Button } from '../ui';
import { BarcodeSvg } from '../common/BarcodeSvg';
import type { Product } from '../../services/masterDataService';
import JsBarcode from 'jsbarcode';
import { toast } from 'react-hot-toast';

export type LabelFormat = '50x25' | '75x50' | 'A4_SHEET';

interface BarcodeLabelModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  productStorageMap?: Map<string, { binLabels: string[] }>;
}

export const BarcodeLabelModal: React.FC<BarcodeLabelModalProps> = ({
  isOpen,
  onClose,
  products,
  productStorageMap,
}) => {
  const [format, setFormat] = useState<LabelFormat>('50x25');
  const [copies, setCopies] = useState<number>(1);
  const [companyName, setCompanyName] = useState<string>('AIRTRONIC');
  const [showCode, setShowCode] = useState<boolean>(true);
  const [showName, setShowName] = useState<boolean>(true);
  const [showUomMsl, setShowUomMsl] = useState<boolean>(true);
  const [showLocation, setShowLocation] = useState<boolean>(true);
  const [selectedProductIndex, setSelectedProductIndex] = useState<number>(0);
  const [isPrinting, setIsPrinting] = useState<boolean>(false);

  const activeProduct = products[selectedProductIndex] || products[0];

  if (!isOpen || products.length === 0) return null;

  const totalLabels = products.length * Math.max(1, copies);

  // Helper to format bin labels cleanly on small labels
  const getCleanBinTag = (prodId: string): string => {
    const storage = productStorageMap?.get(prodId);
    const labels = storage?.binLabels;
    if (!labels || labels.length === 0) return '';
    if (labels.length === 1) return labels[0];
    return `${labels[0]} (+${labels.length - 1})`;
  };

  // Helper to generate SVG string for a barcode
  const generateBarcodeSvgString = (
    barcodeValue: string,
    widthScale: number,
    barHeight: number,
    fontSize: number = 10,
  ): string => {
    try {
      const svgNode = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      JsBarcode(svgNode, barcodeValue, {
        format: 'CODE128',
        width: widthScale,
        height: barHeight,
        displayValue: true,
        fontSize: fontSize,
        margin: 1,
        font: 'monospace',
        textMargin: 1,
        background: 'transparent',
        lineColor: '#000000',
      });
      return svgNode.outerHTML;
    } catch (e) {
      console.error('Error generating barcode SVG string:', e);
      return `<div style="font-family:monospace;font-size:10px;font-weight:bold;">${barcodeValue}</div>`;
    }
  };

  const handlePrint = () => {
    try {
      setIsPrinting(true);

      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.top = '0';
      iframe.style.left = '0';
      iframe.style.width = '100vw';
      iframe.style.height = '100vh';
      iframe.style.border = 'none';
      iframe.style.opacity = '0';
      iframe.style.pointerEvents = 'none';
      iframe.style.zIndex = '-9999';
      document.body.appendChild(iframe);

      const doc = iframe.contentWindow?.document;
      if (!doc) {
        throw new Error('Failed to create printing frame.');
      }

      // Generate HTML items
      let labelsHtml = '';

      const scale = format === '50x25' ? 1.15 : format === '75x50' ? 1.6 : 1.3;
      const height = format === '50x25' ? 22 : format === '75x50' ? 42 : 26;
      const barcodeFontSize = format === '50x25' ? 9 : format === '75x50' ? 11 : 9.5;

      if (format === 'A4_SHEET') {
        labelsHtml += '<div class="sheet-grid">';
        for (const prod of products) {
          const barcode = prod.barcode || `PRD-${prod.code || 'ITEM'}`;
          const svgMarkup = generateBarcodeSvgString(barcode, scale, height, barcodeFontSize);
          const binText = getCleanBinTag(prod.id);
          const codeText = prod.code || prod.barcode || '';

          for (let i = 0; i < copies; i++) {
            labelsHtml += `
              <div class="sheet-label">
                <div class="label-header">
                  <span class="comp-title">${companyName}</span>
                  ${showLocation && binText ? `<span class="bin-tag">${binText}</span>` : ''}
                </div>
                ${showName ? `<div class="prod-name" title="${prod.name}">${prod.name}</div>` : ''}
                <div class="barcode-wrapper">${svgMarkup}</div>
                <div class="label-footer">
                  ${showCode && codeText ? `<span class="prod-code">${codeText}</span>` : ''}
                  ${showUomMsl ? `<span class="prod-uom">UOM: ${prod.uom || 'NOS'}${prod.minimumInventory ? ` | MSL: ${prod.minimumInventory} ${prod.uom || 'NOS'}` : ''}</span>` : ''}
                </div>
              </div>
            `;
          }
        }
        labelsHtml += '</div>';
      } else {
        // Continuous thermal stickers (50x25 or 75x50)
        for (const prod of products) {
          const barcode = prod.barcode || `PRD-${prod.code || 'ITEM'}`;
          const svgMarkup = generateBarcodeSvgString(barcode, scale, height, barcodeFontSize);
          const binText = getCleanBinTag(prod.id);
          const codeText = prod.code || prod.barcode || '';

          for (let i = 0; i < copies; i++) {
            labelsHtml += `
              <div class="label-item">
                <div class="label-header">
                  <span class="comp-title">${companyName}</span>
                  ${showLocation && binText ? `<span class="bin-tag">${binText}</span>` : ''}
                </div>
                ${showName ? `<div class="prod-name" title="${prod.name}">${prod.name}</div>` : ''}
                <div class="barcode-wrapper">${svgMarkup}</div>
                <div class="label-footer">
                  ${showCode && codeText ? `<span class="prod-code">${codeText}</span>` : ''}
                  ${showUomMsl ? `<span class="prod-uom">UOM: ${prod.uom || 'NOS'}${prod.minimumInventory ? ` | MSL: ${prod.minimumInventory} ${prod.uom || 'NOS'}` : ''}</span>` : ''}
                </div>
              </div>
            `;
          }
        }
      }

      const styles = `
        @charset "utf-8";
        @page {
          ${
            format === '50x25'
              ? 'size: 50mm 25mm; margin: 0mm !important;'
              : format === '75x50'
              ? 'size: 75mm 50mm; margin: 0mm !important;'
              : 'size: A4 portrait; margin: 8mm !important;'
          }
        }
        * {
          box-sizing: border-box;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        html, body {
          margin: 0 !important;
          padding: 0 !important;
          background: #ffffff;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
          color: #000000;
        }
        @media print {
          body {
            margin: 0 !important;
            padding: 0 !important;
          }
        }
        ${
          format === 'A4_SHEET'
            ? `
          .sheet-grid {
            display: grid;
            grid-template-columns: repeat(3, 63.3mm);
            grid-auto-rows: 34mm;
            gap: 1.5mm;
            width: 100%;
          }
          .sheet-label {
            width: 63.3mm;
            height: 34mm;
            border: 0.5px dashed #bbb;
            padding: 1.5mm 2.5mm;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            align-items: center;
            overflow: hidden;
            box-sizing: border-box;
            page-break-inside: avoid;
          }
        `
            : `
          .label-item {
            width: ${format === '50x25' ? '50mm' : '75mm'};
            height: ${format === '50x25' ? '25mm' : '50mm'};
            max-width: ${format === '50x25' ? '50mm' : '75mm'};
            max-height: ${format === '50x25' ? '25mm' : '50mm'};
            padding: ${format === '50x25' ? '1mm 1.5mm' : '2.5mm 3.5mm'};
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            align-items: center;
            overflow: hidden;
            box-sizing: border-box;
            page-break-after: always;
            break-after: page;
          }
        `
        }
        .label-header {
          width: 100%;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: ${format === '75x50' ? '10px' : '7.5px'};
          font-weight: 800;
          letter-spacing: 0.5px;
          border-bottom: 0.5px solid #000;
          padding-bottom: 1px;
          gap: 4px;
          flex-shrink: 0;
          line-height: 1.1;
        }
        .comp-title {
          font-weight: 900;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          flex-shrink: 1;
        }
        .bin-tag {
          font-size: ${format === '75x50' ? '9px' : '7px'};
          font-family: monospace;
          background: #f1f5f9;
          padding: 0.5px 3px;
          border-radius: 2px;
          border: 0.5px solid #94a3b8;
          max-width: 52%;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          flex-shrink: 0;
        }
        .prod-name {
          width: 100%;
          font-size: ${format === '75x50' ? '10.5px' : '7.5px'};
          font-weight: 700;
          text-align: center;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          line-height: 1.1;
          margin: 1px 0;
          flex-shrink: 0;
        }
        .barcode-wrapper {
          width: 100%;
          display: flex;
          justify-content: center;
          align-items: center;
          flex: 1;
          min-height: 0;
          overflow: hidden;
          margin: 0;
          padding: 0;
        }
        .barcode-wrapper svg {
          max-width: 100%;
          max-height: 100%;
          height: auto;
          display: block;
        }
        .label-footer {
          width: 100%;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: ${format === '75x50' ? '9.5px' : '6.5px'};
          border-top: 0.5px solid #000;
          padding-top: 1px;
          line-height: 1;
          flex-shrink: 0;
          gap: 4px;
        }
        .prod-code {
          font-family: monospace;
          font-weight: 800;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .prod-uom {
          font-weight: 600;
          white-space: nowrap;
          flex-shrink: 0;
        }
      `;

      doc.open();
      doc.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title></title>
            <style>${styles}</style>
          </head>
          <body>
            ${labelsHtml}
          </body>
        </html>
      `);
      doc.close();

      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => {
          document.body.removeChild(iframe);
          setIsPrinting(false);
        }, 1500);
      }, 500);
    } catch (err: any) {
      console.error('Printing error:', err);
      toast.error(err.message || 'Failed to initialize printer');
      setIsPrinting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="relative w-full max-w-4xl bg-white dark:bg-[#121526] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-6 py-4.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-[#0c0e1a]">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Print Product Barcode Labels</span>
                <span className="text-xs px-2 py-0.5 rounded-full font-mono bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                  {products.length} {products.length === 1 ? 'Product' : 'Products'}
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Code 128 vector label generation for thermal barcode printers & A4 sheets
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Left Column: Configuration Controls (5 cols) */}
          <div className="md:col-span-5 space-y-5">
            {/* Format Selection */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2 block flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5" />
                <span>Label Paper & Size</span>
              </label>
              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  onClick={() => setFormat('50x25')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                    format === '50x25'
                      ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/30 text-blue-950 dark:text-blue-200 shadow-xs'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div>
                    <div className="text-xs font-bold flex items-center gap-1.5">
                      <span>50mm × 25mm (Standard Thermal)</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-normal">Roll Printer</span>
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      Zebra, TSC, TVS thermal label roll printers (2" × 1")
                    </div>
                  </div>
                  {format === '50x25' && <Check className="w-4 h-4 text-blue-600" />}
                </button>

                <button
                  type="button"
                  onClick={() => setFormat('75x50')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                    format === '75x50'
                      ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/30 text-blue-950 dark:text-blue-200 shadow-xs'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div>
                    <div className="text-xs font-bold flex items-center gap-1.5">
                      <span>75mm × 50mm (Large Pallet/Box)</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-normal">Roll Printer</span>
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      High-visibility thermal sticker for RM racks & crates (3" × 2")
                    </div>
                  </div>
                  {format === '75x50' && <Check className="w-4 h-4 text-blue-600" />}
                </button>

                <button
                  type="button"
                  onClick={() => setFormat('A4_SHEET')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                    format === 'A4_SHEET'
                      ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/30 text-blue-950 dark:text-blue-200 shadow-xs'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div>
                    <div className="text-xs font-bold flex items-center gap-1.5">
                      <span>A4 Adhesive Sheet (24-up Grid)</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300 font-normal">Office Laser</span>
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      Recommended for Canon MF440, HP LaserJet, standard office printers
                    </div>
                  </div>
                  {format === 'A4_SHEET' && <Check className="w-4 h-4 text-blue-600" />}
                </button>
              </div>
            </div>

            {/* Print Quantity & Header */}
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 block">
                  Copies per Item
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={copies}
                    onChange={(e) => setCopies(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0e111f] text-sm text-slate-900 dark:text-white"
                  />
                  <Copy className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-3 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 block">
                  Header Label
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value.toUpperCase())}
                    placeholder="AIRTRONIC"
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0e111f] text-sm text-slate-900 dark:text-white uppercase font-mono"
                  />
                  <Building className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-3 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Custom Content Options */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block flex items-center gap-1.5">
                <Settings2 className="w-3.5 h-3.5" />
                <span>Information to Include</span>
              </label>

              <label className="flex items-center space-x-2.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showName}
                  onChange={(e) => setShowName(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                />
                <span>Include Product Name</span>
              </label>

              <label className="flex items-center space-x-2.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showCode}
                  onChange={(e) => setShowCode(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                />
                <span>Include Product Code</span>
              </label>

              <label className="flex items-center space-x-2.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showUomMsl}
                  onChange={(e) => setShowUomMsl(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                />
                <span>Include UOM & Minimum Stock Level (MSL)</span>
              </label>

              <label className="flex items-center space-x-2.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showLocation}
                  onChange={(e) => setShowLocation(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                />
                <span>Include Warehouse Storage Bin Tag</span>
              </label>
            </div>

            {/* Batch Item Selector (if multiple products selected) */}
            {products.length > 1 && (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 block">
                  Preview Item ({selectedProductIndex + 1} of {products.length})
                </label>
                <select
                  value={selectedProductIndex}
                  onChange={(e) => setSelectedProductIndex(parseInt(e.target.value) || 0)}
                  className="w-full h-8 px-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0e111f] text-xs text-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  {products.map((p, idx) => (
                    <option key={p.id} value={idx}>
                      {p.code ? `[${p.code}] ` : ''}{p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Right Column: Live Millimeter Preview (7 cols) */}
          <div className="md:col-span-7 flex flex-col items-center justify-center bg-slate-100/70 dark:bg-[#0c0e1a] rounded-xl p-6 border border-dashed border-slate-300 dark:border-slate-800 min-h-[360px]">
            <div className="text-center mb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 inline-flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5" />
                <span>Simulated Print Output ({format === '50x25' ? '50mm × 25mm' : format === '75x50' ? '75mm × 50mm' : 'A4 Grid'})</span>
              </span>
            </div>

            {/* The Scaled Label Box */}
            <div
              className={`bg-white text-black rounded-sm shadow-md border border-slate-300 p-2.5 flex flex-col justify-between items-center transition-all ${
                format === '50x25'
                  ? 'w-[280px] h-[140px]'
                  : format === '75x50'
                  ? 'w-[360px] h-[240px]'
                  : 'w-[300px] h-[160px]'
              }`}
            >
              {/* Header */}
              <div className="w-full flex justify-between items-center border-b border-black pb-0.5 gap-2">
                <span className="text-[10px] font-black tracking-wider truncate">{companyName || 'AIRTRONIC'}</span>
                {showLocation && getCleanBinTag(activeProduct.id) && (
                  <span className="text-[9px] font-mono font-bold bg-slate-100 px-1 py-0.2 rounded border border-slate-400 max-w-[50%] truncate">
                    {getCleanBinTag(activeProduct.id)}
                  </span>
                )}
              </div>

              {/* Name */}
              {showName && (
                <div
                  className="w-full text-center font-bold text-slate-900 truncate my-0.5"
                  style={{ fontSize: format === '75x50' ? '12px' : '9.5px' }}
                >
                  {activeProduct.name}
                </div>
              )}

              {/* Barcode Vector Graphic */}
              <div className="w-full flex justify-center items-center my-auto overflow-hidden">
                <BarcodeSvg
                  value={activeProduct.barcode || `PRD-${activeProduct.code || '000001'}`}
                  width={format === '75x50' ? 1.6 : 1.15}
                  height={format === '75x50' ? 44 : 26}
                  fontSize={format === '75x50' ? 11 : 9}
                  margin={1}
                />
              </div>

              {/* Footer */}
              <div className="w-full flex justify-between items-center border-t border-black pt-0.5 text-[8.5px] gap-2">
                {showCode && (
                  <span className="font-mono font-bold truncate">
                    {activeProduct.code || activeProduct.barcode || ''}
                  </span>
                )}
                {showUomMsl && (
                  <span className="text-[8px] font-semibold shrink-0">
                    UOM: {activeProduct.uom || 'NOS'}
                    {activeProduct.minimumInventory ? ` | MSL: ${activeProduct.minimumInventory} ${activeProduct.uom || 'NOS'}` : ''}
                  </span>
                )}
              </div>
            </div>

            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-4 text-center max-w-sm">
              Standard Code 128 (Subset B/C) vector bars with human-readable text and quiet zones. Ready for thermal print heads and handheld scanners.
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0c0e1a] flex items-center justify-between">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Total stickers to print:{' '}
            <strong className="text-slate-900 dark:text-white font-mono">{totalLabels}</strong>
          </div>

          <div className="flex items-center space-x-3">
            <Button variant="secondary" onClick={onClose} disabled={isPrinting}>
              Cancel
            </Button>
            <Button onClick={handlePrint} disabled={isPrinting}>
              <Printer className="w-4 h-4 mr-1.5" />
              {isPrinting ? 'Preparing Print...' : `Print ${totalLabels} Label${totalLabels > 1 ? 's' : ''}`}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

