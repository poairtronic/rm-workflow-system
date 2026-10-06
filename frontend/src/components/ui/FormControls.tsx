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
    <div className={cn("space-y-1", className)}>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {error && <p className="text-sm text-red-600 mt-1">{error}</p>}
      {hint && !error && <p className="text-sm text-gray-500 mt-1">{hint}</p>}
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
          "block w-full rounded-md shadow-sm sm:text-sm focus:outline-none focus:ring-1 focus:border-primary focus:ring-primary",
          error
            ? "border-red-300 text-red-900 placeholder-red-300 focus:ring-red-500 focus:border-red-500"
            : "border-gray-300 placeholder-gray-400",
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
      <div className="relative rounded-md shadow-sm">
        <input
          type="number"
          ref={ref}
          className={cn(
            "block w-full rounded-md sm:text-sm focus:outline-none focus:ring-1 focus:border-primary focus:ring-primary text-right tabular-nums",
            unit ? "pr-12" : "",
            error
              ? "border-red-300 text-red-900 placeholder-red-300 focus:ring-red-500 focus:border-red-500"
              : "border-gray-300 placeholder-gray-400",
            className
          )}
          {...props}
        />
        {unit && (
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
            <span className="text-gray-500 sm:text-sm">{unit}</span>
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
          "block w-full rounded-md shadow-sm sm:text-sm focus:outline-none focus:ring-1 focus:border-primary focus:ring-primary bg-white",
          error
            ? "border-red-300 text-red-900 focus:ring-red-500 focus:border-red-500"
            : "border-gray-300",
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
          "block w-full rounded-md shadow-sm sm:text-sm focus:outline-none focus:ring-1 focus:border-primary focus:ring-primary",
          error
            ? "border-red-300 text-red-900 placeholder-red-300 focus:ring-red-500 focus:border-red-500"
            : "border-gray-300 placeholder-gray-400",
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
              "h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary",
              error ? "border-red-300" : "",
              className
            )}
            {...props}
          />
        </div>
        <div className="ml-3 text-sm">
          <label htmlFor={id} className={cn("font-medium", error ? "text-red-900" : "text-gray-700")}>
            {label}
          </label>
          {description && <p className="text-gray-500">{description}</p>}
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
          "block w-full rounded-md shadow-sm sm:text-sm focus:outline-none focus:ring-1 focus:border-primary focus:ring-primary",
          error
            ? "border-red-300 text-red-900 focus:ring-red-500 focus:border-red-500"
            : "border-gray-300",
          className
        )}
        {...props}
      />
    );
  }
);
DateInput.displayName = 'DateInput';
