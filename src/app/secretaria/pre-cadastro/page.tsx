'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRequireModulo } from '@/hooks/useRequireModulo';
import { temAcessoEscrita, type NivelAcesso } from '@/lib/access-control';
import { createClient } from '@/lib/supabase-client';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
  Search,
  Eye,
  Check,
  X,
  RefreshCw,
  Edit,
} from 'lucide-react';
import NotificationModal from '@/components/NotificationModal';

export default function PreCadastroPage() {
  const { ctx, bloqueado } = useRequireModulo('secretaria');
  const podeEscrever = ctx.nivel ? temAcessoEscrita(ctx.nivel as NivelAcesso, 'secretaria') : false;

  // Estado da listagem e filtros - Apenas duas abas: 'pendente' e 'inativo'
  const [activeTab, setActiveTab] = useState<'pendente' | 'inativo'>('pendente');
  const [searchTerm, setSearchTerm] = useState('');
  const [origemFilter, setOrigemFilter] = useState('todos');
  const [congregacaoFilter, setCongregacaoFilter] = useState('todas');
  const [tipoSolicitacaoFilter, setTipoSolicitacaoFilter] = useState('todos');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(15);

  // Dados carregados da API
  const [items, setItems] = useState<any[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [stats, setStats] = useState({
    pendentes: 0,
    novosCadastros: 0,
    atualizacoes: 0,
    inativos: 0,
    totalGeral: 0,
  });
  const [isLoading, setIsLoading] = useState(false);

  // Auxiliares: congregações do ministério para filtro
  const [congregacoes, setCongregacoes] = useState<{ id: string; nome: string }[]>([]);
  const [cargosMinisteriais, setCargosMinisteriais] = useState<string[]>([]);

  // Modais de Operação
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [modalMode, setModalMode] = useState<'view' | 'edit' | null>(null);
  const [actionConfirm, setActionConfirm] = useState<{
    isOpen: boolean;
    type: 'aprovar' | 'inativar' | 'reativar';
    item: any;
  } | null>(null);

  // Campos de ação no modal
  const [actionMotivo, setActionMotivo] = useState('');
  const [overrideTipoCadastro, setOverrideTipoCadastro] = useState('membro');
  const [overrideCargo, setOverrideCargo] = useState('');
  const [matriculaSugerida, setMatriculaSugerida] = useState('');
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);

  // Notificações
  const [notification, setNotification] = useState<{
    isOpen: boolean;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message: string;
  }>({
    isOpen: false,
    type: 'info',
    title: '',
    message: '',
  });

  // Carregar congregações e configurações
  useEffect(() => {
    if (!ctx.ministryId) return;
    const supabase = createClient();

    supabase
      .from('congregacoes')
      .select('id, nome')
      .eq('ministry_id', ctx.ministryId)
      .order('nome', { ascending: true })
      .then((res: any) => {
        if (res.data) setCongregacoes(res.data);
      });

    supabase
      .from('configurations')
      .select('cargos_ministeriais')
      .eq('ministry_id', ctx.ministryId)
      .maybeSingle()
      .then((res: any) => {
        if (res.data?.cargos_ministeriais && Array.isArray(res.data.cargos_ministeriais)) {
          setCargosMinisteriais(res.data.cargos_ministeriais);
        }
      });
  }, [ctx.ministryId]);

  // Carregar dados da API
  const fetchPreCadastros = useCallback(async () => {
    if (!ctx.ministryId) return;
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: String(itemsPerPage),
        status: activeTab,
        origem: origemFilter,
        congregacao_id: congregacaoFilter,
        tipo_solicitacao: tipoSolicitacaoFilter,
        search: searchTerm,
      });

      const res = await fetch(`/api/v1/secretaria/pre-cadastros?${params.toString()}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Falha ao buscar solicitações');
      }

      setItems(data.items || []);
      setTotalPages(data.pagination?.totalPages || 1);
      setTotalCount(data.pagination?.total || 0);
      if (data.stats) {
        setStats(data.stats);
      }
    } catch (err: any) {
      console.error(err);
      setNotification({
        isOpen: true,
        type: 'error',
        title: 'Erro ao carregar',
        message: err.message || 'Não foi possível carregar a lista de pré-cadastros.',
      });
    } finally {
      setIsLoading(false);
    }
  }, [ctx.ministryId, currentPage, itemsPerPage, activeTab, origemFilter, congregacaoFilter, tipoSolicitacaoFilter, searchTerm]);

  useEffect(() => {
    fetchPreCadastros();
  }, [fetchPreCadastros]);

  if (ctx.loading) return <div className="p-8 text-slate-500">Carregando painel da secretaria...</div>;
  if (bloqueado) return null;

  // Formatação de CPF
  const maskCpf = (v?: string | null) => {
    if (!v) return '-';
    const c = v.replace(/\D/g, '');
    if (c.length !== 11) return v;
    return `${c.slice(0, 3)}.${c.slice(3, 6)}.${c.slice(6, 9)}-${c.slice(9)}`;
  };

  // Executar Ação (Aprovar / Inativar / Reativar)
  const handleExecuteAction = async () => {
    if (!actionConfirm || !actionConfirm.item) return;
    const { type, item } = actionConfirm;

    if (type === 'inativar' && !actionMotivo.trim()) {
      setNotification({
        isOpen: true,
        type: 'warning',
        title: 'Motivo obrigatório',
        message: 'Por favor, informe a justificativa da inativação antes de prosseguir.',
      });
      return;
    }

    setIsSubmittingAction(true);
    try {
      const res = await fetch(`/api/v1/secretaria/pre-cadastros/${item.id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: type,
          motivo: actionMotivo.trim(),
          overrideTipoCadastro,
          overrideCargoMinisterial: overrideTipoCadastro === 'ministro' ? overrideCargo : null,
          matriculaSugerida: matriculaSugerida.trim() || null,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Erro ao processar ação');
      }

      setNotification({
        isOpen: true,
        type: 'success',
        title: 'Sucesso',
        message: json.message || 'Operação realizada com sucesso!',
      });

      setActionConfirm(null);
      setSelectedItem(null);
      setActionMotivo('');
      setMatriculaSugerida('');
      fetchPreCadastros();
    } catch (err: any) {
      setNotification({
        isOpen: true,
        type: 'error',
        title: 'Falha na Operação',
        message: err.message || 'Ocorreu um erro ao processar a ação.',
      });
    } finally {
      setIsSubmittingAction(false);
    }
  };

  // Salvar Edição do Pré-Cadastro
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;

    try {
      const res = await fetch(`/api/v1/secretaria/pre-cadastros/${selectedItem.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(selectedItem),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Falha ao salvar edição');
      }

      setNotification({
        isOpen: true,
        type: 'success',
        title: 'Atualizado',
        message: 'Dados do pré-cadastro atualizados com sucesso.',
      });
      setModalMode(null);
      setSelectedItem(null);
      fetchPreCadastros();
    } catch (err: any) {
      setNotification({
        isOpen: true,
        type: 'error',
        title: 'Erro ao salvar',
        message: err.message || 'Não foi possível atualizar o pré-cadastro.',
      });
    }
  };

  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden bg-[#f4f7fa] min-h-screen">
      <div className="p-4 sm:p-6 lg:p-8 max-w-[96rem] mx-auto w-full">
        {/* ── HEADER DA PÁGINA (PADRÃO MEMBROS) ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-teal-700 text-white flex items-center justify-center border border-teal-800 shadow-sm flex-shrink-0">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Pré-Cadastros</h1>
              <p className="text-xs sm:text-sm text-slate-600 font-medium mt-0.5">
                Validação, homologação e gerenciamento de novos membros e atualizações cadastrais.
              </p>
            </div>
          </div>
        </div>

        {/* ── 1. CARDS DE INDICADORES (PADRÃO LISTAGEM DE MEMBROS) ── */}
        {/* Quatro cards compactos exclusivamente informativos (mesma altura, largura e proporção) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* Card 1: Pendentes (Laranja / Âmbar) */}
          <div className="bg-[#fff6ea] border border-[#fde4c4] rounded-3xl p-5 relative overflow-hidden shadow-xs flex items-center justify-between">
            <div className="flex items-center gap-3.5 flex-1 min-w-0">
              <div className="w-13 h-13 rounded-2xl bg-white text-[#ea580c] shadow-xs flex items-center justify-center flex-shrink-0 border border-[#ffedd5]">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold text-slate-800 block truncate">
                  Pendentes
                </span>
                <p className="text-3xl font-black text-slate-900 leading-tight mt-0.5">
                  {stats.pendentes}
                </p>
                <p className="text-[11px] font-semibold text-slate-700 mt-1 truncate">
                  Aguardando homologação
                </p>
              </div>
            </div>

            <div className="w-8 h-8 rounded-xl bg-[#ffedd5] text-[#ea580c] flex items-center justify-center flex-shrink-0 self-start font-bold text-xs">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3" />
              </svg>
            </div>
          </div>

          {/* Card 2: Novos Cadastros (Azul / Ciano) */}
          <div className="bg-[#ebf5ff] border border-[#d0e6ff] rounded-3xl p-5 relative overflow-hidden shadow-xs flex items-center justify-between">
            <div className="flex items-center gap-3.5 flex-1 min-w-0">
              <div className="w-13 h-13 rounded-2xl bg-white text-[#2563eb] shadow-xs flex items-center justify-center flex-shrink-0 border border-[#dbeafe]">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold text-slate-800 block truncate">
                  Novos Cadastros
                </span>
                <p className="text-3xl font-black text-slate-900 leading-tight mt-0.5">
                  {stats.novosCadastros}
                </p>
                <p className="text-[11px] font-semibold text-slate-700 mt-1 truncate">
                  Ingressos no rol
                </p>
              </div>
            </div>

            <div className="w-8 h-8 rounded-xl bg-[#dbeafe] text-[#2563eb] flex items-center justify-center flex-shrink-0 self-start">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
            </div>
          </div>

          {/* Card 3: Atualizações (Violeta / Roxo) */}
          <div className="bg-[#f3f0ff] border border-[#e3dbff] rounded-3xl p-5 relative overflow-hidden shadow-xs flex items-center justify-between">
            <div className="flex items-center gap-3.5 flex-1 min-w-0">
              <div className="w-13 h-13 rounded-2xl bg-white text-[#7c3aed] shadow-xs flex items-center justify-center flex-shrink-0 border border-[#ede9fe]">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold text-slate-800 block truncate">
                  Atualizações
                </span>
                <p className="text-3xl font-black text-slate-900 leading-tight mt-0.5">
                  {stats.atualizacoes}
                </p>
                <p className="text-[11px] font-semibold text-slate-700 mt-1 truncate">
                  Revisões de membros
                </p>
              </div>
            </div>

            <div className="w-8 h-8 rounded-xl bg-[#ede9fe] text-[#7c3aed] flex items-center justify-center flex-shrink-0 self-start">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
          </div>

          {/* Card 4: Inativos (Rosa / Vermelho) */}
          <div className="bg-[#fff1f2] border border-[#fecdd3] rounded-3xl p-5 relative overflow-hidden shadow-xs flex items-center justify-between">
            <div className="flex items-center gap-3.5 flex-1 min-w-0">
              <div className="w-13 h-13 rounded-2xl bg-white text-[#e11d48] shadow-xs flex items-center justify-center flex-shrink-0 border border-[#ffe4e6]">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold text-slate-800 block truncate">
                  Inativos
                </span>
                <p className="text-3xl font-black text-slate-900 leading-tight mt-0.5">
                  {stats.inativos}
                </p>
                <p className="text-[11px] font-semibold text-slate-700 mt-1 truncate">
                  Inativados com justificativa
                </p>
              </div>
            </div>

            <div className="w-8 h-8 rounded-xl bg-[#ffe4e6] text-[#e11d48] flex items-center justify-center flex-shrink-0 self-start">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
          </div>
        </div>

        {/* ── 2. BARRA DE FILTROS (PADRÃO LISTAGEM DE MEMBROS) ── */}
        <div className="bg-slate-50/70 border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs mb-6">
          <div className="flex flex-col lg:flex-row lg:items-end gap-3.5">
            {/* Buscar por Nome ou CPF */}
            <div className="w-full lg:flex-1 min-w-[200px]">
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Buscar solicitações
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Search className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  placeholder="Buscar por nome ou CPF..."
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                  className="w-full pl-10 pr-3.5 py-2 bg-white border border-slate-300 rounded-xl text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 transition shadow-2xs"
                />
              </div>
            </div>

            {/* Filtro Congregação */}
            <div className="w-full sm:w-auto lg:w-48 shrink-0">
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Congregação
              </label>
              <select
                value={congregacaoFilter}
                onChange={(e) => { setCongregacaoFilter(e.target.value); setCurrentPage(1); }}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 transition shadow-2xs cursor-pointer"
              >
                <option value="todas">Todas as Congregações</option>
                {congregacoes.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </div>

            {/* Filtro Tipo Solicitação */}
            <div className="w-full sm:w-auto lg:w-44 shrink-0">
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Tipo
              </label>
              <select
                value={tipoSolicitacaoFilter}
                onChange={(e) => { setTipoSolicitacaoFilter(e.target.value); setCurrentPage(1); }}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 transition shadow-2xs cursor-pointer"
              >
                <option value="todos">Todos os Tipos</option>
                <option value="novo_cadastro">Novo Cadastro</option>
                <option value="atualizacao">Atualização</option>
              </select>
            </div>

            {/* Filtro Origem */}
            <div className="w-full sm:w-auto lg:w-44 shrink-0">
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Origem
              </label>
              <select
                value={origemFilter}
                onChange={(e) => { setOrigemFilter(e.target.value); setCurrentPage(1); }}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 transition shadow-2xs cursor-pointer"
              >
                <option value="todos">Todas as Origens</option>
                <option value="link_publico">Link Público</option>
                <option value="app_membro">App do Membro</option>
              </select>
            </div>

            {/* Botões Limpar e Atualizar */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setCongregacaoFilter('todas');
                  setTipoSolicitacaoFilter('todos');
                  setOrigemFilter('todos');
                  setCurrentPage(1);
                }}
                className="h-[38px] px-3.5 bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 border border-slate-300 hover:border-emerald-400 rounded-xl font-bold text-xs sm:text-sm transition shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer"
                title="Limpar todos os filtros"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-500 hover:text-emerald-700" />
                <span>Limpar</span>
              </button>
              <button
                type="button"
                onClick={fetchPreCadastros}
                className="h-[38px] px-3.5 bg-white hover:bg-emerald-50 text-teal-700 hover:text-teal-900 border border-slate-300 hover:border-teal-400 rounded-xl font-bold text-xs sm:text-sm transition shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer"
                title="Atualizar Lista"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                <span>Atualizar</span>
              </button>
            </div>
          </div>
        </div>

      {/* ── 2.1 NAVEGAÇÃO DE ABAS INDEPENDENTES (TABS HORIZONTAIS) ── */}
      <div className="flex items-center gap-2.5 mb-6 overflow-x-auto pb-1" role="tablist" aria-label="Abas de Pré-Cadastros">
        {/* Aba 1: Pendentes */}
        <button
          role="tab"
          id="tab-pendentes"
          aria-selected={activeTab === 'pendente'}
          aria-controls="panel-pre-cadastros"
          tabIndex={activeTab === 'pendente' ? 0 : -1}
          onClick={() => { setActiveTab('pendente'); setCurrentPage(1); }}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'pendente'
              ? 'bg-teal-700 text-white shadow-sm border border-teal-800 ring-2 ring-teal-600/30 ring-offset-1'
              : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 hover:text-slate-900 shadow-xs'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>Pendentes</span>
          <span className={`ml-1 px-2 py-0.5 rounded-full text-[11px] font-black ${
            activeTab === 'pendente' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700 border border-slate-200'
          }`}>
            {stats.pendentes}
          </span>
        </button>

        {/* Aba 2: Inativos */}
        <button
          role="tab"
          id="tab-inativos"
          aria-selected={activeTab === 'inativo'}
          aria-controls="panel-pre-cadastros"
          tabIndex={activeTab === 'inativo' ? 0 : -1}
          onClick={() => { setActiveTab('inativo'); setCurrentPage(1); }}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'inativo'
              ? 'bg-rose-700 text-white shadow-sm border border-rose-800 ring-2 ring-rose-600/30 ring-offset-1'
              : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 hover:text-slate-900 shadow-xs'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
          <span>Inativos</span>
          <span className={`ml-1 px-2 py-0.5 rounded-full text-[11px] font-black ${
            activeTab === 'inativo' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700 border border-slate-200'
          }`}>
            {stats.inativos}
          </span>
        </button>
      </div>

      {/* ── 3. LISTAGEM PRINCIPAL (PADRÃO LISTAGEM DE MEMBROS) ── */}
      <div id="panel-pre-cadastros" role="tabpanel" aria-labelledby={activeTab === 'pendente' ? 'tab-pendentes' : 'tab-inativos'} className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden mb-8">
        {/* Cabeçalho Interno da Tabela com Ícone, Título e Contador */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-5 border-b border-slate-200/80 bg-white">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 border border-teal-200 flex items-center justify-center font-bold">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h7" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-slate-900">
              Solicitações de Pré-Cadastro
            </h2>
            <span className="px-3 py-1 bg-teal-50 text-teal-800 border border-teal-200/90 rounded-full text-xs font-bold">
              {totalCount} {totalCount === 1 ? 'solicitação' : 'solicitações'}
            </span>
          </div>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-slate-500 text-sm font-medium">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-teal-600 mb-2" />
            Carregando solicitações...
          </div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm font-medium">
            Nenhuma solicitação encontrada para os filtros selecionados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200/90 text-slate-700 uppercase text-[11px] font-bold tracking-wider">
                  <th className="px-4 py-3.5">Solicitante</th>
                  <th className="px-4 py-3.5">CPF</th>
                  <th className="px-4 py-3.5">Tipo / Origem</th>
                  <th className="px-4 py-3.5">Congregação / Campo</th>
                  <th className="px-4 py-3.5">Data Envio</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5 text-center w-36">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/80">
                {items.map((item, index) => {
                  const isDuplicado = item.isDuplicidadeDetectada;
                  const isOddRow = index % 2 === 1;
                  return (
                    <tr
                      key={item.id}
                      className={`transition-colors text-sm text-slate-800 group hover:bg-[#f1f5f9] ${
                        isDuplicado
                          ? 'bg-amber-50/50'
                          : isOddRow
                          ? 'bg-[#f8fafc]'
                          : 'bg-white'
                      }`}
                    >
                      {/* Nome e Alerta */}
                      <td className="px-4 py-3.5 font-bold text-slate-900">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 font-bold overflow-hidden flex-shrink-0 shadow-2xs">
                            {item.foto_url ? (
                              <img src={item.foto_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <span>👤</span>
                            )}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 text-sm leading-snug">{item.name}</p>
                            {isDuplicado && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md border border-amber-300 mt-1">
                                <AlertTriangle className="w-3 h-3 text-amber-600 flex-shrink-0" />
                                CPF já existe em Membros (Matrícula: {item.existingMemberMatch?.matricula || '-'})
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* CPF */}
                      <td className="px-4 py-3.5 font-mono text-slate-700 font-medium text-xs">
                        {maskCpf(item.cpf)}
                      </td>

                      {/* Tipo / Origem */}
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                            item.tipo_solicitacao === 'atualizacao'
                              ? 'bg-purple-100 text-purple-900 border-purple-200'
                              : 'bg-sky-100 text-sky-900 border-sky-200'
                          }`}
                        >
                          {item.tipo_solicitacao === 'atualizacao' ? 'Atualização' : 'Novo Membro'}
                        </span>
                        <span className="block text-[11px] text-slate-500 font-medium mt-0.5">
                          {item.origem === 'link_publico' ? 'Link Público' : item.origem === 'app_membro' ? 'App do Membro' : item.origem || 'link_publico'}
                        </span>
                      </td>

                      {/* Congregação e Campo */}
                      <td className="px-4 py-3.5 text-slate-700">
                        <p className="font-semibold text-xs text-slate-900">{item.congregacoes?.nome || item.dados_adicionais?.congregacao_nome || 'Não informada'}</p>
                        <p className="text-[11px] text-slate-500 font-medium">{item.campos?.nome || item.dados_adicionais?.campo_nome || '-'}</p>
                      </td>

                      {/* Data de Envio */}
                      <td className="px-4 py-3.5 text-slate-600 text-xs font-medium">
                        {item.created_at
                          ? new Date(item.created_at).toLocaleDateString('pt-BR', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '-'}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-md text-[10px] font-bold border uppercase tracking-wider ${
                            item.status === 'pendente'
                              ? 'bg-amber-100 text-amber-900 border-amber-300'
                              : 'bg-rose-100 text-rose-900 border-rose-300'
                          }`}
                        >
                          {item.status === 'inativo' || item.status === 'rejeitado' || item.status === 'devolvido'
                            ? 'Inativo'
                            : item.status}
                        </span>
                      </td>

                      {/* Ações Compactas, Alinhadas e com Tooltips */}
                      <td className="px-4 py-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Visualizar */}
                          <button
                            onClick={() => { setSelectedItem(item); setModalMode('view'); }}
                            title="Visualizar Detalhes"
                            className="p-1.5 text-slate-700 hover:text-slate-950 hover:bg-slate-200/60 rounded-lg transition border border-slate-300 cursor-pointer"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Se Pendente: Editar, Aprovar, Inativar */}
                          {item.status === 'pendente' && (
                            <>
                              {/* Editar Dados */}
                              {podeEscrever && (
                                <button
                                  onClick={() => { setSelectedItem(item); setModalMode('edit'); }}
                                  title="Editar Dados"
                                  className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-100/60 rounded-lg transition border border-blue-200 cursor-pointer"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                              )}

                              {/* Aprovar e Homologar */}
                              {podeEscrever && (
                                <button
                                  onClick={() => {
                                    setActionConfirm({ isOpen: true, type: 'aprovar', item });
                                    setOverrideTipoCadastro(item.tipo_cadastro || 'membro');
                                    setOverrideCargo(item.cargo_ministerial || '');
                                  }}
                                  title="Aprovar e Homologar"
                                  className="p-1.5 text-emerald-700 hover:text-emerald-900 hover:bg-emerald-100/60 rounded-lg transition border border-emerald-300 cursor-pointer font-bold"
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                              )}

                              {/* Inativar */}
                              {podeEscrever && (
                                <button
                                  onClick={() => setActionConfirm({ isOpen: true, type: 'inativar', item })}
                                  title="Inativar Solicitação"
                                  className="p-1.5 text-rose-700 hover:text-rose-900 hover:bg-rose-100/60 rounded-lg transition border border-rose-300 cursor-pointer"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              )}
                            </>
                          )}

                          {/* Se Inativo: Reativar para Pendente */}
                          {item.status !== 'pendente' && podeEscrever && (
                            <button
                              onClick={() => setActionConfirm({ isOpen: true, type: 'reativar', item })}
                              title="Reativar para Análise (Pendente)"
                              className="p-1.5 text-amber-700 hover:text-amber-900 hover:bg-amber-100/60 rounded-lg transition border border-amber-300 cursor-pointer"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── 4. PAGINAÇÃO INTEGRADA AO RODAPÉ (PADRÃO LISTAGEM DE MEMBROS) ── */}
        <div className="p-4 bg-white border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Informações e Seletor de Itens */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs font-medium text-slate-600 text-center sm:text-left">
            <div>
              Exibindo <span className="font-bold text-slate-900">{totalCount > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}</span> a{' '}
              <span className="font-bold text-slate-900">{Math.min(currentPage * itemsPerPage, totalCount)}</span> de{' '}
              <span className="font-bold text-slate-900">{totalCount}</span> solicitações
            </div>

            <div className="flex items-center gap-1.5">
              <span>Exibir:</span>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="px-2.5 py-1 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 cursor-pointer shadow-xs"
              >
                <option value={10}>10</option>
                <option value={15}>15</option>
                <option value={30}>30</option>
                <option value={50}>50</option>
              </select>
              <span>por página</span>
            </div>
          </div>

          {/* Navegação de Páginas Numérica */}
          <div className="flex items-center gap-1.5 flex-wrap justify-center">
            {/* Anterior */}
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="w-8 h-8 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center text-sm transition cursor-pointer font-bold"
              title="Página Anterior"
            >
              ‹
            </button>

            {/* Páginas com ellipsis */}
            {(() => {
              const pages: (number | string)[] = [];
              if (totalPages <= 7) {
                for (let i = 1; i <= totalPages; i++) pages.push(i);
              } else {
                pages.push(1);
                if (currentPage > 4) pages.push('...');
                const start = Math.max(2, currentPage - 2);
                const end = Math.min(totalPages - 1, currentPage + 2);
                for (let i = start; i <= end; i++) pages.push(i);
                if (currentPage < totalPages - 3) pages.push('...');
                pages.push(totalPages);
              }
              return pages.map((p, idx) =>
                p === '...' ? (
                  <span key={`ellipsis-${idx}`} className="px-1 text-slate-400 text-xs select-none">
                    …
                  </span>
                ) : (
                  <button
                    key={p}
                    onClick={() => setCurrentPage(p as number)}
                    className={`w-8 h-8 rounded-lg text-xs font-bold transition flex items-center justify-center cursor-pointer ${
                      currentPage === p
                        ? 'bg-teal-700 text-white shadow-sm border border-teal-800'
                        : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {p}
                  </button>
                )
              );
            })()}

            {/* Próximo */}
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages || totalPages === 0}
              className="w-8 h-8 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center text-sm transition cursor-pointer font-bold"
              title="Próxima Página"
            >
              ›
            </button>
          </div>
        </div>
      </div>

      {/* ── 5. MODAL DE VISUALIZAÇÃO DOS DADOS ── */}
      {modalMode === 'view' && selectedItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-900 text-base">Ficha de Solicitação de Pré-Cadastro</h3>
              <button onClick={() => setModalMode(null)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              {selectedItem.isDuplicidadeDetectada && (
                <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                  <div>
                    Atenção: Este CPF já possui um membro oficial cadastrado ({selectedItem.existingMemberMatch?.name} - Matrícula {selectedItem.existingMemberMatch?.matricula}).
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-slate-500 font-bold block uppercase text-[10px]">Nome Completo</span>
                  <span className="text-slate-900 font-bold text-sm">{selectedItem.name}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-bold block uppercase text-[10px]">CPF</span>
                  <span className="text-slate-900 font-mono font-bold text-sm">{maskCpf(selectedItem.cpf)}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-bold block uppercase text-[10px]">Data de Nascimento</span>
                  <span className="text-slate-800 font-semibold">{selectedItem.data_nascimento || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-bold block uppercase text-[10px]">Sexo / Estado Civil</span>
                  <span className="text-slate-800 font-semibold">{selectedItem.sexo || '-'} • {selectedItem.estado_civil || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-bold block uppercase text-[10px]">Filiação (Pai / Mãe)</span>
                  <span className="text-slate-800 font-semibold">{selectedItem.nome_pai || '-'} / {selectedItem.nome_mae || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-bold block uppercase text-[10px]">Cônjuge</span>
                  <span className="text-slate-800 font-semibold">{selectedItem.nome_conjuge || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-bold block uppercase text-[10px]">Congregação / Campo</span>
                  <span className="text-slate-800 font-semibold">{selectedItem.congregacoes?.nome || selectedItem.dados_adicionais?.congregacao_nome || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-bold block uppercase text-[10px]">Contato</span>
                  <span className="text-slate-800 font-semibold">{selectedItem.whatsapp || selectedItem.phone || selectedItem.celular || '-'} • {selectedItem.email || '-'}</span>
                </div>
              </div>

              {selectedItem.motivo_rejeicao && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-900">
                  <span className="font-bold block uppercase text-[10px]">Motivo registrado:</span>
                  <p className="mt-1 font-semibold">{selectedItem.motivo_rejeicao}</p>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                onClick={() => setModalMode(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl font-bold cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 6. MODAL DE EDIÇÃO ANTES DA APROVAÇÃO ── */}
      {modalMode === 'edit' && selectedItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleSaveEdit} className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-900 text-base">Revisar e Editar Pré-Cadastro</h3>
              <button type="button" onClick={() => setModalMode(null)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              <div>
                <label className="text-slate-600 font-bold block mb-1">Nome Completo</label>
                <input
                  type="text"
                  value={selectedItem.name || ''}
                  onChange={(e) => setSelectedItem({ ...selectedItem, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-semibold"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-600 font-bold block mb-1">Nome do Pai</label>
                  <input
                    type="text"
                    value={selectedItem.nome_pai || ''}
                    onChange={(e) => setSelectedItem({ ...selectedItem, nome_pai: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-semibold"
                  />
                </div>
                <div>
                  <label className="text-slate-600 font-bold block mb-1">Nome da Mãe</label>
                  <input
                    type="text"
                    value={selectedItem.nome_mae || ''}
                    onChange={(e) => setSelectedItem({ ...selectedItem, nome_mae: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-600 font-bold block mb-1">Congregação</label>
                  <select
                    value={selectedItem.congregacao_id || ''}
                    onChange={(e) => setSelectedItem({ ...selectedItem, congregacao_id: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-semibold cursor-pointer"
                  >
                    <option value="">Selecione...</option>
                    {congregacoes.map((c) => (
                      <option key={c.id} value={c.id}>{c.nome}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-slate-600 font-bold block mb-1">WhatsApp / Telefone</label>
                  <input
                    type="text"
                    value={selectedItem.whatsapp || selectedItem.phone || ''}
                    onChange={(e) => setSelectedItem({ ...selectedItem, whatsapp: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-600 font-bold block mb-1">E-mail</label>
                  <input
                    type="email"
                    value={selectedItem.email || ''}
                    onChange={(e) => setSelectedItem({ ...selectedItem, email: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-semibold"
                  />
                </div>
                <div>
                  <label className="text-slate-600 font-bold block mb-1">Data de Nascimento</label>
                  <input
                    type="date"
                    value={selectedItem.data_nascimento || ''}
                    onChange={(e) => setSelectedItem({ ...selectedItem, data_nascimento: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-semibold"
                  />
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalMode(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl font-bold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl font-bold cursor-pointer shadow-xs"
              >
                Salvar Alterações
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── 7. MODAL DE CONFIRMAÇÃO DE AÇÃO (Aprovar / Inativar / Reativar) ── */}
      {actionConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full overflow-hidden border border-slate-200">
            <div className={`px-6 py-4 border-b flex items-center justify-between ${
              actionConfirm.type === 'aprovar'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                : actionConfirm.type === 'reativar'
                ? 'bg-amber-50 border-amber-200 text-amber-950'
                : 'bg-rose-50 border-rose-200 text-rose-950'
            }`}>
              <h3 className="font-bold text-base flex items-center gap-2">
                {actionConfirm.type === 'aprovar' && <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
                {actionConfirm.type === 'reativar' && <RotateCcw className="w-5 h-5 text-amber-600" />}
                {actionConfirm.type === 'inativar' && <XCircle className="w-5 h-5 text-rose-600" />}
                {actionConfirm.type === 'aprovar'
                  ? 'Confirmar Homologação e Aprovação'
                  : actionConfirm.type === 'reativar'
                  ? 'Reativar Solicitação para Análise'
                  : 'Inativar Solicitação de Pré-Cadastro'}
              </h3>
              <button onClick={() => setActionConfirm(null)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <p className="text-slate-700 font-medium">
                Solicitante: <strong className="text-slate-900">{actionConfirm.item.name}</strong> (CPF: {maskCpf(actionConfirm.item.cpf)})
              </p>

              {actionConfirm.type === 'aprovar' && (
                <>
                  <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl text-emerald-900">
                    {actionConfirm.item.tipo_solicitacao === 'atualizacao' ? (
                      <p>Esta solicitação aplicará as atualizações na ficha oficial do membro existente, preservando histórico e matrículas.</p>
                    ) : (
                      <p>Esta ação gerará a <strong>matrícula oficial</strong> sequencial e criará a ficha definitiva no módulo de Membros.</p>
                    )}
                  </div>

                  {actionConfirm.item.tipo_solicitacao !== 'atualizacao' && (
                    <div className="space-y-3 pt-2">
                      <div>
                        <label className="text-slate-700 font-bold block mb-1">Classificação Eclesiástica</label>
                        <select
                          value={overrideTipoCadastro}
                          onChange={(e) => setOverrideTipoCadastro(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl font-semibold cursor-pointer"
                        >
                          <option value="membro">Membro</option>
                          <option value="congregado">Congregado</option>
                          <option value="ministro">Ministro</option>
                          <option value="crianca">Criança</option>
                        </select>
                      </div>

                      {overrideTipoCadastro === 'ministro' && (
                        <div>
                          <label className="text-slate-700 font-bold block mb-1">Cargo Ministerial</label>
                          <select
                            value={overrideCargo}
                            onChange={(e) => setOverrideCargo(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-xl font-semibold cursor-pointer"
                          >
                            <option value="">Selecione o cargo...</option>
                            {cargosMinisteriais.map((c) => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      <div>
                        <label className="text-slate-700 font-bold block mb-1">
                          Matrícula Oficial Específica (Opcional - deixe vazio para geração automática sequencial)
                        </label>
                        <input
                          type="text"
                          placeholder="Ex: 042"
                          value={matriculaSugerida}
                          onChange={(e) => setMatriculaSugerida(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono"
                        />
                      </div>
                    </div>
                  )}
                </>
              )}

              {actionConfirm.type === 'inativar' && (
                <div>
                  <label className="text-slate-700 font-bold block mb-1">
                    Motivo da Inativação *
                  </label>
                  <textarea
                    rows={3}
                    value={actionMotivo}
                    onChange={(e) => setActionMotivo(e.target.value)}
                    placeholder="Descreva a justificativa para inativar esta solicitação (obrigatório para auditoria)..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-medium"
                    required
                  />
                </div>
              )}

              {actionConfirm.type === 'reativar' && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-slate-700 space-y-1">
                  <p className="font-bold text-amber-900">Reativar Solicitação para Análise</p>
                  <p>A solicitação retornará à aba <strong>Pendentes</strong> com todos os dados preservados para revisão da Secretaria. Nenhum registro será criado em Membros nesta etapa.</p>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setActionConfirm(null)}
                disabled={isSubmittingAction}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl font-bold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleExecuteAction}
                disabled={isSubmittingAction}
                className={`px-5 py-2 text-white rounded-xl font-bold cursor-pointer shadow-xs flex items-center gap-1.5 ${
                  actionConfirm.type === 'aprovar'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : actionConfirm.type === 'reativar'
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {isSubmittingAction && <RefreshCw className="w-4 h-4 animate-spin" />}
                Confirmar {actionConfirm.type === 'aprovar' ? 'Aprovação' : actionConfirm.type === 'reativar' ? 'Reativação' : 'Inativação'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Notificações / Erros */}
      <NotificationModal
        isOpen={notification.isOpen}
        onClose={() => setNotification((prev) => ({ ...prev, isOpen: false }))}
        type={notification.type}
        title={notification.title}
        message={notification.message}
      />
      </div>
    </div>
  );
}
