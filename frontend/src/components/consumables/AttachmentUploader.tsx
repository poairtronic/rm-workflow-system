import React, { useRef, useState } from 'react';
import { Paperclip, X, Loader2, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import type { LocalLineAttachment } from '../../types/consumables.types';
import {
  compressConsumableAttachment,
  formatAttachmentSize,
} from '../../utils/consumableAttachmentCompression';

const MAX_ATTACHMENTS = 3;

interface AttachmentUploaderProps {
  attachments: LocalLineAttachment[];
  onChange: (next: LocalLineAttachment[]) => void;
  disabled?: boolean;
  onRetryUpload?: (localId: string) => void;
}

export const AttachmentUploader: React.FC<AttachmentUploaderProps> = ({
  attachments,
  onChange,
  disabled = false,
  onRetryUpload,
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [compressing, setCompressing] = useState(false);

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    const selectedFiles = Array.from(fileList);
    e.target.value = '';

    const remainingSlots = MAX_ATTACHMENTS - attachments.length;
    if (remainingSlots <= 0) {
      toast.error(`Maximum ${MAX_ATTACHMENTS} attachments allowed per line item.`);
      return;
    }

    const filesToProcess = selectedFiles.slice(0, remainingSlots);
    if (selectedFiles.length > remainingSlots) {
      toast.error(`Only ${remainingSlots} more attachment(s) can be added (max ${MAX_ATTACHMENTS}).`);
    }

    setCompressing(true);
    try {
      const nextList = [...attachments];

      for (const rawFile of filesToProcess) {
        const isDuplicate = nextList.some(
          (existing) =>
            existing.fileName === rawFile.name &&
            existing.originalSizeBytes === rawFile.size,
        );
        if (isDuplicate) {
          toast.error(`"${rawFile.name}" is already attached to this line item.`);
          continue;
        }

        try {
          const compressed = await compressConsumableAttachment(rawFile);
          // Also check duplicate against original file name + original size
          const dupAfter = nextList.some(
            (existing) =>
              existing.originalSizeBytes === compressed.originalSizeBytes &&
              (existing.fileName === compressed.fileName ||
                existing.fileName === rawFile.name),
          );
          if (dupAfter) {
            toast.error(`"${rawFile.name}" is already attached to this line item.`);
            continue;
          }

          nextList.push({
            localId: `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            file: compressed.file,
            fileName: compressed.fileName,
            mimeType: compressed.mimeType,
            originalSizeBytes: compressed.originalSizeBytes,
            storedSizeBytes: compressed.storedSizeBytes,
            uploadStatus: 'pending',
          });
        } catch (err: any) {
          toast.error(err?.message || `Failed to process "${rawFile.name}".`);
        }
      }

      onChange(nextList);
    } finally {
      setCompressing(false);
    }
  };

  const handleRemove = (localId: string) => {
    onChange(attachments.filter((a) => a.localId !== localId));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".jpg,.jpeg,.png,.webp,.heic,.pdf,image/jpeg,image/png,image/webp,image/heic,application/pdf"
          onChange={handleFilesSelected}
          className="hidden"
          disabled={disabled || compressing || attachments.length >= MAX_ATTACHMENTS}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || compressing || attachments.length >= MAX_ATTACHMENTS}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/70 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
        >
          {compressing ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />
              <span>Compressing...</span>
            </>
          ) : (
            <>
              <Paperclip className="w-3.5 h-3.5 text-indigo-500" />
              <span>Add Attachment</span>
              <span className="text-[10px] text-slate-400">
                ({attachments.length}/{MAX_ATTACHMENTS})
              </span>
            </>
          )}
        </button>
        <span className="text-[10px] text-slate-400">
          Optional · JPG, PNG, WebP, HEIC, PDF (auto-compressed)
        </span>
      </div>

      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {attachments.map((att) => (
            <div
              key={att.localId}
              className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-lg border text-xs ${
                att.uploadStatus === 'error'
                  ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
                  : att.uploadStatus === 'uploaded'
                  ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
              }`}
            >
              <Paperclip className="w-3 h-3 shrink-0 text-slate-400" />
              <span className="font-medium truncate max-w-[160px]" title={att.fileName}>
                {att.fileName}
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono whitespace-nowrap">
                {formatAttachmentSize(att.originalSizeBytes)} → {formatAttachmentSize(att.storedSizeBytes)}
              </span>

              {att.uploadStatus === 'uploading' && (
                <Loader2 className="w-3 h-3 animate-spin text-indigo-500 shrink-0" />
              )}
              {att.uploadStatus === 'uploaded' && (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              )}
              {att.uploadStatus === 'error' && (
                <span className="inline-flex items-center gap-1">
                  <AlertCircle
                    className="w-3.5 h-3.5 text-rose-500 shrink-0"
                    aria-label={att.uploadError || 'Upload failed'}
                  />
                  {onRetryUpload && (
                    <button
                      type="button"
                      onClick={() => onRetryUpload(att.localId)}
                      className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-rose-700 dark:text-rose-300 underline cursor-pointer"
                    >
                      <RefreshCw className="w-2.5 h-2.5" />
                      Retry
                    </button>
                  )}
                </span>
              )}

              {att.uploadStatus === 'pending' && !disabled && (
                <button
                  type="button"
                  onClick={() => handleRemove(att.localId)}
                  className="text-slate-400 hover:text-rose-500 cursor-pointer transition-colors"
                  title="Remove attachment"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
