#!/usr/bin/env node
/**
 * Script para executar migrations diretamente via Supabase Admin API
 */

const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

async function executeSql(sql) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'apikey': SERVICE_ROLE_KEY
    },
    body: JSON.stringify({ query: sql })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Supabase API error: ${response.status} - ${error}`);
  }

  return response.json();
}

async function main() {
  try {
    console.log('📂 Lendo arquivo de migration...');
    const migrationFile = path.join(__dirname, 'supabase/migrations/20260102200944_initial_schema.sql');
    const sql = fs.readFileSync(migrationFile, 'utf-8');

    console.log('🚀 Enviando SQL para Supabase Cloud...');
    const result = await executeSql(sql);

    console.log('✅ Migration executada com sucesso!');
    console.log('📊 Resultado:', result);
  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

main();
