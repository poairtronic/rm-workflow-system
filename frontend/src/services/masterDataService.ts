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
  code?: string;
  name: string;
  familyId: string;
  family?: Family;
  uom?: string;
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
  if (params.pageSize) {
    // Clamp pageSize to 1000 to match backend master filter DTO limit
    const safePageSize = Math.min(Math.max(1, params.pageSize), 1000);
    q.append('pageSize', String(safePageSize));
  }
  const queryString = q.toString();
  return queryString ? `?${queryString}` : '';
}

export const masterDataService = {
  // Categories
  getCategories: async (params?: MasterFilterParams): Promise<PaginatedResponse<Category>> => {
    return api.get<PaginatedResponse<Category>>(`/api/categories${buildQuery(params)}`);
  },
  getCategoryById: async (id: string): Promise<Category> => {
    return api.get<Category>(`/api/categories/${id}`);
  },
  createCategory: async (data: { name: string; isActive?: boolean }): Promise<Category> => {
    return api.post<Category>('/api/categories', data);
  },
  updateCategory: async (id: string, data: { name?: string; isActive?: boolean }): Promise<Category> => {
    return api.patch<Category>(`/api/categories/${id}`, data);
  },
  deleteCategory: async (id: string): Promise<{ success: boolean; message: string }> => {
    return api.delete<{ success: boolean; message: string }>(`/api/categories/${id}`);
  },

  // Families
  getFamilies: async (params?: MasterFilterParams): Promise<PaginatedResponse<Family>> => {
    return api.get<PaginatedResponse<Family>>(`/api/families${buildQuery(params)}`);
  },
  getFamilyById: async (id: string): Promise<Family> => {
    return api.get<Family>(`/api/families/${id}`);
  },
  createFamily: async (data: { categoryId: string; name: string; isActive?: boolean }): Promise<Family> => {
    return api.post<Family>('/api/families', data);
  },
  updateFamily: async (id: string, data: { categoryId?: string; name?: string; isActive?: boolean }): Promise<Family> => {
    return api.patch<Family>(`/api/families/${id}`, data);
  },
  deleteFamily: async (id: string): Promise<{ success: boolean; message: string }> => {
    return api.delete<{ success: boolean; message: string }>(`/api/families/${id}`);
  },

  // Products
  getProducts: async (params?: MasterFilterParams): Promise<PaginatedResponse<Product>> => {
    return api.get<PaginatedResponse<Product>>(`/api/products${buildQuery(params)}`);
  },
  getProductById: async (id: string): Promise<Product> => {
    return api.get<Product>(`/api/products/${id}`);
  },
  createProduct: async (data: {
    code: string;
    name: string;
    familyId?: string;
    categoryId?: string;
    categoryName?: string;
    familyName?: string;
    uom?: string;
    minimumInventory?: number;
    maximumInventory?: number;
    isActive?: boolean;
  }): Promise<Product> => {
    return api.post<Product>('/api/products', data);
  },
  updateProduct: async (
    id: string,
    data: {
      code?: string;
      name?: string;
      familyId?: string;
      categoryId?: string;
      categoryName?: string;
      familyName?: string;
      uom?: string;
      minimumInventory?: number;
      maximumInventory?: number;
      isActive?: boolean;
    },
  ): Promise<Product> => {
    return api.patch<Product>(`/api/products/${id}`, data);
  },

  // Warehouses
  getWarehouses: async (params?: MasterFilterParams): Promise<PaginatedResponse<Warehouse>> => {
    return api.get<PaginatedResponse<Warehouse>>(`/api/warehouses${buildQuery(params)}`);
  },
  getWarehouseById: async (id: string): Promise<Warehouse> => {
    return api.get<Warehouse>(`/api/warehouses/${id}`);
  },
  createWarehouse: async (data: { code: string; name: string; isActive?: boolean }): Promise<Warehouse> => {
    return api.post<Warehouse>('/api/warehouses', data);
  },
  updateWarehouse: async (id: string, data: { code?: string; name?: string; isActive?: boolean }): Promise<Warehouse> => {
    return api.patch<Warehouse>(`/api/warehouses/${id}`, data);
  },
  deleteWarehouse: async (id: string): Promise<{ success: boolean; message: string }> => {
    return api.delete<{ success: boolean; message: string }>(`/api/warehouses/${id}`);
  },

  // Locations
  getLocations: async (params?: MasterFilterParams): Promise<PaginatedResponse<Location>> => {
    return api.get<PaginatedResponse<Location>>(`/api/locations${buildQuery(params)}`);
  },
  getLocationById: async (id: string): Promise<Location> => {
    return api.get<Location>(`/api/locations/${id}`);
  },
  createLocation: async (data: { warehouseId: string; code: string; name: string; isActive?: boolean }): Promise<Location> => {
    return api.post<Location>('/api/locations', data);
  },
  updateLocation: async (id: string, data: { warehouseId?: string; code?: string; name?: string; isActive?: boolean }): Promise<Location> => {
    return api.patch<Location>(`/api/locations/${id}`, data);
  },
  deleteLocation: async (id: string): Promise<{ success: boolean; message: string }> => {
    return api.delete<{ success: boolean; message: string }>(`/api/locations/${id}`);
  },

  // Racks
  getRacks: async (params?: MasterFilterParams): Promise<PaginatedResponse<Rack>> => {
    return api.get<PaginatedResponse<Rack>>(`/api/racks${buildQuery(params)}`);
  },
  getRackById: async (id: string): Promise<Rack> => {
    return api.get<Rack>(`/api/racks/${id}`);
  },
  createRack: async (data: { locationId: string; code: string; name: string; isActive?: boolean }): Promise<Rack> => {
    return api.post<Rack>('/api/racks', data);
  },
  updateRack: async (id: string, data: { locationId?: string; code?: string; name?: string; isActive?: boolean }): Promise<Rack> => {
    return api.patch<Rack>(`/api/racks/${id}`, data);
  },
  deleteRack: async (id: string): Promise<{ success: boolean; message: string }> => {
    return api.delete<{ success: boolean; message: string }>(`/api/racks/${id}`);
  },

  // Bins
  getBins: async (params?: MasterFilterParams): Promise<PaginatedResponse<Bin>> => {
    return api.get<PaginatedResponse<Bin>>(`/api/bins${buildQuery(params)}`);
  },
  getBinById: async (id: string): Promise<Bin> => {
    return api.get<Bin>(`/api/bins/${id}`);
  },
  createBin: async (data: { rackId: string; code: string; name: string; isActive?: boolean }): Promise<Bin> => {
    return api.post<Bin>('/api/bins', data);
  },
  updateBin: async (id: string, data: { rackId?: string; code?: string; name?: string; isActive?: boolean }): Promise<Bin> => {
    return api.patch<Bin>(`/api/bins/${id}`, data);
  },
  deleteBin: async (id: string): Promise<{ success: boolean; message: string }> => {
    return api.delete<{ success: boolean; message: string }>(`/api/bins/${id}`);
  },
};
