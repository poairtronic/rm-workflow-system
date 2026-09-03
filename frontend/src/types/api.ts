export interface ApiResponse<T> {
  data: T;
  message?: string;
  success: boolean;
}

export interface HealthCheckResponse {
  status: string;
  service: string;
  timestamp?: string;
  database?: string;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
