#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://drzafeksbddnoknvznnd.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_Vx8gwciVm-RV-LKR1DIxOw_Oh9xX-Bg'
);

async function main() {
  try {
    console.log('🔍 Verificando estrutura da tabela members...\n');

    // Tentar buscar 1 membro para ver a estrutura
    const { data: members, error: errorMembers } = await supabase
      .from('members')
      .select('*')
      .limit(1);

    if (errorMembers) {
      console.log('❌ Erro ao buscar members:', errorMembers.message);
      return;
    }

    if (members && members.length > 0) {
      console.log('✅ Tabela members existe\n');
      console.log('📋 Campos encontrados:');
      const campos = Object.keys(members[0]);
      campos.forEach((campo, i) => {
        console.log(`  ${i + 1}. ${campo}`);
      });
      
      console.log('\n📊 Exemplo de registro:');
      console.log(JSON.stringify(members[0], null, 2));
    } else {
      console.log('⚠️  Tabela members vazia');
    }

    // Tentar buscar congregacoes
    console.log('\n\n🔍 Verificando tabela congregacoes...\n');
    const { data: congregacoes, error: errorCongregacoes } = await supabase
      .from('congregacoes')
      .select('*')
      .limit(1);

    if (errorCongregacoes) {
      console.log('❌ Erro ao buscar congregacoes:', errorCongregacoes.message);
    } else if (congregacoes && congregacoes.length > 0) {
      console.log('✅ Tabela congregacoes existe\n');
      console.log('📋 Campos encontrados:');
      const campos = Object.keys(congregacoes[0]);
      campos.forEach((campo, i) => {
        console.log(`  ${i + 1}. ${campo}`);
      });
      
      console.log('\n📊 Exemplo de registro:');
      console.log(JSON.stringify(congregacoes[0], null, 2));
    } else {
      console.log('⚠️  Tabela congregacoes vazia ou não existe');
    }

  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

main();
