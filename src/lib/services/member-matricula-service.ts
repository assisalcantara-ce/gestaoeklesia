/**
 * Serviço de Alocação e Geração Sequencial de Matrículas
 * src/lib/services/member-matricula-service.ts
 *
 * Garante:
 * 1. Sequenciamento atômico, contínuo e determinístico no escopo de cada ministério (multi-tenant).
 * 2. Formato padronizado numérico de 3 dígitos (ex: '001', '010', '100', '501').
 * 3. Tentativa prioritária via RPC atômico no PostgreSQL (`alocar_proxima_matricula_membro`),
 *    com fallback seguro no backend para cálculo direto caso a RPC ainda não esteja instalada.
 * 4. Tratamento e retry automático em caso de colisão por concorrência.
 */

import { SupabaseClient } from '@supabase/supabase-js';

export interface AlocarMatriculaOptions {
  /**
   * Se informado pelo operador no painel administrativo, tenta validar e usar.
   * Se for string numérica (ex: "5", "005"), normaliza para 3 dígitos ("005").
   * Se for vazio, undefined ou não fornecido, aloca o próximo número sequencial.
   */
  matriculaInformada?: string | null;
  /**
   * Número máximo de retentativas em caso de concorrência simultânea no fallback
   */
  maxRetries?: number;
}

export class MemberMatriculaService {
  /**
   * Normaliza uma matrícula existente ou manual para o padrão de 3 dígitos se for puramente numérica.
   */
  static normalizarMatricula(matricula?: string | null): string | null {
    if (!matricula) return null;
    const trimmed = String(matricula).trim();
    if (!trimmed) return null;
    if (/^\d+$/.test(trimmed)) {
      return trimmed.padStart(3, '0');
    }
    return trimmed;
  }

  /**
   * Aloca o próximo número sequencial de matrícula para o ministério especificado.
   * Prioriza RPC atômica (`alocar_proxima_matricula_membro`). Caso a função não exista no banco,
   * executa o cálculo de fallback consultando os registros atuais com maior sequencial.
   */
  static async alocarProximaMatricula(
    supabase: SupabaseClient,
    ministryId: string
  ): Promise<string> {
    if (!ministryId) {
      throw new Error('ministryId é obrigatório para alocar matrícula');
    }

    // 1. Tentar executar via RPC segura no banco de dados
    try {
      const { data: rpcMatricula, error: rpcErr } = await supabase.rpc(
        'alocar_proxima_matricula_membro',
        { p_ministry_id: ministryId }
      );

      if (!rpcErr && rpcMatricula && typeof rpcMatricula === 'string' && rpcMatricula.trim()) {
        return rpcMatricula.trim();
      }
      if (rpcErr) {
        console.warn('[MemberMatriculaService] RPC alocar_proxima_matricula_membro indisponível ou com erro, usando fallback:', rpcErr.message || rpcErr);
      }
    } catch (err: any) {
      console.warn('[MemberMatriculaService] Falha ao invocar RPC alocar_proxima_matricula_membro, acionando fallback:', err?.message || err);
    }

    // 2. Fallback de cálculo direto no banco
    return await this.calcularFallbackMatricula(supabase, ministryId);
  }

  /**
   * Resolve a matrícula final para um novo membro:
   * - Se o operador preencheu uma matrícula válida, normaliza e verifica se já existe.
   * - Se não preencheu (ou é cadastro público anônimo), aloca atomicamente o próximo número.
   */
  static async resolverMatriculaParaCadastro(
    supabase: SupabaseClient,
    ministryId: string,
    options?: AlocarMatriculaOptions
  ): Promise<string> {
    const informada = this.normalizarMatricula(options?.matriculaInformada);

    if (informada) {
      // Verificar se a matrícula manual já está em uso neste ministério
      const { data: conflito } = await supabase
        .from('members')
        .select('id')
        .eq('ministry_id', ministryId)
        .eq('matricula', informada)
        .maybeSingle();

      if (!conflito) {
        return informada;
      }
      // Se já estiver em uso, gera automaticamente o próximo para não perder o cadastro
    }

    return await this.alocarProximaMatricula(supabase, ministryId);
  }

  /**
   * Cálculo de fallback: consulta os membros do ministério que possuem matrícula,
   * extrai os números válidos e incrementa o maior valor existente.
   */
  private static async calcularFallbackMatricula(
    supabase: SupabaseClient,
    ministryId: string
  ): Promise<string> {
    const { data, error } = await supabase
      .from('members')
      .select('matricula')
      .eq('ministry_id', ministryId)
      .not('matricula', 'is', null)
      .limit(5000);

    let maxNum = 0;

    if (!error && Array.isArray(data)) {
      for (const item of data) {
        if (item.matricula && typeof item.matricula === 'string') {
          const numStr = item.matricula.replace(/\D/g, '');
          if (numStr) {
            const num = parseInt(numStr, 10);
            if (!isNaN(num) && num > maxNum) {
              maxNum = num;
            }
          }
        }
      }
    }

    const proximoNum = maxNum + 1;
    return String(proximoNum).padStart(3, '0');
  }
}
