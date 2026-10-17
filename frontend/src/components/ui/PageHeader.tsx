import React from 'react';
import { cn } from '../../utils/cn';

interface PageHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  breadcrumbs?: React.ReactNode;
  actionSlot?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  subtitle,
  breadcrumbs,
  actionSlot,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn('mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4', className)}>
      <div className="flex-1 space-y-1 min-w-0">
        {breadcrumbs && (
          <nav aria-label="breadcrumb" className="text-xs sm:text-sm font-medium text-gray-500 dark:text-[#8896ab] mb-1 truncate">
            {breadcrumbs}
          </nav>
        )}
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white truncate">{title}</h1>
        {subtitle && (
          <p className="text-xs sm:text-sm text-gray-500 dark:text-[#8896ab]">{subtitle}</p>
        )}
      </div>
      {actionSlot && (
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0 w-full sm:w-auto">
          {actionSlot}
        </div>
      )}
    </div>
  );
}
