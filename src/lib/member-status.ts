/**
 * Utilidades para normalização e validação de status de membros.
 *
 * Garante compatibilidade estrita com a constraint do PostgreSQL:
 * CONSTRAINT members_status_check CHECK (status IN ('active', 'inactive', 'deceased', 'transferred'))
 */

export type MemberDbStatus = 'active' | 'inactive' | 'deceased' | 'transferred';
export type MemberUiStatus = 'ativo' | 'inativo';

export const ALLOWED_MEMBER_STATUSES: readonly MemberDbStatus[] = [
  'active',
  'inactive',
  'deceased',
  'transferred',
] as const;

/**
 * Normaliza qualquer representação de status (UI em português, inglês, maiúsculas/minúsculas, acentuados)
 * para um dos valores canônicos aceitos pelo banco de dados: 'active', 'inactive', 'deceased', 'transferred'.
 *
 * @param status - Valor de status recebido (string, null, undefined)
 * @param fallbackToDefaultOnEmpty - Se true, valores nulos/vazios retornam 'active'. Se false, retornam null.
 * @returns MemberDbStatus válido ou null se for um valor inválido/desconhecido.
 */
export function normalizeMemberStatus(
  status: unknown,
  fallbackToDefaultOnEmpty: boolean = true
): MemberDbStatus | null {
  if (status === undefined || status === null || status === '') {
    return fallbackToDefaultOnEmpty ? 'active' : null;
  }

  const s = String(status)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  // 1. Mapeamentos para 'active'
  if (
    s === 'active' ||
    s === 'ativo' ||
    s === 'ativo no rol' ||
    s === 'ativo_no_rol'
  ) {
    return 'active';
  }

  // 2. Mapeamentos para 'inactive'
  if (
    s === 'inactive' ||
    s === 'inativo' ||
    s === 'inativo no rol' ||
    s === 'inativo_no_rol' ||
    s === 'desligado' ||
    s === 'inativado' ||
    s === 'excluido'
  ) {
    return 'inactive';
  }

  // 3. Mapeamentos para 'deceased'
  if (
    s === 'deceased' ||
    s === 'falecido' ||
    s === 'obito' ||
    s === 'falecimento' ||
    s === 'morto'
  ) {
    return 'deceased';
  }

  // 4. Mapeamentos para 'transferred'
  if (
    s === 'transferred' ||
    s === 'transferido' ||
    s === 'transferencia' ||
    s === 'transferido_para_outra_igreja'
  ) {
    return 'transferred';
  }

  return null;
}

/**
 * Verifica se um status fornecido é válido (reconhecido).
 */
export function isValidMemberStatus(status: unknown): boolean {
  return normalizeMemberStatus(status, false) !== null;
}

/**
 * Converte o status do banco de dados ('active', 'inactive', 'deceased', 'transferred')
 * para a representação de UI operacional ('ativo' ou 'inativo').
 */
export function dbStatusToUi(status: unknown): MemberUiStatus {
  const normalized = normalizeMemberStatus(status, true);
  return normalized === 'active' ? 'ativo' : 'inativo';
}

/**
 * Converte status da UI ('ativo', 'inativo') ou qualquer variante para o status canônico do banco.
 */
export function uiStatusToDb(status: unknown): MemberDbStatus {
  return normalizeMemberStatus(status, true) ?? 'active';
}
