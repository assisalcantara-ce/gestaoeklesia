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

export interface GenerateInvoiceInput {
  /** ID do ministério para o qual a cobrança está sendo gerada */
  ministry: {
    id: string
    name: string
    cnpj_cpf: string | null
    phone: string | null
    email_admin: string | null
    asaas_customer_id: string | null
  }
  /** Dados do plano comercial */
  plan: {
    id: string
    slug: string
    name: string
    price_monthly: number
  }
  /** Meses de vigência (padrão: 12) */
  validityMonths: number
  /** Dias até o vencimento da cobrança (padrão: 7) */
  dueDays?: number
  /** Referência externa para rastreamento no gateway (ex: id da oportunidade) */
  externalReference?: string
  /** Se deve persistir a fatura localmente em platform_billing_invoices (padrão: true) */
  persistLocal?: boolean
  /** Valor customizado para substituir o valor padrão do plano */
  customAmount?: number
  /** Vencimento customizado (formato YYYY-MM-DD) para substituir o padrão */
  customDueDate?: string
  /** Descrição customizada da cobrança para o Asaas */
  customDescription?: string
}

export interface GenerateInvoiceResult {
  success: boolean
  /** ID local da fatura criada em platform_billing_invoices (nulo se persistLocal=false) */
  invoiceId: string | null
  /** ID da cobrança criada no gateway Asaas */
  asaasPaymentId: string
  /** URL da fatura para visualização do cliente */
  invoiceUrl: string | null
  /** URL do boleto bancário */
  bankSlipUrl: string | null
  /** Data de vencimento calculada (YYYY-MM-DD) */
  dueDate: string
}
