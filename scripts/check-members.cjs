const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://drzafeksbddnoknvznnd.supabase.co';
const supabaseAnonKey = 'sb_publishable_Vx8gwciVm-RV-LKR1DIxOw_Oh9xX-Bg';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkMembers() {
  try {
    console.log('🔍 Verificando membros na tabela...\n');
    
    // Buscar todos os membros
    const { data: allMembers, error: error1 } = await supabase
      .from('membros')
      .select('*');

    if (error1) {
      console.error('❌ Erro ao buscar membros:', error1.message);
      return;
    }

    console.log(`📊 Total de membros: ${allMembers.length}\n`);
    
    console.log('Dados dos membros:');
    console.log('─'.repeat(100));
    allMembers.forEach((m, i) => {
      console.log(`\n${i + 1}. ${m.nome}`);
      console.log(`   ID: ${m.id}`);
      console.log(`   Status: ${m.status}`);
      console.log(`   Latitude: ${m.latitude}`);
      console.log(`   Longitude: ${m.longitude}`);
      console.log(`   Cidade: ${m.cidade}`);
      console.log(`   Tipo: ${m.tipoCadastro}`);
      console.log(`   Tem coordenadas? ${m.latitude && m.longitude ? '✅ SIM' : '❌ NÃO'}`);
    });

    console.log('\n' + '─'.repeat(100));
    console.log('\n🔍 Verificando filtro status=ativo com coordenadas...\n');

    // Buscar membros ativos com coordenadas
    const { data: activeMembers, error: error2 } = await supabase
      .from('membros')
      .select('*')
      .eq('status', 'ativo')
      .not('latitude', 'is', null)
      .not('longitude', 'is', null);

    if (error2) {
      console.error('❌ Erro:', error2.message);
      return;
    }

    console.log(`✅ Membros ATIVOS com coordenadas: ${activeMembers.length}\n`);
    activeMembers.forEach((m, i) => {
      console.log(`${i + 1}. ${m.nome} - Lat: ${m.latitude}, Lng: ${m.longitude}`);
    });

    if (activeMembers.length === 0) {
      console.log('\n⚠️  PROBLEMA ENCONTRADO:');
      console.log('   Os membros não têm:');
      console.log('   1. Status = "ativo"');
      console.log('   2. Latitude e Longitude preenchidas');
      console.log('\n💡 SOLUÇÃO:');
      console.log('   Atualize os membros com coordenadas e status "ativo"');
    }

  } catch (err) {
    console.error('❌ Erro:', err.message);
  }
}

checkMembers();
