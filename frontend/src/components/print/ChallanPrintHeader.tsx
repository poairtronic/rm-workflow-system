import { Box } from 'lucide-react';

interface ChallanPrintHeaderProps {
  dcNumber: string;
  issueDate: string;
  vendorName: string;
  destinationAddress: string;
  dcType: string;
}

export function ChallanPrintHeader({ dcNumber, issueDate, vendorName, destinationAddress, dcType }: ChallanPrintHeaderProps) {
  return (
    <div className="border-b border-black pb-4 mb-4">
      {/* Top Meta Header */}
      <div className="flex justify-between items-start mb-6">
        {/* Left Column: Company */}
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 bg-black flex items-center justify-center text-white font-bold text-xl print:border print:border-black">
            <Box className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-black uppercase tracking-tight">RMRIT Manufacturing Ltd.</h1>
            <p className="text-xs text-black">123 Industrial Estate, Phase II</p>
            <p className="text-xs text-black">Bangalore, Karnataka - 560100, India</p>
          </div>
        </div>

        {/* Right Column: Doc Meta */}
        <div className="text-right">
          <h2 className="text-lg font-bold text-black uppercase">{dcType === 'TYPE_1' ? 'Delivery Challan (Returnable)' : 'Delivery Challan (Non-Returnable)'}</h2>
          <p className="text-sm font-semibold text-black mt-1 tabular-nums">No: {dcNumber}</p>
          <p className="text-xs text-black mt-0.5 tabular-nums">Date: {new Date(issueDate).toLocaleDateString()}</p>
          <p className="text-xs text-black mt-1">GSTIN: 29AAAAA0000A1Z5</p>
        </div>
      </div>

      {/* Destination Block */}
      <div className="border border-black p-3 rounded-none">
        <h3 className="text-[10px] font-bold text-black uppercase border-b border-black pb-1 mb-2">Billed To / Dispatched To</h3>
        <p className="text-sm font-bold text-black uppercase">{vendorName || 'N/A'}</p>
        <p className="text-xs text-black whitespace-pre-line mt-1">{destinationAddress || 'Address not provided'}</p>
      </div>
    </div>
  );
}
