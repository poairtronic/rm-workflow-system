import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Check, X, Search } from 'lucide-react';

export interface MultiSelectOption {
  id: string;
  label: string;
  subtext?: string;
}

interface MultiSelectFilterProps {
  label: string;
  options: MultiSelectOption[];
  selectedValues: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  className?: string;
}

export function MultiSelectFilter({
  label,
  options,
  selectedValues,
  onChange,
  placeholder,
  className = '',
}: MultiSelectFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const filteredOptions = useMemo(() => {
    if (!search.trim()) return options;
    const q = search.toLowerCase().trim();
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        (opt.subtext && opt.subtext.toLowerCase().includes(q))
    );
  }, [options, search]);

  const toggleOption = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedValues.includes(id)) {
      onChange(selectedValues.filter((v) => v !== id));
    } else {
      onChange([...selectedValues, id]);
    }
  };

  const handleSelectAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    const visibleIds = filteredOptions.map((o) => o.id);
    const combined = Array.from(new Set([...selectedValues, ...visibleIds]));
    onChange(combined);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([]);
  };

  const isAllSelected =
    filteredOptions.length > 0 &&
    filteredOptions.every((o) => selectedValues.includes(o.id));

  return (
    <div className={`relative inline-block text-left ${className}`} ref={containerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`h-8 px-2.5 rounded-lg border text-xs font-medium inline-flex items-center gap-1.5 transition-all select-none cursor-pointer ${
          selectedValues.length > 0
            ? 'border-blue-600 bg-blue-50 text-blue-700 hover:bg-blue-100 shadow-2xs'
            : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400 focus:border-blue-600'
        }`}
      >
        <span>
          {selectedValues.length > 0
            ? `${label} (${selectedValues.length})`
            : placeholder || `All ${label}s`}
        </span>
        {selectedValues.length > 0 && (
          <span
            onClick={handleClear}
            className="p-0.5 hover:bg-blue-200/70 rounded text-blue-700 cursor-pointer"
            title="Clear this filter"
          >
            <X className="w-3 h-3" />
          </span>
        )}
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 transition-transform ${
            isOpen ? 'rotate-180 text-blue-600' : ''
          }`}
        />
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div className="absolute left-0 mt-1.5 w-64 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-2 space-y-2 animate-in fade-in zoom-in-95 duration-100">
          {/* Header Actions */}
          <div className="flex items-center justify-between px-1 pb-1.5 border-b border-slate-100 text-[11px]">
            <span className="font-semibold text-slate-700">Filter by {label}</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-blue-600 hover:underline font-medium cursor-pointer"
              >
                {isAllSelected ? 'Select Visible' : 'All'}
              </button>
              {selectedValues.length > 0 && (
                <>
                  <span className="text-slate-300">•</span>
                  <button
                    type="button"
                    onClick={handleClear}
                    className="text-slate-500 hover:text-red-600 hover:underline font-medium cursor-pointer"
                  >
                    Clear
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Search bar inside popover for lists with > 5 items */}
          {options.length > 5 && (
            <div className="relative px-0.5">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Search ${label.toLowerCase()}...`}
                className="w-full h-7 pl-7 pr-6 rounded-md bg-slate-50 border border-slate-200 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 focus:bg-white"
                autoFocus
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1.5 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          )}

          {/* Options List */}
          <div className="max-h-56 overflow-y-auto space-y-0.5 pr-0.5">
            {filteredOptions.length === 0 ? (
              <div className="py-4 text-center text-xs text-slate-400">
                No {label.toLowerCase()} found
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = selectedValues.includes(opt.id);
                return (
                  <div
                    key={opt.id}
                    onClick={(e) => toggleOption(opt.id, e)}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-colors select-none ${
                      isSelected
                        ? 'bg-blue-50 text-blue-800 font-medium'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center space-x-2 min-w-0 flex-1">
                      <div
                        className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                          isSelected
                            ? 'bg-blue-600 border-blue-600 text-white'
                            : 'border-slate-300 bg-white'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                      <span className="truncate" title={opt.label}>
                        {opt.label}
                      </span>
                    </div>
                    {opt.subtext && (
                      <span className="font-mono text-[10px] text-slate-400 ml-2 shrink-0">
                        {opt.subtext}
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer showing count */}
          <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between px-1 text-[11px] text-slate-400">
            <span>
              {selectedValues.length} of {options.length} selected
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-xs text-blue-600 font-medium hover:underline cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
