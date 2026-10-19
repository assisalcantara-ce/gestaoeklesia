import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolvePlanFeatures,
  isPlanoIntermediario,
  LIBERACAO_TEMPORARIA_EVENTOS_PLANO_3,
  FEATURE_CATALOG,
} from '../src/lib/feature-flags';
import { isFeatureAllowedForTenant } from '../src/lib/plan-permissions';

describe('Liberação Temporária do Módulo Eventos no 3º Plano Comercial', () => {
  test('1. Identificação precisa do 3º plano comercial oficial ("intermediario")', () => {
    // Casos válidos de identificação do 3º plano comercial
    assert.equal(isPlanoIntermediario({ slug: 'intermediario' }), true);
    assert.equal(isPlanoIntermediario({ plan: 'intermediario' }), true);
    assert.equal(isPlanoIntermediario({ name: 'Intermediário' }), true);
    assert.equal(isPlanoIntermediario({ id: '39c12fb2-dd08-4327-9411-f8bf4c0a226d' }), true);
    assert.equal(isPlanoIntermediario({ subscription_plan_id: '39c12fb2-dd08-4327-9411-f8bf4c0a226d' }), true);

    // Outros planos não devem ser identificados como o 3º plano
    assert.equal(isPlanoIntermediario({ slug: 'basic' }), false);
    assert.equal(isPlanoIntermediario({ slug: 'starter' }), false);
    assert.equal(isPlanoIntermediario({ slug: 'profissional' }), false);
    assert.equal(isPlanoIntermediario({ slug: 'expert' }), false);
    assert.equal(isPlanoIntermediario(null), false);
  });

  test('2. Catálogo de Features: events_module com minTier intermediário para testes', () => {
    assert.equal(LIBERACAO_TEMPORARIA_EVENTOS_PLANO_3, true);
    assert.equal(FEATURE_CATALOG.events_module.minTier, 'intermediate');
  });

  test('3. Liberação provisória de Eventos no 3º plano (Intermediário)', () => {
    // 3.1 Tenant configurado apenas com o slug de plano
    const planoSlugOnly = { slug: 'intermediario' };
    const resSlugOnly = resolvePlanFeatures(planoSlugOnly);
    assert.equal(resSlugOnly.events_module, true, 'Tenant com slug intermediario deve ter events_module liberado');

    // 3.2 Tenant com objeto completo retornado do Supabase (onde has_modulo_eventos ainda é false no banco)
    const planoDbRow = {
      id: '39c12fb2-dd08-4327-9411-f8bf4c0a226d',
      name: 'Intermediário',
      slug: 'intermediario',
      description: 'Para igrejas em expansão que precisam de mais recursos e estrutura.',
      price_monthly: 599,
      max_users: 20,
      has_modulo_financeiro: true,
      has_modulo_eventos: false, // Estado atual no Supabase
      has_modulo_reunioes: true,
      modulos: [
        '+ Todos do Starter',
        'Tesouraria II',
        'Funcionários',
        'Comissão/Consagração',
        'Área Kids',
        'Reuniões de Ministério',
      ],
    };
    const resDbRow = resolvePlanFeatures(planoDbRow);
    assert.equal(resDbRow.events_module, true, 'Tenant com registro DB do Intermediário deve ter events_module liberado mesmo com has_modulo_eventos false');
  });

  test('4. Planos inferiores (Basic e Starter) continuam rigorosamente sem acesso a Eventos', () => {
    // Basic (1º plano comercial)
    const planoBasic = {
      id: '187a57b1-b4cb-4f40-8517-6527df1d10c4',
      name: 'Basic',
      slug: 'basic',
      price_monthly: 149,
      max_users: 2,
      has_modulo_eventos: false,
    };
    const resBasic = resolvePlanFeatures(planoBasic);
    assert.equal(resBasic.events_module, false, 'Plano Basic não deve ter acesso a Eventos');

    // Starter (2º plano comercial)
    const planoStarter = {
      id: '503104e9-d532-433f-98b5-c7345152e275',
      name: 'Starter',
      slug: 'starter',
      price_monthly: 299,
      max_users: 10,
      has_modulo_eventos: false,
    };
    const resStarter = resolvePlanFeatures(planoStarter);
    assert.equal(resStarter.events_module, false, 'Plano Starter não deve ter acesso a Eventos');
  });

  test('5. Planos superiores (Profissional e Expert) preservam acesso pleno a Eventos', () => {
    // Profissional (4º plano comercial)
    const planoProfissional = {
      id: '3eed6a7e-f5dc-42e7-a976-de79fd397f3c',
      name: 'Profissional',
      slug: 'profissional',
      price_monthly: 999,
      max_users: 20,
      has_modulo_eventos: true,
    };
    const resProf = resolvePlanFeatures(planoProfissional);
    assert.equal(resProf.events_module, true, 'Plano Profissional deve manter acesso a Eventos');

    // Expert (5º plano)
    const planoExpert = {
      name: 'Expert',
      slug: 'expert',
      price_monthly: 1500,
      max_users: 500,
      has_modulo_eventos: true,
    };
    const resExpert = resolvePlanFeatures(planoExpert);
    assert.equal(resExpert.events_module, true, 'Plano Expert deve manter acesso a Eventos');
  });

  test('6. Preservação de limites e isolamento de outros módulos no 3º plano', () => {
    const planoIntermediario = {
      id: '39c12fb2-dd08-4327-9411-f8bf4c0a226d',
      name: 'Intermediário',
      slug: 'intermediario',
      price_monthly: 599,
      max_users: 20,
      has_modulo_financeiro: true,
      has_modulo_eventos: false,
      has_modulo_reunioes: true,
    };
    const res = resolvePlanFeatures(planoIntermediario);

    // Módulos legítimos do Intermediário
    assert.equal(res.financial_module, true);
    assert.equal(res.meetings_module, true);
    assert.equal(res.digital_collection, true);
    assert.equal(res.employees_module, true);
    assert.equal(res.kids_module, true);

    // Módulo Eventos (liberado provisoriamente)
    assert.equal(res.events_module, true);

    // Módulos restritos aos planos superiores (Profissional/Expert) NÃO devem vazar
    assert.equal(res.accounting_module, false, 'Contabilidade deve permanecer exclusiva do Profissional');
    assert.equal(res.fiscal_council_module, false, 'Conselho Fiscal deve permanecer exclusivo do Profissional');
    assert.equal(res.presidency_module, false, 'Presidência deve permanecer exclusiva do Profissional');
    assert.equal(res.advanced_bi, false, 'BI Avançado deve permanecer exclusivo do Expert');
  });

  test('7. Server-side API Check: isFeatureAllowedForTenant valida acesso a events_module', async () => {
    // Simula mock Supabase Client consultando ministries com relação subscription_plans
    const mockSupabase = {
      from: (_table: string) => ({
        select: (_cols: string) => ({
          eq: (_field: string, val: string) => ({
            maybeSingle: async () => {
              if (val === 'tenant-inter-1') {
                return {
                  data: {
                    plan: 'intermediario',
                    subscription_plan_id: '39c12fb2-dd08-4327-9411-f8bf4c0a226d',
                    subscription_plans: {
                      id: '39c12fb2-dd08-4327-9411-f8bf4c0a226d',
                      name: 'Intermediário',
                      slug: 'intermediario',
                      price_monthly: 599,
                      max_users: 20,
                      has_modulo_eventos: false, // Estado do banco
                    },
                  },
                };
              }
              if (val === 'tenant-starter-1') {
                return {
                  data: {
                    plan: 'starter',
                    subscription_plan_id: '503104e9-d532-433f-98b5-c7345152e275',
                    subscription_plans: {
                      id: '503104e9-d532-433f-98b5-c7345152e275',
                      name: 'Starter',
                      slug: 'starter',
                      price_monthly: 299,
                      max_users: 10,
                      has_modulo_eventos: false,
                    },
                  },
                };
              }
              if (val === 'tenant-prof-1') {
                return {
                  data: {
                    plan: 'profissional',
                    subscription_plan_id: '3eed6a7e-f5dc-42e7-a976-de79fd397f3c',
                    subscription_plans: {
                      id: '3eed6a7e-f5dc-42e7-a976-de79fd397f3c',
                      name: 'Profissional',
                      slug: 'profissional',
                      price_monthly: 999,
                      max_users: 20,
                      has_modulo_eventos: true,
                    },
                  },
                };
              }
              return { data: null };
            },
          }),
        }),
      }),
    } as any;

    // Tenant Intermediário deve ter acesso liberado na API
    const interAllowed = await isFeatureAllowedForTenant(mockSupabase, 'tenant-inter-1', 'events_module');
    assert.equal(interAllowed, true);

    // Tenant Starter continua bloqueado na API
    const starterAllowed = await isFeatureAllowedForTenant(mockSupabase, 'tenant-starter-1', 'events_module');
    assert.equal(starterAllowed, false);

    // Tenant Profissional continua liberado na API
    const profAllowed = await isFeatureAllowedForTenant(mockSupabase, 'tenant-prof-1', 'events_module');
    assert.equal(profAllowed, true);
  });
});
