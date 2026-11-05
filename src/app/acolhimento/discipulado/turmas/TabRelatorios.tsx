'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  Printer,
  RefreshCw,
  Loader2,
  Users,
  Layers,
  GraduationCap,
  Building2,
  TrendingUp,
  Percent,
} from 'lucide-react';

interface TabRelatoriosProps {
  ministryId: string;
  onNotification: (type: 'success' | 'error' | 'warning' | 'info', title: string, message: string) => void;
}

interface DadosRelatorio {
  jornadas: {
    total: number;
    ativas: number;
    concluidas: number;
    formacaoCompleta26: number;
    fases: {
      primeirosPassos: number;
      fundamentos: number;
      preparacaoBatismo: number;
    };
  };
  turmas: {
    total: number;
    ativas: number;
    encerradas: number;
    capacidadeTotal: number;
  };
  equipe: {
    total: number;
    professores: number;
    discipuladores: number;
    coordenadores: number;
  };
  frequencia: {
    totalChamadas: number;
    presentes: number;
    ausentes: number;
    justificados: number;
    taxaAssiduidade: number;
  };
}

export default function TabRelatorios({ ministryId: _ministryId, onNotification }: TabRelatoriosProps) {
  const [dados, setDados] = useState<DadosRelatorio | null>(null);
  const [loading, setLoading] = useState(true);
  const [filtroCongregacao, setFiltroCongregacao] = useState('todas');
  const [congregacoes, setCongregacoes] = useState<{ id: string; nome: string }[]>([]);

  // Carregar congregações para o filtro
  useEffect(() => {
    fetch('/api/v1/congregacoes')
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => setCongregacoes(data.congregacoes || data.data || []))
      .catch(() => {});
  }, []);

  // Carregar dados agregados do relatório
  const carregarRelatorio = useCallback(async () => {
    setLoading(true);
    try {
      const url =
        filtroCongregacao && filtroCongregacao !== 'todas'
          ? `/api/v1/discipulado/relatorios?congregacaoId=${filtroCongregacao}`
          : '/api/v1/discipulado/relatorios';

      const res = await fetch(url);
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Erro ao carregar relatório.');
      }
      const json = await res.json();
      setDados(json);
    } catch (err: any) {
      console.error('[carregarRelatorio]', err);
      onNotification('error', 'Falha no Relatório', err.message || 'Erro de conexão.');
    } finally {
      setLoading(false);
    }
  }, [filtroCongregacao, onNotification]);

  useEffect(() => {
    carregarRelatorio();
  }, [carregarRelatorio]);

  const handleImprimir = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Barra de Filtros e Ações de Exportação */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 sm:p-5 print:hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-700 border border-teal-200 flex items-center justify-center font-bold">
              <FileText className="w-5 h-5 text-teal-700" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                Painel Consolidado de Discipulado
              </h2>
              <p className="text-xs text-slate-500">
                Indicadores de frequência, retenção e avanço no currículo de 26 lições
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <select
              value={filtroCongregacao}
              onChange={(e) => setFiltroCongregacao(e.target.value)}
              className="px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition cursor-pointer"
            >
              <option value="todas">Todas as Congregações</option>
              {congregacoes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={carregarRelatorio}
              disabled={loading}
              className="px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs disabled:opacity-60"
              title="Atualizar dados"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-teal-600' : ''}`} />
              <span className="hidden sm:inline">Atualizar</span>
            </button>

            <button
              type="button"
              onClick={handleImprimir}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-sm"
              title="Imprimir relatório"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir Relatório</span>
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center bg-white rounded-2xl border border-slate-200">
          <Loader2 className="w-8 h-8 animate-spin text-teal-600 mx-auto mb-3" />
          <p className="text-xs text-slate-500 font-semibold">Compilando estatísticas do discipulado...</p>
        </div>
      ) : !dados ? (
        <div className="py-16 text-center bg-white rounded-2xl border border-slate-200">
          <p className="text-sm text-slate-600 font-bold">Nenhum dado disponível no momento.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Cabeçalho de Impressão */}
          <div className="hidden print:block border-b-2 border-slate-800 pb-4 mb-6">
            <h1 className="text-2xl font-bold text-slate-900">Gestão Eklésia — Relatório de Discipulado</h1>
            <p className="text-sm text-slate-600">
              Emitido em {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR')}
            </p>
          </div>

          {/* Métricas Principais */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Discípulos Ativos</span>
                <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center">
                  <Users className="w-4 h-4" />
                </div>
              </div>
              <p className="text-3xl font-extrabold text-slate-900 mt-2">{dados.jornadas.ativas}</p>
              <p className="text-xs text-slate-500 mt-1">Total acumulado: {dados.jornadas.total}</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Formação Completa</span>
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                  <GraduationCap className="w-4 h-4" />
                </div>
              </div>
              <p className="text-3xl font-extrabold text-emerald-700 mt-2">{dados.jornadas.formacaoCompleta26}</p>
              <p className="text-xs text-slate-500 mt-1">26 lições validadas pedagogicamente</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Taxa de Assiduidade</span>
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
                  <Percent className="w-4 h-4" />
                </div>
              </div>
              <p className="text-3xl font-extrabold text-blue-700 mt-2">{dados.frequencia.taxaAssiduidade}%</p>
              <p className="text-xs text-slate-500 mt-1">{dados.frequencia.presentes} presenças em chamadas</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Turmas Operantes</span>
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center">
                  <Building2 className="w-4 h-4" />
                </div>
              </div>
              <p className="text-3xl font-extrabold text-indigo-700 mt-2">{dados.turmas.ativas}</p>
              <p className="text-xs text-slate-500 mt-1">Capacidade total: {dados.turmas.capacidadeTotal} vagas</p>
            </div>
          </div>

          {/* Gráfico / Barras de Distribuição das Fases */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Fases da Jornada */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <Layers className="w-4 h-4 text-teal-600" />
                  Distribuição por Fase de Discipulado
                </h3>
                <span className="text-xs text-slate-500 font-semibold">{dados.jornadas.total} registros</span>
              </div>

              <div className="space-y-4 pt-2">
                <div>
                  <div className="flex justify-between text-xs font-bold text-slate-700 mb-1.5">
                    <span>Primeiros Passos (Lições 01 a 08)</span>
                    <span>{dados.jornadas.fases.primeirosPassos} discípulos</span>
                  </div>
                  <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-teal-500 rounded-full transition-all duration-500"
                      style={{
                        width: `${
                          dados.jornadas.total > 0
                            ? (dados.jornadas.fases.primeirosPassos / dados.jornadas.total) * 100
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-bold text-slate-700 mb-1.5">
                    <span>Fundamentos da Fé (Lições 09 a 18)</span>
                    <span>{dados.jornadas.fases.fundamentos} discípulos</span>
                  </div>
                  <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                      style={{
                        width: `${
                          dados.jornadas.total > 0
                            ? (dados.jornadas.fases.fundamentos / dados.jornadas.total) * 100
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-bold text-slate-700 mb-1.5">
                    <span>Candidatos ao Batismo (Lições 19 a 26)</span>
                    <span>{dados.jornadas.fases.preparacaoBatismo} discípulos</span>
                  </div>
                  <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                      style={{
                        width: `${
                          dados.jornadas.total > 0
                            ? (dados.jornadas.fases.preparacaoBatismo / dados.jornadas.total) * 100
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Quadro de Frequência e Equipe */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-blue-600" />
                  Quadro de Assiduidade e Frequência Coletiva
                </h3>
                <span className="text-xs text-slate-500 font-semibold">{dados.frequencia.totalChamadas} chamadas</span>
              </div>

              <div className="grid grid-cols-3 gap-3 pt-2">
                <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-xl text-center">
                  <p className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Presentes</p>
                  <p className="text-2xl font-extrabold text-emerald-700 mt-1">{dados.frequencia.presentes}</p>
                </div>
                <div className="bg-rose-50 border border-rose-200 p-3.5 rounded-xl text-center">
                  <p className="text-xs font-bold text-rose-800 uppercase tracking-wider">Ausentes</p>
                  <p className="text-2xl font-extrabold text-rose-700 mt-1">{dados.frequencia.ausentes}</p>
                </div>
                <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-xl text-center">
                  <p className="text-xs font-bold text-amber-800 uppercase tracking-wider">Justificados</p>
                  <p className="text-2xl font-extrabold text-amber-700 mt-1">{dados.frequencia.justificados}</p>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-3 flex items-center justify-between text-xs text-slate-600">
                <span>Corpo Docente Ativo:</span>
                <span className="font-bold text-slate-900">
                  {dados.equipe.professores} professores, {dados.equipe.discipuladores} discipuladores
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
