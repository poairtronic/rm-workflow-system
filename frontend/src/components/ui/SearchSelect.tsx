import React, { useState, useEffect, useRef } from 'react';
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react';
import { cn } from '../../utils/cn';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';

export interface SearchSelectOption {
  id: string;
  primary: string;
  secondary?: string;
}

interface SearchSelectProps {
  value?: string;
  onChange: (id: string, option?: SearchSelectOption) => void;
  options: SearchSelectOption[];
  onSearch?: (term: string) => void;
  isLoading?: boolean;
  placeholder?: string;
  error?: boolean;
  className?: string;
  disabled?: boolean;
}

export function SearchSelect({
  value,
  onChange,
  options,
  onSearch,
  isLoading = false,
  placeholder = 'Select an option...',
  error = false,
  className,
  disabled = false,
}: SearchSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebouncedValue(searchTerm, 300);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxRef = useRef<HTMLUListElement>(null);

  const [activeIndex, setActiveIndex] = useState(-1);

  // Inform parent of search changes if async
  useEffect(() => {
    if (onSearch) {
      onSearch(debouncedSearch);
    }
  }, [debouncedSearch, onSearch]);

  // Handle outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter options if not async
  const filteredOptions = onSearch 
    ? options 
    : options.filter(opt => 
        (opt.primary || "").toLowerCase().includes(debouncedSearch.toLowerCase()) || 
        (opt.secondary && opt.secondary.toLowerCase().includes(debouncedSearch.toLowerCase()))
      );

  const selectedOption = options.find(opt => opt.id === value);

  // Update input text when selection changes or menu closes
  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
      setActiveIndex(-1);
    } else {
      inputRef.current?.focus();
    }
  }, [isOpen, selectedOption]);

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
        setActiveIndex(prev => (prev < filteredOptions.length - 1 ? prev + 1 : prev));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex(prev => (prev > 0 ? prev - 1 : prev));
        break;
      case 'Enter':
        e.preventDefault();
        if (activeIndex >= 0 && activeIndex < filteredOptions.length) {
          const opt = filteredOptions[activeIndex];
          onChange(opt.id, opt);
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
    <div className={cn("relative", className)} ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        className={cn(
          "relative w-full cursor-default rounded-md border bg-white py-2 pl-3 pr-10 text-left shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary sm:text-sm",
          error ? "border-red-300 focus:border-red-500 focus:ring-red-500" : "border-gray-300",
          disabled ? "bg-gray-50 text-gray-500 cursor-not-allowed" : "cursor-pointer"
        )}
      >
        <span className="block truncate">
          {selectedOption ? (
            <span>
              {selectedOption.primary}
              {selectedOption.secondary && (
                <span className="text-gray-500 ml-2 text-xs">— {selectedOption.secondary}</span>
              )}
            </span>
          ) : (
            <span className="text-gray-400">{placeholder}</span>
          )}
        </span>
        <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
          {isLoading && !isOpen ? (
            <Loader2 className="h-4 w-4 text-gray-400 animate-spin" aria-hidden="true" />
          ) : (
            <ChevronsUpDown className="h-4 w-4 text-gray-400" aria-hidden="true" />
          )}
        </span>
      </button>

      {isOpen && (
        <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
          <div className="sticky top-0 z-20 bg-white px-2 pb-2">
            <input
              type="text"
              ref={inputRef}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm py-1.5 px-3 border text-gray-900"
              placeholder="Type to filter..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={handleKeyDown}
            />
          </div>
          
          <ul ref={listboxRef} role="listbox" className="mt-1">
            {isLoading && (
              <li className="relative cursor-default select-none py-2 pl-3 pr-9 text-gray-500 flex items-center justify-center">
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Loading...
              </li>
            )}
            
            {!isLoading && filteredOptions.length === 0 ? (
              <li className="relative cursor-default select-none py-2 pl-3 pr-9 text-gray-500">
                No results found
              </li>
            ) : (
              !isLoading && filteredOptions.map((option, index) => {
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
                      "relative cursor-pointer select-none py-2 pl-3 pr-9",
                      isActive ? "bg-primary text-white" : "text-gray-900"
                    )}
                  >
                    <div className="flex flex-col">
                      <span className={cn("block truncate", isSelected ? "font-semibold" : "font-normal")}>
                        {option.primary}
                      </span>
                      {option.secondary && (
                        <span className={cn("block text-xs truncate", isActive ? "text-primary-100" : "text-gray-500")}>
                          {option.secondary}
                        </span>
                      )}
                    </div>

                    {isSelected && (
                      <span
                        className={cn(
                          "absolute inset-y-0 right-0 flex items-center pr-4",
                          isActive ? "text-white" : "text-primary"
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
        </div>
      )}
    </div>
  );
}
