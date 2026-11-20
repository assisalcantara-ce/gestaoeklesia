'use client';

import { useState, useEffect, useCallback } from 'react';
import PageLayout from '@/components/PageLayout';
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

  // Estado da listagem e filtros
  const [activeTab, setActiveTab] = useState<'pendente' | 'aprovado' | 'rejeitado' | 'devolvido' | 'todos'>('pendente');
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
    aprovados: 0,
    rejeitados: 0,
    devolvidos: 0,
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
    type: 'aprovar' | 'devolver' | 'rejeitar';
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

  // Executar Ação (Aprovar / Devolver / Rejeitar)
  const handleExecuteAction = async () => {
    if (!actionConfirm || !actionConfirm.item) return;
    const { type, item } = actionConfirm;

    if ((type === 'devolver' || type === 'rejeitar') && !actionMotivo.trim()) {
      setNotification({
        isOpen: true,
        type: 'warning',
        title: 'Motivo obrigatório',
        message: 'Por favor, informe a justificativa ou orientação antes de prosseguir.',
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
    <PageLayout
      title="Central de Pré-Cadastros"
      description="Gerenciamento, validação e homologação de solicitações de membros e atualizações"
      activeMenu="pre-cadastro"
    >
      {/* ── 1. CARDS DE STATUS / RESUMO ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <button
          onClick={() => { setActiveTab('pendente'); setCurrentPage(1); }}
          className={`p-5 rounded-2xl border text-left transition shadow-xs cursor-pointer ${
            activeTab === 'pendente'
              ? 'bg-amber-50/80 border-amber-300 ring-2 ring-amber-400/20'
              : 'bg-white border-slate-200 hover:border-amber-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-700">Pendentes</span>
            <span className="p-2 bg-amber-100 text-amber-800 rounded-xl">⏳</span>
          </div>
          <p className="text-3xl font-black text-amber-900 mt-2">{stats.pendentes}</p>
          <p className="text-xs text-amber-700/80 mt-1">Aguardando homologação</p>
        </button>

        <button
          onClick={() => { setActiveTab('aprovado'); setCurrentPage(1); }}
          className={`p-5 rounded-2xl border text-left transition shadow-xs cursor-pointer ${
            activeTab === 'aprovado'
              ? 'bg-emerald-50/80 border-emerald-300 ring-2 ring-emerald-400/20'
              : 'bg-white border-slate-200 hover:border-emerald-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">Aprovados</span>
            <span className="p-2 bg-emerald-100 text-emerald-800 rounded-xl">✅</span>
          </div>
          <p className="text-3xl font-black text-emerald-900 mt-2">{stats.aprovados}</p>
          <p className="text-xs text-emerald-700/80 mt-1">Oficializados em Membros</p>
        </button>

        <button
          onClick={() => { setActiveTab('devolvido'); setCurrentPage(1); }}
          className={`p-5 rounded-2xl border text-left transition shadow-xs cursor-pointer ${
            activeTab === 'devolvido'
              ? 'bg-blue-50/80 border-blue-300 ring-2 ring-blue-400/20'
              : 'bg-white border-slate-200 hover:border-blue-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-700">Para Correção</span>
            <span className="p-2 bg-blue-100 text-blue-800 rounded-xl">↩️</span>
          </div>
          <p className="text-3xl font-black text-blue-900 mt-2">{stats.devolvidos}</p>
          <p className="text-xs text-blue-700/80 mt-1">Devolvidos com pendência</p>
        </button>

        <button
          onClick={() => { setActiveTab('rejeitado'); setCurrentPage(1); }}
          className={`p-5 rounded-2xl border text-left transition shadow-xs cursor-pointer ${
            activeTab === 'rejeitado'
              ? 'bg-rose-50/80 border-rose-300 ring-2 ring-rose-400/20'
              : 'bg-white border-slate-200 hover:border-rose-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-700">Rejeitados</span>
            <span className="p-2 bg-rose-100 text-rose-800 rounded-xl">❌</span>
          </div>
          <p className="text-3xl font-black text-rose-900 mt-2">{stats.rejeitados}</p>
          <p className="text-xs text-rose-700/80 mt-1">Recusados pela Secretaria</p>
        </button>
      </div>

      {/* ── 2. BARRA DE FILTROS INSTITUCIONAL ── */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs mb-6 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
          {/* Busca por Nome ou CPF */}
          <div className="lg:col-span-4 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por nome ou CPF..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition"
            />
          </div>

          {/* Filtro Congregação */}
          <div className="lg:col-span-3">
            <select
              value={congregacaoFilter}
              onChange={(e) => { setCongregacaoFilter(e.target.value); setCurrentPage(1); }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition cursor-pointer"
            >
              <option value="todas">Todas as Congregações</option>
              {congregacoes.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          </div>

          {/* Filtro Tipo Solicitação */}
          <div className="lg:col-span-2">
            <select
              value={tipoSolicitacaoFilter}
              onChange={(e) => { setTipoSolicitacaoFilter(e.target.value); setCurrentPage(1); }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition cursor-pointer"
            >
              <option value="todos">Todos os Tipos</option>
              <option value="novo_cadastro">Novo Cadastro</option>
              <option value="atualizacao">Atualização</option>
            </select>
          </div>

          {/* Filtro Origem */}
          <div className="lg:col-span-2">
            <select
              value={origemFilter}
              onChange={(e) => { setOrigemFilter(e.target.value); setCurrentPage(1); }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition cursor-pointer"
            >
              <option value="todos">Todas as Origens</option>
              <option value="link_publico">Link Público</option>
              <option value="app_membro">App do Membro</option>
              <option value="secretaria">Secretaria</option>
            </select>
          </div>

          {/* Limpar / Atualizar */}
          <div className="lg:col-span-1 flex items-center justify-end gap-1.5">
            <button
              onClick={() => {
                setSearchTerm('');
                setCongregacaoFilter('todas');
                setTipoSolicitacaoFilter('todos');
                setOrigemFilter('todos');
                setCurrentPage(1);
              }}
              title="Limpar Filtros"
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition border border-slate-200 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={fetchPreCadastros}
              title="Atualizar Lista"
              className="p-2 text-teal-700 hover:text-teal-900 hover:bg-teal-50 rounded-xl transition border border-teal-200 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* ── 3. LISTAGEM PRINCIPAL ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-slate-500 text-sm font-medium">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-teal-600 mb-2" />
            Carregando solicitações...
          </div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm">
            Nenhuma solicitação encontrada para os filtros selecionados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 uppercase text-[11px] font-bold tracking-wider">
                  <th className="px-4 py-3.5">Solicitante</th>
                  <th className="px-4 py-3.5">CPF</th>
                  <th className="px-4 py-3.5">Tipo / Origem</th>
                  <th className="px-4 py-3.5">Congregação / Campo</th>
                  <th className="px-4 py-3.5">Data Envio</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {items.map((item) => {
                  const isDuplicado = item.isDuplicidadeDetectada;
                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-slate-50/80 transition ${
                        isDuplicado ? 'bg-amber-50/40' : ''
                      }`}
                    >
                      {/* Nome e Alerta */}
                      <td className="px-4 py-3.5 font-bold text-slate-900">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 font-bold overflow-hidden flex-shrink-0">
                            {item.foto_url ? (
                              <img src={item.foto_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <span>👤</span>
                            )}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900">{item.name}</p>
                            {isDuplicado && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-300 mt-0.5">
                                <AlertTriangle className="w-3 h-3 text-amber-600" />
                                CPF já existe em Membros (Matrícula: {item.existingMemberMatch?.matricula || '-'})
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* CPF */}
                      <td className="px-4 py-3.5 font-mono text-slate-700 font-medium">
                        {maskCpf(item.cpf)}
                      </td>

                      {/* Tipo / Origem */}
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                            item.tipo_solicitacao === 'atualizacao'
                              ? 'bg-purple-100 text-purple-900 border-purple-200'
                              : 'bg-sky-100 text-sky-900 border-sky-200'
                          }`}
                        >
                          {item.tipo_solicitacao === 'atualizacao' ? 'Atualização' : 'Novo Membro'}
                        </span>
                        <span className="block text-[11px] text-slate-500 mt-0.5">
                          {item.origem || 'link_publico'}
                        </span>
                      </td>

                      {/* Congregação e Campo */}
                      <td className="px-4 py-3.5 text-slate-700">
                        <p className="font-semibold">{item.congregacoes?.nome || item.dados_adicionais?.congregacao_nome || 'Não informada'}</p>
                        <p className="text-[11px] text-slate-500">{item.campos?.nome || item.dados_adicionais?.campo_nome || '-'}</p>
                      </td>

                      {/* Data de Envio */}
                      <td className="px-4 py-3.5 text-slate-600">
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
                            item.status === 'aprovado'
                              ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                              : item.status === 'pendente'
                              ? 'bg-amber-100 text-amber-900 border-amber-300'
                              : item.status === 'devolvido'
                              ? 'bg-blue-100 text-blue-900 border-blue-300'
                              : 'bg-rose-100 text-rose-900 border-rose-300'
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>

                      {/* Ações */}
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Visualizar */}
                          <button
                            onClick={() => { setSelectedItem(item); setModalMode('view'); }}
                            title="Visualizar Detalhes"
                            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition border border-slate-200 cursor-pointer"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Editar (se pendente/devolvido e com permissão) */}
                          {podeEscrever && item.status !== 'aprovado' && (
                            <button
                              onClick={() => { setSelectedItem(item); setModalMode('edit'); }}
                              title="Editar Dados"
                              className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition border border-blue-200 cursor-pointer"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                          )}

                          {/* Aprovar */}
                          {podeEscrever && item.status !== 'aprovado' && (
                            <button
                              onClick={() => {
                                setActionConfirm({ isOpen: true, type: 'aprovar', item });
                                setOverrideTipoCadastro(item.tipo_cadastro || 'membro');
                                setOverrideCargo(item.cargo_ministerial || '');
                              }}
                              title="Aprovar e Homologar"
                              className="p-1.5 text-emerald-700 hover:text-emerald-900 hover:bg-emerald-50 rounded-lg transition border border-emerald-200 cursor-pointer font-bold"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                          )}

                          {/* Devolver */}
                          {podeEscrever && item.status === 'pendente' && (
                            <button
                              onClick={() => setActionConfirm({ isOpen: true, type: 'devolver', item })}
                              title="Devolver para Correção"
                              className="p-1.5 text-blue-700 hover:text-blue-900 hover:bg-blue-50 rounded-lg transition border border-blue-200 cursor-pointer"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                          )}

                          {/* Rejeitar */}
                          {podeEscrever && item.status !== 'aprovado' && item.status !== 'rejeitado' && (
                            <button
                              onClick={() => setActionConfirm({ isOpen: true, type: 'rejeitar', item })}
                              title="Rejeitar Solicitação"
                              className="p-1.5 text-rose-700 hover:text-rose-900 hover:bg-rose-50 rounded-lg transition border border-rose-200 cursor-pointer"
                            >
                              <X className="w-4 h-4" />
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

        {/* ── 4. PAGINAÇÃO ── */}
        <div className="p-4 border-t border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <span>Total de <strong>{totalCount}</strong> solicitações</span>
            <span>•</span>
            <span>Página <strong>{currentPage}</strong> de <strong>{totalPages || 1}</strong></span>
            <span>•</span>
            <div className="flex items-center gap-1">
              <span>Exibir:</span>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="px-2 py-0.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold cursor-pointer"
              >
                <option value={10}>10</option>
                <option value={15}>15</option>
                <option value={30}>30</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-bold"
            >
              Anterior
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages || totalPages === 0}
              className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-bold"
            >
              Próxima
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

      {/* ── 7. MODAL DE CONFIRMAÇÃO DE AÇÃO (Aprovar / Devolver / Rejeitar) ── */}
      {actionConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full overflow-hidden border border-slate-200">
            <div className={`px-6 py-4 border-b flex items-center justify-between ${
              actionConfirm.type === 'aprovar'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                : actionConfirm.type === 'devolver'
                ? 'bg-blue-50 border-blue-200 text-blue-950'
                : 'bg-rose-50 border-rose-200 text-rose-950'
            }`}>
              <h3 className="font-bold text-base flex items-center gap-2">
                {actionConfirm.type === 'aprovar' && <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
                {actionConfirm.type === 'devolver' && <RotateCcw className="w-5 h-5 text-blue-600" />}
                {actionConfirm.type === 'rejeitar' && <XCircle className="w-5 h-5 text-rose-600" />}
                {actionConfirm.type === 'aprovar'
                  ? 'Confirmar Homologação e Aprovação'
                  : actionConfirm.type === 'devolver'
                  ? 'Devolver Solicitação para Correção'
                  : 'Rejeitar Solicitação de Pré-Cadastro'}
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

              {(actionConfirm.type === 'devolver' || actionConfirm.type === 'rejeitar') && (
                <div>
                  <label className="text-slate-700 font-bold block mb-1">
                    {actionConfirm.type === 'devolver' ? 'Orientação / Pendência' : 'Motivo da Rejeição'} *
                  </label>
                  <textarea
                    rows={3}
                    value={actionMotivo}
                    onChange={(e) => setActionMotivo(e.target.value)}
                    placeholder="Descreva o motivo que será registrado para auditoria da secretaria..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-medium"
                    required
                  />
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
                    : actionConfirm.type === 'devolver'
                    ? 'bg-blue-600 hover:bg-blue-700'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {isSubmittingAction && <RefreshCw className="w-4 h-4 animate-spin" />}
                Confirmar {actionConfirm.type === 'aprovar' ? 'Aprovação' : actionConfirm.type === 'devolver' ? 'Devolução' : 'Rejeição'}
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
    </PageLayout>
  );
}
