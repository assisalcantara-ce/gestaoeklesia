const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function run() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Testar rpcs conhecidos no projeto
  const candidateRpcs = ['exec_sql', 'exec', 'execute_sql', 'run_sql', 'get_database_size_bytes', 'test_credentials'];
  
  for (const rpcName of candidateRpcs) {
    const { data, error } = await supabase.rpc(rpcName, { sql: 'SELECT 1;' });
    console.log(`RPC '${rpcName}':`, error ? error.message : 'OK!');
  }
}

run();
