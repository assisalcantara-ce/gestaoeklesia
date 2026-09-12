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
  const { data: ministries } = await supabase.from('ministries').select('id, name');

  for (const min of ministries) {
    const { data: members, count } = await supabase
      .from('members')
      .select('id, name, status, role, tipo_cadastro, data_nascimento, congregacao_id', { count: 'exact' })
      .eq('ministry_id', min.id);

    if (count === 0) continue;

    const monthCountAll = { 1:0,2:0,3:0,4:0,5:0,6:0,7:0,8:0,9:0,10:0,11:0,12:0 };
    (members || []).forEach(m => {
      if (m.data_nascimento) {
        const raw = String(m.data_nascimento).trim();
        let mes = 0;
        if (raw.includes('-')) mes = parseInt(raw.split('-')[1], 10);
        else if (raw.includes('/')) mes = parseInt(raw.split('/')[1], 10);
        if (mes >= 1 && mes <= 12) {
          monthCountAll[mes]++;
        }
      }
    });

    console.log(`\nMINISTRY: "${min.name}" | ID: ${min.id} | Total: ${count}`);
    console.log('DISTRIBUIÇÃO:', JSON.stringify(monthCountAll));
  }
}

run().catch(console.error);

