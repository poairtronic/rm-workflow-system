import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '../../utils/cn';
import { useFocusTrap } from '../../hooks/useFocusTrap';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  hideCloseButton?: boolean;
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  className,
  hideCloseButton = false,
}: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  
  useFocusTrap(modalRef, isOpen);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-hidden sm:overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity duration-300" 
        onClick={onClose}
        aria-hidden="true" 
      />
      
      {/* Modal Container: Full-width bottom sheet on mobile, centered dialog on desktop */}
      <div className="flex min-h-[100dvh] items-end sm:items-center justify-center p-0 sm:p-4 text-center">
        <div 
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          className={cn(
            "relative transform transition-all w-full sm:max-w-lg bg-white dark:bg-[#121526] text-left shadow-2xl flex flex-col",
            // Mobile: Full-width bottom sheet, max-height 90dvh with rounded top corners
            "rounded-t-3xl sm:rounded-2xl max-h-[90dvh] sm:max-h-[calc(100dvh-3rem)] border-t sm:border border-slate-200 dark:border-[#1e233d]",
            className
          )}
        >
          {/* Mobile Drag Indicator Handle */}
          <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mt-2.5 mb-1 block sm:hidden shrink-0" />

          {/* Modal Header */}
          {title && (
            <div className="bg-white dark:bg-[#121526] px-4 py-3 sm:px-6 sm:py-4 border-b border-gray-200 dark:border-[#1e233d] flex justify-between items-center shrink-0">
              <div className="text-base sm:text-lg font-bold text-gray-900 dark:text-white flex-1 min-w-0 truncate">{title}</div>
              {!hideCloseButton && (
                <button
                  type="button"
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-600 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1c223c] transition-colors focus:outline-none focus:ring-2 focus:ring-primary ml-2 shrink-0 cursor-pointer"
                  onClick={onClose}
                  aria-label="Close dialog"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              )}
            </div>
          )}

          {/* Modal Scrollable Body */}
          <div className="p-4 sm:p-6 bg-white dark:bg-[#121526] overflow-y-auto overscroll-contain flex-1">
            {children}
          </div>

          {/* Sticky Bottom Action Bar (if footer passed) */}
          {footer && (
            <div className="sticky bottom-0 bg-white dark:bg-[#121526] px-4 py-3 sm:px-6 sm:py-4 border-t border-gray-200 dark:border-[#1e233d] flex items-center justify-end gap-2.5 z-10 shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

export function ModalFooter({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn(
      "sticky bottom-0 bg-white dark:bg-[#121526] -mx-4 -mb-4 sm:-mx-6 sm:-mb-6 px-4 py-3 sm:px-6 sm:py-4 border-t border-gray-200 dark:border-[#1e233d] flex items-center justify-end gap-2.5 z-10 shrink-0 mt-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]",
      className
    )}>
      {children}
    </div>
  );
}
