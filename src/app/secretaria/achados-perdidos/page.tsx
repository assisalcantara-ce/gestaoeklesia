'use client';

import { useEffect, useMemo, useState } from 'react';
import PageLayout from '@/components/PageLayout';
import Tabs from '@/components/Tabs';
import Section from '@/components/Section';
import NotificationModal from '@/components/NotificationModal';
import { useRequireSupabaseAuth } from '@/hooks/useRequireSupabaseAuth';
import { createClient } from '@/lib/supabase-client';
import { resolveMinistryId } from '@/lib/cartoes-templates-sync';
import { Pencil, Trash2, Search, CheckCircle2 } from 'lucide-react';

interface LocalOption {
  id: string;
  nome: string;
  tipo: 'campo' | 'congregacao';
}

interface AchadoPerdido {
  id: string;
  ministry_id: string;
  descricao: string;
  categoria: string;
  local_descricao?: string | null;
  local_tipo?: string | null;
  congregacao_id?: string | null;
  campo_id?: string | null;
  data_encontrado?: string | null;
  encontrador_nome?: string | null;
  status: string;
  reclamante_nome?: string | null;
  reclamante_contato?: string | null;
  data_reclamado?: string | null;
  observacoes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

const CATEGORIAS = [
  { value: 'documentos', label: '📄 Documentos' },
  { value: 'eletronicos', label: '📱 Eletrônicos' },
  { value: 'vestuario', label: '👕 Vestuário' },
  { value: 'acessorios', label: '👜 Acessórios' },
  { value: 'calcados', label: '👟 Calçados' },
  { value: 'brinquedos', label: '🧸 Brinquedos' },
  { value: 'objetos_pessoais', label: '🔑 Objetos Pessoais' },
  { value: 'outros', label: '📦 Outros' },
];

const STATUS_OPTIONS = [
  { value: 'encontrado', label: 'Encontrado', color: 'bg-blue-100 text-blue-700' },
  { value: 'reclamado', label: 'Reclamado', color: 'bg-emerald-100 text-emerald-700' },
  { value: 'doado', label: 'Doado', color: 'bg-purple-100 text-purple-700' },
  { value: 'descartado', label: 'Descartado', color: 'bg-gray-100 text-gray-500' },
];

const TABS = [
  { id: 'cadastro', label: 'Cadastro', icon: '📝' },
  { id: 'registros', label: 'Registros', icon: '🔍' },
];

const EMPTY_FORM = {
  descricao: '',
  categoria: 'outros',
  local_tipo: 'congregacao' as 'congregacao' | 'campo' | 'outro',
  congregacao_id: '',
  campo_id: '',
  local_descricao: '',
  data_encontrado: '',
  encontrador_nome: '',
  status: 'encontrado',
  reclamante_nome: '',
  reclamante_contato: '',
  data_reclamado: '',
  observacoes: '',
};

const formatDate = (value?: string | null) => {
  if (!value) return '';
  const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : value;
};

const formatIsoDate = (value?: string | null) => {
  if (!value) return '';
  const s = String(value);
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : s;
};

export default function AchadosPerdidosPage() {
  const { loading } = useRequireSupabaseAuth();
  const supabase = useMemo(() => createClient(), []);

  const [activeTab, setActiveTab] = useState('cadastro');
  const [ministryId, setMinistryId] = useState<string | null>(null);
  const [registros, setRegistros] = useState<AchadoPerdido[]>([]);
  const [locais, setLocais] = useState<LocalOption[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ ...EMPTY_FORM });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Filtros na aba registros
  const [filterStatus, setFilterStatus] = useState('');
  const [filterSearch, setFilterSearch] = useState('');

  const [notification, setNotification] = useState({
    isOpen: false, title: '', message: '',
    type: 'success' as 'success' | 'error' | 'warning' | 'info',
    autoClose: 3000,
  });

  const showNotification = (type: typeof notification.type, title: string, message: string, autoClose: number | undefined = 3000) =>
    setNotification({ isOpen: true, title, message, type, autoClose });

  const resetForm = () => {
    setFormData({ ...EMPTY_FORM });
    setEditingId(null);
    setFieldErrors({});
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!formData.descricao.trim()) errors.descricao = 'Informe a descrição do objeto.';
    if (!formData.data_encontrado) errors.data_encontrado = 'Informe a data em que foi encontrado.';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const loadLocais = async (mid: string) => {
    const [camposRes, congregacoesRes] = await Promise.all([
      supabase.from('campos').select('id, nome').eq('ministry_id', mid).eq('is_active', true).order('nome'),
      supabase.from('congregacoes').select('id, nome').eq('ministry_id', mid).eq('is_active', true).order('nome'),
    ]);

    const lista: LocalOption[] = [
      ...((camposRes.data || []).map((c: any) => ({ id: c.id, nome: c.nome, tipo: 'campo' as const }))),
      ...((congregacoesRes.data || []).map((c: any) => ({ id: c.id, nome: c.nome, tipo: 'congregacao' as const }))),
    ];
    setLocais(lista);
  };

  const loadRegistros = async (mid: string) => {
    const { data, error } = await supabase
      .from('achados_perdidos_registros')
      .select('*')
      .eq('ministry_id', mid)
      .order('created_at', { ascending: false });
    if (error) { showNotification('error', 'Erro', error.message, undefined); return; }
    setRegistros((data || []) as AchadoPerdido[]);
  };

  useEffect(() => {
    if (loading) return;
    const run = async () => {
      setLoadingData(true);
      const mid = await resolveMinistryId(supabase);
      setMinistryId(mid);
      if (mid) {
        await Promise.all([loadLocais(mid), loadRegistros(mid)]);
      }
      setLoadingData(false);
    };
    run();
  }, [loading, supabase]);

  const handleSubmit = async () => {
    if (!ministryId) return;
    if (!validateForm()) return;

    const payload: any = {
      ministry_id: ministryId,
      descricao: formData.descricao.trim(),
      categoria: formData.categoria,
      local_tipo: formData.local_tipo,
      local_descricao: formData.local_descricao.trim() || null,
      congregacao_id: formData.local_tipo === 'congregacao' && formData.congregacao_id ? formData.congregacao_id : null,
      campo_id: formData.local_tipo === 'campo' && formData.campo_id ? formData.campo_id : null,
      data_encontrado: formData.data_encontrado || null,
      encontrador_nome: formData.encontrador_nome.trim() || null,
      status: formData.status,
      reclamante_nome: formData.reclamante_nome.trim() || null,
      reclamante_contato: formData.reclamante_contato.trim() || null,
      data_reclamado: formData.data_reclamado || null,
      observacoes: formData.observacoes.trim() || null,
      updated_at: new Date().toISOString(),
    };

    if (editingId) {
      const { data, error } = await supabase
        .from('achados_perdidos_registros')
        .update(payload)
        .eq('id', editingId)
        .select('*')
        .single();
      if (error) { showNotification('error', 'Erro', error.message, undefined); return; }
      setRegistros((prev) => prev.map((r) => (r.id === editingId ? (data as AchadoPerdido) : r)));
      showNotification('success', 'Sucesso', 'Registro atualizado.', 3000);
    } else {
      const { data, error } = await supabase
        .from('achados_perdidos_registros')
        .insert({ ...payload, created_at: new Date().toISOString() })
        .select('*')
        .single();
      if (error) { showNotification('error', 'Erro', error.message, undefined); return; }
      setRegistros((prev) => [data as AchadoPerdido, ...prev]);
      showNotification('success', 'Sucesso', 'Objeto registrado com sucesso.', 3000);
    }

    resetForm();
    setActiveTab('registros');
  };

  const handleEdit = (r: AchadoPerdido) => {
    setEditingId(r.id);
    setFormData({
      descricao: r.descricao || '',
      categoria: r.categoria || 'outros',
      local_tipo: (r.local_tipo as any) || 'congregacao',
      congregacao_id: r.congregacao_id || '',
      campo_id: r.campo_id || '',
      local_descricao: r.local_descricao || '',
      data_encontrado: formatIsoDate(r.data_encontrado),
      encontrador_nome: r.encontrador_nome || '',
      status: r.status || 'encontrado',
      reclamante_nome: r.reclamante_nome || '',
      reclamante_contato: r.reclamante_contato || '',
      data_reclamado: formatIsoDate(r.data_reclamado),
      observacoes: r.observacoes || '',
    });
    setActiveTab('cadastro');
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja excluir este registro?')) return;
    const { error } = await supabase.from('achados_perdidos_registros').delete().eq('id', id);
    if (error) { showNotification('error', 'Erro', error.message, undefined); return; }
    setRegistros((prev) => prev.filter((r) => r.id !== id));
    showNotification('success', 'Sucesso', 'Registro excluído.', 3000);
  };

  const handleMarcarReclamado = async (r: AchadoPerdido) => {
    const nowIso = new Date().toISOString();
    const { error } = await supabase
      .from('achados_perdidos_registros')
      .update({ status: 'reclamado', data_reclamado: nowIso.slice(0, 10), updated_at: nowIso })
      .eq('id', r.id);
    if (error) { showNotification('error', 'Erro', error.message, undefined); return; }
    setRegistros((prev) =>
      prev.map((reg) => reg.id === r.id ? { ...reg, status: 'reclamado', data_reclamado: nowIso.slice(0, 10) } : reg)
    );
    showNotification('success', 'Devolvido', 'Item marcado como reclamado.', 3000);
  };

  const getNomeLocal = (r: AchadoPerdido) => {
    if (r.local_tipo === 'congregacao' && r.congregacao_id) {
      return locais.find((l) => l.id === r.congregacao_id)?.nome || r.local_descricao || '-';
    }
    if (r.local_tipo === 'campo' && r.campo_id) {
      return locais.find((l) => l.id === r.campo_id)?.nome || r.local_descricao || '-';
    }
    return r.local_descricao || '-';
  };

  const registrosFiltrados = useMemo(() => {
    return registros.filter((r) => {
      const matchStatus = !filterStatus || r.status === filterStatus;
      const termo = filterSearch.toLowerCase();
      const matchSearch = !termo ||
        r.descricao.toLowerCase().includes(termo) ||
        (r.encontrador_nome || '').toLowerCase().includes(termo) ||
        (r.reclamante_nome || '').toLowerCase().includes(termo) ||
        getNomeLocal(r).toLowerCase().includes(termo);
      return matchStatus && matchSearch;
    });
  }, [registros, filterStatus, filterSearch, locais]);

  const camposLocais = locais.filter((l) => l.tipo === 'campo');
  const congregacoesLocais = locais.filter((l) => l.tipo === 'congregacao');

  if (loading || loadingData) return <div className="p-8">Carregando...</div>;

  return (
    <PageLayout
      title="Achados e Perdidos"
      description="Registro de objetos encontrados nas dependências da igreja"
      activeMenu="achados-perdidos"
    >
      <NotificationModal
        isOpen={notification.isOpen}
        title={notification.title}
        message={notification.message}
        type={notification.type}
        onClose={() => setNotification((prev) => ({ ...prev, isOpen: false }))}
        autoClose={notification.autoClose}
      />

      <div className="rounded-2xl border border-gray-200 bg-white/90 shadow-sm">
        <div className="p-4 md:p-6">
          <Tabs tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab}>

            {/* ===== ABA CADASTRO ===== */}
            {activeTab === 'cadastro' && (
              <Section icon="📝" title={editingId ? 'Editar Registro' : 'Registrar Objeto'}>
                <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">

                  {/* Descrição */}
                  <div>
                    <label className="text-xs font-semibold text-gray-600">Descrição do objeto *</label>
                    <textarea
                      value={formData.descricao}
                      onChange={(e) => setFormData((p) => ({ ...p, descricao: e.target.value }))}
                      placeholder="Ex: Carteira preta masculina com documentos"
                      className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm min-h-[72px]"
                    />
                    {fieldErrors.descricao && <p className="text-xs text-red-600 mt-1">{fieldErrors.descricao}</p>}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Categoria */}
                    <div>
                      <label className="text-xs font-semibold text-gray-600">Categoria</label>
                      <select
                        value={formData.categoria}
                        onChange={(e) => setFormData((p) => ({ ...p, categoria: e.target.value }))}
                        className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                      >
                        {CATEGORIAS.map((c) => (
                          <option key={c.value} value={c.value}>{c.label}</option>
                        ))}
                      </select>
                    </div>

                    {/* Status */}
                    <div>
                      <label className="text-xs font-semibold text-gray-600">Status</label>
                      <select
                        value={formData.status}
                        onChange={(e) => setFormData((p) => ({ ...p, status: e.target.value }))}
                        className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Local onde foi encontrado */}
                  <fieldset className="border border-gray-200 rounded-xl p-4 space-y-3">
                    <legend className="text-xs font-semibold text-gray-500 px-1">Local onde foi encontrado</legend>

                    <div>
                      <label className="text-xs font-semibold text-gray-600">Tipo de local</label>
                      <select
                        value={formData.local_tipo}
                        onChange={(e) => setFormData((p) => ({ ...p, local_tipo: e.target.value as any, congregacao_id: '', campo_id: '' }))}
                        className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                      >
                        <option value="congregacao">Congregação</option>
                        <option value="campo">Campo</option>
                        <option value="outro">Outro (texto livre)</option>
                      </select>
                    </div>

                    {formData.local_tipo === 'congregacao' && (
                      <div>
                        <label className="text-xs font-semibold text-gray-600">Congregação</label>
                        <select
                          value={formData.congregacao_id}
                          onChange={(e) => setFormData((p) => ({ ...p, congregacao_id: e.target.value }))}
                          className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                        >
                          <option value="">Selecione...</option>
                          {congregacoesLocais.map((c) => (
                            <option key={c.id} value={c.id}>{c.nome}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {formData.local_tipo === 'campo' && (
                      <div>
                        <label className="text-xs font-semibold text-gray-600">Campo</label>
                        <select
                          value={formData.campo_id}
                          onChange={(e) => setFormData((p) => ({ ...p, campo_id: e.target.value }))}
                          className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                        >
                          <option value="">Selecione...</option>
                          {camposLocais.map((c) => (
                            <option key={c.id} value={c.id}>{c.nome}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {formData.local_tipo === 'outro' && (
                      <div>
                        <label className="text-xs font-semibold text-gray-600">Descrição do local</label>
                        <input
                          value={formData.local_descricao}
                          onChange={(e) => setFormData((p) => ({ ...p, local_descricao: e.target.value }))}
                          placeholder="Ex: Salão de eventos, estacionamento..."
                          className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                        />
                      </div>
                    )}
                  </fieldset>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-gray-600">Data encontrado *</label>
                      <input
                        type="date"
                        value={formData.data_encontrado}
                        onChange={(e) => setFormData((p) => ({ ...p, data_encontrado: e.target.value }))}
                        className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                      />
                      {fieldErrors.data_encontrado && <p className="text-xs text-red-600 mt-1">{fieldErrors.data_encontrado}</p>}
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600">Quem encontrou</label>
                      <input
                        value={formData.encontrador_nome}
                        onChange={(e) => setFormData((p) => ({ ...p, encontrador_nome: e.target.value }))}
                        className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                      />
                    </div>
                  </div>

                  {/* Reclamação (visível apenas se status = reclamado) */}
                  {formData.status === 'reclamado' && (
                    <fieldset className="border border-emerald-200 rounded-xl p-4 space-y-3">
                      <legend className="text-xs font-semibold text-emerald-600 px-1">Dados da reclamação</legend>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-semibold text-gray-600">Nome do reclamante</label>
                          <input
                            value={formData.reclamante_nome}
                            onChange={(e) => setFormData((p) => ({ ...p, reclamante_nome: e.target.value }))}
                            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-600">Contato</label>
                          <input
                            value={formData.reclamante_contato}
                            onChange={(e) => setFormData((p) => ({ ...p, reclamante_contato: e.target.value }))}
                            placeholder="Telefone ou e-mail"
                            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-600">Data da retirada</label>
                          <input
                            type="date"
                            value={formData.data_reclamado}
                            onChange={(e) => setFormData((p) => ({ ...p, data_reclamado: e.target.value }))}
                            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                          />
                        </div>
                      </div>
                    </fieldset>
                  )}

                  <div>
                    <label className="text-xs font-semibold text-gray-600">Observações</label>
                    <textarea
                      value={formData.observacoes}
                      onChange={(e) => setFormData((p) => ({ ...p, observacoes: e.target.value }))}
                      className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm min-h-[72px]"
                    />
                  </div>

                  <div className="flex flex-wrap gap-3 justify-end">
                    {editingId && (
                      <button onClick={resetForm} className="px-4 py-2 rounded-lg border border-gray-200 text-sm">
                        Cancelar edição
                      </button>
                    )}
                    <button
                      onClick={handleSubmit}
                      className="px-4 py-2 rounded-lg bg-[#123b63] text-white text-sm font-semibold"
                    >
                      {editingId ? 'Atualizar registro' : 'Salvar registro'}
                    </button>
                  </div>
                </div>
              </Section>
            )}

            {/* ===== ABA REGISTROS ===== */}
            {activeTab === 'registros' && (
              <Section icon="🔍" title="Registros">
                {/* Filtros */}
                <div className="flex flex-wrap items-center gap-3 mb-4">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      value={filterSearch}
                      onChange={(e) => setFilterSearch(e.target.value)}
                      placeholder="Buscar por descrição, local, nome..."
                      className="pl-9 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    />
                  </div>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="rounded-lg border border-gray-200 px-3 py-2 text-sm min-w-[140px]"
                  >
                    <option value="">Todos os status</option>
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => setActiveTab('cadastro')}
                    className="px-4 py-2 rounded-lg bg-[#123b63] text-white text-sm font-semibold whitespace-nowrap"
                  >
                    + Novo registro
                  </button>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                  {registrosFiltrados.length === 0 ? (
                    <p className="text-sm text-gray-500">Nenhum registro encontrado.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-xs uppercase text-gray-400 border-b">
                            <th className="py-2 pr-4">Objeto</th>
                            <th className="py-2 pr-4">Local</th>
                            <th className="py-2 pr-4">Data</th>
                            <th className="py-2 pr-4">Status</th>
                            <th className="py-2">Ações</th>
                          </tr>
                        </thead>
                        <tbody>
                          {registrosFiltrados.map((r) => {
                            const catLabel = CATEGORIAS.find((c) => c.value === r.categoria)?.label || r.categoria;
                            const statusOpt = STATUS_OPTIONS.find((s) => s.value === r.status);
                            return (
                              <tr key={r.id} className="border-b last:border-b-0 hover:bg-gray-50">
                                <td className="py-3 pr-4">
                                  <div className="font-semibold text-gray-800 max-w-[220px] truncate" title={r.descricao}>
                                    {r.descricao}
                                  </div>
                                  <div className="text-xs text-gray-400 mt-0.5">{catLabel}</div>
                                  {r.encontrador_nome && (
                                    <div className="text-xs text-gray-500">Encontrado por: {r.encontrador_nome}</div>
                                  )}
                                </td>
                                <td className="py-3 pr-4">
                                  <div className="text-xs text-gray-600">{getNomeLocal(r)}</div>
                                  {r.local_tipo && r.local_tipo !== 'outro' && (
                                    <div className="text-[11px] text-gray-400 capitalize">{r.local_tipo}</div>
                                  )}
                                </td>
                                <td className="py-3 pr-4">
                                  <div className="text-xs text-gray-600">{formatDate(r.data_encontrado) || '-'}</div>
                                  {r.data_reclamado && (
                                    <div className="text-[11px] text-gray-400">Retirado: {formatDate(r.data_reclamado)}</div>
                                  )}
                                </td>
                                <td className="py-3 pr-4">
                                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusOpt?.color || 'bg-gray-100 text-gray-600'}`}>
                                    {statusOpt?.label || r.status}
                                  </span>
                                  {r.reclamante_nome && (
                                    <div className="text-[11px] text-gray-400 mt-1">{r.reclamante_nome}</div>
                                  )}
                                </td>
                                <td className="py-3">
                                  <div className="flex items-center gap-2">
                                    {r.status === 'encontrado' && (
                                      <button
                                        title="Marcar como reclamado"
                                        className="rounded-md border border-emerald-200 p-2 text-emerald-600 hover:bg-emerald-50"
                                        onClick={() => handleMarcarReclamado(r)}
                                      >
                                        <CheckCircle2 className="h-4 w-4" />
                                      </button>
                                    )}
                                    <button
                                      title="Editar"
                                      className="rounded-md border border-gray-200 p-2 text-gray-600 hover:bg-gray-50"
                                      onClick={() => handleEdit(r)}
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </button>
                                    <button
                                      title="Excluir"
                                      className="rounded-md border border-gray-200 p-2 text-gray-600 hover:bg-gray-50"
                                      onClick={() => handleDelete(r.id)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Resumo por status */}
                <div className="mt-4 flex flex-wrap gap-3">
                  {STATUS_OPTIONS.map((s) => {
                    const count = registros.filter((r) => r.status === s.value).length;
                    return (
                      <div key={s.value} className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${s.color}`}>
                        {s.label}: <span className="font-bold">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </Section>
            )}
          </Tabs>
        </div>
      </div>
    </PageLayout>
  );
}
