'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import Sidebar from '@/components/Sidebar';
import NotificationModal from '@/components/NotificationModal';
import { 
  buscarMembrosFiltrados, 
  buscarCongregacoes, 
  buscarCidades,
  gerarKML,
  type Membro,
  type Marcador
} from '@/lib/geolocation-utils';
import { MapPin, Filter, Download, Printer, Users, Building2, MapMarked } from 'lucide-react';

// Importar o mapa dinamicamente para evitar erros no servidor
const DynamicMap = dynamic(
  () => import('@/components/MapaGeolizacao'),
  { 
    loading: () => (
      <div className="flex items-center justify-center h-96 bg-gray-100 rounded-lg">
        <div className="text-center">
          <MapPin className="w-12 h-12 text-teal-500 mx-auto mb-4 animate-pulse" />
          <p className="text-gray-600">Carregando mapa...</p>
        </div>
      </div>
    ),
    ssr: false 
  }
);

export default function GeolocationPage() {
  const [activeMenu, setActiveMenu] = useState('geolocalizacao');
  const [modal, setModal] = useState({ isOpen: false, message: '', type: 'info' as 'success' | 'error' | 'info' });

  // Estados de filtros
  const [filtroNome, setFiltroNome] = useState('');
  const [filtroCidade, setFiltroCidade] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('ativo');
  const [filtroTipo, setFiltroTipo] = useState('TODOS');
  
  // Estados de dados
  const [membros, setMembros] = useState<Membro[]>([]);
  const [congregacoes, setCongregacoes] = useState<any[]>([]);
  const [cidades, setCidades] = useState<string[]>([]);
  const [marcadores, setMarcadores] = useState<Marcador[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMarker, setSelectedMarker] = useState<Marcador | null>(null);

  // Buscar dados iniciais
  useEffect(() => {
    const carregarDados = async () => {
      try {
        setLoading(true);
        
        // Buscar membros, congregações e cidades
        const [membrosBuscados, congregacoesBuscadas, cidadesBuscadas] = await Promise.all([
          buscarMembrosFiltrados({ status: 'ativo' }),
          buscarCongregacoes(),
          buscarCidades()
        ]);

        setMembros(membrosBuscados);
        setCongregacoes(congregacoesBuscadas);
        setCidades(cidadesBuscadas);

        // Processar marcadores iniciais
        const marcadoresIniciais: Marcador[] = [
          ...membrosBuscados.map(m => ({
            ...m,
            tipo: 'MEMBRO' as const
          })),
          ...congregacoesBuscadas.map(c => ({
            ...c,
            tipo: 'CONGREGACAO' as const,
            status: c.status || 'ativo'
          }))
        ];

        setMarcadores(marcadoresIniciais);
      } catch (error) {
        console.error('Erro ao carregar dados:', error);
        setModal({
          isOpen: true,
          message: 'Erro ao carregar dados de geolocalização',
          type: 'error'
        });
      } finally {
        setLoading(false);
      }
    };

    carregarDados();
  }, []);

  // Aplicar filtros
  useEffect(() => {
    let marcadoresFiltrados: Marcador[] = [...membros.map(m => ({
      ...m,
      tipo: 'MEMBRO' as const
    }))];

    // Adicionar congregações
    marcadoresFiltrados = [
      ...marcadoresFiltrados,
      ...congregacoes.map(c => ({
        ...c,
        tipo: 'CONGREGACAO' as const,
        status: c.status || 'ativo'
      }))
    ];

    // Aplicar filtros
    marcadoresFiltrados = marcadoresFiltrados.filter(m => {
      const matchNome = filtroNome === '' || m.nome.toLowerCase().includes(filtroNome.toLowerCase());
      const matchCidade = filtroCidade === '' || m.cidade === filtroCidade;
      const matchStatus = m.status === filtroStatus;
      const matchTipo = filtroTipo === 'TODOS' || m.tipo === filtroTipo;
      
      return matchNome && matchCidade && matchStatus && matchTipo && m.latitude && m.longitude;
    });

    setMarcadores(marcadoresFiltrados);
  }, [filtroNome, filtroCidade, filtroStatus, filtroTipo, membros, congregacoes]);

  // Calcular estatísticas
  const totalMembros = marcadores.filter(m => m.tipo === 'MEMBRO').length;
  const totalCongregacoes = marcadores.filter(m => m.tipo === 'CONGREGACAO').length;
  const totalAtivos = marcadores.filter(m => m.status === 'ativo').length;

  // Exportar para KML
  const handleExportarKML = useCallback(() => {
    if (marcadores.length === 0) {
      setModal({
        isOpen: true,
        message: 'Nenhum marcador para exportar!',
        type: 'info'
      });
      return;
    }

    try {
      const kmlContent = gerarKML(marcadores);
      const blob = new Blob([kmlContent], { type: 'application/vnd.google-earth.kml+xml' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      const dataHora = new Date().toISOString().replace(/:/g, '-').split('.')[0];
      link.download = `eclesial-geoloc-${dataHora}.kml`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setModal({
        isOpen: true,
        message: `Arquivo KML exportado com sucesso! ${marcadores.length} marcador(es)`,
        type: 'success'
      });
    } catch (error) {
      console.error('Erro ao exportar KML:', error);
      setModal({
        isOpen: true,
        message: 'Erro ao exportar arquivo KML',
        type: 'error'
      });
    }
  }, [marcadores]);

  // Imprimir mapa
  const handleImprimirMapa = useCallback(() => {
    window.print();
  }, []);

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar activeMenu={activeMenu} setActiveMenu={setActiveMenu} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-8 py-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <MapPin className="w-8 h-8 text-teal-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Geolocalização</h1>
                <p className="text-gray-600 text-sm">Visualize membros e congregações no mapa</p>
              </div>
            </div>
          </div>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-auto p-8">
          {/* Cards de Resumo */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 no-print">
            <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-blue-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Membros</p>
                  <p className="text-2xl font-bold text-blue-600">{totalMembros}</p>
                </div>
                <Users className="w-8 h-8 text-blue-500" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-orange-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Congregações</p>
                  <p className="text-2xl font-bold text-orange-600">{totalCongregacoes}</p>
                </div>
                <Building2 className="w-8 h-8 text-orange-500" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-green-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Ativos</p>
                  <p className="text-2xl font-bold text-green-600">{totalAtivos}</p>
                </div>
                <MapMarked className="w-8 h-8 text-green-500" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-teal-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total no Mapa</p>
                  <p className="text-2xl font-bold text-teal-600">{marcadores.length}</p>
                </div>
                <MapPin className="w-8 h-8 text-teal-500" />
              </div>
            </div>
          </div>

          {/* Filtros */}
          <div className="bg-white rounded-lg shadow-sm p-4 mb-6 no-print">
            <div className="flex items-center gap-2 mb-4">
              <Filter className="w-5 h-5 text-teal-600" />
              <h3 className="text-lg font-semibold text-gray-800">Filtros</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 uppercase">Nome</label>
                <input
                  type="text"
                  value={filtroNome}
                  onChange={(e) => setFiltroNome(e.target.value)}
                  placeholder="Buscar por nome..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 uppercase">Cidade</label>
                <select
                  value={filtroCidade}
                  onChange={(e) => setFiltroCidade(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-white"
                >
                  <option value="">Todas as cidades</option>
                  {cidades.map(cidade => (
                    <option key={cidade} value={cidade}>{cidade}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 uppercase">Status</label>
                <select
                  value={filtroStatus}
                  onChange={(e) => setFiltroStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-white"
                >
                  <option value="ativo">Ativo</option>
                  <option value="inativo">Inativo</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 uppercase">Tipo</label>
                <select
                  value={filtroTipo}
                  onChange={(e) => setFiltroTipo(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-white"
                >
                  <option value="TODOS">Todos</option>
                  <option value="MEMBRO">Membros</option>
                  <option value="CONGREGACAO">Congregações</option>
                </select>
              </div>

              <div className="flex items-end gap-2">
                <button
                  onClick={handleExportarKML}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  title="Exportar para Google Earth"
                >
                  <Download className="w-4 h-4" />
                  <span className="hidden sm:inline">KML</span>
                </button>
                <button
                  onClick={handleImprimirMapa}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
                  title="Imprimir mapa"
                >
                  <Printer className="w-4 h-4" />
                  <span className="hidden sm:inline">Imprimir</span>
                </button>
              </div>
            </div>
          </div>

          {/* Mapa */}
          <div className="bg-white rounded-lg shadow-sm overflow-hidden print-map">
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-teal-600" />
                <h3 className="text-lg font-semibold text-gray-800">Mapa de Geolocalização</h3>
              </div>
              <span className="text-sm font-medium text-gray-600">
                {marcadores.length} marcador{marcadores.length !== 1 ? 'es' : ''}
              </span>
            </div>

            {loading ? (
              <div className="flex items-center justify-center h-96 bg-gray-100">
                <div className="text-center">
                  <MapPin className="w-12 h-12 text-teal-500 mx-auto mb-4 animate-pulse" />
                  <p className="text-gray-600">Carregando dados...</p>
                </div>
              </div>
            ) : (
              <DynamicMap 
                marcadores={marcadores}
                selectedMarker={selectedMarker}
                onMarkerClick={setSelectedMarker}
              />
            )}
          </div>

          {/* Legenda */}
          <div className="bg-white rounded-lg shadow-sm p-4 mt-6 no-print">
            <h4 className="font-semibold text-gray-800 mb-3">Legenda dos Marcadores</h4>
            <div className="flex flex-wrap gap-6">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-blue-500 rounded-full"></div>
                <span className="text-sm text-gray-700">Membros</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-orange-500 rounded-full"></div>
                <span className="text-sm text-gray-700">Congregações</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-green-500 rounded-full"></div>
                <span className="text-sm text-gray-700">Status Ativo</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-gray-400 rounded-full"></div>
                <span className="text-sm text-gray-700">Status Inativo</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <NotificationModal
        isOpen={modal.isOpen}
        onClose={() => setModal({ ...modal, isOpen: false })}
        message={modal.message}
        type={modal.type}
      />

      <style jsx global>{`
        @media print {
          .no-print {
            display: none !important;
          }
          body * {
            visibility: hidden;
          }
          .print-map, .print-map * {
            visibility: visible;
          }
          .print-map {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
