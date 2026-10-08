import React, { useState, useEffect } from 'react';
import { X, AlertCircle, CheckCircle } from 'lucide-react';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overflow-x-hidden bg-slate-900/50 p-4">
      <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Verify Return</h2>
            <p className="text-sm text-slate-500 mt-1">Return: {returnNumber}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 p-4 bg-red-50 text-red-700 rounded-lg flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="p-6">
          {loading ? (
             <div className="flex justify-center py-6">
               <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
             </div>
          ) : (
            <form id="verify-return-form" onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Destination Bin *</label>
                <select
                  value={selectedBinId}
                  onChange={(e) => setSelectedBinId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  required
                >
                  <option value="">Select a bin...</option>
                  {bins.map((bin) => (
                    <option key={bin.id} value={bin.id}>
                      {bin.code} - {bin.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 mt-1">Returned materials will be stocked into this bin.</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Verification Remarks (Optional)</label>
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  rows={3}
                  placeholder="E.g., Verified quantities, visually inspected..."
                />
              </div>
            </form>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4 bg-slate-50 rounded-b-2xl">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            form="verify-return-form"
            type="submit"
            disabled={submitting || loading || !selectedBinId}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {submitting ? 'Verifying...' : (
              <>
                <CheckCircle className="w-4 h-4" />
                <span>Confirm Verify</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
