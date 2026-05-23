'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useMemo, useCallback } from 'react';
import nextDynamic from 'next/dynamic';
import Sidebar from '@/components/Sidebar';
import { useRequireModulo } from '@/hooks/useRequireModulo';
import { buscarMembrosFiltrados, buscarCidades } from '@/lib/geolocation-utils';
import type { Membro, Marcador } from '@/lib/geolocation-utils';

// Import dinâmico — Google Maps não pode ser renderizado no servidor
const MapaGeolizacao = nextDynamic(() => import('@/components/MapaGeolizacao'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full bg-gray-50 rounded-lg">
      <div className="text-center text-gray-400">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2" />
        <p className="text-sm">Carregando mapa...</p>
      </div>
    </div>
  ),
});

const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

export default function GeolocalizacaoPage() {
  const { ctx, bloqueado } = useRequireModulo('geolocalizacao');

  const [membros, setMembros] = useState<Membro[]>([]);
  const [cidades, setCidades] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMarker, setSelectedMarker] = useState<Marcador | null>(null);
  const [filtroNome, setFiltroNome] = useState('');
  const [filtroCidade, setFiltroCidade] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const [membrosData, cidadesData] = await Promise.all([
        buscarMembrosFiltrados({
          nome: filtroNome || undefined,
          cidade: filtroCidade || undefined,
          status: filtroStatus || undefined,
        }),
        buscarCidades(),
      ]);
      setMembros(membrosData);
      setCidades(cidadesData);
    } catch {
      setMembros([]);
    } finally {
      setLoading(false);
    }
  }, [filtroNome, filtroCidade, filtroStatus]);

  useEffect(() => {
    if (ctx.loading) return;
    carregar();
  }, [ctx.loading, carregar]);

  // Limpa marcador selecionado ao re-filtrar
  useEffect(() => {
    setSelectedMarker(null);
  }, [filtroNome, filtroCidade, filtroStatus]);

  const marcadores: Marcador[] = useMemo(
    () => membros.map(m => ({ ...m, tipo: 'MEMBRO' as const })),
    [membros]
  );

  const totalLocalizados = membros.length;
  const ativos = membros.filter(m => m.status === 'ativo').length;
  const cidadesCount = new Set(membros.map(m => m.cidade).filter(Boolean)).size;

  if (bloqueado) return null;

  // Chave ausente: exibe aviso mas não quebra
  if (!GOOGLE_MAPS_KEY) {
    return (
      <div className="flex h-screen bg-gray-50">
        <Sidebar activeMenu="geolocalizacao" setActiveMenu={() => {}} />
        <main className="flex-1 flex items-center justify-center p-8">
          <div className="text-center max-w-md bg-white rounded-xl shadow p-8">
            <div className="text-5xl mb-4">🗺️</div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">Mapa indisponível</h2>
            <p className="text-gray-600 text-sm leading-relaxed">
              A variável{' '}
              <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs font-mono">
                NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
              </code>{' '}
              não está configurada. Adicione-a ao arquivo{' '}
              <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs font-mono">.env.local</code>{' '}
              para habilitar o mapa interativo.
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar activeMenu="geolocalizacao" setActiveMenu={() => {}} />

      <main className="flex-1 flex flex-col overflow-hidden">
        {/* CABEÇALHO */}
        <div className="bg-white border-b px-6 py-4 flex-shrink-0">
          <h1 className="text-xl font-bold text-gray-800">📍 Geolocalização</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Distribuição geográfica dos membros com endereço cadastrado
          </p>
        </div>

        {/* CARDS RESUMO */}
        <div className="px-6 pt-4 pb-2 grid grid-cols-3 gap-4 flex-shrink-0">
          <div className="bg-white rounded-lg border p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Com coordenadas</p>
            <p className="text-2xl font-bold text-blue-700 mt-1">
              {loading ? <span className="text-base text-gray-400">...</span> : totalLocalizados}
            </p>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Ativos localizados</p>
            <p className="text-2xl font-bold text-green-600 mt-1">
              {loading ? <span className="text-base text-gray-400">...</span> : ativos}
            </p>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Cidades</p>
            <p className="text-2xl font-bold text-purple-600 mt-1">
              {loading ? <span className="text-base text-gray-400">...</span> : cidadesCount}
            </p>
          </div>
        </div>

        {/* FILTROS */}
        <div className="px-6 pb-3 flex gap-3 flex-shrink-0 flex-wrap">
          <input
            type="text"
            placeholder="Filtrar por nome..."
            className="border rounded-lg px-3 py-1.5 text-sm flex-1 min-w-[160px] focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={filtroNome}
            onChange={e => setFiltroNome(e.target.value)}
          />
          <select
            className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={filtroCidade}
            onChange={e => setFiltroCidade(e.target.value)}
          >
            <option value="">Todas as cidades</option>
            {cidades.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select
            className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={filtroStatus}
            onChange={e => setFiltroStatus(e.target.value)}
          >
            <option value="">Todos os status</option>
            <option value="ativo">Ativos</option>
            <option value="inativo">Inativos</option>
          </select>
        </div>

        {/* CONTEÚDO PRINCIPAL: MAPA + LISTA */}
        <div className="flex-1 px-6 pb-6 flex gap-4 overflow-hidden min-h-0">
          {/* MAPA */}
          <div className="flex-1 bg-white rounded-xl border overflow-hidden">
            {loading ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center text-gray-400">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3" />
                  <p className="text-sm">Carregando membros...</p>
                </div>
              </div>
            ) : marcadores.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center max-w-xs px-6">
                  <div className="text-5xl mb-3">📍</div>
                  <p className="text-gray-700 font-medium">Nenhum membro localizado</p>
                  <p className="text-sm text-gray-400 mt-2 leading-relaxed">
                    {filtroNome || filtroCidade || filtroStatus
                      ? 'Nenhum resultado para os filtros aplicados.'
                      : 'Cadastre latitude e longitude nos membros para visualizá-los no mapa.'}
                  </p>
                </div>
              </div>
            ) : (
              <MapaGeolizacao
                marcadores={marcadores}
                selectedMarker={selectedMarker}
                onMarkerClick={setSelectedMarker}
              />
            )}
          </div>

          {/* LISTA LATERAL */}
          <div className="w-72 flex flex-col bg-white rounded-xl border overflow-hidden flex-shrink-0">
            <div className="p-3 border-b bg-gray-50 flex-shrink-0">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                Membros localizados
                {!loading && <span className="ml-1 text-gray-400">({marcadores.length})</span>}
              </p>
            </div>
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="p-4 text-center text-gray-400 text-sm">Carregando...</div>
              ) : marcadores.length === 0 ? (
                <div className="p-6 text-center text-gray-400 text-sm">Nenhum resultado</div>
              ) : (
                marcadores.map(m => (
                  <button
                    key={m.id}
                    onClick={() => setSelectedMarker(prev => prev?.id === m.id ? null : m)}
                    className={`w-full text-left px-4 py-3 border-b transition hover:bg-blue-50 ${
                      selectedMarker?.id === m.id
                        ? 'bg-blue-50 border-l-2 border-l-blue-600'
                        : 'border-l-2 border-l-transparent'
                    }`}
                  >
                    <p className="font-medium text-sm text-gray-800 truncate">{m.nome}</p>
                    <p className="text-xs text-gray-500 truncate mt-0.5">
                      {m.cidade || 'Cidade não informada'}
                    </p>
                    <span className={`inline-block mt-1 text-xs px-1.5 py-0.5 rounded ${
                      m.status === 'ativo'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {m.status === 'ativo' ? 'Ativo' : 'Inativo'}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
