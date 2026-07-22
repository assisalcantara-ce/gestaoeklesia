const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function run() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("ERRO: Variaveis Supabase nao encontradas.");
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data: ministries, error } = await supabase
    .from('ministries')
    .select('id, is_active, subscription_status, subscription_end_date, platform_billing_invoices(id, status)');

  if (error) {
    console.error("Erro na busca:", error);
    return;
  }

  // Simular a mesma logica do endpoint /stats
  function getDetailedStatus(m) {
    if (!m.is_active || m.subscription_status === 'suspended') {
      return { label: 'Suspenso', class: '', type: 'SUSPENSO' }
    }
    if (m.subscription_status === 'cancelled') {
      return { label: 'Cancelado', class: '', type: 'CANCELADO' }
    }
    if (m.subscription_status === 'trial') {
      const expiresAt = m.subscription_end_date ? new Date(m.subscription_end_date) : null
      const now = new Date()
      if (expiresAt && expiresAt.getTime() <= now.getTime()) {
        return { label: 'Teste Expirado', class: '', type: 'TRIAL_EXPIRADO', expiresAt }
      } else {
        const diffTime = expiresAt ? expiresAt.getTime() - now.getTime() : 0
        const diffDays = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)))
        return { label: `Teste — restam ${diffDays} dias`, class: '', type: 'TRIAL_ATIVO', expiresAt }
      }
    }
    if (m.subscription_status === 'active') {
      return { label: 'Ativo', class: '', type: 'ATIVO' }
    }
    return {
      label: m.is_active ? 'Ativo' : 'Inativo',
      class: '',
      type: m.is_active ? 'ATIVO' : 'SUSPENSO'
    }
  }

  let ativos = 0;
  let trials = 0;
  let suspensos = 0;
  let pendentes = 0;

  ministries.forEach((m) => {
    const status = getDetailedStatus(m);
    if (status.type === 'ATIVO') ativos++;
    else if (status.type === 'TRIAL_ATIVO') trials++;
    else if (status.type === 'SUSPENSO' || status.type === 'TRIAL_EXPIRADO' || status.type === 'CANCELADO') suspensos++;

    const faturas = m.platform_billing_invoices || [];
    const temPendencia = faturas.some((f) => f.status !== 'RECEIVED' && f.status !== 'CONFIRMED');
    if (temPendencia) pendentes++;
  });

  const responseJson = {
    data: {
      total: ministries.length,
      ativos,
      trials,
      suspensos,
      pendentes
    }
  };

  console.log("=== RESPOSTA RETORNADA PELO ENDPOINT STATS ===");
  console.log(JSON.stringify(responseJson, null, 2));

  console.log("\n=== AMOSTRA DOS 3 PRIMEIROS REGISTROS DO BANCO ===");
  console.log(JSON.stringify(ministries.slice(0, 3), null, 2));
}

run();
