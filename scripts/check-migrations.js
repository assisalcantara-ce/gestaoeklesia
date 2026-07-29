import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config({ path: '.env.local' });
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function checkMigrations() {
  console.log('🔍 [Pipeline de Migrations] Iniciando verificação de integridade...');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ ERRO CRÍTICO: Variáveis de ambiente NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configuradas.');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // 1. Ler todas as migrations locais (.sql)
  const migrationsDir = path.join(__dirname, '../supabase/migrations');
  if (!fs.existsSync(migrationsDir)) {
    console.warn('⚠️ Diretório de migrations não encontrado:', migrationsDir);
    process.exit(0);
  }

  const localFiles = fs.readdirSync(migrationsDir).filter((file) => file.endsWith('.sql'));

  // 2. Mapeamento de tabelas criadas por migrations específicas conhecidas para validação física
  const knownTableChecks = {
    '20260723143000_create_admin_impersonation_sessions.sql': 'admin_impersonation_sessions',
    '20260721013000_create_crm_interactions.sql': 'crm_interactions',
    '002_create_tickets_suporte_table.sql': 'support_tickets',
    '003_create_audit_logs_table.sql': 'audit_logs',
    '20260102210000_admin_panel_schema.sql': 'admin_users',
  };

  const pendingMigrations = [];

  // 3. Verificar presença física ou registro no banco remoto
  for (const file of localFiles) {
    const targetTable = knownTableChecks[file];
    if (targetTable) {
      const { error } = await supabase.from(targetTable).select('*').limit(1);
      if (error && (error.code === 'PGRST205' || error.code === 'PGRST301' || error.message.includes('schema cache') || error.message.includes('Could not find the table'))) {
        pendingMigrations.push(file);
      }
    }
  }

  if (pendingMigrations.length > 0) {
    console.error('\n❌ MIGRATIONS PENDENTES DETECTADAS NO BANCO REMOTO!');
    console.error('O deploy e a build foram interrompidos por segurança para evitar erros de runtime.\n');
    console.error('📋 Lista de migrations pendentes de execução:');
    pendingMigrations.forEach((m) => console.error(`  - supabase/migrations/${m}`));
    console.error('\n👉 Por favor, aplique as migrações acima no banco remoto (ex: via Supabase CLI ou SQL Editor) antes de publicar.\n');
    process.exit(1);
  }

  console.log('✅ Todas as migrations verifiadas estão aplicadas no banco remoto!');
  process.exit(0);
}

checkMigrations();
