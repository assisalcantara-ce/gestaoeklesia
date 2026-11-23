'use client';

import { useState, useEffect, useMemo } from 'react';
import { 
  MessageSquare, Plus, Search, Send, CheckCircle2, AlertCircle, 
  RefreshCw, X, Edit3, Eye, Phone, Share2, Copy, Check,
  Layers, Clock, Sparkles
} from 'lucide-react';
import { 
  CelulaComunicadoItem, CelulaComunicadoStatus, CelulaComunicadoPrioridade, 
  CelulaComunicadoPublico, SalvarComunicadoInput, CelulaTemplateMensagemItem,
  CelulaTemplateTipo, MensagemWhatsAppPreparada, CelulaItem, CelulaRede
} from '@/types/celulas';
import { authenticatedFetch } from '@/lib/api-client';

interface TabComunicacaoProps {
  celulas: CelulaItem[];
  redes: CelulaRede[];
  congregacoes: { id: string; nome: string }[];
  termoCelula: string;
}

interface ParticipanteOpcao {
  id: string;
  nome: string;
  tipo: string;
  telefone?: string | null;
  celula_id?: string;
  celula_nome?: string;
}

const PRIORIDADE_CONFIG: Record<CelulaComunicadoPrioridade, { label: string; badge: string }> = {
  baixa: { label: 'Baixa', badge: 'bg-slate-100 text-slate-700 border-slate-300' },
  normal: { label: 'Normal', badge: 'bg-blue-50 text-blue-700 border-blue-200' },
  alta: { label: 'Alta', badge: 'bg-amber-50 text-amber-800 border-amber-300' },
  urgente: { label: 'Urgente', badge: 'bg-rose-50 text-rose-800 border-rose-300 font-bold' },
};

const STATUS_CONFIG: Record<CelulaComunicadoStatus, { label: string; badge: string }> = {
  rascunho: { label: 'Rascunho', badge: 'bg-slate-100 text-slate-700 border-slate-300' },
  publicado: { label: 'Publicado', badge: 'bg-emerald-50 text-emerald-800 border-emerald-300' },
  arquivado: { label: 'Arquivado', badge: 'bg-zinc-100 text-zinc-500 border-zinc-200' },
};

const PUBLICO_CONFIG: Record<CelulaComunicadoPublico, string> = {
  todos: 'Todos os Participantes',
  lideres: 'Apenas Líderes',
  supervisores: 'Apenas Supervisores',
  participantes: 'Membros e Frequentadores',
  anfitrioes: 'Anfitriões de Célula',
};

const TEMPLATE_TIPOS_CONFIG: Record<CelulaTemplateTipo, string> = {
  lembrete_reuniao: 'Lembrete de Reunião',
  boas_vindas: 'Boas-vindas ao Novo Participante',
  apoio_pastoral: 'Apoio e Cuidado Pastoral',
  chamada_estudo: 'Chamada para Estudo Bíblico',
  comunicado_geral: 'Comunicado Geral da Liderança',
};

export function TabComunicacao({ celulas, redes, congregacoes, termoCelula }: TabComunicacaoProps) {
  const [comunicados, setComunicados] = useState<CelulaComunicadoItem[]>([]);
  const [templates, setTemplates] = useState<CelulaTemplateMensagemItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [notificacao, setNotificacao] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null);

  // Filtros
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<string>('todos');
  const [filtroRede, setFiltroRede] = useState<string>('todas');
  const [filtroCongregacao, setFiltroCongregacao] = useState<string>('todas');
  const [filtroCelula, setFiltroCelula] = useState<string>('todas');

  // Modais de Comunicado
  const [modalAberto, setModalAberto] = useState(false);
  const [comunicadoVisualizando, setComunicadoVisualizando] = useState<CelulaComunicadoItem | null>(null);

  // Formulário de Comunicado
  const [form, setForm] = useState<SalvarComunicadoInput>({
    titulo: '',
    conteudo: '',
    publico_alvo: 'todos',
    prioridade: 'normal',
    status: 'publicado',
    data_expiracao: '',
    congregacao_id: null,
    rede_id: null,
    celula_id: null,
  });

  // Modal WhatsApp Manual
  const [modalWhatsAppAberto, setModalWhatsAppAberto] = useState(false);
  const [participantesDisponiveis, setParticipantesDisponiveis] = useState<ParticipanteOpcao[]>([]);
  const [carregandoParticipantes, setCarregandoParticipantes] = useState(false);
  const [waCelulaSelecionada, setWaCelulaSelecionada] = useState<string>('');
  const [waParticipanteSelecionado, setWaParticipanteSelecionado] = useState<string>('');
  const [waTemplateSelecionado, setWaTemplateSelecionado] = useState<CelulaTemplateTipo>('lembrete_reuniao');
  const [waPreparando, setWaPreparando] = useState(false);
  const [waMensagemPreparada, setWaMensagemPreparada] = useState<MensagemWhatsAppPreparada | null>(null);
  const [linkCopiado, setLinkCopiado] = useState(false);

  // Carregar Comunicados e Templates
  const carregarDados = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filtroStatus !== 'todos') params.append('status', filtroStatus);
      if (filtroRede !== 'todas') params.append('rede_id', filtroRede);
      if (filtroCongregacao !== 'todas') params.append('congregacao_id', filtroCongregacao);
      if (filtroCelula !== 'todas') params.append('celula_id', filtroCelula);

      const [resComunicados, resTemplates] = await Promise.all([
        authenticatedFetch(`/api/v1/celulas/comunicados?${params.toString()}`),
        authenticatedFetch('/api/v1/celulas/comunicados/templates'),
      ]);

      if (!resComunicados.ok) throw new Error('Falha ao carregar comunicados.');
      const jsonComunicados = await resComunicados.json();
      setComunicados(jsonComunicados.data || []);

      if (resTemplates.ok) {
        const jsonTemplates = await resTemplates.json();
        setTemplates(jsonTemplates.data || []);
      }
    } catch (err: any) {
      setNotificacao({ tipo: 'erro', texto: err.message || 'Erro ao carregar dados de comunicação.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, [filtroStatus, filtroRede, filtroCongregacao, filtroCelula]);

  // Carregar participantes para o WhatsApp Manual quando a célula for escolhida
  const carregarParticipantesDaCelula = async (celulaId: string) => {
    if (!celulaId) {
      setParticipantesDisponiveis([]);
      return;
    }

    try {
      setCarregandoParticipantes(true);
      const res = await authenticatedFetch(`/api/v1/celulas/participantes?celula_id=${celulaId}&status=ativo`);
      if (res.ok) {
        const json = await res.json();
        const lista: ParticipanteOpcao[] = (json.data || []).map((p: any) => ({
          id: p.id,
          nome: p.member?.name || p.nome || 'Participante',
          tipo: p.papel || p.tipo || 'membro',
          telefone: p.member?.phone || p.member?.telefone || p.telefone || null,
          celula_id: p.celula_id,
          celula_nome: p.celula?.nome,
        }));
        setParticipantesDisponiveis(lista);
        if (lista.length > 0) {
          setWaParticipanteSelecionado(lista[0].id);
        } else {
          setWaParticipanteSelecionado('');
        }
      }
    } catch (e) {
      console.error('Erro ao carregar participantes:', e);
    } finally {
      setCarregandoParticipantes(false);
    }
  };

  useEffect(() => {
    if (modalWhatsAppAberto && waCelulaSelecionada) {
      carregarParticipantesDaCelula(waCelulaSelecionada);
    }
  }, [waCelulaSelecionada, modalWhatsAppAberto]);

  // Abrir modal de criação
  const abrirModalNovo = () => {
    setForm({
      titulo: '',
      conteudo: '',
      publico_alvo: 'todos',
      prioridade: 'normal',
      status: 'publicado',
      data_expiracao: '',
      congregacao_id: null,
      rede_id: null,
      celula_id: null,
    });
    setModalAberto(true);
  };

  // Abrir modal de edição
  const abrirModalEdicao = (comunicado: CelulaComunicadoItem) => {
    setForm({
      id: comunicado.id,
      titulo: comunicado.titulo,
      conteudo: comunicado.conteudo,
      publico_alvo: comunicado.publico_alvo,
      prioridade: comunicado.prioridade,
      status: comunicado.status,
      data_expiracao: comunicado.data_expiracao ? comunicado.data_expiracao.substring(0, 10) : '',
      congregacao_id: comunicado.congregacao_id,
      rede_id: comunicado.rede_id,
      celula_id: comunicado.celula_id,
    });
    setModalAberto(true);
  };

  // Abrir modal do WhatsApp Manual
  const abrirModalWhatsApp = (celulaIdPadrao?: string) => {
    const alvo = celulaIdPadrao || (celulas.length > 0 ? celulas[0].id : '');
    setWaCelulaSelecionada(alvo);
    setWaMensagemPreparada(null);
    setLinkCopiado(false);
    setModalWhatsAppAberto(true);
  };

  // Salvar Comunicado
  const handleSalvarComunicado = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.titulo.trim() || !form.conteudo.trim()) {
      setNotificacao({ tipo: 'erro', texto: 'Título e conteúdo são obrigatórios.' });
      return;
    }

    try {
      setSalvando(true);
      setNotificacao(null);

      const payload: SalvarComunicadoInput = {
        ...form,
        congregacao_id: form.congregacao_id || null,
        rede_id: form.rede_id || null,
        celula_id: form.celula_id || null,
        data_expiracao: form.data_expiracao ? new Date(form.data_expiracao).toISOString() : null,
      };

      const res = await authenticatedFetch('/api/v1/celulas/comunicados', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const resJson = await res.json();
      if (!res.ok) throw new Error(resJson.error || 'Erro ao salvar comunicado.');

      setNotificacao({ 
        tipo: 'sucesso', 
        texto: form.id ? 'Comunicado atualizado com sucesso!' : 'Novo comunicado publicado com sucesso!' 
      });
      setModalAberto(false);
      carregarDados();
    } catch (err: any) {
      setNotificacao({ tipo: 'erro', texto: err.message || 'Falha ao salvar comunicado.' });
    } finally {
      setSalvando(false);
    }
  };

  // Gerar Link do WhatsApp Manual
  const handleGerarWhatsAppManual = async () => {
    if (!waCelulaSelecionada || !waParticipanteSelecionado) {
      setNotificacao({ tipo: 'erro', texto: 'Selecione a célula e o participante destinatário.' });
      return;
    }

    try {
      setWaPreparando(true);
      setWaMensagemPreparada(null);
      setLinkCopiado(false);

      const res = await authenticatedFetch('/api/v1/celulas/comunicados/whatsapp-manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          celula_id: waCelulaSelecionada,
          participante_id: waParticipanteSelecionado,
          template_tipo: waTemplateSelecionado,
        }),
      });

      const resJson = await res.json();
      if (!res.ok) throw new Error(resJson.error || 'Erro ao gerar mensagem para WhatsApp.');

      setWaMensagemPreparada(resJson.data);
    } catch (err: any) {
      setNotificacao({ tipo: 'erro', texto: err.message || 'Falha ao preparar mensagem de WhatsApp.' });
    } finally {
      setWaPreparando(false);
    }
  };

  const copiarLinkWhatsApp = () => {
    if (!waMensagemPreparada?.link_whatsapp) return;
    navigator.clipboard.writeText(waMensagemPreparada.link_whatsapp);
    setLinkCopiado(true);
    setTimeout(() => setLinkCopiado(false), 3000);
  };

  // Filtro textual local para agilidade
  const comunicadosFiltrados = useMemo(() => {
    if (!busca.trim()) return comunicados;
    const termo = busca.toLowerCase();
    return comunicados.filter(c => 
      c.titulo.toLowerCase().includes(termo) || 
      c.conteudo.toLowerCase().includes(termo) ||
      (c.celula?.nome && c.celula.nome.toLowerCase().includes(termo)) ||
      (c.rede?.nome && c.rede.nome.toLowerCase().includes(termo))
    );
  }, [comunicados, busca]);

  // Indicadores Numéricos
  const totalPublicados = useMemo(() => comunicados.filter(c => c.status === 'publicado').length, [comunicados]);
  const totalRascunhos = useMemo(() => comunicados.filter(c => c.status === 'rascunho').length, [comunicados]);
  const totalArquivados = useMemo(() => comunicados.filter(c => c.status === 'arquivado').length, [comunicados]);

  return (
    <div className="space-y-6">
      {/* Notificação no Topo */}
      {notificacao && (
        <div
          className={`flex items-center justify-between p-4 rounded-xl text-xs sm:text-sm font-medium border shadow-2xs ${
            notificacao.tipo === 'sucesso'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {notificacao.tipo === 'sucesso' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600" />
            )}
            <span>{notificacao.texto}</span>
          </div>
          <button onClick={() => setNotificacao(null)} className="text-xs font-bold underline hover:opacity-80 cursor-pointer">
            Fechar
          </button>
        </div>
      )}

      {/* Cards de Indicadores Rápidos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total de Avisos</span>
            <div className="w-8 h-8 rounded-xl bg-teal-50 flex items-center justify-center text-teal-700">
              <MessageSquare className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{comunicados.length}</span>
            <span className="text-xs text-slate-500">registrados</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Publicados Ativos</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-700">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-600">{totalPublicados}</span>
            <span className="text-xs text-emerald-700 font-medium">visíveis no mural</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Em Rascunho / Arquivados</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center text-amber-700">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-amber-600">{totalRascunhos}</span>
            <span className="text-xs text-slate-500">rascunhos ({totalArquivados} arquivados)</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Templates Ativos</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center text-blue-700">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-blue-600">{templates.length}</span>
            <span className="text-xs text-slate-500">modelos para WhatsApp</span>
          </div>
        </div>
      </div>

      {/* Ações e Barra de Filtros */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Pesquisar comunicados por título, conteúdo ou célula..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-transparent"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => abrirModalWhatsApp()}
              className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 shadow-2xs transition cursor-pointer"
            >
              <Phone className="w-4 h-4" />
              <span>WhatsApp Manual</span>
            </button>

            <button
              type="button"
              onClick={abrirModalNovo}
              className="px-4 py-2.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 shadow-2xs transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Novo Comunicado</span>
            </button>

            <button
              type="button"
              onClick={carregarDados}
              disabled={loading}
              className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition cursor-pointer disabled:opacity-50"
              title="Recarregar"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Linha de Filtros por Segmentação */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Status</label>
            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-teal-600 focus:outline-none bg-white"
            >
              <option value="todos">Todos os Status</option>
              <option value="publicado">Publicado</option>
              <option value="rascunho">Rascunho</option>
              <option value="arquivado">Arquivado</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Rede Ministerial</label>
            <select
              value={filtroRede}
              onChange={(e) => setFiltroRede(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-teal-600 focus:outline-none bg-white"
            >
              <option value="todas">Todas as Redes</option>
              {redes.map(r => (
                <option key={r.id} value={r.id}>{r.nome}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Congregação</label>
            <select
              value={filtroCongregacao}
              onChange={(e) => setFiltroCongregacao(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-teal-600 focus:outline-none bg-white"
            >
              <option value="todas">Todas as Congregações</option>
              {congregacoes.map(c => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">{termoCelula}</label>
            <select
              value={filtroCelula}
              onChange={(e) => setFiltroCelula(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-teal-600 focus:outline-none bg-white"
            >
              <option value="todas">Todas as {termoCelula}s</option>
              {celulas.map(c => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Lista de Comunicados */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900">Mural de Comunicados & Notificações</h3>
            <p className="text-xs text-slate-500">Transmissão interna com segmentação ministerial e controle de alçada</p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-700 rounded-full border border-slate-200">
            {comunicadosFiltrados.length} {comunicadosFiltrados.length === 1 ? 'comunicado' : 'comunicados'}
          </span>
        </div>

        {loading ? (
          <div className="py-16 text-center text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-teal-700" />
            <p className="text-xs font-medium">Carregando mural de comunicados...</p>
          </div>
        ) : comunicadosFiltrados.length === 0 ? (
          <div className="py-16 text-center text-slate-500 space-y-3">
            <MessageSquare className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-sm font-semibold text-slate-700">Nenhum comunicado encontrado</p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Utilize o botão acima para criar o primeiro comunicado direcionado às células, liderança ou rede.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {comunicadosFiltrados.map((comunicado) => {
              const prio = PRIORIDADE_CONFIG[comunicado.prioridade] || PRIORIDADE_CONFIG.normal;
              const statusCfg = STATUS_CONFIG[comunicado.status] || STATUS_CONFIG.publicado;
              const publicoLabel = PUBLICO_CONFIG[comunicado.publico_alvo] || comunicado.publico_alvo;

              return (
                <div key={comunicado.id} className="p-4 sm:p-5 hover:bg-slate-50/60 transition">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="space-y-2 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-md border ${statusCfg.badge}`}>
                          {statusCfg.label}
                        </span>
                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-md border ${prio.badge}`}>
                          Prioridade: {prio.label}
                        </span>
                        <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                          Público: <strong className="text-slate-700">{publicoLabel}</strong>
                        </span>
                      </div>

                      <div>
                        <h4 className="text-base font-bold text-slate-900 hover:text-teal-800 transition cursor-pointer" onClick={() => setComunicadoVisualizando(comunicado)}>
                          {comunicado.titulo}
                        </h4>
                        <p className="text-xs sm:text-sm text-slate-600 line-clamp-2 mt-1">
                          {comunicado.conteudo}
                        </p>
                      </div>

                      {/* Metadados de Segmentação */}
                      <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-slate-400 pt-1">
                        {comunicado.celula?.nome && (
                          <span className="flex items-center gap-1 font-medium text-teal-800">
                            <Layers className="w-3.5 h-3.5 text-teal-600" />
                            {termoCelula}: {comunicado.celula.nome}
                          </span>
                        )}
                        {comunicado.rede?.nome && (
                          <span className="flex items-center gap-1 font-medium text-slate-600">
                            Rede: {comunicado.rede.nome}
                          </span>
                        )}
                        {comunicado.congregacao?.nome && (
                          <span className="flex items-center gap-1 text-slate-500">
                            Congregação: {comunicado.congregacao.nome}
                          </span>
                        )}
                        <span className="text-slate-400">
                          Publicado em {new Date(comunicado.created_at).toLocaleDateString('pt-BR')}
                        </span>
                        {comunicado.data_expiracao && (
                          <span className="text-amber-700 font-medium">
                            Expira em {new Date(comunicado.data_expiracao).toLocaleDateString('pt-BR')}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Ações do Card */}
                    <div className="flex items-center gap-2 self-end lg:self-center">
                      <button
                        type="button"
                        onClick={() => setComunicadoVisualizando(comunicado)}
                        className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                        title="Visualizar Detalhes"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => abrirModalEdicao(comunicado)}
                        className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                        title="Editar Comunicado"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>

                      {comunicado.celula_id && (
                        <button
                          type="button"
                          onClick={() => abrirModalWhatsApp(comunicado.celula_id || undefined)}
                          className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                          title="Compartilhar via WhatsApp Manual"
                        >
                          <Phone className="w-3.5 h-3.5 text-emerald-600" />
                          <span>WhatsApp</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL: Criar / Editar Comunicado */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-teal-700" />
                <h3 className="text-base font-bold text-slate-900">
                  {form.id ? 'Editar Comunicado Ministerial' : 'Novo Comunicado Ministerial'}
                </h3>
              </div>
              <button
                onClick={() => setModalAberto(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSalvarComunicado} className="p-5 sm:p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Título do Comunicado *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Mutirão de Oração das Células"
                  value={form.titulo}
                  onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Mensagem / Conteúdo Oficial *
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Descreva a mensagem clara e objetiva para os membros e líderes..."
                  value={form.conteudo}
                  onChange={(e) => setForm({ ...form, conteudo: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Público-Alvo</label>
                  <select
                    value={form.publico_alvo}
                    onChange={(e) => setForm({ ...form, publico_alvo: e.target.value as CelulaComunicadoPublico })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-teal-600 focus:outline-none bg-white"
                  >
                    <option value="todos">Todos os Participantes</option>
                    <option value="lideres">Apenas Líderes</option>
                    <option value="supervisores">Apenas Supervisores</option>
                    <option value="participantes">Participantes Gerais</option>
                    <option value="anfitrioes">Anfitriões</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Prioridade</label>
                  <select
                    value={form.prioridade}
                    onChange={(e) => setForm({ ...form, prioridade: e.target.value as CelulaComunicadoPrioridade })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-teal-600 focus:outline-none bg-white"
                  >
                    <option value="baixa">Baixa</option>
                    <option value="normal">Normal</option>
                    <option value="alta">Alta</option>
                    <option value="urgente">Urgente</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Situação / Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value as CelulaComunicadoStatus })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-teal-600 focus:outline-none bg-white"
                  >
                    <option value="publicado">Publicado</option>
                    <option value="rascunho">Rascunho</option>
                    <option value="arquivado">Arquivado</option>
                  </select>
                </div>
              </div>

              {/* Segmentação Territorial / Ministerial */}
              <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-200/80 space-y-3">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wide block">
                  Segmentação Opcional (Limitar Alcance)
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Congregação</label>
                    <select
                      value={form.congregacao_id || ''}
                      onChange={(e) => setForm({ ...form, congregacao_id: e.target.value || null })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-teal-600 focus:outline-none bg-white"
                    >
                      <option value="">Toda a Igreja (Geral)</option>
                      {congregacoes.map(c => (
                        <option key={c.id} value={c.id}>{c.nome}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Rede</label>
                    <select
                      value={form.rede_id || ''}
                      onChange={(e) => setForm({ ...form, rede_id: e.target.value || null })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-teal-600 focus:outline-none bg-white"
                    >
                      <option value="">Todas as Redes</option>
                      {redes.map(r => (
                        <option key={r.id} value={r.id}>{r.nome}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">{termoCelula}</label>
                    <select
                      value={form.celula_id || ''}
                      onChange={(e) => setForm({ ...form, celula_id: e.target.value || null })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-teal-600 focus:outline-none bg-white"
                    >
                      <option value="">Todas as {termoCelula}s</option>
                      {celulas.map(c => (
                        <option key={c.id} value={c.id}>{c.nome}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Data Limite de Exibição (Expiração)</label>
                  <input
                    type="date"
                    value={form.data_expiracao || ''}
                    onChange={(e) => setForm({ ...form, data_expiracao: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-teal-600 focus:outline-none bg-white"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalAberto(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvando}
                  className="px-5 py-2.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {salvando ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  <span>{form.id ? 'Atualizar Comunicado' : 'Publicar Comunicado'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Visualizar Detalhes do Comunicado */}
      {comunicadoVisualizando && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-xl w-full p-6 space-y-4">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-md border ${STATUS_CONFIG[comunicadoVisualizando.status]?.badge}`}>
                  {STATUS_CONFIG[comunicadoVisualizando.status]?.label}
                </span>
                <h3 className="text-lg font-black text-slate-900 mt-2">{comunicadoVisualizando.titulo}</h3>
              </div>
              <button
                onClick={() => setComunicadoVisualizando(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 text-xs sm:text-sm text-slate-700 whitespace-pre-wrap">
                {comunicadoVisualizando.conteudo}
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50/50 p-3 rounded-xl border border-slate-200/60">
                <div>
                  <span className="text-slate-400 block font-semibold uppercase text-[10px]">Público-Alvo:</span>
                  <span className="font-bold text-slate-800">{PUBLICO_CONFIG[comunicadoVisualizando.publico_alvo]}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-semibold uppercase text-[10px]">Prioridade:</span>
                  <span className="font-bold text-slate-800">{PRIORIDADE_CONFIG[comunicadoVisualizando.prioridade]?.label}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-semibold uppercase text-[10px]">Célula Vinculada:</span>
                  <span className="font-bold text-slate-800">{comunicadoVisualizando.celula?.nome || 'Todas'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-semibold uppercase text-[10px]">Rede:</span>
                  <span className="font-bold text-slate-800">{comunicadoVisualizando.rede?.nome || 'Todas'}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setComunicadoVisualizando(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: WhatsApp Manual com Templates Oficiais */}
      {modalWhatsAppAberto && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-emerald-50/50">
              <div className="flex items-center gap-2">
                <Phone className="w-5 h-5 text-emerald-700" />
                <div>
                  <h3 className="text-base font-bold text-slate-900">Preparador de WhatsApp Manual</h3>
                  <p className="text-xs text-slate-500">Envio pontual assistido sem disparo em massa ou custos de API externa</p>
                </div>
              </div>
              <button
                onClick={() => setModalWhatsAppAberto(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 sm:p-6 space-y-4">
              {/* Seleção da Célula */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  1. Selecione a {termoCelula} *
                </label>
                <select
                  value={waCelulaSelecionada}
                  onChange={(e) => setWaCelulaSelecionada(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm focus:ring-2 focus:ring-emerald-600 focus:outline-none bg-white font-medium"
                >
                  <option value="">Selecione uma célula...</option>
                  {celulas.map(c => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>
              </div>

              {/* Seleção do Participante */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  2. Destinatário (Participante da Célula) *
                </label>
                {carregandoParticipantes ? (
                  <div className="p-3 bg-slate-50 text-xs text-slate-500 rounded-xl border border-slate-200 flex items-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-teal-700" />
                    <span>Buscando participantes vinculados...</span>
                  </div>
                ) : participantesDisponiveis.length === 0 ? (
                  <div className="p-3 bg-amber-50 text-xs text-amber-800 rounded-xl border border-amber-200">
                    Nenhum participante ativo encontrado para a célula selecionada.
                  </div>
                ) : (
                  <select
                    value={waParticipanteSelecionado}
                    onChange={(e) => setWaParticipanteSelecionado(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm focus:ring-2 focus:ring-emerald-600 focus:outline-none bg-white font-medium"
                  >
                    {participantesDisponiveis.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.nome} {p.telefone ? `(${p.telefone})` : '(Sem telefone informado)'}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Seleção do Template */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  3. Modelo de Mensagem Pastoral *
                </label>
                <select
                  value={waTemplateSelecionado}
                  onChange={(e) => setWaTemplateSelecionado(e.target.value as CelulaTemplateTipo)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm focus:ring-2 focus:ring-emerald-600 focus:outline-none bg-white font-medium"
                >
                  {Object.entries(TEMPLATE_TIPOS_CONFIG).map(([tipo, label]) => (
                    <option key={tipo} value={tipo}>{label}</option>
                  ))}
                </select>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleGerarWhatsAppManual}
                  disabled={waPreparando || !waCelulaSelecionada || !waParticipanteSelecionado}
                  className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs sm:text-sm font-bold transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-2xs"
                >
                  {waPreparando ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  <span>Formatar Mensagem e Gerar Link WhatsApp</span>
                </button>
              </div>

              {/* Resultado: Mensagem Formatada e Link Direto */}
              {waMensagemPreparada && (
                <div className="p-4 bg-emerald-50/60 rounded-xl border border-emerald-200/90 space-y-3 mt-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-900 uppercase">Mensagem Preparada com Sucesso</span>
                    <span className="text-[11px] font-semibold text-emerald-800">
                      Destino: {waMensagemPreparada.destinatario_nome}
                    </span>
                  </div>

                  <div className="bg-white p-3 rounded-lg border border-emerald-100 text-xs text-slate-800 whitespace-pre-wrap shadow-2xs">
                    {waMensagemPreparada.mensagem}
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                    <a
                      href={waMensagemPreparada.link_whatsapp}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition text-center shadow-2xs"
                    >
                      <Share2 className="w-4 h-4" />
                      <span>Abrir no WhatsApp</span>
                    </a>

                    <button
                      type="button"
                      onClick={copiarLinkWhatsApp}
                      className="px-4 py-2.5 bg-white hover:bg-slate-50 border border-emerald-300 text-emerald-800 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      {linkCopiado ? <Check className="w-4 h-4 text-emerald-700" /> : <Copy className="w-4 h-4" />}
                      <span>{linkCopiado ? 'Copiado!' : 'Copiar Link'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setModalWhatsAppAberto(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
