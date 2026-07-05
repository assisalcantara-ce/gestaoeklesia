// Diagnóstico avançado — consolidação de cultos
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  console.log('\n=== DIAGNÓSTICO AVANÇADO — CONSOLIDAÇÃO DE CULTOS ===\n');

  // 1. Verificar colunas via information_schema (service_role ignora RLS)
  let cols = null;
  try {
    const res = await supabase.rpc('execute_sql', { sql: `
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'relatorio_espiritual_registros'
      ORDER BY ordinal_position;
    `});
    cols = res.data;
  } catch (_) { cols = null; }

  if (!cols) {
    // Fallback: tentar via select direto
    const { data: sampleRow, error: eSample } = await supabase
      .from('relatorio_espiritual_registros')
      .select('*')
      .limit(1);
    if (eSample) {
      console.log('❌ ERRO ao acessar relatorio_espiritual_registros:', eSample.message, eSample.code);
    } else if (sampleRow && sampleRow.length > 0) {
      console.log('✅ Colunas de relatorio_espiritual_registros (via sample row):');
      console.log('  ', Object.keys(sampleRow[0]).join(', '));
      const hasCultoId = 'culto_id' in sampleRow[0];
      console.log(hasCultoId ? '✅ culto_id presente' : '❌ culto_id AUSENTE');
    } else {
      console.log('⚠️  Tabela vazia — tentando SELECT de colunas via INSERT vazio...');
    }
  } else {
    console.log('Colunas de relatorio_espiritual_registros:');
    (cols || []).forEach(c => {
      console.log(`  ${c.column_name}: ${c.data_type} nullable=${c.is_nullable} default=${c.column_default || 'none'}`);
    });
  }

  // 2. Tentar SELECT de culto_id diretamente
  console.log('\n--- Teste: SELECT culto_id ---');
  const { data: testSelect, error: eSelect } = await supabase
    .from('relatorio_espiritual_registros')
    .select('id, culto_id, data_atividade, status, congregacao_id')
    .limit(5);
  if (eSelect) {
    console.log('❌ SELECT falhou:', eSelect.message, '| Code:', eSelect.code);
  } else {
    console.log(`✅ SELECT culto_id OK — ${(testSelect||[]).length} registro(s) encontrado(s)`);
    (testSelect||[]).forEach(r => {
      const d = new Date(r.data_atividade);
      console.log(`  id=${r.id.substring(0,8)}... data=${r.data_atividade} competência=${d.getUTCMonth()+1}/${d.getUTCFullYear()} culto_id=${r.culto_id || 'NULL'} status=${r.status}`);
    });
  }

  // 3. Verificar cultos e seu estado
  console.log('\n--- Estado dos Cultos ---');
  const { data: cultos, error: eCultos } = await supabase
    .from('culto_registros')
    .select('id, data_culto, tipo_culto, status, relatorio_espiritual_id, congregacao_id, ministry_id')
    .order('data_culto', { ascending: false });

  if (eCultos) {
    console.log('❌ ERRO ao buscar culto_registros:', eCultos.message, eCultos.code);
  } else {
    const todos = cultos || [];
    const consolidados = todos.filter(c => c.status === 'Consolidado');
    const encerrados = todos.filter(c => c.status === 'Encerrado');
    const abertos = todos.filter(c => c.status === 'Aberto');
    const orfaos = consolidados.filter(c => !c.relatorio_espiritual_id);

    console.log(`Total: ${todos.length} | Abertos: ${abertos.length} | Encerrados: ${encerrados.length} | Consolidados: ${consolidados.length}`);

    if (orfaos.length > 0) {
      console.log(`\n❌ ALERTA: ${orfaos.length} culto(s) CONSOLIDADO(s) SEM relatorio_espiritual_id:`);
      orfaos.forEach(c => {
        const d = new Date(c.data_culto);
        const comp = `${d.getUTCMonth()+1}/${d.getUTCFullYear()}`;
        console.log(`   → id=${c.id} data=${c.data_culto} (competência ${comp}) tipo=${c.tipo_culto}`);
      });
    } else if (consolidados.length > 0) {
      console.log('✅ Todos os cultos CONSOLIDADOS têm relatorio_espiritual_id');
      consolidados.forEach(c => {
        const d = new Date(c.data_culto);
        const comp = `${d.getUTCMonth()+1}/${d.getUTCFullYear()}`;
        console.log(`   → data=${c.data_culto} (competência ${comp}) relatorio_id=${c.relatorio_espiritual_id?.substring(0,8)}...`);
      });
    }

    if (encerrados.length > 0) {
      console.log(`\nCultos ENCERRADOS (prontos para consolidar):`);
      encerrados.forEach(c => {
        const d = new Date(c.data_culto);
        const comp = `${d.getUTCMonth()+1}/${d.getUTCFullYear()}`;
        console.log(`   → data=${c.data_culto} (competência ${comp}) tipo=${c.tipo_culto}`);
      });
    }
  }

  // 4. Verificar RLS — testar com anon (simula usuário não autenticado)
  console.log('\n--- Teste: INSERT de registro espiritual (service_role) ---');
  const { data: firstCultoEncerrado } = await supabase
    .from('culto_registros')
    .select('*')
    .eq('status', 'Encerrado')
    .limit(1)
    .maybeSingle();

  if (firstCultoEncerrado) {
    console.log(`Tentando consolidar culto ${firstCultoEncerrado.id.substring(0,8)}... (${firstCultoEncerrado.data_culto})...`);
    // Verificar se já existe
    const { data: existing } = await supabase
      .from('relatorio_espiritual_registros')
      .select('id')
      .eq('culto_id', firstCultoEncerrado.id)
      .maybeSingle();

    if (existing) {
      console.log('⚠️  Já existe registro para este culto — pulando INSERT de teste');
    } else {
      const { data: inserted, error: eInsert } = await supabase
        .from('relatorio_espiritual_registros')
        .insert({
          ministry_id: firstCultoEncerrado.ministry_id,
          congregacao_id: firstCultoEncerrado.congregacao_id,
          culto_id: firstCultoEncerrado.id,
          data_atividade: firstCultoEncerrado.data_culto,
          tipo_atividade: 'Culto',
          cultos_realizados: 1,
          visitantes_presentes: firstCultoEncerrado.visitantes_presentes ?? 0,
          almas_alcancadas: firstCultoEncerrado.almas_alcancadas ?? 0,
          reconciliacoes: firstCultoEncerrado.reconciliacoes ?? 0,
          batismos_espirito_santo: firstCultoEncerrado.batismos_espirito_santo ?? 0,
          curas_divinas: firstCultoEncerrado.curas_divinas ?? 0,
          biblias_doadas: firstCultoEncerrado.biblias_doadas ?? 0,
          literaturas_entregues: firstCultoEncerrado.literaturas_entregues ?? 0,
          membros_cearam: firstCultoEncerrado.membros_cearam ?? 0,
          observacoes: firstCultoEncerrado.observacoes_encerramento ?? null,
          status: 'Enviado'
        })
        .select('id')
        .single();

      if (eInsert) {
        console.log('❌ INSERT FALHOU:', eInsert.message, '| Code:', eInsert.code, '| Details:', eInsert.details);
        if (eInsert.code === '42703') console.log('→ CAUSA: coluna não existe no schema (schema cache desatualizado)');
        if (eInsert.code === '23503') console.log('→ CAUSA: violação de foreign key');
        if (eInsert.code === '42501') console.log('→ CAUSA: violação de RLS (permissão negada)');
      } else {
        console.log(`✅ INSERT OK — id=${inserted?.id?.substring(0,8)}...`);
        // Limpar registro de teste
        if (inserted?.id) {
          await supabase.from('relatorio_espiritual_registros').delete().eq('id', inserted.id);
          console.log('   (registro de teste removido)');
        }
      }
    }
  } else {
    console.log('Nenhum culto ENCERRADO disponível para teste de INSERT');
  }

  // 5. Verificar campos NOT NULL sem default em relatorio_espiritual_registros
  console.log('\n--- Verificação de campos obrigatórios ---');
  const { data: testEmpty, error: eEmpty } = await supabase
    .from('relatorio_espiritual_registros')
    .insert({
      ministry_id: '00000000-0000-0000-0000-000000000000',
      data_atividade: '2026-01-01',
      tipo_atividade: 'Culto',
      cultos_realizados: 1,
      status: 'Rascunho'
    })
    .select('id')
    .single();
  if (eEmpty) {
    if (eEmpty.code === '23503') {
      console.log('✅ Campos base OK (FK violada como esperado para ministry_id falso)');
    } else {
      console.log(`Erro ao testar campos: ${eEmpty.message} [${eEmpty.code}]`);
      if (eEmpty.code === '23502') console.log('→ Campo NOT NULL sem default encontrado!');
    }
  } else {
    // Limpar
    if (testEmpty?.id) await supabase.from('relatorio_espiritual_registros').delete().eq('id', testEmpty.id);
    console.log('✅ Todos os campos obrigatórios têm defaults');
  }

  console.log('\n=== FIM DO DIAGNÓSTICO ===\n');
}

main().catch(console.error);
