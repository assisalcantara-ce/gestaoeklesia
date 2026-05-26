import { readFileSync } from 'fs';
const raw = readFileSync('.env.local', 'utf8');
const env = {};
for (const l of raw.split(/\r?\n/)) { const m = l.match(/^([A-Za-z0-9_]+)=(.+)$/); if (m) env[m[1]] = m[2].trim(); }

const API = env.ASAAS_API_URL || 'https://sandbox.asaas.com/api/v3';
const KEY = env.ASAAS_API_SANDBOX;

// Atualiza o customer existente com CPF
const r = await fetch(`${API}/customers/cus_000008027429`, {
  method: 'PUT',
  headers: { access_token: KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ cpfCnpj: '52998224725' })
});
const d = await r.json();
console.log('Update customer HTTP', r.status, ':', JSON.stringify(d).slice(0, 300));
