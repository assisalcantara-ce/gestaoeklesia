/**
 * Hook para gerenciar permissões de acesso baseado no nível do usuário
 *
 * Hierarquia:
 *   administrador  → acesso total ao ministry
 *   financeiro     → dashboard (visão financeira) + módulo financeiro geral
 *   supervisor     → dashboard (visão operador) + secretaria da sua supervisão
 *   admin_local    → dashboard (visão operador) + secretaria da sua congregação
 *   financeiro_local → dashboard (visão operador) + financeiro da sua congregação
 *   superintendente → EBD geral
 *   coordenador    → EBD local
 *   operador       → secretaria da sua congregação (legado)
 */

export type NivelAcesso =
  | 'administrador'
  | 'financeiro'
  | 'supervisor'
  | 'admin_local'
  | 'financeiro_local'
  | 'superintendente'
  | 'coordenador'
  | 'operador';

// Quais módulos cada nível pode ACESSAR (leitura)
const MODULOS_ACESSO: Record<NivelAcesso, string[]> = {
  // Tenant admin: acesso total
  administrador: [
    'secretaria',
    'financeiro',
    'ebd',
    'usuarios',
    'configuracoes',
    'auditoria',
    'dashboard',
    'eventos',
    'reunioes',
    'missoes',
    'patrimonio',
    'geolocalizacao',
    'comissao',
    'gestao',
  ],
  // Financeiro geral: dashboard financeiro + módulo financeiro de todo o ministry
  financeiro: [
    'dashboard',
    'financeiro',
    'tesouraria',
    'configuracoes',
  ],
  // Supervisor: dashboard operador + secretaria da sua supervisão (campo/setor)
  supervisor: [
    'dashboard',
    'secretaria',
    'configuracoes',
    'comissao',
  ],
  // Admin local: dashboard operador + secretaria da sua congregação
  admin_local: [
    'dashboard',
    'secretaria',
    'configuracoes',
  ],
  // Financeiro local: dashboard operador + financeiro da sua congregação
  financeiro_local: [
    'dashboard',
    'financeiro',
    'tesouraria',
  ],
  // Legado / EBD
  superintendente: [
    'ebd',
    'configuracoes',
  ],
  coordenador: [
    'ebd',
    'configuracoes',
  ],
  operador: [
    'secretaria',
  ],
};

// Quais módulos cada nível pode ESCREVER
const MODULOS_ESCRITA: Record<NivelAcesso, string[]> = {
  administrador: [
    'secretaria',
    'financeiro',
    'ebd',
    'usuarios',
    'configuracoes',
    'auditoria',
    'dashboard',
    'eventos',
    'reunioes',
    'missoes',
    'patrimonio',
    'geolocalizacao',
  ],
  financeiro: [
    'financeiro',
    'tesouraria',
  ],
  supervisor: [
    'secretaria',
  ],
  admin_local: [
    'secretaria',
  ],
  financeiro_local: [
    'financeiro',
    'tesouraria',
  ],
  superintendente: [
    'ebd',
  ],
  coordenador: [
    'ebd',
  ],
  operador: [
    'secretaria',
  ],
};

/**
 * Verifica se um usuário tem acesso a um módulo
 * @param nivel - Nível de acesso do usuário
 * @param modulo - Nome do módulo a verificar
 * @returns boolean
 */
export function temAcesso(nivel: NivelAcesso, modulo: string): boolean {
  return MODULOS_ACESSO[nivel]?.includes(modulo) ?? false;
}

/**
 * Verifica se um usuário pode escrever em um módulo
 * @param nivel - Nível de acesso do usuário
 * @param modulo - Nome do módulo a verificar
 * @returns boolean
 */
export function temAcessoEscrita(nivel: NivelAcesso, modulo: string): boolean {
  return MODULOS_ESCRITA[nivel]?.includes(modulo) ?? false;
}

/**
 * Retorna a lista de módulos que o usuário pode acessar
 * @param nivel - Nível de acesso do usuário
 * @returns string[]
 */
export function getModulosAcessiveis(nivel: NivelAcesso): string[] {
  return MODULOS_ACESSO[nivel] ?? [];
}

/**
 * Retorna a lista de módulos que o usuário pode editar
 * @param nivel - Nível de acesso do usuário
 * @returns string[]
 */
export function getModulosEditaveis(nivel: NivelAcesso): string[] {
  return MODULOS_ESCRITA[nivel] ?? [];
}

/**
 * Verifica se um usuário é administrador
 * @param nivel - Nível de acesso do usuário
 * @returns boolean
 */
export function isAdmin(nivel: NivelAcesso): boolean {
  return nivel === 'administrador';
}

/**
 * Verifica se um usuário é supervisor
 * @param nivel - Nível de acesso do usuário
 * @returns boolean
 */
export function isSupervisor(nivel: NivelAcesso): boolean {
  return nivel === 'supervisor';
}

/**
 * Verifica se um usuário é operador
 * @param nivel - Nível de acesso do usuário
 * @returns boolean
 */
export function isOperador(nivel: NivelAcesso): boolean {
  return nivel === 'operador';
}

/**
 * Verifica se um usuário é financeiro
 * @param nivel - Nível de acesso do usuário
 * @returns boolean
 */
export function isFinanceiro(nivel: NivelAcesso): boolean {
  return nivel === 'financeiro';
}

/**
 * Verifica se um usuário é superintendente
 * @param nivel - Nível de acesso do usuário
 * @returns boolean
 */
export function isSuperintendente(nivel: NivelAcesso): boolean {
  return nivel === 'superintendente';
}

/**
 * Verifica se um usuário é coordenador
 * @param nivel - Nível de acesso do usuário
 * @returns boolean
 */
export function isCoordenador(nivel: NivelAcesso): boolean {
  return nivel === 'coordenador';
}

/**
 * Verifica se um nível pode ver dados de Secretaria
 * @param nivel - Nível de acesso do usuário
 * @returns boolean
 */
export function podeAcessarSecretaria(nivel: NivelAcesso): boolean {
  return temAcesso(nivel, 'secretaria');
}

/**
 * Verifica se um nível pode ver dados de EBD
 * @param nivel - Nível de acesso do usuário
 * @returns boolean
 */
export function podeAcessarEBD(nivel: NivelAcesso): boolean {
  return temAcesso(nivel, 'ebd');
}

/**
 * Verifica se um nível pode ver dados Financeiros
 * @param nivel - Nível de acesso do usuário
 * @returns boolean
 */
export function podeAcessarFinanceiro(nivel: NivelAcesso): boolean {
  return temAcesso(nivel, 'financeiro');
}

/**
 * Converte lista de congregações baseado no nível do usuário
 * @param nivel - Nível de acesso do usuário
 * @param congregacoes - Lista de todas as congregações
 * @param congregacaoUsuario - Congregação do usuário (se operador)
 * @param supervisaoUsuario - Supervisão do usuário (se supervisor)
 * @returns Lista de congregações filtradas
 */
export function filtrarCongregacoes(
  nivel: NivelAcesso,
  congregacoes: Array<{ id: string; nome: string; supervisao?: string }>,
  congregacaoUsuario?: string,
  supervisaoUsuario?: string
): typeof congregacoes {
  if (nivel === 'administrador') {
    return congregacoes; // Admin vê tudo
  }

  if (nivel === 'supervisor' && supervisaoUsuario) {
    return congregacoes.filter(c => c.supervisao === supervisaoUsuario);
  }

  if (nivel === 'operador' && congregacaoUsuario) {
    return congregacoes.filter(c => c.nome === congregacaoUsuario);
  }

  return []; // Superintendente e Coordenador não filtram por congregação (usam EBD)
}
