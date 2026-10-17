import React, { useState, useMemo } from 'react';
import { Search, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, LayoutGrid, Table } from 'lucide-react';
import { cn } from '../../utils/cn';
import { EmptyState } from './EmptyState';
import { ErrorState } from './ErrorState';
import { SkeletonBlock } from './LoadingState';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';

export interface ColumnDef<T> {
  key: Extract<keyof T, string> | string;
  header: React.ReactNode;
  render?: (row: T) => React.ReactNode;
  sortable?: boolean;
  isNumeric?: boolean;
}

interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  isLoading?: boolean;
  isError?: boolean;
  errorMsg?: string;
  onRetry?: () => void;
  onRowClick?: (row: T) => void;
  searchable?: boolean;
  searchKeys?: (keyof T)[];
  pagination?: boolean;
  defaultPageSize?: number;
  className?: string;
  mobileDisplay?: 'cards' | 'scroll' | 'auto';
}

export function DataTable<T extends { id?: string | number }>({
  columns,
  data,
  isLoading,
  isError,
  errorMsg,
  onRetry,
  onRowClick,
  searchable = false,
  searchKeys = [],
  pagination = false,
  defaultPageSize = 10,
  className,
  mobileDisplay = 'auto',
}: DataTableProps<T>) {
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebouncedValue(searchTerm, 300);
  
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [activeMobileView, setActiveMobileView] = useState<'cards' | 'scroll'>(
    mobileDisplay === 'scroll' ? 'scroll' : 'cards'
  );

  const filteredData = useMemo(() => {
    if (!searchable || !debouncedSearch) return data;
    const lowerSearch = debouncedSearch.toLowerCase();
    return data.filter(item => {
      if (searchKeys.length > 0) {
        return searchKeys.some(key => {
          const val = item[key];
          return val != null && String(val).toLowerCase().includes(lowerSearch);
        });
      }
      return Object.values(item as any).some(val => 
        val != null && String(val).toLowerCase().includes(lowerSearch)
      );
    });
  }, [data, searchable, debouncedSearch, searchKeys]);

  const sortedData = useMemo(() => {
    if (!sortConfig) return filteredData;
    return [...filteredData].sort((a: any, b: any) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredData, sortConfig]);

  const paginatedData = useMemo(() => {
    if (!pagination) return sortedData;
    const start = (page - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, pagination, page, pageSize]);

  const totalPages = Math.ceil(sortedData.length / pageSize);

  const handleSort = (key: string, isSortable?: boolean) => {
    if (!isSortable) return;
    setSortConfig(current => {
      if (current?.key === key) {
        if (current.direction === 'asc') return { key, direction: 'desc' };
        return null; // toggle off
      }
      return { key, direction: 'asc' };
    });
  };

  if (isError) {
    return <ErrorState message={errorMsg} onRetry={onRetry} className={className} />;
  }

  // Key column classification for mobile card layout
  const firstCol = columns[0];
  const actionCol = columns.find(c => String(c.key).toLowerCase().includes('action'));
  const statusCol = columns.find(c => String(c.key).toLowerCase().includes('status'));
  const otherCols = columns.filter(c => c !== firstCol && c !== actionCol && c !== statusCol);

  return (
    <div className={cn("flex flex-col space-y-3 sm:space-y-4 w-full max-w-full min-w-0", className)}>
      {/* Search Bar & Mobile View Switcher */}
      {(searchable || mobileDisplay === 'auto') && (
        <div className="flex items-center justify-between gap-2.5">
          {searchable ? (
            <div className="relative flex-1 sm:max-w-sm">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400 dark:text-[#55627a]" />
              </div>
              <input
                type="text"
                className="block w-full pl-10 pr-3 h-11 sm:h-9 border border-gray-300 dark:border-[#1e233d] rounded-xl sm:rounded-lg bg-white dark:bg-[#0e111f] text-base sm:text-sm text-slate-900 dark:text-slate-100 placeholder-gray-500 dark:placeholder-[#55627a] focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 font-medium transition-colors"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          ) : <div />}

          {/* Quick toggle for phone view (Cards vs Scroll Table) */}
          <div className="flex sm:hidden items-center bg-slate-100 dark:bg-[#161a2e] p-0.5 rounded-lg border border-slate-200 dark:border-[#1e233d] shrink-0">
            <button
              type="button"
              onClick={() => setActiveMobileView('cards')}
              className={cn(
                "p-2 rounded-md transition-colors",
                activeMobileView === 'cards'
                  ? "bg-white dark:bg-[#1f2545] text-indigo-600 dark:text-indigo-400 shadow-2xs"
                  : "text-slate-500 dark:text-slate-400"
              )}
              title="Stacked Cards View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setActiveMobileView('scroll')}
              className={cn(
                "p-2 rounded-md transition-colors",
                activeMobileView === 'scroll'
                  ? "bg-white dark:bg-[#1f2545] text-indigo-600 dark:text-indigo-400 shadow-2xs"
                  : "text-slate-500 dark:text-slate-400"
              )}
              title="Scrollable Table View"
            >
              <Table className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Table Container */}
      <div className="bg-white dark:bg-[#121526] border border-border dark:border-[#1e233d] rounded-2xl shadow-xs overflow-hidden w-full max-w-full min-w-0">
        {/* Loading State */}
        {isLoading ? (
          <div className="p-4 sm:p-6 space-y-3">
            {Array.from({ length: 4 }).map((_, idx) => (
              <SkeletonBlock key={idx} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        ) : paginatedData.length === 0 ? (
          <div className="p-8">
            <EmptyState />
          </div>
        ) : (
          <>
            {/* OPTION A: Mobile Stacked Cards (< 640px) */}
            <div
              className={cn(
                "divide-y divide-border dark:divide-[#1e233d]",
                activeMobileView === 'cards' ? "block sm:hidden" : "hidden"
              )}
            >
              {paginatedData.map((row, rowIndex) => (
                <div
                  key={row.id ?? rowIndex}
                  onClick={() => onRowClick && onRowClick(row)}
                  className={cn(
                    "p-3.5 sm:p-4 space-y-2.5 transition-colors",
                    onRowClick ? "cursor-pointer active:bg-slate-50 dark:active:bg-[#161a2e]" : "hover:bg-slate-50/50"
                  )}
                >
                  {/* Card Header: Primary identifier + Status badge */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      {firstCol && (
                        <>
                          <span className="text-[10px] uppercase font-semibold text-slate-400 dark:text-[#7a879e] tracking-wider block">
                            {firstCol.header}
                          </span>
                          <div className="text-sm font-bold text-slate-900 dark:text-white mt-0.5 break-words">
                            {firstCol.render ? firstCol.render(row) : (row as any)[firstCol.key]}
                          </div>
                        </>
                      )}
                    </div>
                    {statusCol && (
                      <div className="shrink-0 pt-0.5">
                        {statusCol.render ? statusCol.render(row) : (row as any)[statusCol.key]}
                      </div>
                    )}
                  </div>

                  {/* Card Details: 2-column key-value grid */}
                  {otherCols.length > 0 && (
                    <div className="grid grid-cols-2 gap-x-3 gap-y-2 pt-2 border-t border-dashed border-slate-100 dark:border-[#1e233d]">
                      {otherCols.map((col, idx) => {
                        const val = col.render ? col.render(row) : (row as any)[col.key];
                        return (
                          <div key={String(col.key) + idx} className={cn("min-w-0", col.isNumeric && "text-right")}>
                            <span className="text-[10px] uppercase font-medium text-slate-400 dark:text-[#7a879e] block truncate">
                              {col.header}
                            </span>
                            <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-0.5 break-words">
                              {val}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Card Actions: Generous tap target buttons */}
                  {actionCol && (
                    <div
                      className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-[#1e233d]"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {actionCol.render ? actionCol.render(row) : (row as any)[actionCol.key]}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* OPTION B: Multi-Column Table with Sticky First Column & Isolated Horizontal Scrolling */}
            <div
              className={cn(
                "overflow-x-auto touch-pan-x w-full max-w-full min-w-0",
                activeMobileView === 'cards' ? "hidden sm:block" : "block"
              )}
            >
              <table className="min-w-full divide-y divide-border dark:divide-[#181c30] whitespace-nowrap">
                <thead className="bg-gray-50 dark:bg-[#0d0f1b] sticky top-0 z-10 border-b border-border dark:border-[#1e233d]">
                  <tr>
                    {columns.map((col, idx) => (
                      <th
                        key={String(col.key) + idx}
                        scope="col"
                        onClick={() => handleSort(String(col.key), col.sortable)}
                        className={cn(
                          "px-4 lg:px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-[#7a879e] uppercase tracking-wider",
                          idx === 0 && "sticky left-0 z-20 bg-gray-50 dark:bg-[#0d0f1b] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]",
                          col.sortable && "cursor-pointer select-none hover:bg-gray-100 dark:hover:bg-[#171b30]",
                          col.isNumeric && "text-right"
                        )}
                      >
                        <div className={cn("flex items-center gap-1", col.isNumeric && "justify-end")}>
                          <span>{col.header}</span>
                          {col.sortable && sortConfig?.key === col.key && (
                            sortConfig.direction === 'asc' ? (
                              <ChevronUp className="w-3.5 h-3.5 text-indigo-500" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5 text-indigo-500" />
                            )
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-[#121526] divide-y divide-border dark:divide-[#181c30]">
                  {paginatedData.map((row, rowIndex) => (
                    <tr
                      key={row.id ?? rowIndex}
                      onClick={() => onRowClick && onRowClick(row)}
                      className={cn(
                        "transition-colors",
                        onRowClick ? "cursor-pointer hover:bg-gray-50 dark:hover:bg-[#171b30]" : "hover:bg-slate-50/50 dark:hover:bg-[#171b30]/60"
                      )}
                    >
                      {columns.map((col, colIndex) => {
                        const val = col.render ? col.render(row) : (row as any)[col.key];
                        return (
                          <td
                            key={String(col.key) + colIndex}
                            className={cn(
                              "px-4 lg:px-6 py-3.5 text-xs sm:text-sm text-gray-900 dark:text-slate-200",
                              colIndex === 0 && "sticky left-0 z-10 bg-white dark:bg-[#121526] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] font-medium",
                              col.isNumeric && "text-right tabular-nums"
                            )}
                          >
                            {val}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Responsive Pagination Bar */}
        {pagination && !isLoading && sortedData.length > 0 && (
          <div className="bg-white dark:bg-[#0e111f] px-3.5 sm:px-6 py-3 flex items-center justify-between border-t border-border dark:border-[#1e233d]">
            {/* Mobile View Pagination */}
            <div className="flex-1 flex items-center justify-between sm:hidden gap-2">
              <button
                type="button"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="min-h-[44px] px-4 py-2 border border-gray-300 dark:border-[#1e233d] text-xs font-semibold rounded-xl text-gray-700 dark:text-slate-200 bg-white dark:bg-[#161a2e] hover:bg-gray-50 dark:hover:bg-[#1c213a] disabled:opacity-40 cursor-pointer"
              >
                Previous
              </button>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {page} / {totalPages || 1}
              </span>
              <button
                type="button"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages || totalPages === 0}
                className="min-h-[44px] px-4 py-2 border border-gray-300 dark:border-[#1e233d] text-xs font-semibold rounded-xl text-gray-700 dark:text-slate-200 bg-white dark:bg-[#161a2e] hover:bg-gray-50 dark:hover:bg-[#1c213a] disabled:opacity-40 cursor-pointer"
              >
                Next
              </button>
            </div>

            {/* Tablet & Desktop View Pagination */}
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-xs sm:text-sm text-gray-700 dark:text-slate-400">
                  Showing <span className="font-semibold text-slate-900 dark:text-slate-200">{(page - 1) * pageSize + 1}</span> to <span className="font-semibold text-slate-900 dark:text-slate-200">{Math.min(page * pageSize, sortedData.length)}</span> of <span className="font-semibold text-slate-900 dark:text-slate-200">{sortedData.length}</span> results
                </p>
              </div>
              <div className="flex items-center space-x-3">
                <select
                  value={pageSize}
                  onChange={e => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="block pl-2.5 pr-8 py-1.5 text-xs sm:text-sm border border-gray-300 dark:border-[#1e233d] bg-white dark:bg-[#161a2e] text-slate-900 dark:text-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer font-medium"
                >
                  <option value={10}>10 / page</option>
                  <option value={20}>20 / page</option>
                  <option value={50}>50 / page</option>
                </select>
                <nav className="inline-flex rounded-lg shadow-2xs -space-x-px" aria-label="Pagination">
                  <button
                    type="button"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="relative inline-flex items-center px-2.5 py-1.5 rounded-l-lg border border-gray-300 dark:border-[#1e233d] bg-white dark:bg-[#161a2e] text-xs font-medium text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-[#1c213a] disabled:opacity-40 cursor-pointer min-h-[36px]"
                  >
                    <span className="sr-only">Previous</span>
                    <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages || totalPages === 0}
                    className="relative inline-flex items-center px-2.5 py-1.5 rounded-r-lg border border-gray-300 dark:border-[#1e233d] bg-white dark:bg-[#161a2e] text-xs font-medium text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-[#1c213a] disabled:opacity-40 cursor-pointer min-h-[36px]"
                  >
                    <span className="sr-only">Next</span>
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
