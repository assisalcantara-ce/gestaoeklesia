'use client';

/**
 * /app/ebd — Minha EBD (Área do Aluno Mobile)
 * Visualização eclesiástica/acadêmica pessoal de Escola Bíblica Dominical do membro autenticado.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import MobileShell from '@/components/mobile/MobileShell';
import MobileHeader from '@/components/mobile/MobileHeader';
import MobileBottomNav from '@/components/mobile/MobileBottomNav';
import { createClient } from '@/lib/supabase-client';
import {
  BookOpen,
  GraduationCap,
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  MapPin,
  Users,
  Award,
  RefreshCw,
  AlertCircle,
  BookMarked,
  Sparkles,
} from 'lucide-react';

interface EbdMeResponse {
  has_student: boolean;
  is_enrolled: boolean;
  aluno: {
    id: string;
    nome: string;
    ativo: boolean;
    sexo?: string;
  } | null;
  matricula: {
    id: string;
    data_inicio: string;
    turma_id: string;
  } | null;
  matricula_anterior?: {
    id: string;
    data_inicio: string;
    data_fim: string | null;
  } | null;
  turma: {
    id: string;
    nome: string;
    sala: string | null;
    capacidade_max: number | null;
    ativo: boolean;
    classe?: {
      id: string;
      nome: string;
      faixa_etaria_min: number | null;
      faixa_etaria_max: number | null;
      cor: string | null;
    } | null;
    congregacao?: {
      id: string;
      nome: string;
    } | null;
  } | null;
  professores: Array<{
    id: string;
    nome: string;
    telefone?: string | null;
    email?: string | null;
    funcao: string;
  }>;
  trimestre_atual: {
    id: string;
    numero: number;
    ano: number;
    descricao: string;
    data_inicio: string;
    data_fim: string;
  } | null;
  proxima_licao: {
    id: string;
    data_aula: string;
    licao_numero: number | null;
    tema: string;
    status: string;
    observacoes?: string | null;
    professor?: string | null;
  } | null;
  frequencia_resumo: {
    total_aulas: number;
    presencas: number;
    faltas: number;
    percentual: number;
  } | null;
}

interface LicaoItem {
  id: string;
  data_aula: string;
  licao_numero: number | null;
  tema: string;
  status: string;
  observacoes?: string | null;
  trimestre?: number | null;
  ano?: number;
  professor?: string | null;
  frequencia?: { presente: boolean; observacoes?: string | null } | null;
}

interface FrequenciaData {
  resumo: {
    total_aulas: number;
    presencas: number;
    faltas: number;
    percentual: number;
  };
  por_trimestre: Array<{
    chave: string;
    ano: number;
    trimestre: number;
    total: number;
    presencas: number;
    faltas: number;
    percentual: number;
  }>;
  historico: Array<{
    id: string;
    presente: boolean;
    observacoes?: string | null;
    data_aula: string;
    licao_numero: number | null;
    tema: string;
    ano: number;
    trimestre: number | null;
    turma_nome: string;
  }>;
}

function formatDateBR(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('T')[0].split('-');
  return `${day}/${month}/${year}`;
}

export default function MinhaEbdPage() {
  const supabase = useMemo(() => createClient(), []);
  const [activeTab, setActiveTab] = useState<'geral' | 'licoes' | 'frequencia'>('geral');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [ebdMe, setEbdMe] = useState<EbdMeResponse | null>(null);
  const [licoes, setLicoes] = useState<LicaoItem[]>([]);
  const [licoesLoading, setLicoesLoading] = useState(false);
  const [frequenciaData, setFrequenciaData] = useState<FrequenciaData | null>(null);
  const [frequenciaLoading, setFrequenciaLoading] = useState(false);

  // Carregar dados gerais
  const loadEbdMe = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setError('Sessão expirada. Faça login novamente.');
        setLoading(false);
        return;
      }

      const res = await fetch('/api/v1/mobile/ebd/me', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Erro ao carregar dados da EBD.');
      }

      const data: EbdMeResponse = await res.json();
      setEbdMe(data);
    } catch (err: any) {
      setError(err?.message || 'Não foi possível carregar suas informações da EBD.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Carregar lições quando a aba for selecionada
  const loadLicoes = useCallback(async () => {
    if (licoes.length > 0) return;
    setLicoesLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch('/api/v1/mobile/ebd/licoes', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        setLicoes(data.licoes || []);
      }
    } catch {
      // Silently keep empty list or display friendly state
    } finally {
      setLicoesLoading(false);
    }
  }, [licoes.length]);

  // Carregar frequência detalhada quando a aba for selecionada
  const loadFrequencia = useCallback(async () => {
    if (frequenciaData) return;
    setFrequenciaLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch('/api/v1/mobile/ebd/frequencia', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        setFrequenciaData(data);
      }
    } catch {
      // Silently handle
    } finally {
      setFrequenciaLoading(false);
    }
  }, [frequenciaData]);

  useEffect(() => {
    loadEbdMe();
  }, [loadEbdMe]);

  useEffect(() => {
    if (activeTab === 'licoes') {
      loadLicoes();
    } else if (activeTab === 'frequencia') {
      loadFrequencia();
    }
  }, [activeTab, loadLicoes, loadFrequencia]);

  return (
    <MobileShell>
      <MobileHeader title="Minha EBD" />

      <main className="flex-1 px-4 py-5 max-w-lg mx-auto w-full pb-28 text-slate-100">
        {/* Loading Skeleton */}
        {loading && (
          <div className="space-y-4 animate-pulse">
            <div className="h-40 bg-[#111827] rounded-2xl border border-slate-800 w-full" />
            <div className="h-24 bg-[#111827] rounded-xl border border-slate-800 w-full" />
            <div className="h-32 bg-[#111827] rounded-xl border border-slate-800 w-full" />
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <div className="bg-rose-950/20 border border-rose-500/30 rounded-2xl p-6 text-center">
            <AlertCircle className="w-12 h-12 text-rose-400 mx-auto mb-3" />
            <h3 className="font-semibold text-rose-200 text-base mb-1">Ops! Ocorreu um problema</h3>
            <p className="text-sm text-rose-300/80 mb-4">{error}</p>
            <button
              onClick={loadEbdMe}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-xl transition shadow-lg shadow-blue-900/30"
            >
              <RefreshCw size={16} />
              Tentar novamente
            </button>
          </div>
        )}

        {/* Membro sem matrícula ativa */}
        {!loading && !error && ebdMe && (!ebdMe.has_student || !ebdMe.is_enrolled) && (
          <div className="bg-[#111827] rounded-2xl border border-slate-800 p-6 text-center shadow-lg">
            <div className="w-16 h-16 bg-blue-600/10 border border-blue-500/20 text-blue-400 rounded-full flex items-center justify-center mx-auto mb-4">
              <BookOpen size={32} />
            </div>
            <h2 className="text-lg font-bold text-slate-100 mb-2">Escola Bíblica Dominical</h2>
            <p className="text-sm text-slate-400 mb-6 leading-relaxed">
              Você ainda não possui uma matrícula ativa na EBD. Procure a coordenação pedagógica ou a secretaria da sua congregação para ser matriculado em uma turma!
            </p>
            <div className="bg-[#172033] border border-slate-700/60 rounded-xl p-4 text-left space-y-2.5">
              <div className="flex items-start gap-2.5">
                <GraduationCap className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <span className="text-xs text-slate-300">Estudo sistemático da Palavra de Deus</span>
              </div>
              <div className="flex items-start gap-2.5">
                <Users className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <span className="text-xs text-slate-300">Turmas divididas por faixas etárias</span>
              </div>
              <div className="flex items-start gap-2.5">
                <Award className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <span className="text-xs text-slate-300">Acompanhamento e frequência no seu app</span>
              </div>
            </div>
          </div>
        )}

        {/* Membro com matrícula ativa */}
        {!loading && !error && ebdMe && ebdMe.is_enrolled && ebdMe.turma && (
          <div className="space-y-4">
            {/* Navegação por Abas */}
            <div className="flex bg-[#172033] p-1 rounded-xl border border-slate-800/80">
              <button
                onClick={() => setActiveTab('geral')}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                  activeTab === 'geral'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-900/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Visão Geral
              </button>
              <button
                onClick={() => setActiveTab('licoes')}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                  activeTab === 'licoes'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-900/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Lições
              </button>
              <button
                onClick={() => setActiveTab('frequencia')}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                  activeTab === 'frequencia'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-900/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Frequência
              </button>
            </div>

            {/* TAB: VISÃO GERAL */}
            {activeTab === 'geral' && (
              <div className="space-y-4">
                {/* Hero Card da Turma */}
                <div className="bg-gradient-to-br from-[#172033] to-[#111827] border border-blue-500/20 rounded-2xl p-5 text-white shadow-lg">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Matrícula Ativa
                    </span>
                    {ebdMe.turma.classe?.nome && (
                      <span className="text-[11px] font-medium text-slate-300 bg-slate-800/80 border border-slate-700/60 px-2 py-0.5 rounded-md">
                        {ebdMe.turma.classe.nome}
                      </span>
                    )}
                  </div>

                  <h1 className="text-xl font-bold tracking-tight text-white mb-1">{ebdMe.turma.nome}</h1>

                  <div className="space-y-1.5 mt-3 text-xs text-slate-300">
                    {ebdMe.turma.congregacao?.nome && (
                      <div className="flex items-center gap-2">
                        <MapPin size={13} className="text-blue-400 shrink-0" />
                        <span>{ebdMe.turma.congregacao.nome}</span>
                      </div>
                    )}
                    {ebdMe.turma.sala && (
                      <div className="flex items-center gap-2">
                        <BookMarked size={13} className="text-blue-400 shrink-0" />
                        <span>Sala: {ebdMe.turma.sala}</span>
                      </div>
                    )}
                    {ebdMe.trimestre_atual && (
                      <div className="flex items-center gap-2">
                        <Calendar size={13} className="text-blue-400 shrink-0" />
                        <span>
                          {ebdMe.trimestre_atual.numero}º Trimestre / {ebdMe.trimestre_atual.ano}
                          {ebdMe.trimestre_atual.descricao ? ` — ${ebdMe.trimestre_atual.descricao}` : ''}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card de Frequência Rápida */}
                {ebdMe.frequencia_resumo && (
                  <div className="bg-[#111827] rounded-2xl border border-slate-800 p-4 shadow-md">
                    <div className="flex items-center justify-between mb-3">
                      <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                        <CheckCircle2 size={16} className="text-blue-400" />
                        Minha Frequência
                      </h2>
                      <span className="text-xs font-bold text-blue-400 bg-blue-950/50 border border-blue-500/20 px-2.5 py-0.5 rounded-full">
                        {ebdMe.frequencia_resumo.percentual}% de presença
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden mb-3">
                      <div
                        className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, ebdMe.frequencia_resumo.percentual)}%` }}
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center pt-2 border-t border-slate-800">
                      <div>
                        <p className="text-[11px] text-slate-400">Aulas</p>
                        <p className="text-base font-bold text-slate-200">
                          {ebdMe.frequencia_resumo.total_aulas}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] text-slate-400">Presenças</p>
                        <p className="text-base font-bold text-emerald-400">
                          {ebdMe.frequencia_resumo.presencas}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] text-slate-400">Faltas</p>
                        <p className="text-base font-bold text-rose-400">
                          {ebdMe.frequencia_resumo.faltas}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Card de Próxima Lição */}
                {ebdMe.proxima_licao ? (
                  <div className="bg-[#111827] rounded-2xl border border-slate-800 p-4 shadow-md">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                        <Sparkles size={13} />
                        Próxima Lição
                      </span>
                      <span className="text-xs font-medium text-slate-400 flex items-center gap-1">
                        <Clock size={12} />
                        {formatDateBR(ebdMe.proxima_licao.data_aula)}
                      </span>
                    </div>
                    <h3 className="font-bold text-slate-100 text-sm">
                      {ebdMe.proxima_licao.licao_numero ? `Lição ${ebdMe.proxima_licao.licao_numero}: ` : ''}
                      {ebdMe.proxima_licao.tema}
                    </h3>
                    {ebdMe.proxima_licao.professor && (
                      <p className="text-xs text-slate-400 mt-1">
                        Professor(a): <span className="font-medium text-slate-200">{ebdMe.proxima_licao.professor}</span>
                      </p>
                    )}
                    {ebdMe.proxima_licao.observacoes && (
                      <p className="text-xs text-slate-300 mt-2 bg-[#172033] p-2.5 rounded-lg border border-slate-700/50">
                        {ebdMe.proxima_licao.observacoes}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="bg-[#111827] rounded-2xl border border-slate-800 p-6 shadow-md text-center">
                    <BookOpen size={24} className="text-slate-500 mx-auto mb-2" />
                    <p className="text-xs text-slate-400">Nenhuma lição agendada para os próximos domingos.</p>
                  </div>
                )}

                {/* Professores da Turma */}
                {ebdMe.professores && ebdMe.professores.length > 0 && (
                  <div className="bg-[#111827] rounded-2xl border border-slate-800 p-4 shadow-md">
                    <h2 className="text-sm font-bold text-slate-100 mb-3 flex items-center gap-2">
                      <Users size={16} className="text-blue-400" />
                      Corpo Docente
                    </h2>
                    <div className="space-y-2">
                      {ebdMe.professores.map((prof) => (
                        <div
                          key={prof.id}
                          className="flex items-center justify-between p-2.5 bg-[#172033] rounded-xl border border-slate-700/50"
                        >
                          <div>
                            <p className="text-xs font-semibold text-slate-100">{prof.nome}</p>
                            <p className="text-[11px] text-slate-400 capitalize">
                              {prof.funcao === 'titular' ? 'Professor Titular' : prof.funcao}
                            </p>
                          </div>
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-950/60 border border-blue-500/30 text-blue-300 capitalize">
                            {prof.funcao}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB: LIÇÕES */}
            {activeTab === 'licoes' && (
              <div className="space-y-3">
                {licoesLoading && (
                  <div className="space-y-3 animate-pulse">
                    <div className="h-16 bg-[#111827] rounded-xl border border-slate-800 w-full" />
                    <div className="h-16 bg-[#111827] rounded-xl border border-slate-800 w-full" />
                    <div className="h-16 bg-[#111827] rounded-xl border border-slate-800 w-full" />
                  </div>
                )}

                {!licoesLoading && licoes.length === 0 && (
                  <div className="bg-[#111827] rounded-2xl border border-slate-800 p-8 text-center shadow-md">
                    <BookOpen size={32} className="text-slate-500 mx-auto mb-2" />
                    <h3 className="font-semibold text-slate-200 text-sm mb-1">Nenhuma lição encontrada</h3>
                    <p className="text-xs text-slate-400">
                      As lições deste período ainda não foram cadastradas pela coordenação.
                    </p>
                  </div>
                )}

                {!licoesLoading &&
                  licoes.map((licao) => (
                    <div
                      key={licao.id}
                      className="bg-[#111827] rounded-xl border border-slate-800 p-3.5 shadow-md transition hover:border-slate-700"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            {licao.licao_numero != null && (
                              <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-[#172033] border border-slate-700/60 text-blue-300">
                                Lição {licao.licao_numero}
                              </span>
                            )}
                            <span className="text-[11px] text-slate-400 flex items-center gap-1">
                              <Calendar size={12} />
                              {formatDateBR(licao.data_aula)}
                            </span>
                          </div>
                          <h4 className="text-xs font-bold text-slate-100 leading-snug">{licao.tema}</h4>
                          {licao.professor && (
                            <p className="text-[11px] text-slate-400">Professor: {licao.professor}</p>
                          )}
                        </div>

                        {/* Status de Presença */}
                        {licao.frequencia ? (
                          licao.frequencia.presente ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-950/40 border border-emerald-500/20 px-2 py-1 rounded-lg shrink-0">
                              <CheckCircle2 size={13} />
                              Presente
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-400 bg-rose-950/40 border border-rose-500/20 px-2 py-1 rounded-lg shrink-0">
                              <XCircle size={13} />
                              Falta
                            </span>
                          )
                        ) : (
                          <span className="text-[10px] text-slate-400 bg-[#172033] border border-slate-700/60 px-2 py-1 rounded-md shrink-0">
                            {licao.status === 'planejada' ? 'Planejada' : 'Pendente'}
                          </span>
                        )}
                      </div>

                      {licao.observacoes && (
                        <p className="mt-2 pt-2 border-t border-slate-800 text-[11px] text-slate-300">
                          {licao.observacoes}
                        </p>
                      )}
                    </div>
                  ))}
              </div>
            )}

            {/* TAB: FREQUÊNCIA */}
            {activeTab === 'frequencia' && (
              <div className="space-y-4">
                {frequenciaLoading && (
                  <div className="space-y-3 animate-pulse">
                    <div className="h-28 bg-[#111827] rounded-xl border border-slate-800 w-full" />
                    <div className="h-36 bg-[#111827] rounded-xl border border-slate-800 w-full" />
                  </div>
                )}

                {!frequenciaLoading && frequenciaData && (
                  <>
                    {/* Resumo Geral */}
                    <div className="bg-[#111827] rounded-2xl border border-slate-800 p-4 shadow-md">
                      <h2 className="text-sm font-bold text-slate-100 mb-3 flex items-center justify-between">
                        <span>Desempenho Geral de Presença</span>
                        <span className="text-emerald-400 text-xs font-bold">
                          {frequenciaData.resumo.percentual}%
                        </span>
                      </h2>

                      <div className="w-full bg-slate-800 h-3 rounded-full overflow-hidden mb-3">
                        <div
                          className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, frequenciaData.resumo.percentual)}%` }}
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-center pt-2 border-t border-slate-800">
                        <div className="bg-[#172033] p-2 rounded-xl border border-slate-700/50">
                          <p className="text-[10px] text-slate-400">Total de Aulas</p>
                          <p className="text-sm font-bold text-slate-100">
                            {frequenciaData.resumo.total_aulas}
                          </p>
                        </div>
                        <div className="bg-emerald-950/30 p-2 rounded-xl border border-emerald-500/20">
                          <p className="text-[10px] text-emerald-400">Presenças</p>
                          <p className="text-sm font-bold text-emerald-300">
                            {frequenciaData.resumo.presencas}
                          </p>
                        </div>
                        <div className="bg-rose-950/30 p-2 rounded-xl border border-rose-500/20">
                          <p className="text-[10px] text-rose-400">Faltas</p>
                          <p className="text-sm font-bold text-rose-300">
                            {frequenciaData.resumo.faltas}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Por Trimestre */}
                    {frequenciaData.por_trimestre && frequenciaData.por_trimestre.length > 0 && (
                      <div className="bg-[#111827] rounded-2xl border border-slate-800 p-4 shadow-md">
                        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                          Histórico por Trimestre
                        </h2>
                        <div className="space-y-2">
                          {frequenciaData.por_trimestre.map((trim) => (
                            <div
                              key={trim.chave}
                              className="flex items-center justify-between p-2.5 bg-[#172033] rounded-xl border border-slate-700/50"
                            >
                              <div>
                                <p className="text-xs font-semibold text-slate-100">
                                  {trim.trimestre}º Trimestre / {trim.ano}
                                </p>
                                <p className="text-[11px] text-slate-400">
                                  {trim.presencas} presença(s) em {trim.total} aula(s)
                                </p>
                              </div>
                              <span className="text-xs font-bold text-emerald-400 bg-[#111827] px-2.5 py-1 rounded-lg border border-slate-700/60">
                                {trim.percentual}%
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Histórico Detalhado */}
                    <div className="space-y-2">
                      <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">
                        Registro de Aulas
                      </h2>
                      {frequenciaData.historico.length === 0 ? (
                        <div className="bg-[#111827] rounded-xl border border-slate-800 p-6 text-center text-xs text-slate-400">
                          Nenhum registro de presença ou falta lançado ainda.
                        </div>
                      ) : (
                        frequenciaData.historico.map((item) => (
                          <div
                            key={item.id}
                            className="bg-[#111827] rounded-xl border border-slate-800 p-3 flex items-center justify-between gap-3 shadow-md"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-0.5">
                                <Calendar size={12} />
                                <span>{formatDateBR(item.data_aula)}</span>
                                {item.licao_numero && <span>• Lição {item.licao_numero}</span>}
                              </div>
                              <p className="text-xs font-semibold text-slate-100 truncate">
                                {item.tema}
                              </p>
                              {item.observacoes && (
                                <p className="text-[10px] text-slate-400 italic mt-0.5 truncate">
                                  {item.observacoes}
                                </p>
                              )}
                            </div>

                            {item.presente ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-950/40 border border-emerald-500/20 px-2.5 py-1 rounded-lg shrink-0">
                                <CheckCircle2 size={13} />
                                Presente
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-400 bg-rose-950/40 border border-rose-500/20 px-2.5 py-1 rounded-lg shrink-0">
                                <XCircle size={13} />
                                Falta
                              </span>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      <MobileBottomNav />
    </MobileShell>
  );
}
