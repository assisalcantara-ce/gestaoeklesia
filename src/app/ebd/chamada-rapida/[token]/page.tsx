'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import {
  Check,
  X,
  Users,
  UserCheck,
  Plus,
  Trash2,
  Calendar,
  BookOpen,
  AlertCircle,
  CheckCircle2,
  DollarSign,
  Send,
  Loader2,
  ShieldCheck,
  Search,
  MapPin,
  GraduationCap,
} from 'lucide-react';

interface AlunoChamada {
  id: string;
  nome: string;
  presente: boolean;
}

interface VisitanteItem {
  id?: string;
  nome: string;
  telefone: string;
}

interface TurmaInfo {
  nome: string;
  classe: string | null;
  cor: string;
  sala: string | null;
  igreja: string | null;
}

interface LicaoInfo {
  licao_numero: number | null;
  tema: string;
  observacoes: string;
}

interface ResumoFinalizado {
  total_presentes: number;
  total_visitantes: number;
  tema: string | null;
  licao_numero: number | null;
}

interface ChamadaResponse {
  finalizado: boolean;
  finalizado_em?: string;
  data_aula: string;
  expires_at?: string;
  turma: TurmaInfo;
  professor_nome: string | null;
  licao?: LicaoInfo;
  alunos?: AlunoChamada[];
  visitantes?: VisitanteItem[];
  valor_oferta?: number;
  resumo?: ResumoFinalizado;
}

// Helpers de formatação
function formatDateBR(dateStr: string): string {
  if (!dateStr) return '';
  const [ano, mes, dia] = dateStr.split('-');
  return `${dia}/${mes}/${ano}`;
}

function formatDateLong(dateStr: string): string {
  if (!dateStr) return '';
  const [ano, mes, dia] = dateStr.split('-').map(Number);
  const dataObj = new Date(ano, mes - 1, dia, 12, 0, 0);
  return dataObj.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function formatDateTimeBR(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatMoeda(val: number): string {
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function maskMoneyInput(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  const n = parseInt(digits, 10) / 100;
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseMoneyInput(masked: string): number {
  const digits = masked.replace(/\D/g, '');
  if (!digits) return 0;
  return parseInt(digits, 10) / 100;
}

export default function ChamadaRapidaPage() {
  const params = useParams();
  const rawToken = typeof params?.token === 'string' ? params.token : '';

  const [loading, setLoading] = useState(true);
  const [errorState, setErrorState] = useState<{ code: string; message: string } | null>(null);

  // Dados carregados da API
  const [dataAula, setDataAula] = useState('');
  const [turma, setTurma] = useState<TurmaInfo | null>(null);
  const [professorNome, setProfessorNome] = useState<string | null>(null);
  const [isFinalizado, setIsFinalizado] = useState(false);
  const [finalizadoEm, setFinalizadoEm] = useState<string | null>(null);
  const [resumoFinalizado, setResumoFinalizado] = useState<ResumoFinalizado | null>(null);

  // Formulário do Professor
  const [licaoNumero, setLicaoNumero] = useState<string>('');
  const [tema, setTema] = useState<string>('');
  const [observacoes, setObservacoes] = useState<string>('');
  const [alunos, setAlunos] = useState<AlunoChamada[]>([]);
  const [visitantes, setVisitantes] = useState<VisitanteItem[]>([]);
  const [ofertaStr, setOfertaStr] = useState<string>('');
  const [buscaAluno, setBuscaAluno] = useState('');

  // Novo visitante
  const [novoVisitNome, setNovoVisitNome] = useState('');
  const [novoVisitTelefone, setNovoVisitTelefone] = useState('');
  const [showVisitModal, setShowVisitModal] = useState(false);
  const [visitError, setVisitError] = useState<string | null>(null);

  // Confirmação e Submissão
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<{
    total_presentes: number;
    total_ausentes: number;
    total_visitantes: number;
    valor_oferta: number;
    finalizado_em: string;
  } | null>(null);

  // Carregar dados da chamada pelo token
  const loadChamada = useCallback(async () => {
    if (!rawToken) return;
    setLoading(true);
    setErrorState(null);

    try {
      const res = await fetch(`/api/v1/ebd/chamada/publico?token=${encodeURIComponent(rawToken)}`);
      const data = await res.json();

      if (!res.ok) {
        setErrorState({
          code: data.code || 'ERROR',
          message: data.error || 'Não foi possível carregar o link de chamada.',
        });
        setLoading(false);
        return;
      }

      const resData = data as ChamadaResponse;
      setDataAula(resData.data_aula);
      setTurma(resData.turma);
      setProfessorNome(resData.professor_nome);

      if (resData.finalizado) {
        setIsFinalizado(true);
        setFinalizadoEm(resData.finalizado_em || null);
        setResumoFinalizado(resData.resumo || null);
      } else {
        setIsFinalizado(false);
        setLicaoNumero(resData.licao?.licao_numero ? String(resData.licao.licao_numero) : '');
        setTema(resData.licao?.tema || '');
        setObservacoes(resData.licao?.observacoes || '');
        setAlunos(resData.alunos || []);
        setVisitantes(resData.visitantes || []);
        if (resData.valor_oferta && resData.valor_oferta > 0) {
          setOfertaStr(maskMoneyInput(String(Math.round(resData.valor_oferta * 100))));
        }
      }
    } catch (err: any) {
      setErrorState({
        code: 'NETWORK_ERROR',
        message: err?.message || 'Falha de conexão ao carregar a chamada.',
      });
    } finally {
      setLoading(false);
    }
  }, [rawToken]);

  useEffect(() => {
    loadChamada();
  }, [loadChamada]);

  // Ações de presença
  const togglePresenca = (id: string, valor: boolean) => {
    setAlunos((prev) =>
      prev.map((aluno) => (aluno.id === id ? { ...aluno, presente: valor } : aluno))
    );
  };

  const marcarTodosPresentes = () => {
    setAlunos((prev) => prev.map((a) => ({ ...a, presente: true })));
  };

  const marcarTodosFaltas = () => {
    setAlunos((prev) => prev.map((a) => ({ ...a, presente: false })));
  };

  // Visitantes
  const handleAddVisitante = () => {
    if (!novoVisitNome.trim()) {
      setVisitError('O nome do visitante é obrigatório.');
      return;
    }
    setVisitantes((prev) => [
      ...prev,
      {
        nome: novoVisitNome.trim(),
        telefone: novoVisitTelefone.trim(),
      },
    ]);
    setNovoVisitNome('');
    setNovoVisitTelefone('');
    setVisitError(null);
    setShowVisitModal(false);
  };

  const handleRemoveVisitante = (index: number) => {
    setVisitantes((prev) => prev.filter((_, i) => i !== index));
  };

  // Cálculos de Resumo
  const totalAlunos = alunos.length;
  const totalPresentes = useMemo(() => alunos.filter((a) => a.presente).length, [alunos]);
  const totalAusentes = totalAlunos - totalPresentes;
  const percPresenca = totalAlunos > 0 ? Math.round((totalPresentes / totalAlunos) * 100) : 0;
  const totalVisitantes = visitantes.length;

  const alunosFiltrados = useMemo(() => {
    if (!buscaAluno.trim()) return alunos;
    const term = buscaAluno.toLowerCase();
    return alunos.filter((a) => a.nome.toLowerCase().includes(term));
  }, [alunos, buscaAluno]);

  // Envio / Finalização
  const handleSalvarChamada = async () => {
    setSubmitting(true);
    try {
      const payload = {
        token: rawToken,
        licao_numero: licaoNumero ? parseInt(licaoNumero, 10) : null,
        tema: tema.trim() || null,
        observacoes: observacoes.trim() || null,
        freqs: alunos.map((a) => ({ aluno_id: a.id, presente: a.presente })),
        visitantes: visitantes.map((v) => ({ nome: v.nome, telefone: v.telefone || null })),
        valor_oferta: ofertaStr ? parseMoneyInput(ofertaStr) : 0,
      };

      const res = await fetch('/api/v1/ebd/chamada/publico/salvar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao enviar chamada.');
      }

      setSubmitSuccess({
        total_presentes: data.total_presentes,
        total_ausentes: data.total_ausentes,
        total_visitantes: data.total_visitantes,
        valor_oferta: data.valor_oferta || 0,
        finalizado_em: data.finalizado_em || new Date().toISOString(),
      });
      setShowConfirmModal(false);
    } catch (err: any) {
      alert(err?.message || 'Ocorreu um erro ao finalizar a chamada. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── ESTADO 1: CARREGANDO ─────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-slate-100">
        <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
        <p className="text-sm font-semibold tracking-wide text-slate-300">
          Carregando chamada dominical...
        </p>
      </div>
    );
  }

  // ── ESTADO 2: ERRO / LINK INVÁLIDO OU EXPIRADO ──────────────────────────────
  if (errorState) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-slate-100">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 text-center shadow-2xl">
          <div className="w-16 h-16 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle size={32} />
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Link Indisponível</h1>
          <p className="text-sm text-slate-400 leading-relaxed mb-6">{errorState.message}</p>
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 text-xs text-slate-400 text-left space-y-2">
            <div className="flex items-center gap-2 text-slate-300 font-medium">
              <ShieldCheck size={14} className="text-blue-400" />
              <span>Segurança da Escola Bíblica</span>
            </div>
            <p>
              Os links de chamada são temporários e seguros. Caso a aula já tenha ocorrido ou o link
              tenha sido renovado, solicite um novo link à superintendência da EBD.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── ESTADO 3: RECIBO DE SUCESSO APÓS SUBMISSÃO ───────────────────────────────
  if (submitSuccess) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 sm:p-6 text-slate-100">
        <div className="max-w-md w-full bg-slate-900 border border-emerald-500/30 rounded-3xl p-6 sm:p-8 text-center shadow-2xl">
          <div className="w-16 h-16 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={36} />
          </div>

          <h1 className="text-2xl font-bold text-white mb-1">Chamada Concluída!</h1>
          <p className="text-xs text-emerald-400 font-semibold uppercase tracking-wider mb-4">
            Registrada com Sucesso
          </p>

          <p className="text-sm text-slate-300 mb-6">
            A frequência e os dados da turma <strong>{turma?.nome}</strong> foram gravados com
            sucesso e já estão disponíveis para a secretaria.
          </p>

          {/* Cards de Resumo */}
          <div className="grid grid-cols-3 gap-2 bg-slate-950/80 border border-slate-800 rounded-2xl p-4 mb-4 text-center">
            <div>
              <p className="text-[11px] text-slate-400">Presentes</p>
              <p className="text-xl font-bold text-emerald-400">{submitSuccess.total_presentes}</p>
            </div>
            <div>
              <p className="text-[11px] text-slate-400">Faltas</p>
              <p className="text-xl font-bold text-rose-400">{submitSuccess.total_ausentes}</p>
            </div>
            <div>
              <p className="text-[11px] text-slate-400">Visitantes</p>
              <p className="text-xl font-bold text-blue-400">{submitSuccess.total_visitantes}</p>
            </div>
          </div>

          {submitSuccess.valor_oferta > 0 && (
            <div className="bg-emerald-950/20 border border-emerald-500/20 rounded-xl p-3 text-xs text-emerald-300 mb-4 flex items-center justify-between">
              <span>Oferta Registrada:</span>
              <strong className="text-sm font-bold text-emerald-400">
                {formatMoeda(submitSuccess.valor_oferta)}
              </strong>
            </div>
          )}

          {submitSuccess.finalizado_em && (
            <p className="text-[11px] text-slate-400 mb-6">
              Finalizado em {formatDateTimeBR(submitSuccess.finalizado_em)}
            </p>
          )}

          <p className="text-[11px] text-slate-500">
            Muito obrigado pela dedicação e ensino da Palavra de Deus! 🙏
          </p>
        </div>
      </div>
    );
  }

  // ── ESTADO 4: CHAMADA JÁ FINALIZADA ANTERIORMENTE (MODO SOMENTE LEITURA) ────
  if (isFinalizado) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center p-4 sm:p-6 text-slate-100">
        <div className="max-w-lg w-full space-y-4 my-auto">
          {/* Header */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-center shadow-lg">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-3">
              <CheckCircle2 size={13} /> Chamada Já Finalizada
            </span>
            <h1 className="text-xl font-bold text-white mb-1">{turma?.nome}</h1>
            {turma?.classe && (
              <p className="text-xs text-slate-400 font-medium">{turma.classe}</p>
            )}
            <p className="text-xs text-slate-400 mt-2 flex items-center justify-center gap-1.5">
              <Calendar size={13} className="text-blue-400" />
              {formatDateLong(dataAula)}
            </p>
            {professorNome && (
              <p className="text-xs text-slate-300 mt-1 flex items-center justify-center gap-1">
                <GraduationCap size={13} className="text-blue-400" />
                Professor: <strong>{professorNome}</strong>
              </p>
            )}
          </div>

          {/* Resumo da Chamada Realizada */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
            <h2 className="text-sm font-bold text-slate-200">Resumo da Aula</h2>

            {resumoFinalizado?.tema && (
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs">
                <span className="text-slate-400 block mb-0.5 font-medium">Tema da Lição:</span>
                <span className="font-semibold text-slate-100 text-sm">
                  {resumoFinalizado.licao_numero ? `Lição ${resumoFinalizado.licao_numero} — ` : ''}
                  {resumoFinalizado.tema}
                </span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="bg-emerald-950/20 border border-emerald-500/20 p-3 rounded-xl">
                <p className="text-xs text-emerald-400">Total de Presentes</p>
                <p className="text-2xl font-bold text-emerald-300 mt-1">
                  {resumoFinalizado?.total_presentes ?? 0}
                </p>
              </div>
              <div className="bg-blue-950/20 border border-blue-500/20 p-3 rounded-xl">
                <p className="text-xs text-blue-400">Visitantes</p>
                <p className="text-2xl font-bold text-blue-300 mt-1">
                  {resumoFinalizado?.total_visitantes ?? 0}
                </p>
              </div>
            </div>

            {finalizadoEm && (
              <p className="text-[11px] text-slate-400 text-center">
                Registro finalizado em {formatDateTimeBR(finalizadoEm)}
              </p>
            )}

            <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl text-center">
              <p className="text-xs text-slate-400">
                Esta chamada foi gravada e o link está em modo de somente leitura. Para correções
                posteriores, contate a secretaria da igreja.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── ESTADO 5: TELA ATIVA DE CHAMADA RÁPIDA NO CELULAR ────────────────────────
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center pb-28 sm:pb-32">
      {/* ── 1. CABEÇALHO DA EBD ── */}
      <header className="w-full bg-gradient-to-b from-slate-900 to-slate-950 border-b border-slate-800 sticky top-0 z-30 shadow-md">
        <div className="max-w-lg mx-auto px-4 py-3.5 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-blue-400 block mb-0.5">
              Gestão Eklésia • EBD
            </span>
            <h1 className="text-base font-bold text-white truncate">{turma?.nome}</h1>
            <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
              {turma?.igreja && (
                <span className="flex items-center gap-1">
                  <MapPin size={11} className="text-slate-500" />
                  {turma.igreja}
                </span>
              )}
              <span>•</span>
              <span className="flex items-center gap-1">
                <Calendar size={11} className="text-slate-500" />
                {formatDateBR(dataAula)}
              </span>
            </div>
            {professorNome && (
              <p className="text-[11px] text-slate-300 mt-1 flex items-center gap-1">
                <GraduationCap size={12} className="text-blue-400" />
                Professor(a): <span className="font-semibold text-white">{professorNome}</span>
              </p>
            )}
          </div>

          {turma?.classe && (
            <span
              className="text-[11px] font-semibold px-2.5 py-1 rounded-full text-white border border-white/10 shrink-0 shadow-sm"
              style={{ backgroundColor: turma.cor || '#3b82f6' }}
            >
              {turma.classe}
            </span>
          )}
        </div>
      </header>

      <main className="w-full max-w-lg px-4 py-4 space-y-4">
        {/* ── 2. DADOS DA LIÇÃO (OPCIONAL) ── */}
        <section className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-md">
          <div className="flex items-center gap-2 mb-3">
            <BookOpen size={16} className="text-blue-400" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Dados da Lição (Opcional)
            </h2>
          </div>

          <div className="grid grid-cols-4 gap-2.5">
            <div className="col-span-1">
              <label className="block text-[11px] font-medium text-slate-400 mb-1">Nº</label>
              <input
                type="number"
                value={licaoNumero}
                onChange={(e) => setLicaoNumero(e.target.value)}
                placeholder="12"
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-2.5 py-2 text-sm text-center font-bold text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="col-span-3">
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                Tema da Lição
              </label>
              <input
                type="text"
                value={tema}
                onChange={(e) => setTema(e.target.value)}
                placeholder="Ex: A Armadura de Deus"
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
        </section>

        {/* ── 3. RESUMO DE FREQUÊNCIA ── */}
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Users size={15} className="text-blue-400" />
              Contagem da Turma
            </h2>
            <span className="text-xs font-bold text-emerald-400 bg-emerald-950/40 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
              {percPresenca}% de presença
            </span>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden mb-3">
            <div
              className="bg-emerald-500 h-full transition-all duration-300"
              style={{ width: `${percPresenca}%` }}
            />
          </div>

          <div className="grid grid-cols-3 gap-2 text-center pt-1">
            <div className="bg-slate-950 p-2 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-400 block">Matriculados</span>
              <span className="text-base font-bold text-slate-100">{totalAlunos}</span>
            </div>
            <div className="bg-emerald-950/20 p-2 rounded-xl border border-emerald-500/20">
              <span className="text-[10px] text-emerald-400 block">Presentes</span>
              <span className="text-base font-bold text-emerald-300">{totalPresentes}</span>
            </div>
            <div className="bg-rose-950/20 p-2 rounded-xl border border-rose-500/20">
              <span className="text-[10px] text-rose-400 block">Faltas</span>
              <span className="text-base font-bold text-rose-300">{totalAusentes}</span>
            </div>
          </div>
        </section>

        {/* ── 4. LISTA DE ALUNOS MATRICULADOS ── */}
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2 px-1">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <UserCheck size={16} className="text-emerald-400" />
              Alunos ({totalAlunos})
            </h2>

            {/* Ações rápidas */}
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={marcarTodosPresentes}
                className="text-[11px] font-semibold text-emerald-400 bg-emerald-950/40 border border-emerald-500/20 px-2.5 py-1 rounded-lg hover:bg-emerald-900/40 transition active:scale-95"
              >
                Todos Presentes
              </button>
              <button
                type="button"
                onClick={marcarTodosFaltas}
                className="text-[11px] font-semibold text-rose-400 bg-rose-950/40 border border-rose-500/20 px-2.5 py-1 rounded-lg hover:bg-rose-900/40 transition active:scale-95"
              >
                Limpar
              </button>
            </div>
          </div>

          {/* Campo de Busca Rápida (para turmas grandes) */}
          {totalAlunos > 8 && (
            <div className="relative">
              <Search size={14} className="text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={buscaAluno}
                onChange={(e) => setBuscaAluno(e.target.value)}
                placeholder="Buscar aluno pelo nome..."
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
          )}

          {/* Lista de Alunos */}
          {alunosFiltrados.length === 0 ? (
            <div className="bg-slate-900 rounded-2xl border border-slate-800 p-8 text-center text-slate-500">
              <Users size={28} className="mx-auto mb-2 opacity-40" />
              <p className="text-xs">Nenhum aluno encontrado.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {alunosFiltrados.map((aluno, index) => (
                <div
                  key={aluno.id}
                  className={`p-3.5 rounded-2xl border transition-all duration-200 ${
                    aluno.presente
                      ? 'bg-gradient-to-r from-slate-900 to-emerald-950/20 border-emerald-500/40 shadow-sm'
                      : 'bg-slate-900 border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3 mb-2.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-5 h-5 rounded-full bg-slate-800 text-[11px] font-bold text-slate-400 flex items-center justify-center shrink-0">
                        {index + 1}
                      </span>
                      <p className="text-sm font-semibold text-white truncate">{aluno.nome}</p>
                    </div>

                    {aluno.presente ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded-md shrink-0">
                        <Check size={12} /> Presente
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 bg-slate-800 px-2 py-0.5 rounded-md shrink-0">
                        <X size={12} /> Falta
                      </span>
                    )}
                  </div>

                  {/* Botões Grandes Mobile */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => togglePresenca(aluno.id, true)}
                      className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 ${
                        aluno.presente
                          ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/40'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      <Check size={15} /> PRESENTE
                    </button>

                    <button
                      type="button"
                      onClick={() => togglePresenca(aluno.id, false)}
                      className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 ${
                        !aluno.presente
                          ? 'bg-rose-600/90 text-white shadow-lg shadow-rose-900/30'
                          : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                      }`}
                    >
                      <X size={15} /> FALTA
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── 5. VISITANTES DA AULA ── */}
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Users size={16} className="text-blue-400" />
              Visitantes ({visitantes.length})
            </h2>
            <button
              type="button"
              onClick={() => {
                setVisitError(null);
                setShowVisitModal(true);
              }}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-400 bg-blue-950/50 border border-blue-500/20 px-3 py-1.5 rounded-xl hover:bg-blue-900/40 transition active:scale-95"
            >
              <Plus size={14} /> + Adicionar Visitante
            </button>
          </div>

          {visitantes.length === 0 ? (
            <p className="text-xs text-slate-500 italic py-2 text-center">
              Nenhum visitante registrado nesta aula.
            </p>
          ) : (
            <div className="space-y-2">
              {visitantes.map((v, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-2.5 bg-slate-950 rounded-xl border border-slate-800 text-xs"
                >
                  <div>
                    <p className="font-semibold text-slate-100">{v.nome}</p>
                    {v.telefone && <p className="text-[11px] text-slate-400">{v.telefone}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveVisitante(i)}
                    className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-rose-950/20 transition"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── 6. OFERTA DA TURMA ── */}
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign size={16} className="text-emerald-400" />
            <h2 className="text-sm font-bold text-white">Oferta da Turma (Opcional)</h2>
          </div>
          <p className="text-xs text-slate-400 mb-3">
            Informe o valor arrecadado na classe para prestação de contas com a tesouraria.
          </p>
          <div className="relative max-w-xs">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
              R$
            </span>
            <input
              type="text"
              inputMode="numeric"
              value={ofertaStr}
              onChange={(e) => setOfertaStr(maskMoneyInput(e.target.value))}
              placeholder="0,00"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-11 pr-4 py-2.5 text-base font-bold text-emerald-400 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </section>
      </main>

      {/* ── 7. BOTÃO FIXO INFERIOR: FINALIZAR CHAMADA ── */}
      <footer className="fixed bottom-0 left-0 right-0 bg-slate-950/95 backdrop-blur-md border-t border-slate-800 p-3 sm:p-4 z-40">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <div className="flex-1 text-xs">
            <span className="text-slate-400 block text-[11px]">Resumo:</span>
            <strong className="text-white">
              {totalPresentes} presentes • {totalAusentes} faltas
            </strong>
          </div>

          <button
            type="button"
            onClick={() => setShowConfirmModal(true)}
            className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm rounded-xl transition-all shadow-lg shadow-blue-900/40 flex items-center justify-center gap-2 active:scale-95"
          >
            <Send size={16} />
            FINALIZAR CHAMADA
          </button>
        </div>
      </footer>

      {/* ── MODAL: ADICIONAR VISITANTE ── */}
      {showVisitModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <Plus size={16} className="text-blue-400" />
                Novo Visitante
              </h3>
              <button
                type="button"
                onClick={() => setShowVisitModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            {visitError && (
              <p className="text-xs text-rose-400 bg-rose-950/30 p-2 rounded-lg border border-rose-500/20">
                {visitError}
              </p>
            )}

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Nome do Visitante *</label>
                <input
                  type="text"
                  value={novoVisitNome}
                  onChange={(e) => setNovoVisitNome(e.target.value)}
                  placeholder="Nome completo ou conhecido"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Telefone / WhatsApp (Opcional)
                </label>
                <input
                  type="tel"
                  value={novoVisitTelefone}
                  onChange={(e) => setNovoVisitTelefone(e.target.value)}
                  placeholder="(85) 99999-9999"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowVisitModal(false)}
                className="flex-1 py-2.5 bg-slate-800 text-slate-300 font-semibold text-xs rounded-xl hover:bg-slate-700 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleAddVisitante}
                className="flex-1 py-2.5 bg-blue-600 text-white font-bold text-xs rounded-xl hover:bg-blue-500 transition shadow-lg shadow-blue-900/30"
              >
                Adicionar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: CONFIRMAÇÃO DE FINALIZAÇÃO ── */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl text-center">
            <div className="w-14 h-14 bg-blue-600/20 border border-blue-500/30 text-blue-400 rounded-full flex items-center justify-center mx-auto mb-2">
              <Send size={24} />
            </div>

            <h3 className="font-bold text-white text-lg">Finalizar Chamada?</h3>

            <p className="text-xs text-slate-300">
              Confira os números da turma <strong>{turma?.nome}</strong>:
            </p>

            {/* Resumo */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3.5 text-xs text-left space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400">Total de Alunos:</span>
                <strong className="text-slate-100">{totalAlunos}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-emerald-400 font-medium">Presentes:</span>
                <strong className="text-emerald-400 font-bold">{totalPresentes}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-rose-400 font-medium">Faltas:</span>
                <strong className="text-rose-400 font-bold">{totalAusentes}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-blue-400 font-medium">Visitantes:</span>
                <strong className="text-blue-400 font-bold">{totalVisitantes}</strong>
              </div>
              {ofertaStr && (
                <div className="flex justify-between border-t border-slate-800 pt-1.5 text-emerald-400">
                  <span>Oferta:</span>
                  <strong>R$ {ofertaStr}</strong>
                </div>
              )}
            </div>

            <p className="text-[11px] text-amber-400/90 bg-amber-950/20 border border-amber-500/20 p-2.5 rounded-xl">
              ⚠️ Após finalizar, o registro será gravado e este link ficará disponível apenas para
              consulta.
            </p>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 py-2.5 bg-slate-800 text-slate-300 font-semibold text-xs rounded-xl hover:bg-slate-700 transition"
              >
                Revisar
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleSalvarChamada}
                className="flex-1 py-2.5 bg-blue-600 text-white font-bold text-xs rounded-xl hover:bg-blue-500 transition shadow-lg shadow-blue-900/30 flex items-center justify-center gap-1.5"
              >
                {submitting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Enviando...
                  </>
                ) : (
                  'Confirmar e Enviar'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
