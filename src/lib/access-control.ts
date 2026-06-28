export type AdminRole = 'admin' | 'super_admin' | 'financeiro' | 'suporte';

export const ADMIN_MODULOS_ACESSO: Record<AdminRole, string[]> = {
  admin: [
    'dashboard',
    'ministerios',
    'pagamentos',
    'planos',
    'suporte',
    'configuracoes_supabase',
    'configuracoes_usuarios',
    'configuracoes_gateway',
  ],
  super_admin: [
    'dashboard',
    'ministerios',
    'pagamentos',
    'planos',
    'suporte',
    'configuracoes_supabase',
    'configuracoes_usuarios',
    'configuracoes_gateway',
  ],
  financeiro: [
    'dashboard',
    'pagamentos',
    'planos',
    'suporte',
  ],
  suporte: [
    'dashboard',
    'ministerios',
    'suporte',
  ],
};

export function temAcessoAdmin(role: string | null | undefined, modulo: string): boolean {
  const normalizedRole = String(role || '').toLowerCase().trim() as AdminRole;
  return ADMIN_MODULOS_ACESSO[normalizedRole]?.includes(modulo) ?? false;
}

export type NivelAcesso =
  | 'administrador'
  | 'financeiro'
  | 'supervisor'
  | 'secretaria_local'
  | 'tesouraria_local'
  | 'superintendente_ebd'
  | 'coordenador_ebd'
  | 'presidencia'
  | 'conselho_fiscal'
  // Legado para compatibilidade
  | 'admin_local'
  | 'financeiro_local'
  | 'superintendente'
  | 'coordenador'
  | 'operador';

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
    'dashboard',
    'tesouraria',
    'auditoria',
  ],
  supervisor: [
    'secretaria',
    'comissao',
  ],
  secretaria_local: [
    'dashboard',
    'secretaria',
    'secretaria_local',
    'patrimonio',
    'geolocalizacao',
    'gestao',
  ],
  tesouraria_local: [
    'dashboard',
    'tesouraria',
  ],
  superintendente_ebd: [
    'dashboard',
    'ebd',
  ],
  coordenador_ebd: [
    'dashboard',
    'ebd',
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
  // Mapeamentos legados (compartilham as mesmas permissões dos novos)
  admin_local: [
    'dashboard',
    'secretaria',
    'secretaria_local',
    'patrimonio',
    'geolocalizacao',
    'gestao',
  ],
  financeiro_local: [
    'dashboard',
    'tesouraria',
  ],
  superintendente: [
    'dashboard',
    'ebd',
  ],
  coordenador: [
    'dashboard',
    'ebd',
  ],
  operador: [
    'dashboard',
    'secretaria',
    'secretaria_local',
    'patrimonio',
    'geolocalizacao',
    'gestao',
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
    'tesouraria',
  ],
  supervisor: [
    'secretaria',
  ],
  secretaria_local: [
    'secretaria',
    'secretaria_local',
    'patrimonio',
    'geolocalizacao',
    'gestao',
  ],
  tesouraria_local: [
    'tesouraria',
  ],
  superintendente_ebd: [
    'ebd',
  ],
  coordenador_ebd: [
    'ebd',
  ],
  presidencia: [],
  conselho_fiscal: [
    'conselho_fiscal',
  ],
  // Legados
  admin_local: [
    'secretaria',
    'secretaria_local',
    'patrimonio',
    'geolocalizacao',
    'gestao',
  ],
  financeiro_local: [
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
    'secretaria_local',
    'patrimonio',
    'geolocalizacao',
    'gestao',
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

  let resolved: NivelAcesso | null = null;

  if (perms.includes('ADMINISTRADOR')) resolved = 'administrador';
  else if (perms.includes('ADMIN_LOCAL')) resolved = 'secretaria_local';
  else if (perms.includes('SECRETARIA_LOCAL')) resolved = 'secretaria_local';
  else if (perms.includes('FINANCEIRO_LOCAL')) resolved = 'tesouraria_local';
  else if (perms.includes('TESOURARIA_LOCAL')) resolved = 'tesouraria_local';
  else if (perms.includes('FINANCEIRO')) resolved = 'financeiro';
  else if (perms.includes('SUPERINTENDENTE_EBD')) resolved = 'superintendente_ebd';
  else if (perms.includes('SUPERINTENDENTE')) resolved = 'superintendente_ebd';
  else if (perms.includes('SUPERVISOR')) resolved = 'supervisor';
  else if (perms.includes('COORDENADOR_EBD')) resolved = 'coordenador_ebd';
  else if (perms.includes('COORDENADOR')) resolved = 'coordenador_ebd';
  else if (perms.includes('OPERADOR')) resolved = 'secretaria_local';
  else if (perms.includes('PRESIDENCIA')) resolved = 'presidencia';
  else if (perms.includes('CONSELHO_FISCAL')) resolved = 'conselho_fiscal';

  if (!resolved) {
    const map: Record<string, NivelAcesso> = {
      admin: 'administrador',
      administrador: 'administrador',
      manager: 'financeiro',
      financeiro: 'financeiro',
      financial: 'financeiro',
      financeiro_local: 'tesouraria_local',
      tesouraria_local: 'tesouraria_local',
      supervisor: 'supervisor',
      superintendente: 'superintendente_ebd',
      superintendente_ebd: 'superintendente_ebd',
      superintent: 'superintendente_ebd',
      admin_local: 'secretaria_local',
      secretaria_local: 'secretaria_local',
      operador: 'secretaria_local',
      operator: 'secretaria_local',
      coordenador: 'coordenador_ebd',
      coordenador_ebd: 'coordenador_ebd',
      coordinator: 'coordenador_ebd',
      viewer: 'secretaria_local',
      presidencia: 'presidencia',
      conselho_fiscal: 'conselho_fiscal',
    };
    resolved = map[roleNorm] ?? null;
  }

  return resolved;
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
    case 'secretaria_local':
    case 'admin_local':
    case 'operador':
      return { role: 'operator', permissions: ['SECRETARIA_LOCAL', 'ADMIN_LOCAL', 'OPERADOR'] };
    case 'tesouraria_local':
    case 'financeiro_local':
      return { role: 'operator', permissions: ['TESOURARIA_LOCAL', 'FINANCEIRO_LOCAL'] };
    case 'superintendente_ebd':
    case 'superintendente':
      return { role: 'operator', permissions: ['SUPERINTENDENTE_EBD', 'SUPERINTENDENTE'] };
    case 'coordenador_ebd':
    case 'coordenador':
      return { role: 'operator', permissions: ['COORDENADOR_EBD', 'COORDENADOR'] };
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
  return [
    'secretaria_local',
    'tesouraria_local',
    'coordenador_ebd',
    'admin_local',
    'financeiro_local',
    'coordenador',
    'operador'
  ].includes(nivel);
}
