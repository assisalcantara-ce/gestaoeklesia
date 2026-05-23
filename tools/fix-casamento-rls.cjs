#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('Credenciais não encontradas em .env.local');
  process.exit(1);
}

const sql = fs.readFileSync(path.join(__dirname, 'fix-casamento-rls.sql'), 'utf-8');

async function run() {
  const stmts = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  for (const stmt of stmts) {
    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        'apikey': serviceKey,
      },
      body: JSON.stringify({ query: stmt }),
    });
    if (!res.ok && res.status !== 404) {
      const txt = await res.text();
      console.warn(`[${res.status}] ${stmt.slice(0, 60)}... => ${txt.slice(0, 120)}`);
    } else {
      console.log(`OK: ${stmt.slice(0, 70)}...`);
    }
  }
}

run().catch(e => { console.error(e); process.exit(1); });
