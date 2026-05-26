/**
 * update-sandbox-key.mjs
 * Atualiza a chave ASAAS sandbox no gateway de teste.
 *
 * Uso: node tools/update-sandbox-key.mjs <CHAVE_SANDBOX>
 */
import { readFileSync } from 'fs';
import { createCipheriv, randomBytes } from 'crypto';
import { createClient } from '@supabase/supabase-js';

const SANDBOX_KEY = process.argv[2];
if (!SANDBOX_KEY || SANDBOX_KEY.length < 10) {
  console.error('❌ Uso: node tools/update-sandbox-key.mjs <CHAVE_SANDBOX>');
  process.exit(1);
}

// ─── Parse .env.local ─────────────────────────────────────────────────────
const raw = readFileSync('.env.local', 'utf8');
const env = {};
for (const line of raw.split(/\r?\n/)) {
  const m = line.match(/^([A-Za-z0-9_]+)=(.+)$/);
  if (m) env[m[1]] = m[2].trim();
}

const SUPABASE_URL = env.SUPABASE_URL;
const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const ENC_KEY_RAW = env.CREDENTIALS_ENCRYPTION_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('❌ SUPABASE vars ausentes'); process.exit(1); }
if (!ENC_KEY_RAW || ENC_KEY_RAW.length < 16) { console.error('❌ CREDENTIALS_ENCRYPTION_KEY ausente'); process.exit(1); }

// ─── Encrypt (AES-256-GCM) ────────────────────────────────────────────────
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
const GATEWAY_ID = '2c4fba58-f442-45a8-8fc7-059f5c752092';

console.log('🔐 Criptografando chave sandbox...');
const encryptedCreds = encryptCredentials({ apiKey: SANDBOX_KEY });

const { error } = await sb
  .from('ministry_payment_gateways')
  .update({
    encrypted_credentials: encryptedCreds,
    updated_at: new Date().toISOString(),
  })
  .eq('id', GATEWAY_ID);

if (error) {
  console.error('❌ Erro ao atualizar gateway:', error.message);
  process.exit(1);
}

console.log('✅ Chave sandbox atualizada no gateway:', GATEWAY_ID);
console.log('   (chave truncada):', SANDBOX_KEY.slice(0, 10) + '...');
console.log('\nAgora execute: node tools/homologacao-fase-a.mjs');
