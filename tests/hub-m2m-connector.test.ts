import { describe, it } from 'node:test'
import assert from 'node:assert'
import { generateM2MHeaders, verifyM2MSignature } from '../src/lib/hub-m2m-security'

describe('Gestão Eklésia — Conector M2M para Alcântara Hub (Testes de Segurança e Contrato)', () => {
  const testKeyId = 'hub_key_eklesia_v1'
  const testSecret = 'secret_eklesia_m2m_super_seguro_de_alta_entropia_456'
  const method = 'GET'
  const path = '/api/v1/hub/telemetry?reference_date=2026-10-31'

  it('1. deve gerar headers M2M compatíveis com o contrato HMAC-SHA256 e validar com sucesso', () => {
    const headers = generateM2MHeaders(testKeyId, testSecret, method, path)

    assert.strictEqual(headers['X-Hub-Key-Id'], testKeyId)
    assert.ok(headers['X-Hub-Timestamp'], 'Timestamp deve existir')
    assert.ok(headers['X-Hub-Nonce'], 'Nonce deve existir')
    assert.ok(headers['X-Hub-Signature'], 'Signature deve existir')

    const verification = verifyM2MSignature(
      testKeyId,
      testSecret,
      method,
      path,
      headers['X-Hub-Signature'],
      headers['X-Hub-Timestamp'],
      headers['X-Hub-Nonce']
    )

    assert.strictEqual(verification.valid, true)
    assert.strictEqual(verification.reason, undefined)
  })

  it('2. deve rejeitar assinaturas adulteradas (path, nonce ou secret divergente)', () => {
    const headers = generateM2MHeaders(testKeyId, testSecret, method, path)

    // Adulteração de path
    const resBadPath = verifyM2MSignature(
      testKeyId,
      testSecret,
      method,
      '/api/v1/hub/telemetry?reference_date=2026-11-01',
      headers['X-Hub-Signature'],
      headers['X-Hub-Timestamp'],
      headers['X-Hub-Nonce']
    )
    assert.strictEqual(resBadPath.valid, false)

    // Adulteração de secret
    const resBadSecret = verifyM2MSignature(
      testKeyId,
      'outro_secret_invalido',
      method,
      path,
      headers['X-Hub-Signature'],
      headers['X-Hub-Timestamp'],
      headers['X-Hub-Nonce']
    )
    assert.strictEqual(resBadSecret.valid, false)

    // Adulteração de nonce
    const resBadNonce = verifyM2MSignature(
      testKeyId,
      testSecret,
      method,
      path,
      headers['X-Hub-Signature'],
      headers['X-Hub-Timestamp'],
      'nonce_forjado'
    )
    assert.strictEqual(resBadNonce.valid, false)
  })

  it('3. deve rejeitar requisição com clock skew superior a 300 segundos (janela anti-replay)', () => {
    const expiredTimestamp = Math.floor(Date.now() / 1000) - 305
    const headers = generateM2MHeaders(testKeyId, testSecret, method, path, expiredTimestamp, 'nonce-123')

    const verification = verifyM2MSignature(
      testKeyId,
      testSecret,
      method,
      path,
      headers['X-Hub-Signature'],
      headers['X-Hub-Timestamp'],
      headers['X-Hub-Nonce']
    )

    assert.strictEqual(verification.valid, false)
    assert.strictEqual(verification.reason, 'TIMESTAMP_OUT_OF_WINDOW')
  })

  it('4. deve validar estritamente o schema de telemetria corporativa e a ausência total de PII / dados internos (LGPD)', () => {
    // Exemplo de payload legítimo retornado pelo endpoint
    const mockTelemetryPayload = {
      product_slug: 'gestaoeklesia',
      reference_date: '2026-10-31',
      generated_at: '2026-10-31T20:00:00Z',
      system_status: {
        health: 'operational',
        version: '2.4.0',
        uptime_pct_last_30d: 99.95,
        database_connected: true,
      },
      summary: {
        total_tenants_count: 9,
        active_tenants_count: 5,
        trial_tenants_count: 4,
        total_mrr: 2995.0,
        total_overdue: 0.0,
      },
      tenants_data: [
        {
          external_tenant_id: '10f279e1-6e91-4b43-9293-640b63262cf4',
          financial: {
            mrr_current: 599.0,
            billed_period: 600.0,
            received_period: 0.0,
            overdue_balance: 0.0,
          },
          usage_aggregated: {
            active_members_count: 693,
            congregations_count: 38,
            subscription_status: 'active',
            plan_slug: 'intermediario',
            is_active: true,
          },
          ai_telemetry: null,
        },
      ],
    }

    // Regra de conformidade LGPD: Proibição estrita de qualquer dado pessoal ou clínico/eclesiástico individual
    const forbiddenProperties = [
      'membros', 'membro', 'cpf', 'rg', 'dizimos', 'dizimo',
      'ofertas', 'oferta', 'nome_membro', 'prontuario', 'paciente',
      'email_membro', 'celular_membro', 'lancamentos_internos',
      'extrato_bancario_igreja'
    ]

    for (const tenant of mockTelemetryPayload.tenants_data) {
      assert.ok(tenant.external_tenant_id, 'external_tenant_id é obrigatório')
      assert.strictEqual(typeof tenant.financial.mrr_current, 'number')
      assert.strictEqual(typeof tenant.financial.billed_period, 'number')
      assert.strictEqual(typeof tenant.financial.received_period, 'number')
      assert.strictEqual(typeof tenant.financial.overdue_balance, 'number')
      assert.strictEqual(typeof tenant.usage_aggregated.active_members_count, 'number')
      assert.strictEqual(typeof tenant.usage_aggregated.congregations_count, 'number')

      for (const key of Object.keys(tenant)) {
        assert.strictEqual(
          forbiddenProperties.includes(key.toLowerCase()),
          false,
          `Violação de privacidade detectada: chave proibida '${key}' presente.`
        )
      }
    }
  })
})
