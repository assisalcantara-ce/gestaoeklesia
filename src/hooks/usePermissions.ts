/**
 * Hook/utilitarios para permissoes de acesso baseado no nivel do usuario.
 *
 * A matriz canonica fica em src/lib/access-control.ts para ser reutilizada
 * tanto no browser quanto nas APIs server-side.
 */

import {
  MODULOS_ACESSO,
  MODULOS_ESCRITA,
  temAcesso,
  type NivelAcesso,
} from '@/lib/access-control';

export type { NivelAcesso } from '@/lib/access-control';
export { temAcesso, temAcessoEscrita } from '@/lib/access-control';

export function getModulosAcessiveis(nivel: NivelAcesso): string[] {
  return MODULOS_ACESSO[nivel] ?? [];
}

export function getModulosEditaveis(nivel: NivelAcesso): string[] {
  return MODULOS_ESCRITA[nivel] ?? [];
}

export function isAdmin(nivel: NivelAcesso): boolean {
  return nivel === 'administrador';
}

export function isSupervisor(nivel: NivelAcesso): boolean {
  return nivel === 'supervisor';
}

export function isOperador(nivel: NivelAcesso): boolean {
  return nivel === 'operador';
}

export function isFinanceiro(nivel: NivelAcesso): boolean {
  return nivel === 'financeiro' || nivel === 'tesouraria_local' || nivel === 'financeiro_local';
}

export function isSuperintendente(nivel: NivelAcesso): boolean {
  return nivel === 'superintendente_ebd' || nivel === 'superintendente';
}

export function isCoordenador(nivel: NivelAcesso): boolean {
  return nivel === 'coordenador_ebd' || nivel === 'coordenador';
}

export function podeAcessarSecretaria(nivel: NivelAcesso): boolean {
  return temAcesso(nivel, 'secretaria');
}

export function podeAcessarEBD(nivel: NivelAcesso): boolean {
  return temAcesso(nivel, 'ebd');
}

export function podeAcessarFinanceiro(nivel: NivelAcesso): boolean {
  return temAcesso(nivel, 'financeiro');
}

export function filtrarCongregacoes(
  nivel: NivelAcesso,
  congregacoes: Array<{ id: string; nome: string; supervisao?: string }>,
  congregacaoUsuario?: string,
  supervisaoUsuario?: string
): typeof congregacoes {
  if (nivel === 'administrador' || nivel === 'financeiro') {
    return congregacoes;
  }

  if (nivel === 'supervisor' && supervisaoUsuario) {
    return congregacoes.filter(c => c.supervisao === supervisaoUsuario);
  }

  if (['secretaria_local', 'tesouraria_local', 'coordenador_ebd', 'operador', 'admin_local', 'financeiro_local', 'coordenador'].includes(nivel) && congregacaoUsuario) {
    return congregacoes.filter(c => c.nome === congregacaoUsuario || c.id === congregacaoUsuario);
  }

  return [];
}
