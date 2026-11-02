// Lista padrão de cargos ministeriais nativos para fallback
export const CARGOS_MINISTERIAIS_PADRAO = [
  'Auxiliar',
  'Obreiro(a)',
  'Diácono',
  'Diaconisa',
  'Presbítero',
  'Missionário(a)',
  'Evangelista',
  'Pastor'
];

export type FiltroFuncaoMinisterial = 'todos' | 'ministros' | 'dirigentes';

export interface FuncaoMinisterialPredicadoItem {
  id?: string | null;
  name?: string | null;
  nome?: string | null;
  cpf?: string | null;
  matricula?: string | null;
  tipoCadastro?: string | null;
  tipo_cadastro?: string | null;
  role?: string | null;
  cargoMinisterial?: string | null;
  cargo_ministerial?: string | null;
}

export interface DirigenteVinculoRef {
  member_id?: string | null;
  cpf?: string | null;
  matricula?: string | null;
  nome?: string | null;
}

/**
 * Normaliza CPF removendo caracteres não numéricos.
 */
export function normalizarCpfDigits(cpf?: string | null): string {
  if (!cpf) return '';
  return cpf.replace(/\D/g, '');
}

/**
 * Normaliza strings para comparação case/accent insensitive.
 */
export function normalizarTexto(txt?: string | null): string {
  if (!txt) return '';
  return txt
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Verifica se um membro/aniversariante é reconhecido como MINISTRO no sistema.
 * Critérios:
 * 1. tipoCadastro / tipo_cadastro === 'ministro'
 * 2. role === 'ministro'
 * 3. Possui cargo_ministerial / cargoMinisterial ativo e compatível (diferente de membro/congregado/vazio)
 */
export function isMembroMinistro(
  item: FuncaoMinisterialPredicadoItem,
  cargosAtivosNomes?: string[]
): boolean {
  if (!item) return false;

  const tc = normalizarTexto(item.tipoCadastro || item.tipo_cadastro);
  if (tc === 'ministro' || tc.includes('ministro')) {
    return true;
  }

  const role = normalizarTexto(item.role);
  if (role === 'ministro') {
    return true;
  }

  const cargo = normalizarTexto(item.cargoMinisterial || item.cargo_ministerial);
  if (!cargo || cargo === 'membro' || cargo === 'congregado' || cargo === 'crianca' || cargo === 'visitante') {
    return false;
  }

  // Se foram fornecidos cargos ativos oficiais (ou fallback para lista padrão)
  const listaCargos = cargosAtivosNomes && cargosAtivosNomes.length > 0
    ? cargosAtivosNomes.map(normalizarTexto)
    : CARGOS_MINISTERIAIS_PADRAO.map(normalizarTexto);

  if (listaCargos.includes(cargo)) {
    return true;
  }

  // Termos reconhecidos tradicionalmente
  const termosReconhecidos = [
    'pastor', 'pastora', 'presbitero', 'evangelista', 'missionario', 'missionaria',
    'diacono', 'diaconisa', 'obreiro', 'obreira', 'auxiliar', 'ministro', 'ministra', 'bispo'
  ];

  return termosReconhecidos.some(t => cargo.includes(t));
}

/**
 * Verifica se um membro/aniversariante é DIRIGENTE de congregação.
 * Critérios de correspondência estritos baseados nos vínculos oficiais de direção:
 * 1. member_id idêntico
 * 2. CPF normalizado idêntico (quando disponível e com 11 dígitos)
 * 3. Matrícula idêntica (quando disponível)
 * 4. Nome normalizado idêntico (caso cadastrado sem id/cpf)
 */
export function isMembroDirigente(
  item: FuncaoMinisterialPredicadoItem,
  dirigentesMap: {
    memberIds: Set<string>;
    cpfs: Set<string>;
    matriculas: Set<string>;
    nomes: Set<string>;
  }
): boolean {
  if (!item || !dirigentesMap) return false;

  // 1. Por ID do membro
  if (item.id && dirigentesMap.memberIds.has(item.id)) {
    return true;
  }

  // 2. Por CPF normalizado
  const cpfNorm = normalizarCpfDigits(item.cpf);
  if (cpfNorm && cpfNorm.length === 11 && dirigentesMap.cpfs.has(cpfNorm)) {
    return true;
  }

  // 3. Por Matrícula
  const matNorm = normalizarTexto(item.matricula);
  if (matNorm && dirigentesMap.matriculas.has(matNorm)) {
    return true;
  }

  // 4. Por Nome exato normalizado
  const nomeNorm = normalizarTexto(item.name || item.nome);
  if (nomeNorm && dirigentesMap.nomes.has(nomeNorm)) {
    return true;
  }

  return false;
}

/**
 * Constrói conjunto otimizado de busca a partir dos vínculos oficiais de congregações
 * e de designações de dirigentes.
 */
export function extrairMapaDirigentes(
  designacoes: any[] = [],
  congregacoes: any[] = []
): {
  memberIds: Set<string>;
  cpfs: Set<string>;
  matriculas: Set<string>;
  nomes: Set<string>;
} {
  const memberIds = new Set<string>();
  const cpfs = new Set<string>();
  const matriculas = new Set<string>();
  const nomes = new Set<string>();

  // 1. De designações oficiais ativas
  designacoes.forEach((d) => {
    if (!d) return;
    const status = String(d.status || 'ativo').toLowerCase();
    if (status !== 'ativo') return;

    if (d.member_id) memberIds.add(String(d.member_id));

    const c = normalizarCpfDigits(d.cpf_dirigente || d.cpf);
    if (c.length === 11) cpfs.add(c);

    const m = normalizarTexto(d.matricula_dirigente || d.matricula);
    if (m) matriculas.add(m);

    const n = normalizarTexto(d.nome_dirigente || d.nome);
    if (n) nomes.add(n);
  });

  // 2. Da tabela oficial de congregações ativas
  congregacoes.forEach((c) => {
    if (!c) return;
    if (c.is_active === false) return;

    if (c.dirigente_member_id) memberIds.add(String(c.dirigente_member_id));

    const cpf = normalizarCpfDigits(c.dirigente_cpf);
    if (cpf.length === 11) cpfs.add(cpf);

    const mat = normalizarTexto(c.dirigente_matricula);
    if (mat) matriculas.add(mat);

    const nome = normalizarTexto(c.dirigente);
    if (nome) nomes.add(nome);
  });

  return { memberIds, cpfs, matriculas, nomes };
}

/**
 * Avalia se o item atende ao filtro de função ministerial selecionado:
 * - 'todos': Aceita todos os membros
 * - 'ministros': Apenas ministros cadastrados
 * - 'dirigentes': Somente dirigentes oficiais
 */
export function filtrarPorFuncaoMinisterial<T extends FuncaoMinisterialPredicadoItem>(
  item: T,
  filtro: FiltroFuncaoMinisterial,
  dirigentesMap: {
    memberIds: Set<string>;
    cpfs: Set<string>;
    matriculas: Set<string>;
    nomes: Set<string>;
  },
  cargosAtivosNomes?: string[]
): boolean {
  if (filtro === 'todos') {
    return true;
  }
  if (filtro === 'ministros') {
    return isMembroMinistro(item, cargosAtivosNomes);
  }
  if (filtro === 'dirigentes') {
    return isMembroDirigente(item, dirigentesMap);
  }
  return true;
}

export const INSTITUTIONAL_TIMEZONE = 'America/Belem';

/**
 * Obtém a data corrente 'YYYY-MM-DD' no fuso horário do ministério (America/Belem).
 */
export function getHojeLocalBelem(refDate: Date = new Date()): {
  dataStr: string;
  dia: number;
  mes: number;
  ano: number;
} {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: INSTITUTIONAL_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const dataStr = formatter.format(refDate); // YYYY-MM-DD
  const [ano, mes, dia] = dataStr.split('-').map((v) => parseInt(v, 10));
  return { dataStr, dia, mes, ano };
}

/**
 * Extrai dia e mês de uma data de nascimento nos formatos aceitos (YYYY-MM-DD, DD/MM/YYYY, etc).
 */
export function extrairDiaMesNascimento(dataNascimento?: string | null): {
  dia: number;
  mes: number;
} | null {
  if (!dataNascimento || typeof dataNascimento !== 'string') return null;
  const raw = dataNascimento.trim();
  if (!raw) return null;

  let dia = 0;
  let mes = 0;

  if (raw.includes('-')) {
    const parts = raw.split('T')[0].split('-');
    if (parts.length >= 3) {
      mes = parseInt(parts[1], 10);
      dia = parseInt(parts[2], 10);
    }
  } else if (raw.includes('/')) {
    const parts = raw.split('/');
    if (parts.length >= 2) {
      dia = parseInt(parts[0], 10);
      mes = parseInt(parts[1], 10);
    }
  }

  if (isNaN(dia) || isNaN(mes) || dia < 1 || dia > 31 || mes < 1 || mes > 12) {
    return null;
  }

  return { dia, mes };
}

/**
 * Verifica se a data de nascimento do membro coincide estritamente com o dia e mês de hoje
 * no fuso horário institucional (America/Belem).
 */
export function isAniversarianteHoje(
  dataNascimento?: string | null,
  refDate: Date = new Date()
): boolean {
  const bday = extrairDiaMesNascimento(dataNascimento);
  if (!bday) return false;

  const hoje = getHojeLocalBelem(refDate);
  return bday.dia === hoje.dia && bday.mes === hoje.mes;
}

