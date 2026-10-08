import { useEffect, useState, useCallback } from 'react';
import { SearchSelect } from '../ui/SearchSelect';
import { vendorMasterApi } from '../../services/vendorMaster.service';
import type { VendorMasterDto } from '../../types/vendor-master.dto';

interface VendorSelectProps {
  value?: string;
  onChange: (vendorId: string, vendor?: VendorMasterDto) => void;
  error?: boolean | string;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
}

export function VendorSelect({ value, onChange, error, className, disabled, placeholder = 'Select Vendor...' }: VendorSelectProps) {
  const [vendors, setVendors] = useState<VendorMasterDto[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchVendors = useCallback(async (searchTerm?: string) => {
    try {
      setIsLoading(true);
      const data = await vendorMasterApi.getAll({ isActive: true, search: searchTerm });
      setVendors(data);
    } catch (err) {
      console.error('Failed to fetch vendors', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVendors();
  }, [fetchVendors]);

  const options = vendors
    .slice()
    .sort((a, b) => {
      const numA = parseInt(a.code.replace(/\D/g, ''), 10);
      const numB = parseInt(b.code.replace(/\D/g, ''), 10);
      if (!isNaN(numA) && !isNaN(numB) && numA !== numB) {
        return numA - numB;
      }
      return a.code.localeCompare(b.code);
    })
    .map((v) => ({
      id: v.id,
      primary: `${v.code} – ${v.name}`,
      secondary: v.category || undefined,
      data: v,
    }));

  return (
    <SearchSelect
      value={value}
      onChange={(id) => {
        const vendor = vendors.find((v) => v.id === id);
        if (vendor) onChange(id, vendor);
      }}
      options={options}
      onSearch={fetchVendors}
      isLoading={isLoading}
      error={Boolean(error)}
      className={className}
      disabled={disabled}
      placeholder={placeholder}
    />
  );
}

