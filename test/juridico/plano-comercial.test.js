import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

describe('Resolução de Plano Comercial vs. Preço Customizado e Contratos', () => {

  const AVAILABLE_PLANS = [
    { id: '11111111-1111-1111-1111-111111111111', name: 'Básico', slug: 'basico', price: 97.00 },
    { id: '22222222-2222-2222-2222-222222222222', name: 'Profissional', slug: 'profissional', price: 197.00 },
    { id: '39c12fb2-dd08-4327-9411-f8bf4c0a226d', name: 'Intermediário', slug: 'intermediario', price: 349.00 },
    { id: '44444444-4444-4444-4444-444444444444', name: 'Enterprise', slug: 'enterprise', price: 890.00 }
  ];

  // Simulação de PlanResolutionService
  class MockPlanResolutionService {
    static isValidCommercialSlug(slug) {
      if (!slug || typeof slug !== 'string') return false;
      const s = slug.toLowerCase().trim();
      const forbidden = ['avulsa', 'avulso', 'custom', 'customizado', 'padrao', 'default', 'trial'];
      if (forbidden.includes(s)) return false;
      return AVAILABLE_PLANS.some(p => p.slug === s);
    }

    static resolveCommercialPlan({ rawPlanSlug, subscriptionPlanId, tenantPlan, fallbackSlug = 'intermediario' }) {
      if (rawPlanSlug && this.isValidCommercialSlug(rawPlanSlug)) {
        const found = AVAILABLE_PLANS.find(p => p.slug === rawPlanSlug.toLowerCase().trim());
        if (found) return { planId: found.id, planSlug: found.slug, planName: found.name, isResolved: true };
      }

      if (subscriptionPlanId) {
        const found = AVAILABLE_PLANS.find(p => p.id === subscriptionPlanId);
        if (found) return { planId: found.id, planSlug: found.slug, planName: found.name, isResolved: true };
      }

      if (tenantPlan && this.isValidCommercialSlug(tenantPlan)) {
        const found = AVAILABLE_PLANS.find(p => p.slug === tenantPlan.toLowerCase().trim());
        if (found) return { planId: found.id, planSlug: found.slug, planName: found.name, isResolved: true };
      }

      const defaultPlan = AVAILABLE_PLANS.find(p => p.slug === fallbackSlug) || AVAILABLE_PLANS[0];
      return {
        planId: defaultPlan.id,
        planSlug: defaultPlan.slug,
        planName: defaultPlan.name,
        isResolved: false
      };
    }
  }

  // Simulação da materialização de contrato
  function materializarContrato({ template, tenant, plano, valorMensal, numeroContrato, dataEmissao }) {
    const planName = plano.planName || plano.name;
    let content = template;
    const replaces = [
      { from: /\{\{CONTRATANTE_NOME\}\}/g, to: tenant.name },
      { from: /\{\{CONTRATANTE_CNPJ\}\}/g, to: tenant.cnpj },
      { from: /\{\{REPRESENTANTE_NOME\}\}/g, to: tenant.representativeEmail },
      { from: /\{\{PLANO_NOME\}\}/g, to: planName },
      { from: /\{\{VALOR_CONTRATADO\}\}/g, to: 'R$ ' + Number(valorMensal).toFixed(2).replace('.', ',') },
      { from: /\{\{NUMERO_CONTRATO\}\}/g, to: numeroContrato },
      { from: /\{\{DATA_EMISSAO\}\}/g, to: dataEmissao }
    ];

    for (const r of replaces) {
      content = content.replace(r.from, r.to);
    }

    const hash = crypto.createHash('sha256').update(content).digest('hex');
    return {
      conteudo_customizado: content,
      hash_documento: hash,
      plano_contratado: planName,
      valor_mensal: valorMensal
    };
  }

  test('1. Cobrança com valor customizado preserva plano comercial real e seu ID', () => {
    const invoiceRequest = {
      ministryId: '10f279e1-6e91-4b43-9293-640b63262cf4',
      amount: 600.00,
      isCustomPrice: true,
      rawPlanSlug: 'avulsa',
      tenantCurrentPlan: 'intermediario',
      tenantCurrentPlanId: '39c12fb2-dd08-4327-9411-f8bf4c0a226d'
    };

    const resolved = MockPlanResolutionService.resolveCommercialPlan({
      rawPlanSlug: invoiceRequest.rawPlanSlug,
      subscriptionPlanId: invoiceRequest.tenantCurrentPlanId,
      tenantPlan: invoiceRequest.tenantCurrentPlan
    });

    assert.equal(resolved.planSlug, 'intermediario');
    assert.equal(resolved.planId, '39c12fb2-dd08-4327-9411-f8bf4c0a226d');
    assert.equal(resolved.planName, 'Intermediário');
    assert.notEqual(resolved.planSlug, 'avulsa');
  });

  test('2. Slug avulsa nunca é propagado para o plano da igreja (ministries.plan)', () => {
    const paymentPayload = {
      plano_slug: 'avulsa',
      subscription_plan_id: null,
      amount: 600.00
    };

    const resolved = MockPlanResolutionService.resolveCommercialPlan({
      rawPlanSlug: paymentPayload.plano_slug,
      subscriptionPlanId: paymentPayload.subscription_plan_id,
      fallbackSlug: 'intermediario'
    });

    const ministryUpdatePayload = {
      plan: resolved.planSlug,
      subscription_plan_id: resolved.planId,
      subscription_status: 'active'
    };

    assert.equal(ministryUpdatePayload.plan, 'intermediario');
    assert.equal(ministryUpdatePayload.subscription_plan_id, '39c12fb2-dd08-4327-9411-f8bf4c0a226d');
    assert.notEqual(ministryUpdatePayload.plan, 'avulsa');
  });

  test('3. Planos inexistentes ou inválidos não são gravados como nomes soltos no contrato', () => {
    const invalidSlugs = ['avulsa', 'avulso', 'custom', 'xyz_desconhecido', '', null, undefined];

    for (const slug of invalidSlugs) {
      const isValid = MockPlanResolutionService.isValidCommercialSlug(slug);
      assert.equal(isValid, false, `Slug "${slug}" não deveria ser válido como plano comercial.`);

      const resolved = MockPlanResolutionService.resolveCommercialPlan({
        rawPlanSlug: slug,
        fallbackSlug: 'intermediario'
      });

      assert.equal(resolved.planSlug, 'intermediario');
      assert.equal(resolved.planName, 'Intermediário');
    }
 });

 test('4. Tenant com plano intermediário e valor negociado de R$ 600,00 mantém plano e valor desacoplados', () => {
 const tenantState = {
 ministry_id: '10f279e1-6e91-4b43-9293-640b63262cf4',
 plan: 'intermediario',
 subscription_plan_id: '39c12fb2-dd08-4327-9411-f8bf4c0a226d',
 negotiated_price: 600.00
 };

 const resolved = MockPlanResolutionService.resolveCommercialPlan({
 rawPlanSlug: tenantState.plan,
 subscriptionPlanId: tenantState.subscription_plan_id
 });

 assert.equal(resolved.planSlug, 'intermediario');
 assert.equal(resolved.planName, 'Intermediário');
 assert.equal(tenantState.negotiated_price, 600.00);
 });

 test('5. Geração/Materialização do contrato recebe o nome do plano comercial correto e valor contratado', () => {
 const template = 'CONTRATO DE LICENÇA GESTÃO EKLÉSIA\nContratante: {{CONTRATANTE_NOME}}\nCNPJ: {{CONTRATANTE_CNPJ}}\nPlano: {{PLANO_NOME}}\nValor Mensal: {{VALOR_CONTRATADO}}\nContrato Nº: {{NUMERO_CONTRATO}}';
 
 const tenant = {
 name: 'IGREJA EVANGÉLICA ASSEMBLEIA DE DEUS - NOVA ANANINDEUA',
 cnpj: '02351044000191',
 representativeEmail: 'financeiro.adna@gmail.com'
 };

 const resolvedPlan = MockPlanResolutionService.resolveCommercialPlan({
 rawPlanSlug: 'intermediario',
 subscriptionPlanId: '39c12fb2-dd08-4327-9411-f8bf4c0a226d'
 });

 const materializado = materializarContrato({
 template,
 tenant,
 plano: resolvedPlan,
 valorMensal: 600.00,
 numeroContrato: 'CTR-10F279E1-2026',
 dataEmissao: '11/09/2026'
 });

 assert.equal(materializado.plano_contratado, 'Intermediário');
 assert.equal(materializado.valor_mensal, 600.00);
 assert.ok(materializado.conteudo_customizado.includes('Plano: Intermediário'));
 assert.ok(materializado.conteudo_customizado.includes('Valor Mensal: R$ 600,00'));
 assert.ok(!materializado.conteudo_customizado.includes('Avulsa'));
 assert.ok(!materializado.conteudo_customizado.includes('avulsa'));
 });

 test('6. Snapshot do contrato e hash_documento são rigorosamente sincronizados e verificáveis', () => {
 const template = 'Termo de Adesão ao Plano {{PLANO_NOME}} com valor {{VALOR_CONTRATADO}}';
 const tenant = { name: 'Igreja Teste', cnpj: '00000000000100', representativeEmail: 'admin@teste.com' };
 const plano = { name: 'Intermediário' };

 const mat = materializarContrato({
 template,
 tenant,
 plano,
 valorMensal: 600.00,
 numeroContrato: 'CTR-001',
 dataEmissao: '11/09/2026'
 });

 const recomputedHash = crypto.createHash('sha256').update(mat.conteudo_customizado).digest('hex');
 assert.equal(mat.hash_documento, recomputedHash);
 });

 test('7. Contratos assinados ou ativos permanecem imutáveis', () => {
 const contratoAssinado = {
 id: 'ctr-assinado-1',
 status: 'ATIVO',
 assinado_em: '2026-09-01T10:00:00Z',
 plano_contratado: 'Básico',
 hash_documento: 'hash_original_assinado'
 };

 function tentarModificarContratoAssinado(contrato, novosDados) {
 if (contrato.status === 'ATIVO' || contrato.assinado_em !== null) {
 throw new Error('CONTRATO_IMUTAVEL: Contratos já assinados ou ativos não podem ser reescritos.');
 }
 return { ...contrato, ...novosDados };
 }

 assert.throws(
 () => tentarModificarContratoAssinado(contratoAssinado, { plano_contratado: 'Intermediário' }),
 /CONTRATO_IMUTAVEL/
 );
 });
});
