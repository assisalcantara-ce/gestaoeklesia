/**
 * Utilitários centralizados de busca e normalização fonética/acentuação
 * para buscas dinâmicas em todo o Gestão Eklésia.
 *
 * Suporta:
 * 1. Normalização no Frontend: remover acentos, cedilha, diacríticos e caixa alta/baixa.
 * 2. Normalização no Backend / PostgREST: geração de Regex compatível com PostgreSQL (`imatch`)
 *    que faz 'antonio' encontrar 'Antônio', 'joao' encontrar 'João', 'conceicao' encontrar 'Conceição', etc.
 * 3. Filtragem em memória (Arrays locais) com insensibilidade a acentos.
 */

// Mapa de caracteres acentuados comuns em português e espanhol
const ACCENT_MAP: Record<string, string> = {
  a: '[aàáâãäåā]',
  e: '[eèéêëē]',
  i: '[iìíîïī]',
  o: '[oòóôõöō]',
  u: '[uùúûüū]',
  c: '[cç]',
  n: '[nñ]',
};

/**
 * Remove acentos, cedilha e diacríticos de uma string e converte para minúsculas.
 * Exemplo: "Conceição de Maria" -> "conceicao de maria"
 */
export function normalizeSearchTerm(str?: string | null): string {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Constrói uma expressão regular para uso no PostgreSQL via PostgREST `imatch`
 * que é insensível a acentos, cedilhas e maiúsculas/minúsculas.
 *
 * Exemplo:
 *  - "antonio" -> "[aàáâãäåā]nt[oòóôõöō]n[iìíîïī][oòóôõöō]"
 *  - "conceicao" -> "[cç][oòóôõöō]n[cç][eèéêëē][iìíîïī][cç][aàáâãäåā][oòóôõöō]"
 *  - "joao silva" -> "j[oòóôõöō][aàáâãäåā][oòóôõöō].*s[iìíîïī]lv[aàáâãäåā]"
 */
export function buildAccentInsensitiveRegex(term?: string | null): string {
  if (!term) return '';

  const clean = normalizeSearchTerm(term);
  if (!clean) return '';

  // Quebrar em palavras e mapear cada caractere para sua classe regex de acentos
  const words = clean.split(/\s+/).filter(Boolean);

  const wordPatterns = words.map((word) => {
    return word
      .split('')
      .map((char) => {
        if (ACCENT_MAP[char]) {
          return ACCENT_MAP[char];
        }
        // Escapar caracteres especiais de regex
        if (/[.*+?^${}()|[\]\\]/.test(char)) {
          return '\\' + char;
        }
        return char;
      })
      .join('');
  });

  // Se houver múltiplas palavras, permite qualquer espaçamento ou palavras intermediárias
  return wordPatterns.join('.*');
}

/**
 * Constrói uma cláusula PostgREST `.or(...)` para buscar membros por nome, CPF e matrícula
 * com correspondência fonética/acentuação insensível no nome.
 *
 * Exemplo de retorno:
 *  `name.imatch.[aàáâãäåā]nt[oòóôõöō]n[iìíîïī][oòóôõöō],cpf.ilike.%antonio%,matricula.ilike.%antonio%`
 */
export function buildMemberSearchOrFilter(
  searchTerm?: string | null,
  options: { includeCpf?: boolean; includeMatricula?: boolean; nameOnly?: boolean } = {}
): string | null {
  if (!searchTerm) return null;

  const sanitized = searchTerm.replace(/[,()]/g, '').trim();
  if (!sanitized) return null;

  const regex = buildAccentInsensitiveRegex(sanitized);
  if (!regex) return null;

  if (options.nameOnly) {
    return `name.imatch.${regex}`;
  }

  const clauses = [`name.imatch.${regex}`];

  if (options.includeCpf !== false) {
    // Sanitiza dígitos caso seja busca por CPF
    const digitsOnly = sanitized.replace(/\D/g, '');
    if (digitsOnly.length >= 3) {
      clauses.push(`cpf.ilike.%${digitsOnly}%`);
    } else {
      clauses.push(`cpf.ilike.%${sanitized}%`);
    }
  }

  if (options.includeMatricula !== false) {
    clauses.push(`matricula.ilike.%${sanitized}%`);
  }

  return clauses.join(',');
}

/**
 * Compara se um texto alvo contém o termo de busca, ignorando acentos, cedilha e maiúsculas/minúsculas.
 * Útil para filtros em listas na memória do frontend.
 *
 * Exemplo:
 *  includesNormalized("Antônio Silva", "antonio") === true
 *  includesNormalized("Conceição", "conceicao") === true
 */
export function includesNormalized(target?: string | null, search?: string | null): boolean {
  if (!target || !search) return false;
  const normTarget = normalizeSearchTerm(target);
  const normSearch = normalizeSearchTerm(search);
  return normTarget.includes(normSearch);
}
