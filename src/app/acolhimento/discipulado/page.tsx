'use client';

/**
 * /acolhimento/discipulado — Central de Acolhimento e Acompanhamento do Discipulado (Fase 1)
 *
 * Características da Interface (Alinhada a Secretaria → Membros):
 * 1. Menu Lateral & Estrutura:
 *    - Reutiliza AppShell com Sidebar fixa na viewport e rolagem independente.
 *    - Rota mapeada no menu e desbloqueada de rotas públicas de recepção.
 * 2. Cadastro em Modal:
 *    - Botão destacado "+ Novo Convertido" no topo/toolbar da listagem.
 *    - Modal responsivo com busca de visitante no Acolhimento por telefone e formulário oficial da Secretaria.
 *    - Retenção de estado para evitar perda de dados e rolagem interna suave.
 * 3. Identidade Visual do ERP:
 *    - Tipografia, paleta institucional (slate/teal/emerald), cards de métricas executivas,
 *      filtros e tabela com os mesmos padrões de Secretaria → Membros.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import PageLayout from '@/components/PageLayout';
import NotificationModal from '@/components/NotificationModal';
import ExecutiveMetricCard from '@/components/dashboard/ExecutiveMetricCard';
import { useRequireModulo } from '@/hooks/useRequireModulo';
import { createClient } from '@/lib/supabase-client';
import {
  Users,
  Search,
  CheckCircle2,
  Loader2,
  Phone,
  UserCheck,
  Sparkles,
  ShieldCheck,
  RefreshCw,
  X,
  Compass,
  UserPlus,
  RotateCcw,
  BookOpen,
  School,
  UserCog,
  FileBarChart2,
} from 'lucide-react';
import TabTurmas from './turmas/TabTurmas';
import TabEquipe from './turmas/TabEquipe';
import TabRelatorios from './turmas/TabRelatorios';

function formatPhone(v: string | null | undefined): string {
  if (!v) return 'Não informado';
  const digits = v.replace(/\D/g, '');
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return v;
}

function formatCpf(v: string | null | undefined): string {
  if (!v) return 'Não informado';
  const digits = v.replace(/\D/g, '');
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  }
  return v;
}

export interface JornadaItem {
  id: string;
  fase: string;
  status: string;
  data_decisao: string;
  data_inicio: string;
  data_conclusao?: string | null;
  observacoes?: string | null;
  created_at: string;
  member: {
    id: string;
    name: string;
    cpf: string | null;
    phone: string | null;
    celular: string | null;
    whatsapp: string | null;
    tipo_cadastro: string | null;
    status: string | null;
    foto_url: string | null;
  } | null;
  responsavel?: {
    id: string;
    name: string;
  } | null;
  congregacao?: {
    id: string;
    nome: string;
  } | null;
}

export interface CongregadoSugestao {
  id: string;
  name: string;
  cpf: string | null;
  phone: string | null;
  bairro: string | null;
  cidade: string | null;
  logradouro: string | null;
  numero: string | null;
  data_nascimento: string | null;
  sexo: string | null;
  congregacao_id: string | null;
  congregacao_nome?: string | null;
}

const FASE_LABELS: Record<string, { label: string; badgeClass: string }> = {
  primeiros_passos: {
    label: 'Primeiros Passos',
    badgeClass: 'bg-teal-50 text-teal-800 border-teal-200',
  },
  fundamentos: {
    label: 'Fundamentos',
    badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  },
  preparacao_batismo: {
    label: 'Candidato ao Batismo',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  },
  integracao: {
    label: 'Integração Ministerial',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
  },
};

const STATUS_LABELS: Record<string, { label: string; dotClass: string; textClass: string }> = {
  ativo: {
    label: 'Em Andamento',
    dotClass: 'bg-emerald-500 ring-4 ring-emerald-100',
    textClass: 'text-emerald-800 font-semibold',
  },
  concluido: {
    label: 'Concluído',
    dotClass: 'bg-blue-500 ring-4 ring-blue-100',
    textClass: 'text-blue-800 font-semibold',
  },
  pausado: {
    label: 'Pausado',
    dotClass: 'bg-amber-500 ring-4 ring-amber-100',
    textClass: 'text-amber-800 font-semibold',
  },
  desistente: {
    label: 'Desistente',
    dotClass: 'bg-rose-500 ring-4 ring-rose-100',
    textClass: 'text-rose-800 font-semibold',
  },
};

export default function DiscipuladoPage() {
  const { ctx } = useRequireModulo('secretaria_local');
  const supabase = useMemo(() => createClient(), []);

  // Navegação por Abas Centralizadas
  const [abaAtiva, setAbaAtiva] = useState<'discipulos' | 'turmas' | 'equipe' | 'relatorios'>('discipulos');

  const [jornadas, setJornadas] = useState<JornadaItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal de Novo Convertido
  const [modalNovoConvertidoOpen, setModalNovoConvertidoOpen] = useState(false);

  // Filtros (Toolbar)
  const [filtroStatus, setFiltroStatus] = useState<string>('todos');
  const [filtroFase, setFiltroFase] = useState<string>('todas');
  const [buscaTexto, setBuscaTexto] = useState<string>('');

  // Estados da Busca Dinâmica de Congregados
  const [buscaCongregadoTexto, setBuscaCongregadoTexto] = useState('');
  const [buscaCongregadoTel, setBuscaCongregadoTel] = useState('');
  const [buscandoCongregados, setBuscandoCongregados] = useState(false);
  const [congregadosEncontrados, setCongregadosEncontrados] = useState<CongregadoSugestao[]>([]);
  const [congregadoSelecionado, setCongregadoSelecionado] = useState<CongregadoSugestao | null>(null);

  // Dados Específicos da Jornada
  const [dataDecisaoInput, setDataDecisaoInput] = useState(new Date().toISOString().slice(0, 10));
  const [observacoesInput, setObservacoesInput] = useState('');
  const [salvando, setSalvando] = useState(false);

  // Notificações
  const [modalNotify, setModalNotify] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'success' as 'success' | 'error' | 'warning' | 'info',
  });

  const showNotification = (
    type: 'success' | 'error' | 'warning' | 'info',
    title: string,
    message: string
  ) => {
    setModalNotify({ isOpen: true, type, title, message });
  };

  // Carregar jornadas de discipulado
  const loadJornadas = useCallback(async () => {
    if (!ctx?.ministryId) return;
    setLoading(true);

    try {
      let query = supabase
        .from('discipulado_jornadas')
        .select(`
          id, fase, status, data_decisao, data_inicio, data_conclusao, observacoes, created_at,
          member:members!discipulado_jornadas_member_id_fkey (
            id, name, cpf, phone, celular, whatsapp, tipo_cadastro, status, foto_url
          ),
          responsavel:members!discipulado_jornadas_responsavel_id_fkey (
            id, name
          ),
          congregacao:congregacoes (
            id, nome
          )
        `)
        .eq('ministry_id', ctx.ministryId)
        .order('created_at', { ascending: false });

      if (filtroStatus !== 'todos') {
        query = query.eq('status', filtroStatus);
      }
      if (filtroFase !== 'todas') {
        query = query.eq('fase', filtroFase);
      }

      const { data, error } = await query;
      if (error) throw error;
      setJornadas((data || []) as unknown as JornadaItem[]);
    } catch (err: any) {
      console.error('[loadJornadas]', err);
    } finally {
      setLoading(false);
    }
  }, [ctx?.ministryId, filtroStatus, filtroFase, supabase]);

  useEffect(() => {
    if (!ctx?.loading && ctx?.ministryId) {
      loadJornadas();
    }
  }, [ctx?.loading, ctx?.ministryId, loadJornadas]);

  // Busca dinâmica de congregados em public.members
  const buscarCongregados = useCallback(
    async (nome: string, telefone: string) => {
      const q = nome.trim();
      const tel = telefone.replace(/\D/g, '').trim();

      if (q.length < 3 && tel.length < 4) {
        setCongregadosEncontrados([]);
        return;
      }

      setBuscandoCongregados(true);
      try {
        const params = new URLSearchParams();
        if (q.length >= 3) params.set('q', q);
        if (tel.length >= 4) params.set('tel', tel);

        const res = await fetch(`/api/v1/discipulado/congregados?${params.toString()}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erro ao buscar congregados.');

        setCongregadosEncontrados(data.congregados || []);
      } catch (err: any) {
        console.error('[buscarCongregados]', err);
        showNotification('error', 'Erro na Busca', err.message || 'Falha ao consultar congregados.');
      } finally {
        setBuscandoCongregados(false);
      }
    },
    []
  );

  // Debounce para busca por nome
  useEffect(() => {
    const timer = setTimeout(() => {
      if (modalNovoConvertidoOpen && !congregadoSelecionado) {
        buscarCongregados(buscaCongregadoTexto, buscaCongregadoTel);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [buscaCongregadoTexto, buscaCongregadoTel, modalNovoConvertidoOpen, congregadoSelecionado, buscarCongregados]);

  const selecionarCongregado = (c: CongregadoSugestao) => {
    setCongregadoSelecionado(c);
    setCongregadosEncontrados([]);
  };

  const desmarcarCongregado = () => {
    setCongregadoSelecionado(null);
  };

  const resetFormulario = () => {
    setBuscaCongregadoTexto('');
    setBuscaCongregadoTel('');
    setCongregadosEncontrados([]);
    setCongregadoSelecionado(null);
    setDataDecisaoInput(new Date().toISOString().slice(0, 10));
    setObservacoesInput('');
  };

  // Salvar / Iniciar Jornada de Discipulado vinculada ao Congregado
  const handleSalvarJornada = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ctx?.ministryId) return;

    if (!congregadoSelecionado) {
      showNotification('warning', 'Seleção Obrigatória', 'Selecione um congregado cadastrado na Secretaria.');
      return;
    }

    setSalvando(true);
    try {
      const res = await fetch('/api/v1/discipulado/jornadas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          member_id: congregadoSelecionado.id,
          congregacao_id: congregadoSelecionado.congregacao_id || ctx.congregacaoId || null,
          data_decisao: dataDecisaoInput,
          observacoes: observacoesInput.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao registrar jornada de discipulado.');
      }

      showNotification('success', 'Jornada Iniciada', data.mensagem || 'Jornada de discipulado iniciada com sucesso!');

      resetFormulario();
      setModalNovoConvertidoOpen(false);
      await loadJornadas();
    } catch (err: any) {
      showNotification('error', 'Atenção', err?.message || 'Erro ao iniciar jornada do discípulo.');
    } finally {
      setSalvando(false);
    }
  };

  // Limpar filtros da Toolbar
  const handleLimparFiltros = () => {
    setBuscaTexto('');
    setFiltroStatus('todos');
    setFiltroFase('todas');
  };

  // Filtragem local por texto
  const jornadasFiltradas = useMemo(() => {
    if (!buscaTexto.trim()) return jornadas;
    const q = buscaTexto.toLowerCase();
    return jornadas.filter((j) => {
      const nome = j.member?.name?.toLowerCase() || '';
      const cpf = j.member?.cpf || '';
      const tel = j.member?.phone || j.member?.celular || '';
      return nome.includes(q) || cpf.includes(q) || tel.includes(q);
    });
  }, [jornadas, buscaTexto]);

  const metricas = useMemo(() => {
    const totalAtivos = jornadas.filter((j) => j.status === 'ativo').length;
    const totalPrimeirosPassos = jornadas.filter((j) => j.fase === 'primeiros_passos' && j.status === 'ativo').length;
    const totalBatismo = jornadas.filter((j) => j.fase === 'preparacao_batismo' && j.status === 'ativo').length;
    const totalConcluidos = jornadas.filter((j) => j.status === 'concluido').length;
    return { totalAtivos, totalPrimeirosPassos, totalBatismo, totalConcluidos };
  }, [jornadas]);

  return (
    <PageLayout
      title="Discipulado & Acompanhamento"
      description="Central de acolhimento, turmas pedagógicas de 26 lições, equipe e relatórios integrados"
    >
      <div className="space-y-6">
        {/* NAVEGAÇÃO ENTRE ABAS CENTRALIZADAS */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-1.5 shadow-2xs flex flex-wrap gap-1">
          <button
            type="button"
            onClick={() => setAbaAtiva('discipulos')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
              abaAtiva === 'discipulos'
                ? 'bg-teal-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Discípulos & Jornadas</span>
          </button>

          <button
            type="button"
            onClick={() => setAbaAtiva('equipe')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
              abaAtiva === 'equipe'
                ? 'bg-teal-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
            }`}
          >
            <UserCog className="w-4 h-4" />
            <span>Equipe & Lideranças</span>
          </button>

          <button
            type="button"
            onClick={() => setAbaAtiva('turmas')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
              abaAtiva === 'turmas'
                ? 'bg-teal-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
            }`}
          >
            <School className="w-4 h-4" />
            <span>Turmas & Diário</span>
          </button>

          <button
            type="button"
            onClick={() => setAbaAtiva('relatorios')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
              abaAtiva === 'relatorios'
                ? 'bg-teal-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
            }`}
          >
            <FileBarChart2 className="w-4 h-4" />
            <span>Relatórios & Prestação</span>
          </button>
        </div>

        {/* ABA 1: DISCÍPULOS & JORNADAS */}
        {abaAtiva === 'discipulos' && (
          <div className="space-y-6">
            {/* CARDS DE MÉTRICAS EXECUTIVAS — Idênticos ao padrão do ERP */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <ExecutiveMetricCard
            title="Discípulos Ativos"
            value={metricas.totalAtivos}
            subtitle="Em acompanhamento"
            icon={Users}
            color="blue"
          />
          <ExecutiveMetricCard
            title="Primeiros Passos"
            value={metricas.totalPrimeirosPassos}
            subtitle="Recém-convertidos"
            icon={Compass}
            color="indigo"
          />
          <ExecutiveMetricCard
            title="Candidatos ao Batismo"
            value={metricas.totalBatismo}
            subtitle="Preparação doutrinária"
            icon={Sparkles}
            color="emerald"
          />
          <ExecutiveMetricCard
            title="Jornadas Concluídas"
            value={metricas.totalConcluidos}
            subtitle="Membros integrados"
            icon={UserCheck}
            color="slate"
          />
        </div>

        {/* TOOLBAR E FILTROS — Padrão Secretaria → Membros */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 sm:p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 sm:gap-4 items-end">
            {/* Campo de Pesquisa */}
            <div className="sm:col-span-2 lg:col-span-5">
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                Buscar Discípulo
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Search className="w-4 h-4 text-slate-400" />
                </div>
                <input
                  type="text"
                  value={buscaTexto}
                  onChange={(e) => setBuscaTexto(e.target.value)}
                  placeholder="Nome, CPF ou telefone..."
                  className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50/70 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition"
                />
              </div>
            </div>

            {/* Filtro de Fase */}
            <div className="lg:col-span-3">
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                Fase da Jornada
              </label>
              <select
                value={filtroFase}
                onChange={(e) => setFiltroFase(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50/70 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition cursor-pointer"
              >
                <option value="todas">Todas as Fases</option>
                <option value="primeiros_passos">Primeiros Passos</option>
                <option value="fundamentos">Fundamentos</option>
                <option value="preparacao_batismo">Candidato ao Batismo</option>
                <option value="integracao">Integração Ministerial</option>
              </select>
            </div>

            {/* Filtro de Status */}
            <div className="lg:col-span-2">
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                Status
              </label>
              <select
                value={filtroStatus}
                onChange={(e) => setFiltroStatus(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50/70 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition cursor-pointer"
              >
                <option value="todos">Todos</option>
                <option value="ativo">Ativo</option>
                <option value="concluido">Concluído</option>
                <option value="pausado">Pausado</option>
                <option value="desistente">Desistente</option>
              </select>
            </div>

            {/* Botão Limpar Filtros */}
            <div className="sm:col-span-2 lg:col-span-2 flex items-center gap-2">
              <button
                type="button"
                onClick={handleLimparFiltros}
                className="w-full px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-xl font-bold text-xs sm:text-sm transition shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer"
                title="Limpar filtros"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-600" />
                <span>Limpar</span>
              </button>
            </div>
          </div>
        </div>

        {/* BLOCO DA TABELA / LISTAGEM COM BOTÃO DESTACADO "+ NOVO CONVERTIDO" */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
          {/* Cabeçalho da Listagem */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 border-b border-slate-200/80 bg-white">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-700 border border-teal-200 flex items-center justify-center font-bold">
                <BookOpen className="w-5 h-5 text-teal-700" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Painel de Discípulos
                </h2>
                <p className="text-xs text-slate-500">
                  Acompanhamento contínuo dos novos convertidos e candidatos ao batismo
                </p>
              </div>
              <span className="ml-2 px-3 py-1 bg-teal-50 text-teal-800 border border-teal-200/90 rounded-full text-xs font-bold">
                {jornadasFiltradas.length} {jornadasFiltradas.length === 1 ? 'discípulo' : 'discípulos'}
                {jornadasFiltradas.length !== jornadas.length && (
                  <span className="ml-1 text-[11px] text-teal-700 font-medium">de {jornadas.length}</span>
                )}
              </span>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={loadJornadas}
                disabled={loading}
                className="px-3.5 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-2xs disabled:opacity-60"
                title="Atualizar listagem"
              >
                <RefreshCw size={13} className={loading ? 'animate-spin text-teal-600' : 'text-slate-600'} />
                <span>Atualizar</span>
              </button>

              {/* BOTÃO DESTACADO "+ NOVO CONVERTIDO" */}
              <button
                type="button"
                onClick={() => setModalNovoConvertidoOpen(true)}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-700 rounded-xl transition text-xs sm:text-sm font-bold flex items-center gap-2 shadow-sm cursor-pointer"
                title="Cadastrar novo convertido e iniciar jornada de discipulado"
              >
                <UserPlus size={16} className="text-white" />
                <span>+ Novo Convertido</span>
              </button>
            </div>
          </div>

          {/* Estado de Carregamento */}
          {loading ? (
            <div className="py-20 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-teal-600 mx-auto mb-3" />
              <p className="text-xs text-slate-500 font-semibold">Carregando jornadas de discipulado...</p>
            </div>
          ) : jornadasFiltradas.length === 0 ? (
            <div className="py-20 text-center space-y-3 p-6">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 border border-slate-200 text-slate-400 flex items-center justify-center mx-auto">
                <Users className="w-7 h-7 text-slate-400" />
              </div>
              <h3 className="text-base font-bold text-slate-800">Nenhum discípulo encontrado</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                Não há registros correspondentes aos filtros selecionados. Clique no botão destacado <strong>&quot;+ Novo Convertido&quot;</strong> acima para registrar uma decisão e acolher o discípulo.
              </p>
            </div>
          ) : (
            <>
              {/* CARDS MOBILE (telas < md) — Padrão MembrosTable */}
              <div className="md:hidden space-y-3 p-4 bg-slate-50/50">
                {jornadasFiltradas.map((j, index) => {
                  const faseInfo = FASE_LABELS[j.fase] || { label: j.fase, badgeClass: 'bg-slate-100 text-slate-700 border-slate-200' };
                  const statusInfo = STATUS_LABELS[j.status] || { label: j.status, dotClass: 'bg-slate-400', textClass: 'text-slate-700' };

                  return (
                    <div
                      key={j.id}
                      className={`border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-3 ${
                        index % 2 === 1 ? 'bg-slate-50/80' : 'bg-white'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-11 h-11 bg-teal-100 text-teal-800 rounded-xl overflow-hidden flex items-center justify-center font-bold text-xs shrink-0 border border-teal-200 shadow-2xs">
                          {j.member?.name ? j.member.name.slice(0, 2).toUpperCase() : 'ND'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-slate-900 text-sm break-words">{j.member?.name || 'Não identificado'}</p>
                          <div className="text-xs text-slate-600 mt-1 space-y-0.5">
                            <p>
                              CPF: <span className="font-mono text-slate-800">{j.member?.cpf ? formatCpf(j.member.cpf) : '—'}</span>
                            </p>
                            <p>
                              Tel: <span className="font-mono text-slate-800">{j.member?.phone || j.member?.celular ? formatPhone(j.member.phone || j.member.celular) : '—'}</span>
                            </p>
                            <p>
                              Congregação: <span className="text-slate-800 font-medium">{j.congregacao?.nome || 'Sede Geral'}</span>
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-200/80 text-xs">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-semibold border ${faseInfo.badgeClass}`}>
                          {faseInfo.label}
                        </span>
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
                          <span className={`w-2 h-2 rounded-full ${statusInfo.dotClass}`} />
                          <span className={statusInfo.textClass}>{statusInfo.label}</span>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* TABELA DESKTOP (telas md+) — Padrão MembrosTable */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[900px]">
                  <thead>
                    <tr className="bg-slate-100/90 border-b border-slate-200 text-[11px] font-bold text-slate-800 uppercase tracking-wider">
                      <th className="px-5 py-3.5">Discípulo</th>
                      <th className="px-4 py-3.5">Contatos</th>
                      <th className="px-4 py-3.5">Fase Atual</th>
                      <th className="px-4 py-3.5">Data Decisão</th>
                      <th className="px-4 py-3.5">Congregação</th>
                      <th className="px-5 py-3.5 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/80">
                    {jornadasFiltradas.map((j, index) => {
                      const faseInfo = FASE_LABELS[j.fase] || { label: j.fase, badgeClass: 'bg-slate-100 text-slate-700 border-slate-200' };
                      const statusInfo = STATUS_LABELS[j.status] || { label: j.status, dotClass: 'bg-slate-400', textClass: 'text-slate-700' };

                      return (
                        <tr
                          key={j.id}
                          className={`hover:bg-teal-50/30 transition-colors ${
                            index % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'
                          }`}
                        >
                          {/* Discípulo & CPF */}
                          <td className="px-5 py-4 font-bold text-slate-900">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-800 border border-teal-200/80 flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                                {j.member?.name ? j.member.name.slice(0, 2).toUpperCase() : 'ND'}
                              </div>
                              <div className="min-w-0">
                                <span className="block font-bold text-slate-900 truncate max-w-[240px]">
                                  {j.member?.name || 'Não identificado'}
                                </span>
                                <span className="text-[11px] text-slate-500 font-normal">
                                  CPF: <span className="font-mono text-slate-700">{j.member?.cpf ? formatCpf(j.member.cpf) : '—'}</span> • <span className="uppercase text-[10px] font-bold text-teal-800 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200/60">{j.member?.tipo_cadastro || 'CONGREGADO'}</span>
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Contatos */}
                          <td className="px-4 py-4 text-slate-600">
                            <span className="font-mono text-xs text-slate-800 font-medium block">
                              {j.member?.phone || j.member?.celular ? formatPhone(j.member.phone || j.member.celular) : '—'}
                            </span>
                          </td>

                          {/* Fase */}
                          <td className="px-4 py-4">
                            <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold border shadow-2xs ${faseInfo.badgeClass}`}>
                              {faseInfo.label}
                            </span>
                          </td>

                          {/* Data Decisão */}
                          <td className="px-4 py-4 text-slate-700 font-medium text-xs">
                            {j.data_decisao ? new Date(j.data_decisao).toLocaleDateString('pt-BR') : '—'}
                          </td>

                          {/* Congregação */}
                          <td className="px-4 py-4 text-slate-700 text-xs font-medium">
                            {j.congregacao?.nome || 'Sede Geral'}
                          </td>

                          {/* Status */}
                          <td className="px-5 py-4 text-right">
                            <span className="inline-flex items-center gap-2 text-xs">
                              <span className={`w-2.5 h-2.5 rounded-full ${statusInfo.dotClass}`} />
                              <span className={statusInfo.textClass}>{statusInfo.label}</span>
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    )}

    {/* CONTEÚDO DA ABA 2: EQUIPE & LIDERANÇAS */}
    {abaAtiva === 'equipe' && ctx?.ministryId && (
      <TabEquipe
        ministryId={ctx.ministryId}
        onNotification={(type, title, message) =>
          showNotification(type, title, message)
        }
      />
    )}

    {/* CONTEÚDO DA ABA 3: TURMAS & DIÁRIO */}
    {abaAtiva === 'turmas' && ctx?.ministryId && (
      <TabTurmas
        ministryId={ctx.ministryId}
        onNotification={(type, title, message) =>
          showNotification(type, title, message)
        }
      />
    )}

    {/* CONTEÚDO DA ABA 4: RELATÓRIOS & PRESTAÇÃO */}
    {abaAtiva === 'relatorios' && ctx?.ministryId && (
      <TabRelatorios
        ministryId={ctx.ministryId}
        onNotification={(type, title, message) =>
          showNotification(type, title, message)
        }
      />
    )}
  </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* MODAL RESPONSIVO: NOVO CONVERTIDO / INICIAR JORNADA                 */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {modalNovoConvertidoOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200"
        >
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Cabeçalho do Modal — Padrão Executivo Secretaria */}
            <div className="bg-linear-to-r from-teal-800 to-slate-900 text-white px-6 py-4.5 flex items-center justify-between border-b border-teal-900 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-teal-200 shadow-inner">
                  <UserPlus className="w-5 h-5 text-teal-300" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-white">Novo Convertido</h3>
                  <p className="text-xs text-teal-200/80">Acolhimento, validação oficial na Secretaria e Início da Jornada</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalNovoConvertidoOpen(false)}
                className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition cursor-pointer"
                title="Fechar modal"
              >
                <X size={18} />
              </button>
            </div>

            {/* Corpo do Modal com Rolagem Independente */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
              {/* ETAPA 1: BUSCA DINÂMICA DE CONGREGADOS EM MEMBERS */}
              <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-3.5">
                <div className="flex items-center gap-2 text-slate-900">
                  <Search className="w-4 h-4 text-teal-700" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    1. Selecionar Congregado na Secretaria
                  </h4>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Digite ao menos <strong>3 letras do nome</strong> ou o <strong>telefone</strong> do congregado para localizá-lo na base oficial da Secretaria. O discipulado acolhe exclusivamente pessoas já registradas como <strong>Congregado</strong>.
                </p>

                {/* Campos de Busca */}
                {!congregadoSelecionado && (
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                    <div className="sm:col-span-7 relative">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        value={buscaCongregadoTexto}
                        onChange={(e) => setBuscaCongregadoTexto(e.target.value)}
                        placeholder="Nome do congregado (mín. 3 letras)..."
                        className="w-full pl-9 pr-3 py-2.5 text-xs sm:text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600"
                      />
                    </div>
                    <div className="sm:col-span-5 relative">
                      <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        value={buscaCongregadoTel}
                        onChange={(e) => setBuscaCongregadoTel(formatPhone(e.target.value))}
                        placeholder="(00) 00000-0000"
                        className="w-full pl-9 pr-3 py-2.5 text-xs sm:text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 font-mono"
                      />
                    </div>
                  </div>
                )}

                {/* Loading da busca */}
                {buscandoCongregados && (
                  <div className="py-2 text-xs text-teal-700 flex items-center gap-2">
                    <Loader2 size={14} className="animate-spin" />
                    <span>Consultando base de congregados...</span>
                  </div>
                )}

                {/* Lista de sugestões encontradas */}
                {!congregadoSelecionado && congregadosEncontrados.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-slate-200 animate-in fade-in">
                    <p className="text-xs font-bold text-slate-700">Congregados localizados (clique para selecionar):</p>
                    <div className="grid grid-cols-1 gap-2 max-h-56 overflow-y-auto pr-1">
                      {congregadosEncontrados.map((c) => (
                        <div
                          key={c.id}
                          onClick={() => selecionarCongregado(c)}
                          className="p-3 border border-slate-200 bg-white hover:border-teal-500 hover:bg-teal-50/40 rounded-xl cursor-pointer transition text-xs flex items-center justify-between shadow-2xs"
                        >
                          <div className="space-y-0.5">
                            <p className="font-bold text-slate-900 text-sm">{c.name}</p>
                            <p className="text-[11px] text-slate-600">
                              Tel: <span className="font-mono text-slate-800">{formatPhone(c.phone)}</span> • CPF: <span className="font-mono">{c.cpf ? formatCpf(c.cpf) : 'Não informado'}</span>
                            </p>
                            <p className="text-[11px] text-teal-700 font-medium">
                              Congregação: {c.congregacao_nome || 'Sede Geral'}
                            </p>
                          </div>
                          <span className="px-2.5 py-1 rounded-lg bg-teal-50 text-teal-800 border border-teal-200 font-bold text-[11px] shrink-0">
                            Selecionar
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {!congregadoSelecionado && !buscandoCongregados && buscaCongregadoTexto.trim().length >= 3 && congregadosEncontrados.length === 0 && (
                  <p className="text-xs text-slate-500 italic pt-1">
                    Nenhum congregado localizado com esse nome. Verifique se a pessoa já possui cadastro na Secretaria como Congregado.
                  </p>
                )}

                {/* Congregado Selecionado em Modo Somente Leitura */}
                {congregadoSelecionado && (
                  <div className="p-4 bg-emerald-50/80 border border-emerald-300 rounded-xl flex items-start justify-between gap-3 animate-in fade-in">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span className="text-xs font-bold text-emerald-900">Congregado Selecionado:</span>
                        <span className="text-sm font-extrabold text-emerald-950">{congregadoSelecionado.name}</span>
                      </div>
                      <div className="text-xs text-emerald-900 pl-6 space-y-0.5">
                        <p>
                          CPF: <span className="font-mono font-bold">{congregadoSelecionado.cpf ? formatCpf(congregadoSelecionado.cpf) : 'Não informado'}</span> • Tel: <span className="font-bold">{formatPhone(congregadoSelecionado.phone)}</span>
                        </p>
                        <p>
                          Congregação de Origem: <span className="font-bold">{congregadoSelecionado.congregacao_nome || 'Sede Geral'}</span>
                        </p>
                        <p className="text-[11px] text-emerald-800">
                          {congregadoSelecionado.bairro ? `${congregadoSelecionado.bairro}, ` : ''}{congregadoSelecionado.cidade || 'Cidade não informada'}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={desmarcarCongregado}
                      className="px-2.5 py-1 text-xs font-bold text-emerald-800 hover:text-emerald-950 rounded-lg hover:bg-emerald-100 transition border border-emerald-300 cursor-pointer"
                      title="Trocar congregado"
                    >
                      Trocar
                    </button>
                  </div>
                )}
              </div>

              {/* ETAPA 2: DADOS ESPECÍFICOS DA JORNADA */}
              <form onSubmit={handleSalvarJornada} className="space-y-4">
                <div className="bg-teal-50/80 p-3.5 rounded-xl border border-teal-200 text-xs text-teal-900 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    <ShieldCheck className="w-4 h-4 text-teal-700 shrink-0" />
                    <span>Início Oficial da Jornada Pedagógica</span>
                  </div>
                  <p className="text-[11px] text-teal-800 leading-relaxed">
                    O cadastro de membros permanece inalterado. Será iniciada uma nova jornada pedagógica de 26 lições vinculada a este congregado, com garantia de unicidade ativa.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Data da Decisão */}
                  <div>
                    <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">
                      Data da Decisão / Entrega <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={dataDecisaoInput}
                      onChange={(e) => setDataDecisaoInput(e.target.value)}
                      className="w-full text-xs sm:text-sm p-2.5 bg-slate-50/70 rounded-xl border border-slate-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 font-medium"
                    />
                  </div>

                  {/* Congregação Destino (herdada do cadastro) */}
                  <div>
                    <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">
                      Congregação Vinculada
                    </label>
                    <input
                      type="text"
                      disabled
                      value={congregadoSelecionado?.congregacao_nome || 'Selecione o congregado acima'}
                      className="w-full text-xs sm:text-sm p-2.5 bg-slate-100 rounded-xl border border-slate-200 text-slate-600 cursor-not-allowed font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">
                    Observações Pastorais / Histórico
                  </label>
                  <textarea
                    rows={3}
                    value={observacoesInput}
                    onChange={(e) => setObservacoesInput(e.target.value)}
                    placeholder="Histórico da decisão, necessidades de acompanhamento, oração..."
                    className="w-full text-xs sm:text-sm p-2.5 bg-slate-50/70 rounded-xl border border-slate-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 resize-none font-medium"
                  />
                </div>

                {/* Rodapé de Ações do Modal */}
                <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      resetFormulario();
                      setModalNovoConvertidoOpen(false);
                    }}
                    className="px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={salvando || !congregadoSelecionado}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm rounded-xl transition shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50 border border-emerald-700"
                  >
                    {salvando ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        <span>Iniciando jornada...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={16} />
                        <span>Iniciar Jornada de Discipulado</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* NOTIFICAÇÃO MODAL OFICIAL */}
      <NotificationModal
        isOpen={modalNotify.isOpen}
        title={modalNotify.title}
        message={modalNotify.message}
        type={modalNotify.type}
        onClose={() => setModalNotify({ ...modalNotify, isOpen: false })}
      />
    </PageLayout>
  );
}
