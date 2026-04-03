/**
 * Types para Admin Panel
 */

// ============================================
// PLANOS DE ASSINATURA
// ============================================

export interface SubscriptionPlan {
  id: string;
  name: string;
  slug: string;
  description?: string;
  price_monthly: number;
  price_annually?: number;
  setup_fee?: number;
  max_users: number;
  max_storage_bytes: number;
  max_members: number;
  max_ministerios: number;
  max_divisao1: number;
  max_divisao2: number;
  max_divisao3: number;
  has_api_access: boolean;
  has_custom_domain: boolean;
  has_advanced_reports: boolean;
  has_priority_support: boolean;
  has_white_label: boolean;
  has_automation: boolean;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

// ============================================
// PAGAMENTOS
// ============================================

export interface Payment {
  id: string;
  ministry_id: string;
  asaas_payment_id?: string;
  subscription_plan_id?: string;
  amount: number;
  description?: string;
  due_date: string;
  status: 'pending' | 'paid' | 'overdue' | 'cancelled' | 'failed';
  payment_method?: 'credit_card' | 'bank_transfer' | 'pix' | 'boleto';
  payment_date?: string;
  period_start?: string;
  period_end?: string;
  asaas_response?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

// ============================================
// SUPORTE/TICKETS
// ============================================

export interface SupportTicket {
  id: string;
  ministry_id: string;
  user_id?: string;
  ticket_number: string;
  subject: string;
  description: string;
  category: 'bug' | 'feature_request' | 'billing' | 'technical' | 'general';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'waiting_customer' | 'resolved' | 'closed';
  resolution_notes?: string;
  resolved_at?: string;
  sla_minutes?: number;
  response_at?: string;
  last_message_user_id?: string | null;
  last_message_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SupportTicketMessage {
  id: string;
  ticket_id: string;
  user_id: string;
  message: string;
  is_internal: boolean;
  attachments?: any[];
  created_at: string;
  updated_at: string;
}

// ============================================
// USUÁRIOS ADMIN
// ============================================

export interface AdminUser {
  id: string;
  user_id: string;
  name: string;
  email: string;
  role: 'admin' | 'support' | 'accounting' | 'viewer';
  can_manage_ministries: boolean;
  can_manage_payments: boolean;
  can_manage_plans: boolean;
  can_manage_support: boolean;
  can_view_analytics: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================
// AUDITORIA
// ============================================

export interface AdminAuditLog {
  id: string;
  admin_user_id?: string;
  action: string;
  entity_type?: string;
  entity_id?: string;
  changes?: Record<string, any>;
  status?: string;
  error_message?: string;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

// ============================================
// MINISTÉRIO (Extended para Admin)
// ============================================

export interface MinistryAdmin {
  id: string;
  user_id: string;
  name: string;
  slug: string;
  email_admin: string;
  cnpj_cpf?: string;
  phone?: string;
  website?: string;
  logo_url?: string;
  description?: string;
  plan: string;
  subscription_status: 'active' | 'inactive' | 'cancelled' | 'overdue';
  subscription_start_date: string;
  subscription_end_date?: string;
  auto_renew: boolean;
  max_users: number;
  max_storage_bytes: number;
  storage_used_bytes: number;
  timezone: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================
// DASHBOARD METRICS
// ============================================

export interface DashboardMetrics {
  total_ministries: number;
  active_ministries: number;
  total_revenue_month: number;
  pending_payments: number;
  total_open_tickets: number;
  tickets_overdue_sla: number;
  storage_usage_percent: number;
  user_growth_percent: number;
  tickets_by_month: Array<{ month: string; value: number }>;
  deployments_by_month: Array<{ month: string; implantacoes: number; cancelamentos: number }>;
  ticket_stats: {
    received: number;
    resolved: number;
    waiting: number;
    high_priority: number;
  };
}

// ============================================
// API RESPONSES
// ============================================

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  status: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  count: number;
  page: number;
  limit: number;
  total_pages: number;
}
