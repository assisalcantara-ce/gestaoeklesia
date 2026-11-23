'use client';

import { useState, useEffect, useMemo } from 'react';
import { 
  TrendingUp, Award, AlertTriangle, 
  CheckCircle2, AlertCircle, RefreshCw, Download, 
  ShieldAlert, Activity
} from 'lucide-react';
import { 
  ResponsiveContainer, BarChart, Bar, LineChart, Line, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend 
} from 'recharts';
import { 
  CelulaInteligenciaPastoralReport,
  CelulaItem, CelulaRede, CelulaSaudeItem, CelulaAlertaOperacional
} from '@/types/celulas';
import { authenticatedFetch } from '@/lib/api-client';

interface TabPainelPastoralProps {
  celulas: CelulaItem[];
  redes: CelulaRede[];
  congregacoes: { id: string; nome: string }[];
  termoCelula: string;
}

const DIAGNOSTICO_CONFIG: Record<CelulaSaudeItem['diagnostico_estimado'], { label: string; badge: string; desc: string }> = {
  saudavel: { 
    label: 'Saudável & Estável', 
    badge: 'bg-emerald-50 text-emerald-800 border-emerald-300',
    desc: 'Frequência regular e reuniões em dia.'
  },
  pronta_multiplicar: { 
    label: 'Pronta p/ Multiplicar', 
    badge: 'bg-teal-50 text-teal-800 border-teal-300 font-bold',
    desc: 'Alta taxa de membros e média constante.'
  },
  atencao: { 
    label: 'Atenção Pastoral', 
    badge: 'bg-amber-50 text-amber-800 border-amber-300',
    desc: 'Queda de frequência ou poucas reuniões.'
  },
  critico: { 
    label: 'Quadro Crítico', 
    badge: 'bg-rose-50 text-rose-800 border-rose-300 font-bold',
    desc: 'Mais de 21 dias sem relatórios/reuniões.'
  },
};

const ALERTA_NIVEL_CONFIG: Record<CelulaAlertaOperacional['nivel'], { badge: string; iconCor: string }> = {
  baixo: { badge: 'bg-slate-100 text-slate-700 border-slate-200', iconCor: 'text-slate-500' },
  medio: { badge: 'bg-blue-50 text-blue-700 border-blue-200', iconCor: 'text-blue-600' },
  alto: { badge: 'bg-amber-50 text-amber-800 border-amber-300', iconCor: 'text-amber-600' },
  critico: { badge: 'bg-rose-50 text-rose-800 border-rose-300 font-bold', iconCor: 'text-rose-600' },
};

export function TabPainelPastoral({ celulas, redes, congregacoes, termoCelula }: TabPainelPastoralProps) {
  const [report, setReport] = useState<CelulaInteligenciaPastoralReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [exportando, setExportando] = useState(false);
  const [notificacao, setNotificacao] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null);

  // Filtros
  const [filtroCongregacao, setFiltroCongregacao] = useState<string>('todas');
  const [filtroRede, setFiltroRede] = useState<string>('todas');
  const [filtroCelula, setFiltroCelula] = useState<string>('todas');
  const [dataInicio, setDataInicio] = useState<string>('');
  const [dataFim, setDataFim] = useState<string>('');

  // Filtro de aba interna para saúde/alertas
  const [abaSaude, setAbaSaude] = useState<'todas' | 'pronta_multiplicar' | 'atencao_critico'>('todas');

  const carregarPainel = async () => {
    try {
      setLoading(true);
      setNotificacao(null);

      const params = new URLSearchParams();
      if (filtroCongregacao !== 'todas') params.append('congregacao_id', filtroCongregacao);
      if (filtroRede !== 'todas') params.append('rede_id', filtroRede);
      if (filtroCelula !== 'todas') params.append('celula_id', filtroCelula);
      if (dataInicio) params.append('data_inicio', dataInicio);
      if (dataFim) params.append('data_fim', dataFim);

      const res = await authenticatedFetch(`/api/v1/celulas/relatorios/inteligencia?${params.toString()}`);
      if (!res.ok) {
        const erroJson = await res.json().catch(() => ({}));
        throw new Error(erroJson.error || 'Falha ao obter painel de inteligência pastoral.');
      }

      const json = await res.json();
      setReport(json.data || null);
    } catch (err: any) {
      setNotificacao({ tipo: 'erro', texto: err.message || 'Erro ao carregar inteligência pastoral.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarPainel();
  }, [filtroCongregacao, filtroRede, filtroCelula, dataInicio, dataFim]);

  // Exportação CSV e JSON
  const handleExportar = async (formato: 'csv' | 'json') => {
    try {
      setExportando(true);
      const params = new URLSearchParams();
      params.append('formato', formato);
      if (filtroCongregacao !== 'todas') params.append('congregacao_id', filtroCongregacao);
      if (filtroRede !== 'todas') params.append('rede_id', filtroRede);
      if (filtroCelula !== 'todas') params.append('celula_id', filtroCelula);
      if (dataInicio) params.append('data_inicio', dataInicio);
      if (dataFim) params.append('data_fim', dataFim);

      const res = await authenticatedFetch(`/api/v1/celulas/relatorios/exportar?${params.toString()}`);
      if (!res.ok) throw new Error('Erro ao exportar relatório.');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `relatorio_celulas_inteligencia_${new Date().toISOString().substring(0, 10)}.${formato}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      setNotificacao({ tipo: 'sucesso', texto: `Relatório exportado em .${formato.toUpperCase()} com sucesso!` });
    } catch (err: any) {
      setNotificacao({ tipo: 'erro', texto: err.message || 'Falha na exportação.' });
    } finally {
      setExportando(false);
    }
  };

  // Filtragem de Saúde das Células
  const celulasSaudeFiltradas = useMemo(() => {
    if (!report?.saude_celulas) return [];
    if (abaSaude === 'pronta_multiplicar') {
      return report.saude_celulas.filter(c => c.diagnostico_estimado === 'pronta_multiplicar');
    }
    if (abaSaude === 'atencao_critico') {
      return report.saude_celulas.filter(c => c.diagnostico_estimado === 'atencao' || c.diagnostico_estimado === 'critico');
    }
    return report.saude_celulas;
  }, [report, abaSaude]);

  // Formatação de dados da série temporal para gráficos
  const chartData = useMemo(() => {
    if (!report?.serie_temporal) return [];
    return report.serie_temporal.map(item => ({
      mes: item.periodo_mes,
      reunioes: item.reunioes_realizadas,
      presencas: item.presencas_acumuladas,
      unicos: item.pessoas_unicas_presentes,
      visitantes: item.visitantes_total,
      conversoes: item.conversoes_decisoes,
      multiplicacoes: item.multiplicacoes_efetivadas,
    }));
  }, [report]);

  return (
    <div className="space-y-6">
      {/* Notificação no Topo */}
      {notificacao && (
        <div
          className={`flex items-center justify-between p-4 rounded-xl text-xs sm:text-sm font-medium border shadow-2xs ${
            notificacao.tipo === 'sucesso'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {notificacao.tipo === 'sucesso' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600" />
            )}
            <span>{notificacao.texto}</span>
          </div>
          <button onClick={() => setNotificacao(null)} className="text-xs font-bold underline hover:opacity-80 cursor-pointer">
            Fechar
          </button>
        </div>
      )}

      {/* Barra de Filtros e Exportação */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-teal-700" />
              <span>Painel de Inteligência Pastoral</span>
            </h3>
            <p className="text-xs text-slate-500">Métricas reconciliadas, diagnósticos de saúde e alertas operacionais</p>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            <button
              type="button"
              onClick={() => handleExportar('csv')}
              disabled={exportando || loading}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
              title="Exportar dados consolidados em planilha CSV"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
              <span>Exportar CSV</span>
            </button>

            <button
              type="button"
              onClick={() => handleExportar('json')}
              disabled={exportando || loading}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
              title="Exportar dados brutos em formato JSON"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
              <span>JSON</span>
            </button>

            <button
              type="button"
              onClick={carregarPainel}
              disabled={loading}
              className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition cursor-pointer disabled:opacity-50"
              title="Recarregar Indicadores"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Linha de Filtros Efetivos */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Congregação</label>
            <select
              value={filtroCongregacao}
              onChange={(e) => setFiltroCongregacao(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-teal-600 focus:outline-none bg-white"
            >
              <option value="todas">Todas as Congregações</option>
              {congregacoes.map(c => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Rede Ministerial</label>
            <select
              value={filtroRede}
              onChange={(e) => setFiltroRede(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-teal-600 focus:outline-none bg-white"
            >
              <option value="todas">Todas as Redes</option>
              {redes.map(r => (
                <option key={r.id} value={r.id}>{r.nome}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">{termoCelula}</label>
            <select
              value={filtroCelula}
              onChange={(e) => setFiltroCelula(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-teal-600 focus:outline-none bg-white"
            >
              <option value="todas">Todas as {termoCelula}s</option>
              {celulas.map(c => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Início do Período</label>
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-teal-600 focus:outline-none bg-white"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Fim do Período</label>
            <input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-teal-600 focus:outline-none bg-white"
            />
          </div>
        </div>
      </div>

      {loading && !report ? (
        <div className="py-20 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-teal-700" />
          <p className="text-sm font-semibold text-slate-700">Calculando indicadores ministeriais...</p>
          <p className="text-xs text-slate-400 mt-1">Reconciliando pessoas únicas, reuniões e histórico de presença.</p>
        </div>
      ) : (
        <>
          {/* CARDS DE INDICADORES RECONCILIADOS */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Células Ativas</span>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-xl font-black text-slate-900">{report?.indicadores_gerais.celulas_ativas || 0}</span>
                <span className="text-[11px] text-slate-400">/ {report?.indicadores_gerais.total_celulas || 0}</span>
              </div>
              <span className="text-[10px] text-slate-500 mt-0.5 block truncate">
                {report?.indicadores_gerais.celulas_em_formacao || 0} em formação
              </span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Participantes</span>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-xl font-black text-teal-700">{report?.indicadores_gerais.participantes_regulares_ativos || 0}</span>
                <span className="text-[11px] text-teal-800">ativos</span>
              </div>
              <span className="text-[10px] text-slate-500 mt-0.5 block truncate">
                {report?.indicadores_gerais.total_membros_vinculados || 0} vínculos totais
              </span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Reuniões Feitas</span>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-xl font-black text-blue-700">{report?.indicadores_gerais.reunioes_realizadas || 0}</span>
              </div>
              <span className="text-[10px] text-slate-500 mt-0.5 block truncate">
                {report?.indicadores_gerais.reunioes_canceladas || 0} canceladas
              </span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Presenças Únicas</span>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-xl font-black text-emerald-700">{report?.indicadores_gerais.presencas_unicas_identificadas || 0}</span>
                <span className="text-[11px] text-slate-400">pessoas</span>
              </div>
              <span className="text-[10px] text-slate-500 mt-0.5 block truncate">
                {report?.indicadores_gerais.presencas_totais_acumuladas || 0} presenças acumuladas
              </span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Visitantes & Frutos</span>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-xl font-black text-amber-700">{report?.indicadores_gerais.visitantes_totais || 0}</span>
                <span className="text-[11px] text-amber-800">visitantes</span>
              </div>
              <span className="text-[10px] text-emerald-700 font-semibold mt-0.5 block truncate">
                {report?.indicadores_gerais.conversoes_decisoes || 0} decisões / conversões
              </span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Multiplicações</span>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-xl font-black text-teal-800">{report?.indicadores_gerais.multiplicacoes_efetivadas || 0}</span>
                <span className="text-[11px] text-slate-400">efetivadas</span>
              </div>
              <span className="text-[10px] text-slate-500 mt-0.5 block truncate">
                {report?.indicadores_gerais.supervisoes_realizadas || 0} visitas pastorais
              </span>
            </div>
          </div>

          {/* PAINEL DE ALERTAS OPERACIONAIS E NECESSIDADES */}
          {report?.alertas_operacionais && report.alertas_operacionais.length > 0 && (
            <div className="bg-rose-50/40 rounded-2xl border border-rose-200/80 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-rose-600" />
                  <h4 className="text-sm font-bold text-rose-900">Alertas Operacionais & Situações que Exigem Atenção</h4>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
                  {report.alertas_operacionais.length} pendências
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {report.alertas_operacionais.map((alerta, idx) => {
                  const nivelCfg = ALERTA_NIVEL_CONFIG[alerta.nivel] || ALERTA_NIVEL_CONFIG.medio;
                  return (
                    <div key={idx} className="bg-white p-3.5 rounded-xl border border-rose-200/60 shadow-2xs flex items-start gap-3">
                      <ShieldAlert className={`w-4 h-4 flex-shrink-0 mt-0.5 ${nivelCfg.iconCor}`} />
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-slate-900 truncate">{alerta.celula_nome}</span>
                          <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${nivelCfg.badge}`}>
                            {alerta.nivel}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600">{alerta.mensagem}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* GRÁFICOS DE EVOLUÇÃO E CRESCIMENTO */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Gráfico 1: Reuniões e Participação */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Evolução de Presenças e Pessoas Únicas</h4>
                  <p className="text-xs text-slate-400">Comparação mensal de participação no período</p>
                </div>
                <Activity className="w-4 h-4 text-teal-600" />
              </div>

              {chartData.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-xs text-slate-400">
                  Nenhum dado histórico registrado para os filtros aplicados.
                </div>
              ) : (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#64748b' }} />
                      <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                      />
                      <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                      <Line type="monotone" dataKey="presencas" name="Presenças Acumuladas" stroke="#0d9488" strokeWidth={2.5} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="unicos" name="Pessoas Únicas" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Gráfico 2: Visitantes e Frutos */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Atividades, Visitantes & Frutos</h4>
                  <p className="text-xs text-slate-400">Reuniões realizadas, novos visitantes e decisões</p>
                </div>
                <Award className="w-4 h-4 text-amber-600" />
              </div>

              {chartData.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-xs text-slate-400">
                  Nenhum dado histórico registrado para os filtros aplicados.
                </div>
              ) : (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#64748b' }} />
                      <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                      />
                      <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                      <Bar dataKey="reunioes" name="Reuniões Realizadas" fill="#0f766e" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="visitantes" name="Visitantes" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="conversoes" name="Decisões / Conversões" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          {/* DIAGNÓSTICO DE SAÚDE DAS CÉLULAS */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-50/50">
              <div>
                <h4 className="text-sm sm:text-base font-bold text-slate-900">Termômetro de Saúde das Células</h4>
                <p className="text-xs text-slate-500">Diagnóstico operacional baseado em frequência e constância de encontros</p>
              </div>

              {/* Filtro Rápido de Saúde */}
              <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setAbaSaude('todas')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    abaSaude === 'todas' ? 'bg-slate-800 text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Todas ({report?.saude_celulas.length || 0})
                </button>
                <button
                  type="button"
                  onClick={() => setAbaSaude('pronta_multiplicar')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    abaSaude === 'pronta_multiplicar' ? 'bg-teal-700 text-white' : 'text-teal-800 hover:text-teal-950'
                  }`}
                >
                  Prontas p/ Multiplicar
                </button>
                <button
                  type="button"
                  onClick={() => setAbaSaude('atencao_critico')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    abaSaude === 'atencao_critico' ? 'bg-rose-700 text-white' : 'text-rose-800 hover:text-rose-950'
                  }`}
                >
                  Atenção / Crítico
                </button>
              </div>
            </div>

            {celulasSaudeFiltradas.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs font-medium">
                Nenhuma célula encontrada para esta categoria de diagnóstico.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px] font-bold border-b border-slate-100">
                    <tr>
                      <th className="px-4 py-3">{termoCelula}</th>
                      <th className="px-4 py-3">Liderança</th>
                      <th className="px-4 py-3 text-center">Membros</th>
                      <th className="px-4 py-3 text-center">Média Presença (4 reun.)</th>
                      <th className="px-4 py-3 text-center">Visitantes</th>
                      <th className="px-4 py-3 text-center">Decisões</th>
                      <th className="px-4 py-3 text-center">Última Reunião</th>
                      <th className="px-4 py-3 text-right">Diagnóstico</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {celulasSaudeFiltradas.map((c) => {
                      const diag = DIAGNOSTICO_CONFIG[c.diagnostico_estimado] || DIAGNOSTICO_CONFIG.saudavel;
                      return (
                        <tr key={c.celula_id} className="hover:bg-slate-50/70 transition">
                          <td className="px-4 py-3 font-bold text-slate-900">{c.celula_nome}</td>
                          <td className="px-4 py-3 text-slate-600">{c.lider_nome || '—'}</td>
                          <td className="px-4 py-3 text-center font-semibold text-slate-800">{c.total_participantes}</td>
                          <td className="px-4 py-3 text-center font-bold text-teal-800">{c.media_presenca_ultimas_4_reunioes}</td>
                          <td className="px-4 py-3 text-center text-amber-700 font-semibold">{c.total_visitantes_periodo}</td>
                          <td className="px-4 py-3 text-center text-emerald-700 font-semibold">{c.decisoes_periodo}</td>
                          <td className="px-4 py-3 text-center text-slate-500">
                            {c.ultima_reuniao_data ? new Date(c.ultima_reuniao_data).toLocaleDateString('pt-BR') : 'Sem reunião'}
                            {c.dias_desde_ultima_reuniao !== null && c.dias_desde_ultima_reuniao > 7 && (
                              <span className="block text-[10px] text-rose-600 font-bold">
                                ({c.dias_desde_ultima_reuniao}d atrás)
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span 
                              className={`inline-block text-[10px] uppercase font-bold px-2 py-0.5 rounded-md border ${diag.badge}`}
                              title={diag.desc}
                            >
                              {diag.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
