export const TARGET_IEADMIM_MINISTRY_ID = '52f42349-4f3f-4865-9863-8a32ac71965b';
export const EXPECTED_ORIGIN_MINISTRY_ID = '4821c293-acb7-4925-a4ca-852822f2f395';

export interface ServosRawMember {
  id: string;
  ministry_id: string;
  name: string;
  email?: string;
  phone?: string;
  cpf?: string;
  data_nascimento?: string;
  sexo?: string;
  estado_civil?: string;
  profissao?: string;
  logradouro?: string;
  complemento?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  member_since?: string;
  role?: string;
  status?: string;
  custom_fields?: string | Record<string, any>;
  observacoes?: string;
  created_at?: string;
  updated_at?: string;
  congregacao_id?: string;
  latitude?: string;
  longitude?: string;
  orgao_emissor?: string;
  data_consagracao?: string;
  data_emissao?: string;
  data_validade_credencial?: string;
  matricula?: string;
  unique_id?: string;
  tipo_cadastro?: string;
  tipo_sanguineo?: string;
  escolaridade?: string;
  nome_conjuge?: string;
  cpf_conjuge?: string;
  data_nascimento_conjuge?: string;
  nome_pai?: string;
  nome_mae?: string;
  rg?: string;
  nacionalidade?: string;
  naturalidade?: string;
  uf_naturalidade?: string;
  titulo_eleitoral?: string;
  zona_eleitoral?: string;
  secao_eleitoral?: string;
  data_batismo_aguas?: string;
  data_batismo_espirito_santo?: string;
  numero?: string;
  bairro?: string;
  celular?: string;
  whatsapp?: string;
  curso_teologico?: string;
  instituicao_teologica?: string;
  pastor_auxiliar?: string | boolean;
  procedencia?: string;
  procedencia_local?: string;
  cargo_ministerial?: string;
  dados_cargos?: string | Record<string, any>;
  tem_funcao_igreja?: string | boolean;
  qual_funcao?: string;
  setor_departamento?: string;
  observacoes_ministeriais?: string;
  foto_url?: string;
  [key: string]: any;
}

export interface ServosRowValidation {
  index: number;
  origem_id: string;
  name: string;
  cpf: string | null;
  matricula: string | null;
  cargo: string | null;
  unique_id: string;
  unique_id_gerado: boolean;
  has_foto_base64: boolean;
  foto_bytes_approx: number;
  status_cpf: 'valido' | 'ausente' | 'duplicado_arquivo' | 'ja_existe_banco';
  status_matricula: 'unica' | 'duplicada_legado' | 'ja_existe_banco';
  status_origem: 'novo' | 'ja_importado_banco';
  will_insert: boolean;
  notes: string[];
}

export interface ServosPreviewReport {
  target_ministry_id: string;
  is_target_matched: boolean;
  total_lidas: number;
  aptas_para_insercao: number;
  cpfs_ausentes: number;
  cpfs_duplicados_arquivo: number;
  cpfs_existentes_banco: number;
  matriculas_duplicadas_legado: { matricula: string; linhas: number[] }[];
  matriculas_existentes_banco: number;
  registros_ja_importados_banco: number;
  fotos_base64_detectadas: number;
  unique_ids_gerados: number;
  preview_amostra: ServosRowValidation[];
}

export interface ServosReconcilePreviewReport {
  target_ministry_id: string;
  is_target_matched: boolean;
  total_no_arquivo: number;
  ja_importados_no_banco: number;
  ministros_ausentes_count: number;
  ministros_ausentes: {
    origem_id: string;
    name: string;
    matricula: string;
    cpf: string | null;
    cargo: string | null;
    has_foto: boolean;
    conflito_matricula: boolean;
    motivo_conflito?: string;
  }[];
  fotos_ja_persistidas_count: number;
  fotos_pendentes_count: number;
  fotos_pendentes: {
    membro_id: string;
    origem_id: string;
    name: string;
    matricula: string;
    foto_bytes_approx: number;
  }[];
}

export interface ServosReconcileResult {
  ministros_inseridos: number;
  ministros_ignorados: number;
  fotos_enviadas: number;
  falhas_fotos: number;
  erros: { identificador: string; nome: string; motivo: string }[];
}

/**
 * Utilitário de parsing CSV RFC-4180 compatível com aspas e quebras de linha embutidas
 */
export function parseCSVStream(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const result: string[][] = [];
  let row: string[] = [];
  let inQuotes = false;
  let cur = '';

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      row.push(cur);
      cur = '';
    } else if ((ch === '\r' || ch === '\n') && !inQuotes) {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cur);
      cur = '';
      if (row.length > 1 || (row.length === 1 && row[0] !== '')) {
        result.push(row);
      }
      row = [];
    } else {
      cur += ch;
    }
  }
  if (cur || row.length > 0) {
    row.push(cur);
    result.push(row);
  }

  if (result.length === 0) return { headers: [], rows: [] };

  const headers = result[0].map(h => h.trim().replace(/^"|"$/g, ''));
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < result.length; i++) {
    const r = result[i];
    const item: Record<string, string> = {};
    headers.forEach((h, idx) => {
      item[h] = r[idx] !== undefined ? r[idx].trim() : '';
    });
    rows.push(item);
  }

  return { headers, rows };
}

/**
 * Gera um unique_id aleatório de 16 caracteres hexadecimais em maiúsculas (padrão Servos)
 */
export function generateServosUniqueId(): string {
  const chars = '0123456789ABCDEF';
  let out = '';
  for (let i = 0; i < 16; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

/**
 * Normaliza datas legadas para YYYY-MM-DD
 */
export function parseDateSafe(val?: string | null): string | null {
  if (!val) return null;
  const trimmed = val.trim();
  if (!trimmed) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
    const [d, m, y] = trimmed.split('/');
    return `${y}-${m}-${d}`;
  }
  try {
    const parsed = Date.parse(trimmed);
    if (!isNaN(parsed)) {
      return new Date(parsed).toISOString().split('T')[0];
    }
  } catch {
    // ignora
  }
  return null;
}

/**
 * Converte valor textual para booleano com padrão seguro
 */
export function parseBoolSafe(val?: string | boolean | null): boolean {
  if (val === true || val === false) return val;
  if (!val) return false;
  const str = String(val).toLowerCase().trim();
  return ['true', '1', 'sim', 's', 'yes', 'y'].includes(str);
}
