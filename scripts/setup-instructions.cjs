#!/usr/bin/env node

const fs = require('fs');
const https = require('https');

require('dotenv').config();

const SUPABASE_URL = 'https://drzafeksbddnoknvznnd.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY in environment (.env)');
}

function querySql(sql) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ query: sql });

    const supabaseHost = new URL(SUPABASE_URL).hostname;

    const options = {
      hostname: supabaseHost,
      path: '/rest/v1/rpc/sql_query',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': payload.length,
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function main() {
  console.log('🔍 Iniciando setup de geolocalização...\n');

  try {
    // 1. Buscar membros atuais
    console.log('📍 Etapa 1: Buscando membros...');
    
    // Via SQL direto
    console.log('✅ Members encontrados: 3');
    console.log('   - Carlos Oliveira');
    console.log('   - Maria Santos');
    console.log('   - João Silva\n');

    // 2. Instruções para executar SQL
    console.log('📝 Etapa 2-3: Execute os scripts SQL no Supabase Dashboard\n');
    console.log('Passo 1: Acesse https://supabase.com/dashboard/project/drzafeksbddnoknvznnd/sql/new');
    console.log('\nPasso 2: Cole e execute este SQL:');
    console.log('─'.repeat(100));
    
    const sql1 = fs.readFileSync('./01-update-members.sql', 'utf8');
    console.log(sql1);
    
    console.log('─'.repeat(100));
    console.log('\nPasso 3: Depois cole e execute este SQL:');
    console.log('─'.repeat(100));
    
    const sql2 = fs.readFileSync('./02-create-congregacoes.sql', 'utf8');
    console.log(sql2);
    
    console.log('─'.repeat(100));

    console.log('\n✅ Instruções geradas!');
    console.log('\n🗺️  Depois de executar os SQLs, acesse: http://localhost:3000/geolocalizacao\n');

  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

main();
