import React from 'react';
import { cn } from '../../utils/cn';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

const variantStyles: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary:
    'bg-[#004ac6] hover:bg-[#003ba0] text-white shadow-xs hover:shadow-sm border border-transparent active:scale-[0.98]',
  secondary:
    'bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 shadow-xs hover:border-slate-400 active:scale-[0.98]',
  danger:
    'bg-red-600 hover:bg-red-700 text-white shadow-xs hover:shadow-sm border border-transparent active:scale-[0.98]',
  ghost:
    'bg-transparent hover:bg-slate-100 text-slate-700 active:scale-[0.98]',
};

const sizeStyles: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5 rounded-lg',
  md: 'h-9 px-4 text-sm gap-2 rounded-lg',
  lg: 'h-11 px-5 text-base gap-2.5 rounded-lg',
};

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  disabled,
  ...props
}) => {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center font-medium transition-all duration-150',
        'focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-600',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none select-none cursor-pointer',
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
};
