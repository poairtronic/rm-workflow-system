import { useEffect } from 'react';
import { Printer, X } from 'lucide-react';
import { VelanLogo } from '../print/VelanLogo';
import { Button } from '../ui/Button';
import type { ConsumableLineItemRecord } from '../../types/consumables.types';
import { consumablesApi } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { AmrithaSignature } from './AmrithaSignature';

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
    if (/^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$/.test(trimmed)) {
      return trimmed;
    }
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
  const { currentUser } = useAuth();
  const effectiveVerifiedBy = verifiedBy || currentUser?.name || 'Stores In-Charge';

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
  const formattedPrintDate = safeFormatDate(new Date());

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

  // Total estimated requisition value
  const totalEstimatedAmount = safeItems.reduce((sum, item) => {
    const price = item.isNewVendor && item.newVendorPrice != null
      ? Number(item.newVendorPrice)
      : item.unitPrice != null
      ? Number(item.unitPrice)
      : 0;
    const qty = Number(item.purchaseQty ?? item.requestedQty ?? 0);
    return sum + (isNaN(price) ? 0 : price) * (qty > 0 ? qty : 1);
  }, 0);

  // 8 items per page: mathematically guaranteed to fit within 296mm A4 height without overflowing
  const ITEMS_PER_PAGE = 8;
  const pages: ConsumableLineItemRecord[][] = [];
  if (safeItems.length === 0) {
    pages.push([]);
  } else {
    for (let i = 0; i < safeItems.length; i += ITEMS_PER_PAGE) {
      pages.push(safeItems.slice(i, i + ITEMS_PER_PAGE));
    }
  }
  const totalPages = pages.length;

  return (
    <div
      id="velan-pr-modal-container"
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-xs flex justify-center items-start p-2 sm:p-4 md:p-6 pt-16 sm:pt-20 pb-16 print:p-0 print:pt-0 print:pb-0 print:bg-white print:static print:overflow-visible print:block"
    >
      {/* Print Specific CSS: Full A4 portrait (210mm x 297mm), zero margin, pixel-perfect sheet isolation */}
      <style>{`
        @page {
          size: A4 portrait;
          margin: 0mm;
        }
        @media print {
          *, *:before, *:after {
            box-sizing: border-box !important;
          }
          html, body {
            width: 210mm !important;
            height: auto !important;
            min-height: auto !important;
            max-height: none !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
            overflow-x: visible !important;
            overflow-y: visible !important;
            background: #ffffff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          #root {
            height: auto !important;
            min-height: auto !important;
            max-height: none !important;
            overflow: visible !important;
            display: block !important;
            position: static !important;
            margin: 0 !important;
            padding: 0 !important;
          }
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
            top: 0 !important;
            left: 0 !important;
            width: 210mm !important;
            margin: 0 auto !important;
            padding: 0 !important;
            background: #ffffff !important;
            display: block !important;
            overflow: visible !important;
            height: auto !important;
            min-height: 0 !important;
          }
          .velan-pr-sheet {
            width: 210mm !important;
            height: 296mm !important;
            min-height: 296mm !important;
            max-height: 296mm !important;
            padding: 8mm 10mm !important;
            margin: 0 auto !important;
            box-shadow: none !important;
            border: none !important;
            box-sizing: border-box !important;
            overflow: hidden !important;
            page-break-before: auto !important;
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
          }
          .velan-pr-sheet:last-child {
            page-break-after: auto !important;
            break-after: auto !important;
          }
          .print-hide {
            display: none !important;
          }
        }
      `}</style>

      {/* Top Floating Action Bar (Hidden during physical print) */}
      <div className="fixed top-4 right-4 z-50 flex items-center gap-2 print:hidden bg-slate-900/90 p-2 rounded-xl border border-slate-700 shadow-2xl print-hide">
        {totalPages > 1 && (
          <span className="text-xs font-semibold text-slate-300 px-2.5 py-1 bg-slate-800 rounded-md border border-slate-700">
            {totalPages} Sheets ({safeItems.length} Items)
          </span>
        )}
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

      {/* Sheets Container */}
      <div className="w-full max-w-[210mm] flex flex-col items-center gap-6 print:gap-0 print:block">
        {pages.map((pageItems, pageIdx) => {
          const pageNumber = pageIdx + 1;
          const isLastPage = pageNumber === totalPages;

          return (
            <div
              key={`pr-sheet-${pageIdx}`}
              id={pageIdx === 0 ? 'velan-pr-slip' : undefined}
              className="velan-pr-sheet w-full max-w-[210mm] bg-white text-black p-5 sm:p-6 shadow-2xl rounded-lg print:shadow-none print:rounded-none print:w-[210mm] print:max-w-[210mm] print:p-0 print:m-0 border border-slate-300 print:border-none font-sans flex flex-col justify-between box-border"
              style={{ minHeight: '290mm' }}
            >
              {/* Outer Framing Border matching official Velan Physical Requisition Pad */}
              <div className="border-[1.5px] border-black p-3.5 sm:p-4 flex-1 flex flex-col justify-between h-full box-border">
                <div>
                  {/* ========================================================= */}
                  {/* HEADER BLOCK (Physical Velan Metrology Requisition Pad)   */}
                  {/* ========================================================= */}
                  <div className="border border-black p-2.5 mb-3">
                    <div className="flex items-center justify-between">
                      {/* Left: Logo */}
                      <div className="w-20 flex items-center justify-start">
                        <VelanLogo width={60} height={46} color="#1E3A8A" />
                      </div>

                      {/* Center: Title Hierarchy */}
                      <div className="text-center flex-1 px-2">
                        <h1 className="text-xl sm:text-2xl font-black tracking-wider text-black uppercase font-serif">
                          VELAN METROLOGY
                        </h1>
                        <h2 className="text-sm sm:text-base font-bold text-black mt-0.5">
                          Purchase Requisition
                        </h2>
                        <p className="text-xs font-semibold text-black mt-0.5">
                          Cash / Credit
                        </p>
                      </div>

                      {/* Right: Date, PR Number & Sheet Number */}
                      <div className="w-36 text-right flex flex-col justify-center text-xs space-y-0.5 font-sans">
                        <div className="flex items-center justify-end gap-1.5">
                          <span className="font-semibold text-black">Date :</span>
                          <span className="font-mono font-bold text-black">
                            {formattedDate}
                          </span>
                        </div>
                        <div className="flex items-center justify-end gap-1.5">
                          <span className="font-semibold text-black">PR. No. :</span>
                          <span className="font-mono font-bold text-base text-black">
                            {prNumber}
                          </span>
                        </div>
                        {totalPages > 1 && (
                          <div className="flex items-center justify-end gap-1.5 text-[11px] font-bold text-slate-800">
                            <span>Sheet {pageNumber} of {totalPages}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* ========================================================= */}
                  {/* LINE ITEMS TABLE (table-fixed 100% width, no cut-off)     */}
                  {/* ========================================================= */}
                  <div className="border border-black mb-3 overflow-hidden">
                    <table className="w-full text-left border-collapse text-xs table-fixed" style={{ width: '100%', minHeight: '180px' }}>
                      <thead>
                        <tr className="bg-slate-100 border-b-2 border-black font-bold uppercase tracking-wider text-[11px]">
                          <th className="py-2 px-1 border-r border-black text-center" style={{ width: '5%' }}>
                            S.No.
                          </th>
                          <th className="py-2 px-2.5 border-r border-black" style={{ width: '28%' }}>
                            Description of Goods / Item
                          </th>
                          <th className="py-2 px-2 border-r border-black text-right" style={{ width: '9%' }}>
                            Req. Stock
                          </th>
                          <th className="py-2 px-2.5 border-r border-black" style={{ width: '20%' }}>
                            Supplier / Vendor Details
                          </th>
                          <th className="py-2 px-2 border-r border-black text-right" style={{ width: '10%' }}>
                            Approx Price
                          </th>
                          <th className="py-2 px-2 border-r border-black" style={{ width: '14%' }}>
                            End User
                          </th>
                          <th className="py-2 px-2 text-left" style={{ width: '14%' }}>
                            Requested By
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-black font-medium">
                        {pageItems.map((item, itemIdx) => {
                          const sNo = pageIdx * ITEMS_PER_PAGE + itemIdx + 1;
                          const isNewVendor = item.isNewVendor;
                          const hasVendor = item.vendorName || item.newVendorName;

                          return (
                            <tr key={item.id || sNo} className="align-top text-[11px]">
                              {/* S.No */}
                              <td className="py-2 px-1 border-r border-black text-center font-mono font-bold" style={{ width: '5%' }}>
                                {sNo}
                              </td>

                              {/* Description */}
                              <td className="py-2 px-2.5 border-r border-black break-words" style={{ width: '28%' }}>
                                <span className="font-bold text-black block leading-snug">
                                  {item.description}
                                  {(item.attachmentCount ?? 0) > 0 && (
                                    <svg
                                      xmlns="http://www.w3.org/2000/svg"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="2.2"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      width="11"
                                      height="11"
                                      className="inline-block ml-1 align-baseline text-black"
                                      aria-hidden="true"
                                    >
                                      <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                                    </svg>
                                  )}
                                </span>
                                {item.productCode && (
                                  <span className="text-[10px] text-slate-600 font-mono block leading-tight">
                                    Code: {item.productCode}
                                  </span>
                                )}
                                {item.isNewProduct && (
                                  <span className="text-[10px] font-bold text-slate-800 uppercase italic block leading-tight">
                                    (New Product Addition)
                                  </span>
                                )}
                              </td>

                              {/* Qty & UOM */}
                              <td className="py-2 px-2 border-r border-black text-right font-mono font-bold whitespace-nowrap tabular-nums" style={{ width: '9%' }}>
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
                                            (Prod: {prodReqQty})
                                          </span>
                                        )}
                                      </div>
                                    );
                                  }
                                  return <span className="text-[10px] italic text-slate-500">Inquiry (0)</span>;
                                })()}
                              </td>

                              {/* Supplier / Vendor Details */}
                              <td className="py-2 px-2.5 border-r border-black text-[10.5px] break-words" style={{ width: '20%' }}>
                                {isNewVendor ? (
                                  <div className="space-y-0.5 leading-tight">
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
                                  <span className="font-bold text-black block leading-snug">
                                    {item.vendorName}
                                  </span>
                                ) : (
                                  <span className="text-slate-400 italic">Open Market / Stores Choice</span>
                                )}
                              </td>

                              {/* Approx Price */}
                              <td className="py-2 px-2 border-r border-black text-right font-mono font-bold whitespace-nowrap tabular-nums" style={{ width: '10%' }}>
                                {isNewVendor && item.newVendorPrice ? (
                                  `₹${Number(item.newVendorPrice).toFixed(2)}`
                                ) : item.unitPrice ? (
                                  `₹${Number(item.unitPrice).toFixed(2)}`
                                ) : (
                                  '—'
                                )}
                              </td>

                              {/* End User */}
                              <td className="py-2 px-2 border-r border-black text-[10.5px] uppercase font-semibold break-normal" style={{ width: '14%' }}>
                                {item.endUserInVelan || 'General Plant Use'}
                              </td>

                              {/* Requested By */}
                              <td className="py-2 px-2 text-[10.5px] uppercase font-semibold break-normal" style={{ width: '14%' }}>
                                {item.requestedBy || 'Production'}
                              </td>
                            </tr>
                          );
                        })}

                        {/* Empty stretch row: Has vertical column borders continuing down all the way, but NO horizontal lines or fake row numbers */}
                        <tr style={{ height: 'auto' }}>
                          <td className="border-r border-black" style={{ width: '5%' }} />
                          <td className="border-r border-black" style={{ width: '28%' }} />
                          <td className="border-r border-black" style={{ width: '9%' }} />
                          <td className="border-r border-black" style={{ width: '20%' }} />
                          <td className="border-r border-black" style={{ width: '10%' }} />
                          <td className="border-r border-black" style={{ width: '14%' }} />
                          <td style={{ width: '14%' }} />
                        </tr>
                      </tbody>

                      {/* Total Row on Last Page */}
                      {isLastPage && totalEstimatedAmount > 0 && (
                        <tfoot>
                          <tr className="border-t-2 border-black bg-slate-100 font-bold">
                            <td colSpan={4} className="py-1.5 px-3 border-r border-black text-right uppercase tracking-wider text-[11px]">
                              Total Approx / Quoted Requisition Value:
                            </td>
                            <td className="py-1.5 px-2 border-r border-black text-right font-mono font-black text-xs text-black whitespace-nowrap">
                              ₹{totalEstimatedAmount.toFixed(2)}
                            </td>
                            <td colSpan={2} className="py-1.5 px-3 text-[10px] text-slate-600 italic">
                              Excl. GST & Delivery Charges
                            </td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>

                  {/* Continuation Note on non-last page */}
                  {!isLastPage && (
                    <div className="py-1.5 px-3 border border-black bg-slate-50 text-center font-bold text-xs text-slate-800 tracking-wider">
                      [ Continued on Sheet {pageNumber + 1} of {totalPages} ]
                    </div>
                  )}
                </div>

                <div>
                  {/* ========================================================= */}
                  {/* SIGNATURE & APPROVAL BLOCK (on Last Page)                 */}
                  {/* ========================================================= */}
                  {isLastPage ? (
                    <div className="border-2 border-black p-3 sm:p-4 mb-2 bg-slate-50/50">
                      <div className="grid grid-cols-3 gap-6 text-center">
                        {/* Prepared By */}
                        <div className="border-r border-black pr-4 flex flex-col justify-between">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 block mb-1">
                            Prepared By
                          </span>
                          <div className="h-14 sm:h-16 flex items-center justify-center my-0.5">
                            {/* Manual signature / sign placeholder */}
                          </div>
                          <div className="border-t border-black pt-1">
                            <span className="font-bold text-xs block text-black uppercase">
                              {preparedBy || items[0]?.requestedBy || 'Production User'}
                            </span>
                            <span className="text-[10px] text-slate-500 uppercase tracking-wider block">
                              Requester / Store Keeper
                            </span>
                          </div>
                        </div>

                        {/* Verified By */}
                        <div className="border-r border-black pr-4 flex flex-col justify-between">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 block mb-1">
                            Verified By
                          </span>
                          <div className="h-14 sm:h-16 flex items-center justify-center my-0.5">
                            {/* Verification stamp / sign placeholder */}
                          </div>
                          <div className="border-t border-black pt-1">
                            <span className="font-bold text-xs block text-black uppercase">
                              {effectiveVerifiedBy}
                            </span>
                            <span className="text-[10px] text-slate-500 uppercase tracking-wider block">
                              Stores In-Charge • Stores Verification & Stock Check
                            </span>
                          </div>
                        </div>

                        {/* Approved By */}
                        <div className="flex flex-col justify-between">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 block mb-1">
                            Approved By
                          </span>
                          <div className="h-14 sm:h-16 flex items-center justify-center my-0.5">
                            <AmrithaSignature className="h-12 sm:h-14 w-auto max-w-full object-contain mx-auto" />
                          </div>
                          <div className="border-t border-black pt-1">
                            <span className="font-bold text-xs block text-black uppercase">
                              {approvedBy || 'AMRITHA'}
                            </span>
                            <span className="text-[10px] text-slate-600 uppercase font-semibold tracking-wider block">
                              Plant / Purchase Manager
                            </span>
                            <span className="text-[9px] text-slate-500 uppercase tracking-wider block">
                              Commercial & Budget Authority
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 py-1.5 border-t border-black mb-1">
                      <span>Sheet {pageNumber} of {totalPages}</span>
                      <span className="italic">Signatures & Total Authorization on Sheet {totalPages}</span>
                    </div>
                  )}

                  {/* Footer Note */}
                  <div className="pt-1.5 border-t border-slate-300 flex items-center justify-between text-[10px] text-slate-500 font-mono">
                    <span>VELAN METROLOGY • FORM REF: VM-PR-REV-04</span>
                    <span>{totalPages > 1 ? `Sheet ${pageNumber} of ${totalPages} • ` : ''}Printed on: {formattedPrintDate}</span>
                    <span>Single-Copy Shop Floor Authorized Voucher</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default VelanPrPrintModal;
