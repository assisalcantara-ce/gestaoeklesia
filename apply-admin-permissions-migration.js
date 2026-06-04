#!/usr/bin/env node

/**
 * Script para aplicar a migração de admin permissions
 * Uso: node apply-admin-permissions-migration.js
 */

import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ ERRO: Variáveis de ambiente não configuradas');
  console.error('   - NEXT_PUBLIC_SUPABASE_URL');
  console.error('   - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function applyMigration() {
  try {
    console.log('🔄 Conectando ao Supabase...');
    
    // Ler o arquivo da migração
    const migrationPath = path.join(process.cwd(), 'migrations', '007_add_admin_permissions_columns.sql');
    const sql = fs.readFileSync(migrationPath, 'utf-8');
    
    console.log('📝 Executando migração...');
    
    // Executar a migração
    const { error } = await supabase.rpc('exec_sql', { sql_text: sql }).catch(async () => {
      // Se exec_sql não existir, tenta com raw SQL
      return await supabase.sql`${sql}`;
    });

    if (error) {
      console.error('❌ Erro ao executar migração:', error);
      process.exit(1);
    }

    console.log('✅ Migração aplicada com sucesso!');
    console.log('\n📌 Próximas ações:');
    console.log('   1. Recriar o usuário de suporte com a nova senha');
    console.log('   2. Ou atualizar status do usuário existente');
    
  } catch (error) {
    console.error('❌ Erro:', error);
    process.exit(1);
  }
}

applyMigration();
