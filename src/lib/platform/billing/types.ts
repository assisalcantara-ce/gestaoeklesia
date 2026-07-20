export interface Invoice {
  id: string
  ministry_id: string
  plano_slug: string
  subscription_plan_id: string
  amount: number
  status: 'pending' | 'paid' | 'overdue' | 'canceled'
  asaas_payment_id: string | null
  asaas_invoice_url: string | null
  period_start: string
  period_end: string
  due_date: string
  created_at: string
}

export interface CreateInvoiceInput {
  ministry_id: string
  plano_slug: string
  amount: number
  validity_months?: number
}
