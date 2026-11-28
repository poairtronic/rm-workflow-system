import React from 'react';
import { Paperclip } from 'lucide-react';

interface AttachmentBadgeProps {
  count?: number;
  onClick: () => void;
  title?: string;
}

export const AttachmentBadge: React.FC<AttachmentBadgeProps> = ({
  count = 0,
  onClick,
  title,
}) => {
  if (!count || count <= 0) return null;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title={title || `View ${count} attachment${count > 1 ? 's' : ''}`}
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 cursor-pointer transition-colors"
    >
      <Paperclip className="w-3 h-3 shrink-0" />
      <span>{count}</span>
    </button>
  );
};
