'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  GitFork,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  X,
  ChevronRight,
  Sparkles,
  ArrowRight,
  ShieldAlert,
  GitBranch,
  Crown,
  RefreshCw,
  Eye,
  Check,
} from 'lucide-react';
import {
  CelulaItem,
  CelulaRede,
  CelulaMultiplicacaoItem,
  CelulaMultiplicacaoStatus,
  SolicitarMultiplicacaoInput,
  CelulaParticipanteItem,
  CelulaPapelParticipante,
} from '@/types/celulas';
import { authenticatedFetch } from '@/lib/api-client';

interface TabMultiplicacaoProps {
  celulas: CelulaItem[];
  redes: CelulaRede[];
  congregacoes: { id: string; nome: string }[];
  termoCelula: string;
}

const STATUS_BADGES: Record<
  CelulaMultiplicacaoStatus,
  { label: string; cor: string; icon: React.ComponentType<{ className?: string }> }
> = {
  solicitada: {
    label: 'Solicitada',
    cor: 'bg-amber-50 text-amber-800 border-amber-200/90',
    icon: Clock,
  },
  em_avaliacao: {
    label: 'Em Avaliação',
    cor: 'bg-blue-50 text-blue-800 border-blue-200/90',
    icon: RefreshCw,
  },
  aprovada: {
    label: 'Aprovada (Pronta para Efetivar)',
    cor: 'bg-indigo-50 text-indigo-800 border-indigo-200/90',
    icon: CheckCircle2,
  },
  efetivada: {
    label: 'Efetivada',
    cor: 'bg-emerald-50 text-emerald-800 border-emerald-200/90',
    icon: Sparkles,
  },
  rejeitada: {
    label: 'Rejeitada',
    cor: 'bg-rose-50 text-rose-800 border-rose-200/90',
    icon: XCircle,
  },
  cancelada: {
    label: 'Cancelada',
    cor: 'bg-slate-100 text-slate-700 border-slate-300',
    icon: AlertTriangle,
  },
};

const DIAS_SEMANA = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
];

export default function TabMultiplicacao({
  celulas,
  congregacoes,
  termoCelula,
}: TabMultiplicacaoProps) {
  const [multiplicacoes, setMultiplicacoes] = useState<CelulaMultiplicacaoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null);

  // Sub-abas de visualização: Processos ou Genealogia
  const [subAba, setSubAba] = useState<'processos' | 'genealogia'>('processos');

  // Filtros
  const [filtroStatus, setFiltroStatus] = useState<string>('todos');
  const [filtroCelulaOrigem, setFiltroCelulaOrigem] = useState<string>('todas');
  const [filtroCongregacao, setFiltroCongregacao] = useState<string>('todas');
  const [busca, setBusca] = useState<string>('');

  // Modal Solicitar Multiplicação (Wizard 3 passos)
  const [modalSolicitarAberto, setModalSolicitarAberto] = useState(false);
  const [passoWizard, setPassoWizard] = useState<1 | 2 | 3>(1);
  const [formSolicitar, setFormSolicitar] = useState<{
    celula_origem_id: string;
    nome_nova_celula: string;
    congregacao_id: string;
    novo_lider_member_id: string;
    novo_vice_lider_member_id: string;
    novo_anfitriao_member_id: string;
    dia_reuniao: number;
    horario_reuniao: string;
    endereco_local: string;
    data_planejada: string;
    motivo_planejamento: string;
  }>({
    celula_origem_id: '',
    nome_nova_celula: '',
    congregacao_id: '',
    novo_lider_member_id: '',
    novo_vice_lider_member_id: '',
    novo_anfitriao_member_id: '',
    dia_reuniao: 3,
    horario_reuniao: '20:00',
    endereco_local: '',
    data_planejada: '',
    motivo_planejamento: '',
  });

  // Busca e seleção de novo líder
  const [buscaLider, setBuscaLider] = useState('');
  const [buscandoLider, setBuscandoLider] = useState(false);
  const [lideresEncontrados, setLideresEncontrados] = useState<Array<{ id: string; name: string }>>([]);
  const [liderSelecionado, setLiderSelecionado] = useState<{ id: string; name: string } | null>(null);

  // Participantes da célula mãe selecionáveis para migração
  const [loadingParticipantesMae, setLoadingParticipantesMae] = useState(false);
  const [participantesMae, setParticipantesMae] = useState<CelulaParticipanteItem[]>([]);
  const [participantesSelecionados, setParticipantesSelecionados] = useState<
    Array<{ participante_id: string; papel_planejado: CelulaPapelParticipante; nome: string }>
  >([]);

  // Modal Detalhes / Avaliação
  const [multiplicacaoSelecionada, setMultiplicacaoSelecionada] = useState<CelulaMultiplicacaoItem | null>(null);
  const [modalDetalhesAberto, setModalDetalhesAberto] = useState(false);

  // Modal Avaliar (Aprovar / Rejeitar / Cancelar)
  const [modalAvaliarAberto, setModalAvaliarAberto] = useState(false);
  const [acaoAvaliacao, setAcaoAvaliacao] = useState<'aprovar' | 'rejeitar' | 'cancelar'>('aprovar');
  const [justificativaAvaliacao, setJustificativaAvaliacao] = useState('');

  // Modal Confirmação Explícita de Efetivação
  const [modalEfetivarAberto, setModalEfetivarAberto] = useState(false);
  const [confirmacaoTexto, setConfirmacaoTexto] = useState('');

  // 1. Carregar lista de multiplicações
  const carregarMultiplicacoes = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filtroStatus !== 'todos') params.append('status', filtroStatus);
      if (filtroCelulaOrigem !== 'todas') params.append('celula_origem_id', filtroCelulaOrigem);
      if (filtroCongregacao !== 'todas') params.append('congregacao_id', filtroCongregacao);

      const res = await authenticatedFetch(`/api/v1/celulas/multiplicacoes?${params.toString()}`);
      const json = await res.json();
      if (res.ok) {
        setMultiplicacoes(json.data || []);
      } else {
        throw new Error(json.error || 'Erro ao carregar multiplicações');
      }
    } catch (err: any) {
      setMensagem({ tipo: 'erro', texto: err.message || 'Erro de comunicação.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarMultiplicacoes();
  }, [filtroStatus, filtroCelulaOrigem, filtroCongregacao]);

  // 2. Busca de membros para novo líder
  useEffect(() => {
    if (buscaLider.trim().length < 3) {
      setLideresEncontrados([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setBuscandoLider(true);
        const res = await authenticatedFetch(
          `/api/v1/members?search=${encodeURIComponent(buscaLider.trim())}&limit=8`
        );
        const json = await res.json();
        if (res.ok && json.data) {
          setLideresEncontrados(
            json.data.map((m: any) => ({
              id: m.id,
              name: m.name || m.nome,
            }))
          );
        }
      } catch (err) {
        console.warn('Erro ao buscar membros para liderança:', err);
      } finally {
        setBuscandoLider(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [buscaLider]);

  // 3. Ao selecionar célula mãe no Wizard, carregar seus participantes
  const carregarParticipantesDaMae = async (celulaOrigemId: string) => {
    if (!celulaOrigemId) {
      setParticipantesMae([]);
      setParticipantesSelecionados([]);
      return;
    }

    try {
      setLoadingParticipantesMae(true);
      const res = await authenticatedFetch(
        `/api/v1/celulas/participantes?celula_id=${celulaOrigemId}&status=ativo`
      );
      const json = await res.json();
      if (res.ok && json.data) {
        setParticipantesMae(json.data);
      } else {
        setParticipantesMae([]);
      }
    } catch (err) {
      console.warn('Erro ao carregar participantes da célula mãe:', err);
      setParticipantesMae([]);
    } finally {
      setLoadingParticipantesMae(false);
    }
  };

  // 4. Indicadores Consolidados
  const contadores = useMemo(() => {
    const total = multiplicacoes.length;
    const solicitadas = multiplicacoes.filter((m) => m.status === 'solicitada' || m.status === 'em_avaliacao').length;
    const aprovadas = multiplicacoes.filter((m) => m.status === 'aprovada').length;
    const efetivadas = multiplicacoes.filter((m) => m.status === 'efetivada').length;
    return { total, solicitadas, aprovadas, efetivadas };
  }, [multiplicacoes]);

  // 5. Genealogia: Mapa de árvores genealógicas (Mãe -> Filhas)
  const arvoreGenealogica = useMemo(() => {
    const maes = celulas.filter((c) => !c.celula_mae_id);
    const filhasMap: Record<string, CelulaItem[]> = {};

    celulas.forEach((c) => {
      if (c.celula_mae_id) {
        if (!filhasMap[c.celula_mae_id]) filhasMap[c.celula_mae_id] = [];
        filhasMap[c.celula_mae_id].push(c);
      }
    });

    return { maes, filhasMap };
  }, [celulas]);

  // 6. Submissão do Planejamento de Multiplicação (POST)
  const handleSolicitarMultiplicacao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formSolicitar.celula_origem_id) {
      setMensagem({ tipo: 'erro', texto: `Selecione a ${termoCelula} de origem (mãe).` });
      return;
    }
    if (!formSolicitar.nome_nova_celula.trim()) {
      setMensagem({ tipo: 'erro', texto: `Informe o nome da nova ${termoCelula} que será gerada.` });
      return;
    }

    try {
      setSalvando(true);
      setMensagem(null);

      const payload: SolicitarMultiplicacaoInput = {
        celula_origem_id: formSolicitar.celula_origem_id,
        nome_nova_celula: formSolicitar.nome_nova_celula.trim(),
        congregacao_id: formSolicitar.congregacao_id || null,
        novo_lider_member_id: formSolicitar.novo_lider_member_id || null,
        novo_vice_lider_member_id: formSolicitar.novo_vice_lider_member_id || null,
        novo_anfitriao_member_id: formSolicitar.novo_anfitriao_member_id || null,
        dia_reuniao: Number(formSolicitar.dia_reuniao),
        horario_reuniao: formSolicitar.horario_reuniao || null,
        endereco_local: formSolicitar.endereco_local || null,
        data_planejada: formSolicitar.data_planejada || null,
        motivo_planejamento: formSolicitar.motivo_planejamento || null,
        participantes: participantesSelecionados.map((p) => ({
          participante_id: p.participante_id,
          papel_planejado: p.papel_planejado,
        })),
      };

      const res = await authenticatedFetch('/api/v1/celulas/multiplicacoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const resJson = await res.json();
      if (!res.ok) {
        throw new Error(resJson.error || 'Erro ao solicitar multiplicação.');
      }

      setMensagem({
        tipo: 'sucesso',
        texto: `Processo de multiplicação para "${formSolicitar.nome_nova_celula}" planejado com sucesso!`,
      });
      setModalSolicitarAberto(false);
      resetarFormSolicitar();
      carregarMultiplicacoes();
    } catch (err: any) {
      setMensagem({ tipo: 'erro', texto: err.message || 'Erro ao submeter solicitação.' });
    } finally {
      setSalvando(false);
    }
  };

  const resetarFormSolicitar = () => {
    setPassoWizard(1);
    setFormSolicitar({
      celula_origem_id: '',
      nome_nova_celula: '',
      congregacao_id: '',
      novo_lider_member_id: '',
      novo_vice_lider_member_id: '',
      novo_anfitriao_member_id: '',
      dia_reuniao: 3,
      horario_reuniao: '20:00',
      endereco_local: '',
      data_planejada: '',
      motivo_planejamento: '',
    });
    setLiderSelecionado(null);
    setBuscaLider('');
    setParticipantesMae([]);
    setParticipantesSelecionados([]);
  };

  // 7. Abrir Detalhes completos de uma multiplicação
  const abrirDetalhes = async (mult: CelulaMultiplicacaoItem) => {
    setMultiplicacaoSelecionada(mult);
    setModalDetalhesAberto(true);
    try {
      const res = await authenticatedFetch(`/api/v1/celulas/multiplicacoes?celula_origem_id=${mult.celula_origem_id}`);
      const json = await res.json();
      if (res.ok && json.data) {
        const encontrada = json.data.find((m: CelulaMultiplicacaoItem) => m.id === mult.id);
        if (encontrada) setMultiplicacaoSelecionada(encontrada);
      }
    } catch (err) {
      console.warn('Erro ao carregar detalhes enriquecidos:', err);
    }
  };

  // 8. Avaliar Multiplicação (POST /avaliar)
  const handleAvaliarMultiplicacao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!multiplicacaoSelecionada) return;

    try {
      setSalvando(true);
      setMensagem(null);

      const res = await authenticatedFetch('/api/v1/celulas/multiplicacoes/avaliar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          multiplicacao_id: multiplicacaoSelecionada.id,
          acao: acaoAvaliacao,
          justificativa: justificativaAvaliacao.trim() || null,
        }),
      });

      const resJson = await res.json();
      if (!res.ok) {
        throw new Error(resJson.error || 'Erro ao avaliar multiplicação.');
      }

      setMensagem({
        tipo: 'sucesso',
        texto: `Multiplicação ${
          acaoAvaliacao === 'aprovar' ? 'aprovada' : acaoAvaliacao === 'rejeitar' ? 'rejeitada' : 'cancelada'
        } com sucesso!`,
      });
      setModalAvaliarAberto(false);
      setModalDetalhesAberto(false);
      setJustificativaAvaliacao('');
      carregarMultiplicacoes();
    } catch (err: any) {
      setMensagem({ tipo: 'erro', texto: err.message || 'Erro na avaliação.' });
    } finally {
      setSalvando(false);
    }
  };

  // 9. Efetivar Multiplicação (RPC transacional via POST /efetivar)
  const handleEfetivarMultiplicacao = async () => {
    if (!multiplicacaoSelecionada) return;
    if (confirmacaoTexto.trim().toUpperCase() !== 'CONFIRMAR') {
      setMensagem({ tipo: 'erro', texto: 'Digite exatamente a palavra CONFIRMAR para autorizar a efetivação.' });
      return;
    }

    try {
      setSalvando(true);
      setMensagem(null);

      const res = await authenticatedFetch('/api/v1/celulas/multiplicacoes/efetivar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          multiplicacao_id: multiplicacaoSelecionada.id,
        }),
      });

      const resJson = await res.json();
      if (!res.ok) {
        throw new Error(resJson.error || 'Falha ao efetivar multiplicação transacional.');
      }

      setMensagem({
        tipo: 'sucesso',
        texto: `Multiplicação efetivada com sucesso! A nova ${termoCelula} "${resJson.data?.novaCelula?.nome || 'filha'}" foi criada e os participantes transferidos com integridade.`,
      });
      setModalEfetivarAberto(false);
      setModalDetalhesAberto(false);
      setConfirmacaoTexto('');
      carregarMultiplicacoes();
    } catch (err: any) {
      setMensagem({ tipo: 'erro', texto: err.message || 'Erro ao efetivar multiplicação.' });
    } finally {
      setSalvando(false);
    }
  };

  // Filtro em memória por busca textual
  const multiplicacoesFiltradas = useMemo(() => {
    return multiplicacoes.filter((m) => {
      if (!busca.trim()) return true;
      const term = busca.toLowerCase();
      const nomeNova = (m.nome_nova_celula || '').toLowerCase();
      const nomeOrigem = (m.celula_origem?.nome || '').toLowerCase();
      const nomeLider = (m.novo_lider?.name || '').toLowerCase();
      return nomeNova.includes(term) || nomeOrigem.includes(term) || nomeLider.includes(term);
    });
  }, [multiplicacoes, busca]);

  return (
    <div className="space-y-6">
      {/* Banner de Feedback */}
      {mensagem && (
        <div
          className={`flex items-center justify-between p-4 rounded-xl text-xs sm:text-sm font-medium border shadow-2xs ${
            mensagem.tipo === 'sucesso'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {mensagem.tipo === 'sucesso' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            )}
            <span>{mensagem.texto}</span>
          </div>
          <button
            onClick={() => setMensagem(null)}
            className="text-xs font-bold underline hover:opacity-80 cursor-pointer"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Cards de Métricas e Indicadores Consolidados */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total de Processos</span>
            <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold">
              <GitFork size={18} />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">{contadores.total}</div>
          <p className="text-[11px] text-slate-500 mt-1 font-medium">Ciclos de multiplicação registrados</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-600 uppercase tracking-wider">Em Planejamento</span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
              <Clock size={18} />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-700 mt-2">{contadores.solicitadas}</div>
          <p className="text-[11px] text-slate-500 mt-1 font-medium">Aguardando avaliação da liderança</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Aprovadas</span>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div className="text-2xl font-black text-indigo-700 mt-2">{contadores.aprovadas}</div>
          <p className="text-[11px] text-slate-500 mt-1 font-medium">Prontas para efetivação pastoral</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Efetivadas</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
              <Sparkles size={18} />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-700 mt-2">{contadores.efetivadas}</div>
          <p className="text-[11px] text-slate-500 mt-1 font-medium">Novas células geradas e ativas</p>
        </div>
      </div>

      {/* Painel Central com Alternador de Visualização (Processos x Genealogia) */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSubAba('processos')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 cursor-pointer ${
                subAba === 'processos'
                  ? 'bg-teal-700 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              <GitFork size={15} />
              <span>Processos de Multiplicação ({multiplicacoes.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setSubAba('genealogia')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 cursor-pointer ${
                subAba === 'genealogia'
                  ? 'bg-teal-700 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              <GitBranch size={15} />
              <span>Genealogia das Células</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                resetarFormSolicitar();
                setModalSolicitarAberto(true);
              }}
              className="w-full sm:w-auto px-4 py-2.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-xs transition cursor-pointer"
            >
              <Plus size={16} />
              <span>+ Planejar Multiplicação</span>
            </button>
          </div>
        </div>

        {/* SUB-ABA: PROCESSOS */}
        {subAba === 'processos' && (
          <div className="space-y-4">
            {/* Barra de Filtros */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar por célula mãe, nova ou líder..."
                  className="w-full pl-9 pr-3.5 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 shadow-2xs"
                />
              </div>

              <div>
                <select
                  value={filtroStatus}
                  onChange={(e) => setFiltroStatus(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 shadow-2xs bg-white cursor-pointer"
                >
                  <option value="todos">Todos os Status</option>
                  <option value="solicitada">Solicitadas</option>
                  <option value="em_avaliacao">Em Avaliação</option>
                  <option value="aprovada">Aprovadas</option>
                  <option value="efetivada">Efetivadas</option>
                  <option value="rejeitada">Rejeitadas</option>
                  <option value="cancelada">Canceladas</option>
                </select>
              </div>

              <div>
                <select
                  value={filtroCelulaOrigem}
                  onChange={(e) => setFiltroCelulaOrigem(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 shadow-2xs bg-white cursor-pointer"
                >
                  <option value="todas">Todas as {termoCelula}s de Origem</option>
                  {celulas.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <select
                  value={filtroCongregacao}
                  onChange={(e) => setFiltroCongregacao(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 shadow-2xs bg-white cursor-pointer"
                >
                  <option value="todas">Todas as Congregações</option>
                  {congregacoes.map((cg) => (
                    <option key={cg.id} value={cg.id}>
                      {cg.nome}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Listagem em Tabela Responsiva */}
            {loading ? (
              <div className="py-16 text-center text-slate-400 text-xs sm:text-sm flex flex-col items-center justify-center gap-2">
                <RefreshCw size={24} className="animate-spin text-teal-600" />
                <span>Carregando solicitações de multiplicação...</span>
              </div>
            ) : multiplicacoesFiltradas.length === 0 ? (
              <div className="py-16 text-center text-slate-500 text-xs sm:text-sm border border-dashed border-slate-200 rounded-2xl p-8 space-y-2">
                <GitFork size={36} className="mx-auto text-slate-300" />
                <p className="font-bold text-slate-700">Nenhum processo de multiplicação encontrado.</p>
                <p className="text-slate-500 text-xs max-w-md mx-auto">
                  Utilize o botão acima para iniciar um novo planejamento assistido de multiplicação.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200/90 rounded-2xl shadow-2xs">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-slate-50/80 text-slate-700 font-bold border-b border-slate-200/80">
                    <tr>
                      <th className="py-3 px-4">{termoCelula} Mãe</th>
                      <th className="py-3 px-4">Nova {termoCelula} Proposta</th>
                      <th className="py-3 px-4">Liderança Indicada</th>
                      <th className="py-3 px-4">Data Planejada</th>
                      <th className="py-3 px-4">Situação</th>
                      <th className="py-3 px-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {multiplicacoesFiltradas.map((m) => {
                      const badge = STATUS_BADGES[m.status] || STATUS_BADGES.solicitada;
                      const IconBadge = badge.icon;

                      return (
                        <tr key={m.id} className="hover:bg-slate-50/50 transition">
                          <td className="py-3.5 px-4 font-bold text-slate-900">
                            <div className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-teal-600"></span>
                              <span>{m.celula_origem?.nome || 'Célula de Origem'}</span>
                            </div>
                            {m.congregacao && (
                              <span className="text-[11px] text-slate-500 font-medium block">
                                {m.congregacao.nome}
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 font-semibold text-slate-800">
                            <div className="flex items-center gap-1 text-teal-800">
                              <ArrowRight size={13} className="text-slate-400" />
                              <span>{m.nome_nova_celula}</span>
                            </div>
                            {m.celula_filha && (
                              <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-bold border border-emerald-200 inline-block mt-0.5">
                                Célula Filha Ativa
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-slate-700">
                            {m.novo_lider?.name ? (
                              <div className="flex items-center gap-1.5">
                                <Crown size={14} className="text-amber-600 flex-shrink-0" />
                                <span className="font-medium">{m.novo_lider.name}</span>
                              </div>
                            ) : (
                              <span className="text-slate-400 italic">Não indicado</span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-slate-600">
                            {m.data_planejada ? (
                              <span className="font-medium text-slate-800">
                                {new Date(m.data_planejada + 'T00:00:00').toLocaleDateString('pt-BR')}
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>

                          <td className="py-3.5 px-4">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border ${badge.cor}`}
                            >
                              <IconBadge className="w-3.5 h-3.5" />
                              <span>{badge.label}</span>
                            </span>
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => abrirDetalhes(m)}
                              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ml-auto cursor-pointer"
                            >
                              <Eye size={13} />
                              <span>Acompanhar</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* SUB-ABA: GENEALOGIA DAS CÉLULAS */}
        {subAba === 'genealogia' && (
          <div className="space-y-6 pt-2">
            <div>
              <h3 className="text-base font-bold text-slate-900">Árvore Genealógica das Células</h3>
              <p className="text-xs text-slate-500">
                Visualização hierárquica das células-mãe fundadoras e de suas gerações de células-filhas multiplicadas.
              </p>
            </div>

            {arvoreGenealogica.maes.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs sm:text-sm">
                Nenhuma célula cadastrada para exibição genealógica.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {arvoreGenealogica.maes.map((mae) => {
                  const filhas = arvoreGenealogica.filhasMap[mae.id] || [];

                  return (
                    <div
                      key={mae.id}
                      className="bg-slate-50/70 p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="px-2 py-0.5 bg-teal-100 text-teal-800 text-[10px] font-bold rounded-md uppercase">
                              Célula Mãe
                            </span>
                            <span className="text-xs text-slate-400 font-mono">#{mae.codigo || mae.id.slice(0, 6)}</span>
                          </div>
                          <h4 className="text-base font-bold text-slate-900 mt-1">{mae.nome}</h4>
                          <p className="text-xs text-slate-500">
                            Líder: <span className="font-semibold text-slate-700">{mae.lider?.name || 'Não atribuído'}</span>
                          </p>
                        </div>

                        <span className="px-2.5 py-1 bg-white border border-slate-200 rounded-full text-xs font-bold text-slate-700 shadow-2xs">
                          {filhas.length} {filhas.length === 1 ? 'filha' : 'filhas'}
                        </span>
                      </div>

                      {/* Lista de Filhas */}
                      <div className="border-t border-slate-200/80 pt-3">
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
                          Gerações Filhas Multiplicadas:
                        </span>
                        {filhas.length === 0 ? (
                          <p className="text-xs text-slate-400 italic">Esta célula ainda não realizou multiplicações.</p>
                        ) : (
                          <div className="space-y-2">
                            {filhas.map((filha) => (
                              <div
                                key={filha.id}
                                className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-slate-200 text-xs shadow-2xs"
                              >
                                <div className="flex items-center gap-2">
                                  <GitBranch size={14} className="text-teal-600 flex-shrink-0" />
                                  <div>
                                    <span className="font-bold text-slate-800">{filha.nome}</span>
                                    <span className="text-[11px] text-slate-500 block">
                                      Líder: {filha.lider?.name || 'Novo Líder'}
                                    </span>
                                  </div>
                                </div>
                                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold rounded">
                                  Ativa
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODAL 1: WIZARD DE SOLICITAÇÃO / PLANEJAMENTO DE MULTIPLICAÇÃO */}
      {modalSolicitarAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200/90 w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header com Stepper */}
            <div className="p-5 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Planejar Multiplicação Assistida</h3>
                <p className="text-xs text-slate-500">
                  Passo {passoWizard} de 3 —{' '}
                  {passoWizard === 1
                    ? 'Origem e Nova Célula'
                    : passoWizard === 2
                    ? 'Liderança e Dados Operacionais'
                    : 'Migração de Participantes'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalSolicitarAberto(false)}
                className="text-slate-400 hover:text-slate-600 transition p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Stepper Visual */}
            <div className="flex items-center justify-between px-6 py-2.5 bg-slate-100/70 border-b border-slate-200 text-xs font-bold text-slate-600">
              <span className={passoWizard >= 1 ? 'text-teal-700 font-black' : ''}>1. Origem & Nome</span>
              <ChevronRight size={14} className="text-slate-400" />
              <span className={passoWizard >= 2 ? 'text-teal-700 font-black' : ''}>2. Liderança & Reunião</span>
              <ChevronRight size={14} className="text-slate-400" />
              <span className={passoWizard === 3 ? 'text-teal-700 font-black' : ''}>3. Participantes</span>
            </div>

            {/* Corpo do Wizard */}
            <form onSubmit={handleSolicitarMultiplicacao} className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* PASSO 1 */}
              {passoWizard === 1 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      {termoCelula} de Origem (Mãe) *
                    </label>
                    <select
                      required
                      value={formSolicitar.celula_origem_id}
                      onChange={(e) => {
                        const cId = e.target.value;
                        const cel = celulas.find((c) => c.id === cId);
                        setFormSolicitar({
                          ...formSolicitar,
                          celula_origem_id: cId,
                          congregacao_id: cel?.congregacao_id || '',
                          dia_reuniao: cel?.dia_semana ?? 3,
                          horario_reuniao: cel?.horario ? cel.horario.slice(0, 5) : '20:00',
                          endereco_local: cel?.logradouro ? `${cel.logradouro}, ${cel.numero || ''}` : '',
                        });
                        carregarParticipantesDaMae(cId);
                      }}
                      className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 shadow-2xs cursor-pointer"
                    >
                      <option value="">Selecione a {termoCelula} que está se multiplicando</option>
                      {celulas.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nome} {c.congregacao?.nome ? `(${c.congregacao.nome})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Nome da Nova {termoCelula} (Filha) *
                    </label>
                    <input
                      type="text"
                      required
                      value={formSolicitar.nome_nova_celula}
                      onChange={(e) => setFormSolicitar({ ...formSolicitar, nome_nova_celula: e.target.value })}
                      placeholder="Ex: Célula Monte Sião, Pequeno Grupo Esperança..."
                      className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 shadow-2xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Motivo / Justificativa do Planejamento
                    </label>
                    <textarea
                      value={formSolicitar.motivo_planejamento}
                      onChange={(e) => setFormSolicitar({ ...formSolicitar, motivo_planejamento: e.target.value })}
                      placeholder="Ex: Célula atingiu o teto de 18 membros, novo líder em treinamento pronto para assumir..."
                      className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 shadow-2xs h-20 resize-none"
                    />
                  </div>
                </div>
              )}

              {/* PASSO 2 */}
              {passoWizard === 2 && (
                <div className="space-y-4">
                  {/* Busca do Novo Líder */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Novo Líder Proposto (Membro)
                    </label>
                    {liderSelecionado ? (
                      <div className="flex items-center justify-between p-3 bg-teal-50 border border-teal-200 rounded-xl text-xs sm:text-sm">
                        <div className="flex items-center gap-2">
                          <Crown size={16} className="text-teal-700" />
                          <span className="font-bold text-teal-900">{liderSelecionado.name}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setLiderSelecionado(null);
                            setFormSolicitar({ ...formSolicitar, novo_lider_member_id: '' });
                          }}
                          className="text-xs text-teal-700 font-bold hover:underline"
                        >
                          Trocar
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={buscaLider}
                          onChange={(e) => setBuscaLider(e.target.value)}
                          placeholder="Digite pelo menos 3 letras para buscar membros..."
                          className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 shadow-2xs"
                        />
                        {buscandoLider && (
                          <p className="text-xs text-slate-400 flex items-center gap-1.5">
                            <RefreshCw size={12} className="animate-spin" /> Buscando...
                          </p>
                        )}
                        {lideresEncontrados.length > 0 && (
                          <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-36 overflow-y-auto">
                            {lideresEncontrados.map((m) => (
                              <button
                                key={m.id}
                                type="button"
                                onClick={() => {
                                  setLiderSelecionado(m);
                                  setFormSolicitar({ ...formSolicitar, novo_lider_member_id: m.id });
                                  setBuscaLider('');
                                  setLideresEncontrados([]);
                                }}
                                className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 transition flex items-center justify-between font-medium text-slate-800"
                              >
                                <span>{m.name}</span>
                                <span className="text-[10px] text-teal-600 font-bold">Selecionar</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Dia da Semana e Horário */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Dia da Reunião
                      </label>
                      <select
                        value={formSolicitar.dia_reuniao}
                        onChange={(e) => setFormSolicitar({ ...formSolicitar, dia_reuniao: Number(e.target.value) })}
                        className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 shadow-2xs cursor-pointer"
                      >
                        {DIAS_SEMANA.map((dia, idx) => (
                          <option key={idx} value={idx}>
                            {dia}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Horário da Reunião
                      </label>
                      <input
                        type="time"
                        value={formSolicitar.horario_reuniao}
                        onChange={(e) => setFormSolicitar({ ...formSolicitar, horario_reuniao: e.target.value })}
                        className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 shadow-2xs"
                      />
                    </div>
                  </div>

                  {/* Data Planejada e Endereço */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Data Planejada para Multiplicação
                    </label>
                    <input
                      type="date"
                      value={formSolicitar.data_planejada}
                      onChange={(e) => setFormSolicitar({ ...formSolicitar, data_planejada: e.target.value })}
                      className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 shadow-2xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Endereço da Nova {termoCelula}
                    </label>
                    <input
                      type="text"
                      value={formSolicitar.endereco_local}
                      onChange={(e) => setFormSolicitar({ ...formSolicitar, endereco_local: e.target.value })}
                      placeholder="Rua, número, bairro..."
                      className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 shadow-2xs"
                    />
                  </div>
                </div>
              )}

              {/* PASSO 3: MIGRAÇÃO DE PARTICIPANTES */}
              {passoWizard === 3 && (
                <div className="space-y-4">
                  <div>
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Participantes Destinados à Nova {termoCelula}
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Selecione quais membros e frequentadores da célula mãe serão transferidos para compor a nova célula.
                    </p>
                  </div>

                  {loadingParticipantesMae ? (
                    <div className="py-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                      <RefreshCw size={14} className="animate-spin text-teal-600" />
                      <span>Carregando participantes da célula mãe...</span>
                    </div>
                  ) : participantesMae.length === 0 ? (
                    <p className="text-xs text-slate-500 italic p-4 bg-slate-50 rounded-xl border border-slate-200">
                      Nenhum participante ativo listado na célula mãe selecionada. Você poderá transferir participantes posteriormente.
                    </p>
                  ) : (
                    <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-56 overflow-y-auto">
                      {participantesMae.map((part) => {
                        const selecionado = participantesSelecionados.find((p) => p.participante_id === part.id);

                        return (
                          <div
                            key={part.id}
                            className={`p-3 flex items-center justify-between transition ${
                              selecionado ? 'bg-teal-50/60' : 'hover:bg-slate-50/70'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={Boolean(selecionado)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setParticipantesSelecionados([
                                      ...participantesSelecionados,
                                      {
                                        participante_id: part.id,
                                        papel_planejado: part.papel || 'membro',
                                        nome: part.nome_completo,
                                      },
                                    ]);
                                  } else {
                                    setParticipantesSelecionados(
                                      participantesSelecionados.filter((p) => p.participante_id !== part.id)
                                    );
                                  }
                                }}
                                className="w-4 h-4 text-teal-600 rounded border-slate-300 focus:ring-teal-500 cursor-pointer"
                              />
                              <div>
                                <span className="font-bold text-xs text-slate-900 block">{part.nome_completo}</span>
                                <span className="text-[10px] text-slate-500 capitalize">Papel atual: {part.papel}</span>
                              </div>
                            </div>

                            {selecionado && (
                              <select
                                value={selecionado.papel_planejado}
                                onChange={(e) => {
                                  const novoPapel = e.target.value as CelulaPapelParticipante;
                                  setParticipantesSelecionados(
                                    participantesSelecionados.map((p) =>
                                      p.participante_id === part.id ? { ...p, papel_planejado: novoPapel } : p
                                    )
                                  );
                                }}
                                className="px-2 py-1 text-xs border border-slate-300 rounded-lg bg-white shadow-2xs font-medium cursor-pointer"
                              >
                                <option value="lider">Líder</option>
                                <option value="vice_lider">Vice-Líder</option>
                                <option value="anfitriao">Anfitrião</option>
                                <option value="lider_em_treinamento">Líder em Treinamento</option>
                                <option value="membro">Membro</option>
                                <option value="congregante">Congregante</option>
                                <option value="visitante_regular">Visitante Regular</option>
                              </select>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-200/80 text-[11px] text-amber-800 space-y-1">
                    <p className="font-bold flex items-center gap-1">
                      <ShieldAlert size={14} className="text-amber-700" /> Nota de Integridade:
                    </p>
                    <p>
                      A transferência dos participantes só ocorrerá <strong>após a aprovação pastoral e efetivação</strong> da multiplicação. Os vínculos na célula mãe permanecem intocados nesta etapa.
                    </p>
                  </div>
                </div>
              )}

              {/* Controles de Navegação do Wizard */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                {passoWizard > 1 ? (
                  <button
                    type="button"
                    onClick={() => setPassoWizard((passoWizard - 1) as any)}
                    className="px-4 py-2 text-xs sm:text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                  >
                    Voltar
                  </button>
                ) : (
                  <div></div>
                )}

                {passoWizard < 3 ? (
                  <button
                    type="button"
                    disabled={passoWizard === 1 && (!formSolicitar.celula_origem_id || !formSolicitar.nome_nova_celula.trim())}
                    onClick={() => setPassoWizard((passoWizard + 1) as any)}
                    className="px-5 py-2.5 text-xs sm:text-sm font-bold bg-teal-700 hover:bg-teal-800 text-white rounded-xl shadow-xs transition disabled:opacity-50 cursor-pointer"
                  >
                    Próximo Passo
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={salvando}
                    className="px-5 py-2.5 text-xs sm:text-sm font-bold bg-teal-700 hover:bg-teal-800 text-white rounded-xl shadow-xs transition disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                  >
                    {salvando ? <RefreshCw size={14} className="animate-spin" /> : <Check size={16} />}
                    <span>{salvando ? 'Salvando...' : 'Concluir Planejamento'}</span>
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: DETALHES COMPLETOS E ACOMPANHAMENTO DO PROCESSO */}
      {modalDetalhesAberto && multiplicacaoSelecionada && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200/90 w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-5 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Processo de Multiplicação</h3>
                <p className="text-xs text-slate-500">Acompanhamento e governança pastoral do ciclo</p>
              </div>
              <button
                type="button"
                onClick={() => setModalDetalhesAberto(false)}
                className="text-slate-400 hover:text-slate-600 transition p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1 text-xs sm:text-sm">
              {/* Badge de Status e Dados Básicos */}
              <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200/90">
                <div>
                  <span className="text-[11px] text-slate-500 font-bold uppercase block">Situação Atual:</span>
                  <span className="font-bold text-slate-800 text-sm capitalize">
                    {multiplicacaoSelecionada.status.replace('_', ' ')}
                  </span>
                </div>
                <span
                  className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border ${
                    STATUS_BADGES[multiplicacaoSelecionada.status]?.cor || 'bg-slate-100'
                  }`}
                >
                  {STATUS_BADGES[multiplicacaoSelecionada.status]?.label || multiplicacaoSelecionada.status}
                </span>
              </div>

              {/* Informações da Nova Célula */}
              <div className="grid grid-cols-2 gap-3 p-3.5 bg-white rounded-xl border border-slate-200/90 shadow-2xs">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Célula Mãe (Origem)</span>
                  <span className="font-bold text-slate-900">
                    {multiplicacaoSelecionada.celula_origem?.nome || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Nova Célula (Proposta)</span>
                  <span className="font-bold text-teal-800">{multiplicacaoSelecionada.nome_nova_celula}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Líder Indicado</span>
                  <span className="font-medium text-slate-800">
                    {multiplicacaoSelecionada.novo_lider?.name || 'Não indicado'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Data Planejada</span>
                  <span className="font-medium text-slate-800">
                    {multiplicacaoSelecionada.data_planejada
                      ? new Date(multiplicacaoSelecionada.data_planejada + 'T00:00:00').toLocaleDateString('pt-BR')
                      : '—'}
                  </span>
                </div>
              </div>

              {/* Justificativas e Histórico de Decisão */}
              {multiplicacaoSelecionada.motivo_planejamento && (
                <div>
                  <span className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                    Motivação do Planejamento:
                  </span>
                  <p className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-700 text-xs">
                    {multiplicacaoSelecionada.motivo_planejamento}
                  </p>
                </div>
              )}

              {multiplicacaoSelecionada.justificativa_aprovacao && (
                <div>
                  <span className="text-[11px] font-bold text-emerald-700 uppercase block mb-1">
                    Justificativa de Aprovação Pastoral:
                  </span>
                  <p className="p-3 bg-emerald-50/70 rounded-xl border border-emerald-200 text-emerald-900 text-xs">
                    {multiplicacaoSelecionada.justificativa_aprovacao}
                  </p>
                </div>
              )}

              {multiplicacaoSelecionada.motivo_rejeicao && (
                <div>
                  <span className="text-[11px] font-bold text-rose-700 uppercase block mb-1">
                    Motivo da Rejeição / Cancelamento:
                  </span>
                  <p className="p-3 bg-rose-50/70 rounded-xl border border-rose-200 text-rose-900 text-xs">
                    {multiplicacaoSelecionada.motivo_rejeicao}
                  </p>
                </div>
              )}

              {/* Botões de Ação de Acordo com o Status */}
              <div className="pt-4 border-t border-slate-200 space-y-2">
                {/* 1. Se solicitada ou em avaliação: botões de aprovar / rejeitar */}
                {(multiplicacaoSelecionada.status === 'solicitada' ||
                  multiplicacaoSelecionada.status === 'em_avaliacao') && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setAcaoAvaliacao('aprovar');
                        setJustificativaAvaliacao('');
                        setModalAvaliarAberto(true);
                      }}
                      className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <CheckCircle2 size={15} />
                      <span>Aprovar Multiplicação</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setAcaoAvaliacao('rejeitar');
                        setJustificativaAvaliacao('');
                        setModalAvaliarAberto(true);
                      }}
                      className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl font-bold transition cursor-pointer"
                    >
                      Rejeitar
                    </button>
                  </div>
                )}

                {/* 2. Se aprovada: botão de efetivação transacional */}
                {multiplicacaoSelecionada.status === 'aprovada' && (
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmacaoTexto('');
                      setModalEfetivarAberto(true);
                    }}
                    className="w-full py-2.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl font-bold transition flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                  >
                    <Sparkles size={16} />
                    <span>Efetivar Multiplicação Agora</span>
                  </button>
                )}

                {/* 3. Se já efetivada: feedback consolidado */}
                {multiplicacaoSelecionada.status === 'efetivada' && (
                  <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-center font-bold text-emerald-800 text-xs">
                    Multiplicação concluída com sucesso em{' '}
                    {multiplicacaoSelecionada.data_efetivacao
                      ? new Date(multiplicacaoSelecionada.data_efetivacao).toLocaleDateString('pt-BR')
                      : 'produção'}
                    .
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: AVALIAR MULTIPLICAÇÃO (APROVAR / REJEITAR) */}
      {modalAvaliarAberto && multiplicacaoSelecionada && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200/90 w-full max-w-md overflow-hidden flex flex-col">
            <div className="p-5 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                {acaoAvaliacao === 'aprovar' ? 'Aprovar Multiplicação' : 'Rejeitar Solicitação'}
              </h3>
              <button
                type="button"
                onClick={() => setModalAvaliarAberto(false)}
                className="text-slate-400 hover:text-slate-600 transition p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAvaliarMultiplicacao} className="p-6 space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                {acaoAvaliacao === 'aprovar'
                  ? `Ao aprovar a multiplicação da célula "${multiplicacaoSelecionada.nome_nova_celula}", o processo ficará pronto para efetivação pastoral e criação da nova célula.`
                  : 'Informe a justificativa da recusa para fins de auditoria e alinhamento pastoral com a liderança.'}
              </p>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Justificativa / Parecer Pastoral *
                </label>
                <textarea
                  required
                  value={justificativaAvaliacao}
                  onChange={(e) => setJustificativaAvaliacao(e.target.value)}
                  placeholder="Descreva as orientações ou critérios atendidos..."
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 shadow-2xs h-24 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setModalAvaliarAberto(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvando}
                  className={`px-4 py-2 text-xs font-bold text-white rounded-xl transition shadow-xs cursor-pointer ${
                    acaoAvaliacao === 'aprovar' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  {salvando ? 'Processando...' : acaoAvaliacao === 'aprovar' ? 'Confirmar Aprovação' : 'Confirmar Rejeição'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: CONFIRMAÇÃO EXPLÍCITA ANTES DE EFETIVAR (ANTI-ACIDENTES) */}
      {modalEfetivarAberto && multiplicacaoSelecionada && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/90 w-full max-w-md overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-200 bg-rose-50/50 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold flex-shrink-0">
                <ShieldAlert size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Confirmação de Efetivação</h3>
                <p className="text-[11px] text-rose-700 font-semibold">Ação estrutural e irreversível</p>
              </div>
            </div>

            <div className="p-6 space-y-4 text-xs sm:text-sm">
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-slate-700 space-y-2 text-xs leading-relaxed">
                <p>
                  Você está prestes a efetivar a multiplicação da célula{' '}
                  <strong className="text-slate-900 font-black">
                    "{multiplicacaoSelecionada.celula_origem?.nome}"
                  </strong>{' '}
                  para criar oficialmente a nova célula{' '}
                  <strong className="text-teal-900 font-black">
                    "{multiplicacaoSelecionada.nome_nova_celula}"
                  </strong>
                  .
                </p>
                <ul className="list-disc list-inside space-y-1 text-slate-600">
                  <li>Criação atômica da nova célula filha vinculada à célula mãe.</li>
                  <li>Migração imediata dos participantes planejados com registro de histórico auditável.</li>
                  <li>Preservação do isolamento multi-tenant e congregações.</li>
                </ul>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Digite <strong className="text-rose-700">CONFIRMAR</strong> no campo abaixo para prosseguir:
                </label>
                <input
                  type="text"
                  value={confirmacaoTexto}
                  onChange={(e) => setConfirmacaoTexto(e.target.value)}
                  placeholder="CONFIRMAR"
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm border-2 border-slate-300 rounded-xl font-bold uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-rose-600/20 focus:border-rose-600 shadow-2xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setModalEfetivarAberto(false)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={salvando || confirmacaoTexto.trim().toUpperCase() !== 'CONFIRMAR'}
                  onClick={handleEfetivarMultiplicacao}
                  className="px-5 py-2.5 text-xs font-bold bg-teal-700 hover:bg-teal-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl transition shadow-xs flex items-center gap-2 cursor-pointer"
                >
                  {salvando ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={15} />}
                  <span>{salvando ? 'Efetivando...' : 'Efetivar Multiplicação'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
