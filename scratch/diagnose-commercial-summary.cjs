const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function run() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("ERRO: Variaveis Supabase nao encontradas.");
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const [minRes, preRegRes, optRes] = await Promise.all([
    supabase.from('ministries').select('*'),
    supabase.from('pre_registrations').select('*'),
    supabase.from('oportunidades_comerciais').select('*')
  ]);

  console.log("=== MINISTRIES ===");
  console.log(JSON.stringify(minRes.data, null, 2));

  console.log("\n=== PRE_REGISTRATIONS ===");
  console.log(JSON.stringify(preRegRes.data, null, 2));

  console.log("\n=== OPORTUNIDADES_COMERCIAIS ===");
  console.log(JSON.stringify(optRes.data, null, 2));
}

run();
