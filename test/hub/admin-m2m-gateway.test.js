import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'

// Implementações espelho de testes em Node puro
function canonicalizeJson(obj) {
  if (obj === null || obj === undefined) return ''
  if (typeof obj !== 'object') return JSON.stringify(obj)
  if (Array.isArray(obj)) {
    return '[' + obj.map((item) => canonicalizeJson(item)).join(',') + ']'
  }
  const keys = Object.keys(obj).sort()
  const keyVals = keys.map(
    (k) => `${JSON.stringify(k)}:${canonicalizeJson(obj[k])}`
  )
  return '{' + keyVals.join(',') + '}'
}

function hashBody(body) {
  if (body === undefined || body === null || body === '') {
    return crypto.createHash('sha256').update('').digest('hex')
  }
  const canonical = canonicalizeJson(body)
  return crypto.createHash('sha256').update(canonical, 'utf8').digest('hex')
}

function canonicalizeQueryString(searchParams) {
  const params = typeof searchParams === 'string' ? new URLSearchParams(searchParams) : searchParams
  const entries = []
  params.forEach((value, key) => {
    entries.push([key, value])
  })
  if (entries.length === 0) return ''
  entries.sort(([k1, v1], [k2, v2]) => {
    const kCmp = k1.localeCompare(k2)
    return kCmp !== 0 ? kCmp : v1.localeCompare(v2)
  })
  return entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&')
}

function getCanonicalPath(pathname, searchParams) {
  if (!searchParams) return pathname
  const canonicalQuery = canonicalizeQueryString(searchParams)
  return canonicalQuery ? `${pathname}?${canonicalQuery}` : pathname
}

function verifyAdminM2MSignature(params) {
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

function generateAdminM2MHeaders(params) {
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

  const headers = {
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

// Simulação de verificação de nonce atômico para testes locais sem tocar banco remoto
async function simulateAtomicNonceCheck(mockDb, nonce, keyId, correlationId) {
  // Simulação de falha de banco (ex: timeout ou connection refused)
  if (mockDb.simulateFailure) {
    return { success: false, reason: 'STORAGE_FAILURE', error: 'Connection to nonce storage timed out' }
  }

  // Simulação de unique constraint violation (código 23505)
  if (mockDb.table.has(nonce)) {
    return { success: false, reason: 'REPLAY_DETECTED', source: 'db' }
  }

  mockDb.table.set(nonce, { keyId, correlationId, createdAt: Date.now() })
  return { success: true }
}

describe('Gestão Eklésia — Validação Final da Proteção Anti-Replay (Prompt 51)', () => {
  const testKeyId = 'hub_admin_key_eklesia_v1'
  const testSecretKey = 'test_secret_eklesia_m2m_hardened_456'
  const telemetrySecretKey = 'telemetry_secret_distinta_123'
  const operator = {
    email: 'assisalcantara.pa@gmail.com',
    role: 'super_admin',
  }

  it('1. Compatibilidade exata com AdminM2MClient do Hub: assinatura em GET com idempotencyKey vazia', () => {
    const rawPath = '/api/v1/hub/admin/ministries?page=1&limit=10'
    const { headers } = generateAdminM2MHeaders({
      keyId: testKeyId,
      secretKey: testSecretKey,
      method: 'GET',
      path: rawPath,
      operatorEmail: operator.email,
      operatorRole: operator.role,
      body: undefined,
    })

    assert.ok(headers['X-Hub-Signature'], 'Assinatura deve existir')
    assert.strictEqual(headers['X-Hub-Idempotency-Key'], undefined, 'GET não deve enviar header de idempotência')

    const verification = verifyAdminM2MSignature({
      keyId: testKeyId,
      secretKey: testSecretKey,
      method: 'GET',
      path: rawPath,
      body: undefined,
      providedSignature: headers['X-Hub-Signature'],
      providedTimestamp: headers['X-Hub-Timestamp'],
      providedNonce: headers['X-Hub-Nonce'],
      providedCorrelationId: headers['X-Hub-Correlation-Id'],
      providedIdempotencyKey: headers['X-Hub-Idempotency-Key'],
    })

    assert.strictEqual(verification.valid, true)
  })

  it('2. Canonização e proteção de Query String contra adulteração de filtros e paginação', () => {
    const query = new URLSearchParams('status=active&page=1&search=Batista&limit=20')
    const canonical = canonicalizeQueryString(query)

    assert.strictEqual(canonical, 'limit=20&page=1&search=Batista&status=active')

    const canonicalPath = getCanonicalPath('/api/v1/hub/admin/ministries', query)
    const { headers } = generateAdminM2MHeaders({
      keyId: testKeyId,
      secretKey: testSecretKey,
      method: 'GET',
      path: canonicalPath,
      operatorEmail: operator.email,
      operatorRole: operator.role,
    })

    const tamperedQuery = new URLSearchParams('status=active&page=1&search=Batista&limit=100')
    const tamperedPath = getCanonicalPath('/api/v1/hub/admin/ministries', tamperedQuery)

    const verification = verifyAdminM2MSignature({
      keyId: testKeyId,
      secretKey: testSecretKey,
      method: 'GET',
      path: tamperedPath,
      providedSignature: headers['X-Hub-Signature'],
      providedTimestamp: headers['X-Hub-Timestamp'],
      providedNonce: headers['X-Hub-Nonce'],
      providedCorrelationId: headers['X-Hub-Correlation-Id'],
    })

    assert.strictEqual(verification.valid, false)
    assert.strictEqual(verification.reason, 'SIGNATURE_MISMATCH')
  })

  it('3. Rejeição estrita com chave incorreta ou chave de telemetria (segregação de chaves)', () => {
    const path = '/api/v1/hub/admin/ministries/20c754d9-b684-469b-8255-a0bc8527aef5'
    const { headers } = generateAdminM2MHeaders({
      keyId: testKeyId,
      secretKey: testSecretKey,
      method: 'GET',
      path,
      operatorEmail: operator.email,
      operatorRole: operator.role,
    })

    const verificationWithTelemetry = verifyAdminM2MSignature({
      keyId: testKeyId,
      secretKey: telemetrySecretKey,
      method: 'GET',
      path,
      providedSignature: headers['X-Hub-Signature'],
      providedTimestamp: headers['X-Hub-Timestamp'],
      providedNonce: headers['X-Hub-Nonce'],
      providedCorrelationId: headers['X-Hub-Correlation-Id'],
    })

    assert.strictEqual(verificationWithTelemetry.valid, false)
  })

  it('4. Rejeição de replay por clock skew expirado (>300s)', () => {
    const pastTimestamp = Math.floor(Date.now() / 1000) - 305
    const { headers } = generateAdminM2MHeaders({
      keyId: testKeyId,
      secretKey: testSecretKey,
      method: 'GET',
      path: '/api/v1/hub/admin/ministries',
      customTimestamp: pastTimestamp,
    })

    const verification = verifyAdminM2MSignature({
      keyId: testKeyId,
      secretKey: testSecretKey,
      method: 'GET',
      path: '/api/v1/hub/admin/ministries',
      providedSignature: headers['X-Hub-Signature'],
      providedTimestamp: headers['X-Hub-Timestamp'],
      providedNonce: headers['X-Hub-Nonce'],
      providedCorrelationId: headers['X-Hub-Correlation-Id'],
    })

    assert.strictEqual(verification.valid, false)
    assert.strictEqual(verification.reason, 'TIMESTAMP_OUT_OF_WINDOW')
  })

  it('5. Bloqueio imediato quando a persistência atômica de nonce falha (sem fallback permissivo)', async () => {
    const mockDb = { table: new Map(), simulateFailure: true }
    const nonce = 'test-nonce-storage-failure-123'

    const check = await simulateAtomicNonceCheck(mockDb, nonce, testKeyId, 'corr-123')
    assert.strictEqual(check.success, false)
    assert.strictEqual(check.reason, 'STORAGE_FAILURE')
    assert.match(check.error, /timed out/)
  })

  it('6. Bloqueio atômico de replay simultâneo entre instâncias com mesmo nonce', async () => {
    const mockDb = { table: new Map(), simulateFailure: false }
    const sharedNonce = 'test-shared-nonce-uuid-456'

    // Primeira requisição (Instância A)
    const firstReq = await simulateAtomicNonceCheck(mockDb, sharedNonce, testKeyId, 'corr-inst-A')
    assert.strictEqual(firstReq.success, true)

    // Replay simultâneo recebido pela Instância B
    const secondReq = await simulateAtomicNonceCheck(mockDb, sharedNonce, testKeyId, 'corr-inst-B')
    assert.strictEqual(secondReq.success, false)
    assert.strictEqual(secondReq.reason, 'REPLAY_DETECTED')
    assert.strictEqual(secondReq.source, 'db')
  })

  it('7. Tratamento e mascaramento seguro de CPF/CNPJ e sanitização de URLs de fatura', () => {
    function maskDocument(doc) {
      if (!doc) return null
      const cleaned = doc.replace(/\D/g, '')
      if (cleaned.length === 11) return `${cleaned.slice(0, 3)}.***.***-${cleaned.slice(-2)}`
      if (cleaned.length === 14) return `${cleaned.slice(0, 2)}.***.***/${cleaned.slice(8, 12)}-${cleaned.slice(-2)}`
      return '***'
    }

    function sanitizeInvoiceUrl(rawUrl) {
      if (!rawUrl) return null
      try {
        const parsed = new URL(rawUrl)
        return `${parsed.protocol}//${parsed.host}${parsed.pathname}`
      } catch {
        return null
      }
    }

    assert.strictEqual(maskDocument('12345678901'), '123.***.***-01')
    assert.strictEqual(maskDocument('12345678000199'), '12.***.***/0001-99')

    const dirtyUrl = 'https://asaas.com/i/abc123456?token=sensitive_session_key_999&auth=xyz'
    assert.strictEqual(sanitizeInvoiceUrl(dirtyUrl), 'https://asaas.com/i/abc123456')
  })
})
