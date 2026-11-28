import React, { useEffect, useState } from 'react';
import { X, Download, ExternalLink, FileText, Image as ImageIcon, Loader2, Paperclip } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { consumablesApi } from '../../services/consumables.service';
import type { ConsumableLineAttachmentDto } from '../../types/consumables.types';
import { formatAttachmentSize } from '../../utils/consumableAttachmentCompression';

interface AttachmentViewerModalProps {
  isOpen: boolean;
  lineItemId: string | null;
  itemTitle?: string;
  onClose: () => void;
}

export const AttachmentViewerModal: React.FC<AttachmentViewerModalProps> = ({
  isOpen,
  lineItemId,
  itemTitle,
  onClose,
}) => {
  const [attachments, setAttachments] = useState<ConsumableLineAttachmentDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !lineItemId) {
      setAttachments([]);
      setSelectedId(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    consumablesApi
      .getLineAttachments(lineItemId)
      .then((list) => {
        if (cancelled) return;
        setAttachments(list || []);
        if (list && list.length > 0) {
          setSelectedId(list[0].id);
        }
      })
      .catch((err: any) => {
        if (cancelled) return;
        toast.error(err?.message || 'Failed to load attachments');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, lineItemId]);

  if (!isOpen || !lineItemId) return null;

  const selected = attachments.find((a) => a.id === selectedId) || attachments[0] || null;
  const isPdf = selected?.mimeType === 'application/pdf';

  const handleDownload = async (att: ConsumableLineAttachmentDto) => {
    try {
      const response = await fetch(att.signedUrl);
      if (!response.ok) throw new Error('Download failed');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = att.fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      window.open(att.signedUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl max-w-3xl w-full overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <Paperclip className="w-4 h-4 text-indigo-500 shrink-0" />
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                Line Item Attachments
              </h3>
              {itemTitle && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  {itemTitle}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-slate-500">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
              <span className="text-xs">Loading attachments...</span>
            </div>
          ) : attachments.length === 0 ? (
            <div className="text-center py-10 text-xs text-slate-500">
              No attachments found for this line item.
            </div>
          ) : (
            <>
              {/* Attachment Selector List */}
              <div className="flex flex-wrap gap-2">
                {attachments.map((att) => {
                  const active = selected?.id === att.id;
                  const attIsPdf = att.mimeType === 'application/pdf';
                  return (
                    <button
                      key={att.id}
                      type="button"
                      onClick={() => setSelectedId(att.id)}
                      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                        active
                          ? 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-400 dark:border-indigo-600 text-indigo-700 dark:text-indigo-200 font-semibold'
                          : 'bg-slate-50 dark:bg-slate-800/70 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      {attIsPdf ? (
                        <FileText className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                      ) : (
                        <ImageIcon className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                      )}
                      <span className="truncate max-w-[180px]">{att.fileName}</span>
                      <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                        {formatAttachmentSize(att.originalSizeBytes)} → {formatAttachmentSize(att.storedSizeBytes)}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Preview & Actions */}
              {selected && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="text-xs text-slate-600 dark:text-slate-300">
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {selected.fileName}
                      </span>{' '}
                      <span className="font-mono text-[11px] text-slate-500">
                        ({formatAttachmentSize(selected.originalSizeBytes)} → {formatAttachmentSize(selected.storedSizeBytes)})
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {isPdf && (
                        <a
                          href={selected.signedUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          Open PDF
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDownload(selected)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold cursor-pointer transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download
                      </button>
                    </div>
                  </div>

                  {!isPdf ? (
                    <div className="flex items-center justify-center bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-2 max-h-[55vh] overflow-auto">
                      <img
                        src={selected.signedUrl}
                        alt={selected.fileName}
                        className="max-w-full max-h-[50vh] object-contain rounded"
                      />
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 text-center gap-2">
                      <FileText className="w-10 h-10 text-rose-500" />
                      <p className="text-xs text-slate-600 dark:text-slate-300">
                        PDF documents open in a new tab via a short-lived signed URL.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
