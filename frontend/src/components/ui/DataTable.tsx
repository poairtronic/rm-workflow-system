import React, { useState, useMemo } from 'react';
import { Search, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
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
  className
}: DataTableProps<T>) {
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebouncedValue(searchTerm, 300);
  
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);

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

  return (
    <div className={cn("flex flex-col space-y-4", className)}>
      {searchable && (
        <div className="relative max-w-sm">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-gray-400 dark:text-[#55627a]" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-[#1e233d] rounded-lg leading-5 bg-white dark:bg-[#0e111f] text-slate-900 dark:text-slate-100 placeholder-gray-500 dark:placeholder-[#55627a] focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm font-medium"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      )}

      <div className="bg-white dark:bg-[#121526] border border-border dark:border-[#1e233d] rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border dark:divide-[#181c30]">
            <thead className="bg-gray-50 dark:bg-[#0d0f1b] sticky top-0 z-10 border-b border-border dark:border-[#1e233d]">
              <tr>
                {columns.map((col, idx) => (
                  <th
                    key={String(col.key) + idx}
                    scope="col"
                    onClick={() => handleSort(String(col.key), col.sortable)}
                    className={cn(
                      "px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-[#7a879e] uppercase tracking-wider",
                      col.sortable && "cursor-pointer select-none hover:bg-gray-100 dark:hover:bg-[#171b30]",
                      col.isNumeric && "text-right"
                    )}
                  >
                    <div className={cn("flex items-center", col.isNumeric && "justify-end")}>
                      {col.header}
                      {col.sortable && sortConfig?.key === col.key && (
                        sortConfig.direction === 'asc' ? <ChevronUp className="ml-1 w-4 h-4 text-indigo-400" /> : <ChevronDown className="ml-1 w-4 h-4 text-indigo-400" />
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-[#121526] divide-y divide-border dark:divide-[#181c30]">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, rowIndex) => (
                  <tr key={`skel-${rowIndex}`}>
                    {columns.map((_, colIndex) => (
                      <td key={`skel-${rowIndex}-${colIndex}`} className="px-6 py-4 whitespace-nowrap">
                        <SkeletonBlock className="h-4 w-full max-w-[120px]" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-6 py-8 whitespace-nowrap">
                    <EmptyState />
                  </td>
                </tr>
              ) : (
                paginatedData.map((row, rowIndex) => (
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
                            "px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-slate-200",
                            col.isNumeric && "text-right tabular-nums"
                          )}
                        >
                          {val}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {pagination && !isLoading && sortedData.length > 0 && (
          <div className="bg-white dark:bg-[#0e111f] px-4 py-3 flex items-center justify-between border-t border-border dark:border-[#1e233d] sm:px-6">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-[#1e233d] text-sm font-medium rounded-md text-gray-700 dark:text-slate-200 bg-white dark:bg-[#161a2e] hover:bg-gray-50 dark:hover:bg-[#1c213a] disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-[#1e233d] text-sm font-medium rounded-md text-gray-700 dark:text-slate-200 bg-white dark:bg-[#161a2e] hover:bg-gray-50 dark:hover:bg-[#1c213a] disabled:opacity-50"
              >
                Next
              </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700 dark:text-slate-400">
                  Showing <span className="font-semibold text-slate-900 dark:text-slate-200">{(page - 1) * pageSize + 1}</span> to <span className="font-semibold text-slate-900 dark:text-slate-200">{Math.min(page * pageSize, sortedData.length)}</span> of <span className="font-semibold text-slate-900 dark:text-slate-200">{sortedData.length}</span> results
                </p>
              </div>
              <div className="flex items-center space-x-4">
                <select
                  value={pageSize}
                  onChange={e => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="block w-full pl-3 pr-10 py-1.5 text-base border-gray-300 dark:border-[#1e233d] bg-white dark:bg-[#161a2e] text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md cursor-pointer"
                >
                  <option value={10}>10 / page</option>
                  <option value={20}>20 / page</option>
                  <option value={50}>50 / page</option>
                </select>
                <nav className="relative z-0 inline-flex rounded-md shadow-xs -space-x-px" aria-label="Pagination">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 dark:border-[#1e233d] bg-white dark:bg-[#161a2e] text-sm font-medium text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-[#1c213a] disabled:opacity-50 cursor-pointer"
                  >
                    <span className="sr-only">Previous</span>
                    <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 dark:border-[#1e233d] bg-white dark:bg-[#161a2e] text-sm font-medium text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-[#1c213a] disabled:opacity-50 cursor-pointer"
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
