'use client';

import { useEffect, useState, useMemo } from 'react';
import PageLayout from '@/components/PageLayout';
import Section from '@/components/Section';
import NotificationModal from '@/components/NotificationModal';
import ExecutiveMetricCard from '@/components/dashboard/ExecutiveMetricCard';
import DashboardEmptyState from '@/components/dashboard/DashboardEmptyState';
import { useRequireModulo } from '@/hooks/useRequireModulo';
import { createClient } from '@/lib/supabase-client';
import { loadOrgNomenclaturasFromSupabaseOrMigrate, OrgNomenclaturasState, getDefaultOrgNomenclaturas } from '@/lib/org-nomenclaturas';
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
  UserPlus
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

export default function VisitantesPage() {
  const { ctx } = useRequireModulo('secretaria');
  const supabase = useMemo(() => createClient(), []);

  // Nomenclaturas
  const [nomenclaturas, setNomenclaturas] = useState<OrgNomenclaturasState>(getDefaultOrgNomenclaturas());
  const [congregacoes, setCongregacoes] = useState<CongregacaoOption[]>([]);

  // Visitantes e carregamento
  const [visitantesOriginais, setVisitantesOriginais] = useState<VisitanteOriginal[]>([]);
  const [loading, setLoading] = useState(true);

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

  // Controle de notificações
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
        const nom = await loadOrgNomenclaturasFromSupabaseOrMigrate(supabase);
        setNomenclaturas(nom);

        const { data: cgData } = await supabase
          .from('congregacoes')
          .select('id, nome')
          .eq('ministry_id', ctx.ministryId)
          .order('nome');
        if (cgData) {
          setCongregacoes(cgData as CongregacaoOption[]);
        }
      } catch (err) {
        console.error(err);
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

      // Regra de escopo: Usuário local só visualiza da congregação dele
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
      showNotification('error', 'Erro', 'Não foi possível carregar a lista de visitantes: ' + (err.message || 'Tente novamente.'));
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
      // Regra de agrupamento: por telefone (limpo) ou por nome (normalizado)
      const telLimpo = v.telefone ? v.telefone.replace(/\D/g, '') : '';
      const key = telLimpo || v.nome.trim().toLowerCase();

      if (!grupos[key]) {
        grupos[key] = [];
      }
      grupos[key].push(v);
    });

    return Object.entries(grupos).map(([key, list]): VisitanteConsolidado => {
      // Ordenar a lista da visita mais antiga para a mais recente
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
      })).reverse(); // Mais recentes primeiro na timeline do modal

      const total_visitas = sortedList.length;

      return {
        key,
        nome: ultimo.nome, // exibe nome do cadastro mais recente
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
      // 1. Congregação (Se não for usuário local e houver filtro selecionado)
      // Para o agrupado, verificamos se alguma das visitas do histórico pertence à congregação selecionada
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

      // 6. Período (com base na data de primeira ou última visita)
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

  // Métricas
  const totalGeral = filteredVisitantes.length;
  const primeiraVisitaCount = filteredVisitantes.filter(v => v.status === 'Primeira Visita').length;
  const retornandoCount = filteredVisitantes.filter(v => v.status === 'Retornando').length;

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

  const labelDivPrincipal = nomenclaturas.divisaoPrincipal.opcao1 || 'CONGREGAÇÃO';

  return (
    <PageLayout
      title="Visitantes"
      description="Consolidação e listagem do histórico de visitantes registrados nos cultos realizados"
    >
      {/* Indicadores */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <ExecutiveMetricCard
          title="Total Consolidados"
          value={totalGeral}
          icon={Users}
        />
        <ExecutiveMetricCard
          title="Primeira Visita"
          value={primeiraVisitaCount}
          icon={UserCheck}
          color="emerald"
        />
        <ExecutiveMetricCard
          title="Retornando"
          value={retornandoCount}
          icon={RefreshCw}
          color="blue"
        />
      </div>

      {/* Filtros e Busca */}
      <Section title="Filtros de Busca">
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* Nome / Telefone */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                Nome ou Telefone
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar por nome ou celular..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 border border-slate-300 rounded-xl px-3 py-2 text-sm bg-slate-50 focus:bg-white transition"
                />
              </div>
            </div>

            {/* Congregação (Visível apenas se não for local user) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                {labelDivPrincipal}
              </label>
              <select
                disabled={isLocalUser}
                value={isLocalUser ? (ctx?.congregacaoId || '') : selectedCongregacao}
                onChange={e => setSelectedCongregacao(e.target.value)}
                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm bg-slate-50 focus:bg-white transition disabled:opacity-75"
              >
                {isLocalUser ? (
                  <option value={ctx?.congregacaoId || ''}>
                    {congregacoes.find(c => c.id === ctx?.congregacaoId)?.nome || 'Minha Congregação'}
                  </option>
                ) : (
                  <>
                    <option value="TODAS">Todas as congregações</option>
                    {congregacoes.map(c => (
                      <option key={c.id} value={c.id}>{c.nome}</option>
                    ))}
                  </>
                )}
              </select>
            </div>

            {/* Primeira Visita */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                Primeira Visita?
              </label>
              <select
                value={filterPrimeiraVisita}
                onChange={e => setFilterPrimeiraVisita(e.target.value)}
                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm bg-slate-50 focus:bg-white transition"
              >
                <option value="TODOS">Todos</option>
                <option value="SIM">Sim</option>
                <option value="NAO">Não</option>
              </select>
            </div>

          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            
            {/* Obreiro / Ministro */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                É Ministro / Obreiro?
              </label>
              <select
                value={filterMinistro}
                onChange={e => setFilterMinistro(e.target.value)}
                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm bg-slate-50 focus:bg-white transition"
              >
                <option value="TODOS">Todos</option>
                <option value="SIM">Sim</option>
                <option value="NAO">Não</option>
              </select>
            </div>

            {/* Cargo Ministerial */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                Cargo Ministerial
              </label>
              <select
                value={filterCargo}
                onChange={e => setFilterCargo(e.target.value)}
                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm bg-slate-50 focus:bg-white transition"
              >
                <option value="TODOS">Todos os cargos</option>
                {cargoOptions.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Data Inicial */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                Período de
              </label>
              <input
                type="date"
                value={dateStart}
                onChange={e => setDateStart(e.target.value)}
                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm bg-slate-50 focus:bg-white transition"
              />
            </div>

            {/* Data Final */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                Até
              </label>
              <input
                type="date"
                value={dateEnd}
                onChange={e => setDateEnd(e.target.value)}
                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm bg-slate-50 focus:bg-white transition"
              />
            </div>

          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={cleanFilters}
              className="px-4 py-2 border border-slate-300 hover:border-slate-400 bg-white text-slate-775 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
              Limpar Filtros
            </button>
            <button
              onClick={loadVisitantes}
              disabled={loading}
              className="px-4 py-2 bg-[#062E6F] hover:bg-[#154A92] text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </button>
          </div>
        </div>
      </Section>

      {/* Grid de Cards de Visitantes */}
      <Section title="Painel de Acompanhamento Pastoral">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-8 w-8 text-slate-400 animate-spin" />
          </div>
        ) : filteredVisitantes.length === 0 ? (
          <DashboardEmptyState
            icon={Users}
            title="Nenhum visitante encontrado"
            description="Não encontramos registros de visitantes consolidados com base nos critérios aplicados."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredVisitantes.map(v => (
              <div
                key={v.key}
                className="bg-white border border-slate-200/60 rounded-2xl shadow-sm hover:shadow-md hover:border-slate-350 transition-all duration-300 flex flex-col justify-between overflow-hidden group"
              >
                {/* Topo do Card: Identificação */}
                <div className="p-6 space-y-4">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <h4 className="font-extrabold text-slate-800 text-base leading-snug group-hover:text-[#062E6F] transition-colors duration-200">
                        {v.nome}
                      </h4>
                      {v.telefone ? (
                        <div className="text-slate-500 font-semibold text-xs flex items-center gap-1.5 mt-1.5">
                          <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          {v.telefone}
                        </div>
                      ) : (
                        <div className="text-slate-400 italic text-xs mt-1.5">
                          Sem telefone cadastrado
                        </div>
                      )}
                    </div>

                    {/* Status Badge */}
                    <div className="shrink-0">
                      {v.status === 'Primeira Visita' ? (
                        <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full px-2.5 py-0.5 font-bold text-[9px] uppercase tracking-wide">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Primeira Visita
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-750 border border-blue-100 rounded-full px-2.5 py-0.5 font-bold text-[9px] uppercase tracking-wide">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                          Retornando
                        </span>
                      )}
                    </div>
                  </div>

                  <hr className="border-slate-100/80" />

                  {/* Informações de Perfil e Histórico */}
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 relative">
                      <div className="absolute left-1/2 top-1 bottom-1 w-[1px] bg-slate-100" />
                      
                      <div className="space-y-0.5">
                        <span className="text-slate-400 block text-[9px] uppercase tracking-wider font-extrabold">
                          Primeira Visita
                        </span>
                        <span className="text-slate-800 font-extrabold block text-sm">
                          {new Date(v.data_primeira_visita).toLocaleDateString('pt-BR')}
                        </span>
                        <span className="text-[10px] text-slate-500 font-semibold block truncate" title={v.congregacao_origem || ''}>
                          em {v.congregacao_origem}
                        </span>
                      </div>
                      
                      <div className="space-y-0.5 pl-2">
                        <span className="text-slate-400 block text-[9px] uppercase tracking-wider font-extrabold">
                          Última Visita
                        </span>
                        <span className="text-slate-800 font-extrabold block text-sm">
                          {new Date(v.data_ultima_visita).toLocaleDateString('pt-BR')}
                        </span>
                        <span className="text-[10px] text-slate-500 font-semibold block truncate">
                          Total: <strong className="text-slate-800 font-black">{v.total_visitas} culto(s)</strong>
                        </span>
                      </div>
                    </div>

                    {/* Bloco Obreiro/Ministro */}
                    {v.is_ministro && (
                      <div className="bg-blue-50/40 border border-blue-100/50 rounded-xl p-3 text-[11.5px] font-semibold text-slate-700 space-y-1">
                        <div className="text-blue-700 font-bold flex items-center gap-1.5">
                          <span className="text-xs">👑</span> Ministro / Obreiro
                        </div>
                        {v.cargo_ministerial && (
                          <div className="flex items-center gap-1">
                            <span className="text-slate-400 font-medium">Cargo:</span>
                            <span className="text-slate-800 font-bold">{v.cargo_ministerial}</span>
                          </div>
                        )}
                        {v.igreja_origem && (
                          <div className="flex items-center gap-1">
                            <span className="text-slate-400 font-medium">Origem:</span>
                            <span className="text-slate-800 font-semibold truncate block max-w-full" title={v.igreja_origem}>{v.igreja_origem}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Rodapé do Card: Origem Discreta e Ações */}
                <div className="bg-slate-50/80 border-t border-slate-100 p-5 space-y-3.5">
                  <div className="text-[10px] font-semibold text-slate-400 flex items-center justify-between">
                    <span className="uppercase tracking-wider">Último culto visto</span>
                    <span className="text-slate-700 font-extrabold max-w-[150px] truncate" title={v.ultimo_culto || ''}>
                      {v.ultimo_culto}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => setSelectedVisitante(v)}
                      className="px-2.5 py-2.5 bg-[#062E6F] hover:bg-[#154A92] text-white rounded-xl text-[10px] font-black shadow-sm transition-all duration-200 flex items-center justify-center gap-1 cursor-pointer hover:shadow active:scale-95"
                    >
                      <History className="h-3.5 w-3.5 shrink-0" />
                      Histórico
                    </button>
                    <button
                      disabled
                      title="Disponível em breve"
                      className="px-2.5 py-2.5 bg-slate-100 text-slate-400 border border-slate-200/80 rounded-xl text-[10px] font-bold cursor-not-allowed opacity-70 flex items-center justify-center gap-1"
                    >
                      <Sparkles className="h-3.5 w-3.5 shrink-0" />
                      Acompanhar
                    </button>
                    <button
                      disabled
                      title="Disponível em breve"
                      className="px-2.5 py-2.5 bg-slate-100 text-slate-400 border border-slate-200/80 rounded-xl text-[10px] font-bold cursor-not-allowed opacity-70 flex items-center justify-center gap-1"
                    >
                      <UserPlus className="h-3.5 w-3.5 shrink-0" />
                      Membro
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Modal: Histórico do Visitante */}
      {selectedVisitante && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl flex flex-col overflow-hidden border border-slate-100 max-h-[85vh] animate-fade-in">
            
            {/* Header */}
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
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Corpo / Timeline */}
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
                  <span className="text-slate-800 font-bold">{new Date(selectedVisitante.data_primeira_visita).toLocaleDateString('pt-BR')}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[9px] uppercase tracking-wider">Última Visita</span>
                  <span className="text-slate-800 font-bold">{new Date(selectedVisitante.data_ultima_visita).toLocaleDateString('pt-BR')}</span>
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
                            {new Date(h.data).toLocaleDateString('pt-BR')}
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
