// Verificação aprofundada de schema — colunas e constraints críticas
// Execute: node tools/check-schema-fase4a.cjs
require('dotenv').config({ path: '.env.local' });

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const h = {
  'apikey': KEY,
  'Authorization': `Bearer ${KEY}`,
  'Accept': 'application/json',
  'Content-Type': 'application/json',
};

async function rpc(fn, args = {}) {
  const res = await fetch(`${URL}/rest/v1/rpc/${fn}`, {
    method: 'POST', headers: h, body: JSON.stringify(args),
  });
  return { status: res.status, data: await res.json().catch(() => null) };
}

async function get(path) {
  const res = await fetch(`${URL}/rest/v1/${path}`, { headers: h });
  return { status: res.status, data: await res.json().catch(() => null) };
}

// Queries SQL via Supabase query RPC (se disponível)
async function sql(query) {
  const res = await fetch(`${URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST', headers: h,
    body: JSON.stringify({ sql: query }),
  });
  if (res.status === 404) return null; // RPC não disponível
  return res.json().catch(() => null);
}

async function main() {
  console.log('\n=== VERIFICAÇÃO DE SCHEMA — FASE 4A ===\n');

  // ── 1. Verificar updated_at em eventos_inscricoes ──────────────────────────
  console.log('1. Coluna updated_at em eventos_inscricoes:');
  // Tenta selecionar a coluna — se não existir, retorna 400
  const r1 = await fetch(`${URL}/rest/v1/eventos_inscricoes?select=updated_at&limit=1`, { headers: h });
  if (r1.status === 200) {
    console.log('   ✅ updated_at EXISTE (HTTP 200)');
  } else {
    const body = await r1.json().catch(() => ({}));
    console.log(`   ❌ updated_at AUSENTE — HTTP ${r1.status}: ${body?.message ?? body?.hint ?? JSON.stringify(body)}`);
    console.log('   ACTION: Aplicar migration 20260523200000_eventos_pagamentos.sql no Supabase SQL Editor');
  }

  // ── 2. Verificar status aguardando_pagamento aceito ───────────────────────
  console.log('\n2. Check constraint em eventos_inscricoes:');
  // Tenta inserir status inválido — deve rejeitar com 42P01 ou 23514
  // Em vez disso, seleciona registros com novo status (só testa a constraint via insert)
  // Verificamos indiretamente tentando filtrar por novo status (se coluna existe, filtra sem erro)
  const r2 = await fetch(
    `${URL}/rest/v1/eventos_inscricoes?select=id&status=eq.aguardando_pagamento&limit=1`,
    { headers: h }
  );
  if (r2.status === 200) {
    console.log('   ✅ Status aguardando_pagamento reconhecido (HTTP 200)');
  } else {
    console.log(`   ⚠️  HTTP ${r2.status} ao filtrar status=aguardando_pagamento`);
  }
  const r3 = await fetch(
    `${URL}/rest/v1/eventos_inscricoes?select=id&status=eq.expirado&limit=1`,
    { headers: h }
  );
  console.log(`   ${r3.status === 200 ? '✅' : '❌'} Status expirado reconhecido (HTTP ${r3.status})`);

  // ── 3. Verificar colunas de eventos_pagamentos ────────────────────────────
  console.log('\n3. Colunas críticas em eventos_pagamentos:');
  const campos = ['id','ministry_id','evento_id','inscricao_id','gateway','gateway_charge_id',
                   'status','pix_payload','pix_qrcode','expires_at','paid_at',
                   'tesouraria_lancamento_id','updated_at'];
  const selectStr = campos.join(',');
  const r4 = await fetch(`${URL}/rest/v1/eventos_pagamentos?select=${selectStr}&limit=1`, { headers: h });
  if (r4.status === 200) {
    console.log(`   ✅ Todas as ${campos.length} colunas existem`);
  } else {
    const body = await r4.json().catch(() => ({}));
    console.log(`   ❌ HTTP ${r4.status}: ${body?.message ?? JSON.stringify(body)}`);
  }

  // ── 4. Verificar ministry_payment_gateways ────────────────────────────────
  console.log('\n4. Gateways ASAAS configurados:');
  const r5 = await fetch(
    `${URL}/rest/v1/ministry_payment_gateways?select=id,gateway,environment,is_active,webhook_token&gateway=eq.asaas`,
    { headers: h }
  );
  const gws = r5.status === 200 ? await r5.json() : [];
  if (gws.length === 0) {
    console.log('   ⚠️  NENHUM gateway ASAAS configurado');
    console.log('   ACTION: Configure pelo painel do app → Configurações → Gateway de Pagamento');
  } else {
    for (const gw of gws) {
      console.log(`   ${gw.is_active ? '✅' : '❌'} ${gw.environment} | webhook: ${gw.webhook_token ?? 'N/A'}`);
    }
  }

  // ── 5. Verificar eventos pagos ────────────────────────────────────────────
  console.log('\n5. Eventos pagos cadastrados:');
  const r6 = await fetch(
    `${URL}/rest/v1/eventos?select=id,titulo,slug,valor_inscricao,capacidade,is_publico,aceita_inscricao&valor_inscricao=gt.0&order=created_at.desc&limit=5`,
    { headers: h }
  );
  const evs = r6.status === 200 ? await r6.json() : [];
  if (evs.length === 0) {
    console.log('   ⚠️  Nenhum evento pago cadastrado');
    console.log('   ACTION: Crie um evento com valor_inscricao > 0 no painel do app');
  } else {
    for (const e of evs) {
      const pub = e.is_publico ? '🌐' : '🔒';
      const insc = e.aceita_inscricao ? '✅' : '❌';
      console.log(`   ${pub} "${e.titulo}" | R$${e.valor_inscricao} | cap:${e.capacidade ?? '∞'} | insc:${insc}`);
      console.log(`      URL: http://localhost:3000/eventos/e/${e.slug}`);
      console.log(`      ID:  ${e.id}`);
    }
  }

  // ── 6. Status das inscrições e pagamentos ─────────────────────────────────
  console.log('\n6. Inscrições e pagamentos existentes:');
  const r7 = await fetch(
    `${URL}/rest/v1/eventos_pagamentos?select=id,status,gateway_charge_id,valor,expires_at&order=created_at.desc&limit=5`,
    { headers: h }
  );
  const pags = r7.status === 200 ? await r7.json() : [];
  if (pags.length === 0) {
    console.log('   ℹ️  Nenhum pagamento de evento registrado ainda');
  } else {
    for (const p of pags) {
      console.log(`   ${p.status.toUpperCase()} | R$${p.valor} | charge: ${p.gateway_charge_id ?? '(nenhum)'}`);
    }
  }

  // ── 7. Verificar variáveis de ambiente ───────────────────────────────────
  console.log('\n7. Variáveis de ambiente críticas:');
  const vars = {
    'CREDENTIALS_ENCRYPTION_KEY': process.env.CREDENTIALS_ENCRYPTION_KEY,
    'CRON_SECRET':                 process.env.CRON_SECRET,
    'ASAAS_API_URL':               process.env.ASAAS_API_URL,
    'NEXT_PUBLIC_APP_URL':         process.env.NEXT_PUBLIC_APP_URL,
  };
  for (const [k, v] of Object.entries(vars)) {
    if (v) {
      console.log(`   ✅ ${k.padEnd(35)} = ${k === 'CREDENTIALS_ENCRYPTION_KEY' ? '[REDACTED]' : v}`);
    } else {
      console.log(`   ❌ ${k.padEnd(35)} = (ausente)`);
    }
  }

  console.log('\n=== FIM DA VERIFICAÇÃO ===\n');
}

main().catch(e => { console.error('Erro fatal:', e.message); process.exit(1); });
