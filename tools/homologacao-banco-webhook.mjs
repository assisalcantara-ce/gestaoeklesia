/**
 * homologacao-banco-webhook.mjs
 * Testa o fluxo de banco + webhook sem depender de chamada real ao ASAAS.
 * Simula um gatewayChargeId fictício e injeta o webhook direto na API local.
 *
 * Cobre:
 *  - Passo 4: Simular confirmação de pagamento via webhook
 *  - Passo 5: Verificar estado no banco
 *  - Passo 6: Reenviar webhook (idempotência)
 *  - Passo 7: Visibilidade na Tesouraria
 */
import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

// ─── Parse .env.local ─────────────────────────────────────────────────────
const raw = readFileSync('.env.local', 'utf8');
const env = {};
for (const line of raw.split(/\r?\n/)) {
  const m = line.match(/^([A-Za-z0-9_]+)=(.+)$/);
  if (m) env[m[1]] = m[2].trim();
}

const APP_URL        = 'http://localhost:3000';
const MINISTRY_ID    = '8890d729-f6cf-40b5-b9fc-751315c24f57';
const WEBHOOK_TOKEN  = '0b06bf41-a8e4-4f3c-8b81-f365e800bba4';
const CONGREGACAO_ID = 'a3f78bf8-23fb-4fb6-833b-6554b962bda7';
const GATEWAY_ID     = '2c4fba58-f442-45a8-8fc7-059f5c752092';
const DEST_ID        = '2183ea52-1d9b-4b82-98a7-3a2a419f4125'; // criado no script anterior

const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

function pass(msg) { console.log('  ✅ ' + msg); }
function fail(msg) { console.log('  ❌ ' + msg); }
function info(msg) { console.log('  ℹ️  ' + msg); }

async function apiPost(path, body) {
  const res = await fetch(`${APP_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, json };
}

// ─── PASSO 1: Inserir cobrança fictícia simulando o que o ASAAS teria criado ─
console.log('\n━━━ PASSO 1: Injetar cobrança simulada (bypassa chamada ASAAS) ━━━');
const fakeGatewayChargeId = `pay_homolog_${Date.now()}`;

const { data: chargeRow, error: chargeErr } = await sb
  .from('fin_payment_charges')
  .insert({
    ministry_id:       MINISTRY_ID,
    destination_id:    DEST_ID,
    gateway:           'asaas',
    gateway_charge_id: fakeGatewayChargeId,
    payer_name:        'João Teste Homologação',
    valor_solicitado:  10.00,
    status:            'pendente',
    idempotency_key:   `${DEST_ID}_${fakeGatewayChargeId}`,
  })
  .select('id, gateway_charge_id, status')
  .single();

if (chargeErr) { fail('Erro ao injetar cobrança: ' + chargeErr.message); process.exit(1); }
pass(`Cobrança simulada injetada: ${chargeRow.id}`);
info(`gateway_charge_id: ${fakeGatewayChargeId}`);
info(`status inicial: ${chargeRow.status}`);

const chargeId = chargeRow.id;

// ─── PASSO 2: Simular webhook PAYMENT_CONFIRMED ───────────────────────────
console.log('\n━━━ PASSO 2: Simular webhook PAYMENT_CONFIRMED ━━━');
const webhookPayload = {
  event: 'PAYMENT_CONFIRMED',
  payment: {
    id:               fakeGatewayChargeId,
    customer:         'cus_homolog_test',
    value:            10.00,
    netValue:         9.60,
    paymentDate:      new Date().toISOString().slice(0, 10),
    confirmedDate:    new Date().toISOString().slice(0, 10),
    status:           'CONFIRMED',
    billingType:      'PIX',
    externalReference: `fpd:${DEST_ID.replace(/-/g, '')}`,
  },
};

const wh1Resp = await apiPost(
  `/api/v1/ministry-webhook/asaas/${WEBHOOK_TOKEN}`,
  webhookPayload
);
info(`HTTP ${wh1Resp.status}: ${JSON.stringify(wh1Resp.json)}`);

if (!wh1Resp.ok) { fail('Webhook retornou erro: ' + JSON.stringify(wh1Resp.json)); process.exit(1); }
if (wh1Resp.json.processed === 'digital_payment_paid') pass('Webhook: processed=digital_payment_paid ✓');
else fail('Webhook: resultado inesperado: ' + JSON.stringify(wh1Resp.json));

// ─── PASSO 3: Verificar estado no banco ──────────────────────────────────
console.log('\n━━━ PASSO 3: Verificar banco após webhook ━━━');

const { data: chargeAfter } = await sb
  .from('fin_payment_charges')
  .select('id, status, valor_pago, paid_at, tesouraria_lancamento_id')
  .eq('id', chargeId)
  .single();

if (chargeAfter?.status === 'pago')  pass(`fin_payment_charges.status = pago ✓`);
else fail(`fin_payment_charges.status = ${chargeAfter?.status} (esperado 'pago')`);

if (chargeAfter?.valor_pago === 10)  pass(`valor_pago = R$10,00 ✓`);
else fail(`valor_pago = ${chargeAfter?.valor_pago}`);

if (chargeAfter?.tesouraria_lancamento_id) pass(`tesouraria_lancamento_id preenchido ✓`);
else fail(`tesouraria_lancamento_id = NULL (lançamento não criado!)`);

const { data: whe } = await sb
  .from('fin_webhook_events')
  .select('id, event_type, gateway_event_id, processed, processed_at, lancamento_id')
  .eq('charge_id', fakeGatewayChargeId)
  .eq('ministry_id', MINISTRY_ID)
  .order('received_at', { ascending: false })
  .limit(1)
  .maybeSingle();

if (whe) pass(`fin_webhook_events registrado: ${whe.id}`);
else fail('fin_webhook_events — não encontrado!');
if (whe?.processed) pass(`processed = true ✓`);
else fail('processed = false');
if (whe?.lancamento_id === chargeAfter?.tesouraria_lancamento_id) pass(`lancamento_id = tesouraria_lancamento_id ✓`);
else fail(`lancamento_id divergente: ${whe?.lancamento_id} ≠ ${chargeAfter?.tesouraria_lancamento_id}`);

info(`gateway_event_id: ${whe?.gateway_event_id}  (deve ser PAYMENT_CONFIRMED_${fakeGatewayChargeId})`);
const expectedEventId = `PAYMENT_CONFIRMED_${fakeGatewayChargeId}`;
if (whe?.gateway_event_id === expectedEventId) pass(`gateway_event_id determinístico ✓`);
else info(`gateway_event_id: '${whe?.gateway_event_id}' (obs: pode ter formato ligeiramente diferente)`);

// Verificar tesouraria_lancamentos
const lancId = chargeAfter?.tesouraria_lancamento_id;
let lancRow = null;
if (lancId) {
  const { data: lanc } = await sb
    .from('tesouraria_lancamentos')
    .select('id, ministry_id, congregacao_id, tipo_recebimento, forma_pagamento, valor, origem_modulo, origem_id, tipo_movimento, data_lancamento')
    .eq('id', lancId)
    .single();
  lancRow = lanc;

  if (lanc) pass(`tesouraria_lancamentos criado: ${lanc.id}`);
  else fail(`tesouraria_lancamentos não encontrado para id=${lancId}`);

  const checks = [
    [lanc?.congregacao_id === CONGREGACAO_ID, `congregacao_id = ${CONGREGACAO_ID} ✓`, `congregacao_id ERRADO: ${lanc?.congregacao_id}`],
    [lanc?.tipo_recebimento === 'oferta',     `tipo_recebimento = oferta ✓`,           `tipo_recebimento ERRADO: ${lanc?.tipo_recebimento}`],
    [lanc?.forma_pagamento === 'pix',         `forma_pagamento = pix ✓`,               `forma_pagamento ERRADO: ${lanc?.forma_pagamento}`],
    [lanc?.valor === 10,                       `valor = 10 ✓`,                          `valor ERRADO: ${lanc?.valor}`],
    [lanc?.origem_modulo === 'gateway',        `origem_modulo = gateway ✓`,             `origem_modulo ERRADO: ${lanc?.origem_modulo}`],
    [lanc?.origem_id === chargeId,             `origem_id = fin_payment_charges.id ✓`,  `origem_id ERRADO: ${lanc?.origem_id}`],
    [lanc?.tipo_movimento === 'entrada',       `tipo_movimento = entrada ✓`,             `tipo_movimento ERRADO: ${lanc?.tipo_movimento}`],
    [lanc?.ministry_id === MINISTRY_ID,        `ministry_id correto ✓`,                 `ministry_id ERRADO`],
  ];
  checks.forEach(([ok, passMsg, failMsg]) => ok ? pass(passMsg) : fail(failMsg));
  info(`data_lancamento: ${lanc?.data_lancamento}`);
}

// ─── PASSO 4: Idempotência — reenviar webhook ─────────────────────────────
console.log('\n━━━ PASSO 4: Reenviar webhook (idempotência) ━━━');
const wh2Resp = await apiPost(
  `/api/v1/ministry-webhook/asaas/${WEBHOOK_TOKEN}`,
  webhookPayload
);
info(`Retry — HTTP ${wh2Resp.status}: ${JSON.stringify(wh2Resp.json)}`);

if (wh2Resp.json.skipped === 'already_paid') pass('Idempotência: skipped=already_paid ✓');
else fail('Idempotência: resultado inesperado no retry: ' + JSON.stringify(wh2Resp.json));

// Contagem de lançamentos (não deve ter duplicata)
const { count: lancCount } = await sb
  .from('tesouraria_lancamentos')
  .select('id', { count: 'exact', head: true })
  .eq('origem_modulo', 'gateway')
  .eq('origem_id', chargeId);
if (lancCount === 1) pass(`Sem duplicidade: 1 lançamento para esta cobrança ✓`);
else fail(`Duplicidade! ${lancCount} lançamentos para mesma cobrança`);

const { count: whCount } = await sb
  .from('fin_webhook_events')
  .select('id', { count: 'exact', head: true })
  .eq('charge_id', fakeGatewayChargeId)
  .eq('event_type', 'PAYMENT_CONFIRMED')
  .eq('ministry_id', MINISTRY_ID);
if (whCount === 1) pass(`Sem duplicidade: 1 evento webhook para PAYMENT_CONFIRMED ✓`);
else fail(`Duplicidade! ${whCount} eventos webhook`);

// ─── PASSO 5: Visibilidade na Tesouraria ─────────────────────────────────
console.log('\n━━━ PASSO 5: Visibilidade na Tesouraria ━━━');
const mesAtual = new Date().toISOString().slice(0, 7);

const { data: dashboard } = await sb
  .from('tesouraria_lancamentos')
  .select('id, valor, tipo_recebimento')
  .eq('ministry_id', MINISTRY_ID)
  .eq('tipo_movimento', 'entrada')
  .gte('data_lancamento', `${mesAtual}-01`)
  .lte('data_lancamento', `${mesAtual}-31`);
if (dashboard?.some(l => l.id === lancId)) pass(`Dashboard: lançamento visível no mês ${mesAtual} ✓`);
else fail(`Dashboard: lançamento não encontrado`);

const { data: relatorio } = await sb
  .from('tesouraria_lancamentos')
  .select('id')
  .eq('ministry_id', MINISTRY_ID)
  .eq('origem_modulo', 'gateway')
  .eq('origem_id', chargeId);
if (relatorio?.length === 1) pass(`Relatório: origem_modulo=gateway, origem_id correto ✓`);
else fail(`Relatório: não encontrado por origem`);

const { data: fechamento } = await sb
  .from('tesouraria_lancamentos')
  .select('id')
  .eq('ministry_id', MINISTRY_ID)
  .eq('congregacao_id', CONGREGACAO_ID)
  .eq('tipo_movimento', 'entrada')
  .gte('data_lancamento', `${mesAtual}-01`)
  .lte('data_lancamento', `${mesAtual}-31`);
if (fechamento?.some(l => l.id === lancId)) pass(`Fechamento mensal: lançamento visível para congregação ✓`);
else fail(`Fechamento mensal: lançamento não encontrado`);

// ─── RESUMO ───────────────────────────────────────────────────────────────
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('EVIDÊNCIAS SQL (snapshot)');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('\nfin_payment_charges:');
console.log('  id                       :', chargeAfter?.id);
console.log('  status                   :', chargeAfter?.status);
console.log('  valor_pago               :', chargeAfter?.valor_pago);
console.log('  paid_at                  :', chargeAfter?.paid_at);
console.log('  tesouraria_lancamento_id :', chargeAfter?.tesouraria_lancamento_id);
console.log('\nfin_webhook_events:');
console.log('  id               :', whe?.id);
console.log('  event_type       :', whe?.event_type);
console.log('  gateway_event_id :', whe?.gateway_event_id);
console.log('  processed        :', whe?.processed);
console.log('  processed_at     :', whe?.processed_at);
console.log('  lancamento_id    :', whe?.lancamento_id);
console.log('\ntesouraria_lancamentos:');
console.log('  id               :', lancRow?.id);
console.log('  congregacao_id   :', lancRow?.congregacao_id);
console.log('  tipo_recebimento :', lancRow?.tipo_recebimento);
console.log('  forma_pagamento  :', lancRow?.forma_pagamento);
console.log('  valor            :', lancRow?.valor);
console.log('  origem_modulo    :', lancRow?.origem_modulo);
console.log('  origem_id        :', lancRow?.origem_id);
console.log('  tipo_movimento   :', lancRow?.tipo_movimento);
console.log('  data_lancamento  :', lancRow?.data_lancamento);
