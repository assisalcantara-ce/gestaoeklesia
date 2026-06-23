require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  console.error("NEXT_PUBLIC_SUPABASE_URL is missing!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const sql = `
    -- 1. Remover constraint/índice atual members_ministry_email_unique se existir.
    ALTER TABLE public.members DROP CONSTRAINT IF EXISTS members_ministry_email_unique;
    DROP INDEX IF EXISTS public.members_ministry_email_unique;

    -- 2. Criar índice único parcial
    CREATE UNIQUE INDEX IF NOT EXISTS members_ministry_email_partial_idx 
    ON public.members (ministry_id, lower(email)) 
    WHERE email IS NOT NULL AND trim(email) <> '';
  `;

  console.log("Running migration via RPC exec_sql...");
  const { data, error } = await supabase.rpc('exec_sql', { sql });
  if (error) {
    console.error("❌ MIGRATION FAILED:", error);
  } else {
    console.log("✅ MIGRATION SUCCESS!", data);
  }
}

main();
