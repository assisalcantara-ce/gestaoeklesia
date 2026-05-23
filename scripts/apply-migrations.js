#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ ERRO: SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY não estão configurados');
  process.exit(1);
}

const PROJECT_ID = SUPABASE_URL.split('//')[1].split('.')[0];
console.log('🚀 Supabase Project: ' + PROJECT_ID);
console.log('📍 API URL: ' + SUPABASE_URL);

// Função para executar SQL via API do Supabase
async function executeSql(sql) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ query: sql });

    const options = {
      hostname: PROJECT_ID + '.supabase.co',
      port: 443,
      path: '/rest/v1/rpc/exec_sql',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'Authorization': 'Bearer ' + SERVICE_ROLE_KEY,
        'apikey': SERVICE_ROLE_KEY,
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ status: res.statusCode, data });
        } else {
          reject(new Error('HTTP ' + res.statusCode + ': ' + data));
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// Função alternativa: usar o SQL Editor endpoint
async function executeSqlAlternative(sql) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      scripts: [{ sql }]
    });

    const options = {
      hostname: 'api.supabase.com',
      port: 443,
      path: '/v1/projects/' + PROJECT_ID + '/sql',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'Authorization': 'Bearer ' + SERVICE_ROLE_KEY,
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } else {
          reject(new Error('HTTP ' + res.statusCode + ': ' + data));
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// Ler migrations
function getMigrationFiles() {
  const migrationsDir = path.join(__dirname, '../supabase/migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  return files.map(f => ({
    name: f,
    path: path.join(migrationsDir, f)
  }));
}

// Executar migrações prioritárias
async function applyMigrations() {
  const migrations = getMigrationFiles();

  // Prioridade: EBD, Cartas, Tesouraria
  const priority = [
    '20260416110000_ebd_module.sql',
    '20260416120000_ebd_ofertas_aula_unique.sql',
    '20260417000000_carta_pedidos.sql',
    '20260416200000_tesouraria_add_member_id.sql',
    '20260416220000_ebd_superintendentes.sql',
    '20260416230000_ebd_trimestres.sql',
  ];

  const toApply = migrations.filter(m => priority.includes(m.name));

  console.log('');
  console.log('📋 Migrações a aplicar: ' + toApply.length);
  toApply.forEach(m => console.log('   • ' + m.name));

  let applied = 0;
  let failed = 0;

  for (const migration of toApply) {
    try {
      const sql = fs.readFileSync(migration.path, 'utf8');

      // Limpar comments e whitespace
      const cleanSql = sql
        .split('\n')
        .filter(line => !line.trim().startsWith('--'))
        .join('\n')
        .trim();

      if (!cleanSql) {
        console.log('⏭️  ' + migration.name + ' (vazio)');
        continue;
      }

      console.log('');
      console.log('⏳ Aplicando: ' + migration.name);

      // Tentar método alternativo (SQL Editor da API Supabase)
      try {
        const result = await executeSqlAlternative(cleanSql);
        console.log('✅ ' + migration.name + ' aplicado');
        applied++;
      } catch (apiErr) {
        // Se falhar, mostrar erro e continuar
        console.warn('⚠️  Falha na API: ' + apiErr.message);
        console.log('📝 SQL:');
        console.log(cleanSql.substring(0, 200) + '...');
        failed++;
      }
    } catch (err) {
      console.error('❌ Erro ao ler ' + migration.name + ': ' + err.message);
      failed++;
    }
  }

  console.log('');
  console.log('='.repeat(60));
  console.log('📊 Resultado: ' + applied + ' aplicadas, ' + failed + ' falharam');

  if (applied === 0) {
    console.log('');
    console.log('⚠️  AVISO: Nenhuma migração foi aplicada.');
    console.log('   Você pode precisar aplicar manualmente via:');
    console.log('   https://supabase.com/dashboard/project/' + PROJECT_ID + '/sql');
  }
}

// Executar
applyMigrations().catch(err => {
  console.error('❌ Erro fatal:', err);
  process.exit(1);
});
