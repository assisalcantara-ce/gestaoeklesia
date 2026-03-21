'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import PageLayout from '@/components/PageLayout';
import Section from '@/components/Section';
import { getAvailableActions } from '@/lib/flows/flow-engine';
import { createClient } from '@/lib/supabase-client';

const PENDING_STATUSES = new Set(['pendente', 'aguardando', 'em_analise']);
const TERMINAL_STATUSES = new Set(['concluido', 'rejeitado', 'cancelado']);
const STATUS_LABELS: Record<string, string> = {
  pendente: 'Pendente',
  aguardando: 'Aguardando',
  em_analise: 'Em analise',
  aprovado: 'Aprovado',
  rejeitado: 'Rejeitado',
  concluido: 'Concluido',
  cancelado: 'Cancelado',
};

function formatActionLabel(action: string): string {
  if (!action) return 'Acao';
  return action
    .replace(/[_-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export default function FluxoInstancePage() {
  const params = useParams();
  const router = useRouter();
  const instanceId = String(params?.id || '');

  const [loading, setLoading] = useState(true);
  const [instance, setInstance] = useState<any>(null);
  const [definition, setDefinition] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [selectedAction, setSelectedAction] = useState<any | null>(null);
  const [actionData, setActionData] = useState<Record<string, string>>({});
  const [actionNote, setActionNote] = useState('');
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [toast, setToast] = useState('');
  const [isEditingData, setIsEditingData] = useState(false);
  const [editData, setEditData] = useState<Record<string, string>>({});
  const [dataError, setDataError] = useState('');
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  const loadInstance = async () => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token || !instanceId) return;
    setLoadError('');

    const res = await fetch(`/api/flows/instances/${instanceId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) {
      const message = res.status === 403
        ? 'Voce nao tem permissao para acessar esta instancia.'
        : res.status === 404
          ? 'Nao encontramos esta instancia.'
          : 'Nao foi possivel carregar esta instancia agora.';
      setLoadError(message);
      setLoading(false);
      return;
    }

    const payload = await res.json();
    const loadedInstance = payload?.data?.instance || null;
    setInstance(loadedInstance);
    setDefinition(payload?.data?.definition || null);
    const rawHistory = payload?.data?.history || [];
    setHistory(rawHistory.sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()));
    setRoles(payload?.data?.roles || []);
    setEditData(loadedInstance?.data_json || {});
    setIsEditingData(false);
    setLoading(false);
  };

  useEffect(() => {
    if (instanceId) loadInstance();
  }, [instanceId, supabase]);

  const availableActions = useMemo(() => {
    if (!instance || !definition) return [];
    return getAvailableActions(
      { id: instance.id, status: instance.status, data_json: instance.data_json || {}, current_assignee_role: instance.current_assignee_role },
      definition,
      roles
    );
  }, [instance, definition, roles]);

  useEffect(() => {
    if (availableActions.length === 0) {
      setSelectedAction(null);
      return;
    }
    setSelectedAction(availableActions[0]);
  }, [availableActions]);

  useEffect(() => {
    if (!selectedAction?.required_fields || selectedAction.required_fields.length === 0) {
      setActionData({});
      return;
    }
    const next: Record<string, string> = {};
    selectedAction.required_fields.forEach((field: string) => {
      next[field] = actionData[field] || '';
    });
    setActionData(next);
  }, [selectedAction]);

  const applyAction = async () => {
    if (!selectedAction) return;
    setError('');

    const requiredFields = selectedAction.required_fields || [];
    const missing = requiredFields.filter((field: string) => !actionData[field]);
    if (missing.length > 0) {
      setError('Preencha os campos obrigatorios antes de continuar.');
      return;
    }

    if (selectedAction.require_note && !actionNote.trim()) {
      setError('Esta acao exige uma nota.');
      return;
    }

    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;

    const res = await fetch(`/api/flows/instances/${instanceId}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        action: selectedAction.action,
        note: actionNote,
        data_json: actionData,
      })
    });

    if (!res.ok) {
      const err = await res.json();
      const raw = String(err?.error || '');
      const message = raw === 'ACTION_NOT_ALLOWED'
        ? 'Voce nao tem permissao para aplicar esta acao.'
        : raw === 'MISSING_FIELDS'
          ? 'Preencha os campos obrigatorios antes de continuar.'
          : raw === 'NOTE_REQUIRED'
            ? 'Informe a nota para continuar.'
            : 'Nao foi possivel aplicar a acao.';
      setError(message);
      return;
    }

    setToast('Acao aplicada com sucesso.');
    setActionNote('');
    await loadInstance();
  };

  if (loading) return <div className="p-6">Carregando...</div>;
  if (!instance) {
    return (
      <PageLayout
        title="Fluxos (Operacao)"
        description="Detalhe da instancia"
        activeMenu="fluxos-operacao"
      >
        <div className="p-6 text-sm text-gray-600">
          {loadError || 'Nao foi possivel abrir esta instancia agora.'}
        </div>
      </PageLayout>
    );
  }

  const statusLower = String(instance.status || '').toLowerCase();
  const isPending = PENDING_STATUSES.has(statusLower);
  const isTerminal = TERMINAL_STATUSES.has(statusLower);
  const assigneeRole = String(instance.current_assignee_role || '').toUpperCase();
  const assigneeLabel = instance.current_assignee_user_id
    ? `Usuario: ${instance.current_assignee_user_id}`
    : (instance.current_assignee_role || 'Nao definido');
  const statusLabel = STATUS_LABELS[statusLower] || 'Em andamento';
  const statusHint = assigneeRole === 'OPERADOR'
    ? 'Aguardando acao da Secretaria'
    : assigneeRole === 'PASTOR_LIDER'
      ? 'Aguardando aprovacao pastoral'
      : (isTerminal ? 'Concluido' : (isPending ? 'Pendente' : 'Em andamento'));
  const definitionFields = Array.isArray(definition?.fields)
    ? definition.fields
    : Array.isArray(definition?.form?.fields)
      ? definition.form.fields
      : [];
  const dataEntries = Object.entries(instance.data_json || {});
  const canEditData = (statusLower === 'pendente' || statusLower === 'aguardando')
    && roles.some((role) => ['OPERADOR', 'ADMINISTRADOR'].includes(String(role).toUpperCase()));
  const isSingleAction = availableActions.length === 1;
  const selectedActionLabel = selectedAction
    ? (selectedAction.label || formatActionLabel(selectedAction.action))
    : '';

  const saveData = async () => {
    setDataError('');
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;

    const res = await fetch(`/api/flows/instances/${instanceId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ data_json: editData }),
    });

    if (!res.ok) {
      const err = await res.json();
      const raw = String(err?.error || '');
      const message = raw === 'STATUS_LOCKED'
        ? 'Esta instancia ja esta em analise e nao permite editar dados.'
        : raw === 'FORBIDDEN'
          ? 'Voce nao tem permissao para editar esta instancia.'
          : 'Nao foi possivel salvar os dados agora.';
      setDataError(message);
      return;
    }

    const payload = await res.json();
    setInstance((prev: any) => prev ? ({ ...prev, data_json: payload?.data?.data_json || editData }) : prev);
    setIsEditingData(false);
    setToast('Dados atualizados com sucesso.');
  };

  return (
    <PageLayout
      title="Fluxos (Operacao)"
      description={instance.title || 'Instancia de fluxo'}
      activeMenu="fluxos-operacao"
    >
      {toast && (
        <div className="mb-4 rounded border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {toast}
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white p-4 rounded border">
          <p className="text-xs text-gray-500">Status</p>
          <p className="text-lg font-semibold text-gray-800">{statusLabel}</p>
          <p className="text-xs text-gray-500 mt-1">{statusHint}</p>
          <details className="mt-2 text-xs text-gray-500">
            <summary className="cursor-pointer">Detalhes tecnicos</summary>
            <div className="mt-2 space-y-1">
              <p>Status tecnico: {instance.status}</p>
              <p>Template: {instance.template_id}</p>
              <p>Versao: {instance.template_version}</p>
              <p>Instancia: {instance.id}</p>
            </div>
          </details>
        </div>
        <div className="bg-white p-4 rounded border">
          <p className="text-xs text-gray-500">Responsavel Atual</p>
          <p className="text-lg font-semibold text-gray-800">{assigneeLabel}</p>
        </div>
        <div className="bg-white p-4 rounded border">
          <p className="text-xs text-gray-500">Criado em</p>
          <p className="text-lg font-semibold text-gray-800">{new Date(instance.created_at).toLocaleString('pt-BR')}</p>
        </div>
      </div>

      <Section icon="📌" title="Resumo">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-gray-50 border border-gray-200 rounded p-3">
            <p className="text-xs text-gray-500">Template</p>
            <p className="text-sm font-semibold text-gray-800">{instance.template_id}</p>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded p-3">
            <p className="text-xs text-gray-500">Versao</p>
            <p className="text-sm font-semibold text-gray-800">{instance.template_version}</p>
          </div>
        </div>
      </Section>

      <Section icon="🗂️" title="Dados da Instancia">
        {definitionFields.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {definitionFields.map((field: any) => {
              const name = String(field?.name || '');
              const label = String(field?.label || name || 'Campo');
              const value = name ? instance.data_json?.[name] : undefined;
              if (isEditingData) {
                const type = String(field?.type || 'text');
                const editValue = editData[name] || '';
                return (
                  <div key={name || label} className="bg-gray-50 border border-gray-200 rounded p-3">
                    <label className="text-xs font-semibold text-gray-600">
                      {label}{field?.required ? ' *' : ''}
                    </label>
                    {type === 'textarea' ? (
                      <textarea
                        value={editValue}
                        onChange={(e) => setEditData(prev => ({ ...prev, [name]: e.target.value }))}
                        className="w-full min-h-[90px] border border-gray-300 rounded p-2 text-sm mt-1"
                      />
                    ) : type === 'select' ? (
                      <select
                        value={editValue}
                        onChange={(e) => setEditData(prev => ({ ...prev, [name]: e.target.value }))}
                        className="w-full border border-gray-300 rounded px-3 py-2 text-sm mt-1"
                      >
                        <option value="">Selecione</option>
                        {(field?.options || []).map((option: string) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={type === 'date' ? 'date' : 'text'}
                        value={editValue}
                        onChange={(e) => setEditData(prev => ({ ...prev, [name]: e.target.value }))}
                        className="w-full border border-gray-300 rounded px-3 py-2 text-sm mt-1"
                      />
                    )}
                  </div>
                );
              }
              return (
                <div key={name || label} className="bg-gray-50 border border-gray-200 rounded p-3">
                  <p className="text-xs text-gray-500">
                    {label}{field?.required ? ' (obrigatorio)' : ''}
                  </p>
                  <p className="text-sm font-semibold text-gray-800 mt-1">
                    {value === undefined || value === null || value === '' ? 'Nao informado' : String(value)}
                  </p>
                </div>
              );
            })}
          </div>
        ) : dataEntries.length === 0 ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-gray-500">Nenhum dado preenchido ainda.</p>
            {canEditData && (
              <button
                onClick={() => {
                  const section = document.getElementById('acoes-validacoes');
                  section?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                className="w-full md:w-auto px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
              >
                Editar dados
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {dataEntries.map(([key, value]) => (
              <div key={key} className="bg-gray-50 border border-gray-200 rounded p-3">
                <p className="text-xs text-gray-500">{formatActionLabel(key)}</p>
                <p className="text-sm font-semibold text-gray-800 mt-1">
                  {value === undefined || value === null || value === '' ? 'Nao informado' : String(value)}
                </p>
              </div>
            ))}
          </div>
        )}
        {definitionFields.length > 0 && canEditData && (
          <div className="mt-4 flex flex-col md:flex-row gap-2">
            {isEditingData ? (
              <>
                <button
                  onClick={saveData}
                  className="px-3 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                >
                  Salvar dados
                </button>
                <button
                  onClick={() => {
                    setEditData(instance.data_json || {});
                    setIsEditingData(false);
                    setDataError('');
                  }}
                  className="px-3 py-2 border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsEditingData(true)}
                className="px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
              >
                Editar dados
              </button>
            )}
          </div>
        )}
        {dataError && <p className="text-sm text-red-600 mt-2">{dataError}</p>}
      </Section>

      <Section icon="⚙️" title="Acoes e Validacoes">
        <div id="acoes-validacoes" className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {!isSingleAction && (
            <div>
              <p className="text-xs font-semibold text-gray-600">Acoes disponiveis</p>
              <div className="mt-2 space-y-2">
                {availableActions.length === 0 && (
                  <p className="text-sm text-gray-500">Nenhuma acao disponivel</p>
                )}
                {availableActions.map((action) => (
                  <button
                    key={action.action}
                    onClick={() => setSelectedAction(action)}
                    className={`w-full px-3 py-2 rounded text-sm border ${selectedAction?.action === action.action
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {action.label || formatActionLabel(action.action)}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className={isSingleAction ? 'md:col-span-2' : ''}>
            <p className="text-xs font-semibold text-gray-600">Preencher acao</p>
            {selectedAction ? (
              <div className="mt-2 space-y-3">
                {(selectedAction.required_fields || []).length > 0 && (
                  <div className="space-y-2">
                    {(selectedAction.required_fields || []).map((field: string) => (
                      <div key={field}>
                        <label className="text-xs font-semibold text-gray-600">{formatActionLabel(field)}</label>
                        <input
                          value={actionData[field] || ''}
                          onChange={(e) => setActionData(prev => ({ ...prev, [field]: e.target.value }))}
                          className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                        />
                      </div>
                    ))}
                  </div>
                )}
                {selectedAction.require_note && (
                  <div>
                    <label className="text-xs font-semibold text-gray-600">Nota</label>
                    <textarea
                      value={actionNote}
                      onChange={(e) => setActionNote(e.target.value)}
                      className="w-full min-h-[80px] border border-gray-300 rounded p-2 text-sm"
                    />
                    <p className="text-xs text-gray-500 mt-1">Nota obrigatoria para esta acao.</p>
                  </div>
                )}
                {error && <p className="text-sm text-red-600">{error}</p>}
                {isSingleAction && (
                  <button
                    onClick={applyAction}
                    className="w-full px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                  >
                    {selectedActionLabel}
                  </button>
                )}
                {!isSingleAction && (
                  <button
                    onClick={applyAction}
                    className="w-full px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                  >
                    {selectedActionLabel || 'Aplicar acao'}
                  </button>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-500 mt-2">Selecione uma acao.</p>
            )}
          </div>
        </div>
      </Section>

      <Section icon="🕒" title="Historico">
        {history.length === 0 ? (
          <p className="text-sm text-gray-500">Sem historico</p>
        ) : (
          <div className="space-y-3">
            {history.map((h) => (
              <div key={h.id} className="border border-gray-200 rounded p-3 bg-white">
                <p className="text-xs text-gray-500">{new Date(h.created_at).toLocaleString('pt-BR')}</p>
                <p className="text-sm text-gray-800">{h.action_label || formatActionLabel(h.action)} ({h.from_status} {'->'} {h.to_status})</p>
                {h.note && <p className="text-xs text-gray-600 mt-1">Nota: {h.note}</p>}
              </div>
            ))}
          </div>
        )}
      </Section>
    </PageLayout>
  );
}
