const https = require('https');

const sql = [
  "ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS max_divisao1 INTEGER NOT NULL DEFAULT 5",
  "ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS max_divisao2 INTEGER NOT NULL DEFAULT 0",
  "ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS max_divisao3 INTEGER NOT NULL DEFAULT -1",
  "UPDATE public.subscription_plans SET max_divisao1 = 5,  max_divisao2 = 0,  max_divisao3 = 0   WHERE slug = 'basic'",
  "UPDATE public.subscription_plans SET max_divisao1 = 10, max_divisao2 = 1,  max_divisao3 = -1  WHERE slug = 'starter'",
  "UPDATE public.subscription_plans SET max_divisao1 = 50, max_divisao2 = 10, max_divisao3 = -1  WHERE slug = 'profissional'",
  "UPDATE public.subscription_plans SET max_divisao1 = 25, max_divisao2 = 3,  max_divisao3 = -1  WHERE slug = 'professional'",
  "UPDATE public.subscription_plans SET max_divisao1 = 100,max_divisao2 = 20, max_divisao3 = -1  WHERE slug = 'expert'"
];

const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const HOST = 'puessigbvsagbjhikutw.supabase.co';

function runQuery(query) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query });
    const options = {
      hostname: HOST,
      path: '/rest/v1/rpc/exec_sql',
      method: 'POST',
      headers: {
        'apikey': KEY,
        'Authorization': 'Bearer ' + KEY,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    };
    const req = https.request(options, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// Usar endpoint /pg/query da Management API do Supabase
function pgQuery(sql) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query: sql });
    const options = {
      hostname: HOST,
      path: '/pg/query',
      method: 'POST',
      headers: {
        'apikey': KEY,
        'Authorization': 'Bearer ' + KEY,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    };
    const req = https.request(options, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  for (const q of sql) {
    console.log('Running:', q.substring(0, 60) + '...');
    const r = await pgQuery(q);
    console.log('Status:', r.status, r.body.substring(0, 200));
  }
}

main().catch(console.error);
