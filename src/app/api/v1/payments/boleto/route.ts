import { type NextRequest } from 'next/server'
import { getTenantPaymentBoleto } from '@/lib/tenant-payments-api'

export function GET(request: NextRequest) {
  return getTenantPaymentBoleto(request)
}
