const { createClient } = require('./node_modules/@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function main() {
  console.log('--- TESTANDO CrmService.getSummary ---');
  try {
    const { CrmService } = require('./src/lib/platform/crm/service');
    const crmService = new CrmService();
    const summary = await crmService.getSummary(supabase);
    console.log('✅ SUMMARY RESULT:', summary);
  } catch (err) {
    console.error('❌ ERRO EM getSummary:', err);
  }

  console.log('\n--- TESTANDO CrmService.getNextActions ---');
  try {
    const { CrmService } = require('./src/lib/platform/crm/service');
    const crmService = new CrmService();
    const nextActions = await crmService.getNextActions(supabase);
    console.log('✅ NEXT ACTIONS RESULT (length):', nextActions.length);
  } catch (err) {
    console.error('❌ ERRO EM getNextActions:', err);
  }
}

main().catch(console.error);
