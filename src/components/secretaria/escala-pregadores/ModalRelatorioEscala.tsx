'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  X,
  FileText,
  Download,
  Calendar,
  Church,
  Filter,
  AlertCircle,
} from 'lucide-react';
import { AgendaEventoComEscala } from '@/hooks/secretaria/useEscalaPregadores';
import { formatHoraLocal, getLocalDateStr } from '@/lib/timezone-utils';
import { MESES_NOMES } from './EscalaFiltrosBar';

interface ModalRelatorioEscalaProps {
  aberto: boolean;
  eventos: AgendaEventoComEscala[];
  congregacoes: { id: string; nome: string; is_sede?: boolean }[];
  anoMesAtual: string;
  churchIdAtual: string;
  isGlobalUser: boolean;
  onFechar: () => void;
}

export function ModalRelatorioEscala({
  aberto,
  eventos: _eventosPagina,
  congregacoes,
  anoMesAtual,
  churchIdAtual,
  isGlobalUser,
  onFechar,
}: ModalRelatorioEscalaProps) {
  const [tipoPeriodo, setTipoPeriodo] = useState<'mes' | 'semana'>('mes');
  
  // Inicialização padrão com o fuso America/Belem
  const anoMesPadrao = useMemo(() => {
    if (anoMesAtual && anoMesAtual.includes('-')) return anoMesAtual;
    const todayBelem = getLocalDateStr(new Date());
    return todayBelem ? todayBelem.substring(0, 7) : `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  }, [anoMesAtual]);

  const [anoMes, setAnoMes] = useState(anoMesPadrao);
  const [semanaInicio, setSemanaInicio] = useState('');
  const [semanaFim, setSemanaFim] = useState('');
  const [churchId, setChurchId] = useState(churchIdAtual);
  const [filtroSituacao, setFiltroSituacao] = useState<'todos' | 'confirmados' | 'escalados' | 'sem_pregador'>('todos');
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [erroPdf, setErroPdf] = useState<string | null>(null);

  // Sincroniza quando abrir a modal
  useEffect(() => {
    if (aberto) {
      if (anoMesPadrao) setAnoMes(anoMesPadrao);
      if (churchIdAtual !== undefined) setChurchId(churchIdAtual);
    }
  }, [aberto, anoMesPadrao, churchIdAtual]);

  // Parse de ano e mês para os seletores
  const [anoStr, mesStr] = (anoMes || '').split('-');
  const anoAtual = parseInt(anoStr, 10) || new Date().getFullYear();
  const mesAtual = mesStr || String(new Date().getMonth() + 1).padStart(2, '0');

  // Lista de anos disponíveis (2 anteriores até 2 posteriores)
  const baseYear = new Date().getFullYear();
  const listaAnos = [baseYear - 2, baseYear - 1, baseYear, baseYear + 1, baseYear + 2];

  const handleMudarMes = (novoMes: string) => {
    setAnoMes(`${anoAtual}-${novoMes}`);
  };

  const handleMudarAno = (novoAno: number) => {
    setAnoMes(`${novoAno}-${mesAtual}`);
  };

  // Armazena todos os eventos do período para o relatório (independente da paginação de 10 da tela)
  const [todosEventos, setTodosEventos] = useState<AgendaEventoComEscala[]>([]);
  const [carregandoEventosRelatorio, setCarregandoEventosRelatorio] = useState(false);

  useEffect(() => {
    if (!aberto) return;

    let ativo = true;
    async function carregarTodosEventosPeriodo() {
      setCarregandoEventosRelatorio(true);
      try {
        const params = new URLSearchParams();
        params.set('acao', 'eventos');
        // Não envia 'pagina' para obter todos os eventos completos do período selecionado
        if (tipoPeriodo === 'mes' && anoMes) {
          params.set('ano_mes', anoMes);
        } else if (tipoPeriodo === 'semana') {
          if (semanaInicio) params.set('data_inicio', semanaInicio);
          if (semanaFim) params.set('data_fim', semanaFim);
        }
        if (churchId) {
          params.set('church_id', churchId);
        }

        const res = await fetch(`/api/v1/secretaria/escala-pregadores?${params.toString()}`);
        if (res.ok && ativo) {
          const json = await res.json();
          // Mapeia caso venha direto no data
          const lista = Array.isArray(json.data) ? json.data : [];
          setTodosEventos(
            lista.map((ev: any) => ({
              ...ev,
              escala_ativa: ev.escala || ev.escala_ativa || null,
            }))
          );
        }
      } catch (err) {
        console.error('Falha ao carregar eventos para relatório:', err);
      } finally {
        if (ativo) setCarregandoEventosRelatorio(false);
      }
    }

    carregarTodosEventosPeriodo();
    return () => {
      ativo = false;
    };
  }, [aberto, tipoPeriodo, anoMes, semanaInicio, semanaFim, churchId]);

  // Formatação do período por extenso para visualização e identificação visual do relatório
  const periodoPorExtenso = useMemo(() => {
    if (tipoPeriodo === 'mes') {
      const nomeMes = MESES_NOMES.find((m) => m.valor === mesAtual)?.nome || 'Mês';
      return `${nomeMes} de ${anoAtual}`;
    }
    if (semanaInicio && semanaFim) {
      const ini = semanaInicio.split('-').reverse().join('/');
      const fim = semanaFim.split('-').reverse().join('/');
      return `${ini} a ${fim}`;
    }
    return 'Período Personalizado';
  }, [tipoPeriodo, mesAtual, anoAtual, semanaInicio, semanaFim]);

  if (!aberto) return null;

  // Filtragem local para pré-visualização e impressão direta na página
  const eventosFiltrados = todosEventos.filter((ev) => {
    // Filtro congregação
    if (churchId && ev.church_id !== churchId) return false;

    // Filtro situação
    const escala = ev.escala_ativa;
    const temEscala = Boolean(escala && escala.member);
    if (filtroSituacao === 'confirmados' && (!temEscala || escala?.status !== 'confirmado')) return false;
    if (filtroSituacao === 'escalados' && (!temEscala || escala?.status !== 'escalado')) return false;
    if (filtroSituacao === 'sem_pregador' && temEscala) return false;

    return true;
  });

  const congregacaoNome =
    congregacoes.find((c) => c.id === churchId)?.nome || 'Todas as Congregações (Campo Geral)';

  // Handler de Download do PDF
  const handleBaixarPdf = async () => {
    setGerandoPdf(true);
    setErroPdf(null);
    try {
      const params = new URLSearchParams();
      if (tipoPeriodo === 'mes') {
        params.set('ano_mes', anoMes);
      } else {
        if (semanaInicio) params.set('data_inicio', semanaInicio);
        if (semanaFim) params.set('data_fim', semanaFim);
      }
      if (churchId) params.set('church_id', churchId);
      if (filtroSituacao !== 'todos') params.set('situacao', filtroSituacao);

      const res = await fetch(`/api/v1/secretaria/escala-pregadores/relatorio/pdf?${params.toString()}`);
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || 'Falha ao gerar arquivo PDF.');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `escala-pregadores-${anoMes || 'relatorio'}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      setErroPdf(err?.message || 'Erro ao processar download do PDF.');
    } finally {
      setGerandoPdf(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto print:p-0 print:bg-white print:static print:inset-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-4xl w-full overflow-hidden my-4 sm:my-8 print:shadow-none print:border-none print:max-w-none print:my-0">
        {/* Barra Superior - Oculta na Impressão */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 print:hidden">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-lg bg-blue-100 text-blue-700">
              <FileText className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-base font-bold text-slate-900">Relatório da Escala de Pregadores</h2>
              <p className="text-xs text-slate-500">Impressão institucional e download em PDF</p>
            </div>
          </div>
          <button
            onClick={onFechar}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Controles de Filtros do Relatório - Oculto na Impressão */}
        <div className="p-5 border-b border-slate-200 bg-slate-50/50 print:hidden">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end">
            {/* Tipo de Período */}
            <div className="lg:col-span-3">
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-blue-600" />
                Tipo de Período
              </label>
              <select
                value={tipoPeriodo}
                onChange={(e) => setTipoPeriodo(e.target.value as any)}
                className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="mes">Mensal (Mês Completo)</option>
                <option value="semana">Semanal / Intervalo</option>
              </select>
            </div>

            {/* Período (Mês por Extenso + Ano OU Intervalo de Datas) */}
            {tipoPeriodo === 'mes' ? (
              <div className="lg:col-span-3">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Mês de Referência</label>
                <div className="grid grid-cols-12 gap-1.5">
                  <select
                    value={mesAtual}
                    onChange={(e) => handleMudarMes(e.target.value)}
                    className="col-span-7 text-xs rounded-lg border border-slate-300 px-2 py-2 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none font-medium text-slate-800"
                  >
                    {MESES_NOMES.map((m) => (
                      <option key={m.valor} value={m.valor}>
                        {m.nome}
                      </option>
                    ))}
                  </select>
                  <select
                    value={anoAtual}
                    onChange={(e) => handleMudarAno(Number(e.target.value))}
                    className="col-span-5 text-xs rounded-lg border border-slate-300 px-2 py-2 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none font-medium text-slate-800"
                  >
                    {listaAnos.map((ano) => (
                      <option key={ano} value={ano}>
                        {ano}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
              <div className="lg:col-span-3 grid grid-cols-2 gap-1.5">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Início</label>
                  <input
                    type="date"
                    value={semanaInicio}
                    onChange={(e) => setSemanaInicio(e.target.value)}
                    className="w-full text-xs rounded-lg border border-slate-300 px-2 py-2 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Fim</label>
                  <input
                    type="date"
                    value={semanaFim}
                    onChange={(e) => setSemanaFim(e.target.value)}
                    className="w-full text-xs rounded-lg border border-slate-300 px-2 py-2 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>
            )}

            {/* Congregação */}
            <div className="lg:col-span-3">
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <Church className="w-3.5 h-3.5 text-blue-600" />
                Congregação
              </label>
              <select
                value={churchId}
                disabled={!isGlobalUser}
                onChange={(e) => setChurchId(e.target.value)}
                className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:opacity-60"
              >
                {isGlobalUser && <option value="">Todas as Congregações (Campo)</option>}
                {congregacoes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome} {c.is_sede ? '(Sede)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Situação */}
            <div className="lg:col-span-3">
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <Filter className="w-3.5 h-3.5 text-blue-600" />
                Situação
              </label>
              <select
                value={filtroSituacao}
                onChange={(e) => setFiltroSituacao(e.target.value as any)}
                className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="todos">Todos os Cultos</option>
                <option value="confirmados">Apenas Confirmados</option>
                <option value="escalados">Apenas Escalados</option>
                <option value="sem_pregador">Apenas Sem Pregador</option>
              </select>
            </div>
          </div>

          {/* Botões de Ação na Toolbar */}
          <div className="mt-4 pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-slate-500">
              Total de cultos no período: <strong>{eventosFiltrados.length}</strong>
              {carregandoEventosRelatorio && (
                <span className="ml-2 text-blue-600 font-medium animate-pulse">(Carregando agenda completa...)</span>
              )}
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleBaixarPdf}
                disabled={gerandoPdf}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-lg shadow-sm transition-colors disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                <span>{gerandoPdf ? 'Gerando PDF...' : 'Baixar PDF'}</span>
              </button>
            </div>
          </div>

          {erroPdf && (
            <div className="mt-3 p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs font-semibold text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
              <span>{erroPdf}</span>
            </div>
          )}
        </div>

        {/* Pré-visualização Institucional A4 & Área de Impressão */}
        <div className="p-6 sm:p-8 max-h-[65vh] overflow-y-auto print:max-h-none print:overflow-visible print:p-0">
          {/* Cabeçalho Oficial no estilo A4 */}
          <div className="border-b-2 border-slate-800 pb-4 mb-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h1 className="text-lg font-black text-slate-900 tracking-tight uppercase leading-tight">
                  ESCALA DE PREGADORES
                </h1>
                <p className="text-xs font-bold text-slate-600">SECRETARIA GERAL • AGENDA OFICIAL</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Congregação: <strong>{congregacaoNome}</strong>
                </p>
              </div>

              <div className="text-right text-xs text-slate-600">
                <p>
                  Período: <strong>{periodoPorExtenso}</strong>
                </p>
                <p className="text-[11px] text-slate-500">
                  Emissão: {new Date().toLocaleDateString('pt-BR')} (America/Belém)
                </p>
              </div>
            </div>
          </div>

          {/* Tabela Formatada para A4 */}
          {eventosFiltrados.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-500">
              Nenhum culto encontrado com os filtros selecionados.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b-2 border-slate-300 bg-slate-100 text-slate-800">
                    <th className="py-2 px-2.5 font-bold w-8 text-center">#</th>
                    <th className="py-2 px-2.5 font-bold w-28">DATA / HORA</th>
                    <th className="py-2 px-2.5 font-bold">CULTO / CONGREGAÇÃO</th>
                    <th className="py-2 px-2.5 font-bold">PREGADOR / CARGO</th>
                    <th className="py-2 px-2.5 font-bold w-24 text-center">SITUAÇÃO</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {eventosFiltrados.map((ev, idx) => {
                    const dataStr = getLocalDateStr(ev.data_inicio);
                    const horaInicio = formatHoraLocal(ev.data_inicio);
                    const horaFim = formatHoraLocal(ev.data_fim);
                    const escala = ev.escala_ativa;
                    const ministro = escala?.member;
                    const isConfirmado = escala?.status === 'confirmado';
                    const isEscalado = escala?.status === 'escalado';

                    return (
                      <tr key={ev.id} className="hover:bg-slate-50 break-inside-avoid">
                        <td className="py-2.5 px-2.5 text-center text-slate-500 font-semibold">{idx + 1}</td>
                        <td className="py-2.5 px-2.5">
                          <p className="font-bold text-slate-900">{dataStr.split('-').reverse().join('/')}</p>
                          <p className="text-[11px] text-slate-500">
                            {horaInicio} {horaFim ? `às ${horaFim}` : ''}
                          </p>
                        </td>
                        <td className="py-2.5 px-2.5">
                          <p className="font-bold text-slate-900">{ev.titulo}</p>
                          <p className="text-[11px] text-slate-600">
                            {ev.congregacoes?.nome || 'Campo Geral'} {ev.congregacoes?.is_sede ? '(Sede)' : ''}
                          </p>
                        </td>
                        <td className="py-2.5 px-2.5">
                          {ministro ? (
                            <div>
                              <p className="font-bold text-slate-900">{ministro.name}</p>
                              <p className="text-[11px] text-slate-600">{ministro.cargo_ministerial || 'Ministro'}</p>
                              {escala?.tema_mensagem && (
                                <p className="text-[11px] text-blue-700 italic">
                                  Tema: &quot;{escala.tema_mensagem}&quot;
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-amber-700 italic font-medium">— Sem Pregador Escalado —</span>
                          )}
                        </td>
                        <td className="py-2.5 px-2.5 text-center">
                          {isConfirmado ? (
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              Confirmado
                            </span>
                          ) : isEscalado ? (
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                              Escalado
                            </span>
                          ) : (
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                              Em Aberto
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Rodapé A4 */}
          <div className="mt-8 pt-4 border-t border-slate-300 flex items-center justify-between text-[10px] text-slate-500">
            <p>Documento Oficial da Secretaria Geral • Gestão Eklésia</p>
            <p>Horário Oficial de Belém/PA (UTC−3)</p>
          </div>
        </div>

        {/* Rodapé da Modal - Oculto na Impressão */}
        <div className="px-6 py-3 border-t border-slate-100 flex justify-end bg-slate-50 print:hidden">
          <button
            type="button"
            onClick={onFechar}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-200 hover:bg-slate-300 rounded-lg transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
