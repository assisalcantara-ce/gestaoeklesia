'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useMemo, useCallback } from 'react';
import nextDynamic from 'next/dynamic';
import { useRequireModulo } from '@/hooks/useRequireModulo';
import { buscarMembrosFiltrados, buscarCidades, listarCongregacoesFiltro } from '@/lib/geolocation-utils';
import type { Membro, Marcador } from '@/lib/geolocation-utils';
import { normalizeSearchTerm } from '@/lib/search-normalizer';

// Import dinâmico — Google Maps não pode ser renderizado no servidor
const MapaGeolizacao = nextDynamic(() => import('@/components/MapaGeolizacao'), {
  ssr: false,
  loading: () => (
    <div className="flex flex-col items-center justify-center h-full min-h-[460px] bg-slate-50/70 rounded-2xl border border-slate-100">
      <div className="w-10 h-10 rounded-2xl bg-white shadow-xs border border-slate-200/80 flex items-center justify-center mb-3">
        <div className="animate-spin rounded-full h-5 w-5 border-2 border-[#123b63] border-t-transparent" />
      </div>
      <p className="text-xs font-semibold text-slate-700">Carregando mapa interativo...</p>
      <p className="text-[11px] text-slate-400 mt-0.5">Preparando coordenadas geográficas</p>
    </div>
  ),
});

const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

export default function GeolocalizacaoPage() {
  const { ctx, bloqueado } = useRequireModulo('geolocalizacao');

  const [membros, setMembros] = useState<Membro[]>([]);
  const [cidades, setCidades] = useState<string[]>([]);
  const [congregacoes, setCongregacoes] = useState<{ id: string; nome: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMarker, setSelectedMarker] = useState<Marcador | null>(null);

  // Estados dos Filtros
  const [inputNome, setInputNome] = useState('');
  const [filtroNomeDebounced, setFiltroNomeDebounced] = useState('');
  const [filtroCongregacao, setFiltroCongregacao] = useState('');
  const [filtroCidade, setFiltroCidade] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');

  // Busca rápida interna na lista lateral
  const [buscaRapidaLateral, setBuscaRapidaLateral] = useState('');

  // Debounce para busca por nome (mínimo 3 caracteres ou vazio para limpar)
  useEffect(() => {
    const timer = setTimeout(() => {
      const trimmed = inputNome.trim();
      if (trimmed.length >= 3 || trimmed.length === 0) {
        setFiltroNomeDebounced(trimmed);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [inputNome]);

  // Carregar congregações do ministério (respeitando se operador tem congregação fixa)
  useEffect(() => {
    if (ctx.loading) return;
    async function carregarListaCongregacoes() {
      const lista = await listarCongregacoesFiltro();
      if (ctx.nivel === 'operador' && ctx.congregacaoId) {
        setCongregacoes(lista.filter(c => c.id === ctx.congregacaoId));
      } else {
        setCongregacoes(lista);
      }
    }
    carregarListaCongregacoes();
  }, [ctx.loading, ctx.nivel, ctx.congregacaoId]);

  // Carregar dados de membros e cidades
  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const extraFilters: any = {};
      // Operador restrito à sua própria congregação
      if (ctx.nivel === 'operador' && ctx.congregacaoId) {
        extraFilters.congregacao = ctx.congregacaoId;
      } else if (filtroCongregacao) {
        extraFilters.congregacao = filtroCongregacao;
      }

      const [membrosData, cidadesData] = await Promise.all([
        buscarMembrosFiltrados({
          nome: filtroNomeDebounced || undefined,
          cidade: filtroCidade || undefined,
          status: filtroStatus || undefined,
          ...extraFilters,
        }),
        buscarCidades(),
      ]);

      setMembros(membrosData);

      if (ctx.nivel === 'operador' && ctx.congregacaoId) {
        const uniqueCities = Array.from(new Set(membrosData.map(m => m.cidade).filter(Boolean))) as string[];
        setCidades(uniqueCities.sort());
      } else {
        setCidades(cidadesData);
      }
    } catch {
      setMembros([]);
    } finally {
      setLoading(false);
    }
  }, [filtroNomeDebounced, filtroCongregacao, filtroCidade, filtroStatus, ctx.nivel, ctx.congregacaoId]);

  useEffect(() => {
    if (ctx.loading) return;
    carregar();
  }, [ctx.loading, carregar]);

  // Limpa marcador selecionado se a lista mudar e ele não estiver mais nela
  useEffect(() => {
    if (selectedMarker && !membros.some(m => m.id === selectedMarker.id)) {
      setSelectedMarker(null);
    }
  }, [membros, selectedMarker]);

  // Marcadores no formato adequado
  const marcadores: Marcador[] = useMemo(
    () => membros.map(m => ({ ...m, tipo: 'MEMBRO' as const })),
    [membros]
  );

  // Filtragem da lista lateral (busca instantânea em memória sobre os dados já carregados)
  const membrosFiltradosLateral = useMemo(() => {
    if (!buscaRapidaLateral.trim()) return marcadores;
    const term = normalizeSearchTerm(buscaRapidaLateral);
    return marcadores.filter(m => {
      const nomeNorm = normalizeSearchTerm(m.nome);
      const cidadeNorm = normalizeSearchTerm(m.cidade);
      const congNorm = normalizeSearchTerm(m.congregacaoNome);
      return nomeNorm.includes(term) || cidadeNorm.includes(term) || congNorm.includes(term);
    });
  }, [marcadores, buscaRapidaLateral]);

  // Indicadores
  const totalLocalizados = membros.length;
  const ativosCount = membros.filter(m => m.status === 'ativo').length;
  const inativosCount = totalLocalizados - ativosCount;
  const cidadesCount = new Set(membros.map(m => m.cidade).filter(Boolean)).size;

  const temFiltroAtivo = Boolean(
    inputNome || filtroCongregacao || filtroCidade || filtroStatus
  );

  const limparFiltros = () => {
    setInputNome('');
    setFiltroNomeDebounced('');
    setFiltroCongregacao('');
    setFiltroCidade('');
    setFiltroStatus('');
    setBuscaRapidaLateral('');
    setSelectedMarker(null);
  };

  if (bloqueado) return null;

  // Chave ausente: exibe aviso estilizado e claro
  if (!GOOGLE_MAPS_KEY) {
    return (
      <main className="flex-1 flex items-center justify-center p-6 bg-slate-50">
        <div className="text-center max-w-lg bg-white rounded-3xl shadow-xl border border-slate-200/80 p-8 sm:p-10">
          <div className="w-16 h-16 rounded-3xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center text-3xl mx-auto mb-4">
            🗺️
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Google Maps Não Configurado</h2>
          <p className="text-slate-600 text-sm leading-relaxed mb-6">
            A variável pública <code className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-mono text-xs font-semibold">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> não foi detectada no ambiente.
          </p>
          <div className="text-left bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs text-slate-600 space-y-2">
            <p className="font-semibold text-slate-700">Para ativar o módulo:</p>
            <p>1. Adicione a chave ao arquivo <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200">.env.local</code></p>
            <p>2. Na Vercel, cadastre a mesma variável em <strong>Environment Variables</strong></p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50/50">
      {/* 1. CABEÇALHO INSTITUCIONAL */}
      <div className="bg-white border-b border-slate-200/80 px-6 py-4 flex-shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="flex items-center justify-center w-8 h-8 rounded-xl bg-blue-50 text-blue-600 text-lg border border-blue-100 shadow-2xs">
                📍
              </span>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">Geolocalização Ministerial</h1>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Mapeamento territorial e distribuição geográfica de membros e congregados
            </p>
          </div>

          {/* Tag de Status de sincronização */}
          <div className="flex items-center gap-2 self-start sm:self-center">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              API Maps Ativa
            </span>
          </div>
        </div>
      </div>

      {/* ÁREA DE CONTEÚDO ROLÁVEL OU FLUIDA */}
      <div className="flex-1 flex flex-col overflow-hidden px-4 sm:px-6 py-4 space-y-4">
        {/* 2. CARDS DE INDICADORES MODERNOS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 flex-shrink-0">
          {/* Card 1: Total Mapeados */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 shadow-2xs flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center text-lg shrink-0">
              👥
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider truncate">Mapeados</p>
              <p className="text-xl font-bold text-slate-900">
                {loading ? <span className="text-slate-300 text-base">...</span> : totalLocalizados}
              </p>
            </div>
          </div>

          {/* Card 2: Ativos */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 shadow-2xs flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center text-lg shrink-0">
              ✅
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider truncate">Ativos</p>
              <p className="text-xl font-bold text-emerald-700">
                {loading ? <span className="text-slate-300 text-base">...</span> : ativosCount}
              </p>
            </div>
          </div>

          {/* Card 3: Inativos */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 shadow-2xs flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 border border-slate-200 flex items-center justify-center text-lg shrink-0">
              ⏸️
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider truncate">Inativos</p>
              <p className="text-xl font-bold text-slate-700">
                {loading ? <span className="text-slate-300 text-base">...</span> : inativosCount}
              </p>
            </div>
          </div>

          {/* Card 4: Cidades */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 shadow-2xs flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 border border-purple-100 flex items-center justify-center text-lg shrink-0">
              🏙️
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider truncate">Cidades</p>
              <p className="text-xl font-bold text-purple-700">
                {loading ? <span className="text-slate-300 text-base">...</span> : cidadesCount}
              </p>
            </div>
          </div>
        </div>

        {/* 3. BARRA DE FILTROS ORGANIZADA */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-3 shadow-2xs flex-shrink-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5 items-center">
            {/* Input Nome (debounce >= 3 letras) */}
            <div className="lg:col-span-4 relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 text-xs">
                🔍
              </span>
              <input
                type="text"
                placeholder="Buscar por nome (min. 3 letras)..."
                value={inputNome}
                onChange={e => setInputNome(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50/70 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition placeholder:text-slate-400 text-slate-800"
              />
              {inputNome && (
                <button
                  onClick={() => setInputNome('')}
                  className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600 text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Select Congregação */}
            <div className="lg:col-span-3">
              <select
                value={filtroCongregacao}
                onChange={e => setFiltroCongregacao(e.target.value)}
                disabled={ctx.nivel === 'operador' && Boolean(ctx.congregacaoId)}
                className="w-full px-3 py-1.5 text-xs bg-slate-50/70 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition text-slate-700 disabled:opacity-60"
              >
                <option value="">Todas as congregações</option>
                {congregacoes.map(c => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </div>

            {/* Select Cidade */}
            <div className="lg:col-span-2">
              <select
                value={filtroCidade}
                onChange={e => setFiltroCidade(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-slate-50/70 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition text-slate-700"
              >
                <option value="">Todas as cidades</option>
                {cidades.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Select Situação Cadastral */}
            <div className="lg:col-span-2">
              <select
                value={filtroStatus}
                onChange={e => setFiltroStatus(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-slate-50/70 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition text-slate-700"
              >
                <option value="">Todos os status</option>
                <option value="ativo">Ativos</option>
                <option value="inativo">Inativos</option>
              </select>
            </div>

            {/* Botão Limpar Filtros */}
            <div className="lg:col-span-1 flex justify-end">
              <button
                onClick={limparFiltros}
                disabled={!temFiltroAtivo}
                className="w-full sm:w-auto px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 text-slate-600 bg-white hover:bg-slate-50 active:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-2xs whitespace-nowrap"
                title="Limpar todos os filtros"
              >
                Limpar
              </button>
            </div>
          </div>
        </div>

        {/* 4. ÁREA PRINCIPAL: MAPA + PAINEL LATERAL (ALTURA RIGOROSAMENTE ALINHADA) */}
        <div className="flex-1 flex flex-col lg:flex-row gap-4 min-h-0 overflow-hidden pb-2">
          {/* MAPA CONTAINER */}
          <div className="flex-1 bg-white rounded-3xl border border-slate-200/90 overflow-hidden shadow-xs flex flex-col relative min-h-[460px] lg:min-h-0">
            {loading ? (
              <div className="h-full flex items-center justify-center p-8">
                <div className="text-center text-slate-400">
                  <div className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-[#123b63] border-t-transparent" />
                  </div>
                  <p className="text-xs font-semibold text-slate-700">Consultando membros mapeados...</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Sincronizando com filtros selecionados</p>
                </div>
              </div>
            ) : marcadores.length === 0 ? (
              <div className="h-full flex items-center justify-center p-8">
                <div className="text-center max-w-sm">
                  <div className="w-14 h-14 rounded-3xl bg-slate-100 text-slate-400 flex items-center justify-center text-2xl mx-auto mb-3 shadow-2xs">
                    📍
                  </div>
                  <h3 className="text-sm font-bold text-slate-800">Nenhum membro localizado</h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    {temFiltroAtivo
                      ? 'Nenhum registro correspondeu aos filtros aplicados. Tente ajustar os parâmetros ou clicar em Limpar.'
                      : 'Nenhum membro possui coordenadas (latitude e longitude) cadastradas no sistema.'}
                  </p>
                  {temFiltroAtivo && (
                    <button
                      onClick={limparFiltros}
                      className="mt-3 px-3 py-1.5 text-xs font-semibold bg-[#123b63] hover:bg-[#0e2f50] text-white rounded-xl shadow-xs transition"
                    >
                      Limpar Filtros
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="w-full h-full flex flex-col relative">
                <MapaGeolizacao
                  marcadores={marcadores}
                  selectedMarker={selectedMarker}
                  onMarkerClick={setSelectedMarker}
                />

                {/* Card Flutuante de Detalhes do Membro Selecionado (quando houver seleção no mapa ou na lista) */}
                {selectedMarker && (
                  <div className="absolute bottom-4 left-4 right-4 sm:right-auto sm:max-w-md z-20 bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200/90 p-4 shadow-xl animate-in fade-in slide-in-from-bottom-2 duration-200">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-blue-100/70 text-blue-700 flex items-center justify-center font-bold text-sm shrink-0">
                          {selectedMarker.nome.charAt(0)}
                        </div>
                        <div>
                          <h4 className="font-bold text-sm text-slate-900 leading-tight">
                            {selectedMarker.nome}
                          </h4>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {selectedMarker.congregacaoNome ? `⛪ ${selectedMarker.congregacaoNome}` : 'Sem congregação vinculada'}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => setSelectedMarker(null)}
                        className="text-slate-400 hover:text-slate-600 text-sm p-1 rounded-lg hover:bg-slate-100 transition"
                        title="Fechar detalhes"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider block">Cidade/Bairro</span>
                        <span className="text-slate-700 font-medium truncate block">
                          {selectedMarker.cidade ? `${selectedMarker.bairro ? `${selectedMarker.bairro}, ` : ''}${selectedMarker.cidade}` : 'Não informado'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider block">Situação</span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          selectedMarker.status === 'ativo' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
                        }`}>
                          {selectedMarker.status === 'ativo' ? 'Ativo' : 'Inativo'}
                        </span>
                      </div>
                      {selectedMarker.celular && (
                        <div className="col-span-2 pt-1 text-slate-600 flex items-center gap-1.5">
                          <span>📱</span> <span className="font-mono text-[11px]">{selectedMarker.celular}</span>
                        </div>
                      )}
                      {selectedMarker.logradouro && (
                        <div className="col-span-2 text-slate-500 text-[11px] truncate">
                          📍 {selectedMarker.logradouro}{selectedMarker.numero ? `, nº ${selectedMarker.numero}` : ''}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* PAINEL LATERAL DE MEMBROS (W-80 / ROLAGEM PRÓPRIA SEM ESTIRAR) */}
          <div className="w-full lg:w-80 bg-white rounded-3xl border border-slate-200/90 shadow-xs flex flex-col overflow-hidden shrink-0 h-[420px] lg:h-auto">
            {/* Header do painel */}
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/70 shrink-0">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                  Lista de Membros
                </span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-100/80 text-blue-800">
                  {membrosFiltradosLateral.length}
                </span>
              </div>

              {/* Campo de busca rápida na lista lateral */}
              <div className="mt-2 relative">
                <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400 text-xs">
                  🔎
                </span>
                <input
                  type="text"
                  placeholder="Filtrar nesta lista..."
                  value={buscaRapidaLateral}
                  onChange={e => setBuscaRapidaLateral(e.target.value)}
                  className="w-full pl-7 pr-2.5 py-1 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-700 placeholder:text-slate-400"
                />
                {buscaRapidaLateral && (
                  <button
                    onClick={() => setBuscaRapidaLateral('')}
                    className="absolute inset-y-0 right-0 pr-2 flex items-center text-slate-400 hover:text-slate-600 text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* Lista rolável interna de membros */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-1">
              {loading ? (
                <div className="p-6 text-center text-slate-400 text-xs">
                  Carregando lista...
                </div>
              ) : membrosFiltradosLateral.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-xs leading-relaxed">
                  Nenhum membro encontrado na visualização atual.
                </div>
              ) : (
                membrosFiltradosLateral.map(m => {
                  const isSelected = selectedMarker?.id === m.id;
                  return (
                    <button
                      key={m.id}
                      onClick={() => setSelectedMarker(prev => prev?.id === m.id ? null : m)}
                      className={`w-full text-left p-3 rounded-2xl transition-all duration-150 relative ${
                        isSelected
                          ? 'bg-blue-50/80 border-blue-200 shadow-2xs'
                          : 'hover:bg-slate-50 border border-transparent'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className={`font-semibold text-xs truncate ${isSelected ? 'text-blue-900 font-bold' : 'text-slate-800'}`}>
                          {m.nome}
                        </p>
                        <span className={`shrink-0 px-1.5 py-0.5 rounded-full text-[9px] font-semibold uppercase ${
                          m.status === 'ativo'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          {m.status === 'ativo' ? 'Ativo' : 'Inativo'}
                        </span>
                      </div>

                      <div className="mt-1 space-y-0.5">
                        {m.congregacaoNome && (
                          <p className="text-[11px] text-slate-600 truncate flex items-center gap-1">
                            <span>⛪</span> {m.congregacaoNome}
                          </p>
                        )}
                        <p className="text-[10px] text-slate-400 truncate flex items-center gap-1">
                          <span>📍</span> {m.cidade || 'Cidade não informada'}
                        </p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

