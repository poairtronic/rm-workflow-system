import { api } from './api';

export interface Category {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Family {
  id: string;
  categoryId: string;
  category?: Category;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  familyId: string;
  family?: Family;
  name: string;
  minimumInventory: number;
  maximumInventory?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Warehouse {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Location {
  id: string;
  warehouseId: string;
  warehouse?: Warehouse;
  code: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Rack {
  id: string;
  locationId: string;
  location?: Location;
  code: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Bin {
  id: string;
  rackId: string;
  rack?: Rack;
  code: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface MasterFilterParams {
  search?: string;
  isActive?: boolean;
  parentId?: string;
  page?: number;
  pageSize?: number;
}

function buildQuery(params?: MasterFilterParams): string {
  if (!params) return '';
  const q = new URLSearchParams();
  if (params.search) q.append('search', params.search);
  if (params.isActive !== undefined) q.append('isActive', String(params.isActive));
  if (params.parentId) q.append('parentId', params.parentId);
  if (params.page) q.append('page', String(params.page));
  if (params.pageSize) q.append('pageSize', String(params.pageSize));
  const queryString = q.toString();
  return queryString ? `?${queryString}` : '';
}

export const masterDataService = {
  // Categories
  getCategories: async (params?: MasterFilterParams): Promise<PaginatedResponse<Category>> => {
    return api.get<PaginatedResponse<Category>>(`/categories${buildQuery(params)}`);
  },
  getCategoryById: async (id: string): Promise<Category> => {
    return api.get<Category>(`/categories/${id}`);
  },
  createCategory: async (data: { name: string; isActive?: boolean }): Promise<Category> => {
    return api.post<Category>('/categories', data);
  },
  updateCategory: async (id: string, data: { name?: string; isActive?: boolean }): Promise<Category> => {
    return api.patch<Category>(`/categories/${id}`, data);
  },
  deleteCategory: async (id: string): Promise<{ success: boolean; message: string }> => {
    return api.delete<{ success: boolean; message: string }>(`/categories/${id}`);
  },

  // Families
  getFamilies: async (params?: MasterFilterParams): Promise<PaginatedResponse<Family>> => {
    return api.get<PaginatedResponse<Family>>(`/families${buildQuery(params)}`);
  },
  getFamilyById: async (id: string): Promise<Family> => {
    return api.get<Family>(`/families/${id}`);
  },
  createFamily: async (data: { categoryId: string; name: string; isActive?: boolean }): Promise<Family> => {
    return api.post<Family>('/families', data);
  },
  updateFamily: async (id: string, data: { categoryId?: string; name?: string; isActive?: boolean }): Promise<Family> => {
    return api.patch<Family>(`/families/${id}`, data);
  },
  deleteFamily: async (id: string): Promise<{ success: boolean; message: string }> => {
    return api.delete<{ success: boolean; message: string }>(`/families/${id}`);
  },

  // Products
  getProducts: async (params?: MasterFilterParams): Promise<PaginatedResponse<Product>> => {
    return api.get<PaginatedResponse<Product>>(`/products${buildQuery(params)}`);
  },
  getProductById: async (id: string): Promise<Product> => {
    return api.get<Product>(`/products/${id}`);
  },
  createProduct: async (data: {
    familyId: string;
    name: string;
    minimumInventory?: number;
    maximumInventory?: number;
    isActive?: boolean;
  }): Promise<Product> => {
    return api.post<Product>('/products', data);
  },
  updateProduct: async (
    id: string,
    data: {
      familyId?: string;
      name?: string;
      minimumInventory?: number;
      maximumInventory?: number;
      isActive?: boolean;
    },
  ): Promise<Product> => {
    return api.patch<Product>(`/products/${id}`, data);
  },

  // Warehouses
  getWarehouses: async (params?: MasterFilterParams): Promise<PaginatedResponse<Warehouse>> => {
    return api.get<PaginatedResponse<Warehouse>>(`/warehouses${buildQuery(params)}`);
  },
  createWarehouse: async (data: { code: string; name: string; isActive?: boolean }): Promise<Warehouse> => {
    return api.post<Warehouse>('/warehouses', data);
  },
  updateWarehouse: async (id: string, data: { code?: string; name?: string; isActive?: boolean }): Promise<Warehouse> => {
    return api.patch<Warehouse>(`/warehouses/${id}`, data);
  },

  // Locations
  getLocations: async (params?: MasterFilterParams): Promise<PaginatedResponse<Location>> => {
    return api.get<PaginatedResponse<Location>>(`/locations${buildQuery(params)}`);
  },
  createLocation: async (data: { warehouseId: string; code: string; name: string; isActive?: boolean }): Promise<Location> => {
    return api.post<Location>('/locations', data);
  },
  updateLocation: async (id: string, data: { warehouseId?: string; code?: string; name?: string; isActive?: boolean }): Promise<Location> => {
    return api.patch<Location>(`/locations/${id}`, data);
  },

  // Racks
  getRacks: async (params?: MasterFilterParams): Promise<PaginatedResponse<Rack>> => {
    return api.get<PaginatedResponse<Rack>>(`/racks${buildQuery(params)}`);
  },
  createRack: async (data: { locationId: string; code: string; name: string; isActive?: boolean }): Promise<Rack> => {
    return api.post<Rack>('/racks', data);
  },
  updateRack: async (id: string, data: { locationId?: string; code?: string; name?: string; isActive?: boolean }): Promise<Rack> => {
    return api.patch<Rack>(`/racks/${id}`, data);
  },

  // Bins
  getBins: async (params?: MasterFilterParams): Promise<PaginatedResponse<Bin>> => {
    return api.get<PaginatedResponse<Bin>>(`/bins${buildQuery(params)}`);
  },
  createBin: async (data: { rackId: string; code: string; name: string; isActive?: boolean }): Promise<Bin> => {
    return api.post<Bin>('/bins', data);
  },
  updateBin: async (id: string, data: { rackId?: string; code?: string; name?: string; isActive?: boolean }): Promise<Bin> => {
    return api.patch<Bin>(`/bins/${id}`, data);
  },
};
