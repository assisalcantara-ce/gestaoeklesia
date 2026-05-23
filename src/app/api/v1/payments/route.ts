import { type NextRequest } from 'next/server'
import { listTenantPayments } from '@/lib/tenant-payments-api'

export function GET(request: NextRequest) {
  return listTenantPayments(request)
}
