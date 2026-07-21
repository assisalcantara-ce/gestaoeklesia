export type LifecycleStatus =
  | 'LEAD'
  | 'TRIAL'
  | 'TRIAL_EXPIRING'
  | 'TRIAL_EXPIRED'
  | 'NEGOTIATION'
  | 'PAYMENT_PENDING'
  | 'ACTIVE'
  | 'RENEWAL'
  | 'CANCELED';

export interface LifecyclePreRegistrationData {
  id: string;
  status: 'trial' | 'pendente' | 'efetivado' | 'encerrado' | string;
  trial_expires_at: string | null;
  trial_days: number | null;
  asaas_payment_id: string | null;
}

export interface MinistryData {
  id: string;
  is_active: boolean;
  subscription_status: 'trial' | 'active' | 'overdue' | 'cancelled' | 'expired' | string;
  subscription_end_date: string | null;
  subscription_start_date: string | null;
  user_id: string | null;
}

export interface BillingInvoiceData {
  id: string;
  status: 'pending' | 'paid' | 'overdue' | 'cancelled' | string;
  due_date: string;
  amount: number;
}

export interface OpportunityData {
  id: string;
  status: 'Novo' | 'Em Atendimento' | 'Aguardando Pagamento' | 'Convertido' | string;
}

export interface LifecycleCalculatorInput {
  preRegistration?: LifecyclePreRegistrationData | null;

  ministry?: MinistryData | null;
  billingInvoices?: BillingInvoiceData[] | null;
  opportunity?: OpportunityData | null;
}

export interface LifecycleResult {
  status: LifecycleStatus;
  calculatedAt: string;
  daysRemaining?: number;
  reason: string;
}
