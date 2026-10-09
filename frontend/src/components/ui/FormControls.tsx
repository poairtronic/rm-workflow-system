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
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
        {label} {required && <span className="text-red-500 font-bold">*</span>}
      </label>
      {children}
      {error && <p className="text-xs font-medium text-red-600 mt-1">{error}</p>}
      {hint && !error && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
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
          "block w-full rounded-lg border bg-white px-3.5 py-2 text-sm text-slate-900 shadow-xs transition-colors duration-150",
          "placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-offset-0",
          error
            ? "border-red-300 text-red-900 placeholder-red-300 focus:border-red-500 focus:ring-red-200"
            : "border-slate-300 hover:border-slate-400 focus:border-blue-600 focus:ring-blue-100",
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
      <div className="relative rounded-lg shadow-xs">
        <input
          type="number"
          ref={ref}
          className={cn(
            "block w-full rounded-lg border bg-white px-3.5 py-2 text-sm text-slate-900 transition-colors duration-150",
            "focus:outline-none focus:ring-2 focus:ring-offset-0 text-right tabular-nums",
            unit ? "pr-14" : "",
            error
              ? "border-red-300 text-red-900 placeholder-red-300 focus:border-red-500 focus:ring-red-200"
              : "border-slate-300 hover:border-slate-400 focus:border-blue-600 focus:ring-blue-100",
            className
          )}
          {...props}
        />
        {unit && (
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
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
          "block w-full rounded-lg border bg-white px-3.5 py-2 text-sm text-slate-900 shadow-xs transition-colors duration-150",
          "focus:outline-none focus:ring-2 focus:ring-offset-0 cursor-pointer",
          error
            ? "border-red-300 text-red-900 focus:border-red-500 focus:ring-red-200"
            : "border-slate-300 hover:border-slate-400 focus:border-blue-600 focus:ring-blue-100",
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
          "block w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-xs transition-colors duration-150",
          "placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-offset-0",
          error
            ? "border-red-300 text-red-900 placeholder-red-300 focus:border-red-500 focus:ring-red-200"
            : "border-slate-300 hover:border-slate-400 focus:border-blue-600 focus:ring-blue-100",
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
      <div className="relative flex items-start">
        <div className="flex h-5 items-center">
          <input
            id={id}
            type="checkbox"
            ref={ref}
            className={cn(
              "h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer",
              error ? "border-red-300" : "",
              className
            )}
            {...props}
          />
        </div>
        <div className="ml-3 text-sm">
          <label htmlFor={id} className={cn("font-medium text-slate-700 cursor-pointer select-none", error ? "text-red-900" : "")}>
            {label}
          </label>
          {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
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
          "block w-full rounded-lg border bg-white px-3.5 py-2 text-sm text-slate-900 shadow-xs transition-colors duration-150",
          "focus:outline-none focus:ring-2 focus:ring-offset-0",
          error
            ? "border-red-300 text-red-900 focus:border-red-500 focus:ring-red-200"
            : "border-slate-300 hover:border-slate-400 focus:border-blue-600 focus:ring-blue-100",
          className
        )}
        {...props}
      />
    );
  }
);
DateInput.displayName = 'DateInput';
