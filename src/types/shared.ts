/**
 * Tipos e Interfaces Compartilhadas para a Arquitetura 2.0 (CRUD & Componentes Padrão)
 */

import { ReactNode } from 'react';

export type SortDirection = 'asc' | 'desc';

export interface PaginationParams {
  page: number;
  perPage: number;
  totalItems: number;
  totalPages: number;
}

export interface SortParams {
  column: string;
  direction: SortDirection;
}

export interface FilterParams {
  search?: string;
  status?: string;
  [key: string]: any;
}

export interface TableColumn<T> {
  key: string;
  header: string;
  accessor?: (item: T) => ReactNode;
  sortable?: boolean;
  className?: string;
  headerClassName?: string;
}

export interface TableAction<T> {
  label: string;
  icon?: ReactNode;
  onClick: (item: T) => void;
  variant?: 'default' | 'danger' | 'warning' | 'info' | 'success';
  showCondition?: (item: T) => boolean;
}

export interface ApiResponse<T> {
  data: T;
  error?: string | null;
  message?: string;
  pagination?: PaginationParams;
}
