import { readFileSync } from 'fs';
const raw = readFileSync('.env.local', 'utf8');
const env = {};
for (const l of raw.split(/\r?\n/)) { const m = l.match(/^([A-Za-z0-9_]+)=(.+)$/); if (m) env[m[1]] = m[2].trim(); }

const API = env.ASAAS_API_URL || 'https://sandbox.asaas.com/api/v3';
const KEY = env.ASAAS_API_SANDBOX;

// Cria nova cobrança PIX
const create = await fetch(`${API}/payments`, {
  method: 'POST',
  headers: { access_token: KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    customer: 'cus_000008027429',
    billingType: 'PIX',
    value: 5.00,
    dueDate: new Date(Date.now() + 2*86400000).toISOString().slice(0,10),
    description: 'Teste debug QR Code',
    externalReference: 'debug_test_001',
  })
});
const chargeData = await create.json();
console.log('Criar cobrança HTTP', create.status);
console.log('Response completo:', JSON.stringify(chargeData, null, 2).slice(0, 1000));

if (chargeData.id) {
  // Imediatamente busca QR
  console.log('\n--- QR Code imediato ---');
  const qr1 = await fetch(`${API}/payments/${chargeData.id}/pixQrCode`, {
    headers: { access_token: KEY }
  });
  const qr1Data = await qr1.json();
  console.log('HTTP', qr1.status, '| payload:', qr1Data.payload?.slice(0,20) ?? 'null', '| encodedImage:', qr1Data.encodedImage ? 'present' : 'null');

  // Aguarda 1s e tenta de novo
  await new Promise(r => setTimeout(r, 1000));
  console.log('\n--- QR Code após 1s ---');
  const qr2 = await fetch(`${API}/payments/${chargeData.id}/pixQrCode`, {
    headers: { access_token: KEY }
  });
  const qr2Data = await qr2.json();
  console.log('HTTP', qr2.status, '| payload:', qr2Data.payload?.slice(0,20) ?? 'null', '| encodedImage:', qr2Data.encodedImage ? 'present' : 'null');
}
