'use client';

import { useEffect, useState, useMemo } from 'react';
import { 
  Plus, Search, Home, Calendar, MapPin, 
  Settings, Network, ChevronRight, CheckCircle2, AlertCircle, RefreshCw 
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
    <div className="min-h-screen bg-[#F4F7FB] p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl shadow-xs border border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#123b63]">
            <Home className="w-4 h-4" />
            <span>Acolhimento e Integração</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">
            Gestão de {config?.termo_celula || 'Células'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Organização, acompanhamento pastoral e cadastro de pequenos grupos e redes ministeriais.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {abaAtiva === 'celulas' && (
            <button
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
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#123b63] text-white text-xs sm:text-sm font-semibold hover:bg-[#0e2f50] transition shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Nova {config?.termo_celula || 'Célula'}</span>
            </button>
          )}

          {abaAtiva === 'redes' && (
            <button
              onClick={() => setModalRedeAberto(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#123b63] text-white text-xs sm:text-sm font-semibold hover:bg-[#0e2f50] transition shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Nova Rede</span>
            </button>
          )}
        </div>
      </div>

      {/* Feedback de Mensagem */}
      {mensagem && (
        <div
          className={`flex items-center justify-between p-4 rounded-xl text-xs sm:text-sm font-medium border ${
            mensagem.tipo === 'sucesso'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {mensagem.tipo === 'sucesso' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            <span>{mensagem.texto}</span>
          </div>
          <button onClick={() => setMensagem(null)} className="text-xs underline hover:opacity-80">
            Fechar
          </button>
        </div>
      )}

      {/* Navegação em Abas */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          onClick={() => setAbaAtiva('celulas')}
          className={`flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-semibold border-b-2 transition ${
            abaAtiva === 'celulas'
              ? 'border-[#123b63] text-[#123b63]'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Home className="w-4 h-4" />
          <span>{config?.termo_celula ? `${config.termo_celula}s` : 'Células'} ({celulas.length})</span>
        </button>

        <button
          onClick={() => setAbaAtiva('redes')}
          className={`flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-semibold border-b-2 transition ${
            abaAtiva === 'redes'
              ? 'border-[#123b63] text-[#123b63]'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Network className="w-4 h-4" />
          <span>Redes Ministeriais ({redes.length})</span>
        </button>

        <button
          onClick={() => setAbaAtiva('configuracoes')}
          className={`flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-semibold border-b-2 transition ${
            abaAtiva === 'configuracoes'
              ? 'border-[#123b63] text-[#123b63]'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>Configurações & Metodologia</span>
        </button>
      </div>

      {/* Conteúdo Aba Células */}
      {abaAtiva === 'celulas' && (
        <div className="space-y-4">
          {/* Barra de Filtros */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por nome, código ou bairro..."
                className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#123b63]"
              />
            </div>

            <div>
              <select
                value={filtroStatus}
                onChange={(e) => setFiltroStatus(e.target.value)}
                className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#123b63] text-slate-700"
              >
                <option value="todos">Todos os Status</option>
                <option value="ativa">Ativa</option>
                <option value="em_formacao">Em Formação</option>
                <option value="suspensa">Suspensa</option>
                <option value="encerrada">Encerrada</option>
              </select>
            </div>

            <div>
              <select
                value={filtroRede}
                onChange={(e) => setFiltroRede(e.target.value)}
                className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#123b63] text-slate-700"
              >
                <option value="todas">Todas as Redes</option>
                {redes.map((r) => (
                  <option key={r.id} value={r.id}>{r.nome}</option>
                ))}
              </select>
            </div>

            <div>
              <select
                value={filtroCongregacao}
                onChange={(e) => setFiltroCongregacao(e.target.value)}
                className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#123b63] text-slate-700"
              >
                <option value="todas">Todas as Congregações</option>
                {congregacoes.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Listagem */}
          {loading ? (
            <div className="flex items-center justify-center p-12 bg-white rounded-2xl border border-slate-200">
              <RefreshCw className="w-6 h-6 animate-spin text-[#123b63]" />
              <span className="ml-2 text-xs sm:text-sm text-slate-500">Carregando células...</span>
            </div>
          ) : celulasFiltradas.length === 0 ? (
            <div className="text-center p-12 bg-white rounded-2xl border border-dashed border-slate-300">
              <Home className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-slate-700">Nenhuma célula encontrada</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Não há células cadastradas com os filtros aplicados. Clique no botão acima para cadastrar a primeira.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {celulasFiltradas.map((c) => (
                <div
                  key={c.id}
                  onClick={() => abrirEdicaoCelula(c)}
                  className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-[#123b63] hover:shadow-md transition cursor-pointer flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                        {c.codigo || 'S/ CÓDIGO'}
                      </span>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${
                          c.status === 'ativa'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : c.status === 'em_formacao'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {c.status.replace('_', ' ')}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-base font-bold text-slate-900 leading-snug">{c.nome}</h3>
                      {c.rede && (
                        <span className="text-xs font-medium text-[#123b63] block mt-0.5">
                          {c.rede.nome}
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-slate-500 space-y-1 pt-2 border-t border-slate-100">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>{DIAS_SEMANA[c.dia_semana]}, às {c.horario ? c.horario.slice(0, 5) : '20:00'}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        <span className="truncate">
                          {c.bairro ? `${c.bairro}, ${c.cidade || ''}` : c.congregacao?.nome || 'Local não informado'}
                        </span>
                      </div>
                      {c.lider && (
                        <div className="flex items-center gap-1.5 pt-1">
                          <span className="text-[11px] font-medium text-slate-700">
                            Líder: <span className="font-normal text-slate-600">{c.lider.name}</span>
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-[#123b63] font-semibold">
                    <span>Editar detalhes</span>
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Conteúdo Aba Redes */}
      {abaAtiva === 'redes' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {redes.map((r) => (
              <div key={r.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold"
                    style={{ backgroundColor: r.cor || '#123b63' }}
                  >
                    <Network className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">{r.nome}</h3>
                    <p className="text-xs text-slate-500">{r.descricao || 'Rede ministerial ativa'}</p>
                  </div>
                </div>
                {r.coordenador && (
                  <p className="text-xs text-slate-600 border-t border-slate-100 pt-2">
                    Coordenador: <span className="font-semibold">{r.coordenador.name}</span>
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Conteúdo Aba Configurações */}
      {abaAtiva === 'configuracoes' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs max-w-2xl space-y-4">
          <h2 className="text-lg font-bold text-slate-900">Parâmetros Ministeriais</h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Ajuste a terminologia utilizada para pequenas reuniões de acordo com o modelo de sua igreja.
          </p>

          <div className="space-y-3 pt-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Termo para Célula</label>
              <input
                type="text"
                disabled
                value={config?.termo_celula || 'Célula'}
                className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-200 rounded-lg bg-slate-50 text-slate-600"
              />
              <span className="text-[11px] text-slate-400">Ex: Célula, Pequeno Grupo, Grupo Familiar.</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Metodologia Adotada</label>
              <input
                type="text"
                disabled
                value={config?.metodologia || 'Livre'}
                className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-200 rounded-lg bg-slate-50 text-slate-600 capitalize"
              />
            </div>
          </div>
        </div>
      )}

      {/* Modal Nova / Editar Célula */}
      {modalCelulaAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-900">
              {editandoCelulaId ? 'Editar Célula' : 'Cadastrar Nova Célula'}
            </h3>

            <form onSubmit={handleSalvarCelula} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Nome da Célula *</label>
                  <input
                    type="text"
                    required
                    value={formCelula.nome}
                    onChange={(e) => setFormCelula({ ...formCelula, nome: e.target.value })}
                    placeholder="Ex: Célula Betel, Ágape, Manancial..."
                    className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:border-[#123b63]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Código / Identificador</label>
                  <input
                    type="text"
                    value={formCelula.codigo || ''}
                    onChange={(e) => setFormCelula({ ...formCelula, codigo: e.target.value })}
                    placeholder="Ex: CEL-001"
                    className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:border-[#123b63]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
                  <select
                    value={formCelula.status}
                    onChange={(e) => setFormCelula({ ...formCelula, status: e.target.value as any })}
                    className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:border-[#123b63]"
                  >
                    <option value="ativa">Ativa</option>
                    <option value="em_formacao">Em Formação</option>
                    <option value="suspensa">Suspensa</option>
                    <option value="encerrada">Encerrada</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Rede Ministerial</label>
                  <select
                    value={formCelula.rede_id || ''}
                    onChange={(e) => setFormCelula({ ...formCelula, rede_id: e.target.value })}
                    className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:border-[#123b63]"
                  >
                    <option value="">Nenhuma / Geral</option>
                    {redes.map((r) => (
                      <option key={r.id} value={r.id}>{r.nome}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Congregação Vinculada</label>
                  <select
                    value={formCelula.congregacao_id || ''}
                    onChange={(e) => setFormCelula({ ...formCelula, congregacao_id: e.target.value })}
                    className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:border-[#123b63]"
                  >
                    <option value="">Sede / Sem Vínculo Específico</option>
                    {congregacoes.map((c) => (
                      <option key={c.id} value={c.id}>{c.nome}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Dia da Reunião</label>
                  <select
                    value={formCelula.dia_semana}
                    onChange={(e) => setFormCelula({ ...formCelula, dia_semana: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:border-[#123b63]"
                  >
                    {DIAS_SEMANA.map((dia, idx) => (
                      <option key={idx} value={idx}>{dia}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Horário</label>
                  <input
                    type="time"
                    required
                    value={formCelula.horario}
                    onChange={(e) => setFormCelula({ ...formCelula, horario: e.target.value })}
                    className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:border-[#123b63]"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Bairro / Localização</label>
                  <input
                    type="text"
                    value={formCelula.bairro || ''}
                    onChange={(e) => setFormCelula({ ...formCelula, bairro: e.target.value })}
                    placeholder="Bairro ou ponto de referência"
                    className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:border-[#123b63]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalCelulaAberto(false)}
                  className="px-4 py-2 text-xs sm:text-sm font-semibold text-slate-600 hover:text-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvando}
                  className="px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl bg-[#123b63] text-white hover:bg-[#0e2f50] disabled:opacity-50"
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
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Nova Rede Ministerial</h3>

            <form onSubmit={handleSalvarRede} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nome da Rede *</label>
                <input
                  type="text"
                  required
                  value={formRede.nome}
                  onChange={(e) => setFormRede({ ...formRede, nome: e.target.value })}
                  placeholder="Ex: Rede de Jovens, Rede de Mulheres..."
                  className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:border-[#123b63]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Descrição</label>
                <textarea
                  value={formRede.descricao}
                  onChange={(e) => setFormRede({ ...formRede, descricao: e.target.value })}
                  placeholder="Breve resumo do público ou propósito da rede"
                  className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:border-[#123b63] h-20 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalRedeAberto(false)}
                  className="px-4 py-2 text-xs sm:text-sm font-semibold text-slate-600 hover:text-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvando}
                  className="px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl bg-[#123b63] text-white hover:bg-[#0e2f50] disabled:opacity-50"
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
