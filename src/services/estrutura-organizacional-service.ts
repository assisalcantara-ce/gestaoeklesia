import { createClient } from '@/lib/supabase-client';
import { loadOrgNomenclaturasFromSupabaseOrMigrate } from '@/lib/org-nomenclaturas';
import type {
  EstruturaOrganizacionalResultado,
  UnidadeOrganizacional,
  ConfiguracaoNomenclaturas,
  TabelaOrigem,
  NumeroDivisao,
  OptionFormatada,
} from '@/types/estrutura-organizacional';

/**
 * ============================================================================
 * SERVIÇO CENTRAL DE ESTRUTURA ORGANIZACIONAL DA APLICAÇÃO
 * ============================================================================
 * 
 * ⚠️ ATENÇÃO: Este serviço é a ÚNICA CAMADA OFICIAL E AUTORIZADA para consultar,
 * interpretar e fornecer dados sobre a Estrutura Organizacional dos Tenants.
 * 
 * Nenhuma tela, componente, hook ou API deve realizar consultas diretas às tabelas
 * físicas (`congregacoes`, `campos`, `supervisoes`) ou interpretar nomenclaturas de forma ad-hoc.
 * 
 * CONCEITO DA ESTRUTURA:
 * - Divisão 1: Unidade local mais granular (Mapeada para `congregacoes` ou `supervisoes`).
 * - Divisão 2: Unidade intermediária / setor (Mapeada para `campos`).
 * - Divisão 3: Unidade regional / ampla (Mapeada para `supervisoes`).
 */
export class EstruturaOrganizacionalService {
  private estrutura: EstruturaOrganizacionalResultado;

  constructor(estrutura: EstruturaOrganizacionalResultado) {
    this.estrutura = estrutura;
  }

  /**
   * Retorna os registros da 1ª Divisão Organizacional.
   */
  public getDivisao1(): UnidadeOrganizacional[] {
    return this.estrutura.divisao1;
  }

  /**
   * Retorna os registros da 2ª Divisão Organizacional.
   */
  public getDivisao2(): UnidadeOrganizacional[] {
    return this.estrutura.divisao2;
  }

  /**
   * Retorna os registros da 3ª Divisão Organizacional.
   */
  public getDivisao3(): UnidadeOrganizacional[] {
    return this.estrutura.divisao3;
  }

  /**
   * Retorna todas as unidades organizacionais ativas agrupadas em um único array.
   */
  public getDivisoesAtivas(): UnidadeOrganizacional[] {
    return [
      ...this.estrutura.divisao1.filter((u) => u.isActive !== false),
      ...this.estrutura.divisao2.filter((u) => u.isActive !== false),
      ...this.estrutura.divisao3.filter((u) => u.isActive !== false),
    ];
  }

  /**
   * Retorna os rótulos (labels de nomenclatura) das 3 divisões organizacionais.
   */
  public getLabels(): ConfiguracaoNomenclaturas {
    return this.estrutura.configuracao;
  }

  /**
   * Verifica se determinada divisão (1, 2 ou 3) possui registros ou está configurada no tenant.
   * A 3ª divisão, por exemplo, pode estar desativada (ex: nomenclatura = "NENHUMA").
   */
  public possuiDivisao(numero: NumeroDivisao): boolean {
    if (numero === 1) return this.estrutura.divisao1.length > 0;
    if (numero === 2) return this.estrutura.divisao2.length > 0 && this.estrutura.configuracao.nomeDivisao2.toUpperCase() !== 'NENHUMA';
    if (numero === 3) return this.estrutura.divisao3.length > 0 && this.estrutura.configuracao.nomeDivisao3.toUpperCase() !== 'NENHUMA';
    return false;
  }

  /**
   * Retorna o nome da tabela física de origem para a divisão indicada (1, 2 ou 3).
   */
  public getTabelaOrigem(numero: NumeroDivisao): TabelaOrigem {
    if (numero === 2) return 'campos';
    if (numero === 3) return 'supervisoes';
    return this.estrutura.divisao1[0]?.tabelaOrigem || 'congregacoes';
  }

  /**
   * Retorna os registros da divisão informada (1, 2 ou 3).
   */
  public getRegistros(numero: NumeroDivisao): UnidadeOrganizacional[] {
    if (numero === 1) return this.estrutura.divisao1;
    if (numero === 2) return this.estrutura.divisao2;
    if (numero === 3) return this.estrutura.divisao3;
    return [];
  }

  /**
   * Busca um registro específico pelo ID dentro da divisão informada (1, 2 ou 3).
   */
  public getRegistroPorId(numero: NumeroDivisao, id: string): UnidadeOrganizacional | null {
    const registros = this.getRegistros(numero);
    return registros.find((u) => u.id === id) || null;
  }

  /**
   * Retorna as opções formatadas de uma divisão para consumo em dropdowns/selects ({ id, nome }),
   * aplicando deduplicação, sanitização e ordenação.
   */
  public getOptionsFormatadas(numero: NumeroDivisao): OptionFormatada[] {
    const registros = this.getRegistros(numero);
    const seen = new Set<string>();
    const out: OptionFormatada[] = [];

    registros.forEach((u) => {
      const nomeLimpo = u.nome ? u.nome.trim() : '';
      if (!nomeLimpo) return;
      const key = nomeLimpo.toUpperCase();
      if (seen.has(key)) return;
      seen.add(key);

      out.push({
        id: u.id,
        nome: nomeLimpo,
        supervisao_id: u.parentId || undefined,
        campo_id: u.parentId || undefined,
      });
    });

    return out.sort((a, b) => a.nome.localeCompare(b.nome));
  }

  /**
   * Recarrega as nomenclaturas do tenant de forma reativa.
   */
  public async recarregarNomenclaturas(customSupabaseClient?: any): Promise<ConfiguracaoNomenclaturas> {
    const supabase = customSupabaseClient || createClient();
    const orgNomes = await loadOrgNomenclaturasFromSupabaseOrMigrate(supabase, { syncLocalStorage: false });
    this.estrutura.configuracao = {
      nomeDivisao1: orgNomes?.divisaoPrincipal?.opcao1 || 'Congregação',
      nomeDivisao2: orgNomes?.divisaoSecundaria?.opcao1 || 'Campo',
      nomeDivisao3: orgNomes?.divisaoTerciaria?.opcao1 || 'Supervisão',
    };
    return this.estrutura.configuracao;
  }

  /**
   * Retorna a estrutura bruta resultado.
   */
  public getResultado(): EstruturaOrganizacionalResultado {
    return this.estrutura;
  }
}

/**
 * Carrega a Estrutura Organizacional completa do tenant e inicializa a classe autossuficiente.
 * 
 * @param ministryId ID do tenant (ministério)
 * @param customSupabaseClient Instância opcional do Supabase Client
 */
export async function carregarEstruturaOrganizacional(
  ministryId: string,
  customSupabaseClient?: any
): Promise<EstruturaOrganizacionalResultado> {
  const supabase = customSupabaseClient || createClient();

  // 1. Carregar as Nomenclaturas oficiais do Tenant
  const orgNomes = await loadOrgNomenclaturasFromSupabaseOrMigrate(supabase, { syncLocalStorage: false });

  const configuracao: ConfiguracaoNomenclaturas = {
    nomeDivisao1: orgNomes?.divisaoPrincipal?.opcao1 || 'Congregação',
    nomeDivisao2: orgNomes?.divisaoSecundaria?.opcao1 || 'Campo',
    nomeDivisao3: orgNomes?.divisaoTerciaria?.opcao1 || 'Supervisão',
  };

  // 2. Carregar registros da 1ª Divisão (`congregacoes`)
  let divisao1: UnidadeOrganizacional[] = [];
  const { data: cData, error: cError } = await supabase
    .from('congregacoes')
    .select('*')
    .eq('ministry_id', ministryId)
    .or('is_active.eq.true,is_active.is.null')
    .order('nome');

  if (!cError && cData && cData.length > 0) {
    divisao1 = cData.map((item: any) => ({
      id: item.id,
      nome: item.nome,
      label: configuracao.nomeDivisao1,
      tabelaOrigem: 'congregacoes',
      isSede: !!item.is_sede,
      isActive: item.is_active !== false,
      parentId: item.campo_id || item.supervisao_id || null,
      dirigente: item.dirigente || null,
      status_imovel: item.status_imovel || null,
      campo_id: item.campo_id || null,
      supervisao_id: item.supervisao_id || null,
    }));
  } else {
    // Fallback: se a 1ª Divisão do tenant estiver cadastrada na tabela `supervisoes`
    const { data: sDataFallback } = await supabase
      .from('supervisoes')
      .select('id, nome, is_active')
      .eq('ministry_id', ministryId)
      .or('is_active.eq.true,is_active.is.null')
      .order('nome');

    if (sDataFallback) {
      divisao1 = sDataFallback.map((item: any) => ({
        id: item.id,
        nome: item.nome,
        label: configuracao.nomeDivisao1,
        tabelaOrigem: 'supervisoes',
        isSede: false,
        isActive: item.is_active !== false,
        parentId: null,
      }));
    }
  }

  // 3. Carregar registros da 2ª Divisão (`campos`)
  let divisao2: UnidadeOrganizacional[] = [];
  const { data: camposData, error: camposError } = await supabase
    .from('campos')
    .select('id, nome, is_active, supervisao_id')
    .eq('ministry_id', ministryId)
    .or('is_active.eq.true,is_active.is.null')
    .order('nome');

  if (!camposError && camposData) {
    divisao2 = camposData.map((item: any) => ({
      id: item.id,
      nome: item.nome,
      label: configuracao.nomeDivisao2,
      tabelaOrigem: 'campos',
      isActive: item.is_active !== false,
      parentId: item.supervisao_id || null,
    }));
  }

  // 4. Carregar registros da 3ª Divisão (`supervisoes`)
  let divisao3: UnidadeOrganizacional[] = [];
  const { data: supData, error: supError } = await supabase
    .from('supervisoes')
    .select('id, nome, is_active')
    .eq('ministry_id', ministryId)
    .or('is_active.eq.true,is_active.is.null')
    .order('nome');

  if (!supError && supData) {
    divisao3 = supData.map((item: any) => ({
      id: item.id,
      nome: item.nome,
      label: configuracao.nomeDivisao3,
      tabelaOrigem: 'supervisoes',
      isActive: item.is_active !== false,
      parentId: null,
    }));
  }

  return {
    divisao1,
    divisao2,
    divisao3,
    configuracao,
  };
}

/**
 * Cria e retorna uma instância autossuficiente do EstruturaOrganizacionalService para um tenant.
 * 
 * @param ministryId ID do tenant (ministério)
 * @param customSupabaseClient Instância opcional do Supabase Client
 */
export async function obterEstruturaOrganizacionalService(
  ministryId: string,
  customSupabaseClient?: any
): Promise<EstruturaOrganizacionalService> {
  const resultado = await carregarEstruturaOrganizacional(ministryId, customSupabaseClient);
  return new EstruturaOrganizacionalService(resultado);
}
