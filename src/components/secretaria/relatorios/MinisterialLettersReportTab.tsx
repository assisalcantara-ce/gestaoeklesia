'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  MailCheck,
  FileText,
  Printer,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import type { LettersStats } from '@/services/secretary-reports-service';
import { authenticatedFetch } from '@/lib/api-client';
import ReportPrintHeader from './ReportPrintHeader';

interface MinisterialLettersReportTabProps {
  initialLettersStats: LettersStats;
  congregacaoId?: string | null;
  congregacaoNome?: string | null;
}

const TIPO_CARTA_LABELS: Record<string, string> = {
  mudanca: 'Carta de Mudança',
  transito: 'Carta de Trânsito',
  desligamento: 'Carta de Desligamento',
  recomendacao: 'Carta de Recomendação',
  custom: 'Personalizada',
};

const STATUS_PEDIDO_CONFIG: Record<string, { label: string; badge: string }> = {
  pendente: { label: 'Pendente', badge: 'bg-amber-100 text-amber-800 border-amber-200' },
  autorizado: { label: 'Autorizado', badge: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  rejeitado: { label: 'Rejeitado', badge: 'bg-red-100 text-red-800 border-red-200' },
};

export default function MinisterialLettersReportTab({
  initialLettersStats,
  congregacaoId,
  congregacaoNome,
}: MinisterialLettersReportTabProps) {
  const [subAba, setSubAba] = useState<'pedidos' | 'emitidas'>('emitidas');

  // Estado da lista
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Filtros
  const [statusFilter, setStatusFilter] = useState('todos');
  const [tipoCartaFilter, setTipoCartaFilter] = useState('todos');
  const [categoriaFilter, setCategoriaFilter] = useState<'todos' | 'carta' | 'declaracao'>('todos');
  const [currentStats, setCurrentStats] = useState<LettersStats>(initialLettersStats);

  const fetchLetters = useCallback(async () => {
    setLoading(true);
    try {
      const url = new URL('/api/v1/secretaria/relatorios/letters', window.location.origin);
      url.searchParams.set('tipoConsulta', subAba);
      if (statusFilter !== 'todos') url.searchParams.set('status', statusFilter);
      if (tipoCartaFilter !== 'todos') url.searchParams.set('tipoCarta', tipoCartaFilter);
      if (categoriaFilter !== 'todos') url.searchParams.set('categoria', categoriaFilter);
      if (congregacaoId && congregacaoId !== 'todas') url.searchParams.set('congregacao_id', congregacaoId);
      url.searchParams.set('page', String(page));
      url.searchParams.set('limit', String(limit));

      const res = await authenticatedFetch(url.toString(), { headers: { 'Cache-Control': 'no-cache' } });
      const json = await res.json();
      if (json.success) {
        setItems(json.data || []);
        setTotal(json.total || 0);
        setTotalPages(json.totalPages || 1);
        if (json.stats) {
          setCurrentStats(json.stats);
        }
      }
    } catch (err) {
      console.error('Erro ao consultar cartas e declarações:', err);
    } finally {
      setLoading(false);
    }
  }, [subAba, statusFilter, tipoCartaFilter, categoriaFilter, congregacaoId, page, limit]);

  useEffect(() => {
    fetchLetters();
  }, [fetchLetters]);

  const stats = currentStats || initialLettersStats;
  const totalEmitidos = stats.registrosEmitidos?.total || 0;
  const cartasEmitidas = stats.registrosEmitidos?.cartasEmitidas ?? (stats.registrosEmitidos?.emitidas || 0);
  const declaracoesEmitidas = stats.registrosEmitidos?.declaracoesEmitidas ?? 0;

  return (
    <div className="space-y-6">
      {/* ─── CABEÇALHO OFICIAL DE IMPRESSÃO A4 (hidden em tela, visível em print) ─── */}
      <ReportPrintHeader
        title={subAba === 'pedidos' ? 'Relatório de Solicitações de Cartas Ministeriais' : 'Relação Oficial de Documentos Emitidos (Cartas e Declarações)'}
        periodoOuData={`Posição em ${new Date().toLocaleDateString('pt-BR')}`}
        congregacaoNome={congregacaoNome}
      />

      {/* ─── CARDS DE INDICADORES: DOCUMENTOS EMITIDOS & PEDIDOS DE CARTAS ────── */}
      <div className="space-y-4">
        {/* Seção 1: Documentos Emitidos */}
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2.5 flex items-center gap-2 print:hidden">
            <FileText className="w-4 h-4 text-teal-700" />
            Documentos Emitidos (Consolidado)
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Total de Documentos
              </span>
              <p className="text-2xl font-extrabold text-[#123b63] mt-1.5">{totalEmitidos}</p>
              <p className="text-[11px] text-gray-500 mt-0.5">Cartas e Declarações emitidas</p>
            </div>

            <div className="bg-white rounded-2xl border border-blue-200 bg-blue-50/40 p-4 shadow-sm">
              <span className="text-xs font-semibold uppercase tracking-wider text-blue-800 flex items-center gap-1.5">
                <span>📜</span> Cartas Emitidas
              </span>
              <p className="text-2xl font-extrabold text-blue-700 mt-1.5">{cartasEmitidas}</p>
              <p className="text-[11px] text-blue-600 mt-0.5">Cartas ministeriais finalizadas</p>
            </div>

            <div className="bg-white rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 shadow-sm">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                <span>📄</span> Declarações Emitidas
              </span>
              <p className="text-2xl font-extrabold text-emerald-700 mt-1.5">{declaracoesEmitidas}</p>
              <p className="text-[11px] text-emerald-600 mt-0.5">Declarações oficiais diretas</p>
            </div>
          </div>
        </div>

        {/* Seção 2: Pedidos de Cartas Ministeriais (Exclusivo para Cartas) */}
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2.5 flex items-center gap-2 print:hidden">
            <MailCheck className="w-4 h-4 text-amber-700" />
            Solicitações / Pedidos de Cartas Ministeriais
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Total de Pedidos
              </span>
              <p className="text-2xl font-extrabold text-[#123b63] mt-1.5">{stats.pedidos?.total || 0}</p>
              <p className="text-[11px] text-gray-500 mt-0.5">Pedidos registrados</p>
            </div>

            <div className="bg-white rounded-2xl border border-amber-200 bg-amber-50/40 p-4 shadow-sm">
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-800">
                Aguardando Autorização
              </span>
              <p className="text-2xl font-extrabold text-amber-600 mt-1.5">{stats.pedidos?.pendentes || 0}</p>
              <p className="text-[11px] text-amber-700 mt-0.5">Pendentes de deferimento</p>
            </div>

            <div className="bg-white rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 shadow-sm">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-800">
                Pedidos Autorizados
              </span>
              <p className="text-2xl font-extrabold text-emerald-600 mt-1.5">{stats.pedidos?.autorizados || 0}</p>
              <p className="text-[11px] text-emerald-700 mt-0.5">Aprovados pela liderança</p>
            </div>

            <div className="bg-white rounded-2xl border border-red-200 bg-red-50/40 p-4 shadow-sm">
              <span className="text-xs font-semibold uppercase tracking-wider text-red-800">
                Pedidos Rejeitados
              </span>
              <p className="text-2xl font-extrabold text-red-600 mt-1.5">{stats.pedidos?.rejeitados || 0}</p>
              <p className="text-[11px] text-red-700 mt-0.5">Indeferidos</p>
            </div>
          </div>
        </div>
      </div>

      {/* ─── CONTROLES DE SUBNAVEGAÇÃO E FILTROS ─────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm print:hidden space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl">
            <button
              onClick={() => {
                setSubAba('emitidas');
                setPage(1);
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                subAba === 'emitidas'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <span>📄</span>
              <span>Documentos Emitidos ({totalEmitidos})</span>
            </button>

            <button
              onClick={() => {
                setSubAba('pedidos');
                setPage(1);
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                subAba === 'pedidos'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <span>✉️</span>
              <span>Pedidos de Cartas ({stats.pedidos?.total || 0})</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg transition"
            >
              <Printer className="w-3.5 h-3.5" />
              Imprimir A4
            </button>

            <Link
              href="/secretaria/cartas"
              className="flex items-center gap-1 px-3 py-1.5 bg-[#123b63] hover:bg-[#0e2f50] text-white text-xs font-semibold rounded-lg transition"
            >
              Emitir / Modelos
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* Filtros da Tabela de Documentos Emitidos */}
        {subAba === 'emitidas' && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100 text-xs">
            <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-lg border border-gray-200">
              <span className="text-[11px] font-bold text-gray-500 uppercase px-1.5">Categoria:</span>
              <button
                type="button"
                onClick={() => {
                  setCategoriaFilter('todos');
                  setPage(1);
                }}
                className={`px-2.5 py-1 rounded text-xs font-semibold transition ${
                  categoriaFilter === 'todos'
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Todas ({totalEmitidos})
              </button>
              <button
                type="button"
                onClick={() => {
                  setCategoriaFilter('carta');
                  setPage(1);
                }}
                className={`px-2.5 py-1 rounded text-xs font-semibold transition flex items-center gap-1 ${
                  categoriaFilter === 'carta'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-blue-700 hover:bg-blue-50'
                }`}
              >
                <span>📜</span> Cartas ({cartasEmitidas})
              </button>
              <button
                type="button"
                onClick={() => {
                  setCategoriaFilter('declaracao');
                  setPage(1);
                }}
                className={`px-2.5 py-1 rounded text-xs font-semibold transition flex items-center gap-1 ${
                  categoriaFilter === 'declaracao'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-emerald-700 hover:bg-emerald-50'
                }`}
              >
                <span>📄</span> Declarações ({declaracoesEmitidas})
              </button>
            </div>

            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="border border-gray-200 rounded-lg px-2.5 py-1.5 bg-gray-50 text-gray-700"
            >
              <option value="todos">Todos os Status</option>
              <option value="emitida">Emitida</option>
              <option value="cancelada">Cancelada</option>
            </select>
          </div>
        )}

        {/* Filtros da Tabela de Pedidos */}
        {subAba === 'pedidos' && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100 text-xs">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="border border-gray-200 rounded-lg px-2.5 py-1.5 bg-gray-50 text-gray-700"
            >
              <option value="todos">Todos os Status</option>
              <option value="pendente">Pendente</option>
              <option value="autorizado">Autorizado</option>
              <option value="rejeitado">Rejeitado</option>
            </select>

            <select
              value={tipoCartaFilter}
              onChange={(e) => {
                setTipoCartaFilter(e.target.value);
                setPage(1);
              }}
              className="border border-gray-200 rounded-lg px-2.5 py-1.5 bg-gray-50 text-gray-700"
            >
              <option value="todos">Todos os Tipos de Carta</option>
              <option value="mudanca">Mudança</option>
              <option value="transito">Trânsito</option>
              <option value="desligamento">Desligamento</option>
              <option value="recomendacao">Recomendação</option>
            </select>
          </div>
        )}
      </div>

      {/* ─── TABELA DE DOCUMENTOS EMITIDOS / SOLICITAÇÕES ─────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden print:border-none print:shadow-none print:rounded-none">
        {loading ? (
          <div className="py-16 text-center text-gray-400">
            <div className="w-8 h-8 rounded-full border-3 border-[#123b63] border-t-transparent animate-spin mx-auto mb-2" />
            <p className="text-xs">Consultando registros...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <MailCheck className="w-10 h-10 mx-auto text-gray-300 mb-2 stroke-1" />
            <p className="text-sm font-medium text-gray-500">
              Nenhum registro encontrado para os filtros selecionados.
            </p>
          </div>
        ) : subAba === 'pedidos' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-200 text-gray-500 uppercase tracking-wider font-semibold print:bg-gray-100 print:text-black">
                  <th className="py-3 px-4">Data Pedido</th>
                  <th className="py-3 px-4">Membro Solicitante</th>
                  <th className="py-3 px-4">Tipo de Carta</th>
                  <th className="py-3 px-4">Destino</th>
                  <th className="py-3 px-4">Congregação</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Autorização</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((p) => {
                  const statusConf = STATUS_PEDIDO_CONFIG[p.status] || {
                    label: p.status,
                    badge: 'bg-gray-100 text-gray-700',
                  };
                  return (
                    <tr key={p.id} className="hover:bg-gray-50/80 transition-colors print:break-inside-avoid">
                      <td className="py-3 px-4 whitespace-nowrap text-gray-600">
                        {p.created_at ? new Date(p.created_at).toLocaleDateString('pt-BR') : '—'}
                      </td>
                      <td className="py-3 px-4 font-semibold text-gray-900">
                        {p.membro_nome}
                      </td>
                      <td className="py-3 px-4 text-gray-600 whitespace-nowrap">
                        {TIPO_CARTA_LABELS[p.tipo_carta] || p.tipo_carta}
                      </td>
                      <td className="py-3 px-4 text-gray-600">
                        {p.destino || '—'}
                      </td>
                      <td className="py-3 px-4 text-gray-600">
                        {p.congregacao_nome || 'Sede / Principal'}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${statusConf.badge}`}>
                          {statusConf.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-500 whitespace-nowrap">
                        {p.data_autorizacao ? new Date(p.data_autorizacao).toLocaleDateString('pt-BR') : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-200 text-gray-500 uppercase tracking-wider font-semibold print:bg-gray-100 print:text-black">
                  <th className="py-3 px-4">Categoria</th>
                  <th className="py-3 px-4">Título do Documento</th>
                  <th className="py-3 px-4">Membro</th>
                  <th className="py-3 px-4">Congregação</th>
                  <th className="py-3 px-4">Data Emissão</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((r) => {
                  const isDeclaracao = r.categoria === 'declaracao';
                  return (
                    <tr key={r.id} className="hover:bg-gray-50/80 transition-colors print:break-inside-avoid">
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                            isDeclaracao
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : 'bg-blue-50 text-blue-800 border-blue-200'
                          }`}
                        >
                          {isDeclaracao ? '📄 Declaração' : '📜 Carta'}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-semibold text-gray-900">
                        {r.template_title}
                      </td>
                      <td className="py-3 px-4 text-gray-700">
                        {r.membro_nome}
                      </td>
                      <td className="py-3 px-4 text-gray-600">
                        {r.congregacao_nome || 'Sede / Principal'}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-gray-600">
                        {r.issued_at ? new Date(r.issued_at).toLocaleDateString('pt-BR') : '—'}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                          {r.status === 'emitida' ? 'Emitida' : r.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginação */}
        <div className="p-4 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:hidden">
          <p className="text-xs text-gray-500">
            Exibindo <span className="font-semibold text-gray-800">{items.length}</span> de{' '}
            <span className="font-semibold text-gray-800">{total}</span> registros
          </p>

          <div className="flex items-center gap-2 self-center sm:self-auto">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="text-xs font-semibold text-gray-700 px-2">
              Página {page} de {totalPages}
            </span>

            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
