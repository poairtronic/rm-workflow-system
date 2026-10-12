import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Printer, ArrowLeft, Loader2, AlertCircle } from 'lucide-react';
import { deliveryChallanApi } from '../services/api';
import { VelanLogo } from '../components/print/VelanLogo';

export function DeliveryChallanPrintView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['printable-dc', id],
    queryFn: () => deliveryChallanApi.getPrintable(id!),
    enabled: !!id,
  });

  // Remove browser print header/footer title (RMRIT) dynamically during print
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
  
  // Flatten line items from groups or lineItems
  let displayItems: Array<{
    partNo: string;
    productName: string;
    description?: string;
    qty: number;
    uom: string;
  }> = [];

  if (dc.groups && dc.groups.length > 0) {
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

  const processName = references.process?.processName || dc.processName || '';
  const dcNumber = challan.challanNumber || dc.dcNumber || 'SDC/2627/0001';
  const notes = challan.notes || dc.notes || 'HT AND RETURN';

  // Format vendor address lines
  const formatVendorAddress = (address?: string) => {
    if (!address) {
      return ['H-06,', 'INDUSTRIAL ESTATE', 'AMBATTUR', 'CHENNAI'];
    }
    if (address.includes('\n')) {
      return address.split('\n').map(l => l.trim()).filter(Boolean);
    }
    if (address.includes(',')) {
      return address.split(',').map(l => l.trim()).filter(Boolean);
    }
    if (address.includes('/')) {
      return address.split('/').map(l => l.trim()).filter(Boolean);
    }
    return [address];
  };

  const addressLines = formatVendorAddress(vendor.address);

  return (
    <div className="relative min-h-screen bg-slate-200/80 py-8 print:py-0 print:bg-white text-black font-sans flex justify-center items-start">
      {/* Print Specific CSS to enforce full A4, 0 margin (removes headers & footers like date/watermark/localhost) */}
      <style>{`
        @page {
          size: A4 portrait;
          margin: 0mm;
        }
        @media print {
          html, body {
            width: 210mm !important;
            height: 297mm !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: hidden !important;
            background: #ffffff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .dc-sheet-wrapper {
            width: 210mm !important;
            height: 297mm !important;
            max-height: 297mm !important;
            padding: 10mm 12mm !important;
            margin: 0 !important;
            box-shadow: none !important;
            border: none !important;
            box-sizing: border-box !important;
            overflow: hidden !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            page-break-after: avoid !important;
            break-after: avoid !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>
      
      {/* Floating Action Bar - Hidden during physical print */}
      <div className="no-print fixed bottom-8 right-8 flex items-center gap-3 z-50">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 px-5 h-11 bg-white border border-slate-300 text-slate-700 rounded-lg shadow-md hover:bg-slate-50 transition-colors font-medium text-sm cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 px-6 h-11 bg-blue-600 text-white rounded-lg shadow-md hover:bg-blue-700 transition-colors font-semibold text-sm cursor-pointer"
        >
          <Printer className="w-4 h-4" />
          Print DC
        </button>
      </div>

      {/* A4 Sheet Container: Exact 210mm x 297mm dimensions, locked to full page with 10mm/12mm padding */}
      <div className="dc-sheet-wrapper w-[210mm] h-[297mm] max-h-[297mm] mx-auto bg-white p-[10mm_12mm] shadow-2xl print:shadow-none box-border flex flex-col justify-between overflow-hidden">
        
        {/* Main Document Outer Box: spans full available height */}
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
          <div className="border-b border-black py-1 text-center bg-white">
            <h2 className="text-sm font-extrabold uppercase tracking-widest text-slate-900">
              SUPPLIER DC
            </h2>
          </div>

          {/* Supplier Info & DC Meta Grid */}
          <div className="grid grid-cols-2 border-b border-black text-xs">
            {/* Left Box: Supplier Informations */}
            <div className="p-3 border-r border-black flex flex-col justify-between leading-snug">
              <div>
                <span className="font-bold underline uppercase block mb-1">Supplier Informations:</span>
                <p className="font-extrabold text-slate-900 uppercase">{vendor.name || 'FLAMETECH (MADRAS) PVT.LTD'}</p>
                <div className="text-slate-800 text-[11px] mt-0.5 uppercase space-y-0.5">
                  {addressLines.map((line, idx) => (
                    <div key={idx}>{line}</div>
                  ))}
                </div>
              </div>
              <div className="mt-3 text-[11px] font-semibold text-slate-900">
                Contact : {vendor.contactPerson ? `${vendor.contactPerson} ` : ''}{vendor.phone ? `/ ${vendor.phone}` : 'FLAMETECH / 9840092294'}
              </div>
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
                <span className="text-slate-700">W. No. :</span>
                <span className="font-medium text-slate-900">—</span>
              </div>
              
              <div className="p-2 text-center text-[11px] font-bold uppercase tracking-wider text-slate-800 bg-white flex-1 flex items-center justify-center">
                {processName || (challan.type === 'GENERAL_INVENTORY_OUTWARD' || dc.type === 'GENERAL_INVENTORY_OUTWARD' ? 'STOCK CONVERSION' : 'PROCESS TYPE')}
              </div>
            </div>
          </div>

          {/* Items Table: Expands to fill full page height, with NO horizontal lines between items */}
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
                {displayItems.map((item, idx) => (
                  <tr key={idx} className="text-[11px] align-top">
                    <td className="py-1 px-2 border-r border-black text-center font-semibold text-slate-800">
                      {idx + 1}
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
                ))}

                {/* Empty stretch row: Has vertical column borders continuing down all the way to Remarks, but NO horizontal line */}
                <tr style={{ height: '100%' }}>
                  <td className="border-r border-black"></td>
                  <td className="border-r border-black"></td>
                  <td className="border-r border-black"></td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Footer Remarks & Signatures: Fixed height at bottom of full page */}
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

        </div>
      </div>

    </div>
  );
}
