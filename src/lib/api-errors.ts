import { NextResponse } from 'next/server'

export type KnownApiErrorCode = 'UNAUTHORIZED' | 'NO_MINISTRY' | 'TRIAL_EXPIRED' | 'FORBIDDEN'

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error || '')
}

export function apiError(error: string, status: number, code?: string) {
  return NextResponse.json(code ? { error, code } : { error }, { status })
}

export function authTenantErrorResponse(error: unknown): NextResponse | null {
  const message = getErrorMessage(error)

  if (message === 'UNAUTHORIZED') {
    return apiError('Unauthorized', 401)
  }

  if (message === 'NO_MINISTRY') {
    return apiError('Usuario sem ministerio associado', 403, 'NO_MINISTRY')
  }

  if (message === 'TRIAL_EXPIRED') {
    return apiError('Expirado', 403, 'TRIAL_EXPIRED')
  }

  if (message === 'FORBIDDEN') {
    return apiError('Forbidden', 403)
  }

  return null
}

export function forbiddenResponse() {
  return apiError('Forbidden', 403)
}
