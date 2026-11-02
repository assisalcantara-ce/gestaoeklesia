import test from 'node:test'
import assert from 'node:assert/strict'

test('Modelo Comercial e Trial — Regras e Isolamento de Segurança', async (t) => {
  await t.test('TODO cadastro não confirmado provisiona estritamente o plano intermediario no ministério', () => {
    const TRIAL_STABLE_SLUG = 'intermediario'
    const slugsValidos = new Set(['junior', 'basic', 'starter', 'intermediario', 'profissional'])

    const simulateSignupProvisioning = (trialParam, planParam) => {
      const isTrialFlow = Boolean(trialParam === true || trialParam === 'true')
      const planLower = typeof planParam === 'string' ? planParam.toLowerCase() : ''

      // Intenção comercial de contratação
      const intendedCommercialPlan = slugsValidos.has(planLower)
        ? planLower
        : (slugsValidos.size > 0 ? [...slugsValidos][0] : 'basic')

      // Regra obrigatória: ministério sempre nasce com intermediario durante os 7 dias
      const ministryPlan = TRIAL_STABLE_SLUG

      return {
        isTrialFlow,
        preRegistrationPlan: intendedCommercialPlan,
        ministryPlan,
        status: 'trial'
      }
    }

    // Caso 1: Usuário tenta cadastrar com trial=false e plan=profissional
    const attempt1 = simulateSignupProvisioning(false, 'profissional')
    assert.equal(attempt1.isTrialFlow, false)
    assert.equal(attempt1.preRegistrationPlan, 'profissional', 'Intenção comercial deve ser preservada em pre_registrations')
    assert.equal(attempt1.ministryPlan, 'intermediario', 'Ministério NUNCA deve receber o profissional antes do pagamento')

    // Caso 2: Usuário cadastra trial normal de 7 dias
    const attempt2 = simulateSignupProvisioning(true, 'intermediario')
    assert.equal(attempt2.isTrialFlow, true)
    assert.equal(attempt2.preRegistrationPlan, 'intermediario')
    assert.equal(attempt2.ministryPlan, 'intermediario')

    // Caso 3: Tentativa maliciosa de injetar plano inexistente ou script
    const attempt3 = simulateSignupProvisioning(false, '<script>alert(1)</script>')
    assert.equal(attempt3.preRegistrationPlan, 'junior', 'Deve fazer fallback seguro para plano válido')
    assert.equal(attempt3.ministryPlan, 'intermediario', 'Ministério sempre permanece como intermediario')
  })

  await t.test('Validação de vigência de trial bloqueia requisições em APIs após expiração', () => {
    const simulateSubscriptionValidation = ({
      pathname,
      isTechUser = false,
      ministryActive = false,
      preRegStatus = 'trial',
      trialExpiresAt,
      now = new Date('2026-11-01T12:00:00Z')
    }) => {
      // 1. Isenção de rotas essenciais de reativação/checkout/jurídico
      const isExempt = [
        '/api/v1/trial',
        '/api/v1/juridico',
        '/api/v1/admin',
        '/api/v1/hub',
        '/api/v1/public',
        '/api/v1/auth',
        '/api/v1/signup',
      ].some((prefix) => pathname === prefix || pathname.startsWith(prefix + '/'))

      if (isExempt) return { allowed: true, reason: 'route_exempt' }
      if (isTechUser) return { allowed: true, reason: 'tech_user' }
      if (ministryActive) return { allowed: true, reason: 'active_subscription' }
      if (preRegStatus === 'efetivado') return { allowed: true, reason: 'pre_reg_efetivado' }

      const expiresAt = trialExpiresAt ? new Date(trialExpiresAt) : null
      const isExpired = preRegStatus === 'encerrado' || (expiresAt !== null && expiresAt.getTime() <= now.getTime())

      if (isExpired) {
        return { allowed: false, error: 'TRIAL_EXPIRED' }
      }

      return { allowed: true, reason: 'trial_valid' }
    }

    const pastDate = new Date('2026-10-20T12:00:00Z').toISOString()
    const futureDate = new Date('2026-11-05T12:00:00Z').toISOString()

    // 1. Trial expirado tentando acessar /api/v1/members -> Bloqueado
    const check1 = simulateSubscriptionValidation({
      pathname: '/api/v1/members',
      trialExpiresAt: pastDate
    })
    assert.equal(check1.allowed, false)
    assert.equal(check1.error, 'TRIAL_EXPIRED')

    // 2. Trial expirado tentando criar lançamento financeiro -> Bloqueado
    const check2 = simulateSubscriptionValidation({
      pathname: '/api/v1/tesouraria/lancamentos',
      trialExpiresAt: pastDate
    })
    assert.equal(check2.allowed, false)
    assert.equal(check2.error, 'TRIAL_EXPIRED')

    // 3. Trial expirado acessando rota de reativação / checkout (/api/v1/trial/checkout) -> Permitido
    const check3 = simulateSubscriptionValidation({
      pathname: '/api/v1/trial/checkout',
      trialExpiresAt: pastDate
    })
    assert.equal(check3.allowed, true)
    assert.equal(check3.reason, 'route_exempt')

    // 4. Assinatura ativa (pagamento confirmado) acessando /api/v1/members -> Permitido
    const check4 = simulateSubscriptionValidation({
      pathname: '/api/v1/members',
      ministryActive: true,
      trialExpiresAt: pastDate
    })
    assert.equal(check4.allowed, true)
    assert.equal(check4.reason, 'active_subscription')

    // 5. Trial ainda dentro dos 7 dias acessando /api/v1/members -> Permitido
    const check5 = simulateSubscriptionValidation({
      pathname: '/api/v1/members',
      trialExpiresAt: futureDate
    })
    assert.equal(check5.allowed, true)
    assert.equal(check5.reason, 'trial_valid')

    // 6. Analista técnico de suporte (tech.suporte.*) operando tenant expirado -> Permitido
    const check6 = simulateSubscriptionValidation({
      pathname: '/api/v1/members',
      isTechUser: true,
      trialExpiresAt: pastDate
    })
    assert.equal(check6.allowed, true)
    assert.equal(check6.reason, 'tech_user')
  })
})
