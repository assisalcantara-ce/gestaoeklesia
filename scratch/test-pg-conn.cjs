const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');

async function main() {
  const sqlPath = path.join(__dirname, '../supabase/migrations/20260723143000_create_admin_impersonation_sessions.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  // Supabase direct DB host: db.qspueosxkolmwvibhzkt.supabase.co
  // Supabase transaction pooler host: aws-0-sa-east-1.pooler.supabase.com:6543 / 5432
  const connStrings = [
    process.env.DATABASE_URL,
    process.env.SUPABASE_DATABASE_URL,
    process.env.DIRECT_URL,
    'postgres://postgres.qspueosxkolmwvibhzkt:e3c19babc4c62ae17b2363e7abba25fc77484ebcebed5e4e4e25e6f0b6cd7f28@aws-0-sa-east-1.pooler.supabase.com:6543/postgres'
  ].filter(Boolean);

  console.log(`Tentando conectar via Postgres Client (opcoes: ${connStrings.length})...`);

  for (const connStr of connStrings) {
    try {
      const client = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
      await client.connect();
      console.log("Connected to PG!");
      await client.query(sql);
      console.log("✅ TABLE admin_impersonation_sessions CREATED SUCCESSFULLY VIA PG!");
      await client.end();
      return;
    } catch (e) {
      console.log("Connection failed for string:", e.message);
    }
  }

  console.log("Nenhuma string de conexao PG funcionou. A migration esta salva em supabase/migrations/20260723143000_create_admin_impersonation_sessions.sql");
}

main();
