/* eslint-disable @next/next/no-html-link-for-pages */
'use client';

import { useEffect, useState, useRef } from 'react';
import { Loader } from '@googlemaps/js-api-loader';
import { MapPin, Phone, Mail, MapMarked } from 'lucide-react';
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

const loader = new Loader({
  apiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
  version: 'weekly'
});

export default function MapaGeolizacao({ marcadores, selectedMarker, onMarkerClick }: MapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Inicializar mapa
  useEffect(() => {
    const initMap = async () => {
      try {
        await loader.load();

        if (!mapRef.current) return;

        const google = window.google;

        // Criar mapa
        const map = new google.maps.Map(mapRef.current, {
          center: DEFAULT_CENTER,
          zoom: 12,
          disableDefaultUI: false,
          zoomControl: true,
          streetViewControl: false,
          mapTypeControl: true,
          fullscreenControl: true,
          mapTypeId: google.maps.MapTypeId.ROADMAP
        });

        mapInstanceRef.current = map;
        setIsLoaded(true);
      } catch (error) {
        console.error('Erro ao carregar Google Maps:', error);
      }
    };

    initMap();
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

      // Determinar cor do marcador
      let markerColor = '#3366ff'; // azul padrão
      if (marcador.tipo === 'CONGREGACAO') {
        markerColor = '#ff8800'; // laranja para congregações
      }

      // Criar marcador
      const marker = new google.maps.Marker({
        position: { lat, lng },
        map: mapInstanceRef.current,
        title: marcador.nome,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: markerColor,
          fillOpacity: 0.8,
          strokeColor: '#ffffff',
          strokeWeight: 2
        }
      });

      // Adicionar evento de clique
      marker.addListener('click', () => {
        onMarkerClick(marcador);
      });

      markersRef.current.push(marker);
      bounds.extend({ lat, lng });
    });

    // Ajustar zoom para mostrar todos os marcadores
    if (markersRef.current.length > 0) {
      mapInstanceRef.current?.fitBounds(bounds);
    }
  }, [marcadores, isLoaded, onMarkerClick]);

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

    // Criar conteúdo HTML
    const content = `
      <div class="p-3 max-w-xs bg-white rounded-lg">
        <h3 class="font-bold text-gray-900 mb-2">${selectedMarker.nome}</h3>
        <div class="space-y-2 text-sm">
          <div class="flex items-center gap-2">
            <span class="inline-block px-2 py-1 rounded text-xs font-semibold ${
              selectedMarker.tipo === 'CONGREGACAO' 
                ? 'bg-orange-100 text-orange-800' 
                : 'bg-blue-100 text-blue-800'
            }">
              ${selectedMarker.tipo === 'CONGREGACAO' ? 'Congregação' : 'Membro'}
            </span>
          </div>
          ${selectedMarker.logradouro ? `<p class="text-gray-600"><strong>Endereço:</strong> ${selectedMarker.logradouro}${selectedMarker.numero ? ', ' + selectedMarker.numero : ''}</p>` : ''}
          ${selectedMarker.bairro ? `<p class="text-gray-600"><strong>Bairro:</strong> ${selectedMarker.bairro}</p>` : ''}
          ${selectedMarker.cidade ? `<p class="text-gray-600"><strong>Cidade:</strong> ${selectedMarker.cidade}</p>` : ''}
          ${selectedMarker.congregacao ? `<p class="text-gray-600"><strong>Congregação:</strong> ${selectedMarker.congregacao}</p>` : ''}
          <p class="text-gray-600"><strong>Status:</strong> <span class="px-2 py-1 rounded text-xs font-semibold ${
            selectedMarker.status === 'ativo' 
              ? 'bg-green-100 text-green-800' 
              : 'bg-gray-100 text-gray-800'
          }">${selectedMarker.status === 'ativo' ? 'Ativo' : 'Inativo'}</span></p>
          ${selectedMarker.celular ? `<p class="text-gray-700 flex items-center gap-2"><span class="text-teal-600">📱</span> ${selectedMarker.celular}</p>` : ''}
          ${selectedMarker.email ? `<p class="text-gray-700 flex items-center gap-2"><span class="text-teal-600">✉️</span> ${selectedMarker.email}</p>` : ''}
        </div>
      </div>
    `;

    // Criar InfoWindow
    const infoWindow = new google.maps.InfoWindow({
      content: content,
      maxWidth: 300
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
  }, [selectedMarker, isLoaded]);

  return (
    <div 
      ref={mapRef} 
      className="w-full h-96"
      style={{ minHeight: '600px' }}
    />
  );
}
