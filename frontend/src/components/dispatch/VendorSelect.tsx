import React, { useEffect, useState, useCallback } from 'react';
import { SearchSelect } from '../ui/SearchSelect';
import { vendorMasterApi } from '../../services/vendorMaster.service';
import { VendorMasterDto } from '../../types/vendor-master.dto';

interface VendorSelectProps {
  value?: string;
  onChange: (vendorId: string, vendor?: VendorMasterDto) => void;
  error?: boolean;
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

  const options = vendors.map((v) => ({
    id: v.id,
    primary: v.name,
    secondary: v.code,
    data: v,
  }));

  return (
    <SearchSelect
      value={value}
      onChange={(id, option) => {
        const vendor = vendors.find((v) => v.id === id);
        if (vendor) onChange(id, vendor);
      }}
      options={options}
      onSearch={fetchVendors}
      isLoading={isLoading}
      error={error}
      className={className}
      disabled={disabled}
      placeholder={placeholder}
    />
  );
}
