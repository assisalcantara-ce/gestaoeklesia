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
  MapPin,
  Map,
  Church,
  CalendarDays,
  UserCheck
} from 'lucide-react';

interface Visitante {
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
  const [visitantes, setVisitantes] = useState<Visitante[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCongregacao, setSelectedCongregacao] = useState('TODAS');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [filterPrimeiraVisita, setFilterPrimeiraVisita] = useState('TODOS');
  const [filterMinistro, setFilterMinistro] = useState('TODOS');
  const [filterCargo, setFilterCargo] = useState('TODOS');

  // Controle de paginação simples
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

  // Buscar visitantes consolidados
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
        setVisitantes(data as unknown as Visitante[]);
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

  // Filtragem local
  const filteredVisitantes = useMemo(() => {
    return visitantes.filter(v => {
      // 1. Congregação (Se não for usuário local)
      if (!isLocalUser && selectedCongregacao !== 'TODAS' && v.congregacao_id !== selectedCongregacao) {
        return false;
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

      // 6. Período (com base na data do culto de origem ou criacão)
      const dataVisitaRaw = v.culto_registros?.data_culto || v.created_at;
      if (dataVisitaRaw) {
        const dataVisita = new Date(dataVisitaRaw.substring(0, 10));
        if (dateStart) {
          const start = new Date(dateStart);
          if (dataVisita < start) return false;
        }
        if (dateEnd) {
          const end = new Date(dateEnd);
          if (dataVisita > end) return false;
        }
      }

      return true;
    });
  }, [visitantes, searchQuery, selectedCongregacao, dateStart, dateEnd, filterPrimeiraVisita, filterMinistro, filterCargo, isLocalUser]);

  // Métricas
  const totalGeral = filteredVisitantes.length;
  const primeiraVisitaCount = filteredVisitantes.filter(v => v.primeira_visita).length;
  const ministrosCount = filteredVisitantes.filter(v => v.is_ministro).length;

  const cargoOptions = useMemo(() => {
    const cargos = new Set<string>();
    visitantes.forEach(v => {
      if (v.cargo_ministerial) cargos.add(v.cargo_ministerial);
    });
    return Array.from(cargos).sort();
  }, [visitantes]);

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
      description="Consolidação e listagem de visitantes registrados nos cultos realizados"
    >
      {/* Indicadores */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <ExecutiveMetricCard
          title="Total de Visitantes"
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
          title="Ministros / Obreiros"
          value={ministrosCount}
          icon={Church}
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
                  placeholder="Buscar..."
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
              className="px-4 py-2 border border-slate-300 hover:border-slate-400 bg-white text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
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

      {/* Lista de Visitantes */}
      <Section title="Listagem Consolidada">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-8 w-8 text-slate-400 animate-spin" />
          </div>
        ) : filteredVisitantes.length === 0 ? (
          <DashboardEmptyState
            icon={Users}
            title="Nenhum visitante encontrado"
            description="Não encontramos registros de visitantes com base nos critérios aplicados."
          />
        ) : (
          <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-slate-650 uppercase font-bold tracking-wider">
                    <th className="px-5 py-3">Visitante</th>
                    <th className="px-5 py-3">Contato</th>
                    <th className="px-5 py-3">{labelDivPrincipal}</th>
                    <th className="px-5 py-3">Culto / Data</th>
                    <th className="px-5 py-3">Localidade</th>
                    <th className="px-5 py-3">Perfil</th>
                    <th className="px-5 py-3">Igreja de Origem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredVisitantes.map(v => (
                    <tr key={v.id} className="hover:bg-slate-50/50 transition">
                      
                      {/* Visitante */}
                      <td className="px-5 py-4">
                        <div className="font-bold text-slate-800 text-sm">{v.nome}</div>
                        {v.observacoes && (
                          <div className="text-[10px] text-slate-400 max-w-[200px] truncate mt-0.5" title={v.observacoes}>
                            Obs: {v.observacoes}
                          </div>
                        )}
                      </td>

                      {/* Contato */}
                      <td className="px-5 py-4 text-slate-600 whitespace-nowrap">
                        {v.telefone ? (
                          <div className="flex items-center gap-1.5">
                            <Phone className="h-3 w-3 text-slate-400" />
                            {v.telefone}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Sem telefone</span>
                        )}
                      </td>

                      {/* Congregação */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="font-semibold text-slate-700">
                          {v.congregacoes?.nome || 'Geral'}
                        </div>
                      </td>

                      {/* Culto / Data */}
                      <td className="px-5 py-4">
                        {v.culto_registros ? (
                          <>
                            <div className="font-semibold text-slate-700 flex items-center gap-1">
                              <Church className="h-3 w-3 text-slate-400 shrink-0" />
                              {v.culto_registros.tipo_culto}
                            </div>
                            <div className="text-slate-500 text-[10px] flex items-center gap-1 mt-0.5">
                              <CalendarDays className="h-3 w-3 text-slate-400 shrink-0" />
                              {new Date(v.culto_registros.data_culto).toLocaleDateString('pt-BR')}
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="text-slate-400 italic">Sem culto vinculado</div>
                            <div className="text-slate-500 text-[10px] mt-0.5">
                              Cadastrado em {new Date(v.created_at).toLocaleDateString('pt-BR')}
                            </div>
                          </>
                        )}
                      </td>

                      {/* Localidade */}
                      <td className="px-5 py-4 text-slate-600">
                        {v.cidade || v.bairro ? (
                          <>
                            <div className="font-semibold text-slate-700 flex items-center gap-1">
                              <MapPin className="h-3 w-3 text-slate-400 shrink-0" />
                              {v.bairro || '—'}
                            </div>
                            <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                              <Map className="h-3 w-3 text-slate-400 shrink-0" />
                              {v.cidade || '—'}
                            </div>
                          </>
                        ) : (
                          <span className="text-slate-400 italic">Não informado</span>
                        )}
                      </td>

                      {/* Perfil */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="flex flex-col gap-1">
                          
                          {/* Badge Primeira Visita */}
                          {v.primeira_visita ? (
                            <span className="inline-flex self-start bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full px-2 py-0.5 font-bold text-[9px]">
                              Primeira Visita
                            </span>
                          ) : (
                            <span className="inline-flex self-start bg-slate-100 text-slate-600 rounded-full px-2 py-0.5 font-bold text-[9px]">
                              Frequente
                            </span>
                          )}

                          {/* Badge Ministro/Cargo */}
                          {v.is_ministro && (
                            <span className="inline-flex self-start bg-blue-50 text-blue-700 border border-blue-100 rounded-full px-2 py-0.5 font-bold text-[9px] mt-0.5">
                              {v.cargo_ministerial || 'Obreiro'}
                            </span>
                          )}

                        </div>
                      </td>

                      {/* Igreja de Origem */}
                      <td className="px-5 py-4 text-slate-700">
                        {v.igreja_origem || <span className="text-slate-400 italic">Nenhuma</span>}
                      </td>

                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Section>

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
