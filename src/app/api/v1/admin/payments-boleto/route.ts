import { type NextRequest } from 'next/server'
import { getTenantPaymentBoleto } from '@/lib/tenant-payments-api'

// Compatibilidade: rota tenant legada. Preferir `/api/v1/payments/boleto`.
export function GET(request: NextRequest) {
  return getTenantPaymentBoleto(request)
}
