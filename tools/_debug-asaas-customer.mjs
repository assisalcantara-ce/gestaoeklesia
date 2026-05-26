import { readFileSync } from 'fs';
const raw = readFileSync('.env.local', 'utf8');
const env = {};
for (const l of raw.split(/\r?\n/)) { const m = l.match(/^([A-Za-z0-9_]+)=(.+)$/); if (m) env[m[1]] = m[2].trim(); }

const API = env.ASAAS_API_URL || 'https://sandbox.asaas.com/api/v3';
const KEY = env.ASAAS_API_SANDBOX;
console.log('URL:', API, '| Key prefix:', KEY?.slice(0, 10));

// 1. Busca customer por email
const search = await fetch(`${API}/customers?email=joao.teste.homologacao%40example.com&limit=1`, {
  headers: { access_token: KEY, 'Content-Type': 'application/json' }
});
const searchData = await search.json();
console.log('Busca por email HTTP', search.status, ':', JSON.stringify(searchData).slice(0, 300));

if (searchData.data?.[0]?.id) {
  const c = searchData.data[0];
  console.log('Customer existente:', c.id, '| cpfCnpj:', c.cpfCnpj ?? 'VAZIO');
} else {
  // Cria com CPF
  const create = await fetch(`${API}/customers`, {
    method: 'POST',
    headers: { access_token: KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Joao Teste Homolog', email: 'joao.teste.homologacao@example.com', cpfCnpj: '76534632026' })
  });
  const createData = await create.json();
  console.log('Criar customer HTTP', create.status, ':', JSON.stringify(createData).slice(0, 400));
}
