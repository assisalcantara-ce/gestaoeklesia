'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Cross,
  Baby,
  Heart,
  Award,
  Printer,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import type { BaptismsAndActsStats } from '@/services/secretary-reports-service';
import ReportPrintHeader from './ReportPrintHeader';

interface BaptismsAndActsReportTabProps {
  initialStats: BaptismsAndActsStats;
  congregacaoId?: string | null;
  congregacaoNome?: string | null;
}

type TipoAto = 'batismos' | 'apresentacoes' | 'casamentos' | 'consagracoes';

export default function BaptismsAndActsReportTab({
  initialStats,
  congregacaoId,
  congregacaoNome,
}: BaptismsAndActsReportTabProps) {
  const [tipoAto, setTipoAto] = useState<TipoAto>('batismos');
  const [yearFilter, setYearFilter] = useState(() => String(new Date().getFullYear()));
  const [statusFilter, setStatusFilter] = useState('todos');

  // Estado da lista
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const fetchActs = useCallback(async () => {
    setLoading(true);
    try {
      const url = new URL('/api/v1/secretaria/relatorios/acts', window.location.origin);
      url.searchParams.set('tipoAto', tipoAto);
      if (yearFilter !== 'todos') url.searchParams.set('year', yearFilter);
      if (statusFilter !== 'todos') url.searchParams.set('status', statusFilter);
      if (congregacaoId && congregacaoId !== 'todas') url.searchParams.set('congregacao_id', congregacaoId);
      url.searchParams.set('page', String(page));
      url.searchParams.set('limit', String(limit));

      const res = await fetch(url.toString(), { headers: { 'Cache-Control': 'no-cache' } });
      const json = await res.json();
      if (json.success) {
        setItems(json.data || []);
        setTotal(json.total || 0);
        setTotalPages(json.totalPages || 1);
      }
    } catch (err) {
      console.error('Erro ao consultar atos eclesiásticos:', err);
    } finally {
      setLoading(false);
    }
  }, [tipoAto, yearFilter, statusFilter, congregacaoId, page, limit]);

  useEffect(() => {
    fetchActs();
  }, [fetchActs]);

  const stats = initialStats;
  const currentYear = new Date().getFullYear();
  const yearsOptions = [currentYear, currentYear - 1, currentYear - 2, currentYear - 3];

  const getSubtitulo = () => {
    const anoTxt = yearFilter === 'todos' ? 'Histórico Completo' : `Ano ${yearFilter}`;
    if (tipoAto === 'batismos') return `Relatório de Batismos nas Águas (${anoTxt})`;
    if (tipoAto === 'apresentacoes') return `Relatório de Apresentação de Crianças (${anoTxt})`;
    if (tipoAto === 'casamentos') return `Relatório de Casamentos e Bênçãos Matrimoniais (${anoTxt})`;
    return `Relatório de Processos de Consagração Ministerial (${anoTxt})`;
  };

  return (
    <div className="space-y-6">
      {/* ─── CABEÇALHO OFICIAL DE IMPRESSÃO A4 (hidden em tela, visível em print) ─── */}
      <ReportPrintHeader
        title={getSubtitulo()}
        periodoOuData={yearFilter === 'todos' ? 'Todos os Anos' : `Exercício ${yearFilter}`}
        congregacaoNome={congregacaoNome}
      />

      {/* ─── CARDS DE ATOS PASTORAIS CONSOLIDADOS ────────────────────────────── */}
      <div>
        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3 flex items-center gap-2 print:hidden">
          <Award className="w-4 h-4 text-[#123b63]" />
          Indicadores Anuais de Atos Pastorais e Sacramentos
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl border border-teal-200 bg-teal-50/40 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-teal-800">
                Batismos Realizados
              </span>
              <div className="w-8 h-8 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center">
                <Cross className="w-4 h-4" />
              </div>
            </div>
            <p className="text-3xl font-extrabold text-teal-700 mt-2">{stats.batismos.batizados}</p>
            <p className="text-xs text-teal-600 mt-1">
              {stats.batismos.registrados} agendados / a realizar
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-pink-200 bg-pink-50/40 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-pink-800">
                Apresentação de Crianças
              </span>
              <div className="w-8 h-8 rounded-lg bg-pink-100 text-pink-700 flex items-center justify-center">
                <Baby className="w-4 h-4" />
              </div>
            </div>
            <p className="text-3xl font-extrabold text-pink-700 mt-2">{stats.apresentacoesCriancas.apresentadas}</p>
            <p className="text-xs text-pink-600 mt-1">
              {stats.apresentacoesCriancas.agendadas} agendadas
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-rose-200 bg-rose-50/40 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-rose-800">
                Casamentos Realizados
              </span>
              <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center">
                <Heart className="w-4 h-4" />
              </div>
            </div>
            <p className="text-3xl font-extrabold text-rose-700 mt-2">{stats.casamentos.realizados}</p>
            <p className="text-xs text-rose-600 mt-1">
              {stats.casamentos.registrados} agendados
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-purple-200 bg-purple-50/40 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-purple-800">
                Consagrações Concluídas
              </span>
              <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center">
                <Award className="w-4 h-4" />
              </div>
            </div>
            <p className="text-3xl font-extrabold text-purple-700 mt-2">{stats.consagracoes.concluidas}</p>
            <p className="text-xs text-purple-600 mt-1">
              {stats.consagracoes.emProcesso} em processo
            </p>
          </div>
        </div>
      </div>

      {/* ─── CONTROLES DE SUBNAVEGAÇÃO E FILTROS ─────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm print:hidden space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl flex-wrap">
            <button
              onClick={() => {
                setTipoAto('batismos');
                setStatusFilter('todos');
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                tipoAto === 'batismos'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Batismos ({stats.batismos.total})
            </button>

            <button
              onClick={() => {
                setTipoAto('apresentacoes');
                setStatusFilter('todos');
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                tipoAto === 'apresentacoes'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Apresentações ({stats.apresentacoesCriancas.total})
            </button>

            <button
              onClick={() => {
                setTipoAto('casamentos');
                setStatusFilter('todos');
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                tipoAto === 'casamentos'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Casamentos ({stats.casamentos.total})
            </button>

            <button
              onClick={() => {
                setTipoAto('consagracoes');
                setStatusFilter('todos');
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                tipoAto === 'consagracoes'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Consagrações ({stats.consagracoes.total})
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
              href={
                tipoAto === 'batismos'
                  ? '/secretaria/batismo-aguas'
                  : tipoAto === 'apresentacoes'
                  ? '/secretaria/apresentacao-criancas'
                  : tipoAto === 'casamentos'
                  ? '/secretaria/casamento'
                  : '/secretaria/consagracao'
              }
              className="flex items-center gap-1 px-3 py-1.5 bg-[#123b63] hover:bg-[#0e2f50] text-white text-xs font-semibold rounded-lg transition"
            >
              Gerenciar Módulo
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* Filtros da Tabela */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100 text-xs">
          <select
            value={yearFilter}
            onChange={(e) => {
              setYearFilter(e.target.value);
              setPage(1);
            }}
            className="border border-gray-200 rounded-lg px-2.5 py-1.5 bg-gray-50 text-gray-700"
          >
            <option value="todos">Todos os Anos</option>
            {yearsOptions.map((y) => (
              <option key={y} value={String(y)}>
                Ano {y}
              </option>
            ))}
          </select>

          {tipoAto === 'batismos' && (
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="border border-gray-200 rounded-lg px-2.5 py-1.5 bg-gray-50 text-gray-700"
            >
              <option value="todos">Todos os Status</option>
              <option value="batizado">Batizado</option>
              <option value="registrado">Registrado / A Realizar</option>
              <option value="cancelado">Cancelado</option>
            </select>
          )}

          {tipoAto === 'apresentacoes' && (
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="border border-gray-200 rounded-lg px-2.5 py-1.5 bg-gray-50 text-gray-700"
            >
              <option value="todos">Todos os Status</option>
              <option value="apresentado">Apresentado</option>
              <option value="agendado">Agendado</option>
              <option value="cancelado">Cancelado</option>
            </select>
          )}
        </div>
      </div>

      {/* ─── TABELA DE ATOS ECLESIÁSTICOS ────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden print:border-none print:shadow-none print:rounded-none">
        {loading ? (
          <div className="py-16 text-center text-gray-400">
            <div className="w-8 h-8 rounded-full border-3 border-[#123b63] border-t-transparent animate-spin mx-auto mb-2" />
            <p className="text-xs">Consultando atos eclesiásticos...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <Award className="w-10 h-10 mx-auto text-gray-300 mb-2 stroke-1" />
            <p className="text-sm font-medium text-gray-500">
              Nenhum ato registrado encontrado para os filtros selecionados.
            </p>
          </div>
        ) : tipoAto === 'batismos' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-200 text-gray-500 uppercase tracking-wider font-semibold print:bg-gray-100 print:text-black">
                  <th className="py-3 px-4">Candidato</th>
                  <th className="py-3 px-4">Data do Batismo</th>
                  <th className="py-3 px-4">Local</th>
                  <th className="py-3 px-4">Pastor Oficiante</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Certificado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((b) => (
                  <tr key={b.id} className="hover:bg-gray-50/80 transition-colors print:break-inside-avoid">
                    <td className="py-3 px-4 font-semibold text-gray-900">{b.candidato_nome}</td>
                    <td className="py-3 px-4 whitespace-nowrap text-gray-600">
                      {b.data_batismo ? new Date(b.data_batismo + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}
                    </td>
                    <td className="py-3 px-4 text-gray-600">{b.local_batismo || '—'}</td>
                    <td className="py-3 px-4 text-gray-600">{b.pastor_nome || '—'}</td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          b.status === 'batizado'
                            ? 'bg-emerald-100 text-emerald-800'
                            : b.status === 'registrado'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {b.status === 'batizado' ? 'Batizado' : b.status === 'registrado' ? 'Registrado' : 'Cancelado'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-500 text-[11px]">
                      {b.certificado_emitido_em ? 'Emitido ✅' : 'Pendente'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : tipoAto === 'apresentacoes' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-200 text-gray-500 uppercase tracking-wider font-semibold print:bg-gray-100 print:text-black">
                  <th className="py-3 px-4">Criança</th>
                  <th className="py-3 px-4">Data Apresentação</th>
                  <th className="py-3 px-4">Filiação (Pais)</th>
                  <th className="py-3 px-4">Local</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50/80 transition-colors print:break-inside-avoid">
                    <td className="py-3 px-4 font-semibold text-gray-900">{c.crianca_nome}</td>
                    <td className="py-3 px-4 whitespace-nowrap text-gray-600">
                      {c.data_apresentacao ? new Date(c.data_apresentacao + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}
                    </td>
                    <td className="py-3 px-4 text-gray-600">
                      {c.pai_nome && c.mae_nome ? `${c.pai_nome} e ${c.mae_nome}` : c.pai_nome || c.mae_nome || c.responsavel_nome || '—'}
                    </td>
                    <td className="py-3 px-4 text-gray-600">{c.local_apresentacao || '—'}</td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-pink-100 text-pink-800">
                        {c.status === 'apresentado' ? 'Apresentado' : c.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : tipoAto === 'casamentos' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-200 text-gray-500 uppercase tracking-wider font-semibold print:bg-gray-100 print:text-black">
                  <th className="py-3 px-4">Noivos / Cônjuges</th>
                  <th className="py-3 px-4">Data do Casamento</th>
                  <th className="py-3 px-4">Tipo</th>
                  <th className="py-3 px-4">Pastor</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((cs) => (
                  <tr key={cs.id} className="hover:bg-gray-50/80 transition-colors print:break-inside-avoid">
                    <td className="py-3 px-4 font-semibold text-gray-900">
                      {cs.conjuge1_nome} & {cs.conjuge2_nome}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-gray-600">
                      {cs.data_casamento ? new Date(cs.data_casamento + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}
                    </td>
                    <td className="py-3 px-4 text-gray-600 capitalize">{cs.tipo_casamento || 'Religioso'}</td>
                    <td className="py-3 px-4 text-gray-600">{cs.pastor_nome || '—'}</td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-100 text-rose-800">
                        {cs.status === 'realizado' ? 'Realizado' : cs.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-200 text-gray-500 uppercase tracking-wider font-semibold print:bg-gray-100 print:text-black">
                  <th className="py-3 px-4">Candidato(a)</th>
                  <th className="py-3 px-4">Cargo Ocupado</th>
                  <th className="py-3 px-4">Cargo Pretendido</th>
                  <th className="py-3 px-4">Data Processo</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((cg) => (
                  <tr key={cg.id} className="hover:bg-gray-50/80 transition-colors print:break-inside-avoid">
                    <td className="py-3 px-4 font-semibold text-gray-900">{cg.nome}</td>
                    <td className="py-3 px-4 text-gray-600">{cg.cargo_ocupa || '—'}</td>
                    <td className="py-3 px-4 text-gray-800 font-medium">{cg.cargo_pretendido || '—'}</td>
                    <td className="py-3 px-4 whitespace-nowrap text-gray-600">
                      {cg.data_processo ? new Date(cg.data_processo + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-100 text-purple-800">
                        {cg.status_processo}
                      </span>
                    </td>
                  </tr>
                ))}
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
