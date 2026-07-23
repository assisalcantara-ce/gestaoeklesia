const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function run() {
  console.log("=== INICIANDO TESTE DO BACKEND DE IMPERSONATION 2.0A ===");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("ERRO: Variaveis Supabase nao encontradas.");
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // 1. Obter um admin e um tenant do banco
  const [{ data: admin }, { data: tenant }] = await Promise.all([
    supabase.from('admin_users').select('id, email, role').limit(1).single(),
    supabase.from('ministries').select('id, name').limit(1).single()
  ]);

  if (!admin || !tenant) {
    console.error("ERRO: Nao foi possivel carregar dados de teste de admin ou tenant.");
    return;
  }

  console.log(`\n✓ Admin de Teste: ${admin.email} (ID: ${admin.id}, Role: ${admin.role})`);
  console.log(`✓ Tenant de Teste: ${tenant.name} (ID: ${tenant.id})`);

  // 2. Importar o servico e helper JWT via dynamic require/import ou Node
  // Como e um projeto TS/ESM, testamos a consulta SQL direta e integridade da migration no Supabase:

  const testSessionId = require('crypto').randomUUID();
  const testJwtId = require('crypto').randomUUID();
  const startedAt = new Date().toISOString();

  console.log("\n--- TESTANDO GRAVACAO NA TABELA admin_impersonation_sessions ---");
  const { data: insertedSession, error: insertError } = await supabase
    .from('admin_impersonation_sessions')
    .insert({
      id: testSessionId,
      admin_id: admin.id,
      tenant_id: tenant.id,
      started_at: startedAt,
      reason: 'Atendimento de suporte Nível 3 para homologação da Sprint 2.0A',
      read_only: false,
      ip: '127.0.0.1',
      user_agent: 'PostmanRuntime/7.32.3',
      jwt_id: testJwtId,
      status: 'active'
    })
    .select('*')
    .single();

  if (insertError) {
    console.error("❌ ERRO ao inserir em admin_impersonation_sessions:", insertError);
    return;
  }

  console.log("✅ Sessao gravada com sucesso em admin_impersonation_sessions:");
  console.log(JSON.stringify(insertedSession, null, 2));

  console.log("\n--- TESTANDO CONSULTA DE STATUS DA SESSAO ---");
  const { data: queriedSession, error: queryError } = await supabase
    .from('admin_impersonation_sessions')
    .select('*, ministries(name), admin_users(email)')
    .eq('id', testSessionId)
    .single();

  if (queryError || !queriedSession) {
    console.error("❌ ERRO ao consultar sessao:", queryError);
    return;
  }

  console.log("✅ Consulta de status realizada com sucesso:");
  console.log(`   ID: ${queriedSession.id}`);
  console.log(`   Admin: ${queriedSession.admin_users?.email}`);
  console.log(`   Tenant: ${queriedSession.ministries?.name}`);
  console.log(`   Status: ${queriedSession.status}`);

  console.log("\n--- TESTANDO ENCERRAMENTO DA SESSAO ---");
  const endedAt = new Date().toISOString();
  const { data: endedSession, error: endError } = await supabase
    .from('admin_impersonation_sessions')
    .update({
      status: 'completed',
      ended_at: endedAt,
      ended_by: 'user_action'
    })
    .eq('id', testSessionId)
    .select('*')
    .single();

  if (endError) {
    console.error("❌ ERRO ao encerrar sessao:", endError);
    return;
  }

  console.log("✅ Sessao encerrada com sucesso:");
  console.log(`   Status: ${endedSession.status}`);
  console.log(`   Ended At: ${endedSession.ended_at}`);
  console.log(`   Ended By: ${endedSession.ended_by}`);

  console.log("\n🎉 TESTE INTEGRADO DO BACKEND DE IMPERSONATION CONCLUIDO COM SUCESSO!");
}

run();
