import { UploadCloud, AlertCircle, FileText, Anchor } from 'lucide-react';

export interface TechnicalFormData {
  heatNumber: string;
  mtcReference: string;
  grossWeight: string;
  kerfAllowance: string;
}

interface Props {
  formData: TechnicalFormData;
  onChange: (data: TechnicalFormData) => void;
  availableBalance?: number;
}

export function TechnicalParameterForm({ formData, onChange, availableBalance = 330.0 }: Props) {
  const { heatNumber, mtcReference, grossWeight, kerfAllowance } = formData;

  const handleChange = (field: keyof TechnicalFormData, value: string) => {
    onChange({ ...formData, [field]: value });
  };

  const grossVal = parseFloat(grossWeight) || 0;
  const kerfVal = parseFloat(kerfAllowance) || 0;
  const netWeight = grossVal - kerfVal;
  
  const isOverBalance = grossVal > availableBalance;

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 mb-6">
      <div className="flex items-center gap-2 mb-6 border-b border-slate-100 pb-4">
        <FileText className="w-5 h-5 text-slate-500" />
        <h2 className="text-[15px] font-semibold text-slate-900 mb-4 uppercase tracking-wide">MTC & Technical Parameters</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Section 1: MTC Documentation */}
        <div className="flex flex-col gap-4">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Metallurgical Test Certificate</h3>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Heat / Melt Number</label>
            <input
              type="text"
              placeholder="e.g. HT-99214"
              value={heatNumber}
              onChange={(e) => handleChange('heatNumber', e.target.value)}
              className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-shadow"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">MTC Reference</label>
            <input
              type="text"
              placeholder="e.g. MTC-2026-0881"
              value={mtcReference}
              onChange={(e) => handleChange('mtcReference', e.target.value)}
              className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-shadow"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">MTC Document Upload</label>
            <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-slate-200 border-dashed rounded-lg hover:bg-slate-50 transition-colors cursor-pointer group">
              <div className="space-y-1 text-center">
                <UploadCloud className="mx-auto h-8 w-8 text-slate-400 group-hover:text-primary transition-colors" />
                <div className="flex text-sm text-slate-600 justify-center">
                  <span className="relative rounded-md font-medium text-primary hover:text-blue-700 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-primary">
                    Upload a file
                  </span>
                  <p className="pl-1">or drag and drop</p>
                </div>
                <p className="text-xs text-slate-500">PDF, PNG up to 10MB</p>
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Technical Validation */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Technical Validation</h3>
            <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded tabular-nums">
              Available: {availableBalance.toFixed(1)} KG
            </span>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Gross Cut Weight (KG)</label>
            <input
              type="number"
              placeholder="0.00"
              value={grossWeight}
              onChange={(e) => handleChange('grossWeight', e.target.value)}
              className={`w-full h-10 px-3 bg-white border rounded-lg text-sm tabular-nums text-slate-900 placeholder:text-slate-400 focus:outline-none transition-shadow ${
                isOverBalance
                  ? 'border-red-600 focus:ring-1 focus:ring-red-600 focus:border-red-600 text-red-700'
                  : 'border-slate-200 focus:ring-1 focus:ring-primary focus:border-primary'
              }`}
            />
            {isOverBalance && (
              <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" /> Exceeds free balance of {availableBalance} KG
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Kerf Allowance (KG)</label>
            <input
              type="number"
              placeholder="0.00"
              value={kerfAllowance}
              onChange={(e) => handleChange('kerfAllowance', e.target.value)}
              className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-sm tabular-nums text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-shadow"
            />
          </div>

          <div className="mt-2 p-4 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Anchor className="w-4 h-4 text-slate-500" />
              <span className="text-sm font-semibold text-slate-700">Net Issued Weight</span>
            </div>
            <div className="text-xl font-bold text-primary tabular-nums">
              {netWeight > 0 ? netWeight.toFixed(2) : '0.00'} <span className="text-xs font-medium text-slate-500 ml-0.5">KG</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
