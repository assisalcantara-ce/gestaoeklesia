import { type NextRequest } from 'next/server'
import { listTenantPayments } from '@/lib/tenant-payments-api'

// Compatibilidade: rota tenant legada. Preferir `/api/v1/payments`.
export function GET(request: NextRequest) {
  return listTenantPayments(request)
}
