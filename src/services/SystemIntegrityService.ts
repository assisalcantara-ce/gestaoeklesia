/**
 * SystemIntegrityService
 *
 * Serviço compartilhado de integridade do Gestão Eklésia.
 * Responsabilidades:
 *  - Executar verificações de integridade de qualquer módulo.
 *  - Corrigir automaticamente inconsistências quando possível.
 *  - Registrar AuditLog e system_integrity_logs.
 *  - Gerar relatório resumido para dashboards administrativos.
 *
 * Design:
 *  - Totalmente genérico: não contém lógica de domínio específica.
 *  - Lógica de negócio fica em arquivos de checks separados por módulo.
 *  - Nunca bloqueia a interface — deve ser invocado de forma não-bloqueante.
 *  - Toda exceção é capturada internamente; erros de verificação nunca propagam.
 */

import { SupabaseClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Interfaces públicas
// ---------------------------------------------------------------------------

/** Representa uma inconsistência detectada no sistema. */
export interface IntegrityIssue {
  /** Identificador único da issue (ex: "culto-orfao-<uuid>") */
  id: string;
  /** Módulo de origem (ex: "acolhimento", "tesouraria") */
  module: string;
  /** Nome da entidade/tabela afetada */
  entity: string;
  /** UUID do registro afetado */
  entityId: string;
  /** Severidade: "warning" para corrigível, "critical" para atenção manual */
  severity: 'warning' | 'critical';
  /** Título curto e legível (para painel administrativo) */
  title: string;
  /** Descrição operacional da inconsistência */
  description: string;
  /** Indica se o serviço consegue corrigir automaticamente */
  autoFixAvailable: boolean;
  /** Função de correção — chamada apenas se autoFixAvailable = true */
  fix(): Promise<void>;
}

/** Relatório gerado após uma execução de verificações. */
export interface IntegrityReport {
  module: string;
  checkedAt: Date;
  totalIssues: number;
  autoFixed: number;
  requiresAttention: number;
}

/**
 * Tipo de função de verificação de integridade.
 * Recebe o cliente Supabase e o ministryId do tenant atual.
 * Retorna uma lista de inconsistências detectadas.
 */
export type IntegrityCheckFn = (
  supabase: SupabaseClient,
  ministryId: string
) => Promise<IntegrityIssue[]>;

// ---------------------------------------------------------------------------
// Funções internas de suporte
// ---------------------------------------------------------------------------

/**
 * Persiste um registro no system_integrity_logs.
 * Falha silenciosamente: logging nunca bloqueia o fluxo principal.
 */
async function persistIntegrityLog(
  supabase: SupabaseClient,
  ministryId: string,
  issue: IntegrityIssue,
  resolved: boolean
): Promise<void> {
  try {
    await supabase.from('system_integrity_logs').insert({
      ministry_id: ministryId,
      module: issue.module,
      entity: issue.entity,
      entity_id: issue.entityId,
      severity: issue.severity,
      message: issue.description,
      resolved,
      resolved_at: resolved ? new Date().toISOString() : null,
    });
  } catch {
    // Falha de logging é silenciosa
  }
}

/**
 * Envia entrada no AuditLog via API interna.
 * Falha silenciosamente.
 */
async function auditIntegrityAction(
  issue: IntegrityIssue,
  resolved: boolean
): Promise<void> {
  try {
    await fetch('/api/v1/audit-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        acao: resolved ? 'editar' : 'visualizar',
        modulo: issue.module,
        area: 'Sistema',
        tabela_afetada: issue.entity,
        registro_id: issue.entityId,
        descricao: resolved
          ? `Sistema restaurou automaticamente: ${issue.title} — entidade: ${issue.entityId}`
          : `Inconsistência não resolvida automaticamente: ${issue.title} — entidade: ${issue.entityId}`,
        dados_novos: {
          severity: issue.severity,
          autoFixed: resolved,
          title: issue.title,
        },
      }),
    });
  } catch {
    // Falha de auditoria é silenciosa
  }
}

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

/**
 * Executa um conjunto de verificações de integridade para o módulo informado.
 *
 * @param supabase  - Cliente Supabase com contexto do usuário autenticado.
 * @param module    - Nome do módulo (ex: "acolhimento").
 * @param ministryId - UUID do ministério/tenant corrente.
 * @param checks    - Lista de funções de verificação específicas do módulo.
 * @returns Relatório resumido da execução.
 */
export async function runIntegrityCheck(
  supabase: SupabaseClient,
  module: string,
  ministryId: string,
  checks: IntegrityCheckFn[]
): Promise<IntegrityReport> {
  let autoFixed = 0;
  let requiresAttention = 0;
  let totalIssues = 0;

  for (const check of checks) {
    let issues: IntegrityIssue[] = [];

    try {
      issues = await check(supabase, ministryId);
    } catch {
      // Falha na verificação não propaga
      continue;
    }

    totalIssues += issues.length;

    for (const issue of issues) {
      if (issue.autoFixAvailable) {
        try {
          await issue.fix();
          autoFixed++;
          await persistIntegrityLog(supabase, ministryId, issue, true);
          await auditIntegrityAction(issue, true);
        } catch {
          // Auto-fix falhou: registrar como requer atenção
          requiresAttention++;
          await persistIntegrityLog(supabase, ministryId, issue, false);
          await auditIntegrityAction(issue, false);
        }
      } else {
        requiresAttention++;
        await persistIntegrityLog(supabase, ministryId, issue, false);
        await auditIntegrityAction(issue, false);
      }
    }
  }

  return {
    module,
    checkedAt: new Date(),
    totalIssues,
    autoFixed,
    requiresAttention,
  };
}
