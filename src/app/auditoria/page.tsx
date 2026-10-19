'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase-client';
import { useRequireSupabaseAuth } from '@/hooks/useRequireSupabaseAuth';
import { useRequireModulo } from '@/hooks/useRequireModulo';
import {
  ClipboardList,
  XCircle,
  AlertTriangle,
  Eye,
  RefreshCw,
  User,
  Clock,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  X,
  Search,
  Filter,
  RotateCcw,
  Loader2,
  Database,
  Globe,
  Terminal,
} from 'lucide-react';

import {
  type AuditLog,
  sanitizarDadosSensiveis,
  getAcaoBadge,
  getStatusBadge,
} from '@/lib/auditoria-utils';

const ITENS_POR_PAGINA = 20;


const ACOES_OPCOES = [
  'criar',
  'editar',
  'deletar',
  'inativar',
  'reativar',
  'visualizar',
  'exportar',
  'importar',
  'responder',
  'reclassificar',
  'atualizar_status',
  'atualizar_permissoes',
  'login',
  'logout',
];

const MODULOS_OPCOES = [
  'usuarios',
  'configuracoes',
  'membros',
  'secretaria',
  'financeiro',
  'patrimonio',
  'ministerios',
  'suporte',
  'agenda',
  'eventos',
];

const STATUS_OPCOES = ['sucesso', 'erro', 'aviso'];

export default function AuditoriaPage() {
  const supabase = createClient();
  const { loading: authLoading } = useRequireSupabaseAuth();
  const { bloqueado } = useRequireModulo('auditoria');

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [totalRegistros, setTotalRegistros] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Paginação
  const [paginaAtual, setPaginaAtual] = useState(1);

  // Filtros
  const [filtroAcao, setFiltroAcao] = useState('todos');
  const [filtroModulo, setFiltroModulo] = useState('todos');
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [filtroData, setFiltroData] = useState('7dias');
  const [filtroUsuario, setFiltroUsuario] = useState('');

  // Modal de Detalhes
  const [logSelecionado, setLogSelecionado] = useState<AuditLog | null>(null);

  // Fechar modal ao pressionar ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLogSelecionado(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Total de Páginas
  const totalPaginas = useMemo(() => {
    return Math.max(1, Math.ceil(totalRegistros / ITENS_POR_PAGINA));
  }, [totalRegistros]);

  // Carregar logs com paginação real no banco de dados
  const carregarLogs = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      // Determinar data inicial baseado no filtro de período
      let dataInicial: Date | null = null;
      const agora = new Date();

      switch (filtroData) {
        case 'hoje':
          dataInicial = new Date(agora);
          dataInicial.setHours(0, 0, 0, 0);
          break;
        case '7dias':
          dataInicial = new Date(agora);
          dataInicial.setDate(dataInicial.getDate() - 7);
          break;
        case '30dias':
          dataInicial = new Date(agora);
          dataInicial.setDate(dataInicial.getDate() - 30);
          break;
        case '90dias':
          dataInicial = new Date(agora);
          dataInicial.setDate(dataInicial.getDate() - 90);
          break;
        case 'todos':
        default:
          dataInicial = null;
          break;
      }

      // Intervalo de paginação no Supabase (range inclusivo)
      const fromIndex = (paginaAtual - 1) * ITENS_POR_PAGINA;
      const toIndex = fromIndex + ITENS_POR_PAGINA - 1;

      // Montar query com contagem exata e paginação no servidor
      let query = supabase
        .from('audit_logs')
        .select('*', { count: 'exact' })
        .order('data_criacao', { ascending: false })
        .order('id', { ascending: false })
        .range(fromIndex, toIndex);

      if (dataInicial) {
        query = query.gte('data_criacao', dataInicial.toISOString());
      }

      if (filtroAcao !== 'todos') {
        query = query.eq('acao', filtroAcao);
      }
      if (filtroModulo !== 'todos') {
        query = query.eq('modulo', filtroModulo);
      }
      if (filtroStatus !== 'todos') {
        query = query.eq('status', filtroStatus);
      }
      if (filtroUsuario.trim()) {
        query = query.ilike('usuario_email', `%${filtroUsuario.trim()}%`);
      }

      const { data, count, error: err } = await query;

      if (err) {
        if (err.code === 'PGRST116' || err.message?.includes('not found')) {
          const response = await fetch('/api/v1/create-audit-logs-table', {
            method: 'POST',
          });
          if (response.ok) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            await carregarLogs();
            return;
          }
        }
        setError('Erro ao carregar logs: ' + (err.message || 'Erro desconhecido'));
        return;
      }

      setLogs((data as AuditLog[]) || []);
      setTotalRegistros(count ?? 0);
    } catch (err) {
      console.error('Erro ao carregar logs:', err);
      setError('Erro ao carregar logs');
    } finally {
      setLoading(false);
    }
  }, [supabase, paginaAtual, filtroAcao, filtroModulo, filtroStatus, filtroData, filtroUsuario]);

  useEffect(() => {
    if (authLoading) return;
    carregarLogs();
  }, [authLoading, carregarLogs]);

  // Formatação de data/hora pt-BR (fuso local)
  const formatarDataHora = (dataStr: string | null | undefined) => {
    if (!dataStr) return '—';
    const d = new Date(dataStr);
    if (isNaN(d.getTime())) return dataStr;
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatarDataCompleta = (dataStr: string | null | undefined) => {
    if (!dataStr) return '—';
    const d = new Date(dataStr);
    if (isNaN(d.getTime())) return dataStr;
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const limparFiltros = () => {
    setFiltroAcao('todos');
    setFiltroModulo('todos');
    setFiltroStatus('todos');
    setFiltroData('7dias');
    setFiltroUsuario('');
    setPaginaAtual(1);
  };

  if (bloqueado || authLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-12">
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 text-[#1d4ed8] animate-spin mx-auto" />
          <p className="text-xs font-semibold text-slate-500">Carregando módulo de Auditoria...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* ── CABEÇALHO DO MÓDULO ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#1d4ed8] to-[#0f3460] text-white flex items-center justify-center shadow-md shadow-blue-500/10 shrink-0">
            <ClipboardList className="w-6 h-6 stroke-[2.2]" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              Auditoria e Logs
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              Rastreamento cronológico de ações, operações administrativas e conformidade
            </p>
          </div>
        </div>

        <button
          onClick={() => carregarLogs()}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 shadow-xs transition disabled:opacity-50 self-start sm:self-auto cursor-pointer"
          title="Recarregar logs"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
          <span>Atualizar</span>
        </button>
      </div>

      {/* ── ÁREA DE FILTROS ────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2 text-xs font-extrabold text-slate-800 uppercase tracking-wider">
            <Filter className="w-4 h-4 text-[#1d4ed8]" />
            <span>Filtros de Pesquisa</span>
          </div>

          {(filtroAcao !== 'todos' ||
            filtroModulo !== 'todos' ||
            filtroStatus !== 'todos' ||
            filtroData !== '7dias' ||
            filtroUsuario.trim() !== '') && (
            <button
              onClick={limparFiltros}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600 hover:text-rose-800 transition cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Limpar Filtros</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
          {/* 1. Ação */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Ação</label>
            <select
              value={filtroAcao}
              onChange={e => {
                setFiltroAcao(e.target.value);
                setPaginaAtual(1);
              }}
              className="w-full bg-slate-50/70 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1d4ed8]/20 focus:border-[#1d4ed8] transition"
            >
              <option value="todos">Todas as Ações</option>
              {ACOES_OPCOES.map(acao => (
                <option key={acao} value={acao}>
                  {acao.charAt(0).toUpperCase() + acao.slice(1).replace('_', ' ')}
                </option>
              ))}
            </select>
          </div>

          {/* 2. Módulo */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Módulo</label>
            <select
              value={filtroModulo}
              onChange={e => {
                setFiltroModulo(e.target.value);
                setPaginaAtual(1);
              }}
              className="w-full bg-slate-50/70 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1d4ed8]/20 focus:border-[#1d4ed8] transition"
            >
              <option value="todos">Todos os Módulos</option>
              {MODULOS_OPCOES.map(mod => (
                <option key={mod} value={mod}>
                  {mod.charAt(0).toUpperCase() + mod.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {/* 3. Status */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Status</label>
            <select
              value={filtroStatus}
              onChange={e => {
                setFiltroStatus(e.target.value);
                setPaginaAtual(1);
              }}
              className="w-full bg-slate-50/70 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1d4ed8]/20 focus:border-[#1d4ed8] transition"
            >
              <option value="todos">Todos os Status</option>
              {STATUS_OPCOES.map(st => (
                <option key={st} value={st}>
                  {st.charAt(0).toUpperCase() + st.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {/* 4. Período */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Período</label>
            <select
              value={filtroData}
              onChange={e => {
                setFiltroData(e.target.value);
                setPaginaAtual(1);
              }}
              className="w-full bg-slate-50/70 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1d4ed8]/20 focus:border-[#1d4ed8] transition"
            >
              <option value="hoje">Hoje</option>
              <option value="7dias">Últimos 7 dias</option>
              <option value="30dias">Últimos 30 dias</option>
              <option value="90dias">Últimos 90 dias</option>
              <option value="todos">Todos os períodos</option>
            </select>
          </div>

          {/* 5. Usuário */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Usuário</label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={filtroUsuario}
                onChange={e => {
                  setFiltroUsuario(e.target.value);
                  setPaginaAtual(1);
                }}
                placeholder="E-mail ou nome..."
                className="w-full bg-slate-50/70 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1d4ed8]/20 focus:border-[#1d4ed8] transition"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── MENSAGEM DE ERRO ────────────────────────────────────────────── */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 text-rose-800 text-xs">
          <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Ocorreu um erro</p>
            <p className="mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* ── TABELA DE AUDITORIA COMPACTA E RESPONSIVA ───────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[850px]">
            <thead>
              <tr className="bg-slate-50/90 border-b border-slate-200/90 text-[11px] font-bold text-slate-600 uppercase tracking-wider select-none">
                <th className="py-3 px-4 w-44">Data / Hora</th>
                <th className="py-3 px-4 w-36">Ação</th>
                <th className="py-3 px-4 w-44">Módulo / Área</th>
                <th className="py-3 px-4 w-52">Usuário</th>
                <th className="py-3 px-4">Descrição Resumida</th>
                <th className="py-3 px-4 w-28 text-center">Status</th>
                <th className="py-3 px-4 w-20 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Loader2 className="w-6 h-6 animate-spin text-[#1d4ed8]" />
                      <span className="text-xs font-medium">Carregando registros de auditoria...</span>
                    </div>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <ClipboardList className="w-10 h-10 text-slate-300 stroke-[1.5]" />
                      <p className="text-xs font-bold text-slate-700">Nenhum registro encontrado</p>
                      <p className="text-[11px] text-slate-400">Tente ajustar ou limpar os filtros de pesquisa acima.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                logs.map(log => {
                  const acaoInfo = getAcaoBadge(log.acao);
                  const statusInfo = getStatusBadge(log.status);
                  const IconeAcao = acaoInfo.icon;
                  const IconeStatus = statusInfo.icon;

                  return (
                    <tr
                      key={log.id}
                      onClick={() => setLogSelecionado(log)}
                      className="hover:bg-blue-50/40 transition-colors cursor-pointer group"
                    >
                      {/* 1. Data/Hora */}
                      <td className="py-3 px-4 align-middle font-medium text-slate-600 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-slate-700 font-semibold text-xs">
                          <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{formatarDataHora(log.data_criacao)}</span>
                        </div>
                      </td>

                      {/* 2. Ação */}
                      <td className="py-3 px-4 align-middle whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${acaoInfo.badgeClass}`}
                        >
                          <IconeAcao className="w-3 h-3 shrink-0" />
                          <span>{acaoInfo.label}</span>
                        </span>
                      </td>

                      {/* 3. Módulo / Área */}
                      <td className="py-3 px-4 align-middle">
                        <div className="space-y-0.5">
                          <span className="font-bold text-slate-800 capitalize block">
                            {log.modulo || 'Sistema'}
                          </span>
                          {log.area && (
                            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                              {log.area}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 4. Usuário */}
                      <td className="py-3 px-4 align-middle">
                        <div className="flex items-center gap-1.5 max-w-[200px]" title={log.usuario_email || 'Sistema'}>
                          <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate text-slate-700 font-medium text-xs">
                            {log.usuario_email || <em className="text-slate-400 not-italic">Sistema</em>}
                          </span>
                        </div>
                      </td>

                      {/* 5. Descrição resumida */}
                      <td className="py-3 px-4 align-middle max-w-xs md:max-w-md">
                        <p
                          className="truncate text-slate-600 font-normal leading-relaxed text-xs"
                          title={log.descricao || ''}
                        >
                          {log.descricao || '—'}
                        </p>
                      </td>

                      {/* 6. Status */}
                      <td className="py-3 px-4 align-middle text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${statusInfo.badgeClass}`}
                        >
                          <IconeStatus className="w-3 h-3 shrink-0" />
                          <span>{statusInfo.label}</span>
                        </span>
                      </td>

                      {/* 7. Ações */}
                      <td className="py-3 px-4 align-middle text-center" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => setLogSelecionado(log)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-[#1d4ed8] hover:bg-blue-50 border border-slate-200/80 transition cursor-pointer"
                          title="Visualizar detalhes do log"
                          aria-label="Visualizar detalhes do log"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ── FOOTER DE PAGINAÇÃO DA TABELA ─────────────────────────────── */}
        <div className="px-5 py-3.5 bg-slate-50/80 border-t border-slate-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-500 font-medium select-none">
          <div>
            Mostrando{' '}
            <span className="font-bold text-slate-800">
              {totalRegistros === 0 ? 0 : (paginaAtual - 1) * ITENS_POR_PAGINA + 1}
            </span>{' '}
            a{' '}
            <span className="font-bold text-slate-800">
              {Math.min(paginaAtual * ITENS_POR_PAGINA, totalRegistros)}
            </span>{' '}
            de <span className="font-bold text-slate-800">{totalRegistros}</span> registros
          </div>

          <div className="flex items-center gap-1 self-center sm:self-auto">
            {/* Primeira Página */}
            <button
              onClick={() => setPaginaAtual(1)}
              disabled={paginaAtual <= 1 || loading}
              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition cursor-pointer"
              title="Primeira página"
              aria-label="Primeira página"
            >
              <ChevronsLeft className="w-3.5 h-3.5" />
            </button>

            {/* Página Anterior */}
            <button
              onClick={() => setPaginaAtual(p => Math.max(1, p - 1))}
              disabled={paginaAtual <= 1 || loading}
              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition cursor-pointer"
              title="Página anterior"
              aria-label="Página anterior"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            {/* Indicador Numérico de Páginas */}
            <div className="px-3 py-1 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-lg">
              Página {paginaAtual} de {totalPaginas}
            </div>

            {/* Próxima Página */}
            <button
              onClick={() => setPaginaAtual(p => Math.min(totalPaginas, p + 1))}
              disabled={paginaAtual >= totalPaginas || loading}
              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition cursor-pointer"
              title="Próxima página"
              aria-label="Próxima página"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>

            {/* Última Página */}
            <button
              onClick={() => setPaginaAtual(totalPaginas)}
              disabled={paginaAtual >= totalPaginas || loading}
              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition cursor-pointer"
              title="Última página"
              aria-label="Última página"
            >
              <ChevronsRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ── MODAL DE DETALHES DO REGISTRO ──────────────────────────────── */}
      {logSelecionado && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setLogSelecionado(null)}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
          >
            {/* Header Fixo */}
            <div className="px-6 py-4.5 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-[#1d4ed8] flex items-center justify-center shrink-0">
                  <ClipboardList className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Detalhes do Registro de Auditoria
                  </h3>
                  <p className="text-[11px] font-mono text-slate-400 truncate max-w-xs sm:max-w-md">
                    ID: {logSelecionado.id}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${getStatusBadge(logSelecionado.status).badgeClass}`}
                >
                  {getStatusBadge(logSelecionado.status).label}
                </span>

                <button
                  onClick={() => setLogSelecionado(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition cursor-pointer"
                  title="Fechar"
                  aria-label="Fechar modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Conteúdo com Scroll */}
            <div className="p-6 space-y-5 overflow-y-auto flex-1 text-xs text-slate-700">
              {/* Informações Principais */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 bg-slate-50/70 p-4 rounded-xl border border-slate-200/80">
                <div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                    Data e Horário
                  </span>
                  <div className="flex items-center gap-1.5 font-bold text-slate-800">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>{formatarDataCompleta(logSelecionado.data_criacao)}</span>
                  </div>
                </div>

                <div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                    Usuário Responsável
                  </span>
                  <div className="flex items-center gap-1.5 font-bold text-slate-800 truncate" title={logSelecionado.usuario_email || ''}>
                    <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{logSelecionado.usuario_email || 'Sistema Automático'}</span>
                  </div>
                </div>

                <div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                    Ação Executada
                  </span>
                  <div className="mt-1">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${getAcaoBadge(logSelecionado.acao).badgeClass}`}
                    >
                      <span>{getAcaoBadge(logSelecionado.acao).label}</span>
                    </span>
                  </div>
                </div>

                <div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                    Módulo / Área
                  </span>
                  <span className="font-bold text-slate-800 capitalize">
                    {logSelecionado.modulo} {logSelecionado.area ? `· ${logSelecionado.area}` : ''}
                  </span>
                </div>
              </div>

              {/* Descrição Completa */}
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-slate-900 block">
                  Descrição da Operação
                </span>
                <div className="bg-white border border-slate-200 rounded-xl p-3.5 text-slate-800 leading-relaxed whitespace-pre-wrap font-medium">
                  {logSelecionado.descricao || 'Nenhuma descrição detalhada registrada para esta operação.'}
                </div>
              </div>

              {/* Mensagem de Erro (se houver) */}
              {logSelecionado.mensagem_erro && (
                <div className="space-y-1.5">
                  <span className="text-xs font-bold text-rose-800 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                    <span>Mensagem de Erro Registrada</span>
                  </span>
                  <div className="bg-rose-50 border border-rose-200 text-rose-900 rounded-xl p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
                    {String(sanitizarDadosSensiveis(logSelecionado.mensagem_erro))}
                  </div>
                </div>
              )}

              {/* Dados Técnicos e Rastreabilidade */}
              <div className="space-y-2 border-t border-slate-100 pt-4">
                <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-slate-500" />
                  <span>Rastreabilidade Técnica</span>
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px] bg-slate-50/50 p-3.5 rounded-xl border border-slate-100">
                  <div>
                    <span className="text-slate-400 block font-semibold">Tabela Afetada:</span>
                    <span className="font-mono text-slate-700 font-bold">
                      {logSelecionado.tabela_afetada || '—'}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block font-semibold">ID do Registro Afetado:</span>
                    <span className="font-mono text-slate-700 truncate block">
                      {logSelecionado.registro_id || '—'}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block font-semibold flex items-center gap-1">
                      <Globe className="w-3 h-3 text-slate-400" /> Endereço IP:
                    </span>
                    <span className="font-mono text-slate-700">
                      {logSelecionado.ip_address || '—'}
                    </span>
                  </div>

                  <div className="sm:col-span-2">
                    <span className="text-slate-400 block font-semibold">Agente / Navegador:</span>
                    <span className="text-slate-600 break-all text-[10px]">
                      {logSelecionado.user_agent || '—'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Dados Anteriores e Dados Novos (Payload Sanitizado) */}
              {(logSelecionado.dados_novos || logSelecionado.dados_anteriores) && (
                <div className="space-y-3 border-t border-slate-100 pt-4">
                  <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-slate-500" />
                    <span>Registro de Modificações (Sanitizado)</span>
                  </span>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {logSelecionado.dados_anteriores && (
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          Dados Anteriores
                        </span>
                        <pre className="p-3 rounded-xl bg-slate-900 text-slate-100 font-mono text-[10px] overflow-x-auto max-h-48 leading-relaxed">
                          {JSON.stringify(sanitizarDadosSensiveis(logSelecionado.dados_anteriores), null, 2)}
                        </pre>
                      </div>
                    )}

                    {logSelecionado.dados_novos && (
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          Dados Novos
                        </span>
                        <pre className="p-3 rounded-xl bg-slate-900 text-emerald-300 font-mono text-[10px] overflow-x-auto max-h-48 leading-relaxed">
                          {JSON.stringify(sanitizarDadosSensiveis(logSelecionado.dados_novos), null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer Fixo */}
            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
              <button
                onClick={() => setLogSelecionado(null)}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-[#0f3460] hover:bg-[#162a47] transition shadow-xs cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
