const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://drzafeksbddnoknvznnd.supabase.co';
const supabaseAnonKey = 'sb_publishable_Vx8gwciVm-RV-LKR1DIxOw_Oh9xX-Bg';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function createCongregacoes() {
  try {
    console.log('✓ Conectado ao Supabase');
    
    // Inserir congregações
    const { data, error } = await supabase
      .from('congregacoes')
      .insert([
        {
          nome: 'Congregação Central',
          endereco: 'Rua das Flores',
          numero: '123',
          bairro: 'Centro',
          cidade: 'Manaus',
          estado: 'AM',
          latitude: -3.1190,
          longitude: -60.0217,
          status: 'ativo',
          pastor_responsavel: 'Pastor João da Silva',
          data_fundacao: '2010-01-15'
        },
        {
          nome: 'Congregação Nazaré',
          endereco: 'Avenida Getúlio Vargas',
          numero: '456',
          bairro: 'Nazaré',
          cidade: 'Manaus',
          estado: 'AM',
          latitude: -3.0900,
          longitude: -60.0300,
          status: 'ativo',
          pastor_responsavel: 'Pastor Pedro Costa',
          data_fundacao: '2012-03-20'
        },
        {
          nome: 'Congregação Chapada',
          endereco: 'Avenida Djalma Batista',
          numero: '321',
          bairro: 'Chapada',
          cidade: 'Manaus',
          estado: 'AM',
          latitude: -3.0500,
          longitude: -60.0500,
          status: 'ativo',
          pastor_responsavel: 'Pastor Carlos Mendes',
          data_fundacao: '2015-06-10'
        },
        {
          nome: 'Congregação Educandos',
          endereco: 'Rua Nhamundá',
          numero: '654',
          bairro: 'Educandos',
          cidade: 'Manaus',
          estado: 'AM',
          latitude: -3.1400,
          longitude: -60.0100,
          status: 'inativo',
          pastor_responsavel: 'Pastor Roberto Alves',
          data_fundacao: '2008-11-05'
        },
        {
          nome: 'Congregação Raiz',
          endereco: 'Avenida Brasil',
          numero: '987',
          bairro: 'Raiz',
          cidade: 'Manaus',
          estado: 'AM',
          latitude: -3.0800,
          longitude: -60.0600,
          status: 'ativo',
          pastor_responsavel: 'Pastor Juliana Ribeiro',
          data_fundacao: '2018-04-12'
        }
      ]);

    if (error) {
      console.error('❌ Erro ao inserir congregações:', error.message);
    } else {
      console.log('✅ Congregações criadas com sucesso!');
      console.log(`📍 ${data.length} congregações inseridas:`);
      data.forEach(c => {
        console.log(`   - ${c.nome} (${c.cidade})`);
      });
    }
  } catch (err) {
    console.error('❌ Erro:', err.message);
  }
}

createCongregacoes();
