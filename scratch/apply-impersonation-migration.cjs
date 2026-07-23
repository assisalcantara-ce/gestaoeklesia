const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("ERRO: Variaveis Supabase nao encontradas.");
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const sqlPath = path.join(__dirname, '../supabase/migrations/20260723143000_create_admin_impersonation_sessions.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  console.log("Aplicando migration 20260723143000_create_admin_impersonation_sessions.sql via RPC exec_sql...");

  const { data, error } = await supabase.rpc('exec_sql', { sql });

  if (error) {
    console.error("❌ ERRO AO APLICAR MIGRATION:", error.message);
  } else {
    console.log("✅ MIGRATION APLICADA COM SUCESSO VIA RPC!", data);
  }
}

main();
