import { Invoice, CreateInvoiceInput } from './types'

export class BillingService {
  async getInvoiceByPaymentId(_asaasPaymentId: string): Promise<Invoice | null> {
    // Esqueleto para obter fatura no futuro
    return null
  }

  async generateAsaasInvoice(_input: CreateInvoiceInput): Promise<Invoice | null> {
    // Esqueleto para geração de faturas Asaas no futuro
    return null
  }

}
