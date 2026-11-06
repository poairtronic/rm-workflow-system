import { useEffect, useState, useCallback } from 'react';
import { SearchSelect } from '../ui/SearchSelect';
import { masterDataService, type Bin } from '../../services/masterDataService';

interface BinSelectProps {
  value?: string;
  onChange: (binId: string, bin?: Bin) => void;
  error?: boolean | string;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
  rackId?: string; // Optional filter by rack
}

export function BinSelect({ value, onChange, error, className, disabled, placeholder = 'Select Bin...', rackId }: BinSelectProps) {
  const [bins, setBins] = useState<Bin[]>([]);
  const [selectedBin, setSelectedBin] = useState<Bin | undefined>();
  const [isLoading, setIsLoading] = useState(false);

  const fetchBins = useCallback(async (searchTerm?: string) => {
    try {
      setIsLoading(true);
      const response = await masterDataService.getBins({ isActive: true, search: searchTerm, parentId: rackId, pageSize: 50 });
      setBins(response.data);
    } catch (err) {
      console.error('Failed to fetch bins', err);
    } finally {
      setIsLoading(false);
    }
  }, [rackId]);

  useEffect(() => {
    fetchBins();
  }, [fetchBins]);

  useEffect(() => {
    if (!value) {
      setSelectedBin(undefined);
      return;
    }
    const found = bins.find((b) => b.id === value);
    if (found) {
      setSelectedBin(found);
    } else if (!selectedBin || selectedBin.id !== value) {
      masterDataService
        .getBinById(value)
        .then((b) => {
          if (b) setSelectedBin(b);
        })
        .catch(() => {});
    }
  }, [value, bins]);

  const options = bins.map((b) => ({
    id: b.id,
    primary: b.name,
    secondary: `${b.code}${b.rack?.name ? ` (Rack: ${b.rack.name})` : ''}`,
    data: b,
  }));

  if (selectedBin && selectedBin.id === value && !options.some((o) => o.id === selectedBin.id)) {
    options.unshift({
      id: selectedBin.id,
      primary: selectedBin.name,
      secondary: `${selectedBin.code}${selectedBin.rack?.name ? ` (Rack: ${selectedBin.rack.name})` : ''}`,
      data: selectedBin,
    });
  }

  return (
    <SearchSelect
      value={value}
      onChange={(id, opt) => {
        const bin =
          (opt as any)?.data ||
          bins.find((b) => b.id === id) ||
          (selectedBin?.id === id ? selectedBin : undefined);
        if (bin) {
          setSelectedBin(bin);
          onChange(id, bin);
        } else {
          onChange(id);
        }
      }}
      options={options}
      onSearch={fetchBins}
      isLoading={isLoading}
      error={Boolean(error)}
      className={className}
      disabled={disabled}
      placeholder={placeholder}
    />
  );
}
