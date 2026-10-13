'use client';

import { useEffect, useMemo, useState } from 'react';
import NotificationModal from '@/components/NotificationModal';
import { useRequireModulo } from '@/hooks/useRequireModulo';
import { createClient } from '@/lib/supabase-client';
import { resolveMinistryId } from '@/lib/cartoes-templates-sync';
import { obterEstruturaOrganizacionalService } from '@/services/estrutura-organizacional-service';
import {
  Pencil,
  Trash2,
  Search,
  CheckCircle2,
  Plus,
  HelpCircle,
  Clock,
  UserCheck,
  Archive,
  X,
  Sparkles,
  ClipboardList,
  Tag,
} from 'lucide-react';

// ─── Tipos ────────────────────────────────────────────────────────────────────

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

// ─── Constantes ───────────────────────────────────────────────────────────────

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
  { value: 'encontrado', label: 'Encontrado', color: 'bg-amber-50 text-amber-700 border border-amber-200' },
  { value: 'reclamado', label: 'Reclamado', color: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  { value: 'doado', label: 'Doado', color: 'bg-purple-50 text-purple-700 border border-purple-200' },
  { value: 'descartado', label: 'Descartado', color: 'bg-slate-100 text-slate-600 border border-slate-200' },
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

// ─── Estilos de Input e Label Padrão Membros ───────────────────────────────────

const inputCls =
  'w-full px-3.5 py-2.5 bg-slate-50/70 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition';
const labelCls =
  'block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5';

// ─── Página Principal ─────────────────────────────────────────────────────────

export default function AchadosPerdidosPage() {
  const { ctx, bloqueado } = useRequireModulo('gestao');
  const supabase = useMemo(() => createClient(), []);

  const [activeTab, setActiveTab] = useState<'registros' | 'cadastro'>('registros');
  const [ministryId, setMinistryId] = useState<string | null>(null);
  const [registros, setRegistros] = useState<AchadoPerdido[]>([]);
  const [locais, setLocais] = useState<LocalOption[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ ...EMPTY_FORM });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Filtros na aba registros
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCategoria, setFilterCategoria] = useState('');
  const [filterSearch, setFilterSearch] = useState('');

  const [notification, setNotification] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
    autoClose?: number;
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'success',
    autoClose: 3000,
  });

  const showNotification = (
    type: typeof notification.type,
    title: string,
    message: string,
    autoClose: number | undefined = 3000
  ) => setNotification({ isOpen: true, title, message, type, autoClose });

  const resetForm = () => {
    setFormData({
      ...EMPTY_FORM,
      congregacao_id: ctx.nivel === 'operador' && ctx.congregacaoId ? ctx.congregacaoId : '',
    });
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
    const orgService = await obterEstruturaOrganizacionalService(mid, supabase);
    const div1Options = orgService.getOptionsFormatadas(1);
    const div2Options = orgService.getOptionsFormatadas(2);

    let div1Filtrada = div1Options;
    let div2Filtrada = div2Options;

    if (ctx.nivel === 'operador' && ctx.congregacaoId) {
      div1Filtrada = div1Options.filter((c) => c.id === ctx.congregacaoId);
      div2Filtrada = [];
    }

    const lista: LocalOption[] = [
      ...div2Filtrada.map((c) => ({ id: c.id, nome: c.nome, tipo: 'campo' as const })),
      ...div1Filtrada.map((c) => ({ id: c.id, nome: c.nome, tipo: 'congregacao' as const })),
    ];
    setLocais(lista);
  };

  const loadRegistros = async (mid: string) => {
    let query = supabase.from('achados_perdidos_registros').select('*').eq('ministry_id', mid);
    if (ctx.nivel === 'operador' && ctx.congregacaoId) {
      query = query.eq('congregacao_id', ctx.congregacaoId);
    }
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) {
      showNotification('error', 'Erro', error.message, undefined);
      return;
    }
    setRegistros((data || []) as AchadoPerdido[]);
  };

  useEffect(() => {
    if (ctx.loading || bloqueado) return;
    const run = async () => {
      setLoadingData(true);
      const mid = await resolveMinistryId(supabase);
      setMinistryId(mid);
      if (mid) {
        await Promise.all([loadLocais(mid), loadRegistros(mid)]);
        setFormData((p) => ({
          ...p,
          congregacao_id:
            ctx.nivel === 'operador' && ctx.congregacaoId ? ctx.congregacaoId : p.congregacao_id,
        }));
      }
      setLoadingData(false);
    };
    run();
  }, [ctx.loading, bloqueado, supabase, ctx.nivel, ctx.congregacaoId]);

  const handleSubmit = async () => {
    if (!ministryId) return;
    if (!validateForm()) return;

    const payload: any = {
      ministry_id: ministryId,
      descricao: formData.descricao.trim(),
      categoria: formData.categoria,
      local_tipo: formData.local_tipo,
      local_descricao: formData.local_descricao.trim() || null,
      congregacao_id:
        formData.local_tipo === 'congregacao' && formData.congregacao_id
          ? formData.congregacao_id
          : null,
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
      if (error) {
        showNotification('error', 'Erro', error.message, undefined);
        return;
      }
      setRegistros((prev) => prev.map((r) => (r.id === editingId ? (data as AchadoPerdido) : r)));
      showNotification('success', 'Sucesso', 'Registro atualizado.', 3000);
    } else {
      const { data, error } = await supabase
        .from('achados_perdidos_registros')
        .insert({ ...payload, created_at: new Date().toISOString() })
        .select('*')
        .single();
      if (error) {
        showNotification('error', 'Erro', error.message, undefined);
        return;
      }
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
    if (error) {
      showNotification('error', 'Erro', error.message, undefined);
      return;
    }
    setRegistros((prev) => prev.filter((r) => r.id !== id));
    showNotification('success', 'Sucesso', 'Registro excluído.', 3000);
  };

  const handleMarcarReclamado = async (r: AchadoPerdido) => {
    const nowIso = new Date().toISOString();
    const { error } = await supabase
      .from('achados_perdidos_registros')
      .update({ status: 'reclamado', data_reclamado: nowIso.slice(0, 10), updated_at: nowIso })
      .eq('id', r.id);
    if (error) {
      showNotification('error', 'Erro', error.message, undefined);
      return;
    }
    setRegistros((prev) =>
      prev.map((reg) =>
        reg.id === r.id
          ? { ...reg, status: 'reclamado', data_reclamado: nowIso.slice(0, 10) }
          : reg
      )
    );
    showNotification('success', 'Devolvido', 'Item marcado como reclamado com sucesso.', 3000);
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

  // ── Memos de Estatísticas (KPIs) ──────────────────────────────────────────
  const totalRegistros = registros.length;
  const encontradosAguardando = registros.filter((r) => r.status === 'encontrado').length;
  const reclamadosDevolvidos = registros.filter((r) => r.status === 'reclamado').length;
  const doadosOuDescartados = registros.filter(
    (r) => r.status === 'doado' || r.status === 'descartado'
  ).length;
  const pctDevolvidos =
    totalRegistros > 0 ? ((reclamadosDevolvidos / totalRegistros) * 100).toFixed(0) : '0';

  const registrosFiltrados = useMemo(() => {
    return registros.filter((r) => {
      const matchStatus = !filterStatus || r.status === filterStatus;
      const matchCategoria = !filterCategoria || r.categoria === filterCategoria;
      const termo = filterSearch.toLowerCase();
      const matchSearch =
        !termo ||
        r.descricao.toLowerCase().includes(termo) ||
        (r.encontrador_nome || '').toLowerCase().includes(termo) ||
        (r.reclamante_nome || '').toLowerCase().includes(termo) ||
        getNomeLocal(r).toLowerCase().includes(termo);
      return matchStatus && matchCategoria && matchSearch;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registros, filterStatus, filterCategoria, filterSearch, locais]);

  const camposLocais = locais.filter((l) => l.tipo === 'campo');
  const congregacoesLocais = locais.filter((l) => l.tipo === 'congregacao');

  if (ctx.loading || loadingData) {
    return (
      <div className="flex-1 overflow-y-auto bg-[#f4f7fa] min-h-screen flex items-center justify-center p-8">
        <div className="flex items-center gap-3 text-slate-500 font-semibold text-sm bg-white px-6 py-4 rounded-2xl shadow-xs border border-slate-200">
          <div className="w-5 h-5 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
          <span>Carregando dados de Achados e Perdidos...</span>
        </div>
      </div>
    );
  }

  if (bloqueado) return null;

  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden bg-[#f4f7fa] min-h-screen">
      <NotificationModal
        isOpen={notification.isOpen}
        title={notification.title}
        message={notification.message}
        type={notification.type}
        onClose={() => setNotification((prev) => ({ ...prev, isOpen: false }))}
        autoClose={notification.autoClose}
      />

      <div className="p-4 sm:p-6 lg:p-8 max-w-[96rem] mx-auto w-full">
        {/* ── Header da Página (Padrão Membros) ────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-teal-700 text-white flex items-center justify-center border border-teal-800 shadow-sm flex-shrink-0">
              <HelpCircle className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                Achados e Perdidos
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 font-medium mt-0.5">
                Registro, controle e devolução de objetos encontrados nas dependências da igreja.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={() => {
                resetForm();
                setActiveTab('cadastro');
              }}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold rounded-xl shadow-xs transition flex items-center gap-2 cursor-pointer text-xs sm:text-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Registrar Objeto</span>
            </button>
          </div>
        </div>

        {/* ── Cards Principais — KPIs Coloridos (Padrão Membros) ──────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* Total de Itens (Azul) */}
          <div className="bg-[#ebf5ff] border border-[#d0e6ff] rounded-3xl p-5 relative overflow-hidden shadow-xs hover:shadow-md transition-all flex items-center justify-between">
            <div className="flex items-center gap-3.5 flex-1 min-w-0">
              <div className="w-13 h-13 rounded-2xl bg-white text-[#2563eb] shadow-xs flex items-center justify-center flex-shrink-0 border border-[#dbeafe]">
                <HelpCircle className="w-7 h-7" />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold text-slate-800 block truncate">
                  Total de Objetos
                </span>
                <p className="text-3xl font-black text-slate-900 leading-tight mt-0.5">
                  {totalRegistros}
                </p>
                <p className="text-[11px] font-bold text-teal-700 mt-1 truncate">
                  Registros catalogados
                </p>
              </div>
            </div>
            <div className="w-8 h-8 rounded-xl bg-[#dbeafe] text-[#2563eb] flex items-center justify-center flex-shrink-0 self-start">
              <Tag className="w-4 h-4" />
            </div>
          </div>

          {/* Aguardando Retirada (Âmbar / Laranja) */}
          <div className="bg-[#fff6ea] border border-[#fde4c4] rounded-3xl p-5 relative overflow-hidden shadow-xs hover:shadow-md transition-all flex items-center justify-between">
            <div className="flex items-center gap-3.5 flex-1 min-w-0">
              <div className="w-13 h-13 rounded-2xl bg-white text-[#ea580c] shadow-xs flex items-center justify-center flex-shrink-0 border border-[#ffedd5]">
                <Clock className="w-7 h-7" />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold text-slate-800 block truncate">
                  Aguardando Retirada
                </span>
                <p className="text-3xl font-black text-slate-900 leading-tight mt-0.5">
                  {encontradosAguardando}
                </p>
                <p className="text-[11px] font-semibold text-slate-700 mt-1 truncate">
                  Disponíveis para resgate
                </p>
              </div>
            </div>
            <div className="w-8 h-8 rounded-xl bg-[#ffedd5] text-[#ea580c] flex items-center justify-center flex-shrink-0 self-start">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>

          {/* Devolvidos / Reclamados (Verde) */}
          <div className="bg-[#ecfdf3] border border-[#cff7de] rounded-3xl p-5 relative overflow-hidden shadow-xs hover:shadow-md transition-all flex items-center justify-between">
            <div className="flex items-center gap-3.5 flex-1 min-w-0">
              <div className="w-13 h-13 rounded-2xl bg-white text-[#16a34a] shadow-xs flex items-center justify-center flex-shrink-0 border border-[#dcfce7]">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold text-slate-800 block truncate">
                  Devolvidos ao Dono
                </span>
                <p className="text-3xl font-black text-slate-900 leading-tight mt-0.5">
                  {reclamadosDevolvidos}
                </p>
                <p className="text-[11px] font-semibold text-slate-700 mt-1 truncate">
                  {pctDevolvidos}% taxa de devolução
                </p>
              </div>
            </div>
            <div className="w-8 h-8 rounded-xl bg-[#dcfce7] text-[#16a34a] flex items-center justify-center flex-shrink-0 self-start">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>

          {/* Destinados / Doados (Roxo / Violeta) */}
          <div className="bg-[#f3f0ff] border border-[#e3dbff] rounded-3xl p-5 relative overflow-hidden shadow-xs hover:shadow-md transition-all flex items-center justify-between">
            <div className="flex items-center gap-3.5 flex-1 min-w-0">
              <div className="w-13 h-13 rounded-2xl bg-white text-[#7c3aed] shadow-xs flex items-center justify-center flex-shrink-0 border border-[#ede9fe]">
                <Archive className="w-7 h-7" />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold text-slate-800 block truncate">
                  Doados / Descartados
                </span>
                <p className="text-3xl font-black text-slate-900 leading-tight mt-0.5">
                  {doadosOuDescartados}
                </p>
                <p className="text-[11px] font-semibold text-slate-700 mt-1 truncate">
                  Destinados após prazo
                </p>
              </div>
            </div>
            <div className="w-8 h-8 rounded-xl bg-[#ede9fe] text-[#7c3aed] flex items-center justify-center flex-shrink-0 self-start">
              <Archive className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* ── Navegação de Abas (Pills no Padrão Membros) ─────────────── */}
        <div className="flex items-center gap-2.5 mb-6 overflow-x-auto pb-1">
          <button
            onClick={() => setActiveTab('registros')}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'registros'
                ? 'bg-teal-700 text-white shadow-sm border border-teal-800'
                : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 hover:text-slate-900 shadow-xs'
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            <span>Lista de Registros</span>
          </button>

          <button
            onClick={() => setActiveTab('cadastro')}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'cadastro'
                ? 'bg-teal-700 text-white shadow-sm border border-teal-800'
                : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 hover:text-slate-900 shadow-xs'
            }`}
          >
            <Pencil className="w-4 h-4" />
            <span>{editingId ? 'Editar Objeto' : 'Registrar Objeto'}</span>
          </button>
        </div>

        {/* ═══════════════ ABA REGISTROS ═══════════════ */}
        {activeTab === 'registros' && (
          <div className="space-y-6">
            {/* Card de Filtros (Padrão MembrosToolbar) */}
            <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/90 shadow-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4 items-end">
                {/* Busca */}
                <div className="sm:col-span-2 lg:col-span-6">
                  <label className={labelCls}>Buscar objetos</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Search className="w-4 h-4" />
                    </div>
                    <input
                      value={filterSearch}
                      onChange={(e) => setFilterSearch(e.target.value)}
                      placeholder="Descrição, quem encontrou, local, reclamante..."
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50/70 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition"
                    />
                  </div>
                </div>

                {/* Filtro Categoria */}
                <div className="lg:col-span-3">
                  <label className={labelCls}>Categoria</label>
                  <select
                    value={filterCategoria}
                    onChange={(e) => setFilterCategoria(e.target.value)}
                    className={inputCls}
                  >
                    <option value="">Todas as categorias</option>
                    {CATEGORIAS.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Filtro Status */}
                <div className="lg:col-span-3">
                  <label className={labelCls}>Status</label>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className={inputCls}
                  >
                    <option value="">Todos os status</option>
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Status Pills de Resumo Rápido */}
              <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-slate-600 mr-1">Filtrar rápido:</span>
                  <button
                    onClick={() => setFilterStatus('')}
                    className={`px-3 py-1 rounded-full text-xs font-bold transition cursor-pointer ${
                      !filterStatus
                        ? 'bg-slate-800 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Todos ({totalRegistros})
                  </button>
                  {STATUS_OPTIONS.map((s) => {
                    const count = registros.filter((r) => r.status === s.value).length;
                    const isSelected = filterStatus === s.value;
                    return (
                      <button
                        key={s.value}
                        onClick={() => setFilterStatus(isSelected ? '' : s.value)}
                        className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition cursor-pointer border ${
                          isSelected ? 'ring-2 ring-teal-600/30' : ''
                        } ${s.color}`}
                      >
                        <span>{s.label}</span>
                        <span className="opacity-80">({count})</span>
                      </button>
                    );
                  })}
                </div>

                <div className="text-xs font-bold text-slate-500">
                  <span>{registrosFiltrados.length}</span>{' '}
                  {registrosFiltrados.length === 1 ? 'item exibido' : 'itens exibidos'}
                </div>
              </div>
            </div>

            {/* Tabela de Registros (Padrão MembrosTable) */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
              {registrosFiltrados.length === 0 ? (
                <div className="p-12 text-center text-slate-400 font-semibold">
                  <HelpCircle className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                  <p>Nenhum objeto encontrado com os filtros aplicados.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50/80 border-b border-slate-200">
                      <tr>
                        <th className="px-5 py-3.5 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                          Objeto / Categoria
                        </th>
                        <th className="px-4 py-3.5 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                          Local Encontrado
                        </th>
                        <th className="px-4 py-3.5 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                          Data & Detalhes
                        </th>
                        <th className="px-4 py-3.5 text-center text-xs font-bold text-slate-700 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-5 py-3.5 text-right text-xs font-bold text-slate-700 uppercase tracking-wider w-28">
                          Ações
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {registrosFiltrados.map((r) => {
                        const catLabel =
                          CATEGORIAS.find((c) => c.value === r.categoria)?.label || r.categoria;
                        const statusOpt = STATUS_OPTIONS.find((s) => s.value === r.status);
                        return (
                          <tr key={r.id} className="hover:bg-slate-50/70 transition">
                            <td className="px-5 py-3.5">
                              <div
                                className="font-bold text-slate-900 max-w-[240px] truncate"
                                title={r.descricao}
                              >
                                {r.descricao}
                              </div>
                              <div className="text-xs font-semibold text-teal-700 mt-0.5">
                                {catLabel}
                              </div>
                              {r.encontrador_nome && (
                                <div className="text-xs text-slate-500 font-medium mt-0.5">
                                  Encontrado por: {r.encontrador_nome}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3.5">
                              <div className="text-xs font-bold text-slate-800">
                                {getNomeLocal(r)}
                              </div>
                              {r.local_tipo && r.local_tipo !== 'outro' && (
                                <div className="text-[11px] text-slate-500 font-medium capitalize mt-0.5">
                                  {r.local_tipo}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3.5">
                              <div className="text-xs font-semibold text-slate-700">
                                {formatDate(r.data_encontrado) || '—'}
                              </div>
                              {r.data_reclamado && (
                                <div className="text-[11px] text-emerald-700 font-bold mt-0.5">
                                  Retirado em: {formatDate(r.data_reclamado)}
                                </div>
                              )}
                              {r.reclamante_nome && (
                                <div className="text-[11px] text-slate-500 font-medium">
                                  Por: {r.reclamante_nome}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3.5 text-center">
                              <span
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                  statusOpt?.color || 'bg-slate-100 text-slate-700'
                                }`}
                              >
                                {statusOpt?.label || r.status}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {r.status === 'encontrado' && (
                                  <button
                                    title="Marcar como devolvido/reclamado"
                                    onClick={() => handleMarcarReclamado(r)}
                                    className="p-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition border border-emerald-200/80 cursor-pointer"
                                  >
                                    <CheckCircle2 className="w-4 h-4" />
                                  </button>
                                )}
                                <button
                                  title="Editar"
                                  onClick={() => handleEdit(r)}
                                  className="p-1.5 text-slate-400 hover:text-teal-700 hover:bg-slate-50 rounded-lg transition cursor-pointer"
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>
                                <button
                                  title="Excluir"
                                  onClick={() => handleDelete(r.id)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                >
                                  <Trash2 className="w-4 h-4" />
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
          </div>
        )}

        {/* ═══════════════ ABA CADASTRO ═══════════════ */}
        {activeTab === 'cadastro' && (
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/90 shadow-sm space-y-6">
            {/* Header do Formulário */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 border border-teal-100/80 flex items-center justify-center font-bold flex-shrink-0">
                  <Pencil className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800 tracking-tight">
                    {editingId ? 'Editar Objeto Registrado' : 'Registrar Novo Objeto'}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    {editingId
                      ? 'Atualize os dados e o status do objeto cadastrado'
                      : 'Preencha os detalhes do objeto encontrado nas dependências da igreja'}
                  </p>
                </div>
              </div>

              {editingId && (
                <button
                  onClick={resetForm}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Cancelar Edição</span>
                </button>
              )}
            </div>

            {/* Descrição do Bem */}
            <div>
              <label className={labelCls}>Descrição detalhada do objeto *</label>
              <textarea
                value={formData.descricao}
                onChange={(e) => setFormData((p) => ({ ...p, descricao: e.target.value }))}
                placeholder="Ex: Carteira de couro preta com documentos em nome de..., Óculos de grau com armação metálica..."
                className={`${inputCls} min-h-[80px] ${
                  fieldErrors.descricao ? 'border-rose-400 focus:border-rose-500' : ''
                }`}
              />
              {fieldErrors.descricao && (
                <p className="text-xs font-bold text-rose-600 mt-1">{fieldErrors.descricao}</p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Categoria */}
              <div>
                <label className={labelCls}>Categoria</label>
                <select
                  value={formData.categoria}
                  onChange={(e) => setFormData((p) => ({ ...p, categoria: e.target.value }))}
                  className={inputCls}
                >
                  {CATEGORIAS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status */}
              <div>
                <label className={labelCls}>Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData((p) => ({ ...p, status: e.target.value }))}
                  className={inputCls}
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Local onde foi encontrado */}
            <div className="bg-slate-50/50 rounded-2xl p-4 sm:p-5 border border-slate-200/80 space-y-4">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Local onde foi encontrado
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Tipo de local</label>
                  <select
                    value={formData.local_tipo}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        local_tipo: e.target.value as any,
                        congregacao_id: '',
                        campo_id: '',
                      }))
                    }
                    className={inputCls}
                  >
                    <option value="congregacao">Congregação</option>
                    <option value="campo">Campo</option>
                    <option value="outro">Outro (texto livre)</option>
                  </select>
                </div>

                {formData.local_tipo === 'congregacao' && (
                  <div>
                    <label className={labelCls}>Congregação</label>
                    <select
                      value={formData.congregacao_id}
                      onChange={(e) =>
                        setFormData((p) => ({ ...p, congregacao_id: e.target.value }))
                      }
                      className={inputCls}
                    >
                      <option value="">Selecione...</option>
                      {congregacoesLocais.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nome}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {formData.local_tipo === 'campo' && (
                  <div>
                    <label className={labelCls}>Campo</label>
                    <select
                      value={formData.campo_id}
                      onChange={(e) => setFormData((p) => ({ ...p, campo_id: e.target.value }))}
                      className={inputCls}
                    >
                      <option value="">Selecione...</option>
                      {camposLocais.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nome}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {formData.local_tipo === 'outro' && (
                  <div>
                    <label className={labelCls}>Descrição do local</label>
                    <input
                      value={formData.local_descricao}
                      onChange={(e) =>
                        setFormData((p) => ({ ...p, local_descricao: e.target.value }))
                      }
                      placeholder="Ex: Estacionamento, cantina, templo principal..."
                      className={inputCls}
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Data em que foi encontrado *</label>
                <input
                  type="date"
                  value={formData.data_encontrado}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, data_encontrado: e.target.value }))
                  }
                  className={`${inputCls} ${
                    fieldErrors.data_encontrado ? 'border-rose-400 focus:border-rose-500' : ''
                  }`}
                />
                {fieldErrors.data_encontrado && (
                  <p className="text-xs font-bold text-rose-600 mt-1">
                    {fieldErrors.data_encontrado}
                  </p>
                )}
              </div>
              <div>
                <label className={labelCls}>Quem encontrou (opcional)</label>
                <input
                  value={formData.encontrador_nome}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, encontrador_nome: e.target.value }))
                  }
                  placeholder="Nome do membro ou voluntário"
                  className={inputCls}
                />
              </div>
            </div>

            {/* Reclamação / Devolução (visível apenas se status = reclamado) */}
            {formData.status === 'reclamado' && (
              <div className="bg-emerald-50/50 rounded-2xl p-4 sm:p-5 border border-emerald-200 space-y-4">
                <h4 className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
                  Dados da Retirada e Devolução
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className={labelCls}>Nome do proprietário / reclamante</label>
                    <input
                      value={formData.reclamante_nome}
                      onChange={(e) =>
                        setFormData((p) => ({ ...p, reclamante_nome: e.target.value }))
                      }
                      placeholder="Nome completo"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Telefone / Contato</label>
                    <input
                      value={formData.reclamante_contato}
                      onChange={(e) =>
                        setFormData((p) => ({ ...p, reclamante_contato: e.target.value }))
                      }
                      placeholder="(85) 99999-9999"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Data da devolução / retirada</label>
                    <input
                      type="date"
                      value={formData.data_reclamado}
                      onChange={(e) =>
                        setFormData((p) => ({ ...p, data_reclamado: e.target.value }))
                      }
                      className={inputCls}
                    />
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className={labelCls}>Observações adicionais</label>
              <textarea
                value={formData.observacoes}
                onChange={(e) => setFormData((p) => ({ ...p, observacoes: e.target.value }))}
                placeholder="Detalhes adicionais sobre o estado do objeto ou local guardado..."
                className={`${inputCls} min-h-[75px]`}
              />
            </div>

            {/* Ações do Formulário */}
            <div className="flex flex-wrap gap-3 justify-end pt-4 border-t border-slate-100">
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-5 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-sm font-bold transition cursor-pointer"
                >
                  Cancelar
                </button>
              )}
              <button
                type="button"
                onClick={handleSubmit}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-sm font-bold shadow-xs transition cursor-pointer flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>{editingId ? 'Atualizar registro' : 'Salvar registro'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
