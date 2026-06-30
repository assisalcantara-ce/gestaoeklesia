'use client';

import { useEffect, useMemo, useState } from 'react';
import PageLayout from '@/components/PageLayout';
import Tabs from '@/components/Tabs';
import Section from '@/components/Section';
import NotificationModal from '@/components/NotificationModal';
import { useRequireModulo } from '@/hooks/useRequireModulo';
import { createClient } from '@/lib/supabase-client';
import { Pencil, Trash2, Plus, Minus, FileText, Loader2 } from 'lucide-react';

interface LocalOption {
  id: string;
  nome: string;
}

interface RelatorioEspiritualRegistro {
  id: string;
  ministry_id: string;
  congregacao_id: string | null;
  data_atividade: string;
  tipo_atividade: 'Culto' | 'Santa Ceia' | 'Visita' | 'Evangelismo' | 'Outro';
  cultos_realizados: number;
  visitas_realizadas: number;
  almas_alcancadas: number;
  biblias_doadas: number;
  literaturas_entregues: number;
  membros_cearam?: number;
  visitantes_presentes?: number;
  observacoes: string | null;
  usuario_responsavel: string | null;
  status: 'Rascunho' | 'Enviado' | 'Revisado';
  created_at: string;
  updated_at: string;
}

const TIPO_ATIVIDADE_OPTIONS = [
  { value: 'Culto', label: '⛪ Culto' },
  { value: 'Santa Ceia', label: '🍇 Santa Ceia' },
  { value: 'Visita', label: '🏠 Visita' },
  { value: 'Evangelismo', label: '📢 Evangelismo' },
  { value: 'Outro', label: '📦 Outro' }
];

const STATUS_OPTIONS = [
  { value: 'Rascunho', label: 'Rascunho', color: 'bg-slate-100 text-slate-700' },
  { value: 'Enviado', label: 'Enviado', color: 'bg-blue-100 text-blue-700' },
  { value: 'Revisado', label: 'Revisado', color: 'bg-emerald-100 text-emerald-700' }
];

const TABS = [
  { id: 'cadastro', label: 'Cadastro', icon: '📝' },
  { id: 'registros', label: 'Registros', icon: '🔍' }
];

const EMPTY_FORM = {
  congregacao_id: '',
  data_atividade: new Date().toISOString().split('T')[0],
  tipo_atividade: 'Culto' as 'Culto' | 'Santa Ceia' | 'Visita' | 'Evangelismo' | 'Outro',
  cultos_realizados: 0,
  visitas_realizadas: 0,
  almas_alcancadas: 0,
  biblias_doadas: 0,
  literaturas_entregues: 0,
  membros_cearam: 0,
  visitantes_presentes: 0,
  observacoes: '',
  status: 'Rascunho' as 'Rascunho' | 'Enviado' | 'Revisado'
};

const formatDate = (value?: string | null) => {
  if (!value) return '';
  const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : value;
};

export default function RelatorioEspiritualPage() {
  const { ctx, bloqueado } = useRequireModulo('gestao');
  const supabase = useMemo(() => createClient(), []);

  const [activeTab, setActiveTab] = useState('cadastro');
  const [registros, setRegistros] = useState<RelatorioEspiritualRegistro[]>([]);
  const [locais, setLocais] = useState<LocalOption[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState(EMPTY_FORM);

  // Filtros de listagem
  const [filtroCongregacao, setFiltroCongregacao] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [filtroDataInicio, setFiltroDataInicio] = useState('');
  const [filtroDataFim, setFiltroDataFim] = useState('');

  const [modalNotify, setModalNotify] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'success'
  });

  const showNotification = (
    type: 'success' | 'error' | 'warning' | 'info',
    title: string,
    message: string
  ) => {
    setModalNotify({ isOpen: true, title, message, type });
  };

  const isLocalUser = useMemo(() => {
    return !!(ctx.nivel && ['admin_local', 'financeiro_local', 'secretaria_local'].includes(ctx.nivel));
  }, [ctx.nivel]);

  // Carregar Congregações (Locais)
  useEffect(() => {
    if (ctx.loading || !ctx.ministryId) return;

    const loadLocais = async () => {
      let query = supabase
        .from('congregacoes')
        .select('id, nome')
        .eq('ministry_id', ctx.ministryId)
        .eq('is_active', true)
        .order('nome', { ascending: true });

      if (isLocalUser && ctx.congregacaoId) {
        query = query.eq('id', ctx.congregacaoId);
      }

      const { data, error } = await query;
      if (error) {
        console.error('Erro ao carregar congregações:', error);
      } else {
        setLocais((data || []) as LocalOption[]);
        // Se for local, pré-seleciona a única congregação
        if (isLocalUser && ctx.congregacaoId) {
          setFormData(prev => ({ ...prev, congregacao_id: ctx.congregacaoId || '' }));
          setFiltroCongregacao(ctx.congregacaoId || '');
        }
      }
    };

    loadLocais();
  }, [ctx.loading, ctx.ministryId, ctx.congregacaoId, isLocalUser, supabase]);

  // Carregar Registros de Relatório Espiritual
  const loadRegistros = async () => {
    if (!ctx.ministryId) return;
    setLoadingData(true);

    try {
      let query = supabase
        .from('relatorio_espiritual_registros')
        .select('*')
        .eq('ministry_id', ctx.ministryId);

      if (isLocalUser && ctx.congregacaoId) {
        query = query.eq('congregacao_id', ctx.congregacaoId);
      }

      const { data, error } = await query.order('data_atividade', { ascending: false });

      if (error) {
        showNotification('error', 'Erro', 'Erro ao carregar os relatórios espirituais.');
      } else {
        setRegistros((data || []) as RelatorioEspiritualRegistro[]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (!ctx.loading && ctx.ministryId) {
      loadRegistros();
    }
  }, [ctx.loading, ctx.ministryId, ctx.congregacaoId, isLocalUser]);

  // Filtragem local de registros
  const registrosFiltrados = useMemo(() => {
    return registros.filter(r => {
      if (filtroCongregacao && r.congregacao_id !== filtroCongregacao) return false;
      if (filtroTipo && r.tipo_atividade !== filtroTipo) return false;
      if (filtroStatus && r.status !== filtroStatus) return false;
      if (filtroDataInicio && r.data_atividade < filtroDataInicio) return false;
      if (filtroDataFim && r.data_atividade > filtroDataFim) return false;
      return true;
    });
  }, [registros, filtroCongregacao, filtroTipo, filtroStatus, filtroDataInicio, filtroDataFim]);

  const incrementMetric = (key: keyof typeof EMPTY_FORM) => {
    setFormData(prev => ({
      ...prev,
      [key]: Math.max(0, (Number(prev[key]) || 0) + 1)
    }));
  };

  const decrementMetric = (key: keyof typeof EMPTY_FORM) => {
    setFormData(prev => ({
      ...prev,
      [key]: Math.max(0, (Number(prev[key]) || 0) - 1)
    }));
  };

  const resetForm = () => {
    setFormData({
      ...EMPTY_FORM,
      congregacao_id: isLocalUser ? ctx.congregacaoId || '' : ''
    });
    setEditingId(null);
  };

  const handleEdit = (r: RelatorioEspiritualRegistro) => {
    setEditingId(r.id);
    setFormData({
      congregacao_id: r.congregacao_id || '',
      data_atividade: r.data_atividade,
      tipo_atividade: r.tipo_atividade,
      cultos_realizados: r.cultos_realizados,
      visitas_realizadas: r.visitas_realizadas,
      almas_alcancadas: r.almas_alcancadas,
      biblias_doadas: r.biblias_doadas,
      literaturas_entregues: r.literaturas_entregues,
      membros_cearam: r.membros_cearam || 0,
      visitantes_presentes: r.visitantes_presentes || 0,
      observacoes: r.observacoes || '',
      status: r.status
    });
    setActiveTab('cadastro');
  };

  const handleExcluir = async (id: string) => {
    if (!confirm('Deseja realmente excluir este relatório espiritual?')) return;

    try {
      let query = supabase
        .from('relatorio_espiritual_registros')
        .delete()
        .eq('id', id);

      if (isLocalUser && ctx.congregacaoId) {
        query = query.eq('congregacao_id', ctx.congregacaoId);
      }

      const { error } = await query;

      if (error) {
        showNotification('error', 'Erro', 'Não foi possível excluir o registro.');
      } else {
        showNotification('success', 'Sucesso', 'Registro excluído com sucesso.');
        loadRegistros();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!ctx.ministryId) {
      showNotification('error', 'Erro', 'Organização ou Ministério não identificado.');
      return;
    }

    // Se for usuário de congregação local, força o ID da congregação dele
    const finalCongregacaoId = isLocalUser ? (ctx.congregacaoId || null) : (formData.congregacao_id || null);

    if (isLocalUser && !ctx.congregacaoId) {
      showNotification('error', 'Erro', 'Você não possui uma congregação local associada ao seu usuário.');
      return;
    }

    const payload: any = {
      ministry_id: ctx.ministryId,
      congregacao_id: finalCongregacaoId,
      data_atividade: formData.data_atividade,
      tipo_atividade: formData.tipo_atividade,
      cultos_realizados: Number(formData.cultos_realizados) || 0,
      visitas_realizadas: Number(formData.visitas_realizadas) || 0,
      almas_alcancadas: Number(formData.almas_alcancadas) || 0,
      biblias_doadas: Number(formData.biblias_doadas) || 0,
      literaturas_entregues: Number(formData.literaturas_entregues) || 0,
      observacoes: formData.observacoes.trim() || null,
      status: formData.status,
      updated_at: new Date().toISOString()
    };

    // Campos condicionais
    if (formData.tipo_atividade === 'Santa Ceia') {
      payload.membros_cearam = Number(formData.membros_cearam) || 0;
    } else {
      payload.membros_cearam = 0;
    }

    if (formData.tipo_atividade === 'Culto') {
      payload.visitantes_presentes = Number(formData.visitantes_presentes) || 0;
    } else {
      payload.visitantes_presentes = 0;
    }

    try {
      if (editingId) {
        let query = supabase
          .from('relatorio_espiritual_registros')
          .update(payload)
          .eq('id', editingId);

        if (isLocalUser && ctx.congregacaoId) {
          query = query.eq('congregacao_id', ctx.congregacaoId);
        }

        const { error } = await query;

        if (error) {
          showNotification('error', 'Erro', error.message || 'Erro ao atualizar relatório.');
        } else {
          showNotification('success', 'Sucesso', 'Relatório atualizado com sucesso.');
          resetForm();
          loadRegistros();
          setActiveTab('registros');
        }
      } else {
        payload.usuario_responsavel = (await supabase.auth.getUser()).data.user?.id || null;
        const { error } = await supabase
          .from('relatorio_espiritual_registros')
          .insert({ ...payload, created_at: new Date().toISOString() });

        if (error) {
          showNotification('error', 'Erro', error.message || 'Erro ao salvar relatório.');
        } else {
          showNotification('success', 'Sucesso', 'Relatório cadastrado com sucesso.');
          resetForm();
          loadRegistros();
          setActiveTab('registros');
        }
      }
    } catch (err) {
      console.error(err);
      showNotification('error', 'Erro', 'Erro operacional ao salvar.');
    }
  };

  if (ctx.loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#123b63]" />
      </div>
    );
  }

  if (bloqueado) return null;

  return (
    <PageLayout title="Relatório Espiritual" description="Gestão de Relatórios Espirituais">
      <div className="p-6 max-w-7xl mx-auto">
        {/* Cabeçalho */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-4xl">🕊️</span>
              <h1 className="text-3xl font-bold text-slate-800">Relatório Espiritual</h1>
            </div>
            <p className="text-slate-600">Fundação do Relatório de Atividades Espirituais do Ministério</p>
          </div>
        </div>

        <Tabs tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab}>
          {activeTab === 'cadastro' && (
            <Section icon="📝" title={editingId ? 'Editar Relatório Espiritual' : 'Novo Relatório Espiritual'}>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Congregação */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Congregação / Sede *</label>
                    <select
                      value={formData.congregacao_id}
                      onChange={e => setFormData(prev => ({ ...prev, congregacao_id: e.target.value }))}
                      disabled={isLocalUser}
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 shadow-sm focus:border-slate-500 focus:outline-none disabled:bg-slate-50"
                      required
                    >
                      <option value="">-- Selecione a Unidade (ou Sede) --</option>
                      {locais.map(loc => (
                        <option key={loc.id} value={loc.id}>
                          {loc.nome}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Data */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Data da Atividade *</label>
                    <input
                      type="date"
                      value={formData.data_atividade}
                      onChange={e => setFormData(prev => ({ ...prev, data_atividade: e.target.value }))}
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 shadow-sm focus:border-slate-500 focus:outline-none"
                      required
                    />
                  </div>

                  {/* Tipo */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Tipo da Atividade *</label>
                    <select
                      value={formData.tipo_atividade}
                      onChange={e => setFormData(prev => ({
                        ...prev,
                        tipo_atividade: e.target.value as any
                      }))}
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 shadow-sm focus:border-slate-500 focus:outline-none"
                      required
                    >
                      {TIPO_ATIVIDADE_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Métricas Principais */}
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                  <h3 className="text-base font-bold text-slate-800 mb-4">📈 Indicadores e Atividades Espirituais</h3>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Cultos Realizados */}
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                      <div>
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Cultos Realizados</span>
                        <span className="text-xl font-bold text-slate-800">{formData.cultos_realizados}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button type="button" onClick={() => decrementMetric('cultos_realizados')} className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600"><Minus className="h-3.5 w-3.5" /></button>
                        <button type="button" onClick={() => incrementMetric('cultos_realizados')} className="p-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-800"><Plus className="h-3.5 w-3.5" /></button>
                      </div>
                    </div>

                    {/* Visitas Realizadas */}
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                      <div>
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Visitas Realizadas</span>
                        <span className="text-xl font-bold text-slate-800">{formData.visitas_realizadas}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button type="button" onClick={() => decrementMetric('visitas_realizadas')} className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600"><Minus className="h-3.5 w-3.5" /></button>
                        <button type="button" onClick={() => incrementMetric('visitas_realizadas')} className="p-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-800"><Plus className="h-3.5 w-3.5" /></button>
                      </div>
                    </div>

                    {/* Almas Alcançadas */}
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                      <div>
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Almas Alcançadas</span>
                        <span className="text-xl font-bold text-slate-800">{formData.almas_alcancadas}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button type="button" onClick={() => decrementMetric('almas_alcancadas')} className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600"><Minus className="h-3.5 w-3.5" /></button>
                        <button type="button" onClick={() => incrementMetric('almas_alcancadas')} className="p-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-800"><Plus className="h-3.5 w-3.5" /></button>
                      </div>
                    </div>

                    {/* Bíblias Doadas */}
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                      <div>
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Bíblias Doadas</span>
                        <span className="text-xl font-bold text-slate-800">{formData.biblias_doadas}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button type="button" onClick={() => decrementMetric('biblias_doadas')} className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600"><Minus className="h-3.5 w-3.5" /></button>
                        <button type="button" onClick={() => incrementMetric('biblias_doadas')} className="p-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-800"><Plus className="h-3.5 w-3.5" /></button>
                      </div>
                    </div>

                    {/* Literaturas Entregues */}
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                      <div>
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Literaturas Entregues</span>
                        <span className="text-xl font-bold text-slate-800">{formData.literaturas_entregues}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button type="button" onClick={() => decrementMetric('literaturas_entregues')} className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600"><Minus className="h-3.5 w-3.5" /></button>
                        <button type="button" onClick={() => incrementMetric('literaturas_entregues')} className="p-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-800"><Plus className="h-3.5 w-3.5" /></button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Campos Condicionais */}
                {(formData.tipo_atividade === 'Santa Ceia' || formData.tipo_atividade === 'Culto') && (
                  <div className="bg-amber-500/5 p-6 rounded-2xl border border-amber-500/10">
                    <h3 className="text-base font-bold text-amber-800 mb-4">🌟 Requisitos do Tipo de Atividade</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {formData.tipo_atividade === 'Santa Ceia' && (
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-1">Membros que cearam</label>
                          <div className="flex items-center gap-3">
                            <input
                              type="number"
                              value={formData.membros_cearam}
                              onChange={e => setFormData(prev => ({ ...prev, membros_cearam: Math.max(0, parseInt(e.target.value) || 0) }))}
                              className="w-40 rounded-xl border border-slate-300 bg-white px-4 py-2 shadow-sm focus:border-slate-500 focus:outline-none"
                            />
                            <div className="flex items-center gap-1.5">
                              <button type="button" onClick={() => decrementMetric('membros_cearam')} className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600"><Minus className="h-3.5 w-3.5" /></button>
                              <button type="button" onClick={() => incrementMetric('membros_cearam')} className="p-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-800"><Plus className="h-3.5 w-3.5" /></button>
                            </div>
                          </div>
                        </div>
                      )}

                      {formData.tipo_atividade === 'Culto' && (
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-1">Visitantes presentes</label>
                          <div className="flex items-center gap-3">
                            <input
                              type="number"
                              value={formData.visitantes_presentes}
                              onChange={e => setFormData(prev => ({ ...prev, visitantes_presentes: Math.max(0, parseInt(e.target.value) || 0) }))}
                              className="w-40 rounded-xl border border-slate-300 bg-white px-4 py-2 shadow-sm focus:border-slate-500 focus:outline-none"
                            />
                            <div className="flex items-center gap-1.5">
                              <button type="button" onClick={() => decrementMetric('visitantes_presentes')} className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600"><Minus className="h-3.5 w-3.5" /></button>
                              <button type="button" onClick={() => incrementMetric('visitantes_presentes')} className="p-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-800"><Plus className="h-3.5 w-3.5" /></button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Observações e Status */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Observações / Detalhes</label>
                    <textarea
                      value={formData.observacoes}
                      onChange={e => setFormData(prev => ({ ...prev, observacoes: e.target.value }))}
                      rows={3}
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 shadow-sm focus:border-slate-500 focus:outline-none"
                      placeholder="Espaço reservado para observações espirituais..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Status do Registro *</label>
                    <select
                      value={formData.status}
                      onChange={e => setFormData(prev => ({ ...prev, status: e.target.value as any }))}
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 shadow-sm focus:border-slate-500 focus:outline-none"
                      required
                    >
                      <option value="Rascunho">Rascunho</option>
                      <option value="Enviado">Enviado</option>
                      <option value="Revisado">Revisado</option>
                    </select>
                  </div>
                </div>

                {/* Botões de Ação */}
                <div className="flex gap-3 justify-end pt-4 border-t border-slate-100">
                  {editingId && (
                    <button
                      type="button"
                      onClick={resetForm}
                      className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 transition"
                    >
                      Cancelar
                    </button>
                  )}
                  <button
                    type="submit"
                    className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold shadow-sm transition"
                  >
                    {editingId ? 'Salvar Alterações' : 'Salvar Registro'}
                  </button>
                </div>
              </form>
            </Section>
          )}

          {activeTab === 'registros' && (
            <Section icon="🔍" title="Relatórios Espirituais Enviados">
              {/* Filtros */}
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 mb-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
                {/* Congregação */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Congregação</label>
                  <select
                    value={filtroCongregacao}
                    onChange={e => setFiltroCongregacao(e.target.value)}
                    disabled={isLocalUser}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none disabled:bg-slate-50"
                  >
                    <option value="">-- Todos --</option>
                    {locais.map(loc => (
                      <option key={loc.id} value={loc.id}>
                        {loc.nome}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Tipo */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Tipo da Atividade</label>
                  <select
                    value={filtroTipo}
                    onChange={e => setFiltroTipo(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none"
                  >
                    <option value="">-- Todos --</option>
                    {TIPO_ATIVIDADE_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Status */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Status</label>
                  <select
                    value={filtroStatus}
                    onChange={e => setFiltroStatus(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none"
                  >
                    <option value="">-- Todos --</option>
                    {STATUS_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Período */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">A partir de</label>
                  <input
                    type="date"
                    value={filtroDataInicio}
                    onChange={e => setFiltroDataInicio(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Até</label>
                  <input
                    type="date"
                    value={filtroDataFim}
                    onChange={e => setFiltroDataFim(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none"
                  />
                </div>
              </div>

              {/* Tabela/Cards */}
              {loadingData ? (
                <div className="py-12 flex justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                </div>
              ) : registrosFiltrados.length === 0 ? (
                <div className="py-16 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                  <FileText className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500 text-sm font-semibold">Nenhum relatório espiritual encontrado</p>
                  <p className="text-slate-400 text-xs mt-1">Experimente mudar os filtros ou cadastrar um novo registro.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {registrosFiltrados.map(reg => {
                    const localName = locais.find(l => l.id === reg.congregacao_id)?.nome || 'Sede / Geral';
                    const statusOpt = STATUS_OPTIONS.find(s => s.value === reg.status);
                    
                    return (
                      <div
                        key={reg.id}
                        className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm/5 hover:shadow-md transition flex flex-col md:flex-row justify-between md:items-center gap-4"
                      >
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full">
                              {reg.tipo_atividade}
                            </span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusOpt?.color || 'bg-slate-100'}`}>
                              {reg.status}
                            </span>
                            <span className="text-xs text-slate-500 font-semibold">
                              {formatDate(reg.data_atividade)}
                            </span>
                          </div>

                          <h4 className="text-sm font-bold text-slate-800">
                            🏢 Unidade: <span className="text-slate-600 font-semibold">{localName}</span>
                          </h4>

                          {/* Resumo de Métricas */}
                          <div className="grid grid-cols-2 sm:grid-cols-5 gap-x-4 gap-y-1 text-xs text-slate-600">
                            <span>⛪ Cultos: <strong>{reg.cultos_realizados}</strong></span>
                            <span>🏠 Visitas: <strong>{reg.visitas_realizadas}</strong></span>
                            <span>🔥 Almas: <strong>{reg.almas_alcancadas}</strong></span>
                            <span>📖 Bíblias: <strong>{reg.biblias_doadas}</strong></span>
                            <span>📢 Literaturas: <strong>{reg.literaturas_entregues}</strong></span>
                            {reg.tipo_atividade === 'Santa Ceia' && (
                              <span className="col-span-2 text-amber-700 font-semibold">🍇 Cearam: {reg.membros_cearam || 0}</span>
                            )}
                            {reg.tipo_atividade === 'Culto' && (
                              <span className="col-span-2 text-blue-700 font-semibold">👥 Visitantes: {reg.visitantes_presentes || 0}</span>
                            )}
                          </div>

                          {reg.observacoes && (
                            <p className="text-xs text-slate-500 bg-slate-50 p-2 rounded-lg italic">
                              "{reg.observacoes}"
                            </p>
                          )}
                        </div>

                        {/* Ações */}
                        <div className="flex items-center gap-2 self-end md:self-center">
                          <button
                            onClick={() => handleEdit(reg)}
                            className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 transition"
                            title="Editar"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleExcluir(reg.id)}
                            className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-rose-600 transition"
                            title="Excluir"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Section>
          )}
        </Tabs>
      </div>

      <NotificationModal
        isOpen={modalNotify.isOpen}
        title={modalNotify.title}
        message={modalNotify.message}
        type={modalNotify.type}
        onClose={() => setModalNotify(prev => ({ ...prev, isOpen: false }))}
      />
    </PageLayout>
  );
}
