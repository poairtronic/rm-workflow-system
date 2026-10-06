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

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={title}>
      <div className="space-y-4 pt-2">
        <div className="flex items-start">
          {isDanger && (
            <div className="flex-shrink-0 mr-3">
              <AlertTriangle className="h-6 w-6 text-red-600" aria-hidden="true" />
            </div>
          )}
          <div className="text-sm text-gray-600">{message}</div>
        </div>

        {requireReason && (
          <div className="mt-4">
            <label htmlFor="reason" className="block text-sm font-medium text-gray-700">
              {reasonLabel} <span className="text-red-500">*</span>
            </label>
            <div className="mt-1">
              <textarea
                id="reason"
                name="reason"
                rows={3}
                className="shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Please provide a reason..."
                required
              />
            </div>
          </div>
        )}

        <div className="mt-6 flex justify-end space-x-3">
          <button
            type="button"
            onClick={handleClose}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isLoading || (requireReason && !reason.trim())}
            className={cn(
              "inline-flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50",
              isDanger 
                ? "bg-red-600 hover:bg-red-700 focus:ring-red-500" 
                : "bg-primary hover:bg-primary-secondary focus:ring-primary"
            )}
          >
            {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {confirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
}
