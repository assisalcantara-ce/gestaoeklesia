'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import PageLayout from '@/components/PageLayout';
import Section from '@/components/Section';
import Tabs from '@/components/Tabs';
import { useRequireSupabaseAuth } from '@/hooks/useRequireSupabaseAuth';
import { createClient } from '@/lib/supabase-client';

const PENDING_STATUSES = new Set(['pendente', 'aguardando', 'em_analise']);
const TERMINAL_STATUSES = new Set(['concluido', 'rejeitado', 'cancelado']);
const APPROVAL_ROLES = new Set(['ADMINISTRADOR', 'ADMIN', 'SUPER_ADMIN']);
const APPROVAL_ACTIONS = ['aprovar', 'rejeitar', 'approve', 'reject'];

function hasApprovalAction(actions: any): boolean {
  if (!Array.isArray(actions)) return false;
  return actions.some((action) => {
    const value = String(action || '').toLowerCase();
    return APPROVAL_ACTIONS.some((token) => value.includes(token));
  });
}

function mapBaseRole(role: string | null | undefined): string[] {
  switch ((role || '').toLowerCase()) {
    case 'admin':
      return ['ADMINISTRADOR'];
    case 'manager':
      return ['SUPERVISOR'];
    case 'supervisor':
      return ['SUPERVISOR'];
    case 'superintendent':
    case 'superintendente':
      return ['SUPERINTENDENTE'];
    case 'operator':
      return ['OPERADOR'];
    case 'viewer':
      return ['LEITURA'];
    default:
      return [];
  }
}

export default function FluxosOperacaoPage() {
  const { loading } = useRequireSupabaseAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);

  const [activeTab, setActiveTab] = useState('minha-fila');
  const [dashboard, setDashboard] = useState({ ativos: 0, pendentes: 0, concluidos: 0 });
  const [instances, setInstances] = useState<any[]>([]);
  const [activations, setActivations] = useState<any[]>([]);
  const [templateDefinitions, setTemplateDefinitions] = useState<Record<string, any>>({});
  const [congregacoes, setCongregacoes] = useState<any[]>([]);
  const [congregationId, setCongregationId] = useState('');
  const [canViewAll, setCanViewAll] = useState(false);
  const [lockedCongregation, setLockedCongregation] = useState(false);
  const [roleLabel, setRoleLabel] = useState('');
  const [roles, setRoles] = useState<string[]>([]);
  const [userId, setUserId] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [newTemplateId, setNewTemplateId] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newData, setNewData] = useState<Record<string, string>>({});
  const [error, setError] = useState('');

  const tabs = [
    { id: 'minha-fila', label: 'Minha fila (pendentes)', icon: '⏳' },
    { id: 'ativos', label: 'Ativos', icon: '▶️' },
    { id: 'concluidos', label: 'Concluidos', icon: '✅' },
    { id: 'aprovacoes', label: 'Aprovações', icon: '✅' },
  ];

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && tabs.some((item) => item.id === tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  useEffect(() => {
    const loadContext = async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      const sessionUserId = data.session?.user?.id;
      if (!token || !sessionUserId) return;

      setUserId(sessionUserId);

      const { data: mu } = await supabase
        .from('ministry_users')
        .select('role, permissions, congregacao_id')
        .eq('user_id', sessionUserId)
        .limit(1)
        .maybeSingle();

      const role = String(mu?.role || '').toLowerCase();
      const perms = Array.isArray(mu?.permissions) ? mu?.permissions : [];
      const permSet = new Set(perms.map((p: any) => String(p || '').toUpperCase()));
      const allowAll = ['admin', 'manager', 'supervisor', 'superintendent', 'superintendente'].includes(role)
        || permSet.has('ADMINISTRADOR')
        || permSet.has('SUPERVISOR')
        || permSet.has('SUPERINTENDENTE');

      const mappedRoles = Array.from(new Set([
        ...mapBaseRole(role),
        ...permSet
      ]));

      setCanViewAll(allowAll);
      setRoleLabel(role);
      setRoles(mappedRoles);

      const isLocked = role === 'operator' || role === 'viewer';
      setLockedCongregation(isLocked);
      if (isLocked && mu?.congregacao_id) {
        setCongregationId(String(mu.congregacao_id));
      } else if (allowAll && !congregationId) {
        setCongregationId('all');
      }

      const { data: rows, error } = await supabase
        .from('congregacoes')
        .select('id, nome')
        .order('nome', { ascending: true });

      if (!error) {
        setCongregacoes(rows || []);
        if (!congregationId && rows && rows.length > 0 && !allowAll) {
          setCongregationId(rows[0].id);
        }
      }
    };

    loadContext();
  }, [supabase]);

  const reloadData = async () => {
    if (!congregationId) return;
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;

    const headers = { Authorization: `Bearer ${token}` };
    const query = `?congregation_id=${congregationId}`;

    const [dashboardRes, activationsRes, instancesRes, templatesRes] = await Promise.all([
      fetch(`/api/flows/dashboard${query}`, { headers }),
      fetch(`/api/flows/activations${query}`, { headers }),
      fetch(`/api/flows/instances${query}`, { headers }),
      fetch('/api/flows/templates', { headers })
    ]);

    if (dashboardRes.ok) {
      const data = await dashboardRes.json();
      if (data?.data) setDashboard(data.data);
    }

    if (activationsRes.ok) {
      const data = await activationsRes.json();
      setActivations(data?.data || []);
    }

    if (instancesRes.ok) {
      const data = await instancesRes.json();
      setInstances(data?.data || []);
    }

    if (templatesRes.ok) {
      const data = await templatesRes.json();
      const next: Record<string, any> = {};
      (data?.data || []).forEach((template: any) => {
        next[String(template.id)] = template?.latest_version?.definition_json || null;
      });
      setTemplateDefinitions(next);
    }
  };

  useEffect(() => {
    reloadData();
  }, [supabase, congregationId]);

  const activeTemplates = useMemo(() => {
    return (activations || [])
      .filter((a: any) => a.is_active && (a.template || a.template_id))
      .map((a: any) => ({
        activationId: a.id,
        templateId: a.template?.id || a.template_id,
        name: a.template?.name || `Template ${a.template_id}`,
        description: a.template?.description || null,
      }));
  }, [activations]);

  const mineQueue = useMemo(() => {
    return (instances || []).filter((item: any) => {
      const status = String(item.status || '').toLowerCase();
      if (!PENDING_STATUSES.has(status)) return false;
      if (APPROVAL_ROLES.has(String(item.current_assignee_role || '').toUpperCase())) return false;
      if (hasApprovalAction(item.available_actions)) return false;
      if (item.has_approval_actions) return false;
      if (item.current_assignee_user_id && item.current_assignee_user_id === userId) return true;
      if (!item.current_assignee_user_id && item.current_assignee_role) {
        return roles.includes(String(item.current_assignee_role).toUpperCase());
      }
      return roles.includes('ADMINISTRADOR');
    });
  }, [instances, roles, userId]);

  const activeList = useMemo(() => {
    return (instances || []).filter((item: any) => {
      const status = String(item.status || '').toLowerCase();
      return !PENDING_STATUSES.has(status) && !TERMINAL_STATUSES.has(status);
    });
  }, [instances]);

  const concludedList = useMemo(() => {
    return (instances || []).filter((item: any) => {
      const status = String(item.status || '').toLowerCase();
      return TERMINAL_STATUSES.has(status);
    });
  }, [instances]);

  const approvalCandidates = useMemo(() => {
    return (instances || []).filter((item: any) => {
      if (item.has_approval_actions) return true;
      return APPROVAL_ROLES.has(String(item.current_assignee_role || '').toUpperCase());
    });
  }, [instances]);

  const approvalsList = useMemo(() => {
    return approvalCandidates.filter((item: any) => {
      const status = String(item.status || '').toLowerCase();
      if (!PENDING_STATUSES.has(status)) return false;
      if (hasApprovalAction(item.available_actions)) return true;
      return APPROVAL_ROLES.has(String(item.current_assignee_role || '').toUpperCase());
    });
  }, [approvalCandidates]);

  const approvalStats = useMemo(() => {
    const pending = approvalCandidates.filter((item: any) => PENDING_STATUSES.has(String(item.status || '').toLowerCase())).length;
    const approved = approvalCandidates.filter((item: any) => String(item.status || '').toLowerCase() === 'aprovado').length;
    const rejected = approvalCandidates.filter((item: any) => String(item.status || '').toLowerCase() === 'rejeitado').length;
    return { pending, approved, rejected };
  }, [approvalCandidates]);

  const listByTab = activeTab === 'minha-fila'
    ? mineQueue
    : activeTab === 'concluidos'
      ? concludedList
      : activeList;

  const selectedDefinition = newTemplateId ? templateDefinitions[newTemplateId] : null;
  const selectedFields = Array.isArray(selectedDefinition?.fields)
    ? selectedDefinition.fields
    : Array.isArray(selectedDefinition?.form?.fields)
      ? selectedDefinition.form.fields
      : [];

  useEffect(() => {
    if (!newTemplateId) {
      setNewData({});
      return;
    }
    const next: Record<string, string> = {};
    selectedFields.forEach((field: any) => {
      const name = String(field?.name || '');
      if (!name) return;
      next[name] = newData[name] || '';
    });
    setNewData(next);
  }, [newTemplateId, templateDefinitions]);

  const createInstance = async () => {
    setError('');
    if (!newTemplateId) {
      setError('Selecione um template ativo.');
      return;
    }
    if (!congregationId || congregationId === 'all') {
      setError('Selecione uma congregacao valida para criar a instancia.');
      return;
    }

    if (selectedFields.length > 0) {
      const missing = selectedFields
        .filter((field: any) => field?.required)
        .filter((field: any) => {
          const name = String(field?.name || '');
          return !name || !newData[name];
        });
      if (missing.length > 0) {
        setError('Preencha os campos obrigatorios antes de continuar.');
        return;
      }
    }

    const payloadData = { ...newData };

    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;

    const res = await fetch('/api/flows/instances', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        template_id: newTemplateId,
        congregation_id: congregationId,
        title: newTitle,
        data_json: payloadData,
      })
    });

    if (!res.ok) {
      const err = await res.json();
      setError(err?.error || 'Falha ao criar instancia');
      return;
    }

    const payload = await res.json();
    const instanceId = payload?.data?.id;
    await reloadData();
    if (instanceId) {
      router.push(`/secretaria/fluxos/${instanceId}`);
    }
  };

  if (loading) return <div className="p-8">Carregando...</div>;

  return (
    <PageLayout
      title="Fluxos (Operacao)"
      description="Executar fluxos da secretaria"
      activeMenu="fluxos-operacao"
    >
      <div className="bg-white p-4 rounded-lg shadow border border-gray-200 mb-6 flex flex-col gap-2">
        <p className="text-xs font-semibold text-gray-600">Congregacao</p>
        <select
          value={congregationId}
          onChange={(e) => setCongregationId(e.target.value)}
          className="w-full md:max-w-md border border-gray-300 rounded px-3 py-2 text-sm"
          disabled={lockedCongregation}
        >
          {canViewAll && <option value="all">Todas</option>}
          {!canViewAll && <option value="">Selecione uma congregacao</option>}
          {congregacoes.map((c: any) => (
            <option key={c.id} value={c.id}>{c.nome}</option>
          ))}
        </select>
        {lockedCongregation && roleLabel && (
          <p className="text-xs text-gray-500">Perfil {roleLabel} limitado a sua congregacao.</p>
        )}
        {congregationId === 'all' && canViewAll && (
          <p className="text-xs text-gray-500">Visualizacao agregada. Selecione uma congregacao para criar instancias.</p>
        )}
      </div>

      <div className="flex flex-col md:flex-row gap-4 md:items-center md:justify-between mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1">
          <div className="bg-white p-4 rounded-lg shadow border-l-4 border-blue-500">
            <p className="text-gray-600 text-sm">Fluxos Ativos</p>
            <p className="text-2xl font-bold text-[#123b63] mt-1">{dashboard.ativos}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow border-l-4 border-green-500">
            <p className="text-gray-600 text-sm">Concluidos</p>
            <p className="text-2xl font-bold text-green-600 mt-1">{dashboard.concluidos}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow border-l-4 border-yellow-500">
            <p className="text-gray-600 text-sm">Pendentes</p>
            <p className="text-2xl font-bold text-yellow-600 mt-1">{dashboard.pendentes}</p>
          </div>
        </div>
        <button
          onClick={() => setShowNew(prev => !prev)}
          className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
        >
          Novo Fluxo
        </button>
      </div>

      {showNew && (
        <Section icon="➕" title="Criar instancia">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="text-xs font-semibold text-gray-600">Template ativo</label>
              <select
                value={newTemplateId}
                onChange={(e) => setNewTemplateId(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              >
                <option value="">Selecione</option>
                {activeTemplates.map((t: any) => (
                  <option key={t.templateId} value={t.templateId}>{t.name}</option>
                ))}
              </select>
              <label className="text-xs font-semibold text-gray-600 mt-3 block">Titulo</label>
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                placeholder="Opcional"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600">Dados iniciais</label>
              {selectedFields.length === 0 ? (
                <p className="text-xs text-gray-500 mt-1">Nenhum campo inicial definido para este template.</p>
              ) : (
                <div className="mt-2 space-y-3">
                  {selectedFields.map((field: any) => {
                    const name = String(field?.name || '');
                    if (!name) return null;
                    const label = String(field?.label || name);
                    const type = String(field?.type || 'text');
                    const value = newData[name] || '';
                    return (
                      <div key={name}>
                        <label className="text-xs font-semibold text-gray-600">
                          {label}{field?.required ? ' *' : ''}
                        </label>
                        {type === 'textarea' ? (
                          <textarea
                            value={value}
                            onChange={(e) => setNewData(prev => ({ ...prev, [name]: e.target.value }))}
                            className="w-full min-h-[90px] border border-gray-300 rounded p-2 text-sm"
                          />
                        ) : type === 'select' ? (
                          <select
                            value={value}
                            onChange={(e) => setNewData(prev => ({ ...prev, [name]: e.target.value }))}
                            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                          >
                            <option value="">Selecione</option>
                            {(field?.options || []).map((option: string) => (
                              <option key={option} value={option}>{option}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type={type === 'date' ? 'date' : 'text'}
                            value={value}
                            onChange={(e) => setNewData(prev => ({ ...prev, [name]: e.target.value }))}
                            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
              <button
                onClick={createInstance}
                className="mt-3 w-full px-3 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700"
              >
                Criar instancia
              </button>
            </div>
          </div>
        </Section>
      )}

      <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab}>
        {activeTab === 'aprovacoes' ? (
          <Section icon="✅" title="Aprovações do Fluxo">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="bg-white border border-gray-200 rounded p-3">
                <p className="text-xs text-gray-500">Pendentes</p>
                <p className="text-xl font-semibold text-yellow-600">{approvalStats.pending}</p>
              </div>
              <div className="bg-white border border-gray-200 rounded p-3">
                <p className="text-xs text-gray-500">Aprovadas</p>
                <p className="text-xl font-semibold text-green-600">{approvalStats.approved}</p>
              </div>
              <div className="bg-white border border-gray-200 rounded p-3">
                <p className="text-xs text-gray-500">Rejeitadas</p>
                <p className="text-xl font-semibold text-red-600">{approvalStats.rejected}</p>
              </div>
            </div>
            {!roles.includes('ADMINISTRADOR') ? (
              <p className="text-sm text-gray-500">Aprovações disponíveis somente para administradores.</p>
            ) : approvalsList.length === 0 ? (
              <p className="text-sm text-gray-500">Nenhuma aprovação pendente.</p>
            ) : (
              <div className="space-y-3">
                {approvalsList.map((item: any) => (
                  <div key={item.id} className="border border-gray-200 rounded p-4 bg-white flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{item.title || item?.template?.name || 'Fluxo'}</p>
                      <p className="text-xs text-gray-500">Status: {item.status}</p>
                      <p className="text-xs text-gray-500">
                        Responsavel: {item.current_assignee_user_id ? `Usuario ${item.current_assignee_user_id}` : (item.current_assignee_role || 'Fila')}
                      </p>
                      {hasApprovalAction(item.available_actions) && (
                        <div className="mt-2 flex flex-wrap gap-2 text-xs">
                          {item.available_actions.map((action: string) => {
                            const label = String(action || '').toLowerCase();
                            if (!APPROVAL_ACTIONS.some((token) => label.includes(token))) return null;
                            const isReject = label.includes('rejeit') || label.includes('reject');
                            return (
                              <span
                                key={action}
                                className={`px-2 py-1 rounded border ${isReject ? 'border-red-200 text-red-700 bg-red-50' : 'border-green-200 text-green-700 bg-green-50'}`}
                              >
                                {action}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    <Link
                      href={`/secretaria/fluxos/${item.id}`}
                      className="px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 text-center"
                    >
                      Abrir
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </Section>
        ) : listByTab.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhuma instancia encontrada.</p>
        ) : (
          <div className="space-y-3">
            {listByTab.map((item: any) => (
              <div key={item.id} className="border border-gray-200 rounded p-4 bg-white flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-800">{item.title || item?.template?.name || 'Fluxo'}</p>
                  <p className="text-xs text-gray-500">Status: {item.status}</p>
                  <p className="text-xs text-gray-500">
                    Responsavel: {item.current_assignee_user_id ? `Usuario ${item.current_assignee_user_id}` : (item.current_assignee_role || 'Fila')}
                  </p>
                </div>
                <Link
                  href={`/secretaria/fluxos/${item.id}`}
                  className="px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 text-center"
                >
                  Abrir
                </Link>
              </div>
            ))}
          </div>
        )}
      </Tabs>
    </PageLayout>
  );
}
