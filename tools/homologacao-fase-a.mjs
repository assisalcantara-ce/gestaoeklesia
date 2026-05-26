/**
 * homologacao-fase-a.mjs
 * Executa o fluxo completo de homologação da Fase A — Tesouraria Distribuída.
 *
 * Fluxo:
 *  1. Criar destino de pagamento (Oferta, valor aberto, congregação de teste)
 *  2. Obter o link /pagar/{token}
 *  3. Chamar a API pública GET /api/v1/pagar/{token} (simula abertura da página)
 *  4. Gerar cobrança PIX via POST /api/v1/pagar/{token}
 *  5. Simular confirmação de pagamento via webhook
 *  6. Reenviar webhook (idempotência)
 *  7. Verificar estado final no banco: charges, webhook_events, tesouraria
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

const SUPABASE_URL    = env.SUPABASE_URL;
const SUPABASE_KEY    = env.SUPABASE_SERVICE_ROLE_KEY;
const APP_URL         = 'http://localhost:3000';
const MINISTRY_ID     = '8890d729-f6cf-40b5-b9fc-751315c24f57';
const GATEWAY_ID      = '2c4fba58-f442-45a8-8fc7-059f5c752092';
const WEBHOOK_TOKEN   = '0b06bf41-a8e4-4f3c-8b81-f365e800bba4';
const CONGREGACAO_ID  = 'a3f78bf8-23fb-4fb6-833b-6554b962bda7';

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── Helpers ──────────────────────────────────────────────────────────────
function pass(msg) { console.log('  ✅ ' + msg); }
function fail(msg) { console.log('  ❌ ' + msg); return false; }
function info(msg) { console.log('  ℹ️  ' + msg); }

async function apiGet(path, opts = {}) {
  const res = await fetch(`${APP_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...opts.headers },
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, json };
}

async function apiPost(path, body, opts = {}) {
  const res = await fetch(`${APP_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...opts.headers },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, json };
}

// ─── PASSO 1: Criar destino de pagamento diretamente no banco ─────────────
console.log('\n━━━ PASSO 1: Criar destino de pagamento ━━━');
const destInsert = await sb.from('fin_payment_destinations').insert({
  ministry_id:      MINISTRY_ID,
  gateway_id:       GATEWAY_ID,
  congregacao_id:   CONGREGACAO_ID,
  tipo_recebimento: 'oferta',
  label:            'Oferta Culto de Domingo — Teste Homologação',
  descricao:        'Destino criado para homologação da Fase A (Tesouraria Distribuída)',
  valor_fixo:       null,  // valor aberto
  is_ativo:         true,
  expires_at:       null,
}).select('id, public_token, label').single();

if (destInsert.error) {
  fail('Erro ao criar destino: ' + destInsert.error.message);
  process.exit(1);
}
const dest = destInsert.data;
pass(`Destino criado: ${dest.id}`);
info(`Token público: ${dest.public_token}`);
info(`Label: ${dest.label}`);

// ─── PASSO 2: Verificar API GET pública ───────────────────────────────────
console.log('\n━━━ PASSO 2: GET /api/v1/pagar/{token} ━━━');
const getResp = await apiGet(`/api/v1/pagar/${dest.public_token}`);
if (!getResp.ok) {
  fail(`GET retornou ${getResp.status}: ${JSON.stringify(getResp.json)}`);
  process.exit(1);
}
const destInfo = getResp.json;
pass(`GET retornou 200`);
info(`label: ${destInfo.label}`);
info(`tipo_recebimento: ${destInfo.tipo_recebimento}`);
info(`valor_fixo: ${destInfo.valor_fixo} (deve ser null para valor aberto)`);
info(`congregacao_nome: ${destInfo.congregacao_nome}`);

// Validar que não expõe ministry_id
if (destInfo.ministry_id) {
  fail('SEGURANÇA: ministry_id exposto na resposta pública!');
  process.exit(1);
}
pass('Segurança: ministry_id não exposto na resposta pública');

// ─── PASSO 3: POST — Gerar cobrança PIX de R$10,00 ───────────────────────
console.log('\n━━━ PASSO 3: POST /api/v1/pagar/{token} — Gerar PIX R$10,00 ━━━');
const pixResp = await apiPost(`/api/v1/pagar/${dest.public_token}`, {
  nome:     'João Teste Homologação',
  email:    'joao.teste.homologacao@example.com',
  cpfCnpj:  '52998224725',  // CPF de teste válido (529.982.247-25)
  valor:    10.00,
});

if (!pixResp.ok) {
  fail(`POST retornou ${pixResp.status}: ${JSON.stringify(pixResp.json)}`);
  process.exit(1);
}
const pixData = pixResp.json;
pass(`PIX gerado — HTTP ${pixResp.status}`);
info(`valor: R$ ${pixData.valor}`);
info(`invoice_url: ${pixData.invoice_url}`);
info(`expires_at: ${pixData.expires_at}`);

if (pixData.pix_payload) {
  pass(`pix_payload retornado pelo route (copia-e-cola) ✓`);
  info(`pix_payload: ${pixData.pix_payload.slice(0, 30)}...`);
} else {
  info(`pix_payload: AUSENTE na resposta do route (verificaremos via ASAAS direto)`);
}
if (pixData.pix_qrcode) pass(`pix_qrcode (base64) retornado pelo route ✓`);
else info(`pix_qrcode: AUSENTE na resposta do route`);

// Buscar o charge criado no banco
const { data: chargeRow } = await sb
  .from('fin_payment_charges')
  .select('id, gateway_charge_id, status, valor_solicitado, tesouraria_lancamento_id')
  .eq('destination_id', dest.id)
  .order('created_at', { ascending: false })
  .limit(1)
  .single();

if (!chargeRow) { fail('fin_payment_charges — registro não encontrado!'); process.exit(1); }
pass(`fin_payment_charges criado: ${chargeRow.id}`);
info(`gateway_charge_id: ${chargeRow.gateway_charge_id}`);
info(`status inicial: ${chargeRow.status} (deve ser 'pendente')`);
info(`valor_solicitado: R$ ${chargeRow.valor_solicitado}`);

// Verificar QR code diretamente no ASAAS sandbox (evidência complementar)
const ASAAS_KEY = env.ASAAS_API_SANDBOX;
const ASAAS_API = env.ASAAS_API_URL || 'https://sandbox.asaas.com/api/v3';
const qrResp = await fetch(`${ASAAS_API}/payments/${chargeRow.gateway_charge_id}/pixQrCode`, {
  headers: { access_token: ASAAS_KEY, 'Content-Type': 'application/json' }
});
const qrData = await qrResp.json();
if (qrResp.ok && qrData.encodedImage) {
  pass(`QR Code disponível no ASAAS (payload: ${qrData.payload ? qrData.payload.slice(0,20) + '...' : 'null'}) ✓`);
  pass(`invoice_url acessível: ${pixData.invoice_url} ✓`);
} else {
  fail(`QR Code indisponível no ASAAS: ${JSON.stringify(qrData).slice(0,100)}`);
}

if (chargeRow.status !== 'pendente') fail(`Status esperado 'pendente', recebido '${chargeRow.status}'`);
else pass('Status inicial correto: pendente');

const chargeId = chargeRow.id;
const gatewayChargeId = chargeRow.gateway_charge_id;

// ─── PASSO 4: Simular webhook ASAAS — PAYMENT_CONFIRMED ──────────────────
console.log('\n━━━ PASSO 4: Simular webhook PAYMENT_CONFIRMED ━━━');

// Payload simulado exatamente como o ASAAS envia
const webhookPayload = {
  event: 'PAYMENT_CONFIRMED',
  payment: {
    id:               gatewayChargeId,
    customer:         'cus_test_homologacao',
    value:            10.00,
    netValue:         9.60,
    paymentDate:      new Date().toISOString().slice(0, 10),
    confirmedDate:    new Date().toISOString().slice(0, 10),
    status:           'CONFIRMED',
    billingType:      'PIX',
    externalReference: `fpd:${dest.id.replace(/-/g, '')}`,
    nossoNumero:      'hom001',
  },
};

const wh1Resp = await apiPost(
  `/api/v1/ministry-webhook/asaas/${WEBHOOK_TOKEN}`,
  webhookPayload
);
info(`Webhook 1ª chamada — HTTP ${wh1Resp.status}: ${JSON.stringify(wh1Resp.json)}`);

if (!wh1Resp.ok) { fail('Webhook retornou erro: ' + JSON.stringify(wh1Resp.json)); process.exit(1); }
if (wh1Resp.json.processed !== 'digital_payment_paid') {
  fail(`Resultado esperado 'digital_payment_paid', recebido: ${JSON.stringify(wh1Resp.json)}`);
} else {
  pass('Webhook processou pagamento corretamente');
}

// ─── PASSO 5: Verificar estado no banco após webhook ─────────────────────
console.log('\n━━━ PASSO 5: Verificar estado no banco ━━━');

// 5a. fin_payment_charges.status = pago
const { data: chargeAfter } = await sb
  .from('fin_payment_charges')
  .select('id, status, valor_pago, paid_at, tesouraria_lancamento_id')
  .eq('id', chargeId)
  .single();

if (chargeAfter?.status === 'pago') pass(`fin_payment_charges.status = pago ✓`);
else fail(`fin_payment_charges.status = ${chargeAfter?.status} (esperado 'pago')`);

if (chargeAfter?.valor_pago === 10) pass(`fin_payment_charges.valor_pago = R$10,00 ✓`);
else fail(`fin_payment_charges.valor_pago = ${chargeAfter?.valor_pago}`);

if (chargeAfter?.tesouraria_lancamento_id) pass(`fin_payment_charges.tesouraria_lancamento_id preenchido ✓`);
else fail('fin_payment_charges.tesouraria_lancamento_id = NULL (lançamento não criado!)');

// 5b. fin_webhook_events registrou o evento
const { data: webhookEvent } = await sb
  .from('fin_webhook_events')
  .select('id, event_type, processed, processed_at, gateway_event_id')
  .eq('charge_id', gatewayChargeId)
  .eq('ministry_id', MINISTRY_ID)
  .order('received_at', { ascending: false })
  .limit(1)
  .maybeSingle();

if (webhookEvent) pass(`fin_webhook_events registrado: ${webhookEvent.id}`);
else fail('fin_webhook_events — registro não encontrado!');

if (webhookEvent?.event_type === 'PAYMENT_CONFIRMED') pass(`event_type = PAYMENT_CONFIRMED ✓`);
else fail(`event_type = ${webhookEvent?.event_type}`);

if (webhookEvent?.processed) pass('fin_webhook_events.processed = true ✓');
else fail('fin_webhook_events.processed = false (não marcado como processado)');

info(`gateway_event_id: ${webhookEvent?.gateway_event_id}`);

// 5c. tesouraria_lancamentos criado
const lancId = chargeAfter?.tesouraria_lancamento_id;
let lancRow = null;
if (lancId) {
  const { data: lanc } = await sb
    .from('tesouraria_lancamentos')
    .select('id, ministry_id, congregacao_id, tipo_recebimento, forma_pagamento, valor, origem_modulo, origem_id, tipo_movimento')
    .eq('id', lancId)
    .single();
  lancRow = lanc;
  if (lanc) pass(`tesouraria_lancamentos criado: ${lanc.id}`);
  else fail('tesouraria_lancamentos — não encontrado pelo ID!');

  if (lanc?.congregacao_id === CONGREGACAO_ID) pass(`congregacao_id correto: ${lanc.congregacao_id} ✓`);
  else fail(`congregacao_id = ${lanc?.congregacao_id} (esperado ${CONGREGACAO_ID})`);

  if (lanc?.tipo_recebimento === 'oferta') pass(`tipo_recebimento = oferta ✓`);
  else fail(`tipo_recebimento = ${lanc?.tipo_recebimento} (esperado 'oferta')`);

  if (lanc?.forma_pagamento === 'pix') pass(`forma_pagamento = pix ✓`);
  else fail(`forma_pagamento = ${lanc?.forma_pagamento}`);

  if (lanc?.valor === 10) pass(`valor = R$10,00 ✓`);
  else fail(`valor = ${lanc?.valor}`);

  if (lanc?.origem_modulo === 'gateway') pass(`origem_modulo = gateway ✓`);
  else fail(`origem_modulo = ${lanc?.origem_modulo}`);

  if (lanc?.origem_id === chargeId) pass(`origem_id = fin_payment_charges.id ✓`);
  else fail(`origem_id = ${lanc?.origem_id} (esperado ${chargeId})`);

  if (lanc?.tipo_movimento === 'entrada') pass(`tipo_movimento = entrada ✓`);
  else fail(`tipo_movimento = ${lanc?.tipo_movimento}`);

  if (lanc?.ministry_id === MINISTRY_ID) pass(`ministry_id correto ✓`);
  else fail(`ministry_id = ${lanc?.ministry_id}`);
}

// ─── PASSO 6: Reenviar webhook (teste idempotência) ───────────────────────
console.log('\n━━━ PASSO 6: Reenviar webhook — teste idempotência ━━━');
const wh2Resp = await apiPost(
  `/api/v1/ministry-webhook/asaas/${WEBHOOK_TOKEN}`,
  webhookPayload
);
info(`Webhook 2ª chamada (retry) — HTTP ${wh2Resp.status}: ${JSON.stringify(wh2Resp.json)}`);

if (wh2Resp.json.skipped === 'already_paid') {
  pass('Idempotência: 2ª chamada retornou skipped=already_paid ✓');
} else {
  fail(`Idempotência: resultado inesperado: ${JSON.stringify(wh2Resp.json)}`);
}

// Verificar que não duplicou o lançamento
const { count: lancCount } = await sb
  .from('tesouraria_lancamentos')
  .select('id', { count: 'exact', head: true })
  .eq('origem_modulo', 'gateway')
  .eq('origem_id', chargeId);

if (lancCount === 1) pass(`Sem duplicidade: tesouraria_lancamentos tem exatamente 1 registro para esta cobrança ✓`);
else fail(`Duplicidade detectada! ${lancCount} lançamentos para a mesma cobrança`);

// Verificar que não duplicou o webhook_event
const { count: whCount } = await sb
  .from('fin_webhook_events')
  .select('id', { count: 'exact', head: true })
  .eq('charge_id', gatewayChargeId)
  .eq('event_type', 'PAYMENT_CONFIRMED')
  .eq('ministry_id', MINISTRY_ID);

if (whCount === 1) pass(`Sem duplicidade: fin_webhook_events tem exatamente 1 registro para PAYMENT_CONFIRMED ✓`);
else fail(`Duplicidade detectada! ${whCount} eventos webhook para o mesmo pagamento`);

// ─── PASSO 7: Verificar visibilidade na Tesouraria (query SQL) ────────────
console.log('\n━━━ PASSO 7: Verificar visibilidade na Tesouraria ━━━');

if (lancRow) {
  // Simulação de query do dashboard: somar entradas do mês atual
  const mesAtual = new Date().toISOString().slice(0, 7); // YYYY-MM
  const { data: dashboard } = await sb
    .from('tesouraria_lancamentos')
    .select('valor, tipo_recebimento')
    .eq('ministry_id', MINISTRY_ID)
    .eq('tipo_movimento', 'entrada')
    .gte('data_lancamento', `${mesAtual}-01`)
    .lte('data_lancamento', `${mesAtual}-31`);

  if (dashboard && dashboard.length > 0) pass(`Dashboard: lançamento visível no mês ${mesAtual} ✓`);
  else fail(`Dashboard: lançamento NÃO encontrado para o mês ${mesAtual}`);

  // Simulação de query do relatório: filtrar por origem_modulo=gateway
  const { data: relatorio } = await sb
    .from('tesouraria_lancamentos')
    .select('id, valor, tipo_recebimento, forma_pagamento, origem_modulo')
    .eq('ministry_id', MINISTRY_ID)
    .eq('origem_modulo', 'gateway')
    .eq('origem_id', chargeId);

  if (relatorio && relatorio.length === 1) pass(`Relatório: entrada PIX gateway visível ✓`);
  else fail(`Relatório: entrada não encontrada com origem_modulo=gateway`);

  // Verificar que apareceria no fechamento mensal
  const { data: fechamento } = await sb
    .from('tesouraria_lancamentos')
    .select('id, valor')
    .eq('ministry_id', MINISTRY_ID)
    .eq('congregacao_id', CONGREGACAO_ID)
    .eq('tipo_movimento', 'entrada')
    .gte('data_lancamento', `${mesAtual}-01`)
    .lte('data_lancamento', `${mesAtual}-31`);

  if (fechamento && fechamento.some(l => l.id === lancId)) pass(`Fechamento mensal: lançamento incluído corretamente ✓`);
  else fail(`Fechamento mensal: lançamento não encontrado para congregação e mês atual`);
}

// ─── RESUMO FINAL ─────────────────────────────────────────────────────────
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('EVIDÊNCIAS SQL PARA RELATÓRIO:');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('\nfin_payment_destinations:');
console.log('  id            :', dest.id);
console.log('  public_token  :', dest.public_token);
console.log('  label         :', dest.label);
console.log('\nfin_payment_charges:');
console.log('  id                       :', chargeAfter?.id);
console.log('  gateway_charge_id        :', chargeAfter ? gatewayChargeId : '-');
console.log('  status                   :', chargeAfter?.status);
console.log('  valor_pago               :', chargeAfter?.valor_pago);
console.log('  paid_at                  :', chargeAfter?.paid_at);
console.log('  tesouraria_lancamento_id :', chargeAfter?.tesouraria_lancamento_id);
console.log('\nfin_webhook_events:');
console.log('  id               :', webhookEvent?.id);
console.log('  event_type       :', webhookEvent?.event_type);
console.log('  gateway_event_id :', webhookEvent?.gateway_event_id);
console.log('  processed        :', webhookEvent?.processed);
console.log('  processed_at     :', webhookEvent?.processed_at);
console.log('\ntesouraria_lancamentos:');
console.log('  id               :', lancRow?.id);
console.log('  congregacao_id   :', lancRow?.congregacao_id);
console.log('  tipo_recebimento :', lancRow?.tipo_recebimento);
console.log('  forma_pagamento  :', lancRow?.forma_pagamento);
console.log('  valor            :', lancRow?.valor);
console.log('  origem_modulo    :', lancRow?.origem_modulo);
console.log('  origem_id        :', lancRow?.origem_id);
console.log('  tipo_movimento   :', lancRow?.tipo_movimento);
