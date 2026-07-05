// Diagnóstico: verifica estado real das colunas no banco remoto Supabase
// Roda: node diagnostico_cultos.cjs (na raiz do projeto)

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  console.log('\n=== DIAGNÓSTICO DE CONSOLIDAÇÃO DE CULTOS ===\n');

  // 1. Verificar colunas reais de culto_registros via information_schema
  const { data: colsCulto, error: e1 } = await supabase.rpc('get_table_schema', {
    p_table_name: 'culto_registros'
  });
  if (e1) {
    console.log('AVISO (get_table_schema RPC não disponível), tentando query direta...');
  } else {
    const nomes = (colsCulto || []).map(c => c.column_name);
    const esperados = ['visitantes_presentes','almas_alcancadas','reconciliacoes',
      'batismos_espirito_santo','membros_cearam','observacoes_encerramento','encerrado_em',
      'relatorio_espiritual_id','status'];
    console.log('Colunas em culto_registros:', nomes.join(', '));
    const faltando = esperados.filter(c => !nomes.includes(c));
    if (faltando.length > 0) {
      console.log('❌ FALTANDO em culto_registros:', faltando.join(', '));
    } else {
      console.log('✅ Todas as colunas esperadas existem em culto_registros');
    }
  }

  // 2. Verificar colunas reais de relatorio_espiritual_registros
  const { data: colsRel, error: e2 } = await supabase.rpc('get_table_schema', {
    p_table_name: 'relatorio_espiritual_registros'
  });
  if (e2) {
    console.log('AVISO: get_table_schema falhou para relatorio_espiritual_registros');
  } else {
    const nomes2 = (colsRel || []).map(c => c.column_name);
    const esperados2 = ['culto_id','status','data_atividade','tipo_atividade',
      'cultos_realizados','almas_alcancadas','visitantes_presentes'];
    console.log('\nColunas em relatorio_espiritual_registros:', nomes2.join(', '));
    const faltando2 = esperados2.filter(c => !nomes2.includes(c));
    if (faltando2.length > 0) {
      console.log('❌ FALTANDO em relatorio_espiritual_registros:', faltando2.join(', '));
    } else {
      console.log('✅ Todas as colunas esperadas existem em relatorio_espiritual_registros');
    }
  }

  // 3. Cultos com status Consolidado sem relatorio_espiritual_id
  const { data: cultosConsol, error: e3 } = await supabase
    .from('culto_registros')
    .select('id, data_culto, tipo_culto, status, relatorio_espiritual_id, congregacao_id');

  if (e3) {
    console.log('\nERRO ao buscar culto_registros:', e3.message);
  } else {
    const todos = cultosConsol || [];
    const consolidados = todos.filter(c => c.status === 'Consolidado');
    const semVinculo = consolidados.filter(c => !c.relatorio_espiritual_id);
    console.log(`\nTotal cultos: ${todos.length} | Consolidados: ${consolidados.length} | Sem vínculo: ${semVinculo.length}`);
    if (semVinculo.length > 0) {
      console.log('❌ Cultos CONSOLIDADOS sem relatorio_espiritual_id:');
      semVinculo.forEach(c => console.log(`   id=${c.id} data=${c.data_culto} tipo=${c.tipo_culto}`));
    } else if (consolidados.length > 0) {
      console.log('✅ Todos os cultos CONSOLIDADOS têm relatorio_espiritual_id');
    }
  }

  // 4. Últimos registros espirituais
  const { data: regs, error: e4 } = await supabase
    .from('relatorio_espiritual_registros')
    .select('id, data_atividade, tipo_atividade, status, culto_id, congregacao_id')
    .order('created_at', { ascending: false })
    .limit(10);

  if (e4) {
    console.log('\nERRO ao buscar relatorio_espiritual_registros:', e4.message);
  } else {
    const lista = regs || [];
    console.log(`\nTotal registros espirituais (últimos 10 / total busca): ${lista.length}`);
    if (lista.length === 0) {
      console.log('❌ TABELA VAZIA - nenhum registro espiritual encontrado!');
    } else {
      lista.forEach(r => {
        const d = new Date(r.data_atividade);
        const mes = d.getUTCMonth() + 1;
        const ano = d.getUTCFullYear();
        console.log(`   data=${r.data_atividade} competência=${mes}/${ano} tipo=${r.tipo_atividade} status=${r.status} culto_id=${r.culto_id || 'NULL'}`);
      });
    }
  }

  // 5. Tentar inserir um registro de teste para verificar erros de schema
  console.log('\n--- Teste de INSERT (rollback simulado via select) ---');
  const { error: eTest } = await supabase
    .from('relatorio_espiritual_registros')
    .select('culto_id')
    .limit(1);
  if (eTest) {
    console.log('❌ ERRO ao SELECT culto_id:', eTest.message, eTest.code);
  } else {
    console.log('✅ SELECT culto_id funcionou (schema cache reconhece a coluna)');
  }

  console.log('\n=== FIM DO DIAGNÓSTICO ===\n');
}

main().catch(console.error);
