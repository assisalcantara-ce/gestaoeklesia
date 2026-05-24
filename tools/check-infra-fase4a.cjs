// Script de verificação de infraestrutura para homologação Fase 4A
// Execute: node tools/check-infra-fase4a.js
require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausentes no .env.local');
  process.exit(1);
}

async function query(sql) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/`, {
    method: 'POST',
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });
  return res;
}

async function checkTable(tableName) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/${tableName}?select=count&limit=0`,
    {
      method: 'GET',
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Accept': 'application/json',
        'Prefer': 'count=exact',
      },
    }
  );
  return { status: res.status, headers: Object.fromEntries(res.headers) };
}

async function main() {
  console.log('\n=== FASE 1 — VERIFICAÇÃO DE INFRAESTRUTURA ===\n');
  console.log(`Projeto: ${SUPABASE_URL}\n`);

  const tabelas = [
    'eventos_pagamentos',
    'eventos_inscricoes',
    'eventos',
    'ministry_payment_gateways',
    'tesouraria_lancamentos',
  ];

  for (const t of tabelas) {
    const r = await checkTable(t);
    if (r.status === 200) {
      const count = r.headers['content-range'] ?? 'n/a';
      console.log(`✅ ${t.padEnd(35)} HTTP ${r.status}  count: ${count}`);
    } else if (r.status === 404) {
      console.log(`❌ ${t.padEnd(35)} HTTP ${r.status}  NÃO EXISTE`);
    } else {
      console.log(`⚠️  ${t.padEnd(35)} HTTP ${r.status}`);
    }
  }

  console.log('\n=== FASE 2 — GATEWAY ===\n');
  const gwRes = await fetch(
    `${SUPABASE_URL}/rest/v1/ministry_payment_gateways?select=id,gateway,environment,is_active,webhook_token&limit=5`,
    {
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Accept': 'application/json',
      },
    }
  );
  if (gwRes.status === 200) {
    const gws = await gwRes.json();
    if (gws.length === 0) {
      console.log('⚠️  Nenhum gateway configurado. Configure pelo painel do app.');
    } else {
      for (const gw of gws) {
        const ativo = gw.is_active ? '✅ ATIVO' : '❌ INATIVO';
        console.log(`Gateway: ${gw.gateway} | ${gw.environment} | ${ativo}`);
        console.log(`  webhook_token: ${gw.webhook_token ?? '(nenhum)'}`);
      }
    }
  } else {
    console.log('⚠️  Não foi possível consultar gateways.');
  }

  console.log('\n=== FASE 3 — EVENTOS PAGOS ===\n');
  const evRes = await fetch(
    `${SUPABASE_URL}/rest/v1/eventos?select=id,titulo,slug,valor_inscricao,capacidade,is_publico,aceita_inscricao&valor_inscricao=gt.0&limit=5`,
    {
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Accept': 'application/json',
      },
    }
  );
  if (evRes.status === 200) {
    const evs = await evRes.json();
    if (evs.length === 0) {
      console.log('⚠️  Nenhum evento pago encontrado. Crie um pelo painel.');
    } else {
      for (const e of evs) {
        console.log(`Evento: "${e.titulo}" | slug: ${e.slug} | R$ ${e.valor_inscricao} | cap: ${e.capacidade}`);
        console.log(`  publico: ${e.is_publico} | aceita_inscricao: ${e.aceita_inscricao}`);
      }
    }
  }

  console.log('\n=== RESUMO ===\n');
  console.log('Verifique acima quais tabelas estão marcadas com ❌.');
  console.log('Se eventos_pagamentos aparecer com ❌, aplique a migration:');
  console.log('  supabase/migrations/20260523200000_eventos_pagamentos.sql');
  console.log('\nPróximo passo: configure o gateway ASAAS sandbox no painel do app.');
}

main().catch(e => { console.error(e); process.exit(1); });
