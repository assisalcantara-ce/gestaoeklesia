export type NivelAcesso =
  | 'administrador'
  | 'financeiro'
  | 'supervisor'
  | 'admin_local'
  | 'financeiro_local'
  | 'superintendente'
  | 'coordenador'
  | 'operador'
  | 'presidencia'
  | 'conselho_fiscal';

export type RoleConfig = {
  role: 'admin' | 'manager' | 'operator';
  permissions: string[];
};

export const MODULOS_ACESSO: Record<NivelAcesso, string[]> = {
  administrador: [
    'secretaria',
    'secretaria_local',
    'financeiro',
    'tesouraria',
    'ebd',
    'usuarios',
    'configuracoes',
    'auditoria',
    'dashboard',
    'eventos',
    'reunioes',
    'missoes',
    'patrimonio',
    'presidencia',
    'consolidado_financeiro',
    'conselho_fiscal',
    'suporte',
    'geolocalizacao',
    'comissao',
    'gestao',
  ],
  financeiro: [
    'financeiro',
    'tesouraria',
    'suporte',
    'presidencia',
    'consolidado_financeiro',
    'conselho_fiscal',
  ],
  supervisor: [
    'secretaria',
    'comissao',
  ],
  admin_local: [
    'dashboard',
    'secretaria',
    'secretaria_local',
    'configuracoes',
    'suporte',
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
    'configuracoes',
  ],
  operador: [
    'secretaria',
    'secretaria_local',
  ],
  presidencia: [
    'dashboard',
    'presidencia',
    'consolidado_financeiro',
    'conselho_fiscal',
  ],
  conselho_fiscal: [
    'presidencia',
    'consolidado_financeiro',
    'conselho_fiscal',
  ],
};

export const MODULOS_ESCRITA: Record<NivelAcesso, string[]> = {
  administrador: [
    'secretaria',
    'financeiro',
    'tesouraria',
    'ebd',
    'usuarios',
    'configuracoes',
    'auditoria',
    'dashboard',
    'eventos',
    'reunioes',
    'missoes',
    'patrimonio',
    'presidencia',
    'consolidado_financeiro',
    'conselho_fiscal',
    'suporte',
    'geolocalizacao',
  ],
  financeiro: [
    'financeiro',
    'tesouraria',
    'consolidado_financeiro',
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
  presidencia: [],
  conselho_fiscal: [
    'conselho_fiscal',
  ],
};

export function normalizePermissions(permissions: unknown): string[] {
  if (!Array.isArray(permissions)) return [];
  return permissions
    .map(permission => String(permission || '').trim().toUpperCase())
    .filter(Boolean);
}

export function resolveNivel(role: string | null | undefined, permissions: unknown): NivelAcesso | null {
  const roleNorm = String(role || '').toLowerCase().trim();
  const perms = normalizePermissions(permissions);

  if (!roleNorm && perms.length === 0) return null;

  if (perms.includes('ADMINISTRADOR')) return 'administrador';
  if (perms.includes('ADMIN_LOCAL')) return 'admin_local';
  if (perms.includes('FINANCEIRO_LOCAL')) return 'financeiro_local';
  if (perms.includes('FINANCEIRO')) return 'financeiro';
  if (perms.includes('SUPERINTENDENTE')) return 'superintendente';
  if (perms.includes('SUPERVISOR')) return 'supervisor';
  if (perms.includes('COORDENADOR')) return 'coordenador';
  if (perms.includes('OPERADOR')) return 'operador';
  if (perms.includes('PRESIDENCIA')) return 'presidencia';
  if (perms.includes('CONSELHO_FISCAL')) return 'conselho_fiscal';

  const map: Record<string, NivelAcesso> = {
    admin: 'administrador',
    administrador: 'administrador',
    manager: 'financeiro',
    financeiro: 'financeiro',
    financial: 'financeiro',
    financeiro_local: 'financeiro_local',
    supervisor: 'supervisor',
    superintendente: 'superintendente',
    superintendent: 'superintendente',
    admin_local: 'admin_local',
    operador: 'operador',
    operator: 'operador',
    coordenador: 'coordenador',
    coordinator: 'coordenador',
    viewer: 'operador',
    presidencia: 'presidencia',
    conselho_fiscal: 'conselho_fiscal',
  };

  return map[roleNorm] ?? null;
}

export function resolveRoles(role: string | null | undefined, permissions: unknown): string[] {
  const nivel = resolveNivel(role, permissions);
  const roles = new Set(normalizePermissions(permissions));
  if (nivel) roles.add(nivel.toUpperCase());
  if (nivel === 'administrador') roles.add('ADMINISTRADOR');
  return Array.from(roles);
}

export function mapRoleAndPermissions(nivel: NivelAcesso): RoleConfig {
  switch (nivel) {
    case 'administrador':
      return { role: 'admin', permissions: ['ADMINISTRADOR'] };
    case 'financeiro':
      return { role: 'manager', permissions: ['FINANCEIRO'] };
    case 'supervisor':
      return { role: 'manager', permissions: ['SUPERVISOR'] };
    case 'admin_local':
      return { role: 'operator', permissions: ['ADMIN_LOCAL'] };
    case 'financeiro_local':
      return { role: 'operator', permissions: ['FINANCEIRO_LOCAL'] };
    case 'superintendente':
      return { role: 'operator', permissions: ['SUPERINTENDENTE'] };
    case 'coordenador':
      return { role: 'operator', permissions: ['COORDENADOR'] };
    case 'operador':
      return { role: 'operator', permissions: ['OPERADOR'] };
    case 'presidencia':
      return { role: 'operator', permissions: ['PRESIDENCIA'] };
    case 'conselho_fiscal':
      return { role: 'operator', permissions: ['CONSELHO_FISCAL'] };
  }
}

export function temAcesso(nivel: NivelAcesso, modulo: string): boolean {
  return MODULOS_ACESSO[nivel]?.includes(modulo) ?? false;
}

export function temAcessoEscrita(nivel: NivelAcesso, modulo: string): boolean {
  return MODULOS_ESCRITA[nivel]?.includes(modulo) ?? false;
}

export function hasRole(roles: string[], required: string[] | string): boolean {
  const requiredList = Array.isArray(required) ? required : [required];
  const set = new Set(roles.map(role => role.toUpperCase()));
  return requiredList.some(role => set.has(String(role).toUpperCase())) || set.has('ADMINISTRADOR');
}

export function isLocalNivel(nivel: NivelAcesso): boolean {
  return ['admin_local', 'financeiro_local', 'coordenador', 'operador'].includes(nivel);
}
