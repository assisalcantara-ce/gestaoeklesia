#!/usr/bin/env node

/**
 * Script para aplicar migrations no Supabase via PostgreSQL direct connection
 * Usa pgboss ou pg pool direto
 */

import pkg from 'pg';
const { Pool } = pkg;
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_PASSWORD = process.env.SUPABASE_DB_PASSWORD;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) {
  console.error('❌ ERRO: SUPABASE_URL não configurado');
  process.exit(1);
}

// Extrair project_ref da URL
const PROJECT_REF = SUPABASE_URL.split('//')[1].split('.')[0];
const POOLER_URL = `postgresql://postgres.${PROJECT_REF}:[YOUR_PASSWORD]@aws-0-us-west-1.pooler.supabase.com:6543/postgres`;

console.log(`🚀 Supabase Project: ${PROJECT_REF}`);
console.log(`📍 URL: ${SUPABASE_URL}`);

// Se temos um token de service role, podemos decodificar e extrair info
function decodeJWT(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const payload = JSON.parse(
      Buffer.from(parts[1], 'base64').toString('utf8')
    );
    return payload;
  } catch {
    return null;
  }
}

if (SERVICE_ROLE_KEY) {
  const decoded = decodeJWT(SERVICE_ROLE_KEY);
  if (decoded) {
    console.log(`✅ JWT decodificado: role=${decoded.role}, aud=${decoded.aud}`);
  }
}

// Função para ler migrations
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

// Função para aplicar migrations
async function applyMigrations() {
  const priority = [
    '20260416110000_ebd_module.sql',
    '20260416120000_ebd_ofertas_aula_unique.sql',
    '20260417000000_carta_pedidos.sql',
    '20260416200000_tesouraria_add_member_id.sql',
    '20260416220000_ebd_superintendentes.sql',
    '20260416230000_ebd_trimestres.sql',
  ];

  const migrations = getMigrationFiles();
  const toApply = migrations.filter(m => priority.includes(m.name));

  console.log(`\n📋 Migrações a aplicar: ${toApply.length}`);
  toApply.forEach(m => console.log(`   • ${m.name}`));
  console.log(`\n⚠️  AVISO: Não conseguimos conectar via PostgreSQL.`);
  console.log(`\n✅ Alternativa: Aplicar migrações via Supabase Dashboard:`);
  console.log(`   https://supabase.com/dashboard/project/${PROJECT_REF}/sql`);
  
  console.log(`\n📝 Arquivos SQL prontos para copiar/colar:\n`);
  
  for (const migration of toApply) {
    const sql = fs.readFileSync(migration.path, 'utf8');
    console.log(`\n${'='.repeat(70)}`);
    console.log(`FILE: ${migration.name}`);
    console.log(`${'='.repeat(70)}`);
    console.log(sql);
  }
  
  console.log(`\n${'='.repeat(70)}`);
  console.log(`\n📋 PRÓXIMOS PASSOS:`);
  console.log(`   1. Acesse: https://supabase.com/dashboard/project/${PROJECT_REF}/sql`);
  console.log(`   2. Copie cada bloco SQL acima`);
  console.log(`   3. Cole no editor SQL do Supabase`);
  console.log(`   4. Clique em "Executar"`);
  console.log(`\n`);
}

applyMigrations().catch(err => {
  console.error('❌ Erro:', err.message);
  process.exit(1);
});
