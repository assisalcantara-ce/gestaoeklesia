import type { NextRequest } from 'next/server'
import { createHash } from 'crypto'

export function getClientIp(request: NextRequest): string {
  const xff = request.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0]?.trim() || 'unknown'
  const xri = request.headers.get('x-real-ip')
  if (xri) return xri.trim()
  return 'unknown'
}

export function getUserAgent(request: NextRequest): string | null {
  return request.headers.get('user-agent')
}

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}
