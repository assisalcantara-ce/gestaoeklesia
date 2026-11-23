'use client';

import { useState, useEffect, useMemo } from 'react';
import { 
  BookOpen, Plus, Search, Calendar, Tag, Layers, 
  CheckCircle2, Check, AlertCircle, RefreshCw, X, Edit3, Eye
} from 'lucide-react';
import { 
  CelulaEstudoItem, CelulaRede, CelulaEstudoStatus, SalvarEstudoInput
} from '@/types/celulas';
import { authenticatedFetch } from '@/lib/api-client';

interface TabEstudosProps {
  redes: CelulaRede[];
  congregacoes: { id: string; nome: string }[];
  termoCelula: string;
}

const STATUS_CONFIG: Record<CelulaEstudoStatus, { label: string; cor: string; badge: string }> = {
  rascunho: { label: 'Rascunho', cor: 'text-slate-600', badge: 'bg-slate-100 text-slate-700 border-slate-300' },
  em_revisao: { label: 'Em Revisão', cor: 'text-amber-600', badge: 'bg-amber-50 text-amber-700 border-amber-300' },
  aprovado: { label: 'Aprovado', cor: 'text-blue-600', badge: 'bg-blue-50 text-blue-700 border-blue-300' },
  publicado: { label: 'Publicado', cor: 'text-emerald-600', badge: 'bg-emerald-50 text-emerald-700 border-emerald-300' },
  arquivado: { label: 'Arquivado', cor: 'text-slate-400', badge: 'bg-slate-50 text-slate-500 border-slate-200' },
  rejeitado: { label: 'Rejeitado', cor: 'text-rose-600', badge: 'bg-rose-50 text-rose-700 border-rose-300' },
};

export function TabEstudos({ redes, congregacoes, termoCelula }: TabEstudosProps) {
  const [estudos, setEstudos] = useState<CelulaEstudoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [notificacao, setNotificacao] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null);

  // Filtros
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<string>('todos');
  const [filtroRede, setFiltroRede] = useState<string>('todas');
  const [filtroCongregacao, setFiltroCongregacao] = useState<string>('todas');

  // Modais
  const [modalAberto, setModalAberto] = useState(false);
  const [estudoVisualizando, setEstudoVisualizando] = useState<CelulaEstudoItem | null>(null);
  const [estudoEditando, setEstudoEditando] = useState<CelulaEstudoItem | null>(null);

  // Formulário
  const [form, setForm] = useState<SalvarEstudoInput>({
    titulo: '',
    tema: '',
    serie: '',
    numero_licao: undefined,
    referencias_biblicas: '',
    objetivo: '',
    quebra_gelo: '',
    introducao: '',
    desenvolvimento: '',
    perguntas_discussao: '',
    aplicacao_pratica: '',
    conclusao: '',
    oracao_final: '',
    status: 'rascunho',
    rede_id: null,
    congregacao_id: null,
    data_publicacao_inicio: '',
    data_publicacao_fim: '',
  });

  const carregarEstudos = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filtroStatus !== 'todos') params.append('status', filtroStatus);
      if (filtroRede !== 'todas') params.append('rede_id', filtroRede);
      if (filtroCongregacao !== 'todas') params.append('congregacao_id', filtroCongregacao);
      if (busca.trim()) params.append('busca', busca.trim());

      const res = await authenticatedFetch(`/api/v1/celulas/estudos?${params.toString()}`);
      if (!res.ok) throw new Error('Falha ao buscar estudos bíblicos.');
      const json = await res.json();
      setEstudos(json.data || []);
    } catch (err: any) {
      setNotificacao({ tipo: 'erro', texto: err.message || 'Erro ao carregar estudos.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarEstudos();
  }, [filtroStatus, filtroRede, filtroCongregacao]);

  const abrirModalNovo = () => {
    setEstudoEditando(null);
    setForm({
      titulo: '',
      tema: '',
      serie: '',
      numero_licao: undefined,
      referencias_biblicas: '',
      objetivo: '',
      quebra_gelo: '',
      introducao: '',
      desenvolvimento: '',
      perguntas_discussao: '',
      aplicacao_pratica: '',
      conclusao: '',
      oracao_final: '',
      status: 'rascunho',
      rede_id: null,
      congregacao_id: null,
      data_publicacao_inicio: new Date().toISOString().slice(0, 10),
      data_publicacao_fim: '',
    });
    setModalAberto(true);
  };

  const abrirModalEditar = (estudo: CelulaEstudoItem) => {
    setEstudoEditando(estudo);
    setForm({
      id: estudo.id,
      titulo: estudo.titulo || '',
      tema: estudo.tema || '',
      serie: estudo.serie || '',
      numero_licao: estudo.numero_licao || undefined,
      referencias_biblicas: estudo.referencias_biblicas || '',
      objetivo: estudo.objetivo || '',
      quebra_gelo: estudo.quebra_gelo || '',
      introducao: estudo.introducao || '',
      desenvolvimento: estudo.desenvolvimento || '',
      perguntas_discussao: estudo.perguntas_discussao || '',
      aplicacao_pratica: estudo.aplicacao_pratica || '',
      conclusao: estudo.conclusao || '',
      oracao_final: estudo.oracao_final || '',
      status: estudo.status || 'rascunho',
      rede_id: estudo.rede_id || null,
      congregacao_id: estudo.congregacao_id || null,
      data_publicacao_inicio: estudo.data_publicacao_inicio || '',
      data_publicacao_fim: estudo.data_publicacao_fim || '',
    });
    setModalAberto(true);
  };

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.titulo.trim()) {
      setNotificacao({ tipo: 'erro', texto: 'Informe o título do estudo.' });
      return;
    }
    if (!form.desenvolvimento.trim()) {
      setNotificacao({ tipo: 'erro', texto: 'O roteiro/desenvolvimento bíblico é obrigatório.' });
      return;
    }

    try {
      setSalvando(true);
      const res = await authenticatedFetch('/api/v1/celulas/estudos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erro ao salvar estudo.');

      setNotificacao({ tipo: 'sucesso', texto: 'Estudo bíblico salvo com sucesso!' });
      setModalAberto(false);
      carregarEstudos();
    } catch (err: any) {
      setNotificacao({ tipo: 'erro', texto: err.message || 'Falha ao salvar estudo.' });
    } finally {
      setSalvando(false);
    }
  };

  const handlePublicarRapido = async (estudo: CelulaEstudoItem) => {
    try {
      const res = await authenticatedFetch('/api/v1/celulas/estudos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: estudo.id,
          titulo: estudo.titulo,
          desenvolvimento: estudo.desenvolvimento,
          status: 'publicado',
          data_publicacao_inicio: estudo.data_publicacao_inicio || new Date().toISOString().slice(0, 10),
        }),
      });
      if (!res.ok) throw new Error('Não foi possível publicar o estudo.');
      setNotificacao({ tipo: 'sucesso', texto: `O estudo "${estudo.titulo}" foi publicado com sucesso!` });
      carregarEstudos();
    } catch (err: any) {
      setNotificacao({ tipo: 'erro', texto: err.message });
    }
  };

  const estudosFiltrados = useMemo(() => {
    if (!busca.trim()) return estudos;
    const term = busca.toLowerCase();
    return estudos.filter(e => 
      e.titulo.toLowerCase().includes(term) ||
      (e.tema && e.tema.toLowerCase().includes(term)) ||
      (e.serie && e.serie.toLowerCase().includes(term)) ||
      (e.referencias_biblicas && e.referencias_biblicas.toLowerCase().includes(term))
    );
  }, [estudos, busca]);

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

      {/* Barra de Filtros e Ações */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 sm:p-5">
        <div className="flex flex-col md:flex-row gap-3.5 items-center justify-between">
          <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Busca Textual */}
            <div className="relative">
              <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por título, tema, série..."
                className="w-full pl-10 pr-3.5 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 bg-white"
              />
            </div>

            {/* Filtro Status */}
            <div>
              <select
                value={filtroStatus}
                onChange={(e) => setFiltroStatus(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 bg-white cursor-pointer"
              >
                <option value="todos">Todos os Status</option>
                <option value="publicado">Publicados</option>
                <option value="rascunho">Rascunhos</option>
                <option value="em_revisao">Em Revisão</option>
                <option value="aprovado">Aprovados</option>
                <option value="arquivado">Arquivados</option>
              </select>
            </div>

            {/* Filtro Rede */}
            <div>
              <select
                value={filtroRede}
                onChange={(e) => setFiltroRede(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 bg-white cursor-pointer"
              >
                <option value="todas">Todas as Redes</option>
                {redes.map(r => (
                  <option key={r.id} value={r.id}>{r.nome}</option>
                ))}
              </select>
            </div>

            {/* Filtro Congregação */}
            <div>
              <select
                value={filtroCongregacao}
                onChange={(e) => setFiltroCongregacao(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 bg-white cursor-pointer"
              >
                <option value="todas">Todas as Congregações</option>
                {congregacoes.map(c => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Botão Novo Estudo */}
          <div className="w-full md:w-auto flex items-center justify-end">
            <button
              type="button"
              onClick={abrirModalNovo}
              className="w-full md:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs sm:text-sm font-bold shadow-sm transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Novo Roteiro / Estudo</span>
            </button>
          </div>
        </div>
      </div>

      {/* Grid de Estudos Bíblicos */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200/90 p-12 text-center text-slate-500">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-teal-700 mb-2" />
          <p className="text-sm font-medium">Carregando biblioteca de estudos bíblicos...</p>
        </div>
      ) : estudosFiltrados.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/90 p-12 text-center text-slate-500">
          <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-base font-bold text-slate-700 mb-1">Nenhum estudo bíblico encontrado</p>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
            Crie roteiros oficiais de estudos para disponibilizar automaticamente aos líderes de {termoCelula.toLowerCase()}s.
          </p>
          <button
            type="button"
            onClick={abrirModalNovo}
            className="inline-flex items-center gap-2 px-4 py-2 bg-teal-50 hover:bg-teal-100 text-teal-800 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            <Plus size={15} />
            Cadastrar Primeiro Estudo
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {estudosFiltrados.map((estudo) => {
            const stConfig = STATUS_CONFIG[estudo.status] || STATUS_CONFIG.rascunho;
            return (
              <div
                key={estudo.id}
                className="bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-md transition flex flex-col justify-between overflow-hidden group"
              >
                <div className="p-5 space-y-3.5">
                  {/* Cabeçalho do Card */}
                  <div className="flex items-start justify-between gap-2">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${stConfig.badge}`}>
                      {stConfig.label}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-400">
                      v{estudo.versao || 1}
                    </span>
                  </div>

                  {/* Título & Metadados */}
                  <div>
                    <h3 className="text-base font-bold text-slate-900 group-hover:text-teal-700 transition line-clamp-2">
                      {estudo.titulo}
                    </h3>
                    {estudo.referencias_biblicas && (
                      <p className="text-xs font-semibold text-teal-800 mt-1 flex items-center gap-1.5">
                        <BookOpen size={13} className="text-teal-600 shrink-0" />
                        <span className="truncate">{estudo.referencias_biblicas}</span>
                      </p>
                    )}
                  </div>

                  {/* Série / Tema / Lição */}
                  <div className="flex flex-wrap gap-1.5 text-[11px]">
                    {estudo.serie && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium">
                        <Layers size={11} className="text-slate-500" />
                        {estudo.serie} {estudo.numero_licao ? `#${estudo.numero_licao}` : ''}
                      </span>
                    )}
                    {estudo.tema && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium">
                        <Tag size={11} className="text-slate-500" />
                        {estudo.tema}
                      </span>
                    )}
                  </div>

                  {/* Resumo do Desenvolvimento */}
                  <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">
                    {estudo.introducao || estudo.desenvolvimento}
                  </p>
                </div>

                {/* Rodapé de Ações */}
                <div className="px-5 py-3 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1 text-[11px] text-slate-500">
                    <Calendar size={12} />
                    <span>{estudo.data_publicacao_inicio ? new Date(`${estudo.data_publicacao_inicio}T12:00:00`).toLocaleDateString('pt-BR') : 'Sem data'}</span>
                  </div>

                  <div className="flex items-center gap-1">
                    {estudo.status !== 'publicado' && (
                      <button
                        type="button"
                        onClick={() => handlePublicarRapido(estudo)}
                        title="Publicar Estudo Imediatamente"
                        className="p-1.5 hover:bg-emerald-100 text-emerald-700 rounded-lg transition cursor-pointer"
                      >
                        <Check size={15} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setEstudoVisualizando(estudo)}
                      title="Visualizar Roteiro Completo"
                      className="p-1.5 hover:bg-slate-200 text-slate-700 rounded-lg transition cursor-pointer"
                    >
                      <Eye size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => abrirModalEditar(estudo)}
                      title="Editar Estudo"
                      className="p-1.5 hover:bg-teal-100 text-teal-700 rounded-lg transition cursor-pointer"
                    >
                      <Edit3 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Visualização de Estudo */}
      {estudoVisualizando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200/90 w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-200 bg-slate-50/70">
              <div>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${STATUS_CONFIG[estudoVisualizando.status]?.badge}`}>
                    {STATUS_CONFIG[estudoVisualizando.status]?.label}
                  </span>
                  <span className="text-xs text-slate-500 font-semibold">Versão {estudoVisualizando.versao || 1}</span>
                </div>
                <h3 className="text-lg font-bold text-slate-900 mt-1">{estudoVisualizando.titulo}</h3>
                {estudoVisualizando.referencias_biblicas && (
                  <p className="text-xs font-semibold text-teal-800">{estudoVisualizando.referencias_biblicas}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setEstudoVisualizando(null)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Conteúdo Estruturado */}
            <div className="p-6 overflow-y-auto space-y-5 text-slate-700 text-xs sm:text-sm leading-relaxed">
              {estudoVisualizando.objetivo && (
                <div className="bg-teal-50/60 p-4 rounded-xl border border-teal-200/80">
                  <h4 className="text-[11px] font-bold text-teal-900 uppercase tracking-wider mb-1">Objetivo Pastoral</h4>
                  <p className="text-teal-950 font-medium">{estudoVisualizando.objetivo}</p>
                </div>
              )}

              {estudoVisualizando.quebra_gelo && (
                <div>
                  <h4 className="text-[11px] font-bold text-slate-900 uppercase tracking-wider mb-1">Dinâmica / Quebra-Gelo</h4>
                  <p className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-slate-800">{estudoVisualizando.quebra_gelo}</p>
                </div>
              )}

              {estudoVisualizando.introducao && (
                <div>
                  <h4 className="text-[11px] font-bold text-slate-900 uppercase tracking-wider mb-1">Introdução</h4>
                  <p className="whitespace-pre-line">{estudoVisualizando.introducao}</p>
                </div>
              )}

              <div>
                <h4 className="text-[11px] font-bold text-slate-900 uppercase tracking-wider mb-1">Desenvolvimento / Mensagem</h4>
                <div className="bg-slate-50/60 p-4 rounded-xl border border-slate-200 whitespace-pre-line text-slate-800 font-normal">
                  {estudoVisualizando.desenvolvimento}
                </div>
              </div>

              {estudoVisualizando.perguntas_discussao && (
                <div>
                  <h4 className="text-[11px] font-bold text-slate-900 uppercase tracking-wider mb-1">Perguntas para Compartilhamento</h4>
                  <p className="whitespace-pre-line bg-amber-50/50 p-3.5 rounded-xl border border-amber-200 text-amber-950">{estudoVisualizando.perguntas_discussao}</p>
                </div>
              )}

              {estudoVisualizando.aplicacao_pratica && (
                <div>
                  <h4 className="text-[11px] font-bold text-slate-900 uppercase tracking-wider mb-1">Aplicação Prática no Dia a Dia</h4>
                  <p className="whitespace-pre-line">{estudoVisualizando.aplicacao_pratica}</p>
                </div>
              )}

              {estudoVisualizando.conclusao && (
                <div>
                  <h4 className="text-[11px] font-bold text-slate-900 uppercase tracking-wider mb-1">Conclusão</h4>
                  <p className="whitespace-pre-line">{estudoVisualizando.conclusao}</p>
                </div>
              )}

              {estudoVisualizando.oracao_final && (
                <div>
                  <h4 className="text-[11px] font-bold text-slate-900 uppercase tracking-wider mb-1">Motivos de Oração / Encerramento</h4>
                  <p className="whitespace-pre-line bg-emerald-50/50 p-3.5 rounded-xl border border-emerald-200 text-emerald-950">{estudoVisualizando.oracao_final}</p>
                </div>
              )}
            </div>

            {/* Footer Modal */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setEstudoVisualizando(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Cadastro / Edição de Estudo */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200/90 w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-5 border-b border-slate-200 bg-slate-50/70">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700">
                  <BookOpen size={16} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {estudoEditando ? 'Editar Estudo Bíblico' : 'Novo Roteiro de Estudo Bíblico'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Disponibilizado na biblioteca ministerial e associável às reuniões.
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
              {/* Título & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Título do Estudo *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.titulo}
                    onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                    placeholder="Ex: Vivendo o Amor Fraterno em Comunidade"
                    className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Status Governança *
                  </label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value as CelulaEstudoStatus })}
                    className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 bg-white cursor-pointer"
                  >
                    <option value="rascunho">Rascunho</option>
                    <option value="em_revisao">Em Revisão</option>
                    <option value="aprovado">Aprovado</option>
                    <option value="publicado">Publicado (Disponível)</option>
                    <option value="arquivado">Arquivado</option>
                  </select>
                </div>
              </div>

              {/* Tema, Série, Lição, Referências */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Série / Bloco
                  </label>
                  <input
                    type="text"
                    value={form.serie || ''}
                    onChange={(e) => setForm({ ...form, serie: e.target.value })}
                    placeholder="Ex: Fruto do Espírito"
                    className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Lição Nº
                  </label>
                  <input
                    type="number"
                    value={form.numero_licao || ''}
                    onChange={(e) => setForm({ ...form, numero_licao: e.target.value ? Number(e.target.value) : undefined })}
                    placeholder="Ex: 3"
                    className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Tema Central
                  </label>
                  <input
                    type="text"
                    value={form.tema || ''}
                    onChange={(e) => setForm({ ...form, tema: e.target.value })}
                    placeholder="Ex: Mansidão e Domínio"
                    className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Referências Bíblicas
                  </label>
                  <input
                    type="text"
                    value={form.referencias_biblicas || ''}
                    onChange={(e) => setForm({ ...form, referencias_biblicas: e.target.value })}
                    placeholder="Ex: Gálatas 5:22-26"
                    className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              {/* Vinculação a Rede / Congregação */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Rede Específica (Opcional)
                  </label>
                  <select
                    value={form.rede_id || ''}
                    onChange={(e) => setForm({ ...form, rede_id: e.target.value || null })}
                    className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl bg-white cursor-pointer"
                  >
                    <option value="">Todas as Redes (Geral do Ministério)</option>
                    {redes.map(r => (
                      <option key={r.id} value={r.id}>{r.nome}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Congregação Específica (Opcional)
                  </label>
                  <select
                    value={form.congregacao_id || ''}
                    onChange={(e) => setForm({ ...form, congregacao_id: e.target.value || null })}
                    className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl bg-white cursor-pointer"
                  >
                    <option value="">Todas as Congregações (Institucional)</option>
                    {congregacoes.map(c => (
                      <option key={c.id} value={c.id}>{c.nome}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Objetivo & Quebra-Gelo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Objetivo do Estudo
                  </label>
                  <textarea
                    rows={2}
                    value={form.objetivo || ''}
                    onChange={(e) => setForm({ ...form, objetivo: e.target.value })}
                    placeholder="Qual a transformação prática esperada na vida dos participantes?"
                    className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Dinâmica de Quebra-Gelo
                  </label>
                  <textarea
                    rows={2}
                    value={form.quebra_gelo || ''}
                    onChange={(e) => setForm({ ...form, quebra_gelo: e.target.value })}
                    placeholder="Pergunta introdutória ou dinâmica de acolhimento inicial"
                    className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              {/* Introdução & Desenvolvimento */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Introdução
                </label>
                <textarea
                  rows={2}
                  value={form.introducao || ''}
                  onChange={(e) => setForm({ ...form, introducao: e.target.value })}
                  placeholder="Contextualização inicial para o líder abrir o momento da palavra"
                  className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Desenvolvimento / Roteiro Bíblico *
                </label>
                <textarea
                  rows={5}
                  required
                  value={form.desenvolvimento}
                  onChange={(e) => setForm({ ...form, desenvolvimento: e.target.value })}
                  placeholder="Conteúdo bíblico principal com tópicos, explicações e princípios aplicáveis..."
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl font-mono text-xs leading-relaxed"
                />
              </div>

              {/* Perguntas & Aplicação Prática */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Perguntas para Discussão
                  </label>
                  <textarea
                    rows={3}
                    value={form.perguntas_discussao || ''}
                    onChange={(e) => setForm({ ...form, perguntas_discussao: e.target.value })}
                    placeholder="1. Como podemos praticar isso?&#10;2. Quais os desafios comuns?"
                    className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Aplicação Prática & Desafio Semanal
                  </label>
                  <textarea
                    rows={3}
                    value={form.aplicacao_pratica || ''}
                    onChange={(e) => setForm({ ...form, aplicacao_pratica: e.target.value })}
                    placeholder="Passo prático de fé para praticar durante os próximos dias"
                    className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              {/* Conclusão & Oração Final */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Conclusão
                  </label>
                  <textarea
                    rows={2}
                    value={form.conclusao || ''}
                    onChange={(e) => setForm({ ...form, conclusao: e.target.value })}
                    placeholder="Fechamento do líder e chamada à oração"
                    className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Motivos de Oração / Encerramento
                  </label>
                  <textarea
                    rows={2}
                    value={form.oracao_final || ''}
                    onChange={(e) => setForm({ ...form, oracao_final: e.target.value })}
                    placeholder="Direcionamentos de oração pelos membros, visitantes e alvos"
                    className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              {/* Botões do Rodapé */}
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
                      <span>{estudoEditando ? 'Atualizar Estudo' : 'Cadastrar Estudo'}</span>
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
