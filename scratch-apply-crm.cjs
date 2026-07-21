const { createClient } = require('./node_modules/@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ ERRO: Variáveis de ambiente não configuradas no .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function main() {
  console.log('⚡ Verificando / criando tabela crm_interactions...');

  // 1. Tentar inserção dummy para ver se a tabela existe
  const { data, error } = await supabase.from('crm_interactions').select('id').limit(1);

  if (error && error.code === '42P01') {
    console.log('⚠️ Tabela crm_interactions não encontrada fisicamente.');
  } else if (!error) {
    console.log('✅ A tabela crm_interactions já existe no Supabase!');
  } else {
    console.log('Status ao consultar:', error.message);
  }
}

main().catch(console.error);
