/* eslint-disable @next/next/no-html-link-for-pages */
'use client';

import { useEffect, useState, useRef } from 'react';
import { setOptions, importLibrary } from '@googlemaps/js-api-loader';
import type { Marcador } from '@/lib/geolocation-utils';

const DEFAULT_CENTER = {
  lat: -3.1190,
  lng: -60.0217
};

interface MapProps {
  marcadores: Marcador[];
  selectedMarker: Marcador | null;
  onMarkerClick: (marcador: Marcador) => void;
}

// Configurar opções da API do Google Maps uma única vez
let isGoogleMapsOptionsConfigured = false;
function configureGoogleMaps() {
  if (isGoogleMapsOptionsConfigured) return;
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
  if (!apiKey) return;

  setOptions({
    key: apiKey,
    v: 'weekly',
  });
  isGoogleMapsOptionsConfigured = true;
}

export default function MapaGeolizacao({ marcadores, selectedMarker, onMarkerClick }: MapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Inicializar mapa
  useEffect(() => {
    let isCancelled = false;

    const initMap = async () => {
      try {
        const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
        if (!apiKey) {
          setLoadError('Chave do Google Maps não configurada (NEXT_PUBLIC_GOOGLE_MAPS_API_KEY).');
          return;
        }

        configureGoogleMaps();

        // Carregar a biblioteca de mapas via API funcional atual
        const { Map } = (await importLibrary('maps')) as google.maps.MapsLibrary;

        if (isCancelled || !mapRef.current) return;

        // Se o mapa ainda não foi instanciado neste elemento
        if (!mapInstanceRef.current) {
          const map = new Map(mapRef.current, {
            center: DEFAULT_CENTER,
            zoom: 12,
            disableDefaultUI: false,
            zoomControl: true,
            streetViewControl: false,
            mapTypeControl: true,
            fullscreenControl: true,
            mapTypeId: 'roadmap',
          });

          mapInstanceRef.current = map;
        }

        if (!isCancelled) {
          setIsLoaded(true);
        }
      } catch (error: any) {
        console.error('Erro ao carregar Google Maps:', error);
        if (!isCancelled) {
          setLoadError(
            error?.message || 'Falha ao carregar a API do Google Maps. Verifique sua conexão e chave de API.'
          );
        }
      }
    };

    // O Google Maps dispara window.gm_authFailure quando há erro de chave, referenciador HTTP, faturamento ou API desabilitada
    (window as any).gm_authFailure = () => {
      console.error('Google Maps gm_authFailure disparado.');
      setLoadError('Erro de autenticação no Google Maps: Verifique se a "Maps JavaScript API" está habilitada no projeto Google Cloud e se as restrições de referenciador HTTP ou faturamento permitem este domínio.');
    };

    initMap();

    return () => {
      isCancelled = true;
    };
  }, []);

  // Atualizar marcadores quando mudam
  useEffect(() => {
    if (!mapInstanceRef.current || !isLoaded) return;

    const google = window.google;

    // Limpar marcadores antigos
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];

    // Fechar infoWindow anterior
    if (infoWindowRef.current) {
      infoWindowRef.current.close();
    }

    if (marcadores.length === 0) {
      return;
    }

    // Criar novos marcadores
    const bounds = new google.maps.LatLngBounds();

    marcadores.forEach((marcador) => {
      if (!marcador.latitude || !marcador.longitude) return;

      const lat = typeof marcador.latitude === 'string' 
        ? parseFloat(marcador.latitude) 
        : marcador.latitude;
      const lng = typeof marcador.longitude === 'string' 
        ? parseFloat(marcador.longitude) 
        : marcador.longitude;

      const isSelected = selectedMarker?.id === marcador.id;

      // Determinar cor e tamanho do marcador
      let markerColor = '#2563eb'; // azul padrão (membro)
      if (marcador.tipo === 'CONGREGACAO') {
        markerColor = '#d97706'; // âmbar para congregações
      }

      if (isSelected) {
        markerColor = '#dc2626'; // vermelho de destaque para o selecionado
      }

      // Criar marcador
      const marker = new google.maps.Marker({
        position: { lat, lng },
        map: mapInstanceRef.current,
        title: marcador.nome,
        zIndex: isSelected ? 999 : 1,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: isSelected ? 11 : 7.5,
          fillColor: markerColor,
          fillOpacity: isSelected ? 1 : 0.85,
          strokeColor: '#ffffff',
          strokeWeight: isSelected ? 3 : 2,
        }
      });

      // Adicionar evento de clique
      marker.addListener('click', () => {
        onMarkerClick(marcador);
      });

      markersRef.current.push(marker);
      bounds.extend({ lat, lng });
    });

    // Ajustar zoom para mostrar todos os marcadores se não houver um selecionado
    if (markersRef.current.length > 0 && !selectedMarker) {
      mapInstanceRef.current?.fitBounds(bounds);
    }
  }, [marcadores, isLoaded, onMarkerClick, selectedMarker]);

  // Mostrar InfoWindow quando selecionar marcador
  useEffect(() => {
    if (!mapInstanceRef.current || !isLoaded || !selectedMarker) return;

    const google = window.google;

    if (!selectedMarker.latitude || !selectedMarker.longitude) return;

    const lat = typeof selectedMarker.latitude === 'string' 
      ? parseFloat(selectedMarker.latitude) 
      : selectedMarker.latitude;
    const lng = typeof selectedMarker.longitude === 'string' 
      ? parseFloat(selectedMarker.longitude) 
      : selectedMarker.longitude;

    // Fechar infoWindow anterior
    if (infoWindowRef.current) {
      infoWindowRef.current.close();
    }

    const congregacaoExibicao = selectedMarker.congregacaoNome || selectedMarker.congregacaoId || '';

    // Criar conteúdo HTML moderno e institucional
    const content = `
      <div style="font-family: system-ui, -apple-system, sans-serif; padding: 12px 14px; min-width: 220px; max-width: 280px; color: #1e293b;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; gap: 8px;">
          <span style="display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; ${
            selectedMarker.tipo === 'CONGREGACAO' 
              ? 'background-color: #fef3c7; color: #92400e;' 
              : 'background-color: #dbeafe; color: #1e40af;'
          }">
            ${selectedMarker.tipo === 'CONGREGACAO' ? 'Congregação' : 'Membro'}
          </span>
          <span style="display: inline-block; padding: 2px 7px; border-radius: 9999px; font-size: 10px; font-weight: 600; ${
            selectedMarker.status === 'ativo' 
              ? 'background-color: #dcfce7; color: #166534;' 
              : 'background-color: #f1f5f9; color: #475569;'
          }">
            ${selectedMarker.status === 'ativo' ? 'Ativo' : 'Inativo'}
          </span>
        </div>

        <h4 style="font-size: 14px; font-weight: 700; color: #0f172a; margin: 0 0 6px 0; line-height: 1.3;">
          ${selectedMarker.nome}
        </h4>

        ${congregacaoExibicao ? `
          <div style="font-size: 12px; color: #475569; margin-bottom: 4px; display: flex; align-items: center; gap: 5px;">
            <span>⛪</span> <strong>${congregacaoExibicao}</strong>
          </div>
        ` : ''}

        ${selectedMarker.cidade ? `
          <div style="font-size: 11px; color: #64748b; margin-bottom: 4px; display: flex; align-items: center; gap: 5px;">
            <span>📍</span> ${selectedMarker.bairro ? `${selectedMarker.bairro}, ` : ''}${selectedMarker.cidade}
          </div>
        ` : ''}

        ${selectedMarker.celular ? `
          <div style="font-size: 11px; color: #0284c7; margin-top: 6px; display: flex; align-items: center; gap: 5px;">
            <span>📱</span> ${selectedMarker.celular}
          </div>
        ` : ''}
      </div>
    `;

    // Criar InfoWindow
    const infoWindow = new google.maps.InfoWindow({
      content: content,
      maxWidth: 320
    });

    infoWindow.open({
      anchor: new google.maps.Marker({
        position: { lat, lng },
        map: null
      }),
      map: mapInstanceRef.current,
      shouldFocus: false
    });

    infoWindowRef.current = infoWindow;

    // Suavemente centralizar o mapa no ponto selecionado
    mapInstanceRef.current.panTo({ lat, lng });
  }, [selectedMarker, isLoaded]);

  if (loadError) {
    return (
      <div className="w-full h-full min-h-[460px] flex items-center justify-center bg-slate-50 border border-slate-200 rounded-2xl p-8">
        <div className="text-center max-w-md">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center text-2xl mx-auto mb-3 shadow-xs">
            ⚠️
          </div>
          <h3 className="text-base font-bold text-slate-800 mb-1.5">Não foi possível exibir o mapa</h3>
          <p className="text-xs text-slate-600 mb-4 leading-relaxed">{loadError}</p>
          <button
            onClick={() => {
              setLoadError(null);
              setIsLoaded(false);
              isGoogleMapsOptionsConfigured = false;
            }}
            className="px-4 py-2 bg-[#123b63] hover:bg-[#0e2f50] text-white text-xs font-semibold rounded-xl transition shadow-xs"
          >
            Tentar Novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full min-h-[460px] flex flex-col">
      {!isLoaded && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-50/80 backdrop-blur-xs rounded-2xl">
          <div className="text-center text-slate-500">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#123b63] border-t-transparent mx-auto mb-2" />
            <p className="text-xs font-medium text-slate-600">Inicializando visualização geográfica...</p>
          </div>
        </div>
      )}
      <div 
        ref={mapRef} 
        className="w-full flex-1 rounded-2xl overflow-hidden shadow-xs"
      />
    </div>
  );
}
