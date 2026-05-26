import { readFileSync } from 'fs';
const raw = readFileSync('.env.local', 'utf8');
const env = {};
for (const l of raw.split(/\r?\n/)) { const m = l.match(/^([A-Za-z0-9_]+)=(.+)$/); if (m) env[m[1]] = m[2].trim(); }

const API = env.ASAAS_API_URL || 'https://sandbox.asaas.com/api/v3';
const KEY = env.ASAAS_API_SANDBOX;

// Busca última cobrança criada
const list = await fetch(`${API}/payments?customer=cus_000008027429&limit=5`, {
  headers: { access_token: KEY }
});
const listData = await list.json();
console.log('Cobranças HTTP', list.status, ':');
for (const p of listData.data ?? []) {
  console.log(' -', p.id, p.status, 'R$', p.value, p.billingType);
}

const latest = listData.data?.[0];
if (!latest) { console.log('Nenhuma cobrança encontrada'); process.exit(0); }

// Busca QR Code
const qr = await fetch(`${API}/payments/${latest.id}/pixQrCode`, {
  headers: { access_token: KEY }
});
const qrData = await qr.json();
console.log('\nQR Code para', latest.id, 'HTTP', qr.status, ':');
console.log(JSON.stringify(qrData).slice(0, 500));
