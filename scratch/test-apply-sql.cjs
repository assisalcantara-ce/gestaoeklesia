const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');
const https = require('https');

async function run() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.error("ERRO: Variaveis Supabase nao encontradas.");
    return;
  }

  const projectId = supabaseUrl.split('//')[1].split('.')[0];
  const sqlPath = path.join(__dirname, '../supabase/migrations/20260723143000_create_admin_impersonation_sessions.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  console.log(`Tentando aplicar via Supabase Management API para o projeto: ${projectId}...`);

  const payload = JSON.stringify({ query: sql });

  const options = {
    hostname: `${projectId}.supabase.co`,
    port: 443,
    path: '/rest/v1/rpc/exec',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
      'Authorization': `Bearer ${serviceKey}`,
      'apikey': serviceKey
    }
  };

  const req = https.request(options, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      console.log(`HTTP Status: ${res.statusCode}`);
      console.log(`Resposta: ${data}`);
    });
  });

  req.on('error', (e) => console.error('Erro na requisição:', e));
  req.write(payload);
  req.end();
}

run();
