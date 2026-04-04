const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const envPath = path.join(process.cwd(), '.env.local');
const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
const env = lines.reduce((acc, line) => {
  const idx = line.indexOf('=');
  if (idx === -1) return acc;
  const key = line.slice(0, idx);
  let value = line.slice(idx + 1);
  if (value.startsWith('"') && value.endsWith('"')) {
    value = value.slice(1, -1);
  }
  acc[key] = value;
  return acc;
}, {});

const url = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(url, key);

(async () => {
  const { data, error } = await supabase
    .from('subscription_plans')
    .select('id,name,slug,is_active,display_order,price_monthly')
    .order('display_order', { ascending: true })
    .order('price_monthly', { ascending: true });

  if (error) {
    console.error(error);
    process.exit(1);
  }

  console.log(JSON.stringify(data, null, 2));
})();
