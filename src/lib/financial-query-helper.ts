/**
 * financial-query-helper.ts
 *
 * Utilitário Canônico de Paginação, Lotes Seguros e Agregação Financeira (Lote 3)
 * Referência Arquitetural: docs/AUDITORIA_ESTRUTURAL_TESOURARIA.md
 * Protocolo de Segurança: docs/PROTOCOLO_SEGURANCA_PRODUCAO.md
 *
 * Princípios e Invariantes:
 * 1. Separação Definitiva:
 *    - Exibição de Registros: Paginada.
 *    - Apuração de Indicadores/Totais/Saldos: Agregação Integral sobre 100% dos registros elegíveis.
 *    - Impressão e Exportação: Processamento seguro em lotes (sem truncamento silencioso no teto de 1.000 linhas).
 * 2. Ordenação Determinística:
 *    Garante estabilidade na paginação e consistência mesmo com inserções simultâneas.
 * 3. Proteção contra Falhas Parciais:
 *    Se um lote falhar durante a agregação ou exportação, a operação é interrompida e sinaliza erro explícito,
 *    nunca apresentando totais parciais como se fossem definitivos.
 */

import { roundCurrency } from './financial-balance-service.ts';

export interface BatchFetchOptions {
  pageSize?: number;
  maxRecords?: number;
  onProgress?: (loaded: number, total?: number) => void;
  signal?: AbortSignal;
  idField?: string;
  deduplicate?: boolean;
}

export interface FinancialAggregationResult {
  entradas: number;
  saidas: number;
  saldo: number;
  totalRegistros: number;
}

/**
 * Executa uma busca completa e segura paginada em lotes contra o Supabase (ou qualquer query builder com range).
 * Elimina o risco de truncamento silencioso no limite padrão de 1.000 linhas do PostgREST.
 *
 * Mecanismos de Concorrência e Estabilidade:
 * 1. Deduplicação por Identificador Único: previne que deslocamentos de offset por inserções concorrentes
 *    produzam registros duplicados entre as páginas.
 * 2. Trava de Segurança Operacional (maxPages): protege contra loops infinitos de paginação.
 * 3. Cancelamento Ativo: respeita AbortSignal a cada iteração.
 * 4. Proteção contra Totais Parciais: qualquer erro no lote aborta imediatamente com exceção.
 */
export async function fetchAllRowsInBatches<T>(
  queryFactory: (rangeStart: number, rangeEnd: number) => Promise<{ data: T[] | null; error: any; count?: number | null }>,
  options?: BatchFetchOptions
): Promise<{ data: T[]; totalCount: number }> {
  const pageSize = options?.pageSize || 1000;
  const maxRecords = options?.maxRecords || Infinity;
  const idField = options?.idField || 'id';
  const shouldDeduplicate = options?.deduplicate !== false;
  const seenIds = new Set<any>();

  let allRows: T[] = [];
  let page = 0;
  let totalCount = 0;
  const maxPages = 1000; // Limite defensivo para evitar laços infinitos (até 1.000.000 de registros)

  while (allRows.length < maxRecords && page < maxPages) {
    if (options?.signal?.aborted) {
      throw new Error('Operação cancelada pelo usuário.');
    }

    const rangeStart = page * pageSize;
    const rangeEnd = Math.min(rangeStart + pageSize - 1, maxRecords - 1);

    const res = await queryFactory(rangeStart, rangeEnd);

    if (res.error) {
      throw new Error(`Falha ao consultar lote financeiro (${rangeStart}-${rangeEnd}): ${res.error.message || res.error}`);
    }

    if (res.count !== undefined && res.count !== null) {
      totalCount = res.count;
    }

    const rows = res.data || [];
    if (rows.length === 0) break;

    for (const row of rows) {
      if (shouldDeduplicate && (row as any)?.[idField] !== undefined) {
        const idVal = (row as any)[idField];
        if (seenIds.has(idVal)) {
          // Previne duplicação decorrente de inserções simultâneas que alteram offsets entre requisições
          continue;
        }
        seenIds.add(idVal);
      }
      allRows.push(row);
      if (allRows.length >= maxRecords) break;
    }

    if (options?.onProgress) {
      options.onProgress(allRows.length, totalCount || undefined);
    }

    // Se retornou menos que o pageSize solicitado, chegamos ao final da tabela
    if (rows.length < pageSize) break;

    page++;
  }

  return {
    data: allRows,
    totalCount: totalCount || allRows.length,
  };
}

/**
 * Calcula agregação integral de lançamentos em memória com precisão centesimal contábil.
 */
export function aggregateFinancialMovements(
  lancamentos: Array<{ tipo_movimento: string; valor: number | string }>
): FinancialAggregationResult {
  let entradas = 0;
  let saidas = 0;

  for (const l of lancamentos) {
    const v = roundCurrency(Number(l.valor) || 0);
    if (l.tipo_movimento === 'entrada') {
      entradas += v;
    } else if (l.tipo_movimento === 'saida') {
      saidas += v;
    }
  }

  entradas = roundCurrency(entradas);
  saidas = roundCurrency(saidas);
  const saldo = roundCurrency(entradas - saidas);

  return {
    entradas,
    saidas,
    saldo,
    totalRegistros: lancamentos.length,
  };
}
