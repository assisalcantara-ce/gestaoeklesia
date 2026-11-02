import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

// Função que simula exatamente a validação das rotas POST e PATCH de planos em JS puro
function validateAndResolvePlan(body) {
  const name = String(body?.name || '').trim()
  const slug = String(body?.slug || '').trim()
  const priceMonthly = Number(body?.price_monthly)
  const priceAnnually = Number(body?.price_annually || 0)
  const setupFee = Number(body?.setup_fee || 0)
  const additionalChurchMonthlyFee = Number(body?.additional_church_monthly_fee ?? 50)
  const additionalAdminsPerChurch = Number(body?.additional_admin_users_per_church ?? 2)

  const rawMaxUsers = body?.max_users
  const rawMaxMinisterios = body?.max_ministerios
  const rawMaxMembers = body?.max_members

  const resolvedMaxMinisterios = Number.isFinite(Number(rawMaxMinisterios)) && Number(rawMaxMinisterios) > 0
    ? Number(rawMaxMinisterios)
    : 1

  const resolvedMaxUsers = Number.isFinite(Number(rawMaxUsers)) && Number(rawMaxUsers) > 0
    ? Number(rawMaxUsers)
    : Math.max(2, resolvedMaxMinisterios * 2)

  const resolvedMaxMembers = Number.isFinite(Number(rawMaxMembers)) && Number(rawMaxMembers) >= 0
    ? Number(rawMaxMembers)
    : 0

  if (!name || !slug) {
    return { ok: false, error: 'Nome do plano e identificador (slug) são obrigatórios.' }
  }

  if (!Number.isFinite(priceMonthly) || priceMonthly < 0) {
    return { ok: false, error: 'Preço mensal inválido. Informe um valor numérico maior ou igual a zero.' }
  }

  if (rawMaxUsers !== undefined && rawMaxUsers !== null && rawMaxUsers !== '' && !Number.isNaN(Number(rawMaxUsers)) && Number(rawMaxUsers) <= 0) {
    return { ok: false, error: 'Limite de usuários administradores inválido (deve ser maior que zero).' }
  }

  if (rawMaxMinisterios !== undefined && rawMaxMinisterios !== null && rawMaxMinisterios !== '' && !Number.isNaN(Number(rawMaxMinisterios)) && Number(rawMaxMinisterios) <= 0) {
    return { ok: false, error: 'Quantidade de igrejas inclusas inválida (deve ser no mínimo 1).' }
  }

  if (rawMaxMembers !== undefined && rawMaxMembers !== null && rawMaxMembers !== '' && !Number.isNaN(Number(rawMaxMembers)) && Number(rawMaxMembers) < 0) {
    return { ok: false, error: 'Máximo de membros inválido (informe um valor numérico ou 0 para ilimitado).' }
  }

  if (!Number.isFinite(resolvedMaxUsers) || resolvedMaxUsers <= 0) {
    return { ok: false, error: 'Limite de usuários administradores inválido (deve ser maior que zero).' }
  }

  if (!Number.isFinite(resolvedMaxMinisterios) || resolvedMaxMinisterios <= 0) {
    return { ok: false, error: 'Quantidade de igrejas inclusas inválida (deve ser no mínimo 1).' }
  }

  if (!Number.isFinite(resolvedMaxMembers) || resolvedMaxMembers < 0) {
    return { ok: false, error: 'Máximo de membros inválido (informe um valor numérico ou 0 para ilimitado).' }
  }

  if (!Number.isFinite(resolvedMaxMembers) || resolvedMaxMembers < 0) {
    return { ok: false, error: 'Máximo de membros inválido (informe um valor numérico ou 0 para ilimitado).' }
  }

  if (!Number.isFinite(additionalChurchMonthlyFee) || additionalChurchMonthlyFee < 0) {
    return { ok: false, error: 'Taxa mensal por igreja adicional inválida.' }
  }

  if (!Number.isFinite(additionalAdminsPerChurch) || additionalAdminsPerChurch < 0) {
    return { ok: false, error: 'Quantidade de administradores adicionais por igreja inválida.' }
  }

  return {
    ok: true,
    data: {
      name,
      slug,
      price_monthly: priceMonthly,
      price_annually: priceAnnually,
      setup_fee: setupFee,
      max_users: resolvedMaxUsers,
      max_members: resolvedMaxMembers,
      max_ministerios: resolvedMaxMinisterios,
      additional_church_monthly_fee: additionalChurchMonthlyFee,
      additional_admin_users_per_church: additionalAdminsPerChurch,
    },
  }
}

describe('Painel Admin — Criação e Validação de Planos (subscription_plans)', () => {
  it('1. Cenário do Bug: formulário preenchido com Máximo de Membros 300 e max_users não preenchido ou NaN', () => {
    const payloadFromBug = {
      name: 'Plano Comunidade 300',
      slug: 'plano-comunidade-300',
      price_monthly: 199.90,
      max_members: 300,
      max_ministerios: 1,
      max_users: NaN,
    }

    const result = validateAndResolvePlan(payloadFromBug)

    assert.strictEqual(result.ok, true, 'Não deve falhar com max_users inválido quando não preenchido')
    if (result.ok) {
      assert.strictEqual(result.data.max_members, 300)
      assert.strictEqual(result.data.max_ministerios, 1)
      assert.strictEqual(result.data.max_users, 2, 'Deve adotar 2 usuários padrão por igreja')
    }
  })

  it('2. Aceita valor numérico explícito válido para Usuários Administradores', () => {
    const payloadWithExplicitUsers = {
      name: 'Plano Master',
      slug: 'plano-master',
      price_monthly: 450,
      max_members: 1500,
      max_ministerios: 5,
      max_users: 15,
    }

    const result = validateAndResolvePlan(payloadWithExplicitUsers)

    assert.strictEqual(result.ok, true)
    if (result.ok) {
      assert.strictEqual(result.data.max_users, 15)
      assert.strictEqual(result.data.max_members, 1500)
      assert.strictEqual(result.data.max_ministerios, 5)
    }
  })

  it('3. Trata corretamente membros ilimitados (max_members = 0)', () => {
    const payloadUnlimited = {
      name: 'Plano Enterprise Ilimitado',
      slug: 'enterprise-ilimitado',
      price_monthly: 990,
      max_members: 0, // 0 = ilimitado
      max_ministerios: 10,
    }

    const result = validateAndResolvePlan(payloadUnlimited)

    assert.strictEqual(result.ok, true)
    if (result.ok) {
      assert.strictEqual(result.data.max_members, 0)
      assert.strictEqual(result.data.max_ministerios, 10)
      assert.strictEqual(result.data.max_users, 20, '10 igrejas * 2 = 20 usuários admin')
    }
  })

  it('4. Retorna mensagens claras em português para erros de validação', () => {
    // Sem nome
    const resNoName = validateAndResolvePlan({ price_monthly: 100, max_ministerios: 1 })
    assert.strictEqual(resNoName.ok, false)
    assert.match(resNoName.error, /Nome do plano e identificador \(slug\) são obrigatórios/)

    // Preço mensal negativo
    const resBadPrice = validateAndResolvePlan({ name: 'Plano Teste', slug: 'teste', price_monthly: -50, max_ministerios: 1 })
    assert.strictEqual(resBadPrice.ok, false)
    assert.match(resBadPrice.error, /Preço mensal inválido/)

    // Membros negativo
    const resBadMembers = validateAndResolvePlan({ name: 'Plano Teste', slug: 'teste', price_monthly: 50, max_members: -10, max_ministerios: 1 })
    assert.strictEqual(resBadMembers.ok, false)
    assert.match(resBadMembers.error, /Máximo de membros inválido/)
  })
})
