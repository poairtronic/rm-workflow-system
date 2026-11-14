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
  initialProduct?: { id: string; name: string; code?: string };
}

export function ProductSelect({ value, onChange, error, className, disabled, placeholder = 'Select Product...', initialProduct }: ProductSelectProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | { id: string; name: string; code?: string } | undefined>(initialProduct);
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

  useEffect(() => {
    if (!value) {
      setSelectedProduct(undefined);
      return;
    }
    const found = products.find((p) => p.id === value);
    if (found) {
      setSelectedProduct(found);
    } else if (!selectedProduct || selectedProduct.id !== value) {
      masterDataService
        .getProductById(value)
        .then((p) => {
          if (p) setSelectedProduct(p);
        })
        .catch(() => {});
    }
  }, [value, products, selectedProduct]);

  const options = products.map((p) => ({
    id: p.id,
    primary: p.name,
    secondary: p.code,
    data: p,
  }));

  const activeProduct =
    selectedProduct?.id === value
      ? selectedProduct
      : initialProduct?.id === value
        ? initialProduct
        : undefined;

  if (activeProduct && !options.some((o) => o.id === activeProduct.id)) {
    options.unshift({
      id: activeProduct.id,
      primary: activeProduct.name,
      secondary: activeProduct.code,
      data: activeProduct as any,
    });
  }

  return (
    <SearchSelect
      value={value}
      onChange={(id, opt) => {
        const product =
          (opt as any)?.data ||
          products.find((p) => p.id === id) ||
          (selectedProduct?.id === id ? (selectedProduct as Product) : undefined);
        if (product) {
          setSelectedProduct(product);
          onChange(id, product);
        } else {
          onChange(id);
        }
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
