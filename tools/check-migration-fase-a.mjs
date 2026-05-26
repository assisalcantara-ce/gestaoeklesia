// Homologação Fase A — verifica se migration foi aplicada
import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

// Ler .env.local manualmente
const envRaw = readFileSync('.env.local', 'utf8');
const env = {};
for (const line of envRaw.split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.+)$/);
  if (m) env[m[1]] = m[2].trim();
}

const url = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE;

if (!url || !key) { console.error('SUPABASE_URL ou SERVICE_ROLE ausente'); process.exit(1); }

const sb = createClient(url, key);

const TABLES = ['fin_payment_destinations','fin_payment_charges','fin_webhook_events'];
const results = await Promise.all(TABLES.map(t => sb.from(t).select('id').limit(1)));
let allOk = true;
for (let i = 0; i < TABLES.length; i++) {
  const { error } = results[i];
  const status = error ? `❌ AUSENTE — ${error.message}` : '✅ OK';
  console.log(`${TABLES[i]}: ${status}`);
  if (error) allOk = false;
}

if (!allOk) {
  console.log('\n⚠️  MIGRATION NÃO APLICADA. Aplique 20260524100000_tesouraria_digital_fase_a.sql no SQL Editor do Supabase antes de continuar.');
  process.exit(1);
}
console.log('\n✅ Pré-requisito: migration aplicada com sucesso.');
