/**
 * setup-gateway-teste.mjs
 * Cria gateway ASAAS sandbox para AD ROCHA ETERNA DE MARITUBA
 * usando a chave do .env.local para homologação da Fase A.
 */
import { readFileSync } from 'fs';
import { createCipheriv, randomBytes } from 'crypto';
import { createClient } from '@supabase/supabase-js';

// ─── Parse .env.local ─────────────────────────────────────────────────────
const raw = readFileSync('.env.local', 'utf8');
const env = {};
for (const line of raw.split(/\r?\n/)) {
  const m = line.match(/^([A-Za-z0-9_]+)=(.+)$/);
  if (m) env[m[1]] = m[2].trim();
}

const SUPABASE_URL = env.SUPABASE_URL;
const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const ASAAS_API_KEY = env.ASAAS_API_KEY;
const ENC_KEY_RAW = env.CREDENTIALS_ENCRYPTION_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('SUPABASE vars ausentes'); process.exit(1); }
if (!ASAAS_API_KEY) { console.error('ASAAS_API_KEY ausente'); process.exit(1); }
if (!ENC_KEY_RAW || ENC_KEY_RAW.length < 16) { console.error('CREDENTIALS_ENCRYPTION_KEY ausente ou curta'); process.exit(1); }

// ─── Encrypt (AES-256-GCM — mesmo algoritmo de ministry-credentials.ts) ──
const KEY_BYTES = 32, IV_BYTES = 12;
const src = Buffer.from(ENC_KEY_RAW.trim(), 'utf-8');
const key = Buffer.alloc(KEY_BYTES, 0);
src.copy(key, 0, 0, Math.min(src.length, KEY_BYTES));

function encryptCredentials(credentials) {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const plain = Buffer.from(JSON.stringify(credentials), 'utf-8');
  const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

// ─── Main ──────────────────────────────────────────────────────────────────
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

// Ministry para teste: AD ROCHA ETERNA DE MARITUBA
const MINISTRY_ID = '8890d729-f6cf-40b5-b9fc-751315c24f57';
const USER_ID     = '721ab0ab-cdc4-469c-a10a-6bf05c55c517'; // assisalcantara.ce@gmail.com

console.log('Criptografando credenciais ASAAS...');
const encryptedCreds = encryptCredentials({ apiKey: ASAAS_API_KEY });
console.log('Credenciais criptografadas (truncado):', encryptedCreds.slice(0, 20) + '...');

// Verificar se já existe um gateway para este ministério
const { data: existing } = await sb
  .from('ministry_payment_gateways')
  .select('id, webhook_token, asaas_webhook_status')
  .eq('ministry_id', MINISTRY_ID)
  .eq('gateway', 'asaas')
  .maybeSingle();

let gatewayId, webhookToken;

if (existing) {
  console.log('Gateway existente encontrado, atualizando credenciais...');
  const { data: updated, error } = await sb
    .from('ministry_payment_gateways')
    .update({
      encrypted_credentials: encryptedCreds,
      is_active: true,
      status: 'configured',
      environment: 'sandbox',
      updated_at: new Date().toISOString(),
    })
    .eq('id', existing.id)
    .select('id, webhook_token')
    .single();
  if (error) { console.error('Erro ao atualizar:', error.message); process.exit(1); }
  gatewayId = updated.id;
  webhookToken = updated.webhook_token;
  console.log('Gateway atualizado:', gatewayId);
} else {
  console.log('Criando novo gateway...');
  const { data: created, error } = await sb
    .from('ministry_payment_gateways')
    .insert({
      ministry_id:           MINISTRY_ID,
      gateway:               'asaas',
      environment:           'sandbox',
      display_name:          'ASAAS Sandbox (Homologação Fase A)',
      is_active:             true,
      status:                'configured',
      encrypted_credentials: encryptedCreds,
      configured_by:         USER_ID,
    })
    .select('id, webhook_token')
    .single();
  if (error) { console.error('Erro ao criar gateway:', error.message); process.exit(1); }
  gatewayId = created.id;
  webhookToken = created.webhook_token;
  console.log('Gateway criado:', gatewayId);
}

const APP_URL = env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const webhookUrl = `${APP_URL}/api/v1/ministry-webhook/asaas/${webhookToken}`;

console.log('\n✅ Gateway ASAAS sandbox configurado!');
console.log('   Gateway ID    :', gatewayId);
console.log('   Webhook Token :', webhookToken);
console.log('   Webhook URL   :', webhookUrl);
console.log('\nPróximo passo: registrar webhook_url no painel ASAAS sandbox.');
console.log('URL a registrar no ASAAS:', webhookUrl);
