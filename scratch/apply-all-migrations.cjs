const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ ERRO: Variáveis de ambiente NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configuradas no .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function applyAllMigrations() {
  try {
    const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort(); // Garante ordem cronológica pelos timestamps no nome do arquivo

    console.log(`🔍 Encontrados ${files.length} arquivos de migração.`);

    for (const file of files) {
      console.log(`\n🔄 Lendo migração: ${file}...`);
      const sqlPath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(sqlPath, 'utf-8');

      console.log(`⚡ Executando no banco de dados...`);
      const { data, error } = await supabase.rpc('exec_sql', { sql });

      if (error) {
        console.error(`❌ Erro ao aplicar migração ${file}:`, error.message);
        // Não para a execução caso o erro seja "already exists" (para fins de idempotência)
        if (!error.message.includes('already exists') && !error.message.includes('already a member')) {
          console.error('⛔ Interrompendo devido a erro crítico.');
          process.exit(1);
        }
        console.log(`⚠️ Aviso ignorado (idempotência): a tabela/coluna já existia.`);
      } else {
        console.log(`✅ Migração ${file} aplicada com sucesso!`);
      }
    }

    console.log('\n🎉 Todas as migrações foram processadas e aplicadas!');
  } catch (error) {
    console.error('❌ Erro inesperado ao executar migrações:', error);
    process.exit(1);
  }
}

applyAllMigrations();
