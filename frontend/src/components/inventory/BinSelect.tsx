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

  const options = bins.map((b) => ({
    id: b.id,
    primary: b.name,
    secondary: `${b.code}${b.rack?.name ? ` (Rack: ${b.rack.name})` : ''}`,
    data: b,
  }));

  return (
    <SearchSelect
      value={value}
      onChange={(id) => {
        const bin = bins.find((b) => b.id === id);
        if (bin) onChange(id, bin);
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
