import { useEffect } from 'react';
import { Printer, X } from 'lucide-react';
import { VelanLogo } from '../print/VelanLogo';
import { Button } from '../ui/Button';
import type { ConsumableLineItemRecord } from '../../types/consumables.types';
import { consumablesApi } from '../../services/api';

export interface VelanPrPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  prNumber: string | number;
  date?: string | Date | null;
  paymentMode?: 'CASH' | 'CREDIT' | null;
  items: ConsumableLineItemRecord[];
  preparedBy?: string | null;
  verifiedBy?: string | null;
  approvedBy?: string | null;
  onPrintConfirmed?: () => void;
  itemIds?: string[];
}

function safeFormatDate(input?: string | Date | null): string {
  if (!input) {
    const now = new Date();
    return `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
  }

  if (typeof input === 'string') {
    const trimmed = input.trim();
    // If it's already in DD/MM/YYYY or DD-MM-YYYY format, use it directly
    if (/^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$/.test(trimmed)) {
      return trimmed;
    }
    // If it's an ISO date string or other valid parseable date
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
      const d = String(parsed.getDate()).padStart(2, '0');
      const m = String(parsed.getMonth() + 1).padStart(2, '0');
      const y = parsed.getFullYear();
      return `${d}/${m}/${y}`;
    }
    return trimmed;
  }

  if (input instanceof Date && !isNaN(input.getTime())) {
    const d = String(input.getDate()).padStart(2, '0');
    const m = String(input.getMonth() + 1).padStart(2, '0');
    const y = input.getFullYear();
    return `${d}/${m}/${y}`;
  }

  const now = new Date();
  return `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
}

export function VelanPrPrintModal({
  isOpen,
  onClose,
  prNumber,
  date = new Date(),
  paymentMode: _paymentMode = 'CASH',
  items = [],
  preparedBy,
  verifiedBy,
  approvedBy,
  onPrintConfirmed,
  itemIds,
}: VelanPrPrintModalProps) {
  // Prevent page scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const formattedDate = safeFormatDate(date);

  const handlePrint = () => {
    try {
      const originalTitle = document.title;
      document.title = `Velan-PR-${prNumber}`;
      window.print();
      setTimeout(async () => {
        document.title = originalTitle;
        // Archive PDF to Supabase after print
        try {
          const resolvedIds =
            itemIds && itemIds.length > 0
              ? itemIds
              : (items || []).map((i) => i.id).filter(Boolean) as string[];
          await consumablesApi.archivePrPdf({
            prNumber: String(prNumber),
            itemIds: resolvedIds,
          });
        } catch (archiveErr) {
          // Non-blocking — archive failure must not break the print flow
          console.warn('PR PDF archive failed (non-critical):', archiveErr);
        }
        if (onPrintConfirmed) {
          onPrintConfirmed();
        }
      }, 500);
    } catch (err: any) {
      console.error('Print trigger failed:', err);
    }
  };

  const safeItems = Array.isArray(items) ? items.filter(Boolean) : [];

  // Ensure at least 6 ruled rows for authentic physical requisition slip look
  const minimumRows = 6;
  const emptyRowsCount = Math.max(0, minimumRows - safeItems.length);

  // Total estimated requisition value (using purchaseQty if specified for stores buffer, otherwise requestedQty)
  const totalEstimatedAmount = safeItems.reduce((sum, item) => {
    const price = item.isNewVendor && item.newVendorPrice != null
      ? Number(item.newVendorPrice)
      : item.unitPrice != null
      ? Number(item.unitPrice)
      : 0;
    const qty = Number(item.purchaseQty ?? item.requestedQty ?? 0);
    return sum + (isNaN(price) ? 0 : price) * (qty > 0 ? qty : 1);
  }, 0);

  return (
    <div
      id="velan-pr-modal-container"
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 print:p-0 print:bg-white print:static print:overflow-visible"
    >
      {/* Print Specific CSS to enforce full A4 portrait, isolate requisition slip & hide web app chrome */}
      <style>{`
        @page {
          size: A4 portrait;
          margin: 6mm 8mm;
        }
        @media print {
          /* Hide background SPA application layout */
          body > * {
            visibility: hidden !important;
          }
          #velan-pr-modal-container,
          #velan-pr-modal-container * {
            visibility: visible !important;
          }
          #velan-pr-modal-container {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            min-height: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            z-index: 999999 !important;
          }
          #velan-pr-slip {
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 6mm 8mm !important;
            box-shadow: none !important;
            border: 1.5px solid #000000 !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          html, body {
            background: #ffffff !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print-hide {
            display: none !important;
          }
        }
      `}</style>

      {/* Top Floating Action Bar (Hidden during print) */}
      <div className="fixed top-4 right-4 z-50 flex items-center gap-2 print:hidden bg-slate-900/90 p-2 rounded-xl border border-slate-700 shadow-2xl print-hide">
        <Button
          variant="primary"
          size="sm"
          onClick={handlePrint}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold cursor-pointer"
        >
          <Printer className="w-4 h-4" />
          Print Requisition Slip
        </Button>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          aria-label="Close dialog"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Printable Sheet Container */}
      <div
        id="velan-pr-slip"
        className="w-full max-w-4xl bg-white text-black p-8 sm:p-10 shadow-2xl rounded-lg print:shadow-none print:rounded-none print:w-full print:max-w-none print:p-6 print:m-0 border border-slate-300 print:border-black font-sans"
        style={{ minHeight: '260mm' }}
      >
        {/* ========================================================= */}
        {/* HEADER BLOCK (Physical Velan Metrology Requisition Pad)   */}
        {/* ========================================================= */}
        <div className="border border-black p-3 mb-4">
          <div className="flex items-center justify-between">
            {/* Left: Logo */}
            <div className="w-24 flex items-center justify-start">
              <VelanLogo width={68} height={52} color="#1E3A8A" />
            </div>

            {/* Center: Title Hierarchy matching Physical Pad */}
            <div className="text-center flex-1 px-2">
              <h1 className="text-2xl font-black tracking-wider text-black uppercase font-serif">
                VELAN METROLOGY
              </h1>
              <h2 className="text-base font-bold text-black mt-0.5">
                Purchase Requisition
              </h2>
              <p className="text-sm font-semibold text-black mt-0.5">
                Cash / Credit
              </p>
            </div>

            {/* Right: Date & PR Number */}
            <div className="w-36 text-right flex flex-col justify-center text-xs space-y-1 font-sans">
              <div className="flex items-center justify-end gap-1.5">
                <span className="font-semibold text-black">Date :</span>
                <span className="font-mono font-bold text-black">
                  {formattedDate}
                </span>
              </div>
              <div className="flex items-center justify-end gap-1.5">
                <span className="font-semibold text-black">PR. No. :</span>
                <span className="font-mono font-bold text-lg text-black">
                  {prNumber}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* LINE ITEMS TABLE                                          */}
        {/* ========================================================= */}
        <div className="border border-black mb-6">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 border-b-2 border-black font-bold uppercase tracking-wider text-[11px]">
                <th className="py-2.5 px-2 border-r border-black w-10 text-center">S.No.</th>
                <th className="py-2.5 px-3 border-r border-black w-60">Description of Goods / Item</th>
                <th className="py-2.5 px-2 border-r border-black w-24 text-right">Req. Stock</th>
                <th className="py-2.5 px-3 border-r border-black">Supplier / Vendor Details</th>
                <th className="py-2.5 px-2 border-r border-black w-24 text-right">Approx Price</th>
                <th className="py-2.5 px-3 border-r border-black w-36">End User (Bay / Machine)</th>
                <th className="py-2.5 px-2 w-28">Requested By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black font-medium">
              {safeItems.map((item, index) => {
                const isNewVendor = item.isNewVendor;
                const hasVendor = item.vendorName || item.newVendorName;

                return (
                  <tr key={item.id || index} className="align-top">
                    {/* S.No */}
                    <td className="py-2 px-2 border-r border-black text-center font-mono font-bold">
                      {index + 1}
                    </td>

                    {/* Description */}
                    <td className="py-2 px-3 border-r border-black">
                      <span className="font-bold text-black block leading-snug">
                        {item.description}
                      </span>
                      {item.productCode && (
                        <span className="text-[10px] text-slate-600 font-mono block">
                          Code: {item.productCode}
                        </span>
                      )}
                      {item.isNewProduct && (
                        <span className="text-[10px] font-bold text-slate-800 uppercase italic">
                          (New Product Addition)
                        </span>
                      )}
                    </td>

                    {/* Qty & UOM (Required Stock / Store Indent) */}
                    <td className="py-2 px-2 border-r border-black text-right font-mono font-bold">
                      {(() => {
                        const indentQty = Number(item.purchaseQty ?? item.requestedQty ?? 0);
                        const prodReqQty = Number(item.requestedQty || 0);
                        const hasSafetyIncrease = item.purchaseQty != null && Number(item.purchaseQty) !== prodReqQty;

                        if (indentQty > 0) {
                          return (
                            <div>
                              <span>{indentQty}</span> <span className="text-[10px] text-slate-700">{item.uom || 'NOS'}</span>
                              {hasSafetyIncrease && (
                                <span className="text-[10px] text-slate-500 font-sans block font-normal leading-tight">
                                  (Prod Req: {prodReqQty} {item.uom || 'NOS'})
                                </span>
                              )}
                            </div>
                          );
                        }
                        return <span className="text-[10px] italic text-slate-500">Inquiry (0)</span>;
                      })()}
                    </td>

                    {/* Supplier / Vendor Details */}
                    <td className="py-2 px-3 border-r border-black text-[11px]">
                      {isNewVendor ? (
                        <div className="space-y-0.5 text-[10px] leading-tight">
                          <span className="font-bold text-black block">
                            (a) Name: {item.newVendorName || '—'}
                          </span>
                          {item.newVendorAddress && (
                            <span className="text-slate-700 block">
                              (b) Addr: {item.newVendorAddress}
                            </span>
                          )}
                          {item.newVendorMobile && (
                            <span className="text-slate-700 block font-mono">
                              (c) Mob: {item.newVendorMobile}
                            </span>
                          )}
                        </div>
                      ) : hasVendor ? (
                        <span className="font-bold text-black block">
                          {item.vendorName}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">Open Market / Stores Choice</span>
                      )}
                    </td>

                    {/* Approx Price */}
                    <td className="py-2 px-2 border-r border-black text-right font-mono font-bold">
                      {isNewVendor && item.newVendorPrice ? (
                        `₹${Number(item.newVendorPrice).toFixed(2)}`
                      ) : item.unitPrice ? (
                        `₹${Number(item.unitPrice).toFixed(2)}`
                      ) : (
                        '—'
                      )}
                    </td>

                    {/* End User */}
                    <td className="py-2 px-3 border-r border-black text-[11px]">
                      {item.endUserInVelan || 'General Plant Use'}
                    </td>

                    {/* Requested By */}
                    <td className="py-2 px-2 text-[11px]">
                      {item.requestedBy || 'Production'}
                    </td>
                  </tr>
                );
              })}

              {/* Blank Filler Rows for Physical Pad Layout */}
              {Array.from({ length: emptyRowsCount }).map((_, fIdx) => (
                <tr key={`filler-${fIdx}`} className="h-8 border-t border-slate-200">
                  <td className="border-r border-black text-center text-slate-300 font-mono text-[10px]">
                    {safeItems.length + fIdx + 1}
                  </td>
                  <td className="border-r border-black" />
                  <td className="border-r border-black" />
                  <td className="border-r border-black" />
                  <td className="border-r border-black" />
                  <td className="border-r border-black" />
                  <td />
                </tr>
              ))}
            </tbody>
            {totalEstimatedAmount > 0 && (
              <tfoot>
                <tr className="border-t-2 border-black bg-slate-100 font-bold">
                  <td colSpan={4} className="py-2 px-3 border-r border-black text-right uppercase tracking-wider text-[11px]">
                    Total Approx / Quoted Requisition Value:
                  </td>
                  <td className="py-2 px-2 border-r border-black text-right font-mono font-black text-xs text-black">
                    ₹{totalEstimatedAmount.toFixed(2)}
                  </td>
                  <td colSpan={2} className="py-2 px-3 text-[10px] text-slate-600 italic">
                    Excl. GST & Delivery Charges
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* ========================================================= */}
        {/* SIGNATURE & APPROVAL BLOCK                                */}
        {/* ========================================================= */}
        <div className="border-2 border-black p-4 mt-8 bg-slate-50/50">
          <div className="grid grid-cols-3 gap-6 text-center">
            {/* Prepared By */}
            <div className="border-r border-black pr-4">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 block mb-8">
                Prepared By
              </span>
              <div className="border-t border-black pt-1">
                <span className="font-bold text-xs block text-black">
                  {preparedBy || items[0]?.requestedBy || 'Production User'}
                </span>
                <span className="text-[10px] text-slate-500 uppercase tracking-wider block">
                  Requester / Store Keeper
                </span>
              </div>
            </div>

            {/* Verified By */}
            <div className="border-r border-black pr-4">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 block mb-8">
                Verified By
              </span>
              <div className="border-t border-black pt-1">
                <span className="font-bold text-xs block text-black">
                  {verifiedBy || 'Stores In-Charge'}
                </span>
                <span className="text-[10px] text-slate-500 uppercase tracking-wider block">
                  Stores Verification & Stock Check
                </span>
              </div>
            </div>

            {/* Approved By */}
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 block mb-8">
                Approved By
              </span>
              <div className="border-t border-black pt-1">
                <span className="font-bold text-xs block text-black">
                  {approvedBy || 'Plant / Purchase Manager'}
                </span>
                <span className="text-[10px] text-slate-500 uppercase tracking-wider block">
                  Commercial & Budget Authority
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Note */}
        <div className="mt-4 pt-2 border-t border-slate-300 flex items-center justify-between text-[10px] text-slate-500 font-mono">
          <span>VELAN METROLOGY • FORM REF: VM-PR-REV-04</span>
          <span>Printed on: {safeFormatDate(new Date())}</span>
          <span>Single-Copy Shop Floor Authorized Voucher</span>
        </div>
      </div>
    </div>
  );
}

export default VelanPrPrintModal;
