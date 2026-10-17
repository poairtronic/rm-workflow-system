import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../utils/cn';
import { useFocusTrap } from '../../hooks/useFocusTrap';

interface SlideOverProps {
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  width?: string;
}

export function SlideOver({
  isOpen,
  onClose,
  title,
  children,
  className,
  width = "max-w-md",
}: SlideOverProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  
  useFocusTrap(panelRef, isOpen);

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

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 overflow-hidden">
        {/* Modern semi-transparent blurred backdrop */}
        <div 
          className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity duration-300"
          onClick={onClose}
          aria-hidden="true" 
        />

        <div className="fixed inset-y-0 right-0 flex max-w-full pl-0 sm:pl-10 pointer-events-none">
          <div 
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            className={cn("w-full sm:w-screen max-w-full pointer-events-auto transform transition ease-in-out duration-300", width, className)}
          >
            <div className="flex flex-col h-full bg-white dark:bg-[#121526] shadow-2xl border-l border-slate-200 dark:border-[#1e233d]">
              <div className="px-4 py-3.5 sm:px-6 sm:py-5 bg-slate-50/80 dark:bg-[#0e111f] border-b border-slate-200 dark:border-[#1e233d] shrink-0">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate">{title}</div>
                  <button
                    type="button"
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1c223c] transition-colors focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer shrink-0"
                    onClick={onClose}
                    aria-label="Close drawer"
                  >
                    <X className="h-5 w-5" aria-hidden="true" />
                  </button>
                </div>
              </div>
              <div className="relative flex-1 p-4 sm:p-6 overflow-y-auto">
                {children}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
