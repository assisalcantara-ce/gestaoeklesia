const https = require('https');
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');

async function run() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const projectId = supabaseUrl.split('//')[1].split('.')[0];

  const sqlPath = path.join(__dirname, '../supabase/migrations/20260723143000_create_admin_impersonation_sessions.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  console.log(`Tentando API Supabase SQL para projeto ${projectId}...`);

  const payload = JSON.stringify({
    query: sql
  });

  const options = {
    hostname: 'api.supabase.com',
    port: 443,
    path: `/v1/projects/${projectId}/sql`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
      'Authorization': `Bearer ${serviceKey}`
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
