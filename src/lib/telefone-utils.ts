import { formatPhone, onlyDigits } from './mascaras';

export interface PhoneNormalizationResult {
  valid: boolean;
  raw: string;
  digits: string;
  formatted: string;
  ddd?: string;
  isMobile?: boolean;
  ambiguous?: boolean;
  error?: string;
}

// Lista oficial de DDDs válidos no Brasil (Anatel)
export const VALID_DDDS = new Set([
  '11', '12', '13', '14', '15', '16', '17', '18', '19',
  '21', '22', '24', '27', '28',
  '31', '32', '33', '34', '35', '37', '38',
  '41', '42', '43', '44', '45', '46', '47', '48', '49',
  '51', '53', '54', '55',
  '61', '62', '63', '64', '65', '66', '67', '68', '69',
  '71', '73', '74', '75', '77', '79',
  '81', '82', '83', '84', '85', '86', '87', '88', '89',
  '91', '92', '93', '94', '95', '96', '97', '98', '99',
]);

/**
 * Normaliza um número de telefone brasileiro para o formato padrão do Gestão Eklésia.
 * - Remove espaços, parênteses, traços e caracteres não numéricos
 * - Trata prefixo internacional +55 (e 0055)
 * - Trata zeros à esquerda
 * - Rejeita números com DDD ausente (8 ou 9 dígitos sem contexto de DDD)
 * - Rejeita DDDs que não existem no Brasil
 * - Distingue celular (11 dígitos, 9º dígito 9) e fixo (10 dígitos)
 */
export function normalizeBrazilianPhone(rawPhone?: string | null): PhoneNormalizationResult {
  if (!rawPhone || typeof rawPhone !== 'string') {
    return {
      valid: false,
      raw: '',
      digits: '',
      formatted: '',
      error: 'Telefone não informado.',
    };
  }

  const rawTrimmed = rawPhone.trim();
  let digits = onlyDigits(rawTrimmed);

  if (!digits) {
    return {
      valid: false,
      raw: rawTrimmed,
      digits: '',
      formatted: '',
      error: 'Nenhum dígito encontrado no telefone.',
    };
  }

  // 1. Remover prefixo internacional de saída 0055 se fornecido
  if (digits.startsWith('0055') && digits.length >= 12) {
    digits = digits.slice(4);
  }

  // 2. Remover DDI +55 se fornecido
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    digits = digits.slice(2);
  }

  // 3. Remover zeros à esquerda (ex: 011987654321 ou 0011...)
  while (digits.startsWith('0') && digits.length > 10) {
    digits = digits.slice(1);
  }

  // 4. Verificação de tamanho (DDD ausente vs DDD presente)
  if (digits.length === 8 || digits.length === 9) {
    return {
      valid: false,
      raw: rawTrimmed,
      digits,
      formatted: '',
      ambiguous: true,
      error: 'DDD ausente. Por favor, informe o número com DDD (ex: 11 98765-4321).',
    };
  }

  if (digits.length < 10 || digits.length > 11) {
    return {
      valid: false,
      raw: rawTrimmed,
      digits,
      formatted: '',
      error: 'Número de telefone incompleto ou inválido. Deve conter DDD + número (10 ou 11 dígitos).',
    };
  }

  // 5. Validar DDD
  const ddd = digits.slice(0, 2);
  if (!VALID_DDDS.has(ddd)) {
    return {
      valid: false,
      raw: rawTrimmed,
      digits,
      formatted: '',
      ddd,
      error: `DDD ${ddd} não é um código de área brasileiro válido.`,
    };
  }

  // 6. Diferenciação Fixo / Celular
  const isMobile = digits.length === 11;
  const numParte = digits.slice(2);

  // Celulares no Brasil com DDD têm 11 dígitos e começam com dígito 9
  if (isMobile && !numParte.startsWith('9')) {
    return {
      valid: false,
      raw: rawTrimmed,
      digits,
      formatted: '',
      ddd,
      isMobile: true,
      error: 'Celular com 11 dígitos no Brasil deve iniciar com o dígito 9.',
    };
  }

  // Telefones fixos têm 10 dígitos e começam com dígitos 2, 3, 4 ou 5
  if (!isMobile && !['2', '3', '4', '5'].includes(numParte.charAt(0))) {
    // Pode ser celular antigo sem nono dígito (8 dígitos após DDD)
    // Conforme especificação: não remover nem inferir nono dígito indiscriminadamente
    return {
      valid: false,
      raw: rawTrimmed,
      digits,
      formatted: '',
      ddd,
      isMobile: false,
      ambiguous: true,
      error: 'Número de telefone fixo ou celular com formato ambíguo. Para celular, inclua o 9 inicial.',
    };
  }

  const formatted = formatPhone(digits);

  return {
    valid: true,
    raw: rawTrimmed,
    digits,
    formatted,
    ddd,
    isMobile,
  };
}

/**
 * Retorna as variantes de busca comuns para encontrar um telefone no banco:
 * 1. Formato formatado com parênteses: (11) 98765-4321
 * 2. Somente dígitos nacionais: 11987654321
 * 3. Com DDI +55: +5511987654321 ou 5511987654321
 */
export function getPhoneSearchVariants(normalizedDigits: string): string[] {
  const clean = onlyDigits(normalizedDigits);
  if (clean.length < 10 || clean.length > 11) {
    return [];
  }

  const formatted = formatPhone(clean);
  const withDdi = `55${clean}`;
  const withPlusDdi = `+55${clean}`;

  const set = new Set([formatted, clean, withDdi, withPlusDdi]);
  return Array.from(set);
}
