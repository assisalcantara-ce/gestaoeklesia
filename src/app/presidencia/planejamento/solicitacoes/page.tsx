'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import PageLayout from '@/components/PageLayout';
import { useRequireSupabaseAuth } from '@/hooks/useRequireSupabaseAuth';
import { useRequireModulo } from '@/hooks/useRequireModulo';
import { createClient } from '@/lib/supabase-client';
import { resolveMinistryId } from '@/lib/cartoes-templates-sync';
import { useAuditLog } from '@/hooks/useAuditLog';
import {
  XCircle, AlertTriangle, FileText, Clock,
  CheckCircle2, X, ChevronDown, ChevronUp,
  ShieldCheck, Ban, Gavel, Info, Filter
} from 'lucide-react';

interface SolicitacaoExcecao {
  id: string;
  ministry_id: string;
  planejamento_id: string | null;
  evento_id: string | null;
  solicitante_id: string | null;
  tipo_solicitacao: 'conflito_data' | 'alteracao_data' | 'alteracao_escopo' | 'coexistencia' | 'criacao_evento';
  escopo: 'organizacao' | 'divisao1' | 'divisao2' | 'divisao3';
  titulo: string;
  justificativa: string;
  data_inicio: string;
  data_fim: string | null;
  conflito_id: string | null;
  status: 'pendente' | 'aprovado' | 'rejeitado' | 'cancelado';
  tipo_decisao: 'aprovar' | 'rejeitar' | 'aprovar_com_restricao' | null;
  numero_decisao: string | null;
  vigencia_tipo: 'unica' | 'temporaria' | 'permanente';
  vigencia_inicio: string | null;
  vigencia_fim: string | null;
  efeito: 'autorizar_evento' | 'permitir_coexistencia' | 'alterar_escopo' | 'alterar_data' | 'outro' | null;
  analisado_por: string | null;
  analisado_em: string | null;
  parecer: string | null;
  created_at: string;
  conflito_evento?: { titulo: string } | null;
}

const TIPO_SOLICITACAO_LABEL = {
  conflito_data: 'Conflito de Data',
  alteracao_data: 'Alteração de Data',
  alteracao_escopo: 'Alteração de Escopo',
  coexistencia: 'Coexistência de Eventos',
  criacao_evento: 'Criação de Evento Extra',
};

const ESCOPO_LABEL = {
  organizacao: 'Organização',
  divisao1: 'Nível 1',
  divisao2: 'Nível 2',
  divisao3: 'Nível 3',
};

const EFEITO_LABEL = {
  autorizar_evento: 'Autorizar Evento',
  permitir_coexistencia: 'Permitir Coexistência',
  alterar_escopo: 'Alterar Escopo',
  alterar_data: 'Alterar Data',
  outro: 'Outro Efeito',
};

const VIGENCIA_LABEL = {
  unica: 'Única',
  temporaria: 'Temporária',
  permanente: 'Permanente',
};

// ─── Badge helpers ────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  pendente:  { label: 'Pendente',  cls: 'bg-amber-50 text-amber-700 border-amber-200',    icon: <Clock className="h-3 w-3" /> },
  aprovado:  { label: 'Aprovado',  cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: <CheckCircle2 className="h-3 w-3" /> },
  rejeitado: { label: 'Rejeitado', cls: 'bg-rose-50 text-rose-700 border-rose-200',       icon: <XCircle className="h-3 w-3" /> },
  cancelado: { label: 'Cancelado', cls: 'bg-slate-100 text-slate-600 border-slate-200',   icon: <Ban className="h-3 w-3" /> },
};

const DECISAO_BADGE: Record<string, { label: string; cls: string }> = {
  aprovar:              { label: 'Aprovado',            cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  aprovar_com_restricao: { label: 'Aprovado c/ Restrição', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  rejeitar:             { label: 'Rejeitado',           cls: 'bg-rose-50 text-rose-700 border-rose-200' },
};

export default function SolicitacoesPage() {
  const { user } = useRequireSupabaseAuth();
  const { ctx, bloqueado } = useRequireModulo('presidencia');
  const supabase = useMemo(() => createClient(), []);
  const { registrarAcao } = useAuditLog();

  const [ministryId, setMinistryId] = useState<string | null>(null);
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoExcecao[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);

  // Quick filter por status
  const [activeStatus, setActiveStatus] = useState<string>('pendente');

  // Filtros avançados
  const [showAdvFilters, setShowAdvFilters] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState<string>('');
  const [filtroVigencia, setFiltroVigencia] = useState<string>('');
  const [filtroEfeito, setFiltroEfeito] = useState<string>('');

  // Manter compatibilidade com filtroStatus
  const filtroStatus = activeStatus;

  // Análise Modal
  const [showAnaliseModal, setShowAnaliseModal] = useState(false);
  const [activeSol, setActiveSol] = useState<SolicitacaoExcecao | null>(null);
  const [analiseForm, setAnaliseForm] = useState({
    tipo_decisao: 'aprovar' as 'aprovar' | 'rejeitar' | 'aprovar_com_restricao',
    efeito: 'autorizar_evento' as SolicitacaoExcecao['efeito'],
    vigencia_tipo: 'unica' as SolicitacaoExcecao['vigencia_tipo'],
    vigencia_inicio: '',
    vigencia_fim: '',
    parecer: '',
  });

  const isPresidenciaOrAdmin = ctx.nivel === 'administrador' || ctx.nivel === 'presidencia';

  const flash = (tipo: 'ok' | 'erro', texto: string) => {
    setMsg({ tipo, texto });
    setTimeout(() => setMsg(null), 4000);
  };

  const loadSolicitacoes = useCallback(async (mid: string) => {
    setLoading(true);
    try {
      let query = supabase
        .from('agenda_solicitacoes')
        .select('*')
        .eq('ministry_id', mid);

      if (filtroStatus) query = query.eq('status', filtroStatus);
      if (filtroTipo) query = query.eq('tipo_solicitacao', filtroTipo);
      if (filtroVigencia) query = query.eq('vigencia_tipo', filtroVigencia);
      if (filtroEfeito) query = query.eq('efeito', filtroEfeito);

      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;

      const resolved = await Promise.all((data as SolicitacaoExcecao[] ?? []).map(async (item) => {
        if (item.conflito_id) {
          const { data: cEvt } = await supabase
            .from('agenda_eventos')
            .select('titulo')
            .eq('id', item.conflito_id)
            .maybeSingle();
          return { ...item, conflito_evento: cEvt };
        }
        return item;
      }));

      setSolicitacoes(resolved);
    } catch (err) {
      console.error(err);
      flash('erro', 'Erro ao buscar solicitações.');
    } finally {
      setLoading(false);
    }
  }, [supabase, filtroStatus, filtroTipo, filtroVigencia, filtroEfeito]);

  useEffect(() => {
    if (!user || bloqueado) return;
    resolveMinistryId(supabase).then((mid) => {
      if (mid) {
        setMinistryId(mid);
      }
    });
  }, [user, bloqueado, supabase]);

  useEffect(() => {
    if (ministryId) {
      loadSolicitacoes(ministryId);
    }
  }, [ministryId, loadSolicitacoes]);

  const openAnalise = (sol: SolicitacaoExcecao) => {
    if (!isPresidenciaOrAdmin) {
      flash('erro', 'Apenas membros da Presidência ou Administradores podem analisar solicitações.');
      return;
    }
    setActiveSol(sol);
    setAnaliseForm({
      tipo_decisao: 'aprovar',
      efeito: 'autorizar_evento',
      vigencia_tipo: 'unica',
      vigencia_inicio: '',
      vigencia_fim: '',
      parecer: '',
    });
    setShowAnaliseModal(true);
  };

  const handleSubmeterAnalise = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ministryId || !activeSol || !isPresidenciaOrAdmin) return;
    if (!analiseForm.parecer.trim()) {
      flash('erro', 'O parecer de justificativa é obrigatório.');
      return;
    }

    try {
      const statusFinal = analiseForm.tipo_decisao === 'rejeitar' ? 'rejeitado' : 'aprovado';

      const payload = {
        status: statusFinal,
        tipo_decisao: analiseForm.tipo_decisao,
        efeito: statusFinal === 'rejeitado' ? null : analiseForm.efeito,
        vigencia_tipo: statusFinal === 'rejeitado' ? 'unica' : analiseForm.vigencia_tipo,
        vigencia_inicio: statusFinal === 'rejeitado' || !analiseForm.vigencia_inicio ? null : new Date(analiseForm.vigencia_inicio).toISOString(),
        vigencia_fim: statusFinal === 'rejeitado' || !analiseForm.vigencia_fim ? null : new Date(analiseForm.vigencia_fim).toISOString(),
        parecer: analiseForm.parecer.trim(),
        analisado_por: user?.id || null,
        analisado_em: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('agenda_solicitacoes')
        .update(payload)
        .eq('id', activeSol.id);

      if (error) throw error;

      await registrarAcao({
        acao: 'atualizar_status',
        modulo: 'agenda',
        area: 'solicitacao_analise',
        tabela_afetada: 'agenda_solicitacoes',
        registro_id: activeSol.id,
        descricao: `Analisou solicitação de exceção "${activeSol.titulo}". Decisão: ${analiseForm.tipo_decisao}. Efeito: ${analiseForm.efeito}.`,
        status: statusFinal === 'aprovado' ? 'sucesso' : 'aviso',
      });

      flash('ok', `Decisão de ${statusFinal} gravada com sucesso!`);
      setShowAnaliseModal(false);
      loadSolicitacoes(ministryId);
    } catch (err: any) {
      console.error(err);
      flash('erro', 'Erro ao salvar decisão.');
    }
  };

  if (ctx.loading) return <div className="p-8">Carregando permissões do módulo...</div>;
  if (bloqueado) return null;

  const STATUS_PILLS = [
    { key: 'pendente',  label: '🟠 Pendentes' },
    { key: 'aprovado',  label: '🟢 Aprovados' },
    { key: 'rejeitado', label: '🔴 Rejeitados' },
    { key: 'cancelado', label: '⚫ Cancelados' },
    { key: '',          label: 'Todos' },
  ];

  return (
    <PageLayout
      title="Presidência — Planejamento"
      description="Gerenciamento de decisões e atos administrativos do Planejamento Oficial"
      activeMenu="presidencia"
    >
      {/* ─── Feedback ───────────────────────────────────────────────────── */}
      {msg && (
        <div className={`p-3.5 mb-5 rounded-xl border flex items-center gap-3 text-sm font-medium transition-all duration-300 ${
          msg.tipo === 'ok'
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
            : 'bg-rose-50 text-rose-800 border-rose-200'
        }`}>
          {msg.tipo === 'ok'
            ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            : <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />}
          {msg.texto}
        </div>
      )}

      {/* ─── Barra de filtros ───────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm mb-6 overflow-hidden">

        {/* Quick status pills */}
        <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-100 overflow-x-auto">
          {STATUS_PILLS.map(p => (
            <button
              key={p.key}
              onClick={() => setActiveStatus(p.key)}
              className={`shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition ${
                activeStatus === p.key
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
              }`}
            >
              {p.label}
            </button>
          ))}

          <div className="ml-auto shrink-0">
            <button
              onClick={() => setShowAdvFilters(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-xs font-semibold transition ${
                showAdvFilters || filtroTipo || filtroVigencia || filtroEfeito
                  ? 'border-blue-300 text-blue-600 bg-blue-50'
                  : 'border-slate-200 text-slate-500 hover:bg-slate-50'
              }`}
            >
              <Filter className="h-3.5 w-3.5" />
              Filtros avançados
              {showAdvFilters ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
          </div>
        </div>

        {/* Filtros avançados recolhíveis */}
        {showAdvFilters && (
          <div className="px-5 py-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Tipo de Solicitação</label>
              <select
                value={filtroTipo}
                onChange={(e) => setFiltroTipo(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none text-slate-700 bg-white"
              >
                <option value="">Todos os tipos</option>
                <option value="conflito_data">Conflito de Data</option>
                <option value="alteracao_data">Alteração de Data</option>
                <option value="alteracao_escopo">Alteração de Escopo</option>
                <option value="coexistencia">Coexistência</option>
                <option value="criacao_evento">Evento Extra</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Vigência</label>
              <select
                value={filtroVigencia}
                onChange={(e) => setFiltroVigencia(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none text-slate-700 bg-white"
              >
                <option value="">Todas</option>
                <option value="unica">Única</option>
                <option value="temporaria">Temporária</option>
                <option value="permanente">Permanente</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Efeito</label>
              <select
                value={filtroEfeito}
                onChange={(e) => setFiltroEfeito(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none text-slate-700 bg-white"
              >
                <option value="">Todos</option>
                <option value="autorizar_evento">Autorizar Evento</option>
                <option value="permitir_coexistencia">Permitir Coexistência</option>
                <option value="alterar_escopo">Alterar Escopo</option>
                <option value="alterar_data">Alterar Data</option>
                <option value="outro">Outro</option>
              </select>
            </div>

            {(filtroTipo || filtroVigencia || filtroEfeito) && (
              <div className="md:col-span-3 flex justify-end">
                <button
                  onClick={() => { setFiltroTipo(''); setFiltroVigencia(''); setFiltroEfeito(''); }}
                  className="text-xs text-rose-500 hover:text-rose-700 font-semibold flex items-center gap-1"
                >
                  <X className="h-3 w-3" /> Limpar
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── Listagem de Solicitações ────────────────────────────────────── */}
      {loading ? (
        <div className="bg-white p-12 text-center text-slate-400 rounded-2xl shadow-sm border border-slate-100 text-sm">
          Carregando solicitações...
        </div>
      ) : solicitacoes.length === 0 ? (
        <div className="bg-white p-16 text-center text-slate-400 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center justify-center gap-3">
          <FileText className="h-10 w-10 text-slate-200" />
          <p className="text-base font-semibold text-slate-500">Nenhuma solicitação encontrada.</p>
          <p className="text-xs">Tente ajustar os filtros aplicados.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {solicitacoes.map((sol) => {
            const statusBadge = STATUS_BADGE[sol.status] ?? STATUS_BADGE['cancelado'];
            const dataInicio = new Date(sol.data_inicio);
            const createdAt = new Date(sol.created_at);

            return (
              <div
                key={sol.id}
                className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition hover:shadow-md ${
                  sol.status === 'pendente' ? 'border-amber-200 border-l-4 border-l-amber-400' :
                  sol.status === 'aprovado' ? 'border-emerald-100 border-l-4 border-l-emerald-400' :
                  sol.status === 'rejeitado' ? 'border-rose-100 border-l-4 border-l-rose-400' :
                  'border-slate-100'
                }`}
              >
                {/* Cabeçalho do card */}
                <div className="px-5 pt-4 pb-3 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    {/* Badges de status e tipo */}
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      <span className={`flex items-center gap-1 text-[10px] px-2.5 py-0.5 rounded-full font-bold border ${statusBadge.cls}`}>
                        {statusBadge.icon}
                        {statusBadge.label}
                      </span>
                      <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-semibold border border-slate-200">
                        {TIPO_SOLICITACAO_LABEL[sol.tipo_solicitacao]}
                      </span>
                      <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-semibold border border-blue-100">
                        {ESCOPO_LABEL[sol.escopo]}
                      </span>
                      {sol.numero_decisao && (
                        <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-mono border border-indigo-100">
                          {sol.numero_decisao}
                        </span>
                      )}
                    </div>

                    {/* Título */}
                    <h3 className="text-base font-bold text-slate-800 leading-snug">{sol.titulo}</h3>

                    {/* Meta row */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-xs text-slate-400 font-medium">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Data solicitada: {dataInicio.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                      <span className="flex items-center gap-1">
                        <Info className="h-3 w-3" />
                        Registrado em: {createdAt.toLocaleDateString('pt-BR')}
                      </span>
                      {sol.conflito_evento && (
                        <span className="flex items-center gap-1 text-amber-600 font-semibold">
                          <AlertTriangle className="h-3 w-3 shrink-0" />
                          Conflito c/ "{sol.conflito_evento.titulo}"
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Ação: Analisar */}
                  {sol.status === 'pendente' && isPresidenciaOrAdmin && (
                    <button
                      onClick={() => openAnalise(sol)}
                      className="shrink-0 flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition shadow-md shadow-blue-500/10 self-start"
                    >
                      <Gavel className="h-3.5 w-3.5" />
                      Analisar
                    </button>
                  )}
                </div>

                {/* Justificativa */}
                <div className="px-5 pb-3">
                  <div className="bg-slate-50 rounded-xl border border-slate-100 p-3">
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Justificativa</p>
                    <p className="text-sm text-slate-700 italic leading-relaxed">"{sol.justificativa}"</p>
                  </div>
                </div>

                {/* Resultado da análise */}
                {sol.status !== 'pendente' && sol.tipo_decisao && (
                  <div className="px-5 pb-4 border-t border-slate-100 pt-3">
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold border flex items-center gap-1 ${DECISAO_BADGE[sol.tipo_decisao]?.cls ?? ''}`}>
                        <ShieldCheck className="h-3 w-3" />
                        {DECISAO_BADGE[sol.tipo_decisao]?.label ?? sol.tipo_decisao}
                      </span>
                      {sol.efeito && (
                        <span className="text-[10px] bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded-full font-semibold">
                          {EFEITO_LABEL[sol.efeito]}
                        </span>
                      )}
                      {sol.vigencia_tipo && (
                        <span className="text-[10px] bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded-full font-semibold">
                          Vigência: {VIGENCIA_LABEL[sol.vigencia_tipo]}
                        </span>
                      )}
                      {sol.analisado_em && (
                        <span className="text-[10px] text-slate-400 font-medium">
                          em {new Date(sol.analisado_em).toLocaleDateString('pt-BR')}
                        </span>
                      )}
                    </div>
                    {sol.parecer && (
                      <div className="bg-indigo-50 rounded-xl border border-indigo-100 p-3">
                        <p className="text-[10px] font-bold text-indigo-500 uppercase mb-1">Parecer Administrativo</p>
                        <p className="text-sm text-indigo-900 leading-relaxed">"{sol.parecer}"</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Modal de Análise ───────────────────────────────────────────── */}
      {showAnaliseModal && activeSol && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-lg shadow-2xl border border-slate-100 flex flex-col max-h-[92vh]">

            {/* Header */}
            <div className="p-5 border-b border-slate-100 flex items-start justify-between shrink-0">
              <div className="flex-1 min-w-0 pr-3">
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <Gavel className="h-5 w-5 text-blue-500 shrink-0" />
                  Análise de Solicitação
                </h2>
                <p className="text-xs text-slate-500 mt-0.5 truncate">{activeSol.titulo}</p>
              </div>
              <button
                onClick={() => setShowAnaliseModal(false)}
                className="p-2 text-slate-400 hover:bg-slate-100 rounded-xl transition shrink-0"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmeterAnalise} className="flex-1 overflow-y-auto">
              <div className="p-5 space-y-4">

                {/* Contexto da solicitação */}
                <div className="bg-slate-50 rounded-xl border border-slate-100 p-4 space-y-2">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Contexto da Solicitação</p>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-bold">
                      {TIPO_SOLICITACAO_LABEL[activeSol.tipo_solicitacao]}
                    </span>
                    <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded-full font-semibold">
                      {ESCOPO_LABEL[activeSol.escopo]}
                    </span>
                  </div>
                  <p className="text-sm text-slate-700 font-medium">{activeSol.titulo}</p>
                  <p className="text-xs text-slate-500 italic">"{activeSol.justificativa}"</p>
                  {activeSol.conflito_evento && (
                    <p className="text-xs text-amber-600 font-semibold flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      Conflito com: {activeSol.conflito_evento.titulo}
                    </p>
                  )}
                </div>

                {/* Decisão */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5">Decisão *</label>
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      { val: 'aprovar', label: '✅ Aprovar', cls: 'border-emerald-300 bg-emerald-50 text-emerald-700' },
                      { val: 'aprovar_com_restricao', label: '⚠️ Restrito', cls: 'border-amber-300 bg-amber-50 text-amber-700' },
                      { val: 'rejeitar', label: '❌ Rejeitar', cls: 'border-rose-300 bg-rose-50 text-rose-700' },
                    ]).map(opt => (
                      <button
                        key={opt.val}
                        type="button"
                        onClick={() => setAnaliseForm({ ...analiseForm, tipo_decisao: opt.val as any })}
                        className={`py-2.5 rounded-xl text-xs font-bold border-2 transition text-center ${
                          analiseForm.tipo_decisao === opt.val ? opt.cls : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Campos condicionais se aprovado */}
                {analiseForm.tipo_decisao !== 'rejeitar' && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1.5">Efeito da Decisão *</label>
                        <select
                          value={analiseForm.efeito || ''}
                          onChange={(e) => setAnaliseForm({ ...analiseForm, efeito: e.target.value as any })}
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                        >
                          <option value="autorizar_evento">Autorizar Evento</option>
                          <option value="permitir_coexistencia">Permitir Coexistência</option>
                          <option value="alterar_escopo">Alterar Escopo</option>
                          <option value="alterar_data">Alterar Data</option>
                          <option value="outro">Outro</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1.5">Vigência *</label>
                        <select
                          value={analiseForm.vigencia_tipo}
                          onChange={(e) => setAnaliseForm({ ...analiseForm, vigencia_tipo: e.target.value as any })}
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                        >
                          <option value="unica">Única</option>
                          <option value="temporaria">Temporária</option>
                          <option value="permanente">Permanente</option>
                        </select>
                      </div>
                    </div>

                    {analiseForm.vigencia_tipo === 'temporaria' && (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1.5">Início da Vigência</label>
                          <input
                            type="date"
                            value={analiseForm.vigencia_inicio}
                            onChange={(e) => setAnaliseForm({ ...analiseForm, vigencia_inicio: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1.5">Fim da Vigência</label>
                          <input
                            type="date"
                            value={analiseForm.vigencia_fim}
                            onChange={(e) => setAnaliseForm({ ...analiseForm, vigencia_fim: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                          />
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Parecer */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5">Parecer Administrativo *</label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Fundamento da decisão sobre esta solicitação..."
                    value={analiseForm.parecer}
                    onChange={(e) => setAnaliseForm({ ...analiseForm, parecer: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-between gap-3 shrink-0 bg-slate-50/50">
                <button
                  type="button"
                  onClick={() => setShowAnaliseModal(false)}
                  className="px-5 py-2.5 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-white transition text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className={`px-6 py-2.5 text-white font-bold rounded-xl transition text-sm shadow-md ${
                    analiseForm.tipo_decisao === 'rejeitar'
                      ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-500/10'
                      : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/10'
                  }`}
                >
                  {analiseForm.tipo_decisao === 'rejeitar' ? 'Rejeitar Solicitação' :
                   analiseForm.tipo_decisao === 'aprovar_com_restricao' ? 'Aprovar com Restrição' :
                   'Aprovar Exceção'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PageLayout>
  );
}
