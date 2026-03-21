import { createClient } from '@supabase/supabase-js';

// Inicializar cliente Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface Membro {
  id: string;
  nome: string;
  email?: string;
  celular?: string;
  logradouro?: string;
  numero?: string;
  bairro?: string;
  cidade?: string;
  latitude?: string | number;
  longitude?: string | number;
  status: 'ativo' | 'inativo';
  tipoCadastro: 'membro' | 'congregado' | 'ministro' | 'crianca';
  congregacao?: string;
  supervisao?: string;
  fotoUrl?: string;
}

export interface Marcador extends Membro {
  tipo: 'MEMBRO' | 'CONGREGACAO';
}

/**
 * Buscar todos os membros com geolocalização
 */
export async function buscarMembrosComGeolocalizacao(): Promise<Membro[]> {
  try {
    // Buscar membros diretamente da tabela (simulado com dados locais)
    // No banco real, seria uma query SELECT
    return [];
  } catch (error) {
    console.error('Erro ao buscar membros:', error);
    throw error;
  }
}

/**
 * Buscar membros filtrados por critérios
 */
export async function buscarMembrosFiltrados(filtros: {
  nome?: string;
  cidade?: string;
  status?: string;
  tipoCadastro?: string;
  congregacao?: string;
}): Promise<Membro[]> {
  try {
    // Implementar filtros
    let query = supabase
      .from('membros')
      .select('*');

    if (filtros.nome) {
      query = query.ilike('nome', `%${filtros.nome}%`);
    }

    if (filtros.cidade) {
      query = query.eq('cidade', filtros.cidade);
    }

    if (filtros.status) {
      query = query.eq('status', filtros.status);
    }

    if (filtros.tipoCadastro) {
      query = query.eq('tipoCadastro', filtros.tipoCadastro);
    }

    if (filtros.congregacao) {
      query = query.eq('congregacao', filtros.congregacao);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Erro ao buscar membros:', error);
      throw error;
    }

    // Filtrar apenas membros com latitude e longitude
    return (data || []).filter(m => m.latitude && m.longitude);
  } catch (error) {
    console.error('Erro ao buscar membros filtrados:', error);
    throw error;
  }
}

/**
 * Buscar congregações com geolocalização
 */
export async function buscarCongregacoes(): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('congregacoes')
      .select('*')
      .not('latitude', 'is', null)
      .not('longitude', 'is', null);

    if (error) {
      console.error('Erro ao buscar congregações:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Erro ao buscar congregações:', error);
    throw error;
  }
}

/**
 * Buscar cidades únicas de membros
 */
export async function buscarCidades(): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('membros')
      .select('cidade')
      .not('latitude', 'is', null)
      .not('longitude', 'is', null);

    if (error) {
      console.error('Erro ao buscar cidades:', error);
      throw error;
    }

    const cidades = [...new Set((data || [])
      .map(m => m.cidade)
      .filter(Boolean))];

    return cidades.sort();
  } catch (error) {
    console.error('Erro ao buscar cidades:', error);
    throw error;
  }
}

/**
 * Atualizar coordenadas de um membro
 */
export async function atualizarCoordenadas(
  membroId: string,
  latitude: number,
  longitude: number
): Promise<void> {
  try {
    const { error } = await supabase
      .from('membros')
      .update({
        latitude: latitude.toString(),
        longitude: longitude.toString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', membroId);

    if (error) {
      console.error('Erro ao atualizar coordenadas:', error);
      throw error;
    }
  } catch (error) {
    console.error('Erro ao atualizar coordenadas:', error);
    throw error;
  }
}

/**
 * Exportar marcadores para KML (Google Earth)
 */
export function gerarKML(marcadores: Marcador[]): string {
  let kmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Gestão Eclesial - Geolocalizacão</name>
    <description>Exportação de Membros e Congregações</description>
    
    <!-- Estilos para Membros -->
    <Style id="membro">
      <IconStyle>
        <color>ff3366ff</color>
        <scale>1.1</scale>
        <Icon>
          <href>http://maps.google.com/mapfiles/ms/icons/blue-dot.png</href>
        </Icon>
      </IconStyle>
    </Style>
    
    <!-- Estilos para Congregações -->
    <Style id="congregacao">
      <IconStyle>
        <color>ffff6600</color>
        <scale>1.3</scale>
        <Icon>
          <href>http://maps.google.com/mapfiles/ms/icons/orange-dot.png</href>
        </Icon>
      </IconStyle>
    </Style>
    
    <Folder>
      <name>Marcadores</name>
`;

  // Adicionar cada marcador
  marcadores.forEach(marcador => {
    if (marcador.latitude && marcador.longitude) {
      const lat = typeof marcador.latitude === 'string' 
        ? parseFloat(marcador.latitude) 
        : marcador.latitude;
      const lng = typeof marcador.longitude === 'string' 
        ? parseFloat(marcador.longitude) 
        : marcador.longitude;

      kmlContent += `
      <Placemark>
        <name>${marcador.nome}</name>
        <description><![CDATA[
          <b>Tipo:</b> ${marcador.tipo}<br/>
          ${marcador.logradouro ? `<b>Endereço:</b> ${marcador.logradouro}, ${marcador.numero}<br/>` : ''}
          ${marcador.bairro ? `<b>Bairro:</b> ${marcador.bairro}<br/>` : ''}
          ${marcador.cidade ? `<b>Cidade:</b> ${marcador.cidade}<br/>` : ''}
          <b>Status:</b> ${marcador.status}<br/>
          ${marcador.celular ? `<b>Celular:</b> ${marcador.celular}<br/>` : ''}
          ${marcador.email ? `<b>Email:</b> ${marcador.email}<br/>` : ''}
          ${marcador.congregacao ? `<b>Congregação:</b> ${marcador.congregacao}<br/>` : ''}
        ]]></description>
        <styleUrl>#${marcador.tipo === 'CONGREGACAO' ? 'congregacao' : 'membro'}</styleUrl>
        <Point>
          <coordinates>${lng},${lat},0</coordinates>
        </Point>
      </Placemark>`;
    }
  });

  kmlContent += `
    </Folder>
  </Document>
</kml>`;

  return kmlContent;
}
