import { useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Printer, ArrowLeft, Loader2, AlertCircle, RotateCcw, FileText } from 'lucide-react';
import { deliveryChallanApi } from '../services/api';
import { VelanLogo } from '../components/print/VelanLogo';

export function DeliveryChallanPrintView() {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const reworkId = searchParams.get('reworkId') || undefined;
  const viewMode = searchParams.get('view') || undefined;

  const { data, isLoading, isError } = useQuery({
    queryKey: ['printable-dc', id, reworkId, viewMode],
    queryFn: () => deliveryChallanApi.getPrintable(id!, reworkId, viewMode),
    enabled: !!id,
  });

  // Remove browser print header/footer title (V-SMART) dynamically during print
  useEffect(() => {
    const originalTitle = document.title;
    const handleBeforePrint = () => {
      document.title = '';
    };
    const handleAfterPrint = () => {
      document.title = originalTitle;
    };

    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('afterprint', handleAfterPrint);

    return () => {
      window.removeEventListener('beforeprint', handleBeforePrint);
      window.removeEventListener('afterprint', handleAfterPrint);
      document.title = originalTitle;
    };
  }, []);

  const handlePrint = () => {
    const originalTitle = document.title;
    document.title = '';
    window.print();
    setTimeout(() => {
      document.title = originalTitle;
    }, 1000);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <Loader2 className="w-10 h-10 animate-spin mb-4 text-blue-600" />
        <p className="text-sm font-medium text-slate-500">Preparing Supplier DC document for print...</p>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-red-900 mb-2">Print Generation Failed</h3>
          <p className="text-sm text-red-700 mb-6">Could not load printable data for DC: {id}</p>
          <button 
            onClick={() => navigate(-1)}
            className="px-6 h-10 bg-white border border-red-200 text-red-700 text-sm font-medium rounded-lg hover:bg-red-50 shadow-xs transition-colors cursor-pointer"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const dc = (data as any) || {};
  const company = dc.company || {};
  const vendor = dc.vendor || {};
  const challan = dc.challan || {};
  const references = dc.references || {};
  
  const isSpl =
    dc.dcType === 'SPL_PROCESS' ||
    challan.type === 'SPL_PROCESS' ||
    dc.type === 'SPL_PROCESS' ||
    !!dc.poNumber ||
    !!challan.poNumber ||
    !!references.poNumber ||
    (dc.lineItems && dc.lineItems.some((it: any) => it.poNumber || (it.partNumber && it.partNumber.includes('PO')) || it.poPartLabel)) ||
    (dc.items && dc.items.some((it: any) => it.poNumber || (it.partNo && it.partNo.includes('PO')) || it.poPartLabel));

  // Flatten line items from groups or lineItems
  let displayItems: Array<{
    partNo: string;
    productName: string;
    description?: string;
    qty: number;
    uom: string;
  }> = [];

  if (isSpl) {
    const rawList = dc.items && dc.items.length > 0 ? dc.items : (dc.lineItems || []);
    displayItems = rawList.map((item: any) => {
      let partNo = item.partNo || item.poPartLabel || item.partNumber || item.productCode || '—';
      let particulars = item.particulars || item.poPartLabel || item.partName || item.productName || partNo;
      if (particulars === 'DEFECTIVE MATERIAL' && partNo !== '—') {
        particulars = partNo;
      }
      return {
        partNo,
        productName: particulars,
        description: item.description || '',
        qty: Number(item.quantity ?? item.quantityDispatched ?? 0),
        uom: item.unit || item.uom || 'NOS',
      };
    });
  } else if (dc.groups && dc.groups.length > 0) {
    dc.groups.forEach((g: any) => {
      (g.items || []).forEach((item: any) => {
        displayItems.push({
          partNo: item.partNumber || item.productCode || item.productName || '—',
          productName: item.partName || item.productName || item.productCode || '—',
          description: item.description || '',
          qty: Number(item.quantityDispatched ?? 0),
          uom: item.uom || (item.productName?.toUpperCase().includes('BAR') || item.productName?.toUpperCase().includes('ROD') ? 'MM' : 'NOS'),
        });
      });
    });
  } else if (dc.lineItems && dc.lineItems.length > 0) {
    dc.lineItems.forEach((item: any) => {
      displayItems.push({
        partNo: item.partNumber || item.productCode || item.productName || '—',
        productName: item.partName || item.productName || item.productCode || '—',
        description: item.description || '',
        qty: Number(item.quantityDispatched ?? item.quantity ?? 0),
        uom: item.uom || (item.productName?.toUpperCase().includes('BAR') || item.productName?.toUpperCase().includes('ROD') ? 'MM' : 'NOS'),
      });
    });
  } else if (dc.items && dc.items.length > 0) {
    dc.items.forEach((item: any) => {
      displayItems.push({
        partNo: item.partNumber || item.materialCode || item.productCode || item.productName || '—',
        productName: item.partName || item.productName || item.materialCode || '—',
        description: item.description || '',
        qty: Number(item.quantityDispatched ?? item.quantity ?? 0),
        uom: item.uom || (item.productName?.toUpperCase().includes('BAR') || item.productName?.toUpperCase().includes('ROD') ? 'MM' : 'NOS'),
      });
    });
  }

  // Format dispatch date as DD/MM/YYYY
  const rawDate = challan.dispatchDate || dc.issueDate || new Date().toISOString();
  const d = new Date(rawDate);
  const formattedDate = !isNaN(d.getTime()) 
    ? `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`
    : rawDate;

  const processName =
    challan.processName ||
    dc.processName ||
    references.processName ||
    dc.groups?.[0]?.processName ||
    dc.lineItems?.[0]?.processName ||
    dc.items?.[0]?.processName ||
    '';
  const dcNumber = challan.challanNumber || dc.dcNumber || 'SDC/2627/0001';
  const notes = challan.notes || dc.remarks || dc.notes || 'HT AND RETURN';

  // Format vendor address lines
  const formatVendorAddress = (rawAddress?: string) => {
    if (!rawAddress || !rawAddress.trim()) {
      return [];
    }
    const clean = rawAddress.trim();
    if (clean.toUpperCase() === 'N/A') {
      return [];
    }
    if (clean.includes('\n')) {
      return clean.split('\n').map(l => l.trim()).filter(Boolean);
    }
    if (clean.includes(',')) {
      return clean.split(',').map(l => l.trim()).filter(Boolean);
    }
    if (clean.includes('/')) {
      return clean.split('/').map(l => l.trim()).filter(Boolean);
    }
    return [clean];
  };

  const addressLines = formatVendorAddress(vendor.address || challan.vendorAddress || dc.vendorAddress);

  // Format vendor contact person and phone cleanly (never print hardcoded fallbacks)
  const contactParts: string[] = [];
  const contactPerson = (vendor.contactPerson || vendor.contact_person || challan.vendorContactPerson || '').trim();
  const phone = (vendor.phone || challan.vendorPhone || dc.vendorPhone || '').trim();

  if (contactPerson && contactPerson.toUpperCase() !== 'N/A') {
    contactParts.push(contactPerson);
  }
  if (phone && phone.toUpperCase() !== 'N/A') {
    contactParts.push(phone);
  }
  const vendorContactText = contactParts.join(' / ');

  // Chunk items into pages (10 items per page ensures clean A4 print with zero overlapping)
  const ITEMS_PER_PAGE = 10;
  const pages: (typeof displayItems)[] = [];
  if (displayItems.length === 0) {
    pages.push([]);
  } else {
    for (let i = 0; i < displayItems.length; i += ITEMS_PER_PAGE) {
      pages.push(displayItems.slice(i, i + ITEMS_PER_PAGE));
    }
  }
  const totalPages = pages.length;

  return (
    <div className="relative min-h-screen bg-slate-200/80 py-8 print:py-0 print:bg-white text-black font-sans flex flex-col items-center gap-8 print:gap-0 print:block print:min-h-0 print:h-auto print:overflow-visible">
      {/* Print Specific CSS to enforce full A4, 0 margin, and clean multi-page breaks */}
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
            overflow-x: visible !important;
            overflow-y: visible !important;
            display: block !important;
            position: static !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .dc-sheet-wrapper {
            width: 210mm !important;
            height: 296mm !important;
            min-height: 296mm !important;
            max-height: 296mm !important;
            padding: 10mm 12mm !important;
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
          .dc-sheet-wrapper:last-child {
            page-break-after: auto !important;
            break-after: auto !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>
      
      {/* Floating Action Bar - Hidden during physical print */}
      <div className="no-print fixed bottom-8 right-8 flex items-center gap-3 z-50">
        {dc.hasReworkItems && (
          <div className="flex items-center bg-white/95 backdrop-blur-xs border border-slate-300 rounded-xl p-1 shadow-lg text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                const next = new URLSearchParams(searchParams);
                next.delete('view');
                if (dc.reworkId) next.set('reworkId', dc.reworkId);
                setSearchParams(next);
              }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all cursor-pointer ${
                dc.isRework
                  ? 'bg-amber-100 text-amber-900 font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-700" />
              <span>Rework DC ({displayItems.length} {displayItems.length === 1 ? 'item' : 'items'})</span>
            </button>
            <button
              type="button"
              onClick={() => {
                const next = new URLSearchParams(searchParams);
                next.set('view', 'original');
                next.delete('reworkId');
                setSearchParams(next);
              }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all cursor-pointer ${
                !dc.isRework
                  ? 'bg-blue-100 text-blue-900 font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-blue-700" />
              <span>Original DC ({dc.originalItemsCount || 'All'} items)</span>
            </button>
          </div>
        )}

        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 px-5 h-11 bg-white border border-slate-300 text-slate-700 rounded-xl shadow-md hover:bg-slate-50 transition-colors font-medium text-sm cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 px-6 h-11 bg-blue-600 text-white rounded-xl shadow-md hover:bg-blue-700 transition-colors font-semibold text-sm cursor-pointer"
        >
          <Printer className="w-4 h-4" />
          Print DC
        </button>
      </div>

      {/* Render each page as a self-contained A4 sheet */}
      {pages.map((pageItems, pageIdx) => {
        const pageNumber = pageIdx + 1;
        const isLastPage = pageNumber === totalPages;

        return (
          <div
            key={pageIdx}
            className="dc-sheet-wrapper w-[210mm] h-[297mm] max-h-[297mm] mx-auto bg-white p-[10mm_12mm] shadow-2xl print:shadow-none box-border flex flex-col justify-between overflow-hidden"
          >
            {/* Main Document Outer Box */}
            <div className="border border-black flex-1 flex flex-col h-full overflow-hidden">
              
              {/* Header Row: Logo & Company Name */}
              <div className="flex border-b border-black">
                {/* Logo Cell */}
                <div className="w-32 p-2 border-r border-black flex items-center justify-center shrink-0">
                  <VelanLogo width={74} height={58} color="#475569" />
                </div>
                
                {/* Company Info */}
                <div className="flex-1 text-center py-2 px-4 flex flex-col justify-center">
                  <h1 className="text-sm font-black tracking-wide uppercase text-slate-900">
                    {company.name || 'VELAN METROLOGY INDIA PRIVATE LIMITED'}
                  </h1>
                  <p className="text-[11px] leading-tight text-slate-800 font-medium mt-1">
                    {company.address || 'NO 146/87 A&B, Jayaram Nagar Main Road ,\nVanagaram , Chennai - 600095'}
                  </p>
                  <p className="text-[11px] leading-tight text-slate-800 font-medium mt-1">
                    Phone: {company.phone || '9600703283'}
                  </p>
                  <p className="text-[11px] leading-tight text-slate-800 font-medium">
                    Email: {company.email || 'velanmetrology@gmail.com'}
                  </p>
                </div>
              </div>

              {/* Document Title Banner */}
              <div className="border-b border-black py-1 px-4 text-center bg-white flex justify-between items-center">
                <div className="w-24 text-left text-[10px] font-semibold text-slate-500">
                  {totalPages > 1 ? `Sheet ${pageNumber}/${totalPages}` : ''}
                </div>
                <h2 className="text-sm font-extrabold uppercase tracking-widest text-slate-900">
                  SUPPLIER DC {dc.isRework ? '(REWORK)' : ''} {totalPages > 1 ? `(Page ${pageNumber})` : ''}
                </h2>
                <div className="w-24 text-right text-[10px] font-bold text-slate-700">
                  {totalPages > 1 ? `Page ${pageNumber} of ${totalPages}` : ''}
                </div>
              </div>

              {/* Supplier Info & DC Meta Grid */}
              <div className="grid grid-cols-2 border-b border-black text-xs">
                {/* Left Box: Supplier Informations */}
                <div className="p-3 border-r border-black flex flex-col justify-between leading-snug">
                  <div>
                    <span className="font-bold underline uppercase block mb-1">Supplier Informations:</span>
                    <p className="font-extrabold text-slate-900 uppercase">
                      {vendor.name || challan.vendorName || dc.vendorName || ''}
                    </p>
                    {addressLines.length > 0 && (
                      <div className="text-slate-800 text-[11px] mt-0.5 uppercase space-y-0.5">
                        {addressLines.map((line, idx) => (
                          <div key={idx}>{line}</div>
                        ))}
                      </div>
                    )}
                  </div>
                  {vendorContactText ? (
                    <div className="mt-3 text-[11px] font-semibold text-slate-900">
                      Contact : {vendorContactText}
                    </div>
                  ) : (
                    <div className="mt-3 min-h-[16px]"></div>
                  )}
                </div>

                {/* Right Box: DC No & Dates */}
                <div className="flex flex-col justify-between">
                  <div className="p-2 border-b border-black flex flex-col gap-1 text-[11px]">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-700">Supplier DC No. :</span>
                      <span className="font-black text-slate-900 font-mono text-xs">{dcNumber}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-700">Date :</span>
                      <span className="font-bold text-slate-900">{formattedDate}</span>
                    </div>
                  </div>
                  
                  <div className="p-2 border-b border-black flex justify-between items-center text-[11px]">
                    <span className="text-slate-700">{isSpl ? 'PO No. :' : 'W. No. :'}</span>
                    <span className="font-medium text-slate-900">
                      {isSpl ? (dc.poNumber || challan.poNumber || references.poNumber || (dc.lineItems && dc.lineItems[0]?.poNumber) || '—') : '—'}
                    </span>
                  </div>
                  
                  <div className="p-2 text-center text-[11px] font-bold uppercase tracking-wider text-slate-800 bg-white flex-1 flex items-center justify-center">
                    {processName || (isSpl ? 'SPECIAL PROCESS' : (challan.type === 'GENERAL_INVENTORY_OUTWARD' || dc.type === 'GENERAL_INVENTORY_OUTWARD' ? 'STOCK CONVERSION' : '—'))}
                  </div>
                </div>
              </div>

              {/* Items Table: Expands to fill available page height, with NO horizontal lines between items */}
              <div className="flex-1 flex flex-col min-h-0" style={{ display: 'flex', flexDirection: 'column', flex: '1 1 0%' }}>
                <table className="w-full border-collapse table-fixed" style={{ height: '100%', width: '100%' }}>
                  <thead>
                    <tr className="border-b border-black bg-white text-[11px] font-bold text-slate-900" style={{ height: '28px' }}>
                      <th className="py-1 px-2 border-r border-black text-center" style={{ width: '42px' }}>Sl</th>
                      <th className="py-1 px-3 border-r border-black text-left" style={{ width: '190px' }}>Part No.</th>
                      <th className="py-1 px-3 border-r border-black text-left">Product/Particulars</th>
                      <th className="py-1 px-3 text-right" style={{ width: '100px' }}>Quantity</th>
                    </tr>
                  </thead>
                  <tbody style={{ height: 'calc(100% - 28px)' }}>
                    {pageItems.map((item, itemIdx) => {
                      const globalSl = pageIdx * ITEMS_PER_PAGE + itemIdx + 1;
                      return (
                        <tr key={itemIdx} className="text-[11px] align-top">
                          <td className="py-1 px-2 border-r border-black text-center font-semibold text-slate-800">
                            {globalSl}
                          </td>
                          <td className="py-1 px-3 border-r border-black font-bold text-slate-900 uppercase">
                            {item.partNo}
                          </td>
                          <td className="py-1 px-3 border-r border-black font-semibold text-slate-800">
                            <div className="uppercase">{item.productName}</div>
                            {item.description && (
                              <div className="text-[10px] text-slate-600 font-normal normal-case leading-tight mt-0.5 whitespace-pre-wrap">
                                {item.description}
                              </div>
                            )}
                          </td>
                          <td className="py-1 px-3 text-right font-bold text-slate-900 tabular-nums whitespace-nowrap">
                            {item.qty} {item.uom}
                          </td>
                        </tr>
                      );
                    })}

                    {/* Empty stretch row: Has vertical column borders continuing down all the way to Footer, but NO horizontal lines */}
                    <tr style={{ height: '100%' }}>
                      <td className="border-r border-black"></td>
                      <td className="border-r border-black"></td>
                      <td className="border-r border-black"></td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Footer Section */}
              {isLastPage ? (
                /* Final Page Official Footer */
                <div className="border-t border-black p-3 text-xs flex flex-col justify-between shrink-0" style={{ minHeight: '120px' }}>
                  {/* Remarks Line */}
                  <div className="mb-2">
                    <span className="font-bold">Remarks : </span>
                    <span className="font-semibold text-slate-900 uppercase">{notes}</span>
                  </div>

                  {/* Bottom Row: Company Tax Details & Authorized Signatory */}
                  <div className="flex justify-between items-end text-[11px] pt-1">
                    <div className="space-y-0.5">
                      <div>
                        <span className="text-slate-700">Company's State : </span>
                        <span className="font-bold text-slate-900">{company.stateCode || '33'} / {company.state || 'Tamil Nadu'}</span>
                      </div>
                      <div>
                        <span className="text-slate-700">Company's GSTIN : </span>
                        <span className="font-bold font-mono text-slate-900">{company.gstin || '33AAICV7596H1ZR'}</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="font-bold uppercase text-slate-900 mb-9">
                        For {company.name || 'VELAN METROLOGY INDIA PRIVATE LIMITED'}
                      </p>
                      <p className="font-medium text-slate-800 text-[10px]">
                        Authorised Signatory
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                /* Intermediate Continuation Footer */
                <div className="border-t border-black p-3 text-xs flex flex-col justify-between shrink-0" style={{ minHeight: '60px' }}>
                  {/* Remarks Line */}
                  <div className="mb-1">
                    <span className="font-bold">Remarks : </span>
                    <span className="font-semibold text-slate-900 uppercase">{notes}</span>
                  </div>

                  <div className="flex justify-between items-center text-[11px] pt-1 font-semibold text-slate-700">
                    <div>
                      <span>Company's GSTIN : </span>
                      <span className="font-mono font-bold text-slate-900">{company.gstin || '33AAICV7596H1ZR'}</span>
                    </div>
                    <div className="font-bold text-blue-700 uppercase tracking-wider text-xs">
                      [ Continued on Page {pageNumber + 1} ]
                    </div>
                    <div>
                      <span>Page {pageNumber} of {totalPages}</span>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>
        );
      })}

    </div>
  );
}
