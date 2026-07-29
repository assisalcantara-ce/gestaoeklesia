/**
 * BaseService — Camada Base para Comunicação HTTP com Autenticação Nativa Supabase
 */

import { authenticatedFetch } from '@/lib/api-client';
import { ApiResponse } from '@/types/shared';

export abstract class BaseService {
  protected static async get<T>(url: string): Promise<ApiResponse<T>> {
    try {
      const response = await authenticatedFetch(url, { method: 'GET' });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return { data: null as any, error: errorData.error || `Erro HTTP ${response.status}` };
      }
      const data = await response.json();
      return { data: data.data !== undefined ? data.data : data };
    } catch (err: any) {
      return { data: null as any, error: err?.message || 'Erro de conexão com o servidor.' };
    }
  }

  protected static async post<T>(url: string, body: any): Promise<ApiResponse<T>> {
    try {
      const response = await authenticatedFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return { data: null as any, error: errorData.error || `Erro HTTP ${response.status}` };
      }
      const data = await response.json();
      return { data: data.data !== undefined ? data.data : data };
    } catch (err: any) {
      return { data: null as any, error: err?.message || 'Erro de conexão com o servidor.' };
    }
  }

  protected static async put<T>(url: string, body: any): Promise<ApiResponse<T>> {
    try {
      const response = await authenticatedFetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return { data: null as any, error: errorData.error || `Erro HTTP ${response.status}` };
      }
      const data = await response.json();
      return { data: data.data !== undefined ? data.data : data };
    } catch (err: any) {
      return { data: null as any, error: err?.message || 'Erro de conexão com o servidor.' };
    }
  }

  protected static async delete<T>(url: string): Promise<ApiResponse<T>> {
    try {
      const response = await authenticatedFetch(url, { method: 'DELETE' });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return { data: null as any, error: errorData.error || `Erro HTTP ${response.status}` };
      }
      const data = await response.json();
      return { data: data.data !== undefined ? data.data : data };
    } catch (err: any) {
      return { data: null as any, error: err?.message || 'Erro de conexão com o servidor.' };
    }
  }
}
