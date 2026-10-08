import { useEffect, useState, useCallback } from 'react';
import { SearchSelect } from '../ui/SearchSelect';
import { masterDataService, type Product } from '../../services/masterDataService';

interface ProductSelectProps {
  value?: string;
  onChange: (productId: string, product?: Product) => void;
  error?: boolean | string;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
}

export function ProductSelect({ value, onChange, error, className, disabled, placeholder = 'Select Product...' }: ProductSelectProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchProducts = useCallback(async (searchTerm?: string) => {
    try {
      setIsLoading(true);
      const response = await masterDataService.getProducts({ isActive: true, search: searchTerm, pageSize: 50 });
      setProducts(response.data);
    } catch (err) {
      console.error('Failed to fetch products', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const options = products.map((p) => ({
    id: p.id,
    primary: p.name,
    secondary: p.code,
    data: p,
  }));

  return (
    <SearchSelect
      value={value}
      onChange={(id) => {
        const product = products.find((p) => p.id === id);
        if (product) onChange(id, product);
      }}
      options={options}
      onSearch={fetchProducts}
      isLoading={isLoading}
      error={Boolean(error)}
      className={className}
      disabled={disabled}
      placeholder={placeholder}
    />
  );
}
