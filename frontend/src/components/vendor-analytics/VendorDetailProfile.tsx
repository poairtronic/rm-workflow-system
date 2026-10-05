import { Building2, Mail, Phone, Award, ArrowLeft } from 'lucide-react';
import type { VendorProfileDto } from '../../types/vendor-analytics.dto';
import { ActiveCustodyGrid } from './ActiveCustodyGrid';

interface VendorDetailProfileProps {
  profile: VendorProfileDto;
  onBack: () => void;
}

export function VendorDetailProfile({ profile, onBack }: VendorDetailProfileProps) {
  const isGoodScore = profile.historicalSlaScore >= 90;

  return (
    <div className="animate-in fade-in slide-in-from-right-4 duration-500">
      
      <button 
        onClick={onBack}
        className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-primary transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Global Dashboard
      </button>

      {/* Profile Banner */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden mb-6 flex items-center justify-between px-6 py-6">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center flex-shrink-0">
            <Building2 className="w-8 h-8 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">{profile.vendorName}</h2>
            <div className="flex items-center gap-4 mt-2 text-sm text-slate-600">
              <span className="flex items-center gap-1.5"><Mail className="w-4 h-4 text-slate-400" /> {profile.contactEmail}</span>
              <span className="flex items-center gap-1.5"><Phone className="w-4 h-4 text-slate-400" /> {profile.contactName}</span>
              <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-500 border border-slate-200">ID: {profile.vendorId}</span>
            </div>
          </div>
        </div>
        
        {/* Historical SLA Score */}
        <div className="flex flex-col items-end border-l border-slate-200 pl-8">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <Award className="w-4 h-4" /> 12-Month SLA Score
          </p>
          <p className={`text-4xl font-black tabular-nums tracking-tighter ${isGoodScore ? 'text-emerald-600' : 'text-amber-600'}`}>
            {profile.historicalSlaScore.toFixed(1)}<span className="text-xl">%</span>
          </p>
        </div>
      </div>

      <ActiveCustodyGrid items={profile.custodyItems} />

    </div>
  );
}
