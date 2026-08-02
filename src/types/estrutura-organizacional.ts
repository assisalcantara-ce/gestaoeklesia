export type TabelaOrigem = 'congregacoes' | 'campos' | 'supervisoes';
export type NumeroDivisao = 1 | 2 | 3;

export interface UnidadeOrganizacional {
  id: string;
  nome: string;
  label: string;
  tabelaOrigem: TabelaOrigem;
  isSede?: boolean;
  isActive?: boolean;
  parentId?: string | null;
}

export interface ConfiguracaoNomenclaturas {
  nomeDivisao1: string;
  nomeDivisao2: string;
  nomeDivisao3: string;
}

export interface OptionFormatada {
  id: string;
  nome: string;
  supervisao_id?: string;
  campo_id?: string;
}

export interface EstruturaOrganizacionalResultado {
  divisao1: UnidadeOrganizacional[];
  divisao2: UnidadeOrganizacional[];
  divisao3: UnidadeOrganizacional[];
  configuracao: ConfiguracaoNomenclaturas;
}
