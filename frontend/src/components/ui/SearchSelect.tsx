import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronsUpDown, Loader2, Plus } from 'lucide-react';
import { cn } from '../../utils/cn';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';

export interface SearchSelectOption {
  id: string;
  primary: string;
  secondary?: string;
}

export interface SearchSelectProps {
  value?: string;
  onChange: (id: string, option?: SearchSelectOption) => void;
  options: SearchSelectOption[];
  onSearch?: (term: string) => void;
  isLoading?: boolean;
  placeholder?: string;
  searchPlaceholder?: string;
  error?: boolean;
  className?: string;
  triggerClassName?: string;
  disabled?: boolean;
  onCreateOption?: (term: string) => void;
  createOptionLabel?: string | ((term: string) => string);
}

export function SearchSelect({
  value,
  onChange,
  options,
  onSearch,
  isLoading = false,
  placeholder = 'Select an option...',
  searchPlaceholder,
  error = false,
  className,
  triggerClassName,
  disabled = false,
  onCreateOption,
  createOptionLabel,
}: SearchSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebouncedValue(searchTerm, 300);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxRef = useRef<HTMLUListElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [activeIndex, setActiveIndex] = useState(-1);
  const [dropdownPosition, setDropdownPosition] = useState<{
    left: number;
    width: number;
    top?: number;
    bottom?: number;
    maxHeight: number;
  }>({
    left: 0,
    width: 0,
    maxHeight: 260,
  });

  // Calculate and update portal position relative to container
  const updatePosition = () => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return;

    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;

    // Decide whether to open upwards or downwards
    // Open upwards if space below is limited (< 220px) and space above is larger
    const openUpwards = spaceBelow < 220 && spaceAbove > spaceBelow;

    // Desired width: match trigger button width or at least 320px for comfortable reading
    const desiredWidth = Math.max(rect.width, 320);
    const availableWidth = viewportWidth - 32;
    const finalWidth = Math.min(desiredWidth, availableWidth);

    // Keep horizontally within viewport boundaries
    let left = rect.left;
    if (left + finalWidth > viewportWidth - 16) {
      left = Math.max(16, viewportWidth - finalWidth - 16);
    }
    if (left < 16) {
      left = 16;
    }

    const availableVerticalSpace = openUpwards ? spaceAbove - 20 : spaceBelow - 20;
    const maxHeight = Math.max(160, Math.min(availableVerticalSpace, 320));

    setDropdownPosition({
      left: Math.round(left),
      width: Math.round(finalWidth),
      top: openUpwards ? undefined : Math.round(rect.bottom + 6),
      bottom: openUpwards ? Math.round(viewportHeight - rect.top + 6) : undefined,
      maxHeight: Math.round(maxHeight),
    });
  };

  useLayoutEffect(() => {
    if (isOpen) {
      updatePosition();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleScrollOrResize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        // If trigger has been scrolled completely off-screen, close menu
        if (rect.bottom < 0 || rect.top > window.innerHeight) {
          setIsOpen(false);
          return;
        }
        updatePosition();
      }
    };

    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);
    return () => {
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
    };
  }, [isOpen]);

  // Inform parent of search changes if async
  useEffect(() => {
    if (onSearch) {
      onSearch(debouncedSearch);
    }
  }, [debouncedSearch, onSearch]);

  // Handle outside click (both trigger and portal dropdown)
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Filter options: instant for local options, debounced for async onSearch
  const effectiveSearch = onSearch ? debouncedSearch : searchTerm;
  const filteredOptions = onSearch
    ? options
    : options.filter((opt) => {
        if (!effectiveSearch.trim()) return true;
        const target = `${opt.primary || ''} ${opt.secondary || ''}`.toLowerCase();
        const searchTerms = effectiveSearch.trim().toLowerCase().split(/\s+/);
        return searchTerms.every((term) => target.includes(term));
      });

  const selectedOption = options.find((opt) => opt.id === value);

  // Update input text when selection changes or menu closes
  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
      setActiveIndex(-1);
    } else {
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [isOpen, selectedOption]);

  const trimmedSearch = searchTerm.trim();
  const exactMatchExists = options.some(
    (opt) => opt.primary.toLowerCase() === trimmedSearch.toLowerCase()
  );
  const showCreateOption = Boolean(onCreateOption && trimmedSearch && !exactMatchExists);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex((prev) =>
          prev < filteredOptions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : prev));
        break;
      case 'Enter':
        e.preventDefault();
        if (activeIndex >= 0 && activeIndex < filteredOptions.length) {
          const opt = filteredOptions[activeIndex];
          onChange(opt.id, opt);
          setIsOpen(false);
        } else if (showCreateOption && onCreateOption) {
          onCreateOption(trimmedSearch);
          setIsOpen(false);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        break;
    }
  };

  // Scroll active item into view
  useEffect(() => {
    if (activeIndex >= 0 && listboxRef.current) {
      const activeEl = listboxRef.current.children[activeIndex] as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [activeIndex]);

  return (
    <div className={cn('relative w-full min-w-0', className)} ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        className={cn(
          'relative w-full min-w-0 max-w-full min-h-[44px] h-11 sm:h-9 rounded-xl sm:rounded-lg border bg-white dark:bg-[#0e111f] dark:border-slate-700 py-2 pl-3.5 pr-10 text-left shadow-2xs transition-colors duration-150 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-offset-0',
          error
            ? 'border-red-300 text-red-900 dark:text-red-400 focus:border-red-500 focus:ring-red-200'
            : 'border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600 focus:border-blue-600 focus:ring-blue-100',
          disabled
            ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 cursor-not-allowed border-slate-200 dark:border-slate-700'
            : 'cursor-pointer text-slate-900 dark:text-slate-100',
          triggerClassName
        )}
      >
        <span className="block truncate w-full min-w-0 text-left">
          {selectedOption ? (
            <span className="truncate block">
              <span className="font-semibold text-slate-900 dark:text-white">
                {selectedOption.primary}
              </span>
              {selectedOption.secondary && (
                <span className="text-slate-500 dark:text-slate-400 ml-1.5 text-xs font-normal truncate">
                  — {selectedOption.secondary}
                </span>
              )}
            </span>
          ) : (
            <span className="text-slate-400 dark:text-slate-500 block truncate">
              {placeholder}
            </span>
          )}
        </span>
        <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
          {isLoading && !isOpen ? (
            <Loader2 className="h-4 w-4 text-slate-400 animate-spin" aria-hidden="true" />
          ) : (
            <ChevronsUpDown className="h-4 w-4 text-slate-400" aria-hidden="true" />
          )}
        </span>
      </button>

      {/* Render Dropdown in Portal to Prevent Any Modal/Table Overflow Clipping */}
      {isOpen &&
        createPortal(
          <div
            ref={dropdownRef}
            style={{
              position: 'fixed',
              left: `${dropdownPosition.left}px`,
              width: `${dropdownPosition.width}px`,
              top:
                dropdownPosition.top !== undefined
                  ? `${dropdownPosition.top}px`
                  : undefined,
              bottom:
                dropdownPosition.bottom !== undefined
                  ? `${dropdownPosition.bottom}px`
                  : undefined,
              maxHeight: `${dropdownPosition.maxHeight}px`,
              zIndex: 99999,
            }}
            className="flex flex-col rounded-xl bg-white dark:bg-[#121526] p-1.5 text-sm shadow-2xl ring-1 ring-slate-200 dark:ring-[#1e233d] border border-slate-200/90 dark:border-[#2a3052] focus:outline-none"
          >
            {/* Search Input Filter Header */}
            <div className="shrink-0 p-1 pb-2 border-b border-slate-100 dark:border-slate-800/80">
              <input
                type="text"
                ref={inputRef}
                className="block w-full min-h-[40px] rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50/70 dark:bg-[#0e111f] px-3 py-1.5 text-base sm:text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-2xs focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/40"
                placeholder={searchPlaceholder || 'Type to filter...'}
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setActiveIndex(0);
                }}
                onKeyDown={handleKeyDown}
              />
            </div>

            {/* Quick Create Action when typing an unlisted option */}
            {showCreateOption && (
              <div className="shrink-0 p-1 border-b border-slate-100 dark:border-slate-800 bg-blue-50/50 dark:bg-blue-950/30">
                <button
                  type="button"
                  onClick={() => {
                    onCreateOption?.(trimmedSearch);
                    setIsOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-blue-700 dark:text-blue-300 bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-850 hover:bg-blue-50 dark:hover:bg-blue-900/50 rounded-lg shadow-2xs transition-colors text-left cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span className="truncate">
                    {typeof createOptionLabel === 'function'
                      ? createOptionLabel(trimmedSearch)
                      : createOptionLabel
                        ? `${createOptionLabel} "${trimmedSearch}"`
                        : `Create "${trimmedSearch}"`}
                  </span>
                </button>
              </div>
            )}

            {/* Scrollable Options List */}
            <ul
              ref={listboxRef}
              role="listbox"
              className="mt-1 space-y-0.5 overflow-y-auto flex-1 min-h-[40px] pr-1"
            >
              {isLoading && (
                <li className="relative cursor-default select-none py-3 pl-3 pr-9 text-slate-500 dark:text-slate-400 flex items-center justify-center text-xs">
                  <Loader2 className="w-4 h-4 mr-2 animate-spin text-blue-600 dark:text-blue-400" />
                  Loading storage options...
                </li>
              )}

              {!isLoading && filteredOptions.length === 0 ? (
                <li className="relative cursor-default select-none py-4 text-center text-xs text-slate-500 dark:text-slate-400">
                  No matching options found
                </li>
              ) : (
                !isLoading &&
                filteredOptions.map((option, index) => {
                  const isSelected = value === option.id;
                  const isActive = activeIndex === index;
                  return (
                    <li
                      key={option.id}
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => {
                        onChange(option.id, option);
                        setIsOpen(false);
                      }}
                      onMouseEnter={() => setActiveIndex(index)}
                      className={cn(
                        'relative cursor-pointer select-none py-2 px-3 rounded-lg transition-colors text-sm',
                        isActive
                          ? 'bg-blue-600 text-white'
                          : isSelected
                            ? 'bg-blue-50 text-blue-900 dark:bg-blue-950/50 dark:text-blue-300 font-medium'
                            : 'text-slate-800 dark:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-slate-800/60'
                      )}
                    >
                      <div className="flex flex-col pr-6">
                        <span
                          className={cn(
                            'block truncate text-sm',
                            isSelected ? 'font-bold' : 'font-medium'
                          )}
                        >
                          {option.primary}
                        </span>
                        {option.secondary && (
                          <span
                            className={cn(
                              'block text-xs truncate mt-0.5',
                              isActive
                                ? 'text-blue-100'
                                : 'text-slate-500 dark:text-slate-400'
                            )}
                          >
                            {option.secondary}
                          </span>
                        )}
                      </div>

                      {isSelected && (
                        <span
                          className={cn(
                            'absolute inset-y-0 right-0 flex items-center pr-3',
                            isActive ? 'text-white' : 'text-blue-600 dark:text-blue-400'
                          )}
                        >
                          <Check className="h-4 w-4" aria-hidden="true" />
                        </span>
                      )}
                    </li>
                  );
                })
              )}
            </ul>

            {/* Persistent Bottom Action to Create or Type New */}
            {onCreateOption && (
              <div className="shrink-0 p-1 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-900/60">
                <button
                  type="button"
                  onClick={() => {
                    onCreateOption?.(trimmedSearch);
                    setIsOpen(false);
                  }}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 text-xs font-semibold text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/50 rounded-lg transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>
                    {typeof createOptionLabel === 'function'
                      ? createOptionLabel(trimmedSearch)
                      : createOptionLabel || 'Add New Option'}
                  </span>
                </button>
              </div>
            )}
          </div>,
          document.body
        )}
    </div>
  );
}
