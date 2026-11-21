'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import {
  Check,
  Users,
  UserCheck,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Send,
  Loader2,
  Clock,
  Sparkles,
  Home,
  MapPin
} from 'lucide-react';

interface ParticipanteChamada {
  id: string;
  member_id: string | null;
  nome_completo: string;
  papel: string;
  presente: boolean;
}

interface DadosPublicosChamada {
  token: {
    id: string;
    tipo_acesso: string;
    expires_at: string;
    status: string;
  };
  celula: {
    id: string;
    nome: string;
    codigo: string | null;
    dia_semana: number;
    horario: string | null;
    modalidade: string;
    bairro: string | null;
    cidade: string | null;
  };
  reuniao: {
    id: string;
    data_reuniao: string;
    horario_inicio: string;
    modalidade: string;
    status: string;
    tema_estudo: string | null;
    observacoes: string | null;
    presentes_membros: number;
    presentes_visitantes: number;
    presentes_criancas: number;
    conversoes_decisoes: number;
    valor_oferta: number;
  } | null;
  is_finalizada: boolean;
  config: {
    termo_celula: string;
    frequencia_obrigatoria: string;
  };
  participantes: {
    id: string;
    member_id: string | null;
    nome_completo: string;
    papel: string;
  }[];
}

export default function ChamadaRapidaCelulaPage() {
  const params = useParams();
  const rawToken = typeof params?.token === 'string' ? params.token : '';

  const [loading, setLoading] = useState(true);
  const [errorState, setErrorState] = useState<{ code: string; message: string } | null>(null);

  // Dados carregados da API
  const [dados, setDados] = useState<DadosPublicosChamada | null>(null);

  // Estados do Formulário
  const [participantes, setParticipantes] = useState<ParticipanteChamada[]>([]);
  const [temaEstudo, setTemaEstudo] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [presentesVisitantes, setPresentesVisitantes] = useState<number>(0);
  const [presentesCriancas, setPresentesCriancas] = useState<number>(0);
  const [conversoesDecisoes, setConversoesDecisoes] = useState<number>(0);
  const [reconciliacoes, setReconciliacoes] = useState<number>(0);
  const [testemunhos, setTestemunhos] = useState<number>(0);
  const [pedidosOracao] = useState<number>(0);
  const [valorOferta, setValorOferta] = useState<number>(0);
  const [busca, setBusca] = useState('');

  // Estados de Submissão
  const [submitting, setSubmitting] = useState(false);
  const [sucessoEnvio, setSucessoEnvio] = useState<{
    finalizada: boolean;
    total_presentes: number;
  } | null>(null);

  // Carregar dados da chamada rápida
  const carregarChamada = useCallback(async () => {
    if (!rawToken) return;
    try {
      setLoading(true);
      setErrorState(null);

      const res = await fetch(`/api/v1/public/celulas/chamada-rapida?token=${encodeURIComponent(rawToken)}`);
      const json = await res.json();

      if (!res.ok) {
        setErrorState({
          code: json.code || 'ERROR',
          message: json.error || 'Não foi possível carregar o link de chamada.',
        });
        setLoading(false);
        return;
      }

      const d: DadosPublicosChamada = json.data;
      setDados(d);

      // Preencher formulário
      setTemaEstudo(d.reuniao?.tema_estudo || '');
      setObservacoes(d.reuniao?.observacoes || '');
      setPresentesVisitantes(d.reuniao?.presentes_visitantes || 0);
      setPresentesCriancas(d.reuniao?.presentes_criancas || 0);
      setConversoesDecisoes(d.reuniao?.conversoes_decisoes || 0);
      setValorOferta(d.reuniao?.valor_oferta || 0);

      // Participantes nominais
      setParticipantes(
        d.participantes.map((p) => ({
          ...p,
          presente: true, // Pré-seleciona presentes por padrão para agilidade no celular
        }))
      );
    } catch (err: any) {
      setErrorState({
        code: 'NETWORK_ERROR',
        message: 'Erro ao conectar ao servidor. Verifique sua conexão à internet.',
      });
    } finally {
      setLoading(false);
    }
  }, [rawToken]);

  useEffect(() => {
    carregarChamada();
  }, [carregarChamada]);

  // Contagem de presentes calculada
  const totalMembrosPresentes = useMemo(() => {
    return participantes.filter((p) => p.presente).length;
  }, [participantes]);

  const totalGeralPessoas = totalMembrosPresentes + presentesVisitantes;

  // Filtragem local na lista nominal
  const participantesFiltrados = useMemo(() => {
    if (!busca.trim()) return participantes;
    return participantes.filter((p) =>
      p.nome_completo.toLowerCase().includes(busca.toLowerCase())
    );
  }, [participantes, busca]);

  const togglePresenca = (id: string) => {
    setParticipantes((prev) =>
      prev.map((p) => (p.id === id ? { ...p, presente: !p.presente } : p))
    );
  };

  const alternarTodos = (marcar: boolean) => {
    setParticipantes((prev) => prev.map((p) => ({ ...p, presente: marcar })));
  };

  // Submissão da Frequência
  const handleEnviarFrequencia = async (finalizar: boolean) => {
    if (submitting) return;

    try {
      setSubmitting(true);
      setErrorState(null);

      const payload = {
        token: rawToken,
        tema_estudo: temaEstudo,
        observacoes,
        presentes_visitantes: Number(presentesVisitantes),
        presentes_criancas: Number(presentesCriancas),
        conversoes_decisoes: Number(conversoesDecisoes),
        reconciliacoes: Number(reconciliacoes),
        testemunhos: Number(testemunhos),
        pedidos_oracao: Number(pedidosOracao),
        valor_oferta: Number(valorOferta),
        frequencias: participantes.map((p) => {
          let tipo = 'membro';
          if (p.papel === 'crianca') tipo = 'crianca';
          else if (p.papel === 'visitante_regular') tipo = 'visitante';
          else if (p.papel === 'congregante') tipo = 'congregante';

          return {
            member_id: p.member_id,
            nome_participante: p.nome_completo,
            tipo_participante: tipo,
            presente: p.presente,
          };
        }),
        finalizar,
      };

      const res = await fetch('/api/v1/public/celulas/chamada-rapida/salvar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const resJson = await res.json();
      if (!res.ok) {
        throw new Error(resJson.error || 'Erro ao registrar frequência da chamada.');
      }

      setSucessoEnvio({
        finalizada: finalizar,
        total_presentes: resJson.data?.total_presentes || totalGeralPessoas,
      });
    } catch (err: any) {
      setErrorState({
        code: 'SUBMISSION_FAILED',
        message: err.message || 'Falha ao salvar chamada rápida.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // --------------------------------------------------------------------------
  // Telas de Erro / Bloqueio Governança
  // --------------------------------------------------------------------------
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl border border-slate-200/90 shadow-sm max-w-sm w-full text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-teal-600 mx-auto" />
          <h2 className="text-base font-bold text-slate-800">Carregando Chamada</h2>
          <p className="text-xs text-slate-500">Validando link de acesso rápido...</p>
        </div>
      </div>
    );
  }

  if (errorState) {
    const isExpired = errorState.code === 'EXPIRED';
    const isRevoked = errorState.code === 'REVOKED';

    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm max-w-md w-full text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto">
            {isExpired ? <Clock className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {isExpired ? 'Link de Chamada Expirado' : isRevoked ? 'Link Revogado' : 'Acesso Não Autorizado'}
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 mt-1 leading-relaxed">
              {errorState.message}
            </p>
          </div>
          <p className="text-xs text-slate-400 border-t border-slate-100 pt-3">
            Caso precise lançar a presença desta reunião, solicite um novo link ao coordenador ou secretaria de sua igreja.
          </p>
        </div>
      </div>
    );
  }

  if (dados?.is_finalizada || dados?.token.status === 'finalizado') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-6 sm:p-8 rounded-2xl border border-emerald-200 shadow-sm max-w-md w-full text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Chamada Já Finalizada</h2>
            <p className="text-xs sm:text-sm text-slate-600 mt-1 leading-relaxed">
              A frequência desta reunião já foi enviada e homologada no sistema ministerial.
            </p>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-600 text-left space-y-1">
            <p><strong>Célula:</strong> {dados.celula.nome}</p>
            {dados.reuniao && (
              <p><strong>Data:</strong> {new Date(`${dados.reuniao.data_reuniao}T12:00:00`).toLocaleDateString('pt-BR')}</p>
            )}
            <p><strong>Total Registrado:</strong> {dados.reuniao?.presentes_membros || 0} membros e {dados.reuniao?.presentes_visitantes || 0} visitantes</p>
          </div>
          <p className="text-[11px] text-slate-400">
            Qualquer retificação posterior deve ser realizada diretamente pelo painel administrativo com justificativa de governança.
          </p>
        </div>
      </div>
    );
  }

  if (sucessoEnvio) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-6 sm:p-8 rounded-2xl border border-emerald-200 shadow-sm max-w-md w-full text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {sucessoEnvio.finalizada ? 'Chamada Finalizada com Sucesso!' : 'Rascunho Salvo com Sucesso!'}
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 mt-1 leading-relaxed">
              {sucessoEnvio.finalizada
                ? 'Os dados de frequência e indicadores foram consolidados e enviados para a liderança da igreja.'
                : 'As presenças parciais foram gravadas. Você ainda pode atualizar antes de finalizar.'}
            </p>
          </div>
          <div className="p-4 bg-emerald-50/60 rounded-xl border border-emerald-200 text-xs text-emerald-900">
            <span className="font-bold text-sm block">Total: {sucessoEnvio.total_presentes} presentes</span>
            <span className="text-[11px] text-emerald-700">Deus abençoe o ministério e o pequeno grupo!</span>
          </div>
          {!sucessoEnvio.finalizada && (
            <button
              type="button"
              onClick={() => setSucessoEnvio(null)}
              className="px-4 py-2.5 bg-teal-700 text-white font-bold rounded-xl text-xs hover:bg-teal-800 transition"
            >
              Continuar Editando
            </button>
          )}
        </div>
      </div>
    );
  }

  const celula = dados?.celula;
  const reuniao = dados?.reuniao;
  const dataExibicao = reuniao?.data_reuniao
    ? new Date(`${reuniao.data_reuniao}T12:00:00`).toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    : 'Data Atual';

  return (
    <div className="min-h-screen bg-[#f4f7fa] pb-12">
      {/* Topo Institucional Mobile-first */}
      <header className="bg-teal-800 text-white shadow-sm border-b border-teal-900 sticky top-0 z-30">
        <div className="max-w-2xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-teal-700 flex items-center justify-center font-bold text-white border border-teal-600 flex-shrink-0">
              <Home size={16} />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-black truncate">{celula?.nome || 'Célula'}</h1>
              <p className="text-[11px] text-teal-200 truncate capitalize">
                Chamada Rápida • {dataExibicao}
              </p>
            </div>
          </div>

          <div className="bg-teal-900/80 px-2.5 py-1 rounded-lg border border-teal-700/60 text-right">
            <span className="text-[10px] text-teal-300 block font-medium uppercase">Presentes</span>
            <span className="text-xs font-black text-white">{totalGeralPessoas}</span>
          </div>
        </div>
      </header>

      {/* Container Principal */}
      <main className="max-w-2xl mx-auto px-4 py-5 space-y-4">
        {/* Card de Identificação */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-600">
            <span className="flex items-center gap-1 text-slate-700 font-bold">
              <Calendar size={14} className="text-teal-700" />
              {reuniao?.horario_inicio?.slice(0, 5) || celula?.horario?.slice(0, 5) || '20:00'}
            </span>
            <span className="flex items-center gap-1 text-slate-500">
              <MapPin size={14} />
              {celula?.bairro ? `${celula.bairro}${celula.cidade ? `, ${celula.cidade}` : ''}` : 'Local da Célula'}
            </span>
          </div>

          <div className="pt-2 border-t border-slate-100">
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
              Tema do Estudo / Palavra
            </label>
            <input
              type="text"
              value={temaEstudo}
              onChange={(e) => setTemaEstudo(e.target.value)}
              placeholder="Ex: Amor de Deus, Fé em Tempos Difíceis..."
              className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600"
            />
          </div>
        </div>

        {/* Lista de Chamada Nominal */}
        {participantes.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-teal-700" />
                <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Membros do Grupo ({totalMembrosPresentes}/{participantes.length})
                </h2>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => alternarTodos(true)}
                  className="px-2.5 py-1 text-[11px] font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-lg transition"
                >
                  Marcar Todos
                </button>
                <button
                  type="button"
                  onClick={() => alternarTodos(false)}
                  className="px-2.5 py-1 text-[11px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
                >
                  Desmarcar
                </button>
              </div>
            </div>

            {/* Busca rápida de membro */}
            {participantes.length > 6 && (
              <div className="p-3 bg-slate-50 border-b border-slate-100">
                <input
                  type="text"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Filtrar por nome do membro..."
                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-600"
                />
              </div>
            )}

            {/* Checklist de Presença */}
            <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
              {participantesFiltrados.map((p) => (
                <div
                  key={p.id}
                  onClick={() => togglePresenca(p.id)}
                  className={`flex items-center justify-between p-3.5 text-xs cursor-pointer select-none transition ${
                    p.presente ? 'bg-teal-50/40 hover:bg-teal-50/70' : 'bg-white hover:bg-slate-50 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-6 h-6 rounded-lg flex items-center justify-center border transition flex-shrink-0 ${
                        p.presente
                          ? 'bg-teal-700 border-teal-800 text-white shadow-2xs'
                          : 'border-slate-300 bg-white'
                      }`}
                    >
                      {p.presente && <Check size={14} strokeWidth={3} />}
                    </div>
                    <span className={`truncate ${p.presente ? 'font-bold text-slate-900' : 'text-slate-500 line-through'}`}>
                      {p.nome_completo}
                    </span>
                  </div>

                  <span className="text-[10px] uppercase font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                    {p.papel || 'membro'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Indicadores Numéricos Complementares */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
          <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
            <Users className="w-4 h-4 text-teal-700" />
            Visitantes & Frutos
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Visitantes (Total)
              </label>
              <input
                type="number"
                min="0"
                value={presentesVisitantes}
                onChange={(e) => setPresentesVisitantes(Math.max(0, Number(e.target.value)))}
                className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 font-bold text-slate-900"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Crianças
              </label>
              <input
                type="number"
                min="0"
                value={presentesCriancas}
                onChange={(e) => setPresentesCriancas(Math.max(0, Number(e.target.value)))}
                className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Decisões / Conversões
              </label>
              <input
                type="number"
                min="0"
                value={conversoesDecisoes}
                onChange={(e) => setConversoesDecisoes(Math.max(0, Number(e.target.value)))}
                className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 font-bold text-emerald-800 bg-emerald-50/30"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Reconciliações
              </label>
              <input
                type="number"
                min="0"
                value={reconciliacoes}
                onChange={(e) => setReconciliacoes(Math.max(0, Number(e.target.value)))}
                className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Testemunhos
              </label>
              <input
                type="number"
                min="0"
                value={testemunhos}
                onChange={(e) => setTestemunhos(Math.max(0, Number(e.target.value)))}
                className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Oferta (R$)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={valorOferta}
                onChange={(e) => setValorOferta(Math.max(0, Number(e.target.value)))}
                className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600"
              />
            </div>
          </div>
        </div>

        {/* Observações Pastorais */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs space-y-1.5">
          <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
            Observações ou Pedidos de Oração
          </label>
          <textarea
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            placeholder="Compartilhe bênçãos, necessidades de visita ou pedidos da reunião..."
            className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 h-20 resize-none"
          />
        </div>

        {/* Barra de Ação Fixa Inferior no Mobile */}
        <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs text-slate-500 font-medium text-center sm:text-left">
            Total Previsto: <strong className="text-slate-900 font-bold">{totalGeralPessoas} pessoas</strong>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={submitting}
              onClick={() => handleEnviarFrequencia(false)}
              className="flex-1 sm:flex-none px-4 py-3 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl text-xs transition cursor-pointer disabled:opacity-50"
            >
              Salvar Rascunho
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => handleEnviarFrequencia(true)}
              className="flex-1 sm:flex-none px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs sm:text-sm transition shadow-sm cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 size={16} className="animate-spin text-white" />
                  <span>Enviando...</span>
                </>
              ) : (
                <>
                  <Send size={16} />
                  <span>Finalizar Reunião</span>
                </>
              )}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
