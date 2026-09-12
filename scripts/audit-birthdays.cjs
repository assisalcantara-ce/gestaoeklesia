const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Carregar .env.local
const envPath = path.resolve(__dirname, '../.env.local');
const envFile = fs.readFileSync(envPath, 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const parts = line.split('=');
  const k = parts[0];
  const v = parts.slice(1).join('=');
  if (k && v) {
    env[k.trim()] = v.trim().replace(/^["']|["']$/g, '');
  }
});

const url = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(url, key);

async function run() {
  const { data: configs, error } = await supabase
    .from('configurations')
    .select('*')
    .limit(5);

  if (error) {
    console.error('Erro configurations:', error);
  } else {
    console.log('CONFIGURATIONS ENCONTRADAS:');
    configs.forEach(c => {
      console.log('Ministry ID:', c.ministry_id);
      console.log('Keys:', Object.keys(c));
      console.log('Row:', JSON.stringify(c, null, 2));
    });
  }
}

run().catch(console.error);

