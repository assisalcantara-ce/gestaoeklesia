'use client';

import { useState, useEffect, useMemo } from 'react';
import { 
  ClipboardCheck, Plus, Calendar, CheckCircle2, Clock, 
  AlertCircle, RefreshCw, X, ShieldAlert,
  Check, Edit3, Eye, Stethoscope
} from 'lucide-react';
import { 
  CelulaSupervisaoItem, CelulaItem, CelulaSupervisaoTipo, 
  CelulaSupervisaoStatus, CelulaDiagnosticoSaude, SalvarSupervisaoInput 
} from '@/types/celulas';
import { authenticatedFetch } from '@/lib/api-client';

interface TabSupervisaoProps {
  celulas: CelulaItem[];
  congregacoes: { id: string; nome: string }[];
  termoCelula: string;
}

const TIPO_MAP: Record<CelulaSupervisaoTipo, { label: string; cor: string }> = {
  visita: { label: 'Visita Pastoral', cor: 'bg-teal-50 text-teal-800 border-teal-200' },
  reuniao_lideranca: { label: 'Reunião de Liderança', cor: 'bg-blue-50 text-blue-800 border-blue-200' },
  solicitacao_apoio: { label: 'Solicitação de Apoio', cor: 'bg-amber-50 text-amber-800 border-amber-200' },
  alinhamento_pastoral: { label: 'Alinhamento Pastoral', cor: 'bg-purple-50 text-purple-800 border-purple-200' },
};

const DIAGNOSTICO_MAP: Record<CelulaDiagnosticoSaude, { label: string; cor: string; badge: string }> = {
  saudavel: { label: 'Saudável', cor: 'text-emerald-700', badge: 'bg-emerald-50 text-emerald-800 border-emerald-300' },
  atencao: { label: 'Em Atenção', cor: 'text-amber-700', badge: 'bg-amber-50 text-amber-800 border-amber-300' },
  critico: { label: 'Crítico / Crise', cor: 'text-rose-700', badge: 'bg-rose-50 text-rose-800 border-rose-300' },
  em_multiplicacao: { label: 'Em Multiplicação', cor: 'text-sky-700', badge: 'bg-sky-50 text-sky-800 border-sky-300' },
};

const STATUS_MAP: Record<CelulaSupervisaoStatus, { label: string; badge: string }> = {
  agendada: { label: 'Agendada', badge: 'bg-amber-50 text-amber-800 border-amber-200' },
  realizada: { label: 'Realizada', badge: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  cancelada: { label: 'Cancelada', badge: 'bg-slate-100 text-slate-600 border-slate-200' },
  nao_realizada: { label: 'Não Realizada', badge: 'bg-rose-50 text-rose-800 border-rose-200' },
};

export function TabSupervisao({ celulas, congregacoes, termoCelula }: TabSupervisaoProps) {
  const [supervisoes, setSupervisoes] = useState<CelulaSupervisaoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [notificacao, setNotificacao] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null);

  // Filtros
  const [filtroCelula, setFiltroCelula] = useState('todas');
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [filtroApenasApoio, setFiltroApenasApoio] = useState(false);
  const [filtroCongregacao, setFiltroCongregacao] = useState('todas');

  // Modais
  const [modalAberto, setModalAberto] = useState(false);
  const [supervisaoVisualizando, setSupervisaoVisualizando] = useState<CelulaSupervisaoItem | null>(null);
  const [supervisaoEditando, setSupervisaoEditando] = useState<CelulaSupervisaoItem | null>(null);

  // Busca de Supervisor (Membro)
  const [buscaSupervisor, setBuscaSupervisor] = useState('');
  const [supervisoresEncontrados, setSupervisoresEncontrados] = useState<{ id: string; name: string }[]>([]);
  const [buscandoSupervisores, setBuscandoSupervisores] = useState(false);
  const [supervisorSelecionado, setSupervisorSelecionado] = useState<{ id: string; name: string } | null>(null);

  // Form State
  const [form, setForm] = useState<SalvarSupervisaoInput>({
    celula_id: '',
    congregacao_id: null,
    supervisor_member_id: null,
    tipo: 'visita',
    status: 'agendada',
    data_agendada: new Date().toISOString().slice(0, 10),
    data_realizada: '',
    diagnostico_saude: 'saudavel',
    observacoes_pastorais: '',
    plano_acao: '',
    solicitou_apoio_pastoral: false,
    detalhe_apoio: '',
  });

  const carregarSupervisoes = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filtroCelula !== 'todas') params.append('celula_id', filtroCelula);
      if (filtroStatus !== 'todos') params.append('status', filtroStatus);
      if (filtroApenasApoio) params.append('apenas_apoio', 'true');
      if (filtroCongregacao !== 'todas') params.append('congregacao_id', filtroCongregacao);

      const res = await authenticatedFetch(`/api/v1/celulas/supervisoes?${params.toString()}`);
      if (!res.ok) throw new Error('Falha ao listar supervisões pastorais.');
      const json = await res.json();
      setSupervisoes(json.data || []);
    } catch (err: any) {
      setNotificacao({ tipo: 'erro', texto: err.message || 'Erro ao carregar supervisões.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarSupervisoes();
  }, [filtroCelula, filtroStatus, filtroApenasApoio, filtroCongregacao]);

  // Busca de membros supervisores
  useEffect(() => {
    if (!buscaSupervisor || buscaSupervisor.trim().length < 2) {
      setSupervisoresEncontrados([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        setBuscandoSupervisores(true);
        const res = await authenticatedFetch(`/api/v1/members?search=${encodeURIComponent(buscaSupervisor.trim())}&limit=6`);
        const json = await res.json();
        if (res.ok && json.data) {
          setSupervisoresEncontrados(json.data.map((m: any) => ({
            id: m.id,
            name: m.name || m.nome,
          })));
        }
      } catch {
        // Silencioso
      } finally {
        setBuscandoSupervisores(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [buscaSupervisor]);

  const abrirModalNovo = (celulaIdDefault?: string) => {
    setSupervisaoEditando(null);
    setSupervisorSelecionado(null);
    setBuscaSupervisor('');
    const celulaSel = celulaIdDefault ? celulas.find(c => c.id === celulaIdDefault) : celulas[0];
    setForm({
      celula_id: celulaSel?.id || '',
      congregacao_id: celulaSel?.congregacao_id || null,
      supervisor_member_id: null,
      tipo: 'visita',
      status: 'agendada',
      data_agendada: new Date().toISOString().slice(0, 10),
      data_realizada: '',
      diagnostico_saude: 'saudavel',
      observacoes_pastorais: '',
      plano_acao: '',
      solicitou_apoio_pastoral: false,
      detalhe_apoio: '',
    });
    setModalAberto(true);
  };

  const abrirModalEditar = (sup: CelulaSupervisaoItem) => {
    setSupervisaoEditando(sup);
    if (sup.supervisor) {
      setSupervisorSelecionado({ id: sup.supervisor.id, name: sup.supervisor.name });
    } else {
      setSupervisorSelecionado(null);
    }
    setBuscaSupervisor('');
    setForm({
      id: sup.id,
      celula_id: sup.celula_id,
      congregacao_id: sup.congregacao_id,
      supervisor_member_id: sup.supervisor_member_id,
      tipo: sup.tipo,
      status: sup.status,
      data_agendada: sup.data_agendada,
      data_realizada: sup.data_realizada ? sup.data_realizada.slice(0, 10) : '',
      diagnostico_saude: sup.diagnostico_saude || 'saudavel',
      observacoes_pastorais: sup.observacoes_pastorais || '',
      plano_acao: sup.plano_acao || '',
      solicitou_apoio_pastoral: sup.solicitou_apoio_pastoral || false,
      detalhe_apoio: sup.detalhe_apoio || '',
    });
    setModalAberto(true);
  };

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.celula_id) {
      setNotificacao({ tipo: 'erro', texto: `Selecione a ${termoCelula.toLowerCase()} supervisionada.` });
      return;
    }
    if (!form.data_agendada) {
      setNotificacao({ tipo: 'erro', texto: 'Informe a data da supervisão.' });
      return;
    }

    try {
      setSalvando(true);
      const payload: SalvarSupervisaoInput = {
        ...form,
        supervisor_member_id: supervisorSelecionado?.id || null,
        data_realizada: form.data_realizada ? `${form.data_realizada}T12:00:00Z` : null,
      };

      const res = await authenticatedFetch('/api/v1/celulas/supervisoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erro ao registrar supervisão.');

      setNotificacao({ tipo: 'sucesso', texto: 'Supervisão pastoral salva com sucesso!' });
      setModalAberto(false);
      carregarSupervisoes();
    } catch (err: any) {
      setNotificacao({ tipo: 'erro', texto: err.message || 'Falha ao salvar supervisão.' });
    } finally {
      setSalvando(false);
    }
  };

  // Métricas rápidas no topo
  const totalAgendadas = useMemo(() => supervisoes.filter(s => s.status === 'agendada').length, [supervisoes]);
  const totalRealizadas = useMemo(() => supervisoes.filter(s => s.status === 'realizada').length, [supervisoes]);
  const totalApoioAberto = useMemo(() => supervisoes.filter(s => s.solicitou_apoio_pastoral && s.status !== 'realizada').length, [supervisoes]);

  return (
    <div className="space-y-6">
      {/* Notificação Flutuante */}
      {notificacao && (
        <div className={`p-4 rounded-xl flex items-center justify-between text-xs sm:text-sm font-semibold border shadow-xs animate-in fade-in duration-200 ${
          notificacao.tipo === 'sucesso' 
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
            : 'bg-rose-50 text-rose-800 border-rose-200'
        }`}>
          <div className="flex items-center gap-2">
            {notificacao.tipo === 'sucesso' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            <span>{notificacao.texto}</span>
          </div>
          <button type="button" onClick={() => setNotificacao(null)} className="p-1 hover:opacity-70 cursor-pointer">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Cards de Métricas de Supervisão */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Supervisões Agendadas</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">{totalAgendadas}</h3>
          </div>
          <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-200/80">
            <Clock size={20} />
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Visitas Realizadas</p>
            <h3 className="text-2xl font-black text-emerald-700 mt-1">{totalRealizadas}</h3>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200/80">
            <CheckCircle2 size={20} />
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Apoio Pastoral Solicitado</p>
            <h3 className="text-2xl font-black text-rose-700 mt-1">{totalApoioAberto}</h3>
          </div>
          <div className="w-11 h-11 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center border border-rose-200/80">
            <ShieldAlert size={20} />
          </div>
        </div>
      </div>

      {/* Barra de Filtros e Agendamento */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 sm:p-5">
        <div className="flex flex-col md:flex-row gap-3.5 items-center justify-between">
          <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Filtro Célula */}
            <div>
              <select
                value={filtroCelula}
                onChange={(e) => setFiltroCelula(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 bg-white cursor-pointer"
              >
                <option value="todas">Todas as {termoCelula}s</option>
                {celulas.map(c => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </div>

            {/* Filtro Status */}
            <div>
              <select
                value={filtroStatus}
                onChange={(e) => setFiltroStatus(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 bg-white cursor-pointer"
              >
                <option value="todos">Todos os Status</option>
                <option value="agendada">Agendadas</option>
                <option value="realizada">Realizadas</option>
                <option value="cancelada">Canceladas</option>
                <option value="nao_realizada">Não Realizadas</option>
              </select>
            </div>

            {/* Filtro Congregação */}
            <div>
              <select
                value={filtroCongregacao}
                onChange={(e) => setFiltroCongregacao(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 bg-white cursor-pointer"
              >
                <option value="todas">Todas as Congregações</option>
                {congregacoes.map(c => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </div>

            {/* Toggle Apoio */}
            <div className="flex items-center">
              <label className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={filtroApenasApoio}
                  onChange={(e) => setFiltroApenasApoio(e.target.checked)}
                  className="rounded text-teal-700 focus:ring-teal-600 w-4 h-4 cursor-pointer"
                />
                <span className="flex items-center gap-1.5 text-rose-700">
                  <ShieldAlert size={14} />
                  Apenas com Apoio Solicitado
                </span>
              </label>
            </div>
          </div>

          {/* Botão Registrar Supervisão */}
          <div className="w-full md:w-auto flex items-center justify-end">
            <button
              type="button"
              onClick={() => abrirModalNovo()}
              className="w-full md:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs sm:text-sm font-bold shadow-sm transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Registrar Visita / Supervisão</span>
            </button>
          </div>
        </div>
      </div>

      {/* Lista de Supervisões Pastoral */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200/90 p-12 text-center text-slate-500">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-teal-700 mb-2" />
          <p className="text-sm font-medium">Carregando supervisões pastorais...</p>
        </div>
      ) : supervisoes.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/90 p-12 text-center text-slate-500">
          <ClipboardCheck className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-base font-bold text-slate-700 mb-1">Nenhum registro de supervisão encontrado</p>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
            Acompanhe a saúde das {termoCelula.toLowerCase()}s, agende visitas pastorais e atenda a solicitações de apoio da liderança.
          </p>
          <button
            type="button"
            onClick={() => abrirModalNovo()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-teal-50 hover:bg-teal-100 text-teal-800 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            <Plus size={15} />
            Agendar Primeira Supervisão
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  <th className="px-5 py-3.5">{termoCelula} & Unidade</th>
                  <th className="px-5 py-3.5">Supervisor Pastoral</th>
                  <th className="px-5 py-3.5">Tipo & Data</th>
                  <th className="px-5 py-3.5">Diagnóstico de Saúde</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
                {supervisoes.map((sup) => {
                  const tipoConf = TIPO_MAP[sup.tipo] || TIPO_MAP.visita;
                  const diagConf = DIAGNOSTICO_MAP[sup.diagnostico_saude] || DIAGNOSTICO_MAP.saudavel;
                  const stConf = STATUS_MAP[sup.status] || STATUS_MAP.agendada;

                  return (
                    <tr key={sup.id} className="hover:bg-slate-50/70 transition">
                      <td className="px-5 py-4">
                        <div className="font-bold text-slate-900">
                          {sup.celula?.nome || 'Célula'}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {sup.congregacao?.nome || 'Sede'}
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="font-semibold text-slate-800">
                          {sup.supervisor?.name || 'Não designado'}
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold border ${tipoConf.cor}`}>
                          {tipoConf.label}
                        </span>
                        <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                          <Calendar size={11} />
                          <span>{new Date(`${sup.data_agendada}T12:00:00`).toLocaleDateString('pt-BR')}</span>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex flex-col gap-1 items-start">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${diagConf.badge}`}>
                            <Stethoscope size={11} />
                            {diagConf.label}
                          </span>
                          {sup.solicitou_apoio_pastoral && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-black text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                              <ShieldAlert size={11} />
                              Apoio Solicitado
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${stConf.badge}`}>
                          {stConf.label}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setSupervisaoVisualizando(sup)}
                            title="Ver detalhes da supervisão"
                            className="p-1.5 hover:bg-slate-200 text-slate-700 rounded-lg transition cursor-pointer"
                          >
                            <Eye size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => abrirModalEditar(sup)}
                            title="Editar supervisão"
                            className="p-1.5 hover:bg-teal-100 text-teal-700 rounded-lg transition cursor-pointer"
                          >
                            <Edit3 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Detalhes da Supervisão Pastoral (Confidencialidade Preservada) */}
      {supervisaoVisualizando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200/90 w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-5 border-b border-slate-200 bg-slate-50/70">
              <div>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${STATUS_MAP[supervisaoVisualizando.status]?.badge}`}>
                  {STATUS_MAP[supervisaoVisualizando.status]?.label}
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-1">
                  Supervisão: {supervisaoVisualizando.celula?.nome}
                </h3>
                <p className="text-xs text-slate-500">
                  Data Agendada: {new Date(`${supervisaoVisualizando.data_agendada}T12:00:00`).toLocaleDateString('pt-BR')} | Supervisor: {supervisaoVisualizando.supervisor?.name || 'Não designado'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSupervisaoVisualizando(null)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs sm:text-sm text-slate-700">
              {/* Diagnóstico */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Diagnóstico de Saúde da Célula</span>
                  <div className="text-sm font-bold text-slate-900 mt-0.5 flex items-center gap-1.5">
                    <Stethoscope size={14} className="text-teal-700" />
                    <span>{DIAGNOSTICO_MAP[supervisaoVisualizando.diagnostico_saude]?.label}</span>
                  </div>
                </div>

                {supervisaoVisualizando.solicitou_apoio_pastoral && (
                  <div className="bg-rose-50 px-3 py-1.5 rounded-lg border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-1.5">
                    <ShieldAlert size={14} />
                    <span>Apoio Solicitado</span>
                  </div>
                )}
              </div>

              {/* Detalhe do Apoio Pastoral */}
              {supervisaoVisualizando.solicitou_apoio_pastoral && supervisaoVisualizando.detalhe_apoio && (
                <div className="bg-rose-50/70 p-4 rounded-xl border border-rose-200">
                  <h4 className="text-[11px] font-bold text-rose-900 uppercase tracking-wider mb-1">
                    Motivo da Solicitação de Apoio Pastoral
                  </h4>
                  <p className="text-rose-950 font-medium whitespace-pre-line">{supervisaoVisualizando.detalhe_apoio}</p>
                </div>
              )}

              {/* Observações Pastorais */}
              <div>
                <h4 className="text-[11px] font-bold text-slate-900 uppercase tracking-wider mb-1">
                  Observações Pastorais (Confidencial)
                </h4>
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 whitespace-pre-line text-slate-800 font-normal">
                  {supervisaoVisualizando.observacoes_pastorais || 'Nenhuma observação registrada.'}
                </div>
              </div>

              {/* Plano de Ação */}
              {supervisaoVisualizando.plano_acao && (
                <div>
                  <h4 className="text-[11px] font-bold text-slate-900 uppercase tracking-wider mb-1">
                    Plano de Ação / Próximos Passos
                  </h4>
                  <div className="bg-teal-50/50 p-3.5 rounded-xl border border-teal-200/80 whitespace-pre-line text-teal-950 font-medium">
                    {supervisaoVisualizando.plano_acao}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setSupervisaoVisualizando(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Cadastro / Edição de Supervisão */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200/90 w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-5 border-b border-slate-200 bg-slate-50/70">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700">
                  <ClipboardCheck size={16} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {supervisaoEditando ? 'Editar Supervisão Pastoral' : 'Agendar / Registrar Supervisão Pastoral'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Acompanhamento contínuo da saúde ministerial da célula.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalAberto(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSalvar} className="p-6 overflow-y-auto space-y-4">
              {/* Seleção de Célula & Supervisor */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    {termoCelula} Supervisionada *
                  </label>
                  <select
                    required
                    value={form.celula_id}
                    onChange={(e) => {
                      const sel = celulas.find(c => c.id === e.target.value);
                      setForm({
                        ...form,
                        celula_id: e.target.value,
                        congregacao_id: sel?.congregacao_id || null,
                      });
                    }}
                    className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl bg-white cursor-pointer"
                  >
                    <option value="">Selecione a {termoCelula}...</option>
                    {celulas.map(c => (
                      <option key={c.id} value={c.id}>{c.nome}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Supervisor Pastoral (Membro)
                  </label>
                  {supervisorSelecionado ? (
                    <div className="flex items-center justify-between px-3.5 py-2 border border-teal-300 bg-teal-50/60 rounded-xl">
                      <span className="text-xs font-bold text-teal-900 truncate">
                        {supervisorSelecionado.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => setSupervisorSelecionado(null)}
                        className="p-1 hover:bg-teal-200/70 text-teal-800 rounded-md cursor-pointer"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className="relative">
                      <input
                        type="text"
                        value={buscaSupervisor}
                        onChange={(e) => setBuscaSupervisor(e.target.value)}
                        placeholder="Buscar por nome do supervisor..."
                        className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl"
                      />
                      {buscandoSupervisores && (
                        <RefreshCw size={13} className="animate-spin text-slate-400 absolute right-3 top-3" />
                      )}
                      {supervisoresEncontrados.length > 0 && (
                        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-20 max-h-40 overflow-y-auto divide-y divide-slate-100">
                          {supervisoresEncontrados.map(m => (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => {
                                setSupervisorSelecionado(m);
                                setSupervisoresEncontrados([]);
                                setBuscaSupervisor('');
                              }}
                              className="w-full text-left px-3.5 py-2 text-xs hover:bg-teal-50 hover:text-teal-900 font-semibold cursor-pointer"
                            >
                              {m.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Tipo, Status e Data Agendada */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Tipo de Supervisão *
                  </label>
                  <select
                    value={form.tipo}
                    onChange={(e) => setForm({ ...form, tipo: e.target.value as CelulaSupervisaoTipo })}
                    className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl bg-white cursor-pointer"
                  >
                    <option value="visita">Visita Pastoral</option>
                    <option value="reuniao_lideranca">Reunião de Liderança</option>
                    <option value="solicitacao_apoio">Solicitação de Apoio</option>
                    <option value="alinhamento_pastoral">Alinhamento Pastoral</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Status da Supervisão *
                  </label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value as CelulaSupervisaoStatus })}
                    className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl bg-white cursor-pointer"
                  >
                    <option value="agendada">Agendada</option>
                    <option value="realizada">Realizada</option>
                    <option value="cancelada">Cancelada</option>
                    <option value="nao_realizada">Não Realizada</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Data Agendada *
                  </label>
                  <input
                    type="date"
                    required
                    value={form.data_agendada}
                    onChange={(e) => setForm({ ...form, data_agendada: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              {/* Diagnóstico de Saúde da Célula */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Diagnóstico de Saúde da {termoCelula} *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {(['saudavel', 'atencao', 'critico', 'em_multiplicacao'] as CelulaDiagnosticoSaude[]).map(d => {
                    const isSel = form.diagnostico_saude === d;
                    const dConf = DIAGNOSTICO_MAP[d];
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setForm({ ...form, diagnostico_saude: d })}
                        className={`p-2.5 rounded-xl border text-center transition cursor-pointer flex flex-col items-center gap-1 ${
                          isSel 
                            ? `${dConf.badge} shadow-xs font-bold ring-2 ring-teal-600/20` 
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <Stethoscope size={14} className={isSel ? dConf.cor : 'text-slate-400'} />
                        <span className="text-xs font-semibold">{dConf.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Solicitação de Apoio Pastoral */}
              <div className="bg-rose-50/50 p-4 rounded-xl border border-rose-200/80 space-y-2.5">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={form.solicitou_apoio_pastoral}
                    onChange={(e) => setForm({ ...form, solicitou_apoio_pastoral: e.target.checked })}
                    className="rounded text-rose-600 focus:ring-rose-500 w-4 h-4 cursor-pointer"
                  />
                  <span className="text-xs font-bold text-rose-900 flex items-center gap-1.5">
                    <ShieldAlert size={15} />
                    Esta célula precisa de intervenção ou apoio pastoral específico
                  </span>
                </label>

                {form.solicitou_apoio_pastoral && (
                  <div>
                    <label className="block text-[10px] font-bold text-rose-800 uppercase tracking-wider mb-1">
                      Descreva a Necessidade / Motivo do Apoio *
                    </label>
                    <textarea
                      rows={2}
                      value={form.detalhe_apoio || ''}
                      onChange={(e) => setForm({ ...form, detalhe_apoio: e.target.value })}
                      placeholder="Ex: Conflito interno na liderança, necessidade de visita aos anfitriões..."
                      className="w-full px-3 py-2 text-xs sm:text-sm border border-rose-300 rounded-lg bg-white"
                    />
                  </div>
                )}
              </div>

              {/* Observações Pastorais Confidenciais */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Observações Pastorais (Confidencial)
                </label>
                <textarea
                  rows={3}
                  value={form.observacoes_pastorais || ''}
                  onChange={(e) => setForm({ ...form, observacoes_pastorais: e.target.value })}
                  placeholder="Relato da conversa, impressões espirituais e pontos de atenção..."
                  className="w-full px-3.5 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl"
                />
              </div>

              {/* Plano de Ação */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Plano de Ação / Recomendações
                </label>
                <textarea
                  rows={2}
                  value={form.plano_acao || ''}
                  onChange={(e) => setForm({ ...form, plano_acao: e.target.value })}
                  placeholder="Tarefas combinadas com a liderança até a próxima visita..."
                  className="w-full px-3.5 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl"
                />
              </div>

              {/* Rodapé Form */}
              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setModalAberto(false)}
                  className="px-4 py-2.5 text-xs sm:text-sm font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvando}
                  className="px-5 py-2.5 text-xs sm:text-sm font-bold bg-teal-700 hover:bg-teal-800 text-white rounded-xl shadow-xs transition flex items-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  {salvando ? (
                    <>
                      <RefreshCw size={15} className="animate-spin" />
                      <span>Salvando...</span>
                    </>
                  ) : (
                    <>
                      <Check size={16} />
                      <span>{supervisaoEditando ? 'Atualizar Supervisão' : 'Registrar Supervisão'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
