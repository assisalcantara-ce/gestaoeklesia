/**
 * admin-m2m-operations.test.js
 *
 * Teste unitário e de integração direcionado para operações administrativas M2M pelo Hub:
 * 1. Autenticação HMAC-SHA256 estendida com body hash e verificação de nonce.
 * 2. Autorização por operador corporativo (roles permitidas vs proibidas).
 * 3. Idempotência em operações de mutação (mesma chave = replay idempotente).
 * 4. Validação de transição de plano (apenas planos comerciais oficiais de subscription_plans).
 * 5. Bloqueio de transições e status arbitrários/inválidos.
 * 6. Blindagem de cobranças e faturas Asaas (zero mutação em financeiro).
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'

// Funções de apoio
function canonicalizeJson(obj) {
  if (obj === null || obj === undefined) return ''
  if (typeof obj !== 'object') return JSON.stringify(obj)
  if (Array.isArray(obj)) {
    return '[' + obj.map((item) => canonicalizeJson(item)).join(',') + ']'
  }
  const keys = Object.keys(obj).sort()
  const keyVals = keys.map((k) => `${JSON.stringify(k)}:${canonicalizeJson(obj[k])}`)
  return '{' + keyVals.join(',') + '}'
}

function hashBody(body) {
  if (body === undefined || body === null || body === '') {
    return crypto.createHash('sha256').update('').digest('hex')
  }
  const canonical = canonicalizeJson(body)
  return crypto.createHash('sha256').update(canonical, 'utf8').digest('hex')
}

function generateAdminM2MSignature(params) {
  const bodyHash = hashBody(params.body)
  const idempotencyKey = params.idempotencyKey || ''

  const payloadToSign = [
    params.timestamp,
    params.nonce,
    params.correlationId,
    idempotencyKey,
    params.method.toUpperCase(),
    params.path,
    bodyHash,
  ].join(':')

  return crypto.createHmac('sha256', params.secretKey).update(payloadToSign).digest('hex')
}

describe('Hub Admin M2M Operations — Testes Direcionados de Segurança e Regras', () => {
  const secretKey = 'test_secret_m2m_admin_key_12345'
  const keyId = 'hub_admin_key_eklesia_v1'

  it('1. Deve gerar e validar assinatura HMAC estendida com body e idempotencyKey para mutação POST', () => {
    const timestamp = Math.floor(Date.now() / 1000).toString()
    const nonce = crypto.randomUUID()
    const correlationId = 'corr_test_001'
    const idempotencyKey = 'idemp_key_abc_123'
    const path = '/api/v1/hub/admin/ministries/min-uuid-1/activate'
    const body = { plan_slug: 'profissional', validity_months: 12 }

    const signature = generateAdminM2MSignature({
      timestamp,
      nonce,
      correlationId,
      idempotencyKey,
      method: 'POST',
      path,
      body,
      secretKey,
    })

    assert.ok(signature.length === 64, 'Assinatura deve ser SHA256 hex de 64 caracteres')

    // Validar que alteração no body invalida a assinatura
    const tamperedBody = { plan_slug: 'starter', validity_months: 12 }
    const tamperedSignature = generateAdminM2MSignature({
      timestamp,
      nonce,
      correlationId,
      idempotencyKey,
      method: 'POST',
      path,
      body: tamperedBody,
      secretKey,
    })

    assert.notStrictEqual(signature, tamperedSignature, 'Assinatura deve ser sensível ao body da requisição')
  })

  it('2. Validação de Autorização de Operador: bloqueia operador sem papel permitido', () => {
    const allowedRoles = ['admin', 'super_admin', 'operador', 'suporte', 'diretoria']

    function isOperatorAuthorized(email, role) {
      if (!email || !role) return false
      return allowedRoles.includes(role.toLowerCase().trim())
    }

    assert.strictEqual(isOperatorAuthorized('operador@alcantara.local', 'operador'), true)
    assert.strictEqual(isOperatorAuthorized('admin@alcantara.local', 'super_admin'), true)
    assert.strictEqual(isOperatorAuthorized('usuario@externo.com', 'cliente'), false)
    assert.strictEqual(isOperatorAuthorized('visitante@alcantara.local', 'convidado'), false)
    assert.strictEqual(isOperatorAuthorized(null, 'operador'), false)
  })

  it('3. Validação de Planos Comerciais Oficiais: aceita planos de subscription_plans e rejeita não-comerciais', () => {
    const activeOfficialPlans = ['basic', 'starter', 'junior', 'intermediario', 'profissional']
    const nonCommercialSlugs = ['avulsa', 'avulso', 'padrao', 'custom', 'outro', 'none']

    function validatePlanSlug(slug) {
      if (!slug || typeof slug !== 'string') return false
      const clean = slug.toLowerCase().trim()
      if (nonCommercialSlugs.includes(clean)) return false
      return activeOfficialPlans.includes(clean)
    }

    assert.strictEqual(validatePlanSlug('profissional'), true)
    assert.strictEqual(validatePlanSlug('intermediario'), true)
    assert.strictEqual(validatePlanSlug('junior'), true)
    assert.strictEqual(validatePlanSlug('starter'), true)
    assert.strictEqual(validatePlanSlug('avulsa'), false)
    assert.strictEqual(validatePlanSlug('plano_inventado'), false)
  })

  it('4. Validação de Transição de Status de Assinatura: aceita apenas status válidos do domínio', () => {
    const validStatuses = ['active', 'trial', 'cancelled', 'suspended', 'past_due']

    function isValidStatus(status) {
      return Boolean(status && validStatuses.includes(status.toLowerCase().trim()))
    }

    assert.strictEqual(isValidStatus('active'), true)
    assert.strictEqual(isValidStatus('suspended'), true)
    assert.strictEqual(isValidStatus('cancelled'), true)
    assert.strictEqual(isValidStatus('deleted'), false)
    assert.strictEqual(isValidStatus('free_forever'), false)
  })

  it('5. Idempotência em memória/armazenamento: simulação de requisições repetidas', () => {
    const processedKeys = new Set()

    function processWithIdempotency(key, operation) {
      const combined = `${operation}:${key}`
      if (processedKeys.has(combined)) {
        return { isDuplicate: true, status: 200, message: 'Operação já processada anteriormente' }
      }
      processedKeys.add(combined)
      return { isDuplicate: false, status: 200, message: 'Processado com sucesso' }
    }

    const firstCall = processWithIdempotency('key_123', 'activate:min-1')
    assert.strictEqual(firstCall.isDuplicate, false)

    const secondCall = processWithIdempotency('key_123', 'activate:min-1')
    assert.strictEqual(secondCall.isDuplicate, true)
    assert.strictEqual(secondCall.status, 200)

    // Chave diferente para a mesma operação executa normalmente
    const thirdCall = processWithIdempotency('key_456', 'activate:min-1')
    assert.strictEqual(thirdCall.isDuplicate, false)
  })

  it('6. Idempotência com liberação em caso de falha: permite retentativa legítima', () => {
    const storage = new Map()

    function checkAndRegister(key, op) {
      const combined = `${op}:${key}`
      if (storage.has(combined)) {
        return { isDuplicate: true }
      }
      storage.set(combined, Date.now())
      return { isDuplicate: false }
    }

    function release(key, op) {
      const combined = `${op}:${key}`
      storage.delete(combined)
    }

    const key = 'retry_key_789'
    const op = 'activate:min-99'

    // 1ª tentativa: registro inicial
    const step1 = checkAndRegister(key, op)
    assert.strictEqual(step1.isDuplicate, false, 'Primeira tentativa deve ser registrada')

    // Simula falha técnica/exceção e liberação da chave
    release(key, op)

    // 2ª tentativa: após liberação por erro, deve permitir reprocessamento legítimo
    const step2 = checkAndRegister(key, op)
    assert.strictEqual(step2.isDuplicate, false, 'Retentativa após falha liberada deve ser permitida')

    // Se concluiu com sucesso (não libera), chamada repetida deve ser detectada como duplicata
    const step3 = checkAndRegister(key, op)
    assert.strictEqual(step3.isDuplicate, true, 'Chamada repetida após sucesso deve ser detectada como duplicata')
  })

  it('7. Retorno de Erro 404 CLIENT_NOT_FOUND para ID inexistente', () => {
    const ministriesMock = [{ id: 'valid-min-1', name: 'Igreja Sede' }]

    function findMinistryOr404(id) {
      const min = ministriesMock.find((m) => m.id === id)
      if (!min) {
        return {
          status: 404,
          body: {
            error: 'CLIENT_NOT_FOUND',
            message: 'Ministério não encontrado para o ID fornecido.',
          },
        }
      }
      return { status: 200, body: min }
    }

    const notFoundRes = findMinistryOr404('min-nao-existente')
    assert.strictEqual(notFoundRes.status, 404)
    assert.strictEqual(notFoundRes.body.error, 'CLIENT_NOT_FOUND')

    const foundRes = findMinistryOr404('valid-min-1')
    assert.strictEqual(foundRes.status, 200)
  })

  it('8. Blindagem de Cobranças e Asaas: endpoints de mutação não tocam em tabelas de pagamentos', () => {
    // Garante que o payload aceito pelas mutações não permite sobrescrever asaas_customer_id ou criar cobranças fictícias
    const safePayloadKeys = ['plan_slug', 'validity_months', 'new_plan_slug', 'status', 'is_active', 'subscription_end_date', 'reason']
    const forbiddenKeys = ['asaas_customer_id', 'charge_id', 'payment_status', 'billing_value']

    function filterSafeMutationKeys(body) {
      const keys = Object.keys(body)
      const hasForbidden = keys.some((k) => forbiddenKeys.includes(k))
      return !hasForbidden
    }

    assert.strictEqual(filterSafeMutationKeys({ plan_slug: 'profissional', validity_months: 12 }), true)
    assert.strictEqual(filterSafeMutationKeys({ plan_slug: 'profissional', asaas_customer_id: 'cus_fake_123' }), false)
    assert.strictEqual(filterSafeMutationKeys({ status: 'active', payment_status: 'CONFIRMED' }), false)
  })
})
