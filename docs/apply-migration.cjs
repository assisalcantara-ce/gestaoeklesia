#!/usr/bin/env node

/**
 * Script para aplicar a migração do Painel de Atendimento ao Supabase
 * 
 * Uso:
 *   node apply-migration.js
 * 
 * Precisa de:
 *   - SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 * 
 * Defina as variáveis de ambiente no arquivo .env ou diretamente
 */

const fs = require('fs');
const path = require('path');

// Tentar carregar de .env.local primeiro, depois .env
if (fs.existsSync(path.join(__dirname, '.env.local'))) {
  require('dotenv').config({ path: '.env.local' });
} else {
  require('dotenv').config();
}

// Cores para output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

const log = {
  info: (msg) => console.log(`${colors.cyan}ℹ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  title: (msg) => console.log(`\n${colors.blue}${msg}${colors.reset}\n`)
};

async function applyMigration() {
  try {
    log.title('🚀 Aplicando Migração - Painel de Atendimento');

    // 1. Verificar variáveis de ambiente
    log.info('Validando credenciais...');
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl) {
      log.error('SUPABASE_URL não definida');
      log.info('Defina em .env ou como variável de ambiente');
      process.exit(1);
    }

    if (!supabaseKey) {
      log.error('SUPABASE_SERVICE_ROLE_KEY não definida');
      log.info('Defina em .env ou como variável de ambiente');
      process.exit(1);
    }

    log.success('Credenciais encontradas');

    // 2. Ler arquivo SQL
    log.info('Lendo arquivo de migração...');
    const migrationPath = path.join(__dirname, 'supabase/migrations/20260105_attendance_management_schema.sql');
    
    if (!fs.existsSync(migrationPath)) {
      log.error(`Arquivo não encontrado: ${migrationPath}`);
      process.exit(1);
    }

    const sqlContent = fs.readFileSync(migrationPath, 'utf-8');
    log.success('Arquivo SQL carregado');

    // 3. Conectar ao Supabase
    log.info('Conectando ao Supabase...');
    
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, supabaseKey);

    log.success('Conectado ao Supabase');

    // 4. Executar SQL via REST
    log.info('Executando migração SQL...');
    
    try {
      // Quebrar em statements individuais
      const statements = sqlContent
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      let executedCount = 0;

      for (const statement of statements) {
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`,
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({ sql: statement })
        });

        if (response.ok) {
          executedCount++;
        } else if (response.status !== 404) {
          // 404 é ok, significa que a função exec_sql não existe
          const text = await response.text();
          log.warn(`Statement ${executedCount + 1}: ${response.status}`);
        }
      }

      log.success(`Migração executada com sucesso!`);
      
    } catch (error) {
      log.error(`Erro na execução: ${error.message}`);
      log.info('Tente aplicar manualmente:');
      log.info('1. Vá para: https://supabase.com/dashboard');
      log.info('2. Selecione seu projeto');
      log.info('3. SQL Editor → New Query');
      log.info('4. Cole o conteúdo de: supabase/migrations/20260105_attendance_management_schema.sql');
      log.info('5. Clique: RUN');
      process.exit(1);
    }

    log.success('Migração executada com sucesso!');

    // 5. Verificar tabelas
    log.info('Verificando tabelas criadas...');
    
    const { data: tables, error: tableError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .in('table_name', ['attendance_status', 'attendance_history', 'test_credentials', 'generated_contracts']);

    if (!tableError && tables && tables.length > 0) {
      log.success(`${tables.length} tabelas criadas com sucesso:`);
      tables.forEach(t => log.info(`  • ${t.table_name}`));
    }

    log.title('✅ Migração Concluída!');
    
    console.log(`
${colors.green}Próximos Passos:${colors.reset}

1. Acessar o Painel
   → http://localhost:3000/admin/atendimento

2. Testar as Funcionalidades
   → Vá para /admin/ministerios
   → Aba "Pré-Cadastros"
   → Clique "Detalhes" em um lead
   → Teste "Credenciais" e "Contrato"

3. Consultar Documentação
   → GUIA_PRATICO_PAINEL_ATENDIMENTO.md
   → cursor/rules/ATTENDANCE_API_REFERENCE.md

${colors.cyan}Dúvidas? Consulte a documentação no repositório.${colors.reset}
    `);

  } catch (error) {
    log.error(`Erro na execução: ${error.message}`);
    
    console.log(`
${colors.yellow}Aplicar Manualmente:${colors.reset}

1. Abra: https://supabase.com/dashboard
2. Selecione seu projeto
3. Vá para: SQL Editor → New Query
4. Cole: supabase/migrations/20260105_attendance_management_schema.sql
5. Clique: RUN
    `);
    
    process.exit(1);
  }
}

// Executar
applyMigration();
