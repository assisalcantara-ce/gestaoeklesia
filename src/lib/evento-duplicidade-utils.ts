/**
 * Utilitários para detecção e bloqueio de inscrições duplicadas em eventos
 */

export interface DuplicidadeCheckParams {
  ministryId: string;
  eventoId: string;
  memberId?: string | null;
  cpf?: string | null;
  ignoreInscricaoId?: string | null;
}

export interface DuplicidadeResult {
  duplicado: boolean;
  motivo?: 'member_id' | 'cpf';
  inscricaoExistente?: {
    id: string;
    status: string;
    nome_display?: string;
    created_at?: string;
  };
  mensagem?: string;
}

export function normalizarCpfSomenteDigitos(cpfRaw?: string | null): string {
  if (!cpfRaw || typeof cpfRaw !== 'string') return '';
  return cpfRaw.replace(/\D/g, '');
}

export function formatarStatusLegivel(status: string): string {
  switch (status) {
    case 'confirmado':
      return 'Confirmada';
    case 'aguardando_pagamento':
      return 'Aguardando Pagamento';
    case 'lista_espera':
      return 'Lista de Espera';
    case 'cancelado':
      return 'Cancelada';
    case 'expirado':
      return 'Expirada';
    default:
      return status;
  }
}
