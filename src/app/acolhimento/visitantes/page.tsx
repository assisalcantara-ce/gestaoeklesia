'use client';

import { useEffect, useState, useMemo } from 'react';
import PageLayout from '@/components/PageLayout';
import Section from '@/components/Section';
import NotificationModal from '@/components/NotificationModal';
import ExecutiveMetricCard from '@/components/dashboard/ExecutiveMetricCard';
import { useRequireModulo } from '@/hooks/useRequireModulo';
import { createClient } from '@/lib/supabase-client';
import { OrgNomenclaturasState, getDefaultOrgNomenclaturas } from '@/lib/org-nomenclaturas';
import { obterEstruturaOrganizacionalService } from '@/services/estrutura-organizacional-service';
import {
  Users,
  Search,
  RefreshCw,
  X,
  Phone,
  UserCheck,
  History,
  Clock,
  Sparkles,
  MessageSquare,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Flame,
  AlertCircle
} from 'lucide-react';

interface VisitanteOriginal {
  id: string;
  culto_id: string | null;
  ministry_id: string;
  congregacao_id: string | null;
  nome: string;
  telefone: string | null;
  cidade: string | null;
  bairro: string | null;
  igreja_origem: string | null;
  primeira_visita: boolean;
  is_ministro: boolean;
  cargo_ministerial: string | null;
  observacoes: string | null;
  created_at: string;
  culto_registros: {
    id: string;
    tipo_culto: string;
    data_culto: string;
  } | null;
  congregacoes: {
    id: string;
    nome: string;
  } | null;
}

interface VisitaHistorico {
  id: string;
  data: string;
  tipo_culto: string;
  congregacao: string;
  igreja_origem: string | null;
  cargo_ministerial: string | null;
  observacoes: string | null;
}

interface VisitanteConsolidado {
  key: string;
  nome: string;
  telefone: string | null;
  congregacao_origem: string | null;
  data_primeira_visita: string;
  data_ultima_visita: string;
  total_visitas: number;
  ultimo_culto: string | null;
  primeira_visita: boolean;
  is_ministro: boolean;
  cargo_ministerial: string | null;
  igreja_origem: string | null;
  status: 'Primeira Visita' | 'Retornando';
  historico: VisitaHistorico[];
}

interface CongregacaoOption {
  id: string;
  nome: string;
}

const formatDate = (value?: string | null) => {
  if (!value) return '';
  const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : value;
};

export default function VisitantesPage() {
  const { ctx, bloqueado } = useRequireModulo('secretaria_local');
  const supabase = useMemo(() => createClient(), []);

  // Nomenclaturas e Congregações
  const [nomenclaturas, setNomenclaturas] = useState<OrgNomenclaturasState>(getDefaultOrgNomenclaturas());
  const [congregacoes, setCongregacoes] = useState<CongregacaoOption[]>([]);

  // Visitantes e carregamento
  const [visitantesOriginais, setVisitantesOriginais] = useState<VisitanteOriginal[]>([]);
  const [loading, setLoading] = useState(true);
  const [queryError, setQueryError] = useState<string | null>(null);

  // Visitante selecionado para visualização de histórico
  const [selectedVisitante, setSelectedVisitante] = useState<VisitanteConsolidado | null>(null);

  // Filtros
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCongregacao, setSelectedCongregacao] = useState('TODAS');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [filterPrimeiraVisita, setFilterPrimeiraVisita] = useState('TODOS');
  const [filterMinistro, setFilterMinistro] = useState('TODOS');
  const [filterCargo, setFilterCargo] = useState('TODOS');

  // Paginação: 10 registros por página (mesmo padrão de Cultos)
  const [paginaAtual, setPaginaAtual] = useState(1);
  const ITENS_POR_PAGINA = 10;

  // Notificações
  const [modalNotify, setModalNotify] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'success' as 'success' | 'error' | 'warning' | 'info'
  });

  const showNotification = (type: 'success' | 'error' | 'warning' | 'info', title: string, message: string) => {
    setModalNotify({ isOpen: true, type, title, message });
  };

  const isLocalUser = useMemo(() => {
    if (!ctx?.nivel) return true;
    return !['administrador', 'suporte', 'presidencia', 'secretaria'].includes(ctx.nivel as string);
  }, [ctx?.nivel]);

  // Carregar dados organizacionais
  useEffect(() => {
    const initData = async () => {
      if (!ctx?.ministryId) return;
      try {
        const orgService = await obterEstruturaOrganizacionalService(ctx.ministryId, supabase);
        const labels = orgService.getLabels();
        setNomenclaturas({
          divisaoPrincipal: { opcao1: labels.nomeDivisao1 },
          divisaoSecundaria: { opcao1: labels.nomeDivisao2 },
          divisaoTerciaria: { opcao1: labels.nomeDivisao3 },
        });

        const div1Options = orgService.getOptionsFormatadas(1);
        setCongregacoes(div1Options.map((opt) => ({ id: opt.id, nome: opt.nome })));
      } catch (err) {
        console.error('Erro ao carregar estrutura organizacional:', err);
      }
    };
    if (!ctx?.loading && ctx?.ministryId) {
      initData();
    }
  }, [ctx?.loading, ctx?.ministryId, supabase]);

  // Buscar visitantes brutos
  const loadVisitantes = async () => {
    if (!ctx?.ministryId) return;
    setLoading(true);
    setQueryError(null);
    try {
      let query = supabase
        .from('culto_visitantes')
        .select(`
          *,
          culto_registros (
            id,
            tipo_culto,
            data_culto
          ),
          congregacoes (
            id,
            nome
          )
        `)
        .eq('ministry_id', ctx.ministryId);

      // Usuário local só visualiza da própria congregação
      if (isLocalUser && ctx.congregacaoId) {
        query = query.eq('congregacao_id', ctx.congregacaoId);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        setVisitantesOriginais(data as unknown as VisitanteOriginal[]);
      }
    } catch (err: any) {
      console.error(err);
      const errMsg = err?.message || 'Erro ao carregar lista de visitantes.';
      setQueryError(errMsg);
      showNotification('error', 'Erro', 'Não foi possível carregar a lista de visitantes: ' + errMsg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!ctx?.loading && ctx?.ministryId) {
      loadVisitantes();
    }
  }, [ctx?.loading, ctx?.ministryId, isLocalUser, ctx?.congregacaoId]);

  // Consolidação em memória
  const visitantesConsolidados = useMemo((): VisitanteConsolidado[] => {
    const grupos: Record<string, VisitanteOriginal[]> = {};

    visitantesOriginais.forEach(v => {
      const telLimpo = v.telefone ? v.telefone.replace(/\D/g, '') : '';
      const key = telLimpo || v.nome.trim().toLowerCase();

      if (!grupos[key]) {
        grupos[key] = [];
      }
      grupos[key].push(v);
    });

    return Object.entries(grupos).map(([key, list]): VisitanteConsolidado => {
      const sortedList = [...list].sort((a, b) => {
        const dateA = a.culto_registros?.data_culto || a.created_at;
        const dateB = b.culto_registros?.data_culto || b.created_at;
        return new Date(dateA).getTime() - new Date(dateB).getTime();
      });

      const primeiro = sortedList[0];
      const ultimo = sortedList[sortedList.length - 1];

      const historico: VisitaHistorico[] = sortedList.map(v => ({
        id: v.id,
        data: v.culto_registros?.data_culto || v.created_at,
        tipo_culto: v.culto_registros?.tipo_culto || 'Recepção / Avulso',
        congregacao: v.congregacoes?.nome || 'Geral',
        igreja_origem: v.igreja_origem,
        cargo_ministerial: v.cargo_ministerial,
        observacoes: v.observacoes
      })).reverse();

      const total_visitas = sortedList.length;

      return {
        key,
        nome: ultimo.nome,
        telefone: ultimo.telefone,
        congregacao_origem: primeiro.congregacoes?.nome || 'Geral',
        data_primeira_visita: primeiro.culto_registros?.data_culto || primeiro.created_at,
        data_ultima_visita: ultimo.culto_registros?.data_culto || ultimo.created_at,
        total_visitas,
        ultimo_culto: ultimo.culto_registros?.tipo_culto || 'Recepção / Avulso',
        primeira_visita: primeiro.primeira_visita,
        is_ministro: sortedList.some(v => v.is_ministro),
        cargo_ministerial: ultimo.cargo_ministerial,
        igreja_origem: ultimo.igreja_origem,
        status: total_visitas >= 2 ? 'Retornando' : 'Primeira Visita',
        historico
      };
    });
  }, [visitantesOriginais]);

  // Filtragem local sobre os consolidados
  const filteredVisitantes = useMemo(() => {
    return visitantesConsolidados.filter(v => {
      // 1. Congregação
      if (!isLocalUser && selectedCongregacao !== 'TODAS') {
        const pertence = v.historico.some(h => {
          const original = visitantesOriginais.find(orig => orig.id === h.id);
          return original?.congregacao_id === selectedCongregacao;
        });
        if (!pertence) return false;
      }

      // 2. Busca Nome/Telefone
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const nomeMatch = v.nome?.toLowerCase().includes(query);
        const telMatch = v.telefone?.includes(query);
        if (!nomeMatch && !telMatch) return false;
      }

      // 3. Primeira Visita
      if (filterPrimeiraVisita !== 'TODOS') {
        const isPrimeira = filterPrimeiraVisita === 'SIM';
        if (v.primeira_visita !== isPrimeira) return false;
      }

      // 4. Ministro
      if (filterMinistro !== 'TODOS') {
        const isMin = filterMinistro === 'SIM';
        if (v.is_ministro !== isMin) return false;
      }

      // 5. Cargo Ministerial
      if (filterCargo !== 'TODOS' && v.cargo_ministerial !== filterCargo) {
        return false;
      }

      // 6. Período
      if (dateStart) {
        const start = new Date(dateStart);
        const dataUlt = new Date(v.data_ultima_visita.substring(0, 10));
        if (dataUlt < start) return false;
      }
      if (dateEnd) {
        const end = new Date(dateEnd);
        const dataPri = new Date(v.data_primeira_visita.substring(0, 10));
        if (dataPri > end) return false;
      }

      return true;
    });
  }, [visitantesConsolidados, visitantesOriginais, searchQuery, selectedCongregacao, dateStart, dateEnd, filterPrimeiraVisita, filterMinistro, filterCargo, isLocalUser]);

  // Resetar página ao mudar filtros
  useEffect(() => {
    setPaginaAtual(1);
  }, [searchQuery, selectedCongregacao, dateStart, dateEnd, filterPrimeiraVisita, filterMinistro, filterCargo]);

  // Paginação calculada
  const totalPaginas = Math.max(1, Math.ceil(filteredVisitantes.length / ITENS_POR_PAGINA));
  const paginaValida = Math.min(Math.max(1, paginaAtual), totalPaginas);

  const visitantesPaginados = useMemo(() => {
    const inicio = (paginaValida - 1) * ITENS_POR_PAGINA;
    return filteredVisitantes.slice(inicio, inicio + ITENS_POR_PAGINA);
  }, [filteredVisitantes, paginaValida]);

  // KPIs
  const totalGeral = filteredVisitantes.length;
  const primeiraVisitaCount = filteredVisitantes.filter(v => v.status === 'Primeira Visita').length;
  const retornandoCount = filteredVisitantes.filter(v => v.status === 'Retornando').length;
  const ministrosCount = filteredVisitantes.filter(v => v.is_ministro).length;
  const comTelefoneCount = filteredVisitantes.filter(v => !!v.telefone).length;

  const cargoOptions = useMemo(() => {
    const cargos = new Set<string>();
    visitantesOriginais.forEach(v => {
      if (v.cargo_ministerial) cargos.add(v.cargo_ministerial);
    });
    return Array.from(cargos).sort();
  }, [visitantesOriginais]);

  const cleanFilters = () => {
    setSearchQuery('');
    setSelectedCongregacao('TODAS');
    setDateStart('');
    setDateEnd('');
    setFilterPrimeiraVisita('TODOS');
    setFilterMinistro('TODOS');
    setFilterCargo('TODOS');
  };

  const getWhatsappLink = (nome: string, telefone: string | null) => {
    if (!telefone) return '#';
    const numLimpo = telefone.replace(/\D/g, '');
    const msg = `Olá, ${nome}! A Paz do Senhor. Ficamos muito felizes com sua visita em nossa igreja. Queremos agradecer sua presença e nos colocar à disposição.`;
    return `https://wa.me/55${numLimpo}?text=${encodeURIComponent(msg)}`;
  };

  const labelDivPrincipal = nomenclaturas.divisaoPrincipal.opcao1 || 'CONGREGAÇÃO';

  if (bloqueado) {
    return (
      <PageLayout title="Acesso Negado" description="Módulo Visitantes">
        <div className="p-8 text-center">
          <p className="text-red-500 font-bold">Você não tem permissão para acessar este módulo.</p>
        </div>
      </PageLayout>
    );
  }

  if (ctx?.loading) {
    return (
      <PageLayout title="Visitantes" description="Carregando dados...">
        <div className="min-h-[50vh] flex items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout title="Visitantes" description="Consolidação e histórico de acolhimento dos visitantes dos cultos">
      <div className="p-6 max-w-7xl mx-auto">
        {/* Cabeçalho da Operação */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-4xl">👥</span>
              <h1 className="text-3xl font-bold text-slate-800">Operação de Visitantes</h1>
            </div>
            <p className="text-slate-600">Registro histórico e acompanhamento pastoral dos visitantes da igreja</p>
          </div>
        </div>

        {/* KPIs (Grid de 5 cards seguindo exatamente o padrão de Operação de Cultos) */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <ExecutiveMetricCard title="Total Registrados" value={totalGeral} color="blue" icon={Users} />
          <ExecutiveMetricCard title="Primeira Visita" value={primeiraVisitaCount} color="emerald" icon={UserCheck} />
          <ExecutiveMetricCard title="Retornando" value={retornandoCount} color="indigo" icon={RefreshCw} />
          <ExecutiveMetricCard title="Ministros / Obreiros" value={ministrosCount} color="slate" icon={Flame} />
          <ExecutiveMetricCard title="Com Telefone" value={comTelefoneCount} color="blue" icon={Phone} />
        </div>

        {queryError && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-between text-rose-800 text-sm">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />
              <span>{queryError}</span>
            </div>
            <button
              onClick={() => loadVisitantes()}
              className="px-3 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-900 rounded-xl font-bold text-xs transition flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Tentar Novamente
            </button>
          </div>
        )}

        {/* Seção Principal de Visitantes */}
        <Section title="Histórico e Acompanhamento de Visitantes">
          {/* Caixa de Filtros no mesmo padrão refinado */}
          <div className="bg-slate-50 border border-slate-200/60 p-4 rounded-2xl mb-6 space-y-3">
            {/* Linha 1: Filtros de Seleção */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
              {/* Congregação */}
              <div>
                <label className="block text-[11px] font-black text-slate-550 uppercase mb-1">
                  {labelDivPrincipal}
                </label>
                <select
                  disabled={isLocalUser}
                  value={isLocalUser ? (ctx?.congregacaoId || '') : selectedCongregacao}
                  onChange={e => setSelectedCongregacao(e.target.value)}
                  className="w-full border border-slate-250 rounded-lg px-2.5 py-1.5 text-xs bg-white disabled:opacity-75"
                >
                  {isLocalUser ? (
                    <option value={ctx?.congregacaoId || ''}>
                      {congregacoes.find(c => c.id === ctx?.congregacaoId)?.nome || 'Minha Congregação'}
                    </option>
                  ) : (
                    <>
                      <option value="TODAS">Todas</option>
                      {congregacoes.map(c => (
                        <option key={c.id} value={c.id}>{c.nome}</option>
                      ))}
                    </>
                  )}
                </select>
              </div>

              {/* Status de Visita */}
              <div>
                <label className="block text-[11px] font-black text-slate-550 uppercase mb-1">Status</label>
                <select
                  value={filterPrimeiraVisita}
                  onChange={e => setFilterPrimeiraVisita(e.target.value)}
                  className="w-full border border-slate-250 rounded-lg px-2.5 py-1.5 text-xs bg-white"
                >
                  <option value="TODOS">Todos</option>
                  <option value="SIM">Primeira Visita</option>
                  <option value="NAO">Retornando</option>
                </select>
              </div>

              {/* Ministro / Obreiro */}
              <div>
                <label className="block text-[11px] font-black text-slate-550 uppercase mb-1">Ministro / Obreiro</label>
                <select
                  value={filterMinistro}
                  onChange={e => setFilterMinistro(e.target.value)}
                  className="w-full border border-slate-250 rounded-lg px-2.5 py-1.5 text-xs bg-white"
                >
                  <option value="TODOS">Todos</option>
                  <option value="SIM">Sim</option>
                  <option value="NAO">Não</option>
                </select>
              </div>

              {/* Data Início */}
              <div>
                <label className="block text-[11px] font-black text-slate-550 uppercase mb-1">Data Início</label>
                <input
                  type="date"
                  value={dateStart}
                  onChange={e => setDateStart(e.target.value)}
                  className="w-full border border-slate-250 rounded-lg px-2.5 py-1.5 text-xs bg-white"
                />
              </div>

              {/* Data Fim */}
              <div>
                <label className="block text-[11px] font-black text-slate-550 uppercase mb-1">Data Fim</label>
                <input
                  type="date"
                  value={dateEnd}
                  onChange={e => setDateEnd(e.target.value)}
                  className="w-full border border-slate-250 rounded-lg px-2.5 py-1.5 text-xs bg-white"
                />
              </div>
            </div>

            {/* Linha 2: Busca por Nome/Telefone + Cargo + Botões de Ação */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-3 pt-1 border-t border-slate-200/50 items-end">
              {/* Campo de Busca */}
              <div className="md:col-span-6">
                <label className="block text-[11px] font-black text-slate-550 uppercase mb-1">
                  Buscar Visitante
                </label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Digite o nome ou telefone celular..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-8 border border-slate-250 rounded-lg px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Filtro de Cargo Ministerial */}
              <div className="md:col-span-3">
                <label className="block text-[11px] font-black text-slate-550 uppercase mb-1">
                  Cargo Ministerial
                </label>
                <select
                  value={filterCargo}
                  onChange={e => setFilterCargo(e.target.value)}
                  className="w-full border border-slate-250 rounded-lg px-2.5 py-1.5 text-xs bg-white"
                >
                  <option value="TODOS">Todos os cargos</option>
                  {cargoOptions.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* Ações: Limpar e Atualizar */}
              <div className="md:col-span-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={cleanFilters}
                  className="px-3 py-1.5 border border-slate-250 hover:bg-white text-slate-700 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                  title="Limpar todos os filtros"
                >
                  <X className="h-3.5 w-3.5 text-slate-500" />
                  Limpar
                </button>
                <button
                  type="button"
                  onClick={loadVisitantes}
                  disabled={loading}
                  className="px-3.5 py-1.5 bg-[#062E6F] hover:bg-[#154A92] text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                  title="Atualizar lista de visitantes"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                  Atualizar
                </button>
              </div>
            </div>
          </div>

          {/* Tabela de Dados no Padrão Visual Consolidado */}
          <div className="overflow-x-auto border border-slate-100 rounded-2xl shadow-sm bg-white">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold text-xs">
                  <th className="p-3.5">Visitante</th>
                  <th className="p-3.5">Contato</th>
                  {!isLocalUser && <th className="p-3.5">{labelDivPrincipal} Origem</th>}
                  <th className="p-3.5">Primeira Visita</th>
                  <th className="p-3.5">Última Visita</th>
                  <th className="p-3.5 text-center">Total de Visitas</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={isLocalUser ? 7 : 8} className="p-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <RefreshCw className="h-6 w-6 text-[#062E6F] animate-spin" />
                        <span className="font-semibold text-xs text-slate-600">Carregando visitantes...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredVisitantes.length === 0 ? (
                  <tr>
                    <td colSpan={isLocalUser ? 7 : 8} className="p-8 text-center text-slate-400 text-xs italic">
                      Nenhum visitante encontrado com os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  visitantesPaginados.map(v => (
                    <tr key={v.key} className="hover:bg-slate-50/50 transition">
                      {/* Visitante */}
                      <td className="p-3.5">
                        <div className="font-extrabold text-slate-800 text-sm">{v.nome}</div>
                        {v.is_ministro && (
                          <div className="inline-flex items-center gap-1 text-[10px] text-blue-700 font-semibold mt-0.5">
                            👑 Ministro {v.cargo_ministerial ? `(${v.cargo_ministerial})` : ''}
                            {v.igreja_origem ? ` • ${v.igreja_origem}` : ''}
                          </div>
                        )}
                      </td>

                      {/* Contato */}
                      <td className="p-3.5 whitespace-nowrap">
                        {v.telefone ? (
                          <div className="flex items-center gap-1.5 font-medium text-slate-700">
                            <Phone className="h-3 w-3 text-slate-400 shrink-0" />
                            {v.telefone}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">Sem telefone</span>
                        )}
                      </td>

                      {/* Congregação de Origem */}
                      {!isLocalUser && (
                        <td className="p-3.5 font-medium text-slate-700 whitespace-nowrap">
                          {v.congregacao_origem}
                        </td>
                      )}

                      {/* Primeira Visita */}
                      <td className="p-3.5 whitespace-nowrap">
                        <span className="font-medium text-slate-600 flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-slate-400" />
                          {formatDate(v.data_primeira_visita)}
                        </span>
                      </td>

                      {/* Última Visita */}
                      <td className="p-3.5 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-800 flex items-center gap-1">
                            <Calendar className="h-3 w-3 text-slate-400" />
                            {formatDate(v.data_ultima_visita)}
                          </span>
                          <span className="text-[10px] text-slate-400 mt-0.5">
                            {v.ultimo_culto}
                          </span>
                        </div>
                      </td>

                      {/* Total de Visitas */}
                      <td className="p-3.5 text-center whitespace-nowrap">
                        <span className="inline-flex items-center justify-center bg-slate-100 text-slate-800 font-black text-xs px-2.5 py-1 rounded-lg">
                          {v.total_visitas}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="p-3.5 whitespace-nowrap">
                        {v.status === 'Primeira Visita' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Primeira Visita
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                            Retornando
                          </span>
                        )}
                      </td>

                      {/* Ações */}
                      <td className="p-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Botão WhatsApp */}
                          {v.telefone ? (
                            <a
                              href={getWhatsappLink(v.nome, v.telefone)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                              title="Enviar mensagem pelo WhatsApp"
                            >
                              <MessageSquare className="h-3.5 w-3.5" />
                              WhatsApp
                            </a>
                          ) : (
                            <span
                              className="px-2.5 py-1 bg-slate-50 text-slate-300 rounded-lg text-xs font-bold flex items-center gap-1 cursor-not-allowed"
                              title="Visitante sem telefone registrado"
                            >
                              <MessageSquare className="h-3.5 w-3.5" />
                              WhatsApp
                            </span>
                          )}

                          {/* Botão Histórico */}
                          <button
                            type="button"
                            onClick={() => setSelectedVisitante(v)}
                            className="px-2.5 py-1 bg-[#062E6F]/10 hover:bg-[#062E6F]/20 text-[#062E6F] rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                            title="Visualizar histórico completo de visitas"
                          >
                            <History className="h-3.5 w-3.5" />
                            Histórico
                          </button>

                          {/* Botão Acompanhamento Pastoral */}
                          <button
                            type="button"
                            onClick={() => showNotification('info', 'Acompanhamento Pastoral', `Registro de contato com ${v.nome} será integrado às tarefas da equipe pastoral.`)}
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                            title="Acompanhamento pastoral"
                          >
                            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Barra de Paginação Real (Idêntica à de Cultos) */}
          {filteredVisitantes.length > 0 && (
            <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3 px-2 py-3 bg-white border border-slate-200/80 rounded-2xl">
              <div className="text-xs text-slate-500 font-medium">
                Mostrando <span className="font-bold text-slate-800">{((paginaValida - 1) * ITENS_POR_PAGINA) + 1}</span> a <span className="font-bold text-slate-800">{Math.min(paginaValida * ITENS_POR_PAGINA, filteredVisitantes.length)}</span> de <span className="font-bold text-slate-800">{filteredVisitantes.length}</span> visitantes
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPaginaAtual(p => Math.max(1, p - 1))}
                  disabled={paginaValida <= 1}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                  title="Página Anterior"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Anterior
                </button>

                <span className="text-xs font-bold text-slate-700 px-2">
                  Página {paginaValida} de {totalPaginas}
                </span>

                <button
                  type="button"
                  onClick={() => setPaginaAtual(p => Math.min(totalPaginas, p + 1))}
                  disabled={paginaValida >= totalPaginas}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                  title="Próxima Página"
                >
                  Próxima
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </Section>
      </div>

      {/* Modal: Histórico do Visitante */}
      {selectedVisitante && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl flex flex-col overflow-hidden border border-slate-100 max-h-[85vh] animate-fade-in">
            {/* Header com Gradiente Oficial */}
            <div className="p-5 bg-gradient-to-r from-[#062E6F] to-[#154A92] flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/10 rounded-xl">
                  <History className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white uppercase tracking-wide">
                    Histórico do Visitante
                  </h3>
                  <p className="text-blue-100 text-xs mt-0.5 font-semibold">
                    {selectedVisitante.nome} {selectedVisitante.telefone ? `(${selectedVisitante.telefone})` : ''}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedVisitante(null)}
                className="p-1 rounded-lg text-blue-200 hover:bg-white/15 transition cursor-pointer"
                title="Fechar histórico"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Corpo / Resumo e Timeline */}
            <div className="p-5 overflow-y-auto space-y-6 flex-1 min-h-[250px]">
              {/* Resumo do Perfil */}
              <div className="grid grid-cols-2 gap-3 bg-slate-50 border border-slate-150 rounded-xl p-3.5 text-xs font-semibold text-slate-700">
                <div>
                  <span className="text-slate-400 block text-[9px] uppercase tracking-wider">Status atual</span>
                  <span className="text-slate-800 font-bold">{selectedVisitante.status}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[9px] uppercase tracking-wider">Total de visitas</span>
                  <span className="text-slate-800 font-bold">{selectedVisitante.total_visitas} culto(s)</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[9px] uppercase tracking-wider">Primeira Visita</span>
                  <span className="text-slate-800 font-bold">{formatDate(selectedVisitante.data_primeira_visita)}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[9px] uppercase tracking-wider">Última Visita</span>
                  <span className="text-slate-800 font-bold">{formatDate(selectedVisitante.data_ultima_visita)}</span>
                </div>
              </div>

              {/* Linha do Tempo */}
              <div>
                <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-slate-400" />
                  Linha do Tempo de Visitas
                </h4>

                <div className="relative border-l border-slate-200 pl-4 ml-2.5 space-y-6">
                  {selectedVisitante.historico.map((h) => (
                    <div key={h.id} className="relative">
                      {/* Indicador na linha */}
                      <span className="absolute -left-[22px] top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white border-2 border-[#062E6F] shadow-sm">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#062E6F]" />
                      </span>

                      {/* Card da Visita */}
                      <div className="bg-slate-50/70 border border-slate-100 rounded-xl p-3.5 space-y-1.5">
                        <div className="flex justify-between items-start flex-wrap gap-2">
                          <span className="text-xs font-bold text-slate-800 uppercase">
                            {h.tipo_culto}
                          </span>
                          <span className="text-[10px] font-bold text-slate-500 bg-slate-200/60 px-2 py-0.5 rounded-md">
                            {formatDate(h.data)}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-[10px] font-semibold text-slate-500">
                          <div>
                            <span className="text-slate-400 block">Congregação</span>
                            <span className="text-slate-700">{h.congregacao}</span>
                          </div>
                          {h.cargo_ministerial && (
                            <div>
                              <span className="text-slate-400 block">Cargo na visita</span>
                              <span className="text-slate-700">{h.cargo_ministerial}</span>
                            </div>
                          )}
                          {h.igreja_origem && (
                            <div className="col-span-2">
                              <span className="text-slate-400 block">Igreja de origem</span>
                              <span className="text-slate-700">{h.igreja_origem}</span>
                            </div>
                          )}
                        </div>

                        {h.observacoes && (
                          <div className="text-[10px] text-slate-650 bg-white border border-slate-100 rounded-lg p-2 mt-2 leading-relaxed">
                            <span className="font-bold text-[#062E6F] block mb-0.5 text-[9px] uppercase tracking-wide">
                              Anotações da Recepção
                            </span>
                            "{h.observacoes}"
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedVisitante(null)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-xs shadow-md transition cursor-pointer"
              >
                Fechar Histórico
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Notificações */}
      <NotificationModal
        isOpen={modalNotify.isOpen}
        title={modalNotify.title}
        message={modalNotify.message}
        type={modalNotify.type}
        onClose={() => setModalNotify(prev => ({ ...prev, isOpen: false }))}
      />
    </PageLayout>
  );
}
