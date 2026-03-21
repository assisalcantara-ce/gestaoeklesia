/* eslint-disable no-console */
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('Missing env: SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const adminClient = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const newDefinition = {
  initial_status: 'pendente',
  statuses: ['pendente', 'em_analise', 'aprovado', 'rejeitado', 'concluido'],
  final_statuses: ['concluido', 'rejeitado'],
  initial_assignee_role: 'OPERADOR',
  form: {
    fields: [
      { name: 'crianca_nome', label: 'Nome da crianca', type: 'text', required: true },
      { name: 'child_id', label: 'ID da crianca (se ja cadastrada)', type: 'text', required: false },
      { name: 'responsavel_1', label: 'Responsavel 1', type: 'text', required: true },
      { name: 'responsavel_2', label: 'Responsavel 2', type: 'text', required: false },
      { name: 'data_apresentacao', label: 'Data da apresentacao', type: 'date', required: true },
      { name: 'culto_turno', label: 'Culto/Turno', type: 'select', required: false, options: ['Manha', 'Tarde', 'Noite'] },
      { name: 'observacoes', label: 'Observacoes', type: 'textarea', required: false },
    ],
  },
  transitions: [
    {
      action: 'iniciar_analise',
      label: 'Enviar para analise',
      from: 'pendente',
      to: 'em_analise',
      roles: ['OPERADOR', 'SUPERVISOR', 'SUPERINTENDENTE'],
      next_role: 'SUPERVISOR',
    },
    {
      action: 'aprovar',
      label: 'Aprovar',
      from: 'em_analise',
      to: 'aprovado',
      roles: ['SUPERVISOR', 'SUPERINTENDENTE', 'ADMINISTRADOR'],
      next_role: 'OPERADOR',
      require_note: false,
    },
    {
      action: 'rejeitar',
      label: 'Rejeitar',
      from: 'em_analise',
      to: 'rejeitado',
      roles: ['SUPERVISOR', 'SUPERINTENDENTE', 'ADMINISTRADOR'],
      require_note: true,
    },
    {
      action: 'concluir',
      label: 'Concluir',
      from: 'aprovado',
      to: 'concluido',
      roles: ['OPERADOR', 'ADMINISTRADOR'],
    },
  ],
};

async function main() {
  const { data: templates, error } = await adminClient
    .from('flow_templates')
    .select('id, name, current_version')
    .ilike('name', '%apresenta%crianc%');

  if (error) throw error;
  if (!templates || templates.length === 0) {
    console.log('Nenhum template encontrado com nome parecido com Apresentacao de Criancas.');
    return;
  }

  let updated = 0;
  for (const template of templates) {
    const { error: updateError } = await adminClient
      .from('flow_template_versions')
      .update({ definition_json: newDefinition })
      .eq('template_id', template.id)
      .eq('version', template.current_version);

    if (updateError) {
      console.error('Falha ao atualizar template:', template.name, updateError.message);
      continue;
    }
    updated += 1;
  }

  console.log('Atualizacao concluida:', { total_templates: templates.length, updated });
}

main().catch((err) => {
  console.error('Falha na atualizacao:', err?.message || err);
  process.exit(1);
});
