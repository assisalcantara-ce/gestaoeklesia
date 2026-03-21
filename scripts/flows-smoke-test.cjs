/* eslint-disable no-console */
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !serviceKey || !anonKey) {
  console.error('Missing env: SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY/NEXT_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

const adminClient = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function createRlsClient(accessToken) {
  return createClient(supabaseUrl, anonKey, {
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function mapBaseRole(role) {
  switch ((role || '').toLowerCase()) {
    case 'admin':
      return ['ADMINISTRADOR'];
    case 'manager':
      return ['SUPERVISOR'];
    case 'operator':
      return ['OPERADOR'];
    case 'viewer':
      return ['LEITURA'];
    default:
      return [];
  }
}

function getAvailableActions(instance, definition, userRoles) {
  const roleSet = new Set(userRoles.map(r => String(r).toUpperCase()));
  return definition.transitions.filter(t => {
    if (t.from !== instance.status) return false;
    if (roleSet.has('ADMINISTRADOR')) return true;
    return t.roles.some(r => roleSet.has(String(r).toUpperCase()));
  });
}

function applyAction(instance, definition, action, userRoles, payload) {
  const available = getAvailableActions(instance, definition, userRoles);
  const transition = available.find(t => t.action === action);
  if (!transition) throw new Error('ACTION_NOT_ALLOWED');

  const nextData = { ...(instance.data_json || {}), ...(payload.data || {}) };

  if (transition.required_fields && transition.required_fields.length > 0) {
    const missing = transition.required_fields.filter(f => {
      const v = nextData[f];
      return v === undefined || v === null || v === '';
    });
    if (missing.length > 0) throw new Error('MISSING_FIELDS');
  }

  if (transition.require_note && !payload.note) throw new Error('NOTE_REQUIRED');

  const finalStatuses = new Set((definition.final_statuses || []).map(s => String(s).toLowerCase()));
  const shouldClose = finalStatuses.has(String(transition.to).toLowerCase());

  return {
    nextStatus: transition.to,
    nextAssigneeRole: transition.next_role || null,
    nextData,
    closedAt: shouldClose ? new Date().toISOString() : null,
  };
}

async function findUserByEmail(email) {
  const { data, error } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;
  return (data?.users || []).find(u => String(u.email || '').toLowerCase() === email.toLowerCase()) || null;
}

async function ensureUser(email, password) {
  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (!error && data?.user?.id) {
    return data.user.id;
  }

  const alreadyExists = String(error?.message || '').toLowerCase().includes('already');
  if (!alreadyExists) throw error;

  const existing = await findUserByEmail(email);
  if (!existing?.id) throw error;

  await adminClient.auth.admin.updateUserById(existing.id, {
    password,
    email_confirm: true,
  });

  return existing.id;
}

async function signIn(email, password) {
  const anon = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await anon.auth.signInWithPassword({ email, password });
  if (error || !data?.session?.access_token) throw error || new Error('NO_TOKEN');
  return data.session.access_token;
}

function decodeJwtSub(token) {
  const parts = String(token || '').split('.');
  if (parts.length < 2) return null;
  const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
  const padded = payload.padEnd(payload.length + (4 - (payload.length % 4 || 4)), '=');
  try {
    const decoded = Buffer.from(padded, 'base64').toString('utf8');
    const data = JSON.parse(decoded);
    return data?.sub || null;
  } catch {
    return null;
  }
}

async function main() {
  const suffix = Date.now();
  const password = `Smoke${String(suffix).slice(-6)}!`;

  const ownerEmail = `owner+flows-${suffix}@test.local`;
  const adminEmail = `admin+flows-${suffix}@test.local`;
  const supervisorEmail = `supervisor+flows-${suffix}@test.local`;
  const operatorEmail = `operator+flows-${suffix}@test.local`;
  const operatorBEmail = `operatorb+flows-${suffix}@test.local`;
  const viewerEmail = `viewer+flows-${suffix}@test.local`;

  const ownerId = await ensureUser(ownerEmail, password);
  const adminId = await ensureUser(adminEmail, password);
  const supervisorId = await ensureUser(supervisorEmail, password);
  const operatorId = await ensureUser(operatorEmail, password);
  const operatorBId = await ensureUser(operatorBEmail, password);
  const viewerId = await ensureUser(viewerEmail, password);

  const slug = `smoke-flows-${suffix}`;
  const ministryName = `Ministry Smoke ${suffix}`;

  const { data: ministry, error: ministryErr } = await adminClient
    .from('ministries')
    .insert({
      user_id: ownerId,
      name: ministryName,
      slug,
      email_admin: ownerEmail,
    })
    .select('id, name')
    .single();

  if (ministryErr) throw ministryErr;

  const { data: congregacoes, error: congregacoesErr } = await adminClient
    .from('congregacoes')
    .insert([
      { ministry_id: ministry.id, nome: `SEDE ${suffix}` },
      { ministry_id: ministry.id, nome: `FILIAL ${suffix}` },
    ])
    .select('id, nome');

  if (congregacoesErr || !congregacoes || congregacoes.length < 2) {
    throw congregacoesErr || new Error('Falha ao criar congregacoes');
  }

  const congregacaoAId = congregacoes[0].id;
  const congregacaoBId = congregacoes[1].id;

  const { error: muErr } = await adminClient
    .from('ministry_users')
    .upsert([
      { ministry_id: ministry.id, user_id: adminId, role: 'admin', permissions: [] },
      { ministry_id: ministry.id, user_id: supervisorId, role: 'manager', permissions: [] },
      { ministry_id: ministry.id, user_id: operatorId, role: 'operator', permissions: [], congregacao_id: congregacaoAId },
      { ministry_id: ministry.id, user_id: operatorBId, role: 'operator', permissions: [], congregacao_id: congregacaoBId },
      { ministry_id: ministry.id, user_id: viewerId, role: 'viewer', permissions: [], congregacao_id: congregacaoAId },
    ], { onConflict: 'ministry_id,user_id' });

  if (muErr) throw muErr;

  const adminToken = await signIn(adminEmail, password);
  const supervisorToken = await signIn(supervisorEmail, password);
  const operatorToken = await signIn(operatorEmail, password);
  const operatorBToken = await signIn(operatorBEmail, password);
  const viewerToken = await signIn(viewerEmail, password);

  const adminTokenSub = decodeJwtSub(adminToken);
  const operatorTokenSub = decodeJwtSub(operatorToken);

  const adminRls = createRlsClient(adminToken);
  const supervisorRls = createRlsClient(supervisorToken);
  const operatorRls = createRlsClient(operatorToken);
  const operatorBRls = createRlsClient(operatorBToken);
  const viewerRls = createRlsClient(viewerToken);
  const baseUrl = process.env.FLOWS_BASE_URL || 'http://localhost:3000';

  console.log('Context:', {
    ministry_id: ministry.id,
    admin_id: adminId,
    supervisor_id: supervisorId,
    operator_id: operatorId,
    operator_b_id: operatorBId,
    viewer_id: viewerId,
    admin_token_sub: adminTokenSub,
    operator_token_sub: operatorTokenSub,
    congregacao_a_id: congregacaoAId,
    congregacao_b_id: congregacaoBId,
  });

  const definition = {
    initial_status: 'pendente',
    statuses: ['pendente', 'em_analise', 'concluido'],
    transitions: [
      { action: 'iniciar', from: 'pendente', to: 'em_analise', roles: ['OPERADOR'] },
      { action: 'concluir', from: 'em_analise', to: 'concluido', roles: ['ADMINISTRADOR'] },
    ],
    final_statuses: ['concluido', 'rejeitado', 'cancelado'],
  };

  const { data: template, error: templateErr } = await adminRls
    .from('flow_templates')
    .insert({
      ministry_id: ministry.id,
      name: `Fluxo Smoke ${suffix}`,
      description: 'Fluxo de teste smoke',
      current_version: 1,
      is_published: false,
      created_by: adminId,
    })
    .select('id, name, current_version')
    .single();

  if (templateErr) throw templateErr;

  const { error: versionErr } = await adminRls
    .from('flow_template_versions')
    .insert({
      template_id: template.id,
      version: 1,
      definition_json: definition,
      published_by: adminId,
      published_at: null,
    });

  if (versionErr) throw versionErr;

  const { error: publishErr } = await adminRls
    .from('flow_template_versions')
    .update({ published_at: new Date().toISOString(), published_by: adminId })
    .eq('template_id', template.id)
    .eq('version', 1);

  if (publishErr) throw publishErr;

  const { error: templatePublishErr } = await adminRls
    .from('flow_templates')
    .update({ is_published: true })
    .eq('id', template.id);

  if (templatePublishErr) throw templatePublishErr;

  const { data: activation, error: activationErr } = await adminRls
    .from('flow_activations')
    .upsert({
      template_id: template.id,
      ministry_id: ministry.id,
      congregation_id: congregacaoAId,
      is_active: true,
      updated_by: adminId,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'ministry_id,congregation_id,template_id' })
    .select('id')
    .single();

  if (activationErr) throw activationErr;

  const { error: activationBErr } = await adminRls
    .from('flow_activations')
    .upsert({
      template_id: template.id,
      ministry_id: ministry.id,
      congregation_id: congregacaoBId,
      is_active: true,
      updated_by: adminId,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'ministry_id,congregation_id,template_id' })
    .select('id')
    .single();

  if (activationBErr) throw activationBErr;

  const { data: instance, error: instanceErr } = await operatorRls
    .from('flow_instances')
    .insert({
      template_id: template.id,
      template_version: 1,
      ministry_id: ministry.id,
      congregation_id: congregacaoAId,
      title: `Instancia Smoke ${suffix}`,
      status: definition.initial_status,
      data_json: {},
      current_assignee_role: null,
      created_by: operatorId,
    })
    .select('*')
    .single();

  if (instanceErr) throw instanceErr;

  const operatorRoles = mapBaseRole('operator');
  const adminRoles = mapBaseRole('admin');

  const firstResult = applyAction(instance, definition, 'iniciar', operatorRoles, { data: {} });
  const { error: firstUpdateErr } = await operatorRls
    .from('flow_instances')
    .update({
      status: firstResult.nextStatus,
      data_json: firstResult.nextData,
      current_assignee_role: firstResult.nextAssigneeRole,
      current_assignee_user_id: null,
      updated_at: new Date().toISOString(),
      closed_at: firstResult.closedAt || null,
    })
    .eq('id', instance.id)
    .eq('ministry_id', ministry.id)
    .eq('congregation_id', congregacaoAId);

  if (firstUpdateErr) throw firstUpdateErr;

  const { error: firstHistoryErr } = await operatorRls
    .from('flow_history')
    .insert({
      instance_id: instance.id,
      action: 'iniciar',
      from_status: instance.status,
      to_status: firstResult.nextStatus,
      user_id: operatorId,
      note: null,
    });

  if (firstHistoryErr) throw firstHistoryErr;

  const instanceAfterFirst = {
    ...instance,
    status: firstResult.nextStatus,
    data_json: firstResult.nextData,
  };

  const secondResult = applyAction(instanceAfterFirst, definition, 'concluir', adminRoles, { data: {} });
  const { error: secondUpdateErr } = await adminRls
    .from('flow_instances')
    .update({
      status: secondResult.nextStatus,
      data_json: secondResult.nextData,
      current_assignee_role: secondResult.nextAssigneeRole,
      current_assignee_user_id: null,
      updated_at: new Date().toISOString(),
      closed_at: secondResult.closedAt || null,
    })
    .eq('id', instance.id)
    .eq('ministry_id', ministry.id)
    .eq('congregation_id', congregacaoAId);

  if (secondUpdateErr) throw secondUpdateErr;

  const { error: secondHistoryErr } = await adminRls
    .from('flow_history')
    .insert({
      instance_id: instance.id,
      action: 'concluir',
      from_status: firstResult.nextStatus,
      to_status: secondResult.nextStatus,
      user_id: adminId,
      note: null,
    });

  if (secondHistoryErr) throw secondHistoryErr;

  const { data: instanceB, error: instanceBErr } = await operatorBRls
    .from('flow_instances')
    .insert({
      template_id: template.id,
      template_version: 1,
      ministry_id: ministry.id,
      congregation_id: congregacaoBId,
      title: `Instancia Smoke B ${suffix}`,
      status: definition.initial_status,
      data_json: {},
      current_assignee_role: null,
      created_by: operatorBId,
    })
    .select('*')
    .single();

  if (instanceBErr) throw instanceBErr;

  if (secondHistoryErr) throw secondHistoryErr;

  const { data: historyRows, error: historyErr } = await adminRls
    .from('flow_history')
    .select('id, action, from_status, to_status, user_id, created_at')
    .eq('instance_id', instance.id)
    .order('created_at', { ascending: true });

  if (historyErr) throw historyErr;

  const { data: dashboardRows, error: dashboardErr } = await adminRls
    .from('flow_instances')
    .select('status, template_id, template_version')
    .eq('ministry_id', ministry.id);

  if (dashboardErr) throw dashboardErr;

  const counts = { ativos: 0, pendentes: 0, concluidos: 0 };
  const terminalSet = new Set(['concluido', 'rejeitado', 'cancelado']);
  (dashboardRows || []).forEach(row => {
    const status = String(row.status || '').toLowerCase();
    if (terminalSet.has(status)) {
      counts.concluidos += 1;
    } else if (['pendente', 'aguardando', 'em_analise'].includes(status)) {
      counts.pendentes += 1;
    } else {
      counts.ativos += 1;
    }
  });

  const rlsProbe = {
    operatorInsertTemplate: null,
    viewerUpdateTemplate: null,
    viewerSelectTemplates: null,
    operatorBActivationsA: null,
    operatorBInstancesA: null,
    operatorAllInstances: null,
    adminAllInstances: null,
    supervisorAllInstances: null,
    adminActivationsAllStatus: null,
    adminActivationsAllCount: null,
    operatorActivationsAllStatus: null,
    operatorActivationsAllCount: null,
    activateAllStatus: null,
    adminMuCount: null,
    operatorMuCount: null,
    adminMuRlsCount: null,
    operatorMuRlsCount: null,
  };

  const { data: adminMu } = await adminClient
    .from('ministry_users')
    .select('id')
    .eq('user_id', adminId);
  rlsProbe.adminMuCount = (adminMu || []).length;

  const { data: operatorMu } = await adminClient
    .from('ministry_users')
    .select('id')
    .eq('user_id', operatorId);
  rlsProbe.operatorMuCount = (operatorMu || []).length;

  const { data: adminMuRls } = await adminRls
    .from('ministry_users')
    .select('id')
    .eq('user_id', adminId);
  rlsProbe.adminMuRlsCount = (adminMuRls || []).length;

  const { data: operatorMuRls } = await operatorRls
    .from('ministry_users')
    .select('id')
    .eq('user_id', operatorId);
  rlsProbe.operatorMuRlsCount = (operatorMuRls || []).length;

  const operatorInsert = await operatorRls
    .from('flow_templates')
    .insert({
      ministry_id: ministry.id,
      name: `Fluxo Bloqueado ${suffix}`,
      description: 'Tentativa operador',
      current_version: 1,
      is_published: false,
      created_by: operatorId,
    });

  rlsProbe.operatorInsertTemplate = operatorInsert.error ? operatorInsert.error.message : 'OK';

  const viewerUpdate = await viewerRls
    .from('flow_templates')
    .update({ description: 'Tentativa viewer' })
    .eq('id', template.id)
    .select('id, description');

  if (viewerUpdate.error) {
    rlsProbe.viewerUpdateTemplate = viewerUpdate.error.message;
  } else {
    const updatedCount = (viewerUpdate.data || []).length;
    rlsProbe.viewerUpdateTemplate = updatedCount > 0 ? `ATUALIZOU (${updatedCount})` : 'BLOQUEADO (0 rows)';
  }

  const viewerSelect = await viewerRls
    .from('flow_templates')
    .select('id, name')
    .eq('ministry_id', ministry.id);

  rlsProbe.viewerSelectTemplates = viewerSelect.error ? viewerSelect.error.message : `OK (${(viewerSelect.data || []).length})`;

  const operatorBAct = await operatorBRls
    .from('flow_activations')
    .select('id')
    .eq('ministry_id', ministry.id)
    .eq('congregation_id', congregacaoAId);

  rlsProbe.operatorBActivationsA = operatorBAct.error ? operatorBAct.error.message : `OK (${(operatorBAct.data || []).length})`;

  const operatorBInst = await operatorBRls
    .from('flow_instances')
    .select('id')
    .eq('ministry_id', ministry.id)
    .eq('congregation_id', congregacaoAId);

  rlsProbe.operatorBInstancesA = operatorBInst.error ? operatorBInst.error.message : `OK (${(operatorBInst.data || []).length})`;

  const operatorAll = await operatorRls
    .from('flow_instances')
    .select('id')
    .eq('ministry_id', ministry.id);

  rlsProbe.operatorAllInstances = operatorAll.error ? operatorAll.error.message : `OK (${(operatorAll.data || []).length})`;

  const adminAll = await adminRls
    .from('flow_instances')
    .select('id')
    .eq('ministry_id', ministry.id);

  rlsProbe.adminAllInstances = adminAll.error ? adminAll.error.message : `OK (${(adminAll.data || []).length})`;

  const supervisorAll = await supervisorRls
    .from('flow_instances')
    .select('id')
    .eq('ministry_id', ministry.id);

  rlsProbe.supervisorAllInstances = supervisorAll.error ? supervisorAll.error.message : `OK (${(supervisorAll.data || []).length})`;

  const adminActAllRes = await fetch(`${baseUrl}/api/flows/activations?congregation_id=all`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  rlsProbe.adminActivationsAllStatus = adminActAllRes.status;
  if (adminActAllRes.ok) {
    const data = await adminActAllRes.json();
    rlsProbe.adminActivationsAllCount = (data?.data || []).length;
  } else {
    rlsProbe.adminActivationsAllBody = await adminActAllRes.text();
  }

  const operatorActAllRes = await fetch(`${baseUrl}/api/flows/activations?congregation_id=all`, {
    headers: { Authorization: `Bearer ${operatorToken}` }
  });
  rlsProbe.operatorActivationsAllStatus = operatorActAllRes.status;
  if (operatorActAllRes.ok) {
    const data = await operatorActAllRes.json();
    rlsProbe.operatorActivationsAllCount = (data?.data || []).length;
  } else {
    rlsProbe.operatorActivationsAllBody = await operatorActAllRes.text();
  }

  const activateAllRes = await fetch(`${baseUrl}/api/flows/activations/${template.id}/activate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ congregation_id: 'all' })
  });
  rlsProbe.activateAllStatus = activateAllRes.status;
  if (!activateAllRes.ok) {
    rlsProbe.activateAllBody = await activateAllRes.text();
  }

  console.log('Resultado:', {
    template_id: template.id,
    activation_id: activation?.id,
    instance_id: instance.id,
    instance_b_id: instanceB.id,
    history_count: historyRows?.length || 0,
    dashboard: counts,
    rls_probe: rlsProbe,
  });
}

main().catch(err => {
  console.error('Smoke test falhou:', err?.message || err);
  process.exit(1);
});
