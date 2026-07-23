const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function run() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data: minRes } = await supabase.from('ministries').select('id, name, subscription_status, subscription_end_date, created_at, plan, is_active');
  console.log("=== MINISTRIES ===");
  console.log(JSON.stringify(minRes, null, 2));
}

run();
