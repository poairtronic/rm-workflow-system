import React, { useState, useEffect } from 'react';
import { ArrowLeft, X, AlertCircle, CheckCircle } from 'lucide-react';
import { workflowService } from '../../services/workflowService';
import { masterDataService } from '../../services/masterDataService';
import type { Bin } from '../../services/masterDataService';

interface VerifyReturnModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  returnId: string;
  returnNumber: string;
}

export function VerifyReturnModal({ isOpen, onClose, onSuccess, returnId, returnNumber }: VerifyReturnModalProps) {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [bins, setBins] = useState<Bin[]>([]);
  const [selectedBinId, setSelectedBinId] = useState('');
  const [remarks, setRemarks] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadBins();
    } else {
      setSelectedBinId('');
      setRemarks('');
      setError(null);
    }
  }, [isOpen]);

  const loadBins = async () => {
    setLoading(true);
    try {
      // Just loading first 100 active bins for selection
      const res = await masterDataService.getBins({ pageSize: 100, isActive: true });
      setBins(res.data || []);
    } catch (err: any) {
      console.error(err);
      setError('Failed to load bins for selection.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBinId) {
      setError('Please select a destination bin.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await workflowService.verifyReturn(returnId, selectedBinId, remarks);
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || err.message || 'Failed to verify return.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="max-w-4xl mx-auto w-full pb-12">
      {/* Top Navigation & Breadcrumb */}
      <div className="mb-6 flex items-center justify-between">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 bg-white px-3.5 py-2 rounded-lg border border-slate-200 shadow-sm transition-all hover:bg-slate-50"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Returns Queue</span>
        </button>

        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
          Stores Quality & Restock
        </span>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-8 py-5 bg-slate-50/50">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Verify Material Return</h2>
            <p className="text-sm text-slate-500 mt-1">Return Identifier: {returnNumber}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mx-8 mt-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="p-8">
          {loading ? (
             <div className="flex justify-center py-12">
               <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
             </div>
          ) : (
            <form id="verify-return-form" onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Destination Restock Bin *</label>
                <select
                  value={selectedBinId}
                  onChange={(e) => setSelectedBinId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 bg-white text-slate-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"
                  required
                >
                  <option value="">Select destination bin...</option>
                  {bins.map((bin) => (
                    <option key={bin.id} value={bin.id}>
                      {bin.code} - {bin.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 mt-1.5">Returned materials will be verified and credited into this bin balance.</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Verification Remarks & Inspection Notes</label>
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"
                  rows={3}
                  placeholder="E.g., Physical condition verified, weight matched manifest, restocked to shelf..."
                />
              </div>
            </form>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-8 py-5 bg-slate-50/50">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-5 py-2.5 text-sm font-medium text-slate-700 border border-slate-200 bg-white hover:bg-slate-50 transition-colors"
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            form="verify-return-form"
            type="submit"
            disabled={submitting || loading || !selectedBinId}
            className="rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white hover:bg-primary-hover shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
          >
            {submitting ? 'Verifying...' : (
              <>
                <CheckCircle className="w-4 h-4" />
                <span>Confirm Verify & Restock</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
