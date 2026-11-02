import crypto from 'node:crypto'

export interface M2MAuthHeaders {
  'X-Hub-Key-Id': string
  'X-Hub-Timestamp': string
  'X-Hub-Nonce': string
  'X-Hub-Signature': string
  'X-Hub-Correlation-Id'?: string
  'X-Hub-Idempotency-Key'?: string
  'X-Hub-Operator-Email'?: string
  'X-Hub-Operator-Role'?: string
  'User-Agent': string
}

/**
 * Canoniza query string ordenando as chaves alfabeticamente para evitar adulteração de filtros.
 */
export function canonicalizeQueryString(searchParams: URLSearchParams | string): string {
  const params = typeof searchParams === 'string' ? new URLSearchParams(searchParams) : searchParams
  const entries: [string, string][] = []
  
  params.forEach((value, key) => {
    entries.push([key, value])
  })

  if (entries.length === 0) return ''

  // Ordena por chave e em caso de empate pelo valor
  entries.sort(([k1, v1], [k2, v2]) => {
    const kCmp = k1.localeCompare(k2)
    return kCmp !== 0 ? kCmp : v1.localeCompare(v2)
  })

  return entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&')
}

/**
 * Gera path canônico com query string ordenada.
 */
export function getCanonicalPath(pathname: string, searchParams?: URLSearchParams | string): string {
  if (!searchParams) return pathname
  const canonicalQuery = canonicalizeQueryString(searchParams)
  return canonicalQuery ? `${pathname}?${canonicalQuery}` : pathname
}

/**
 * Canoniza objeto para JSON ordenado (reproduzível criptograficamente).
 * Idêntico ao AdminM2MClient do Alcântara Hub.
 */
export function canonicalizeJson(obj: unknown): string {
  if (obj === null || obj === undefined) return ''
  if (typeof obj !== 'object') return JSON.stringify(obj)
  if (Array.isArray(obj)) {
    return '[' + obj.map((item) => canonicalizeJson(item)).join(',') + ']'
  }
  const keys = Object.keys(obj as Record<string, unknown>).sort()
  const keyVals = keys.map(
    (k) => `${JSON.stringify(k)}:${canonicalizeJson((obj as Record<string, unknown>)[k])}`
  )
  return '{' + keyVals.join(',') + '}'
}

/**
 * Gera SHA-256 em hex do corpo da requisição em formato canônico.
 * Idêntico ao AdminM2MClient do Alcântara Hub.
 */
export function hashBody(body: unknown): string {
  if (body === undefined || body === null || body === '') {
    return crypto.createHash('sha256').update('').digest('hex')
  }
  const canonical = canonicalizeJson(body)
  return crypto.createHash('sha256').update(canonical, 'utf8').digest('hex')
}

/**
 * Validador de assinatura M2M padronizado para Telemetria
 */
export function verifyM2MSignature(
  _keyId: string,
  secretKey: string,
  method: string,
  path: string,
  providedSignature: string,
  providedTimestamp: string,
  providedNonce: string,
  maxClockSkewSeconds = 300
): { valid: boolean; reason?: string } {
  const now = Math.floor(Date.now() / 1000)
  const timestampNum = parseInt(providedTimestamp, 10)

  if (isNaN(timestampNum)) {
    return { valid: false, reason: 'INVALID_TIMESTAMP' }
  }

  if (!providedNonce || typeof providedNonce !== 'string') {
    return { valid: false, reason: 'INVALID_NONCE' }
  }

  if (Math.abs(now - timestampNum) > maxClockSkewSeconds) {
    return { valid: false, reason: 'TIMESTAMP_OUT_OF_WINDOW' }
  }

  const payloadToSign = `${providedTimestamp}:${providedNonce}:${method.toUpperCase()}:${path}`
  const expectedSignature = crypto
    .createHmac('sha256', secretKey)
    .update(payloadToSign)
    .digest('hex')

  const providedBuffer = Buffer.from(providedSignature, 'hex')
  const expectedBuffer = Buffer.from(expectedSignature, 'hex')

  if (providedBuffer.length !== expectedBuffer.length) {
    return { valid: false, reason: 'SIGNATURE_LENGTH_MISMATCH' }
  }

  const isValid = crypto.timingSafeEqual(providedBuffer, expectedBuffer)
  return { valid: isValid, reason: isValid ? undefined : 'SIGNATURE_MISMATCH' }
}

/**
 * Utilitário para gerar headers M2M de telemetria
 */
export function generateM2MHeaders(
  keyId: string,
  secretKey: string,
  method: string,
  path: string,
  customTimestamp?: number,
  customNonce?: string
): M2MAuthHeaders {
  const timestamp = (customTimestamp ?? Math.floor(Date.now() / 1000)).toString()
  const nonce = customNonce ?? crypto.randomUUID()
  const payloadToSign = `${timestamp}:${nonce}:${method.toUpperCase()}:${path}`

  const signature = crypto
    .createHmac('sha256', secretKey)
    .update(payloadToSign)
    .digest('hex')

  return {
    'X-Hub-Key-Id': keyId,
    'X-Hub-Timestamp': timestamp,
    'X-Hub-Nonce': nonce,
    'X-Hub-Signature': signature,
    'User-Agent': 'Alcantara-Hub-Worker/1.0',
  }
}

/**
 * Validador de assinatura M2M ADMINISTRATIVA estritamente alinhado ao AdminM2MClient do Alcântara Hub:
 * payloadToSign = [
 *   timestamp,
 *   nonce,
 *   correlationId,
 *   idempotencyKey || '',
 *   method.toUpperCase(),
 *   path,
 *   bodyHash
 * ].join(':')
 */
export function verifyAdminM2MSignature(params: {
  keyId: string
  secretKey: string
  method: string
  path: string
  body?: unknown
  providedSignature: string
  providedTimestamp: string
  providedNonce: string
  providedCorrelationId: string
  providedIdempotencyKey?: string
  maxClockSkewSeconds?: number
}): { valid: boolean; reason?: string } {
  const now = Math.floor(Date.now() / 1000)
  const timestampNum = parseInt(params.providedTimestamp, 10)
  const maxSkew = params.maxClockSkewSeconds ?? 300

  if (isNaN(timestampNum)) {
    return { valid: false, reason: 'INVALID_TIMESTAMP' }
  }

  if (Math.abs(now - timestampNum) > maxSkew) {
    return { valid: false, reason: 'TIMESTAMP_OUT_OF_WINDOW' }
  }

  if (!params.providedNonce) {
    return { valid: false, reason: 'MISSING_NONCE' }
  }

  if (!params.providedCorrelationId) {
    return { valid: false, reason: 'MISSING_CORRELATION_ID' }
  }

  const bodyHash = hashBody(params.body)
  const idempotencyKey = params.providedIdempotencyKey || ''

  const payloadToSign = [
    params.providedTimestamp,
    params.providedNonce,
    params.providedCorrelationId,
    idempotencyKey,
    params.method.toUpperCase(),
    params.path,
    bodyHash,
  ].join(':')

  const expectedSignature = crypto
    .createHmac('sha256', params.secretKey)
    .update(payloadToSign)
    .digest('hex')

  const providedBuf = Buffer.from(params.providedSignature, 'hex')
  const expectedBuf = Buffer.from(expectedSignature, 'hex')

  if (providedBuf.length !== expectedBuf.length) {
    return { valid: false, reason: 'SIGNATURE_LENGTH_MISMATCH' }
  }

  const isValid = crypto.timingSafeEqual(providedBuf, expectedBuf)
  return { valid: isValid, reason: isValid ? undefined : 'SIGNATURE_MISMATCH' }
}

/**
 * Utilitário para gerar headers M2M Administrativos compatíveis com o AdminM2MClient
 */
export function generateAdminM2MHeaders(params: {
  keyId: string
  secretKey: string
  method: string
  path: string
  operatorEmail?: string
  operatorRole?: string
  body?: unknown
  correlationId?: string
  idempotencyKey?: string
  customTimestamp?: number
  customNonce?: string
}): { headers: M2MAuthHeaders; bodyHash: string } {
  const timestamp = (params.customTimestamp ?? Math.floor(Date.now() / 1000)).toString()
  const nonce = params.customNonce ?? crypto.randomUUID()
  const correlationId = params.correlationId ?? crypto.randomUUID()
  const idempotencyKey = params.idempotencyKey || ''
  const bodyHash = hashBody(params.body)

  const payloadToSign = [
    timestamp,
    nonce,
    correlationId,
    idempotencyKey,
    params.method.toUpperCase(),
    params.path,
    bodyHash,
  ].join(':')

  const signature = crypto
    .createHmac('sha256', params.secretKey)
    .update(payloadToSign)
    .digest('hex')

  const headers: M2MAuthHeaders = {
    'X-Hub-Key-Id': params.keyId,
    'X-Hub-Timestamp': timestamp,
    'X-Hub-Nonce': nonce,
    'X-Hub-Correlation-Id': correlationId,
    'X-Hub-Signature': signature,
    'User-Agent': 'Alcantara-Hub-Admin/1.0',
  }

  if (params.idempotencyKey) {
    headers['X-Hub-Idempotency-Key'] = params.idempotencyKey
  }
  if (params.operatorEmail) {
    headers['X-Hub-Operator-Email'] = params.operatorEmail
  }
  if (params.operatorRole) {
    headers['X-Hub-Operator-Role'] = params.operatorRole
  }

  return { headers, bodyHash }
}
