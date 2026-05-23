import { createClient } from '@/lib/supabase-client'

/** Normaliza status do banco ('active'/'inactive') para o formato da interface ('ativo'/'inativo') */
function normalizeStatus(status: string | null | undefined): 'ativo' | 'inativo' {
  return status === 'active' ? 'ativo' : 'inativo'
}

/** Normaliza tipo_cadastro para o formato esperado */
function normalizeTipoCadastro(tipo: string | null | undefined): 'membro' | 'congregado' | 'ministro' | 'crianca' {
  if (tipo === 'congregado') return 'congregado'
  if (tipo === 'ministro') return 'ministro'
  if (tipo === 'crianca') return 'crianca'
  return 'membro'
}

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
 * Usa createClient (anon key) — respeita RLS e ministry_id automaticamente
 */
export async function buscarMembrosComGeolocalizacao(): Promise<Membro[]> {
  const supabase = createClient()
  try {
    const { data, error } = await supabase
      .from('members')
      .select('id, name, email, phone, celular, latitude, longitude, cidade, logradouro, bairro, numero, status, tipo_cadastro, congregacao_id')
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      .order('name', { ascending: true })

    if (error) {
      console.error('Erro ao buscar membros com geolocalização:', error)
      return []
    }

    return (data || []).map((row: any): Membro => ({
      id: row.id,
      nome: row.name ?? '',
      email: row.email ?? undefined,
      celular: row.celular || row.phone || undefined,
      logradouro: row.logradouro ?? undefined,
      numero: row.numero ?? undefined,
      bairro: row.bairro ?? undefined,
      cidade: row.cidade ?? undefined,
      latitude: row.latitude ?? undefined,
      longitude: row.longitude ?? undefined,
      status: normalizeStatus(row.status),
      tipoCadastro: normalizeTipoCadastro(row.tipo_cadastro),
      congregacao: row.congregacao_id ?? undefined,
    }))
  } catch (error) {
    console.error('Erro ao buscar membros com geolocalização:', error)
    return []
  }
}

/**
 * Buscar membros filtrados por critérios
 * Usa createClient (anon key) — respeita RLS e ministry_id automaticamente
 */
export async function buscarMembrosFiltrados(filtros: {
  nome?: string;
  cidade?: string;
  status?: string;
  tipoCadastro?: string;
  congregacao?: string;
}): Promise<Membro[]> {
  const supabase = createClient()
  try {
    let query = supabase
      .from('members')
      .select('id, name, email, phone, celular, latitude, longitude, cidade, logradouro, bairro, numero, status, tipo_cadastro, congregacao_id')
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)

    if (filtros.nome) {
      query = query.ilike('name', `%${filtros.nome}%`)
    }
    if (filtros.cidade) {
      query = query.ilike('cidade', `%${filtros.cidade}%`)
    }
    if (filtros.status) {
      // Aceita 'ativo'/'inativo' (UI) e 'active'/'inactive' (banco)
      const dbStatus = filtros.status === 'ativo' ? 'active'
        : filtros.status === 'inativo' ? 'inactive'
        : filtros.status
      query = query.eq('status', dbStatus)
    }
    if (filtros.tipoCadastro) {
      query = query.eq('tipo_cadastro', filtros.tipoCadastro)
    }
    if (filtros.congregacao) {
      query = query.eq('congregacao_id', filtros.congregacao)
    }

    const { data, error } = await query.order('name', { ascending: true })

    if (error) {
      console.error('Erro ao buscar membros filtrados:', error)
      return []
    }

    return (data || []).map((row: any): Membro => ({
      id: row.id,
      nome: row.name ?? '',
      email: row.email ?? undefined,
      celular: row.celular || row.phone || undefined,
      logradouro: row.logradouro ?? undefined,
      numero: row.numero ?? undefined,
      bairro: row.bairro ?? undefined,
      cidade: row.cidade ?? undefined,
      latitude: row.latitude ?? undefined,
      longitude: row.longitude ?? undefined,
      status: normalizeStatus(row.status),
      tipoCadastro: normalizeTipoCadastro(row.tipo_cadastro),
      congregacao: row.congregacao_id ?? undefined,
    }))
  } catch (error) {
    console.error('Erro ao buscar membros filtrados:', error)
    return []
  }
}

/**
 * Buscar congregações com geolocalização
 */
export async function buscarCongregacoes(): Promise<any[]> {
  const supabase = createClient()
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
 * Buscar cidades únicas de membros com coordenadas
 */
export async function buscarCidades(): Promise<string[]> {
  const supabase = createClient()
  try {
    const { data, error } = await supabase
      .from('members')
      .select('cidade')
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      .not('cidade', 'is', null)

    if (error) {
      console.error('Erro ao buscar cidades:', error)
      return []
    }

    const raw: string[] = (data || []).map((m: any) => m.cidade as string).filter((c: string | null) => Boolean(c))
    const cidades: string[] = Array.from(new Set(raw))

    return cidades.sort()
  } catch (error) {
    console.error('Erro ao buscar cidades:', error)
    return []
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
  const supabase = createClient()
  try {
    const { error } = await supabase
      .from('members')
      .update({ latitude, longitude, updated_at: new Date().toISOString() })
      .eq('id', membroId)

    if (error) {
      console.error('Erro ao atualizar coordenadas:', error)
      throw error
    }
  } catch (error) {
    console.error('Erro ao atualizar coordenadas:', error)
    throw error
  }
}

/**
 * Exportar marcadores para KML (Google Earth)
 */
export function gerarKML(marcadores: Marcador[]): string {
  let kmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>GESTÃO EKLESIA - Geolocalização</name>
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
