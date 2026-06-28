import { loadOrgNomenclaturasFromSupabaseOrMigrate, OrgNomenclaturasState } from './org-nomenclaturas';

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface DivisionInfo {
  nome: string;
  ativa: boolean;
}

export interface OrgStructure {
  organizacao: string;
  divisao1: DivisionInfo;
  divisao2: DivisionInfo;
  divisao3: DivisionInfo;
}

// Cache em memória simples
let cachedStructure: OrgStructure | null = null;
let cachedConfig: OrgNomenclaturasState | null = null;

// ─── Domain Service ──────────────────────────────────────────────────────────

/**
 * OrganizationalService
 * Fonte única oficial de consulta das nomenclaturas organizacionais do Gestão Eklésia.
 */
export const OrganizationalService = {
  /**
   * Limpa o cache em memória
   */
  clearCache() {
    cachedStructure = null;
    cachedConfig = null;
  },

  /**
   * Retorna a configuração bruta normalizada carregada do banco
   */
  async getConfiguracao(supabase: any): Promise<OrgNomenclaturasState> {
    if (cachedConfig) return cachedConfig;
    const config = await loadOrgNomenclaturasFromSupabaseOrMigrate(supabase);
    cachedConfig = config;
    return config;
  },

  /**
   * Retorna a estrutura organizacional padronizada
   */
  async getEstrutura(supabase: any): Promise<OrgStructure> {
    if (cachedStructure) return cachedStructure;

    const config = await this.getConfiguracao(supabase);

    const d1 = config.divisaoPrincipal.opcao1 || 'NENHUMA';
    const d2 = config.divisaoSecundaria.opcao1 || 'NENHUMA';
    const d3 = config.divisaoTerciaria.opcao1 || 'NENHUMA';

    const structure: OrgStructure = {
      organizacao: 'Ministério',
      divisao1: {
        nome: d1 === 'NENHUMA' ? '' : d1,
        ativa: d1 !== 'NENHUMA',
      },
      divisao2: {
        nome: d2 === 'NENHUMA' ? '' : d2,
        ativa: d2 !== 'NENHUMA',
      },
      divisao3: {
        nome: d3 === 'NENHUMA' ? '' : d3,
        ativa: d3 !== 'NENHUMA',
      },
    };

    cachedStructure = structure;
    return structure;
  },

  /**
   * Métodos individuais para cada divisão
   */
  async getPrimeiraDivisao(supabase: any): Promise<DivisionInfo> {
    const struct = await this.getEstrutura(supabase);
    return struct.divisao1;
  },

  async getSegundaDivisao(supabase: any): Promise<DivisionInfo> {
    const struct = await this.getEstrutura(supabase);
    return struct.divisao2;
  },

  async getTerceiraDivisao(supabase: any): Promise<DivisionInfo> {
    const struct = await this.getEstrutura(supabase);
    return struct.divisao3;
  },

  async getOrganizacao(supabase: any): Promise<string> {
    const struct = await this.getEstrutura(supabase);
    return struct.organizacao;
  },

  async isPrimeiraDivisaoAtiva(supabase: any): Promise<boolean> {
    const div = await this.getPrimeiraDivisao(supabase);
    return div.ativa;
  },

  async isSegundaDivisaoAtiva(supabase: any): Promise<boolean> {
    const div = await this.getSegundaDivisao(supabase);
    return div.ativa;
  },

  async isTerceiraDivisaoAtiva(supabase: any): Promise<boolean> {
    const div = await this.getTerceiraDivisao(supabase);
    return div.ativa;
  },

  /**
   * Retorna os nomes das divisões em lista ordenada
   */
  async getDivisoes(supabase: any): Promise<string[]> {
    const struct = await this.getEstrutura(supabase);
    return [
      struct.divisao1.nome,
      struct.divisao2.nome,
      struct.divisao3.nome,
    ].filter(Boolean);
  },

  /**
   * Retorna a hierarquia estruturada das nomenclaturas
   */
  async getHierarchy(supabase: any) {
    const struct = await this.getEstrutura(supabase);
    return {
      organizacao: struct.organizacao,
      niveis: [
        { chave: 'divisao1', ...struct.divisao1 },
        { chave: 'divisao2', ...struct.divisao2 },
        { chave: 'divisao3', ...struct.divisao3 },
      ].filter(n => n.ativa),
    };
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Helper class/wrapper para consumo simples das nomenclaturas.
 * Permite sintaxe: `const helper = getOrgHelpers(struct); helper.label('divisao1')`
 */
export function getOrgHelpers(structure: OrgStructure) {
  return {
    label: (key: 'divisao1' | 'divisao2' | 'divisao3' | 'organizacao' = 'organizacao'): string => {
      if (key === 'organizacao') return structure.organizacao;
      return structure[key].nome || (key === 'divisao1' ? 'Congregação' : key === 'divisao2' ? 'Campo' : 'Supervisão');
    },
    nome: (key: 'divisao1' | 'divisao2' | 'divisao3' | 'organizacao' = 'organizacao'): string => {
      if (key === 'organizacao') return structure.organizacao;
      return structure[key].nome;
    },
    ativa: (key: 'divisao1' | 'divisao2' | 'divisao3'): boolean => {
      return structure[key].ativa;
    },
    possui: (key: 'divisao1' | 'divisao2' | 'divisao3'): boolean => {
      return structure[key].ativa;
    },
  };
}

/**
 * Objeto auxiliar pré-configurado com os nomes padrões (caso queira importar diretamente)
 */
export const organizacao = {
  label: (key: 'divisao1' | 'divisao2' | 'divisao3' | 'organizacao' = 'organizacao', structure?: OrgStructure): string => {
    if (!structure) return key === 'organizacao' ? 'Ministério' : key === 'divisao1' ? 'Congregação' : key === 'divisao2' ? 'Campo' : 'Supervisão';
    if (key === 'organizacao') return structure.organizacao;
    return structure[key].nome || (key === 'divisao1' ? 'Congregação' : key === 'divisao2' ? 'Campo' : 'Supervisão');
  },
  nome: (key: 'divisao1' | 'divisao2' | 'divisao3' | 'organizacao' = 'organizacao', structure?: OrgStructure): string => {
    if (!structure) return key === 'organizacao' ? 'Ministério' : key === 'divisao1' ? 'Congregação' : key === 'divisao2' ? 'Campo' : 'Supervisão';
    if (key === 'organizacao') return structure.organizacao;
    return structure[key].nome;
  },
  ativa: (key: 'divisao1' | 'divisao2' | 'divisao3', structure?: OrgStructure): boolean => {
    if (!structure) return true;
    return structure[key].ativa;
  },
  possui: (key: 'divisao1' | 'divisao2' | 'divisao3', structure?: OrgStructure): boolean => {
    if (!structure) return true;
    return structure[key].ativa;
  },
};
