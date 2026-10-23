import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { useMutation } from '@tanstack/react-query';
import { Modal, ModalFooter } from '../ui/Modal';
import { Button } from '../ui/Button';
import { api } from '../../services/api';
import type { ReworkScItem } from '../../services/workflowService';

export interface ReworkSubmitModalProps {
  isOpen: boolean;
  onClose: () => void;
  sc: ReworkScItem | null;
  type: 'REWORK' | 'REJECTION';
  onSuccess: (reportNumber: string) => void;
}

export function ReworkSubmitModal({
  isOpen,
  onClose,
  sc,
  type,
  onSuccess,
}: ReworkSubmitModalProps) {
  // Form State
  const [errorType, setErrorType] = useState('');
  const [stageOfFailure, setStageOfFailure] = useState('');
  const [defectDescription, setDefectDescription] = useState('');
  const [responsibleParty, setResponsibleParty] = useState('');
  const [reworkDescription, setReworkDescription] = useState('');
  const [rejectionDescription, setRejectionDescription] = useState('');
  const [costEstimation, setCostEstimation] = useState<number | ''>('');
  const [lossEstimation, setLossEstimation] = useState<number | ''>('');
  const [alternativeNotes, setAlternativeNotes] = useState('');

  const resetForm = () => {
    setErrorType('');
    setStageOfFailure('');
    setDefectDescription('');
    setResponsibleParty('');
    setReworkDescription('');
    setRejectionDescription('');
    setCostEstimation('');
    setLossEstimation('');
    setAlternativeNotes('');
  };

  useEffect(() => {
    if (!isOpen) {
      resetForm();
    }
  }, [isOpen]);

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const mutation = useMutation({
    mutationFn: (data: any) => api.post('/api/rework/submit', data),
    onSuccess: (res: any) => {
      toast.success(`Report ${res.reportNumber} created in Quality Hub`);
      onSuccess(res.reportNumber);
      resetForm();
      onClose();
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to create report in Quality Hub');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sc) return;

    if (!stageOfFailure.trim() || !defectDescription.trim()) {
      toast.error('Stage of Failure and Defect Description are required');
      return;
    }

    const payload = {
      scId: sc.id,
      type,
      errorType: errorType.trim() || undefined,
      stageOfFailure: stageOfFailure.trim(),
      defectDescription: defectDescription.trim(),
      responsibleParty: responsibleParty.trim() || undefined,
      reworkDescription: type === 'REWORK' ? (reworkDescription.trim() || undefined) : undefined,
      rejectionDescription: type === 'REJECTION' ? (rejectionDescription.trim() || undefined) : undefined,
      costEstimation: costEstimation !== '' ? Number(costEstimation) : undefined,
      lossEstimation: lossEstimation !== '' ? Number(lossEstimation) : undefined,
      alternativeNotes: alternativeNotes.trim() || undefined,
    };

    mutation.mutate(payload);
  };

  if (!sc) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={type === 'REWORK' ? 'New Rework Report' : 'New Rejection Report'}
      footer={
        <ModalFooter className="p-0 border-0 shadow-none -mx-0 -mb-0 mt-0 bg-transparent dark:bg-transparent">
          <Button
            type="button"
            variant="secondary"
            onClick={handleClose}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant={type === 'REWORK' ? 'primary' : 'danger'}
            className={type === 'REWORK' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}
            onClick={handleSubmit}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? 'Submitting...' : 'Submit Report'}
          </Button>
        </ModalFooter>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* SECTION 1 — Pre-filled Info (Read-only cards) */}
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
            Section 1: Component Context
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-slate-50 dark:bg-[#161a2e] p-3.5 rounded-xl border border-slate-200 dark:border-[#1e233d]">
            <div>
              <span className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">SC Number</span>
              <span className="block text-xs font-bold text-slate-900 dark:text-white truncate">
                {sc.scNumber}
              </span>
            </div>
            <div>
              <span className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">PO Number</span>
              <span className="block text-xs font-mono font-semibold text-slate-900 dark:text-white truncate">
                {sc.poNumber || '—'}
              </span>
            </div>
            <div>
              <span className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">Component</span>
              <span className="block text-xs font-semibold text-slate-900 dark:text-white truncate" title={sc.productName}>
                {sc.productName}
              </span>
            </div>
            <div>
              <span className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">Quantity Affected</span>
              <span className="block text-xs font-bold text-slate-900 dark:text-white">
                {sc.targetQuantity}
              </span>
            </div>
          </div>
        </div>

        {/* SECTION 2 — Defect Details */}
        <div className="space-y-3.5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Section 2: Defect Details
          </h4>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
              Error Type <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              value={errorType}
              onChange={(e) => setErrorType(e.target.value)}
              placeholder="e.g., Dimensional Discrepancy, Surface Scratch"
              className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-[#1e233d] bg-white dark:bg-[#0d0f1b] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
              Stage of Failure <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={stageOfFailure}
              onChange={(e) => setStageOfFailure(e.target.value)}
              placeholder="e.g., CNC Machining, Final QC Inspection, Assembly"
              className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-[#1e233d] bg-white dark:bg-[#0d0f1b] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
              Defect Description <span className="text-rose-500">*</span>
            </label>
            <textarea
              required
              rows={3}
              value={defectDescription}
              onChange={(e) => setDefectDescription(e.target.value)}
              placeholder="Detailed description of the observed defect or rejection reason..."
              className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-[#1e233d] bg-white dark:bg-[#0d0f1b] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        {/* SECTION 3 — Inspection Details */}
        <div className="space-y-3.5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Section 3: Inspection Details
          </h4>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
              Responsible Party <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              value={responsibleParty}
              onChange={(e) => setResponsibleParty(e.target.value)}
              placeholder="e.g., In-House CNC Bay 2, Subcontractor ABC"
              className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-[#1e233d] bg-white dark:bg-[#0d0f1b] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {type === 'REWORK' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                Rework Description <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <textarea
                rows={2}
                value={reworkDescription}
                onChange={(e) => setReworkDescription(e.target.value)}
                placeholder="Recommended rework procedure or corrective action..."
                className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-[#1e233d] bg-white dark:bg-[#0d0f1b] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          )}

          {type === 'REJECTION' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                Rejection Description <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <textarea
                rows={2}
                value={rejectionDescription}
                onChange={(e) => setRejectionDescription(e.target.value)}
                placeholder="Disposal notes or non-conformance justification..."
                className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-[#1e233d] bg-white dark:bg-[#0d0f1b] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                Cost Estimation (₹) <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={costEstimation}
                onChange={(e) => setCostEstimation(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="0.00"
                className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-[#1e233d] bg-white dark:bg-[#0d0f1b] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                Loss Estimation (₹) <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={lossEstimation}
                onChange={(e) => setLossEstimation(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="0.00"
                className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-[#1e233d] bg-white dark:bg-[#0d0f1b] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
              Alternative Notes <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <textarea
              rows={2}
              value={alternativeNotes}
              onChange={(e) => setAlternativeNotes(e.target.value)}
              placeholder="Any additional remarks, engineering disposition, or notes..."
              className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-[#1e233d] bg-white dark:bg-[#0d0f1b] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>
      </form>
    </Modal>
  );
}

export default ReworkSubmitModal;
