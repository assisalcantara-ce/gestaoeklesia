'use client';

import { useEffect, useState, useMemo } from 'react';
import { 
  Plus, Search, Home, Calendar, MapPin, 
  Settings, Network, ChevronRight, CheckCircle2, AlertCircle, RefreshCw, X 
} from 'lucide-react';
import { CelulaItem, CelulaRede, CelulaConfiguracao, SalvarCelulaInput } from '@/types/celulas';
import { authenticatedFetch } from '@/lib/api-client';

const DIAS_SEMANA = [
  'Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira',
  'Quinta-feira', 'Sexta-feira', 'Sábado'
];

export default function CelulasPage() {
  const [abaAtiva, setAbaAtiva] = useState<'celulas' | 'redes' | 'configuracoes'>('celulas');
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null);

  // Dados
  const [celulas, setCelulas] = useState<CelulaItem[]>([]);
  const [redes, setRedes] = useState<CelulaRede[]>([]);
  const [config, setConfig] = useState<CelulaConfiguracao | null>(null);
  const [congregacoes, setCongregacoes] = useState<{ id: string; nome: string }[]>([]);

  // Filtros
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [filtroRede, setFiltroRede] = useState('todas');
  const [filtroCongregacao, setFiltroCongregacao] = useState('todas');

  // Modal Célula
  const [modalCelulaAberto, setModalCelulaAberto] = useState(false);
  const [editandoCelulaId, setEditandoCelulaId] = useState<string | null>(null);
  const [formCelula, setFormCelula] = useState<SalvarCelulaInput>({
    nome: '',
    codigo: '',
    dia_semana: 3,
    horario: '20:00',
    modalidade: 'presencial',
    status: 'ativa',
    congregacao_id: '',
    rede_id: '',
    bairro: '',
    cidade: '',
    logradouro: '',
    numero: '',
    descricao: '',
  });

  // Modal Rede
  const [modalRedeAberto, setModalRedeAberto] = useState(false);
  const [formRede, setFormRede] = useState({ nome: '', descricao: '', cor: '#123b63' });

  // Carregar Dados
  const carregarDados = async () => {
    try {
      setLoading(true);
      const [resCel, resRedes, resCfg, resCong] = await Promise.all([
        authenticatedFetch('/api/v1/celulas'),
        authenticatedFetch('/api/v1/celulas/redes'),
        authenticatedFetch('/api/v1/celulas/configuracoes'),
        authenticatedFetch('/api/v1/congregacoes'),
      ]);

      if (resCel.ok) {
        const jsonCel = await resCel.json();
        setCelulas(jsonCel.data || []);
      }
      if (resRedes.ok) {
        const jsonRedes = await resRedes.json();
        setRedes(jsonRedes.data || []);
      }
      if (resCfg.ok) {
        const jsonCfg = await resCfg.json();
        setConfig(jsonCfg.data || null);
      }
      if (resCong.ok) {
        const jsonCong = await resCong.json();
        setCongregacoes(jsonCong.data || []);
      }
    } catch (err: any) {
      setMensagem({ tipo: 'erro', texto: 'Falha ao carregar dados do módulo Células.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, []);

  // Filtragem
  const celulasFiltradas = useMemo(() => {
    return celulas.filter((c) => {
      const matchBusca = !busca || 
        c.nome.toLowerCase().includes(busca.toLowerCase()) || 
        (c.codigo && c.codigo.toLowerCase().includes(busca.toLowerCase())) ||
        (c.bairro && c.bairro.toLowerCase().includes(busca.toLowerCase()));

      const matchStatus = filtroStatus === 'todos' || c.status === filtroStatus;
      const matchRede = filtroRede === 'todas' || c.rede_id === filtroRede;
      const matchCong = filtroCongregacao === 'todas' || c.congregacao_id === filtroCongregacao;

      return matchBusca && matchStatus && matchRede && matchCong;
    });
  }, [celulas, busca, filtroStatus, filtroRede, filtroCongregacao]);

  // Ações de Salvar
  const handleSalvarCelula = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCelula.nome.trim()) {
      setMensagem({ tipo: 'erro', texto: 'Informe o nome da célula.' });
      return;
    }

    try {
      setSalvando(true);
      setMensagem(null);
      const url = editandoCelulaId ? `/api/v1/celulas/${editandoCelulaId}` : '/api/v1/celulas';
      const method = editandoCelulaId ? 'PUT' : 'POST';

      const res = await authenticatedFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formCelula,
          congregacao_id: formCelula.congregacao_id || null,
          rede_id: formCelula.rede_id || null,
        }),
      });

      const resJson = await res.json();
      if (!res.ok) {
        throw new Error(resJson.error || 'Erro ao salvar célula.');
      }

      setMensagem({ 
        tipo: 'sucesso', 
        texto: editandoCelulaId ? 'Célula atualizada com sucesso!' : 'Célula cadastrada com sucesso!' 
      });
      setModalCelulaAberto(false);
      setEditandoCelulaId(null);
      carregarDados();
    } catch (err: any) {
      setMensagem({ tipo: 'erro', texto: err.message });
    } finally {
      setSalvando(false);
    }
  };

  const handleSalvarRede = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formRede.nome.trim()) {
      setMensagem({ tipo: 'erro', texto: 'Informe o nome da rede.' });
      return;
    }

    try {
      setSalvando(true);
      setMensagem(null);
      const res = await authenticatedFetch('/api/v1/celulas/redes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formRede),
      });

      const resJson = await res.json();
      if (!res.ok) throw new Error(resJson.error || 'Erro ao criar rede.');

      setMensagem({ tipo: 'sucesso', texto: 'Rede ministerial criada com sucesso!' });
      setModalRedeAberto(false);
      setFormRede({ nome: '', descricao: '', cor: '#123b63' });
      carregarDados();
    } catch (err: any) {
      setMensagem({ tipo: 'erro', texto: err.message });
    } finally {
      setSalvando(false);
    }
  };

  const abrirEdicaoCelula = (c: CelulaItem) => {
    setEditandoCelulaId(c.id);
    setFormCelula({
      nome: c.nome,
      codigo: c.codigo || '',
      dia_semana: c.dia_semana,
      horario: c.horario ? c.horario.slice(0, 5) : '20:00',
      modalidade: c.modalidade,
      status: c.status,
      congregacao_id: c.congregacao_id || '',
      rede_id: c.rede_id || '',
      bairro: c.bairro || '',
      cidade: c.cidade || '',
      logradouro: c.logradouro || '',
      numero: c.numero || '',
      descricao: c.descricao || '',
    });
    setModalCelulaAberto(true);
  };

  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden bg-[#f4f7fa] min-h-screen">
      <div className="p-4 sm:p-6 lg:p-8 max-w-[96rem] mx-auto w-full space-y-6">
        {/* Cabeçalho da Página */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-teal-700 text-white flex items-center justify-center border border-teal-800 shadow-sm flex-shrink-0">
              <Network className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                Gestão de {config?.termo_celula || 'Células'}
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 font-medium mt-0.5">
                Organização, acompanhamento pastoral e cadastro de pequenos grupos e redes ministeriais.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {abaAtiva === 'celulas' && (
              <button
                type="button"
                onClick={() => {
                  setEditandoCelulaId(null);
                  setFormCelula({
                    nome: '',
                    codigo: '',
                    dia_semana: config?.dia_padrao_reuniao ?? 3,
                    horario: config?.horario_padrao_reuniao ? config.horario_padrao_reuniao.slice(0, 5) : '20:00',
                    modalidade: 'presencial',
                    status: 'ativa',
                    congregacao_id: '',
                    rede_id: '',
                    bairro: '',
                    cidade: '',
                    logradouro: '',
                    numero: '',
                    descricao: '',
                  });
                  setModalCelulaAberto(true);
                }}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-700 rounded-xl transition text-xs sm:text-sm font-bold flex items-center gap-2 shadow-sm cursor-pointer"
              >
                <Plus size={16} className="text-white" />
                <span>+ Nova {config?.termo_celula || 'Célula'}</span>
              </button>
            )}

            {abaAtiva === 'redes' && (
              <button
                type="button"
                onClick={() => setModalRedeAberto(true)}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-700 rounded-xl transition text-xs sm:text-sm font-bold flex items-center gap-2 shadow-sm cursor-pointer"
              >
                <Plus size={16} className="text-white" />
                <span>+ Nova Rede</span>
              </button>
            )}
          </div>
        </div>

        {/* Feedback de Mensagem */}
        {mensagem && (
          <div
            className={`flex items-center justify-between p-4 rounded-xl text-xs sm:text-sm font-medium border shadow-2xs ${
              mensagem.tipo === 'sucesso'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {mensagem.tipo === 'sucesso' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-rose-600" />}
              <span>{mensagem.texto}</span>
            </div>
            <button onClick={() => setMensagem(null)} className="text-xs font-bold underline hover:opacity-80 cursor-pointer">
              Fechar
            </button>
          </div>
        )}

        {/* Navegação entre Abas Centralizadas (Padrão Discipulado) */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-1.5 shadow-2xs flex flex-wrap gap-1">
          <button
            type="button"
            onClick={() => setAbaAtiva('celulas')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
              abaAtiva === 'celulas'
                ? 'bg-teal-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
            }`}
          >
            <Home className="w-4 h-4" />
            <span>{config?.termo_celula ? `${config.termo_celula}s` : 'Células'} ({celulas.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setAbaAtiva('redes')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
              abaAtiva === 'redes'
                ? 'bg-teal-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
            }`}
          >
            <Network className="w-4 h-4" />
            <span>Redes Ministeriais ({redes.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setAbaAtiva('configuracoes')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
              abaAtiva === 'configuracoes'
                ? 'bg-teal-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Configurações & Metodologia</span>
          </button>
        </div>

        {/* Conteúdo Aba Células */}
        {abaAtiva === 'celulas' && (
          <div className="space-y-6">
            {/* Barra de Filtros (Padrão Membros / Discipulado) */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 sm:p-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3.5 items-end">
                {/* Buscar por texto */}
                <div className="sm:col-span-2 lg:col-span-5">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Buscar {config?.termo_celula || 'Célula'}
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Search className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      value={busca}
                      onChange={(e) => setBusca(e.target.value)}
                      placeholder="Buscar por nome, código ou bairro..."
                      className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50/70 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition shadow-2xs"
                    />
                  </div>
                </div>

                {/* Filtro Status */}
                <div className="lg:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Status
                  </label>
                  <select
                    value={filtroStatus}
                    onChange={(e) => setFiltroStatus(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50/70 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition shadow-2xs cursor-pointer"
                  >
                    <option value="todos">Todos os Status</option>
                    <option value="ativa">Ativa</option>
                    <option value="em_formacao">Em Formação</option>
                    <option value="suspensa">Suspensa</option>
                    <option value="encerrada">Encerrada</option>
                  </select>
                </div>

                {/* Filtro Rede */}
                <div className="lg:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Rede
                  </label>
                  <select
                    value={filtroRede}
                    onChange={(e) => setFiltroRede(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50/70 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition shadow-2xs cursor-pointer"
                  >
                    <option value="todas">Todas as Redes</option>
                    {redes.map((r) => (
                      <option key={r.id} value={r.id}>{r.nome}</option>
                    ))}
                  </select>
                </div>

                {/* Filtro Congregação */}
                <div className="lg:col-span-3">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Congregação
                  </label>
                  <select
                    value={filtroCongregacao}
                    onChange={(e) => setFiltroCongregacao(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50/70 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition shadow-2xs cursor-pointer"
                  >
                    <option value="todas">Todas as Congregações</option>
                    {congregacoes.map((c) => (
                      <option key={c.id} value={c.id}>{c.nome}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Container da Listagem com cabeçalho interno padronizado */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 border-b border-slate-200/80 bg-white">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-700 border border-teal-200 flex items-center justify-center font-bold">
                    <Home className="w-5 h-5 text-teal-700" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">
                      Painel de {config?.termo_celula ? `${config.termo_celula}s` : 'Células'}
                    </h2>
                    <p className="text-xs text-slate-500">
                      Acompanhamento contínuo dos pequenos grupos e reuniões semanais
                    </p>
                  </div>
                  <span className="ml-2 px-3 py-1 bg-teal-50 text-teal-800 border border-teal-200/90 rounded-full text-xs font-bold">
                    {celulasFiltradas.length} {celulasFiltradas.length === 1 ? (config?.termo_celula?.toLowerCase() || 'célula') : (`${config?.termo_celula?.toLowerCase() || 'célula'}s`)}
                    {celulasFiltradas.length !== celulas.length && (
                      <span className="ml-1 text-[11px] text-teal-700 font-medium">de {celulas.length}</span>
                    )}
                  </span>
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={carregarDados}
                    disabled={loading}
                    className="px-3.5 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-2xs disabled:opacity-60"
                    title="Atualizar listagem"
                  >
                    <RefreshCw size={13} className={loading ? 'animate-spin text-teal-600' : 'text-slate-600'} />
                    <span>Atualizar</span>
                  </button>
                </div>
              </div>

              {/* Listagem */}
              {loading ? (
                <div className="py-20 text-center">
                  <RefreshCw className="w-8 h-8 animate-spin text-teal-600 mx-auto mb-3" />
                  <p className="text-xs text-slate-500 font-semibold">Carregando {config?.termo_celula?.toLowerCase() || 'célula'}s...</p>
                </div>
              ) : celulasFiltradas.length === 0 ? (
                <div className="py-20 text-center space-y-3 p-6">
                  <div className="w-14 h-14 rounded-2xl bg-slate-100 border border-slate-200 text-slate-400 flex items-center justify-center mx-auto">
                    <Home className="w-7 h-7 text-slate-400" />
                  </div>
                  <h3 className="text-base font-bold text-slate-800">Nenhuma {config?.termo_celula?.toLowerCase() || 'célula'} encontrada</h3>
                  <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                    Não há {config?.termo_celula?.toLowerCase() || 'célula'}s cadastradas com os filtros aplicados. Clique no botão destacado <strong>&quot;+ Nova {config?.termo_celula || 'Célula'}&quot;</strong> acima para cadastrar a primeira.
                  </p>
                </div>
              ) : (
                <div className="p-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {celulasFiltradas.map((c) => (
                      <div
                        key={c.id}
                        onClick={() => abrirEdicaoCelula(c)}
                        className="bg-white p-5 rounded-2xl border border-slate-200/90 hover:border-teal-600 hover:shadow-md transition cursor-pointer flex flex-col justify-between group shadow-2xs"
                      >
                        <div className="space-y-3">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                              {c.codigo || 'S/ CÓDIGO'}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full capitalize border ${
                                c.status === 'ativa'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : c.status === 'em_formacao'
                                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                                  : 'bg-slate-100 text-slate-600 border-slate-200'
                              }`}
                            >
                              {c.status.replace('_', ' ')}
                            </span>
                          </div>

                          <div>
                            <h3 className="text-base font-bold text-slate-900 leading-snug group-hover:text-teal-800 transition-colors">
                              {c.nome}
                            </h3>
                            {c.rede && (
                              <span className="text-xs font-semibold text-teal-700 block mt-0.5">
                                {c.rede.nome}
                              </span>
                            )}
                          </div>

                          <div className="text-xs text-slate-600 space-y-1.5 pt-2 border-t border-slate-100">
                            <div className="flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-slate-400" />
                              <span className="font-medium text-slate-700">
                                {DIAS_SEMANA[c.dia_semana]}, às {c.horario ? c.horario.slice(0, 5) : '20:00'}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <MapPin className="w-3.5 h-3.5 text-slate-400" />
                              <span className="truncate">
                                {c.bairro ? `${c.bairro}${c.cidade ? `, ${c.cidade}` : ''}` : c.congregacao?.nome || 'Local não informado'}
                              </span>
                            </div>
                            {c.lider && (
                              <div className="flex items-center gap-1.5 pt-0.5">
                                <span className="text-[11px] font-bold text-slate-700">
                                  Líder: <span className="font-normal text-slate-600">{c.lider.name}</span>
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-teal-700 font-bold group-hover:text-teal-800">
                          <span>Editar detalhes</span>
                          <ChevronRight className="w-4 h-4 text-teal-600 group-hover:translate-x-0.5 transition-transform" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Conteúdo Aba Redes */}
        {abaAtiva === 'redes' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5">
              <div className="flex items-center justify-between border-b border-slate-200/80 pb-4 mb-5">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Redes Ministeriais</h2>
                  <p className="text-xs text-slate-500">Agrupamento estratégico de células por faixas, bairros ou ministérios</p>
                </div>
                <span className="px-3 py-1 bg-teal-50 text-teal-800 border border-teal-200/90 rounded-full text-xs font-bold">
                  {redes.length} {redes.length === 1 ? 'rede' : 'redes'}
                </span>
              </div>

              {redes.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-sm">
                  Nenhuma rede cadastrada. Clique em &quot;+ Nova Rede&quot; acima para registrar.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {redes.map((r) => (
                    <div key={r.id} className="bg-slate-50/70 p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold shadow-xs flex-shrink-0"
                          style={{ backgroundColor: r.cor || '#0f766e' }}
                        >
                          <Network className="w-5 h-5 text-white" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-base font-bold text-slate-900 truncate">{r.nome}</h3>
                          <p className="text-xs text-slate-500 truncate">{r.descricao || 'Rede ministerial ativa'}</p>
                        </div>
                      </div>
                      {r.coordenador && (
                        <p className="text-xs text-slate-600 border-t border-slate-200/80 pt-2.5">
                          Coordenador: <span className="font-semibold text-slate-800">{r.coordenador.name}</span>
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Conteúdo Aba Configurações */}
        {abaAtiva === 'configuracoes' && (
          <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200/90 shadow-sm max-w-2xl space-y-5">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Parâmetros Ministeriais</h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Ajuste a terminologia utilizada para pequenas reuniões de acordo com o modelo institucional de sua igreja.
              </p>
            </div>

            <div className="space-y-4 pt-2">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Termo para Célula
                </label>
                <input
                  type="text"
                  disabled
                  value={config?.termo_celula || 'Célula'}
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl bg-slate-50 text-slate-700 font-medium cursor-not-allowed shadow-2xs"
                />
                <span className="text-[11px] text-slate-500 mt-1 block font-medium">Ex: Célula, Pequeno Grupo, Grupo Familiar.</span>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Metodologia Adotada
                </label>
                <input
                  type="text"
                  disabled
                  value={config?.metodologia || 'Livre'}
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl bg-slate-50 text-slate-700 font-medium capitalize cursor-not-allowed shadow-2xs"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal Nova / Editar Célula */}
      {modalCelulaAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200/90 w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-slate-200 bg-slate-50/50">
              <h3 className="text-lg font-bold text-slate-900">
                {editandoCelulaId ? 'Editar Célula' : 'Cadastrar Nova Célula'}
              </h3>
              <button
                type="button"
                onClick={() => setModalCelulaAberto(false)}
                className="text-slate-400 hover:text-slate-600 transition p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSalvarCelula} className="p-6 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Nome da Célula *
                  </label>
                  <input
                    type="text"
                    required
                    value={formCelula.nome}
                    onChange={(e) => setFormCelula({ ...formCelula, nome: e.target.value })}
                    placeholder="Ex: Célula Betel, Ágape, Manancial..."
                    className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 shadow-2xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Código / Identificador
                  </label>
                  <input
                    type="text"
                    value={formCelula.codigo || ''}
                    onChange={(e) => setFormCelula({ ...formCelula, codigo: e.target.value })}
                    placeholder="Ex: CEL-001"
                    className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 shadow-2xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Status
                  </label>
                  <select
                    value={formCelula.status}
                    onChange={(e) => setFormCelula({ ...formCelula, status: e.target.value as any })}
                    className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 shadow-2xs cursor-pointer"
                  >
                    <option value="ativa">Ativa</option>
                    <option value="em_formacao">Em Formação</option>
                    <option value="suspensa">Suspensa</option>
                    <option value="encerrada">Encerrada</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Rede Ministerial
                  </label>
                  <select
                    value={formCelula.rede_id || ''}
                    onChange={(e) => setFormCelula({ ...formCelula, rede_id: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 shadow-2xs cursor-pointer"
                  >
                    <option value="">Nenhuma / Geral</option>
                    {redes.map((r) => (
                      <option key={r.id} value={r.id}>{r.nome}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Congregação Vinculada
                  </label>
                  <select
                    value={formCelula.congregacao_id || ''}
                    onChange={(e) => setFormCelula({ ...formCelula, congregacao_id: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 shadow-2xs cursor-pointer"
                  >
                    <option value="">Sede / Sem Vínculo Específico</option>
                    {congregacoes.map((c) => (
                      <option key={c.id} value={c.id}>{c.nome}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Dia da Reunião
                  </label>
                  <select
                    value={formCelula.dia_semana}
                    onChange={(e) => setFormCelula({ ...formCelula, dia_semana: Number(e.target.value) })}
                    className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 shadow-2xs cursor-pointer"
                  >
                    {DIAS_SEMANA.map((dia, idx) => (
                      <option key={idx} value={idx}>{dia}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Horário
                  </label>
                  <input
                    type="time"
                    required
                    value={formCelula.horario}
                    onChange={(e) => setFormCelula({ ...formCelula, horario: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 shadow-2xs"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Bairro / Localização
                  </label>
                  <input
                    type="text"
                    value={formCelula.bairro || ''}
                    onChange={(e) => setFormCelula({ ...formCelula, bairro: e.target.value })}
                    placeholder="Bairro ou ponto de referência"
                    className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 shadow-2xs"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setModalCelulaAberto(false)}
                  className="px-4 py-2.5 text-xs sm:text-sm font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvando}
                  className="px-4 py-2.5 text-xs sm:text-sm font-bold rounded-xl bg-teal-700 text-white hover:bg-teal-800 transition shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {salvando ? 'Salvando...' : 'Salvar Célula'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Nova Rede */}
      {modalRedeAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200/90 w-full max-w-md overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-slate-200 bg-slate-50/50">
              <h3 className="text-lg font-bold text-slate-900">Nova Rede Ministerial</h3>
              <button
                type="button"
                onClick={() => setModalRedeAberto(false)}
                className="text-slate-400 hover:text-slate-600 transition p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSalvarRede} className="p-6 space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Nome da Rede *
                </label>
                <input
                  type="text"
                  required
                  value={formRede.nome}
                  onChange={(e) => setFormRede({ ...formRede, nome: e.target.value })}
                  placeholder="Ex: Rede de Jovens, Rede de Mulheres..."
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 shadow-2xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Descrição
                </label>
                <textarea
                  value={formRede.descricao}
                  onChange={(e) => setFormRede({ ...formRede, descricao: e.target.value })}
                  placeholder="Breve resumo do público ou propósito da rede"
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 shadow-2xs h-20 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setModalRedeAberto(false)}
                  className="px-4 py-2.5 text-xs sm:text-sm font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvando}
                  className="px-4 py-2.5 text-xs sm:text-sm font-bold rounded-xl bg-teal-700 text-white hover:bg-teal-800 transition shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {salvando ? 'Salvando...' : 'Criar Rede'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
