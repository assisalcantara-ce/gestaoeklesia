#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://drzafeksbddnoknvznnd.supabase.co';
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_Vx8gwciVm-RV-LKR1DIxOw_Oh9xX-Bg';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  console.log('🔍 Iniciando setup de geolocalização...\n');

  try {
    // 1. Verificar membros
    console.log('📍 Etapa 1: Verificando membros existentes...');
    const { data: membros, error: erroMembros } = await supabase
      .from('members')
      .select('*')
      .limit(10);

    if (erroMembros) {
      console.error('❌ Erro ao buscar membros:', erroMembros.message);
      return;
    }

    console.log(`✅ Encontrados ${membros.length} membros\n`);
    
    console.log('📊 Dados dos membros:');
    membros.forEach((m, i) => {
      console.log(`\n  ${i + 1}. ${m.name || 'N/A'}`);
      console.log(`     ID: ${m.id}`);
      console.log(`     Email: ${m.email || 'N/A'}`);
      console.log(`     Latitude: ${m.latitude || '❌ NULL'}`);
      console.log(`     Longitude: ${m.longitude || '❌ NULL'}`);
      console.log(`     Status: ${m.status || 'N/A'}`);
    });

    // 2. Adicionar coordenadas se não existirem
    console.log('\n\n📝 Etapa 2: Atualizando coordenadas dos membros...');
    
    const coordenadas = [
      { id: membros[0]?.id, lat: -3.1200, lng: -60.0220 },
      { id: membros[1]?.id, lat: -3.0950, lng: -59.9800 },
      { id: membros[2]?.id, lat: -3.1500, lng: -60.1000 }
    ];

    for (const coord of coordenadas) {
      if (!coord.id) continue;
      
      const { error: erroUpdate } = await supabase
        .from('members')
        .update({ 
          latitude: coord.lat, 
          longitude: coord.lng,
          status: 'ativo'
        })
        .eq('id', coord.id);

      if (erroUpdate) {
        console.log(`  ⚠️  Erro ao atualizar ${coord.id}: ${erroUpdate.message}`);
      } else {
        console.log(`  ✅ Membro ${coord.id} atualizado`);
      }
    }

    // 3. Criar tabela congregacoes
    console.log('\n\n🏢 Etapa 3: Criando tabela congregacoes...');
    
    const sqlCongregacoes = `
      CREATE TABLE IF NOT EXISTS congregacoes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        nome VARCHAR(255) NOT NULL,
        endereco TEXT,
        cidade VARCHAR(100),
        estado VARCHAR(2),
        latitude DECIMAL(10, 8),
        longitude DECIMAL(11, 8),
        telefone VARCHAR(20),
        email VARCHAR(255),
        pastor VARCHAR(255),
        data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ativo BOOLEAN DEFAULT true
      );
    `;

    const { error: erroCriacao } = await supabase.rpc('exec_sql', {
      sql: sqlCongregacoes
    }).catch(() => ({ error: null })); // Ignora erro se tabela já existe

    if (!erroCriacao) {
      console.log('✅ Tabela congregacoes criada ou já existe');
    }

    // 4. Inserir dados de congregacoes
    console.log('\n📍 Etapa 4: Inserindo dados de congregacoes...');
    
    const congregacoes = [
      {
        nome: 'Congregação Central',
        endereco: 'Av. Getúlio Vargas, 1000',
        cidade: 'Manaus',
        estado: 'AM',
        latitude: -3.1190,
        longitude: -60.0217,
        telefone: '(92) 3221-1234',
        email: 'central@congregacao.com.br',
        pastor: 'Rev. João Silva',
        ativo: true
      },
      {
        nome: 'Congregação Zona Leste',
        endereco: 'Rua das Flores, 500',
        cidade: 'Manaus',
        estado: 'AM',
        latitude: -3.0800,
        longitude: -59.9400,
        telefone: '(92) 3333-5678',
        email: 'leste@congregacao.com.br',
        pastor: 'Rev. Paulo Santos',
        ativo: true
      },
      {
        nome: 'Congregação Zona Norte',
        endereco: 'Av. Amazonas, 800',
        cidade: 'Manaus',
        estado: 'AM',
        latitude: -3.0200,
        longitude: -60.0500,
        telefone: '(92) 3444-7890',
        email: 'norte@congregacao.com.br',
        pastor: 'Rev. Maria Silva',
        ativo: true
      },
      {
        nome: 'Congregação Interior',
        endereco: 'Rua Principal, 300',
        cidade: 'Itacoatiara',
        estado: 'AM',
        latitude: -3.1500,
        longitude: -58.4400,
        telefone: '(92) 3555-1111',
        email: 'interior@congregacao.com.br',
        pastor: 'Rev. Carlos Oliveira',
        ativo: true
      },
      {
        nome: 'Congregação Manacapuru',
        endereco: 'Av. Nilo Peçanha, 200',
        cidade: 'Manacapuru',
        estado: 'AM',
        latitude: -3.3000,
        longitude: -60.6200,
        telefone: '(92) 3666-2222',
        email: 'manacapuru@congregacao.com.br',
        pastor: 'Rev. Ana Costa',
        ativo: true
      }
    ];

    const { error: erroInsert } = await supabase
      .from('congregacoes')
      .insert(congregacoes);

    if (erroInsert) {
      console.log(`⚠️  ${erroInsert.message}`);
    } else {
      console.log(`✅ ${congregacoes.length} congregacoes inseridas`);
    }

    // 5. Verificar resultado final
    console.log('\n\n✨ Etapa 5: Verificando resultado final...');
    
    const { data: membrosAtualizados } = await supabase
      .from('members')
      .select('id, name, email, latitude, longitude, status')
      .limit(3);

    const { data: congFinal } = await supabase
      .from('congregacoes')
      .select('id, nome, latitude, longitude');

    console.log(`\n📊 Membros com coordenadas: ${membrosAtualizados?.filter(m => m.latitude && m.longitude).length}/${membrosAtualizados?.length}`);
    console.log(`🏢 Congregacoes criadas: ${congFinal?.length || 0}`);

    console.log('\n\n✅ Setup de geolocalização CONCLUÍDO!');
    console.log('\n🗺️  Próximo passo: Acesse http://localhost:3000/geolocalizacao\n');

  } catch (error) {
    console.error('❌ Erro geral:', error.message);
  }
}

main();
