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
    <div className={cn('mb-6 flex flex-col md:flex-row md:items-start md:justify-between gap-4', className)}>
      <div className="flex-1 space-y-1">
        {breadcrumbs && (
          <nav aria-label="breadcrumb" className="text-sm font-medium text-gray-500 mb-2">
            {breadcrumbs}
          </nav>
        )}
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        {subtitle && (
          <p className="text-sm text-gray-500">{subtitle}</p>
        )}
      </div>
      {actionSlot && (
        <div className="flex items-center space-x-3 shrink-0">
          {actionSlot}
        </div>
      )}
    </div>
  );
}
