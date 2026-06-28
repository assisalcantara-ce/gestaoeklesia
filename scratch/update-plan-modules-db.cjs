const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ ERRO: Variáveis de ambiente no .env.local ausentes.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function updatePlans() {
  try {
    console.log('🔄 Atualizando módulos de assinatura no Supabase...');

    // 1. Basic (sem Agenda)
    const { error: err1 } = await supabase
      .from('subscription_plans')
      .update({
        modulos: ['Secretaria Geral', 'Achados e Perdidos', 'Patrimônio', 'Geolocalização', 'Auditoria'],
        updated_at: new Date().toISOString()
      })
      .eq('slug', 'basic');
    if (err1) throw err1;
    console.log('✅ Plano Basic atualizado (sem Agenda).');

    // 2. Starter (com Agenda)
    const { error: err2 } = await supabase
      .from('subscription_plans')
      .update({
        modulos: ['Secretaria Geral', 'Achados e Perdidos', 'Patrimônio', 'Geolocalização', 'Auditoria', 'Tesouraria', 'Missões', 'Chat Interno', 'EBD', 'Agenda do Ministério'],
        updated_at: new Date().toISOString()
      })
      .eq('slug', 'starter');
    if (err2) throw err2;
    console.log('✅ Plano Starter atualizado (com Agenda).');

    // 3. Intermediário (com Agenda)
    const { error: err3 } = await supabase
      .from('subscription_plans')
      .update({
        modulos: ['Secretaria Geral', 'Achados e Perdidos', 'Patrimônio', 'Geolocalização', 'Auditoria', 'Tesouraria', 'Missões', 'Chat Interno', 'EBD', 'Funcionários', 'Comissão', 'Kids', 'Reuniões', 'Agenda do Ministério'],
        updated_at: new Date().toISOString()
      })
      .eq('slug', 'intermediario');
    if (err3) throw err3;
    console.log('✅ Plano Intermediário atualizado (com Agenda).');

    // 4. Profissional (com Agenda)
    const { error: err4 } = await supabase
      .from('subscription_plans')
      .update({
        modulos: ['Secretaria Geral', 'Achados e Perdidos', 'Patrimônio', 'Geolocalização', 'Auditoria', 'Tesouraria', 'Missões', 'Chat Interno', 'EBD', 'Funcionários', 'Comissão', 'Kids', 'Reuniões', 'Eventos', 'Financeiro Avançado', 'Presidência', 'Agenda do Ministério'],
        updated_at: new Date().toISOString()
      })
      .eq('slug', 'profissional');
    if (err4) throw err4;
    console.log('✅ Plano Profissional atualizado (com Agenda).');

    // 5. Expert (com Agenda)
    const { error: err5 } = await supabase
      .from('subscription_plans')
      .update({
        modulos: ['Secretaria Geral', 'Achados e Perdidos', 'Patrimônio', 'Geolocalização', 'Auditoria', 'Tesouraria', 'Missões', 'Chat Interno', 'EBD', 'Funcionários', 'Comissão', 'Kids', 'Reuniões', 'Eventos', 'Financeiro Avançado', 'Presidência', 'Agenda do Ministério'],
        updated_at: new Date().toISOString()
      })
      .eq('slug', 'expert');
    if (err5) throw err5;
    console.log('✅ Plano Expert atualizado (com Agenda).');

    console.log('🎉 Modulos dos planos atualizados com sucesso no Supabase remoto!');
  } catch (error) {
    console.error('❌ Erro ao atualizar planos no Supabase:', error);
    process.exit(1);
  }
}

updatePlans();
