import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Printer, ArrowLeft, Loader2, AlertCircle } from 'lucide-react';
import { deliveryChallanApi } from '../services/api';
import { ChallanPrintHeader } from '../components/print/ChallanPrintHeader';
import { PrintablePayloadGrid } from '../components/print/PrintablePayloadGrid';
import { PrintableFooter } from '../components/print/PrintableFooter';
import type { DeliveryChallanDto } from '../types/delivery-challan.dto';

export function DeliveryChallanPrintView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['printable-dc', id],
    queryFn: () => deliveryChallanApi.getPrintable(id!),
    enabled: !!id,
  });

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <Loader2 className="w-10 h-10 animate-spin mb-4 text-primary" />
        <p className="text-sm font-medium text-slate-500">Preparing document for print...</p>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="bg-red-50 border border-red-200 rounded-xl p-12 text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-red-900 mb-2">Print Generation Failed</h3>
          <p className="text-red-700 mb-6">Could not load printable data for DC: {id}</p>
          <button 
            onClick={() => navigate(-1)}
            className="px-6 h-10 bg-white border border-red-200 text-red-700 text-sm font-medium rounded-lg hover:bg-red-50 shadow-sm transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const printableData = data as any;

  return (
    <div className="relative min-h-screen bg-white text-black p-8 max-w-[210mm] mx-auto print:p-0 print:max-w-none">
      
      {/* Floating Actions - Hidden on Print */}
      <div className="fixed bottom-8 right-8 flex gap-4 print:hidden z-50">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 px-4 h-12 bg-white border border-slate-200 text-slate-700 rounded-full shadow-lg hover:bg-slate-50 transition-colors font-semibold"
        >
          <ArrowLeft className="w-5 h-5" />
          Back
        </button>
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 px-6 h-12 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-colors font-bold"
        >
          <Printer className="w-5 h-5" />
          Print DC
        </button>
      </div>

      <div className="print:p-6">
        <ChallanPrintHeader 
          dcNumber={printableData.challan?.challanNumber || printableData.dcNumber}
          issueDate={printableData.challan?.dispatchDate || printableData.issueDate || new Date().toISOString()}
          vendorName={printableData.vendor?.name || printableData.vendorName || 'N/A'}
          destinationAddress={printableData.vendor?.address || printableData.destinationEntity || 'Vendor Address Details'}
          dcType={printableData.challan?.type || printableData.type}
        />

        <PrintablePayloadGrid 
          items={printableData.lineItems || printableData.items || []} 
          groups={printableData.groups}
          pos={printableData.references?.pos || []} 
        />

        <PrintableFooter />
      </div>
      
    </div>
  );
}
