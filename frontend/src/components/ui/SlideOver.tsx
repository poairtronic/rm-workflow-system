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

        <div className="fixed inset-y-0 right-0 flex max-w-full pl-10 pointer-events-none">
          <div 
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            className={cn("w-screen pointer-events-auto transform transition ease-in-out duration-300", width, className)}
          >
            <div className="flex flex-col h-full bg-white shadow-2xl border-l border-slate-200">
              <div className="px-6 py-5 bg-slate-50/80 border-b border-slate-200">
                <div className="flex items-center justify-between">
                  <div className="text-lg font-bold text-slate-900">{title}</div>
                  <button
                    type="button"
                    className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-600 cursor-pointer"
                    onClick={onClose}
                  >
                    <span className="sr-only">Close panel</span>
                    <X className="h-5 w-5" aria-hidden="true" />
                  </button>
                </div>
              </div>
              <div className="relative flex-1 p-6 overflow-y-auto">
                {children}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
