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
  className?: string;
  hideCloseButton?: boolean;
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
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
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-900/25 backdrop-blur-xs transition-opacity" 
        onClick={onClose}
        aria-hidden="true" 
      />
      
      {/* Modal panel */}
      <div className="flex min-h-screen items-center justify-center p-4 sm:p-6 text-center">
        <div 
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          className={cn(
            "relative transform overflow-hidden rounded-xl bg-white dark:bg-[#121526] text-left shadow-2xl transition-all my-8 w-full max-w-lg",
            className
          )}
        >
          {title && (
            <div className="bg-white dark:bg-[#121526] px-5 py-4 border-b border-gray-200 dark:border-slate-800 sm:px-6 flex justify-between items-center">
              <div className="text-lg leading-6 font-medium text-gray-900 dark:text-white flex-1 min-w-0">{title}</div>
              {!hideCloseButton && (
                <button
                  type="button"
                  className="bg-transparent rounded-md text-gray-400 hover:text-gray-500 dark:text-slate-400 dark:hover:text-slate-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary ml-3 shrink-0"
                  onClick={onClose}
                >
                  <span className="sr-only">Close</span>
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              )}
            </div>
          )}
          <div className="p-5 sm:p-6 bg-white dark:bg-[#121526]">
            {children}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
