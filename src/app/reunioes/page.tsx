import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import PageLayout from '@/components/PageLayout';
import { useRequireModulo } from '@/hooks/useRequireModulo';
import { usePlanFeatures } from '@/hooks/usePlanFeatures';
import { createClient } from '@/lib/supabase-client';
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  QrCode,
  Tv,
  FileCheck2,
  AlertTriangle,
  Plus,
  RefreshCw,
  Eye,
  CheckCircle2,
  Lock,
  Search,
  Check,
  Copy,
  ExternalLink,
} from 'lucide-react';

interface ReuniaoItem {
  id: string;
  ministry_id: string;
  congregacao_id?: string | null;
  titulo: string;
  pauta?: string | null;
  local: string;
  data_reuniao: string;
  horario_inicio: string;
  horario_limite_entrada?: string | null;
  limite_checkin_em?: string | null;
  status: 'agendada' | 'em_andamento' | 'encerrada' | 'cancelada';
  iniciada_em?: string | null;
  encerrada_em?: string | null;
  total_esperados: number;
  total_presentes: number;
  total_ausentes: number;
  total_justificados: number;
  created_at: string;
  updated_at: string;
  congregacoes?: {
    id: string;
    nome: string;
  } | null;
}

export default function ReunioesPage() {
  const { ctx, bloqueado } = useRequireModulo('reunioes');
  const planFeatures = usePlanFeatures();

  // Estados de dados
  const [reunioes, setReunioes] = useState<ReuniaoItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [filtroStatus, setFiltroStatus] = useState<string>('todas');
  const [filtroBusca, setFiltroBusca] = useState<string>('');

  // Modais
  const [modalNovaAberto, setModalNovaAberto] = useState<boolean>(false);
  const [modalPainelAberto, setModalPainelAberto] = useState<boolean>(false);
  const [modalEncerrarAberto, setModalEncerrarAberto] = useState<boolean>(false);
  const [reuniaoSelecionada, setReuniaoSelecionada] = useState<ReuniaoItem | null>(null);

  // Estado do formulário Nova Reunião
  const [formTitulo, setFormTitulo] = useState<string>('');
  const [formPauta, setFormPauta] = useState<string>('');
  const [formLocal, setFormLocal] = useState<string>('Templo Central');
  const [formData, setFormData] = useState<string>('');
  const [formHorarioInicio, setFormHorarioInicio] = useState<string>('19:00');
  const [formHorarioLimite, setFormHorarioLimite] = useState<string>('19:30');
  const [salvandoNova, setSalvandoNova] = useState<boolean>(false);
  const [erroForm, setErroForm] = useState<string | null>(null);

  // Estado do Painel TV
  const [carregandoToken, setCarregandoToken] = useState<boolean>(false);
  const [tokenInfo, setTokenInfo] = useState<{ url_painel?: string; token?: string; status_efetivo?: string } | null>(null);
  const [copiado, setCopiado] = useState<boolean>(false);

  // Estado de Encerramento
  const [encerrando, setEncerrando] = useState<boolean>(false);

  // ─── Helper de Autenticação para Chamadas do Frontend ──────────────────────
  const fetchAutenticado = useCallback(async (url: string, options: RequestInit = {}) => {
    const supabase = createClient();
    const { data: { session }, error: sessionErr } = await supabase.auth.getSession();

    if (sessionErr || !session?.access_token) {
      throw new Error('Sessão expirada ou não autenticada. Faça login novamente.');
    }

    const headers = new Headers(options.headers || {});
    headers.set('Authorization', `Bearer ${session.access_token}`);

    return fetch(url, {
      ...options,
      headers,
    });
  }, []);

  // ─── 1. Carregar Reuniões do Tenant ────────────────────────────────────────
  const carregarReunioes = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (filtroStatus !== 'todas') {
        params.append('status', filtroStatus);
      }

      const res = await fetchAutenticado(`/api/v1/reunioes?${params.toString()}`, {
        cache: 'no-store',
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao carregar lista de reuniões.');
      }

      setReunioes(data.reunioes || []);
    } catch (err: any) {
      setError(err?.message || 'Falha ao buscar reuniões do servidor.');
    } finally {
      setLoading(false);
    }
  }, [filtroStatus, fetchAutenticado]);

  useEffect(() => {
    if (!bloqueado && planFeatures.hasFeature('meetings_module')) {
      carregarReunioes();
    }
  }, [bloqueado, planFeatures, carregarReunioes]);

  // ─── 2. Criar Nova Reunião ─────────────────────────────────────────────────
  const handleCriarReuniao = async (e: React.FormEvent) => {
    e.preventDefault();
    setErroForm(null);

    if (!formTitulo.trim()) {
      setErroForm('O título da reunião é obrigatório.');
      return;
    }
    if (!formData) {
      setErroForm('A data da reunião é obrigatória.');
      return;
    }
    if (!formHorarioInicio || !formHorarioLimite) {
      setErroForm('Informe o horário de início e o limite para check-in.');
      return;
    }

    try {
      setSalvandoNova(true);

      const payload = {
        titulo: formTitulo.trim(),
        pauta: formPauta.trim() || undefined,
        local: formLocal.trim() || 'Templo Central',
        data_reuniao: formData,
        horario_inicio: formHorarioInicio,
        horario_limite_entrada: formHorarioLimite,
      };

      const res = await fetchAutenticado('/api/v1/reunioes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || 'Erro ao cadastrar reunião.');
      }

      // Limpar formulário e fechar modal
      setFormTitulo('');
      setFormPauta('');
      setFormLocal('Templo Central');
      setFormData('');
      setFormHorarioInicio('19:00');
      setFormHorarioLimite('19:30');
      setModalNovaAberto(false);

      // Recarregar dados
      await carregarReunioes();
    } catch (err: any) {
      setErroForm(err?.message || 'Falha ao criar reunião.');
    } finally {
      setSalvandoNova(false);
    }
  };

  // ─── 3. Gerar / Consultar Link do Painel TV ────────────────────────────────
  const abrirPainelTv = async (reuniao: ReuniaoItem) => {
    setReuniaoSelecionada(reuniao);
    setModalPainelAberto(true);
    setCarregandoToken(true);
    setCopiado(false);

    try {
      // 1. Consultar estado do token
      const resGet = await fetchAutenticado(`/api/v1/reunioes/${reuniao.id}/painel/token`);
      const dataGet = await resGet.json();

      if (dataGet.success && dataGet.status_efetivo === 'ativo' && dataGet.token_info) {
        setTokenInfo({
          status_efetivo: 'ativo',
          url_painel: `${window.location.origin}/reunioes/painel/${dataGet.token_info.id}`,
        });
      }

      // Se não há token ativo e a reunião não está encerrada, gerar novo token
      if (reuniao.status !== 'encerrada') {
        const resPost = await fetchAutenticado(`/api/v1/reunioes/${reuniao.id}/painel/token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ duracao_horas: 24 }),
        });
        const dataPost = await resPost.json();
        if (dataPost.success) {
          setTokenInfo({
            url_painel: `${window.location.origin}/reunioes/painel/${dataPost.token}`,
            token: dataPost.token,
            status_efetivo: 'ativo',
          });
        }
      }
    } catch (err) {
      console.warn('Erro ao obter token do painel:', err);
    } finally {
      setCarregandoToken(false);
    }
  };

  const copiarLinkPainel = () => {
    if (tokenInfo?.url_painel) {
      navigator.clipboard.writeText(tokenInfo.url_painel);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    }
  };

  // ─── 4. Encerrar Reunião ───────────────────────────────────────────────────
  const executarEncerramento = async () => {
    if (!reuniaoSelecionada || encerrando) return;

    try {
      setEncerrando(true);
      const res = await fetchAutenticado(`/api/v1/reunioes/${reuniaoSelecionada.id}/encerrar`, {
        method: 'POST',
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao encerrar reunião.');
      }

      setModalEncerrarAberto(false);
      setReuniaoSelecionada(null);
      await carregarReunioes();
    } catch (err: any) {
      alert(err?.message || 'Falha ao encerrar a reunião.');
    } finally {
      setEncerrando(false);
    }
  };

  // ─── Indicadores Reais Calculados ──────────────────────────────────────────
  const totalAgendadas = useMemo(
    () => reunioes.filter((r) => r.status === 'agendada').length,
    [reunioes]
  );
  const totalEmAndamento = useMemo(
    () => reunioes.filter((r) => r.status === 'em_andamento').length,
    [reunioes]
  );
  const totalEncerradas = useMemo(
    () => reunioes.filter((r) => r.status === 'encerrada').length,
    [reunioes]
  );
  const totalAusenciasGerais = useMemo(
    () => reunioes.reduce((acc, r) => acc + (r.total_ausentes || 0), 0),
    [reunioes]
  );

  // Filtro em memória por texto de busca
  const reunioesFiltradas = useMemo(() => {
    if (!filtroBusca.trim()) return reunioes;
    const term = filtroBusca.toLowerCase();
    return reunioes.filter(
      (r) =>
        r.titulo.toLowerCase().includes(term) ||
        r.local.toLowerCase().includes(term) ||
        (r.congregacoes?.nome && r.congregacoes.nome.toLowerCase().includes(term))
    );
  }, [reunioes, filtroBusca]);

  // ─── Verificação de Plano ──────────────────────────────────────────────────
  if (ctx.loading || planFeatures.loading) {
    return (
      <PageLayout
        title="Reuniões Ministeriais"
        description="Agendamento, presença e acompanhamento das reuniões"
        activeMenu="reunioes"
      >
        <div className="flex items-center justify-center p-16 text-slate-500 gap-3">
          <RefreshCw className="w-6 h-6 animate-spin text-teal-600" />
          <span>Carregando módulo de reuniões...</span>
        </div>
      </PageLayout>
    );
  }

  if (!planFeatures.has_modulo_reunioes || !planFeatures.hasFeature('meetings_module')) {
    return (
      <PageLayout
        title="Reuniões Ministeriais"
        description="Agendamento, presença e acompanhamento das reuniões"
        activeMenu="reunioes"
      >
        <div className="bg-white rounded-3xl border border-slate-200 p-10 shadow-sm text-center max-w-2xl mx-auto space-y-5 my-10">
          <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto text-blue-600 border border-blue-200/60">
            <Users className="w-8 h-8" />
          </div>
          <div>
            <span className="inline-block px-3 py-1 bg-blue-100 text-blue-800 text-xs font-bold rounded-full mb-3">
              Recurso do Plano Intermediário
            </span>
            <h2 className="text-xl font-bold text-slate-800">Módulo de Reuniões Ministeriais</h2>
          </div>
          <p className="text-slate-600 text-sm leading-relaxed max-w-lg mx-auto">
            A gestão de reuniões com snapshot automático de ministros, check-in por QR Code, painel em tempo real e controle de advertências está disponível a partir do Plano Intermediário.
          </p>
          <div className="pt-3">
            <Link
              href="/configuracoes"
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#123b63] text-white text-sm font-semibold rounded-xl hover:bg-[#1a4f85] transition shadow"
            >
              Fazer Upgrade do Plano
            </Link>
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title="Reuniões Ministeriais"
      description="Agendamento, presença e acompanhamento das reuniões"
      activeMenu="reunioes"
      headerExtra={
        <div className="flex items-center gap-3">
          <Link
            href="/reunioes/faltas"
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition border border-slate-300 shadow-sm"
          >
            <FileCheck2 className="w-4 h-4 text-amber-600" />
            <span>Faltas e Justificativas</span>
          </Link>

          <button
            onClick={() => setModalNovaAberto(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-500 hover:to-teal-600 text-white text-xs font-bold rounded-xl shadow transition"
          >
            <Plus className="w-4 h-4" />
            <span>Nova Reunião</span>
          </button>
        </div>
      }
    >
      {/* ─── 1. CARDS DE INDICADORES REAIS DO TENANT ─── */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase">
            <span>Próximas Reuniões</span>
            <Calendar className="w-4 h-4 text-teal-600" />
          </div>
          <p className="text-3xl font-black text-slate-800 mt-2">{totalAgendadas}</p>
          <span className="text-[11px] text-slate-400 font-medium">Status: Agendada</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase">
            <span>Em Andamento</span>
            <Clock className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-3xl font-black text-emerald-600 mt-2">{totalEmAndamento}</p>
          <span className="text-[11px] text-slate-400 font-medium">Check-in aberto</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase">
            <span>Reuniões Encerradas</span>
            <CheckCircle2 className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-3xl font-black text-blue-700 mt-2">{totalEncerradas}</p>
          <span className="text-[11px] text-slate-400 font-medium">Concluídas e auditadas</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase">
            <span>Ausências Registradas</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-3xl font-black text-amber-600 mt-2">{totalAusenciasGerais}</p>
          <span className="text-[11px] text-slate-400 font-medium">Total de faltas no histórico</span>
        </div>
      </section>

      {/* ─── 2. FILTROS & BARRA DE BUSCA ─── */}
      <section className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm mb-6 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Abas de Status Oficiais */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl w-full md:w-auto overflow-x-auto">
          {[
            { id: 'todas', label: 'Todas' },
            { id: 'agendada', label: 'Agendadas' },
            { id: 'em_andamento', label: 'Em Andamento' },
            { id: 'encerrada', label: 'Encerradas' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFiltroStatus(tab.id)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                filtroStatus === tab.id
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Busca por título / local */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por título ou local..."
            value={filtroBusca}
            onChange={(e) => setFiltroBusca(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-teal-500 font-medium"
          />
        </div>
      </section>

      {/* ─── 3. LISTA PRINCIPAL DE REUNIÕES ─── */}
      <section>
        {loading ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center text-slate-500">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-teal-600 mb-2" />
            <p className="text-xs font-semibold">Atualizando reuniões...</p>
          </div>
        ) : error ? (
          <div className="bg-rose-50 border border-rose-200 p-6 rounded-2xl text-center text-rose-700 space-y-2">
            <AlertTriangle className="w-8 h-8 mx-auto text-rose-500" />
            <p className="font-bold text-sm">{error}</p>
            <button
              onClick={carregarReunioes}
              className="px-4 py-2 bg-rose-600 text-white font-bold text-xs rounded-xl shadow"
            >
              Tentar Novamente
            </button>
          </div>
        ) : reunioesFiltradas.length === 0 ? (
          /* ─── 7. ESTADO VAZIO INSTITUCIONAL ─── */
          <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center max-w-lg mx-auto my-8 shadow-sm space-y-4">
            <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto border border-slate-200">
              <Calendar className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">Nenhuma reunião cadastrada</h3>
              <p className="text-xs text-slate-500 mt-1">
                Cadastre a primeira reunião ministerial para iniciar o acompanhamento.
              </p>
            </div>
            <button
              onClick={() => setModalNovaAberto(true)}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#123b63] hover:bg-[#0f2a45] text-white text-xs font-bold rounded-xl shadow transition"
            >
              <Plus className="w-4 h-4" />
              <span>+ Nova Reunião</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {reunioesFiltradas.map((r) => {
              const dataFormatada = r.data_reuniao
                ? new Date(r.data_reuniao + 'T00:00:00').toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })
                : '—';

              const percentualPresenca =
                r.total_esperados > 0
                  ? Number(((r.total_presentes / r.total_esperados) * 100).toFixed(1))
                  : 0;

              return (
                <div
                  key={r.id}
                  className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-sm hover:shadow-md transition flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5"
                >
                  {/* Informações da Reunião */}
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Badge de Status Oficial */}
                      {r.status === 'agendada' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-bold border border-blue-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                          Agendada
                        </span>
                      )}
                      {r.status === 'em_andamento' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200 animate-pulse">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          Em Andamento
                        </span>
                      )}
                      {r.status === 'encerrada' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-bold border border-slate-300">
                          <CheckCircle2 className="w-3.5 h-3.5 text-slate-500" />
                          Encerrada
                        </span>
                      )}
                      {r.status === 'cancelada' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 text-xs font-bold border border-rose-200">
                          Cancelada
                        </span>
                      )}

                      <span className="text-xs text-slate-400 font-semibold">•</span>
                      <span className="text-xs font-bold text-slate-600 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {dataFormatada}
                      </span>
                      <span className="text-xs font-bold text-slate-600 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        {r.horario_inicio ? r.horario_inicio.slice(0, 5) : '—'}
                      </span>
                    </div>

                    <h2 className="text-base sm:text-lg font-black text-slate-900 leading-tight">
                      {r.titulo}
                    </h2>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 font-medium">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        {r.local}
                      </span>
                      {r.congregacoes?.nome && (
                        <span>
                          Congregação: <strong className="text-slate-700">{r.congregacoes.nome}</strong>
                        </span>
                      )}
                      {r.horario_limite_entrada && (
                        <span>
                          Limite Check-in: <strong className="text-slate-700">{r.horario_limite_entrada.slice(0, 5)}</strong>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Quórum / Presença */}
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 sm:p-4 min-w-[200px] w-full lg:w-auto flex flex-col justify-between">
                    <div className="flex items-center justify-between text-xs text-slate-600 mb-1">
                      <span className="font-bold">Quórum</span>
                      <span className="font-mono font-bold text-teal-700 text-sm">
                        {percentualPresenca}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden mb-2">
                      <div
                        className="bg-teal-600 h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, percentualPresenca)}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>
                        <strong className="text-slate-800">{r.total_presentes}</strong> presentes
                      </span>
                      <span>/ {r.total_esperados} convidados</span>
                    </div>
                  </div>

                  {/* ─── 5. AÇÕES POR REUNIÃO ─── */}
                  <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-end pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                    {/* Botão Check-in (disponível quando não encerrada/cancelada) */}
                    {r.status !== 'encerrada' && r.status !== 'cancelada' && (
                      <Link
                        href={`/reunioes/${r.id}/checkin`}
                        className="px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shadow-sm transition inline-flex items-center gap-1.5"
                        title="Abrir terminal de Check-in"
                      >
                        <QrCode className="w-4 h-4" />
                        <span>Check-in</span>
                      </Link>
                    )}

                    {/* Botão Painel TV */}
                    <button
                      onClick={() => abrirPainelTv(r)}
                      className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition inline-flex items-center gap-1.5 border border-slate-200"
                      title="Exibir link do painel TV"
                    >
                      <Tv className="w-4 h-4 text-cyan-600" />
                      <span>Painel TV</span>
                    </button>

                    {/* Botão Faltas da Reunião (quando encerrada) */}
                    {r.status === 'encerrada' && (
                      <Link
                        href={`/reunioes/faltas?reuniao_id=${r.id}`}
                        className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 font-bold text-xs rounded-xl transition inline-flex items-center gap-1.5"
                        title="Ver prontuário de faltas desta reunião"
                      >
                        <FileCheck2 className="w-4 h-4 text-amber-600" />
                        <span>Faltas ({r.total_ausentes})</span>
                      </Link>
                    )}

                    {/* Botão Encerrar Reunião (quando agendada/em andamento) */}
                    {r.status !== 'encerrada' && r.status !== 'cancelada' && (
                      <button
                        onClick={() => {
                          setReuniaoSelecionada(r);
                          setModalEncerrarAberto(true);
                        }}
                        className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs rounded-xl transition inline-flex items-center gap-1"
                        title="Encerrar reunião e gerar faltas"
                      >
                        <Lock className="w-3.5 h-3.5" />
                        <span>Encerrar</span>
                      </button>
                    )}

                    {/* Botão Detalhes */}
                    <Link
                      href={`/reunioes/${r.id}`}
                      className="px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold text-xs rounded-xl border border-slate-200 transition inline-flex items-center gap-1"
                      title="Ver detalhes da reunião e participantes"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Detalhes</span>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ─── 6. MODAL: NOVA REUNIÃO MINISTERIAL ─── */}
      {modalNovaAberto && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base font-black text-slate-900">Cadastrar Nova Reunião</h2>
                <p className="text-xs text-slate-500">
                  O snapshot de ministros ativos será congelado automaticamente.
                </p>
              </div>
              <button
                onClick={() => setModalNovaAberto(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>

            {erroForm && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold">
                {erroForm}
              </div>
            )}

            <form onSubmit={handleCriarReuniao} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Título da Reunião *</label>
                <input
                  type="text"
                  required
                  value={formTitulo}
                  onChange={(e) => setFormTitulo(e.target.value)}
                  placeholder="Ex: Assembleia Geral de Ministros - Trimestre 4"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-teal-600 font-medium"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Local do Evento *</label>
                <input
                  type="text"
                  required
                  value={formLocal}
                  onChange={(e) => setFormLocal(e.target.value)}
                  placeholder="Ex: Templo Central / Auditório Nobre"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-teal-600 font-medium"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Data *</label>
                  <input
                    type="date"
                    required
                    value={formData}
                    onChange={(e) => setFormData(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-teal-600 font-medium"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Início *</label>
                  <input
                    type="time"
                    required
                    value={formHorarioInicio}
                    onChange={(e) => setFormHorarioInicio(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-teal-600 font-medium"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Limite Entrada *</label>
                  <input
                    type="time"
                    required
                    value={formHorarioLimite}
                    onChange={(e) => setFormHorarioLimite(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-teal-600 font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Pauta / Observações (Opcional)</label>
                <textarea
                  rows={2}
                  value={formPauta}
                  onChange={(e) => setFormPauta(e.target.value)}
                  placeholder="Tópicos que serão abordados na reunião ministerial..."
                  className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-teal-600 font-medium"
                />
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-500 leading-relaxed">
                Ao cadastrar, o sistema vinculará <strong>somente ministros ativos</strong> ao snapshot da reunião para o controle de presença por carteirinha/QR Code.
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalNovaAberto(false)}
                  disabled={salvandoNova}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvandoNova}
                  className="flex-1 py-2.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow transition"
                >
                  {salvandoNova ? 'Cadastrando e Gerando Snapshot...' : 'Salvar e Conectar Ministros'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: PAINEL TV PÚBLICO ─── */}
      {modalPainelAberto && reuniaoSelecionada && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-cyan-50 text-cyan-700 flex items-center justify-center font-bold">
                  <Tv className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-black text-slate-900">Painel Informativo TV</h2>
                  <p className="text-[11px] text-slate-500">Exibição pública em projetor/TV</p>
                </div>
              </div>
              <button
                onClick={() => setModalPainelAberto(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-slate-600 font-medium leading-relaxed">
                Este link seguro exibe apenas indicadores agregados e consolidados em tempo real, sem necessidade de login.
              </p>

              {carregandoToken ? (
                <div className="p-6 text-center text-slate-400">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto text-cyan-600 mb-2" />
                  <span>Obtendo chave de exibição segura...</span>
                </div>
              ) : tokenInfo?.url_painel ? (
                <div className="space-y-2">
                  <div className="p-3 bg-slate-900 text-teal-300 font-mono text-xs rounded-xl break-all border border-slate-800 flex items-center justify-between gap-2">
                    <span className="truncate">{tokenInfo.url_painel}</span>
                    <button
                      onClick={copiarLinkPainel}
                      className="p-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition"
                      title="Copiar link"
                    >
                      {copiado ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={copiarLinkPainel}
                      className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5"
                    >
                      {copiado ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiado ? 'Link Copiado!' : 'Copiar Link'}</span>
                    </button>

                    <a
                      href={tokenInfo.url_painel}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs rounded-xl shadow flex items-center justify-center gap-1.5"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Abrir na TV</span>
                    </a>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-amber-50 text-amber-800 rounded-xl border border-amber-200 text-xs">
                  Reunião encerrada ou painel inativo.
                </div>
              )}
            </div>

            <button
              onClick={() => setModalPainelAberto(false)}
              className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* ─── MODAL: CONFIRMAÇÃO DE ENCERRAMENTO ─── */}
      {modalEncerrarAberto && reuniaoSelecionada && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <Lock className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h2 className="text-base font-bold text-slate-800">Encerrar Reunião Ministerial?</h2>
              <p className="text-xs text-slate-500 font-semibold">{reuniaoSelecionada.titulo}</p>
            </div>

            <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-900 space-y-1.5 leading-relaxed">
              <p>• Novos check-ins serão bloqueados imediatamente.</p>
              <p>• Os ministros sem presença confirmada receberão registro de <strong>falta</strong>.</p>
              <p>• Cartas de advertência com protocolo serão geradas automaticamente.</p>
              <p>• O painel público de exibição será desativado.</p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setModalEncerrarAberto(false)}
                disabled={encerrando}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl"
              >
                Voltar
              </button>
              <button
                onClick={executarEncerramento}
                disabled={encerrando}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow transition"
              >
                {encerrando ? 'Encerrando e Processando Faltas...' : 'Confirmar Encerramento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  );
}
