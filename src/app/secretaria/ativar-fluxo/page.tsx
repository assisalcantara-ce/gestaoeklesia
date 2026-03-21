'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import PageLayout from '@/components/PageLayout';
import Tabs from '@/components/Tabs';
import Section from '@/components/Section';
import { useRequireSupabaseAuth } from '@/hooks/useRequireSupabaseAuth';
import { createClient } from '@/lib/supabase-client';

export default function AtivarFluxoPage() {
  const { loading } = useRequireSupabaseAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('pendentes');
  const [templates, setTemplates] = useState<any[]>([]);
  const [activations, setActivations] = useState<any[]>([]);
  const [congregacoes, setCongregacoes] = useState<any[]>([]);
  const [congregationId, setCongregationId] = useState('');
  const [canViewAll, setCanViewAll] = useState(false);
  const [lockedCongregation, setLockedCongregation] = useState(false);
  const [roleLabel, setRoleLabel] = useState('');
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [configTemplate, setConfigTemplate] = useState<any | null>(null);
  const [configRoles, setConfigRoles] = useState<string[]>([]);
  const [adminChecked, setAdminChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [actionMessage, setActionMessage] = useState('');
  const [actionPending, setActionPending] = useState<{ id: string; type: 'activate' | 'deactivate' } | null>(null);
  const supabase = useMemo(() => createClient(), []);

  const tabs = [
    { id: 'ativos', label: 'Ativos', icon: '▶️' },
    { id: 'concluidos', label: 'Desativados', icon: '✅' },
    { id: 'pendentes', label: 'Nao ativados', icon: '⏳' }
  ];

  const rolesDisponiveis = ['ADMINISTRADOR', 'FINANCEIRO', 'SUPERVISOR', 'OPERADOR', 'SUPERINTENDENTE', 'COORDENADOR'];

  useEffect(() => {
    const loadContext = async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      const userId = data.session?.user?.id;
      if (!token || !userId) {
        setIsAdmin(false);
        setAdminChecked(true);
        return;
      }

      const { data: mu } = await supabase
        .from('ministry_users')
        .select('role, permissions, congregacao_id')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle();

      const role = String(mu?.role || '').toLowerCase();
      const perms = Array.isArray(mu?.permissions) ? mu?.permissions : [];
      const permSet = new Set(perms.map((p: any) => String(p || '').toUpperCase()));
      const allowAll = ['admin', 'manager', 'supervisor', 'superintendent', 'superintendente'].includes(role)
        || permSet.has('ADMINISTRADOR')
        || permSet.has('SUPERVISOR')
        || permSet.has('SUPERINTENDENTE');

      const adminAccess = allowAll || permSet.has('ADMINISTRADOR');
      setIsAdmin(adminAccess);
      setCanViewAll(allowAll);
      setRoleLabel(role);

      const isLocked = role === 'operator' || role === 'viewer';
      setLockedCongregation(isLocked);
      if (isLocked && mu?.congregacao_id) {
        setCongregationId(String(mu.congregacao_id));
      } else if (allowAll && !congregationId) {
        setCongregationId('all');
      }

      if (adminAccess) {
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
      }

      setAdminChecked(true);
    };

    loadContext();
  }, [supabase]);

  useEffect(() => {
    const run = async () => {
      if (!isAdmin) return;
      if (!congregationId) return;
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;

      const headers = { Authorization: `Bearer ${token}` };
      const query = `?congregation_id=${congregationId}`;

      const [templatesRes, activationsRes] = await Promise.all([
        fetch('/api/flows/templates', { headers }),
        fetch(`/api/flows/activations${query}`, { headers })
      ]);

      if (templatesRes.ok) {
        const data = await templatesRes.json();
        setTemplates(data?.data || []);
      }

      if (activationsRes.ok) {
        const data = await activationsRes.json();
        setActivations(data?.data || []);
      }
    };

    run();
  }, [supabase, congregationId, isAdmin]);

  const mergedTemplates = useMemo(() => {
    return (templates || []).map((t: any) => {
      const activation = (activations || []).find((a: any) => a.template_id === t.id);
      return {
        ...t,
        activation,
      };
    });
  }, [templates, activations]);

  const activationStats = useMemo(() => {
    const all = mergedTemplates || [];
    let ativos = 0;
    let pendentes = 0;
    let concluidos = 0;

    all.forEach((t: any) => {
      const hasActivation = Boolean(t.activation);
      const isActive = Boolean(t.activation?.is_active);
      if (isActive) {
        ativos += 1;
      } else if (hasActivation) {
        concluidos += 1;
      } else {
        pendentes += 1;
      }
    });

    return { ativos, pendentes, concluidos };
  }, [mergedTemplates]);

  const templatesByTab = useMemo(() => {
    if (activeTab === 'ativos') {
      return mergedTemplates.filter((t: any) => t.activation?.is_active);
    }
    if (activeTab === 'concluidos') {
      return mergedTemplates.filter((t: any) => t.activation && !t.activation?.is_active);
    }
    return mergedTemplates.filter((t: any) => !t.activation);
  }, [mergedTemplates, activeTab]);

  useEffect(() => {
    if (activeTab !== 'ativos') return;
    if (activationStats.ativos === 0 && activationStats.pendentes > 0) {
      setActiveTab('pendentes');
    }
  }, [activationStats, activeTab]);

  const congregacaoById = useMemo(() => {
    return new Map((congregacoes || []).map((c: any) => [c.id, c]));
  }, [congregacoes]);

  const activationsGrouped = useMemo(() => {
    if (congregationId !== 'all') return [] as Array<{ id: string; name: string; items: any[] }>;
    const groups = new Map<string, { id: string; name: string; items: any[] }>();
    (activations || []).forEach((a: any) => {
      const cId = String(a.congregation_id || '');
      const c = congregacaoById.get(cId);
      const name = c?.nome || 'Congregacao';
      if (!groups.has(cId)) {
        groups.set(cId, { id: cId, name, items: [] });
      }
      groups.get(cId)?.items.push(a);
    });
    return Array.from(groups.values());
  }, [activations, congregationId, congregacaoById]);

  const openConfig = (template: any) => {
    const roles = template?.activation?.assignees_json?.roles || [];
    setConfigRoles(Array.isArray(roles) ? roles : []);
    setConfigTemplate(template);
    setConfigModalOpen(true);
  };

  const toggleRole = (role: string) => {
    setConfigRoles(prev =>
      prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
    );
  };

  const refreshActivations = async () => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token || !congregationId) return;
    const res = await fetch(`/api/flows/activations?congregation_id=${congregationId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) {
      const data = await res.json();
      setActivations(data?.data || []);
    }
  };

  const activateTemplate = async (templateId: string) => {
    setActionMessage('');
    if (!templateId) {
      setActionMessage('Template invalido.');
      return;
    }
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token || !congregationId || congregationId === 'all') {
      setActionMessage('Selecione uma congregacao valida para ativar.');
      return;
    }
    setActionPending({ id: templateId, type: 'activate' });
    const res = await fetch(`/api/flows/activations/${templateId}/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ congregation_id: congregationId, assignees_json: { roles: configRoles }, settings_json: {} })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setActionMessage(err?.error || 'Falha ao ativar fluxo.');
      setActionPending(null);
      return;
    }
    await refreshActivations();
    setActionMessage('Fluxo ativado com sucesso.');
    setActionPending(null);
  };

  const deactivateTemplate = async (templateId: string) => {
    setActionMessage('');
    if (!templateId) {
      setActionMessage('Template invalido.');
      return;
    }
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token || !congregationId || congregationId === 'all') {
      setActionMessage('Selecione uma congregacao valida para desativar.');
      return;
    }
    setActionPending({ id: templateId, type: 'deactivate' });
    const res = await fetch(`/api/flows/activations/${templateId}/deactivate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ congregation_id: congregationId })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setActionMessage(err?.error || 'Falha ao desativar fluxo.');
      setActionPending(null);
      return;
    }
    await refreshActivations();
    setActionMessage('Fluxo desativado com sucesso.');
    setActionPending(null);
  };

  const saveConfig = async () => {
    if (!configTemplate) return;
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token || !congregationId || congregationId === 'all') return;
    const activationId = configTemplate.activation?.id;
    if (activationId) {
      await fetch(`/api/flows/activations/${activationId}/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ congregation_id: congregationId, assignees_json: { roles: configRoles }, settings_json: {} })
      });
    } else {
      await activateTemplate(configTemplate.id);
    }
    setConfigModalOpen(false);
  };

  if (loading || !adminChecked) return <div className="p-8">Carregando...</div>;
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6">
            <h2 className="text-lg font-semibold text-gray-800">Acesso restrito</h2>
            <p className="text-sm text-gray-600 mt-2">
              Voce precisa de permissao de administrador do ministerio para acessar esta area.
            </p>
            <div className="mt-6 flex flex-col sm:flex-row gap-2 justify-end">
              <button
                onClick={() => router.back()}
                className="px-4 py-2 rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                Voltar
              </button>
              <button
                onClick={() => router.push('/secretaria/fluxos')}
                className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
              >
                Ir para Fluxos
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <PageLayout
      title="Ativar Fluxo"
      description="Gerenciar fluxos de processos da secretaria"
      activeMenu="ativar-fluxo"
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
          <p className="text-xs text-gray-500">Visualizacao agregada. Selecione uma congregacao para ativar/configurar.</p>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-blue-500">
          <p className="text-gray-600 text-sm">Fluxos Ativos</p>
          <p className="text-3xl font-bold text-[#123b63] mt-2">{activationStats.ativos}</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-green-500">
          <p className="text-gray-600 text-sm">Fluxos Concluídos</p>
          <p className="text-3xl font-bold text-green-600 mt-2">{activationStats.concluidos}</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-yellow-500">
          <p className="text-gray-600 text-sm">Fluxos Pendentes</p>
          <p className="text-3xl font-bold text-yellow-600 mt-2">{activationStats.pendentes}</p>
        </div>
      </div>

      <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab}>
        <Section icon="🔄" title="Fluxos Disponíveis">
          {actionMessage && (
            <div className="mb-4 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded p-3">
              {actionMessage}
            </div>
          )}
          {congregationId === 'all' ? (
            activationsGrouped.length === 0 ? (
              <p className="text-gray-500 text-center py-8">Nenhuma ativacao encontrada</p>
            ) : (
              <div className="space-y-6">
                {activationsGrouped.map(group => (
                  <div key={group.id} className="bg-white border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-semibold text-gray-700">{group.name}</p>
                      <span className="text-xs text-gray-500">{group.items.length} fluxo(s)</span>
                    </div>
                    <div className="space-y-3">
                      {group.items.map((a: any) => (
                        <div key={a.id} className="border border-gray-100 rounded p-3 flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-gray-800">{a.template?.name || 'Fluxo'}</p>
                            <p className="text-xs text-gray-500">{a.template?.description || 'Sem descricao'}</p>
                          </div>
                          <span className={`text-xs font-semibold px-2 py-1 rounded ${a.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                            {a.is_active ? 'Ativo' : 'Inativo'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : templatesByTab.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Nenhum fluxo disponível</p>
          ) : (
            <div className="space-y-4">
              {templatesByTab.map((t: any) => {
                const isActive = !!t.activation?.is_active;
                const templateId = String(t?.id || t?.template_id || t?.template?.id || '');
                return (
                  <div key={templateId || t.id} className="bg-white border border-gray-200 rounded-lg p-4 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-gray-800">{t.name}</p>
                      <p className="text-xs text-gray-500">{t.description || 'Sem descricao'}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => openConfig(t)}
                        className="px-3 py-2 text-xs font-semibold rounded bg-gray-100 hover:bg-gray-200"
                      >
                        Configurar
                      </button>
                      {isActive ? (
                        <button
                          onClick={() => deactivateTemplate(templateId)}
                          disabled={actionPending?.id === templateId}
                          className="px-3 py-2 text-xs font-semibold rounded bg-red-100 text-red-700 hover:bg-red-200"
                        >
                          {actionPending?.id === templateId && actionPending.type === 'deactivate' ? 'Desativando...' : 'Desativar'}
                        </button>
                      ) : (
                        <button
                          onClick={() => activateTemplate(templateId)}
                          disabled={actionPending?.id === templateId}
                          className="px-3 py-2 text-xs font-semibold rounded bg-green-600 text-white hover:bg-green-700"
                        >
                          {actionPending?.id === templateId && actionPending.type === 'activate' ? 'Ativando...' : 'Ativar'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Section>
      </Tabs>

      {configModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-lg w-full p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Configurar Fluxo</h3>
            <p className="text-sm text-gray-600 mb-4">Defina quais papeis podem atuar neste fluxo.</p>
            <div className="grid grid-cols-2 gap-3 mb-6">
              {rolesDisponiveis.map(role => (
                <label key={role} className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={configRoles.includes(role)}
                    onChange={() => toggleRole(role)}
                    className="w-4 h-4"
                  />
                  {role}
                </label>
              ))}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setConfigModalOpen(false)}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
              >
                Cancelar
              </button>
              <button
                onClick={saveConfig}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  );
}
