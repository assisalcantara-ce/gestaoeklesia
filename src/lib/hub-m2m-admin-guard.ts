import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminM2MSignature, getCanonicalPath } from '@/lib/hub-m2m-security'
import { createServerClient } from '@/lib/supabase-server'

// Cache em memória de nonces recentes para redundância / fallback
const seenAdminNonces = new Map<string, number>()
const NONCE_TTL_MS = 600 * 1000 // 10 minutos

type NonceCheckResult =
  | { success: true }
  | { success: false; reason: 'REPLAY_DETECTED'; source: 'db' | 'memory' }
  | { success: false; reason: 'STORAGE_FAILURE'; error: string }

export async function checkAndRegisterNonce(
  nonce: string,
  keyId: string,
  correlationId: string
): Promise<NonceCheckResult> {
  const now = Date.now()

  // 1. Limpeza de memória local
  for (const [key, timestamp] of seenAdminNonces.entries()) {
    if (now - timestamp > NONCE_TTL_MS) {
      seenAdminNonces.delete(key)
    }
  }

  // 2. Se já existe na memória local, rejeitar imediatamente
  if (seenAdminNonces.has(nonce)) {
    return { success: false, reason: 'REPLAY_DETECTED', source: 'memory' }
  }

  // 3. Persistência atômica no banco (tabela hub_m2m_nonces)
  try {
    const supabase = createServerClient()
    const { error } = await supabase.from('hub_m2m_nonces').insert([
      {
        nonce,
        key_id: keyId,
        correlation_id: correlationId,
        created_at: new Date().toISOString(),
        expires_at: new Date(now + NONCE_TTL_MS).toISOString(),
      },
    ])

    if (error) {
      // Código PostgreSQL 23505 = unique_violation (nonce já registrado por outra instância)
      if (error.code === '23505') {
        return { success: false, reason: 'REPLAY_DETECTED', source: 'db' }
      }

      // Falha de banco (tabela inexistente, timeout ou erro de conexão)
      // Conforme diretriz PROMPT 51: NUNCA permitir fallback em memória como autorização em produção
      console.error('[M2M_NONCE_ATOMIC_FAILURE] Falha crítica de persistência atômica de nonce no banco:', error.message)
      return { success: false, reason: 'STORAGE_FAILURE', error: error.message }
    }
  } catch (err: any) {
    console.error('[M2M_NONCE_ATOMIC_EXCEPTION] Exceção ao persistir nonce atômico no banco:', err?.message || err)
    return { success: false, reason: 'STORAGE_FAILURE', error: err?.message || String(err) }
  }

  // 4. Registrar na memória local da instância atual para fast-path local
  seenAdminNonces.set(nonce, now)
  return { success: true }
}


export interface AdminM2MContext {
  keyId: string
  correlationId: string
  idempotencyKey?: string
  operatorEmail?: string
  operatorRole?: string
  canonicalPath: string
}

export type AdminM2MAuthResult =
  | { ok: true; ctx: AdminM2MContext }
  | { ok: false; response: NextResponse }

/**
 * Log sanitizado de auditoria obrigatória.
 * Falhas graves de auditoria ou violações de segurança não são ignoradas.
 */
export async function logAdminM2MAudit(
  action: string,
  ctx: {
    keyId: string
    correlationId: string
    operatorEmail?: string
    operatorRole?: string
    path: string
    statusCode: number
    details?: Record<string, unknown>
  }
) {
  const auditEntry = {
    action,
    key_id: ctx.keyId,
    correlation_id: ctx.correlationId,
    operator_email: ctx.operatorEmail || 'unknown_operator',
    operator_role: ctx.operatorRole || 'unknown_role',
    path: ctx.path,
    status_code: ctx.statusCode,
    details: ctx.details || {},
    timestamp: new Date().toISOString(),
  }

  // Registro estruturado obrigatório no console stdout
  console.info(`[M2M_ADMIN_AUDIT] ${JSON.stringify(auditEntry)}`)

  // Persistência em admin_audit_logs quando disponível
  try {
    const supabase = createServerClient()
    await supabase.from('admin_audit_logs').insert([
      {
        admin_user_id: null,
        action: `M2M_${action}`,
        entity_type: 'm2m_gateway',
        entity_id: ctx.correlationId,
        changes: {
          operator_email: auditEntry.operator_email,
          operator_role: auditEntry.operator_role,
          path: auditEntry.path,
          status_code: auditEntry.status_code,
          ...auditEntry.details,
        },
        status: ctx.statusCode < 400 ? 'success' : 'failure',
      },
    ])
  } catch (auditErr: any) {
    console.error(`[M2M_AUDIT_ERROR] Falha crítica ao persistir trilha de auditoria para correlation_id=${ctx.correlationId}:`, auditErr?.message || auditErr)
  }
}

/**
 * Guardião de autenticação para o Gateway M2M Administrativo com hardening
 */
export async function authenticateAdminM2M(
  request: NextRequest,
  body?: unknown
): Promise<AdminM2MAuthResult> {
  // 1. Extração dos headers obrigatórios e contextuais
  const keyId = request.headers.get('x-hub-key-id') || request.headers.get('X-Hub-Key-Id')
  const timestamp = request.headers.get('x-hub-timestamp') || request.headers.get('X-Hub-Timestamp')
  const nonce = request.headers.get('x-hub-nonce') || request.headers.get('X-Hub-Nonce')
  const signature = request.headers.get('x-hub-signature') || request.headers.get('X-Hub-Signature')
  const correlationId =
    request.headers.get('x-hub-correlation-id') ||
    request.headers.get('X-Hub-Correlation-Id') ||
    `corr_${Date.now()}`
  const idempotencyKey =
    request.headers.get('x-hub-idempotency-key') ||
    request.headers.get('X-Hub-Idempotency-Key') ||
    undefined
  const operatorEmail =
    request.headers.get('x-hub-operator-email') ||
    request.headers.get('X-Hub-Operator-Email') ||
    undefined
  const operatorRole =
    request.headers.get('x-hub-operator-role') ||
    request.headers.get('X-Hub-Operator-Role') ||
    undefined

  if (!keyId || !timestamp || !nonce || !signature) {
    await logAdminM2MAudit('UNAUTHORIZED_MISSING_HEADERS', {
      keyId: keyId || 'missing',
      correlationId,
      operatorEmail,
      operatorRole,
      path: request.nextUrl.pathname,
      statusCode: 401,
    })

    return {
      ok: false,
      response: NextResponse.json(
        {
          error: 'UNAUTHORIZED_M2M_HEADERS_MISSING',
          message:
            'Headers obrigatórios ausentes (X-Hub-Key-Id, X-Hub-Timestamp, X-Hub-Nonce, X-Hub-Signature).',
          correlation_id: correlationId,
        },
        { status: 401 }
      ),
    }
  }

  // 2. Chaves autorizadas configuradas no ambiente
  const expectedKeyId =
    process.env.HUB_M2M_ADMIN_KEY_ID ||
    process.env.ALCANTARA_HUB_ADMIN_KEY_ID ||
    'hub_admin_key_eklesia_v1'
  const expectedSecretKey =
    process.env.HUB_M2M_ADMIN_SECRET_KEY || process.env.ALCANTARA_HUB_ADMIN_SECRET_KEY

  if (!expectedSecretKey) {
    await logAdminM2MAudit('CONNECTOR_UNCONFIGURED', {
      keyId,
      correlationId,
      operatorEmail,
      operatorRole,
      path: request.nextUrl.pathname,
      statusCode: 500,
    })

    return {
      ok: false,
      response: NextResponse.json(
        {
          error: 'CONNECTOR_UNCONFIGURED',
          message: 'Chave secreta M2M Administrativa não configurada no servidor.',
          correlation_id: correlationId,
        },
        { status: 500 }
      ),
    }
  }

  // Segregação estrita: proibido ser igual à chave da telemetria
  const telemetrySecret = process.env.HUB_M2M_SECRET_KEY || process.env.ALCANTARA_HUB_SECRET_KEY
  if (telemetrySecret && expectedSecretKey === telemetrySecret) {
    await logAdminM2MAudit('INVALID_CREDENTIAL_SEGREGATION', {
      keyId,
      correlationId,
      operatorEmail,
      operatorRole,
      path: request.nextUrl.pathname,
      statusCode: 500,
    })

    return {
      ok: false,
      response: NextResponse.json(
        {
          error: 'INVALID_CREDENTIAL_SEGREGATION',
          message: 'A chave M2M administrativa não pode ser idêntica à chave de telemetria.',
          correlation_id: correlationId,
        },
        { status: 500 }
      ),
    }
  }

  if (keyId !== expectedKeyId) {
    await logAdminM2MAudit('INVALID_KEY_ID', {
      keyId,
      correlationId,
      operatorEmail,
      operatorRole,
      path: request.nextUrl.pathname,
      statusCode: 401,
    })

    return {
      ok: false,
      response: NextResponse.json(
        {
          error: 'INVALID_KEY_ID',
          message: 'Key-Id M2M Administrativo desconhecido ou não autorizado.',
          correlation_id: correlationId,
        },
        { status: 401 }
      ),
    }
  }

  // 3. Verificação de replay atômica / distribuída por Nonce
  const nonceCheck = await checkAndRegisterNonce(nonce, keyId, correlationId)
  if (!nonceCheck.success) {
    if (nonceCheck.reason === 'STORAGE_FAILURE') {
      await logAdminM2MAudit('NONCE_STORAGE_FAILURE', {
        keyId,
        correlationId,
        operatorEmail,
        operatorRole,
        path: request.nextUrl.pathname,
        statusCode: 503,
        details: { error: nonceCheck.error },
      })

      return {
        ok: false,
        response: NextResponse.json(
          {
            error: 'NONCE_STORAGE_UNAVAILABLE',
            message: 'Falha no serviço compartilhado de prevenção de replay. Requisição recusada por segurança.',
            correlation_id: correlationId,
          },
          { status: 503 }
        ),
      }
    }

    // Replay attack detectado (db ou memory)
    await logAdminM2MAudit('REPLAY_ATTACK_DETECTED', {
      keyId,
      correlationId,
      operatorEmail,
      operatorRole,
      path: request.nextUrl.pathname,
      statusCode: 401,
      details: { nonce, source: nonceCheck.source },
    })

    return {
      ok: false,
      response: NextResponse.json(
        {
          error: 'REPLAY_ATTACK_DETECTED',
          message: 'Nonce já utilizado recentemente. Requisição rejeitada.',
          correlation_id: correlationId,
        },
        { status: 401 }
      ),
    }
  }


  // 4. Validação da Assinatura com Path Canônico (Query String Ordenada) e Body Hash
  // Suporta tanto o path bruto quanto o path canônico para compatibilidade estrita
  const rawPath = request.nextUrl.pathname + request.nextUrl.search
  const canonicalPath = getCanonicalPath(request.nextUrl.pathname, request.nextUrl.searchParams)

  let verification = verifyAdminM2MSignature({
    keyId,
    secretKey: expectedSecretKey,
    method: request.method,
    path: canonicalPath,
    body,
    providedSignature: signature,
    providedTimestamp: timestamp,
    providedNonce: nonce,
    providedCorrelationId: correlationId,
    providedIdempotencyKey: idempotencyKey,
    maxClockSkewSeconds: 300,
  })

  // Fallback para rawPath caso o cliente tenha assinado a query na ordem enviada
  if (!verification.valid && rawPath !== canonicalPath) {
    const rawVerification = verifyAdminM2MSignature({
      keyId,
      secretKey: expectedSecretKey,
      method: request.method,
      path: rawPath,
      body,
      providedSignature: signature,
      providedTimestamp: timestamp,
      providedNonce: nonce,
      providedCorrelationId: correlationId,
      providedIdempotencyKey: idempotencyKey,
      maxClockSkewSeconds: 300,
    })
    if (rawVerification.valid) {
      verification = rawVerification
    }
  }

  if (!verification.valid) {
    await logAdminM2MAudit('INVALID_SIGNATURE', {
      keyId,
      correlationId,
      operatorEmail,
      operatorRole,
      path: canonicalPath,
      statusCode: 401,
      details: { reason: verification.reason },
    })

    return {
      ok: false,
      response: NextResponse.json(
        {
          error: 'INVALID_SIGNATURE',
          reason: verification.reason,
          message: 'Assinatura HMAC-SHA256 administrativa inválida ou expirada.',
          correlation_id: correlationId,
        },
        { status: 401 }
      ),
    }
  }

  return {
    ok: true,
    ctx: {
      keyId,
      correlationId,
      idempotencyKey,
      operatorEmail,
      operatorRole,
      canonicalPath,
    },
  }
}
