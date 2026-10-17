import React, { forwardRef } from 'react';
import { cn } from '../../utils/cn';

interface FormFieldProps {
  label: string;
  id?: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
  required?: boolean;
  className?: string;
}

export function FormField({ label, id, error, hint, children, required, className }: FormFieldProps) {
  return (
    <div className={cn("space-y-1.5 w-full min-w-0", className)}>
      <label htmlFor={id} className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
        {label} {required && <span className="text-red-500 font-bold">*</span>}
      </label>
      {children}
      {error && <p className="text-xs font-medium text-red-600 dark:text-red-400 mt-1">{error}</p>}
      {hint && !error && <p className="text-xs text-slate-500 dark:text-[#8896ab] mt-1">{hint}</p>}
    </div>
  );
}

// ---------------- FormGrid (Single column on mobile, multi-column on desktop, gap: 12px) ----------------

export function FormGrid({
  children,
  columns = 2,
  className,
}: {
  children: React.ReactNode;
  columns?: 2 | 3 | 4;
  className?: string;
}) {
  const colClass =
    columns === 3
      ? 'sm:grid-cols-3'
      : columns === 4
      ? 'sm:grid-cols-2 md:grid-cols-4'
      : 'sm:grid-cols-2';

  return (
    <div className={cn("grid grid-cols-1 gap-3", colClass, className)}>
      {children}
    </div>
  );
}

// ---------------- TextInput ----------------

export interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(
  ({ className, error, type = 'text', ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        className={cn(
          "block w-full min-h-[44px] h-11 sm:h-9 rounded-xl sm:rounded-lg border bg-white dark:bg-[#0e111f] px-3.5 py-2 text-base sm:text-sm text-slate-900 dark:text-slate-100 shadow-2xs transition-colors duration-150",
          "placeholder:text-slate-400 dark:placeholder:text-[#55627a] focus:outline-none focus:ring-2 focus:ring-offset-0 font-medium",
          error
            ? "border-red-300 dark:border-red-800 text-red-900 dark:text-red-300 placeholder-red-300 focus:border-red-500 focus:ring-red-200"
            : "border-slate-300 dark:border-[#1e233d] hover:border-slate-400 dark:hover:border-slate-700 focus:border-blue-600 focus:ring-blue-100 dark:focus:ring-blue-950",
          className
        )}
        {...props}
      />
    );
  }
);
TextInput.displayName = 'TextInput';

// ---------------- NumberInput ----------------

export interface NumberInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
  unit?: string;
}

export const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(
  ({ className, error, unit, ...props }, ref) => {
    return (
      <div className="relative rounded-xl sm:rounded-lg shadow-2xs w-full min-w-0">
        <input
          type="number"
          ref={ref}
          className={cn(
            "block w-full min-h-[44px] h-11 sm:h-9 rounded-xl sm:rounded-lg border bg-white dark:bg-[#0e111f] px-3.5 py-2 text-base sm:text-sm text-slate-900 dark:text-slate-100 transition-colors duration-150",
            "focus:outline-none focus:ring-2 focus:ring-offset-0 text-right tabular-nums font-medium",
            unit ? "pr-14" : "",
            error
              ? "border-red-300 dark:border-red-800 text-red-900 dark:text-red-300 placeholder-red-300 focus:border-red-500 focus:ring-red-200"
              : "border-slate-300 dark:border-[#1e233d] hover:border-slate-400 dark:hover:border-slate-700 focus:border-blue-600 focus:ring-blue-100 dark:focus:ring-blue-950",
            className
          )}
          {...props}
        />
        {unit && (
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2.5">
            <span className="text-[10px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider bg-slate-100 dark:bg-[#161a2e] px-2 py-0.5 rounded-md border border-slate-200 dark:border-[#1e233d]">
              {unit}
            </span>
          </div>
        )}
      </div>
    );
  }
);
NumberInput.displayName = 'NumberInput';

// ---------------- Select ----------------

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, error, children, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={cn(
          "block w-full min-h-[44px] h-11 sm:h-9 rounded-xl sm:rounded-lg border bg-white dark:bg-[#0e111f] px-3.5 py-2 text-base sm:text-sm text-slate-900 dark:text-slate-100 shadow-2xs transition-colors duration-150",
          "focus:outline-none focus:ring-2 focus:ring-offset-0 cursor-pointer font-medium",
          error
            ? "border-red-300 dark:border-red-800 text-red-900 dark:text-red-300 focus:border-red-500 focus:ring-red-200"
            : "border-slate-300 dark:border-[#1e233d] hover:border-slate-400 dark:hover:border-slate-700 focus:border-blue-600 focus:ring-blue-100 dark:focus:ring-blue-950",
          className
        )}
        {...props}
      >
        {children}
      </select>
    );
  }
);
Select.displayName = 'Select';

// ---------------- Textarea ----------------

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, rows = 3, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        rows={rows}
        className={cn(
          "block w-full rounded-xl sm:rounded-lg border bg-white dark:bg-[#0e111f] px-3.5 py-2.5 text-base sm:text-sm text-slate-900 dark:text-slate-100 shadow-2xs transition-colors duration-150",
          "placeholder:text-slate-400 dark:placeholder:text-[#55627a] focus:outline-none focus:ring-2 focus:ring-offset-0 font-medium",
          error
            ? "border-red-300 dark:border-red-800 text-red-900 dark:text-red-300 placeholder-red-300 focus:border-red-500 focus:ring-red-200"
            : "border-slate-300 dark:border-[#1e233d] hover:border-slate-400 dark:hover:border-slate-700 focus:border-blue-600 focus:ring-blue-100 dark:focus:ring-blue-950",
          className
        )}
        {...props}
      />
    );
  }
);
Textarea.displayName = 'Textarea';

// ---------------- Checkbox ----------------

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: React.ReactNode;
  description?: React.ReactNode;
  error?: boolean;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, error, label, description, id, ...props }, ref) => {
    return (
      <div className="relative flex items-start py-1">
        <div className="flex h-6 items-center">
          <input
            id={id}
            type="checkbox"
            ref={ref}
            className={cn(
              "h-5 w-5 sm:h-4 sm:w-4 rounded border-slate-300 dark:border-[#1e233d] text-blue-600 focus:ring-blue-500 cursor-pointer",
              error ? "border-red-300 dark:border-red-800" : "",
              className
            )}
            {...props}
          />
        </div>
        <div className="ml-3 text-sm">
          <label htmlFor={id} className={cn("font-medium text-slate-700 dark:text-slate-200 cursor-pointer select-none", error ? "text-red-900 dark:text-red-400" : "")}>
            {label}
          </label>
          {description && <p className="text-xs text-slate-500 dark:text-[#8896ab] mt-0.5">{description}</p>}
        </div>
      </div>
    );
  }
);
Checkbox.displayName = 'Checkbox';

// ---------------- DateInput ----------------

export interface DateInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const DateInput = forwardRef<HTMLInputElement, DateInputProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <input
        type="date"
        ref={ref}
        className={cn(
          "block w-full min-h-[44px] h-11 sm:h-9 rounded-xl sm:rounded-lg border bg-white dark:bg-[#0e111f] px-3.5 py-2 text-base sm:text-sm text-slate-900 dark:text-slate-100 shadow-2xs transition-colors duration-150",
          "focus:outline-none focus:ring-2 focus:ring-offset-0 font-medium",
          error
            ? "border-red-300 dark:border-red-800 text-red-900 dark:text-red-300 focus:border-red-500 focus:ring-red-200"
            : "border-slate-300 dark:border-[#1e233d] hover:border-slate-400 dark:hover:border-slate-700 focus:border-blue-600 focus:ring-blue-100 dark:focus:ring-blue-950",
          className
        )}
        {...props}
      />
    );
  }
);
DateInput.displayName = 'DateInput';
