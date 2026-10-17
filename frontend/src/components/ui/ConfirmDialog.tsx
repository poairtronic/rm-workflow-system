import React, { useState } from 'react';
import { Modal } from './Modal';
import { Loader2, AlertTriangle } from 'lucide-react';
import { cn } from '../../utils/cn';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason?: string) => void | Promise<void>;
  title: string;
  message: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  isDanger?: boolean;
  requireReason?: boolean;
  reasonLabel?: string;
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isDanger = false,
  requireReason = false,
  reasonLabel = 'Reason for this action',
}: ConfirmDialogProps) {
  const [reason, setReason] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleConfirm = async () => {
    if (requireReason && !reason.trim()) return;
    setIsLoading(true);
    try {
      await onConfirm(reason);
      setReason(''); // Reset on success
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (isLoading) return;
    setReason('');
    onClose();
  };

  const footerActions = (
    <div className="flex flex-col-reverse sm:flex-row justify-end gap-2.5 sm:gap-3 w-full">
      <button
        type="button"
        onClick={handleClose}
        disabled={isLoading}
        className="w-full sm:w-auto min-h-[44px] sm:min-h-0 px-4 py-2.5 sm:py-2 text-base sm:text-sm font-medium text-gray-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-xl sm:rounded-md hover:bg-gray-50 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 cursor-pointer text-center"
      >
        {cancelText}
      </button>
      <button
        type="button"
        onClick={handleConfirm}
        disabled={isLoading || (requireReason && !reason.trim())}
        className={cn(
          "w-full sm:w-auto min-h-[44px] sm:min-h-0 inline-flex justify-center items-center px-4 py-2.5 sm:py-2 border border-transparent rounded-xl sm:rounded-md shadow-sm text-base sm:text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 cursor-pointer",
          isDanger 
            ? "bg-red-600 hover:bg-red-700 focus:ring-red-500" 
            : "bg-primary hover:bg-primary-secondary focus:ring-primary"
        )}
      >
        {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        {confirmText}
      </button>
    </div>
  );

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={title} footer={footerActions}>
      <div className="space-y-4 pt-1">
        <div className="flex items-start">
          {isDanger && (
            <div className="flex-shrink-0 mr-3">
              <AlertTriangle className="h-6 w-6 text-red-600" aria-hidden="true" />
            </div>
          )}
          <div className="text-sm text-gray-600 dark:text-slate-300">{message}</div>
        </div>

        {requireReason && (
          <div className="mt-4">
            <label htmlFor="reason" className="block text-sm font-medium text-gray-700 dark:text-slate-200">
              {reasonLabel} <span className="text-red-500">*</span>
            </label>
            <div className="mt-1">
              <textarea
                id="reason"
                name="reason"
                rows={3}
                className="shadow-sm focus:ring-primary focus:border-primary block w-full text-base sm:text-sm min-h-[44px] border-gray-300 dark:border-slate-700 dark:bg-slate-900 dark:text-white rounded-lg p-2.5"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Please provide a reason..."
                required
              />
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
