import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CrmService } from '../src/lib/platform/crm/service.js';

test('KPIs - Cálculo consistente e separação rigorosa de TRIAL_EXPIRED e CANCELED', async () => {
  const crmService = new CrmService();

  const mockDb = {
    from: (table: string) => ({
      select: () => ({
        order: () => Promise.resolve({ data: [], error: null }),
        then: (resolve: (val: any) => void) => {
          if (table === 'ministries') {
            resolve({
              data: [
                // 15 trials expirados
                ...Array.from({ length: 15 }, (_, i) => ({
                  id: `min-trial-${i}`,
                  name: `Igreja Trial ${i}`,
                  user_id: `user-trial-${i}`,
                  subscription_status: 'trial',
                  subscription_end_date: '2026-09-01T00:00:00Z',
                  created_at: '2026-08-01T00:00:00Z',
                  is_active: true
                })),
                // 5 ativos
                ...Array.from({ length: 5 }, (_, i) => ({
                  id: `min-active-${i}`,
                  name: `Igreja Ativa ${i}`,
                  user_id: `user-active-${i}`,
                  subscription_status: 'active',
                  subscription_end_date: '2026-12-31T00:00:00Z',
                  created_at: '2026-01-01T00:00:00Z',
                  is_active: true
                }))
              ],
              error: null
            });
          } else if (table === 'pre_registrations') {
            resolve({
              data: [
                // 5 pré-cadastros com o mesmo user_id dos ministérios (devem ser desduplicados)
                ...Array.from({ length: 5 }, (_, i) => ({
                  id: `pr-converted-${i}`,
                  ministry_name: `Lead Convertido ${i}`,
                  user_id: `user-trial-${i}`,
                  status: 'trial',
                  created_at: '2026-08-01T00:00:00Z'
                })),
                // 3 pré-cadastros sem ministério correspondente (leads isolados)
                ...Array.from({ length: 3 }, (_, i) => ({
                  id: `pr-isolated-${i}`,
                  ministry_name: `Lead Isolado ${i}`,
                  user_id: `user-isolated-${i}`,
                  status: 'efetivado',
                  created_at: '2026-08-01T00:00:00Z'
                }))
              ],
              error: null
            });
          } else if (table === 'platform_billing_invoices') {
            // Faturas reais: 3 ministérios ativos possuem faturas pendentes
            resolve({
              data: [
                { id: 'inv-1', ministry_id: 'min-active-0', status: 'pending', amount: 99 },
                { id: 'inv-2', ministry_id: 'min-active-1', status: 'pending', amount: 149 },
                { id: 'inv-3', ministry_id: 'min-active-2', status: 'overdue', amount: 199 },
                { id: 'inv-4', ministry_id: 'min-active-3', status: 'paid', amount: 99 },
                { id: 'inv-5', ministry_id: 'min-active-4', status: 'paid', amount: 99 },
              ],
              error: null
            });
          } else {
            resolve({ data: [], error: null });
          }
        }
      })
    })
  };

  const { CommercialCache } = await import('../src/lib/platform/commercial-cache/CommercialCache.js');
  CommercialCache.getInstance().clear();

  const summary = await crmService.getSummary(mockDb as any);

  // Verificações de KPI
  assert.equal(summary.totalTrials, 0, 'Trials ativos devem ser 0');
  assert.equal(summary.totalTrialsExpirados, 15, 'Trials expirados devem ser exatamente 15');
  assert.equal(summary.totalCancelados, 0, 'Cancelados definitivos devem ser 0 (não mistura com TRIAL_EXPIRED)');
  assert.equal(summary.totalCobrancasPendentes, 3, 'Cobranças pendentes devem ser 3 baseadas nas faturas reais');
  assert.equal(summary.totalNegociacoes, 0, 'Negociações devem ser 0 pois não há oportunidades em estágio NEGOTIATION');
  assert.equal(summary.totalRenovacoes, 0, 'Renovações devem ser 0 pois as vigências não estão em janela de renovação');
});
