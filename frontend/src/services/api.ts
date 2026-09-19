import { APP_CONFIG } from '../app/config';

class ApiClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = APP_CONFIG.apiBaseUrl;
  }

  private getHeaders(): HeadersInit {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    const token = localStorage.getItem('rm_access_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  async get<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'GET',
      headers: this.getHeaders(),
    });
    if (!response.ok) {
      let errorMsg = `GET ${endpoint} failed: ${response.status} ${response.statusText}`;
      try {
        const errorJson = await response.json();
        if (errorJson?.message) {
          errorMsg = Array.isArray(errorJson.message)
            ? errorJson.message.join(', ')
            : errorJson.message;
        }
      } catch {}
      throw new Error(errorMsg);
    }
    return response.json();
  }

  async post<T>(endpoint: string, body?: any): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) {
      let errorMsg = `POST ${endpoint} failed: ${response.status} ${response.statusText}`;
      try {
        const errorJson = await response.json();
        if (errorJson?.message) {
          errorMsg = Array.isArray(errorJson.message)
            ? errorJson.message.join(', ')
            : errorJson.message;
        }
      } catch {}
      throw new Error(errorMsg);
    }
    return response.json();
  }

  async patch<T>(endpoint: string, body?: any): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) {
      let errorMsg = `PATCH ${endpoint} failed: ${response.status} ${response.statusText}`;
      try {
        const errorJson = await response.json();
        if (errorJson?.message) {
          errorMsg = Array.isArray(errorJson.message)
            ? errorJson.message.join(', ')
            : errorJson.message;
        }
      } catch {}
      throw new Error(errorMsg);
    }
    return response.json();
  }

  async delete<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    if (!response.ok) {
      let errorMsg = `DELETE ${endpoint} failed: ${response.status} ${response.statusText}`;
      try {
        const errorJson = await response.json();
        if (errorJson?.message) {
          errorMsg = Array.isArray(errorJson.message)
            ? errorJson.message.join(', ')
            : errorJson.message;
        }
      } catch {}
      throw new Error(errorMsg);
    }
    return response.json();
  }
}

export const api = new ApiClient();
