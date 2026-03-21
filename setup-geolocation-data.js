#!/usr/bin/env node

/**
 * Script para adicionar dados de geolocalização no Supabase
 * Execute com: node setup-geolocation-data.js
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Erro: Variáveis SUPABASE não configuradas no .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function setupGeolocalizacao() {
  console.log('🚀 Iniciando setup de geolocalização...\n');

  try {
    // 1. Adicionar membros com coordenadas
    console.log('📍 Adicionando membros com coordenadas...');
    
    const membros = [
      {
        nome: 'João Silva',
        email: 'joao@example.com',
        celular: '(92) 98888-1111',
        logradouro: 'Avenida Getúlio Vargas',
        numero: '1000',
        bairro: 'Centro',
        cidade: 'Manaus',
        latitude: '-3.1190',
        longitude: '-60.0217',
        status: 'ativo',
        tipoCadastro: 'membro'
      },
      {
        nome: 'Maria Santos',
        email: 'maria@example.com',
        celular: '(92) 98888-2222',
        logradouro: 'Rua Brasil',
        numero: '500',
        bairro: 'Cidade Nova',
        cidade: 'Manaus',
        latitude: '-3.1200',
        longitude: '-60.0215',
        status: 'ativo',
        tipoCadastro: 'membro'
      },
      {
        nome: 'Pedro Oliveira',
        email: 'pedro@example.com',
        celular: '(92) 98888-3333',
        logradouro: 'Avenida Torquato Tapajós',
        numero: '800',
        bairro: 'Flores',
        cidade: 'Manaus',
        latitude: '-3.1100',
        longitude: '-60.0300',
        status: 'ativo',
        tipoCadastro: 'membro'
      },
      {
        nome: 'Ana Costa',
        email: 'ana@example.com',
        celular: '(92) 98888-4444',
        logradouro: 'Rua Recife',
        numero: '350',
        bairro: 'Centro',
        cidade: 'Manaus',
        latitude: '-3.1180',
        longitude: '-60.0210',
        status: 'ativo',
        tipoCadastro: 'congregado'
      },
      {
        nome: 'Carlos Ferreira',
        email: 'carlos@example.com',
        celular: '(92) 98888-5555',
        logradouro: 'Avenida Djalma Batista',
        numero: '1200',
        bairro: 'Aleixo',
        cidade: 'Manaus',
        latitude: '-3.1050',
        longitude: '-60.0400',
        status: 'ativo',
        tipoCadastro: 'membro'
      }
    ];

    const { data: membrosData, error: membrosError } = await supabase
      .from('membros')
      .insert(membros)
      .select();

    if (membrosError) {
      console.warn('⚠️  Aviso ao adicionar membros:', membrosError.message);
    } else {
      console.log(`✅ ${membros.length} membros adicionados com sucesso!\n`);
    }

    // 2. Adicionar congregações
    console.log('⛪ Adicionando congregações com coordenadas...');
    
    const congregacoes = [
      {
        nome: 'Congregação Central',
        latitude: '-3.1190',
        longitude: '-60.0217',
        endereco: 'Avenida Getúlio Vargas, 1000',
        cidade: 'Manaus',
        status: 'ativo'
      },
      {
        nome: 'Congregação Flores',
        latitude: '-3.1100',
        longitude: '-60.0300',
        endereco: 'Avenida Torquato Tapajós, 800',
        cidade: 'Manaus',
        status: 'ativo'
      },
      {
        nome: 'Congregação Aleixo',
        latitude: '-3.1050',
        longitude: '-60.0400',
        endereco: 'Avenida Djalma Batista, 1200',
        cidade: 'Manaus',
        status: 'ativo'
      }
    ];

    const { data: congregacoesData, error: congregacoesError } = await supabase
      .from('congregacoes')
      .insert(congregacoes)
      .select();

    if (congregacoesError) {
      console.warn('⚠️  Aviso ao adicionar congregações:', congregacoesError.message);
    } else {
      console.log(`✅ ${congregacoes.length} congregações adicionadas com sucesso!\n`);
    }

    console.log('🎉 Setup concluído!');
    console.log('\n📍 Dados adicionados em Manaus, AM, Brasil');
    console.log('🌐 Abra http://localhost:3000/geolocalizacao para ver no mapa!\n');

  } catch (error) {
    console.error('❌ Erro ao configurar geolocalização:', error);
    process.exit(1);
  }
}

setupGeolocalizacao();
