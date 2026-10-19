import { createServerClient } from '@/lib/supabase-server';
import { CartasService } from '@/services/cartas-service';

export type TipoAssinaturaInstitucional = 'assinatura_presidente' | 'assinatura_secretario_geral';

export interface ParametrosRecuperacaoAssinatura {
  ministryId: string;
  tipoAssinatura: TipoAssinaturaInstitucional;
  /** Contexto do documento solicitante (ex: 'carta_mudanca', 'carta_desligamento', 'credencial', 'certificado', etc.) */
  contextoDocumento?: string;
  /** Identificador do membro associado (quando aplicável) */
  memberId?: string | null;
  /** Identificador da emissão ou pedido (quando aplicável) */
  documentoId?: string | null;
  /** Se a requisição é apenas uma pré-visualização (não emissão oficial) */
  isPreview?: boolean;
  /** Nível de acesso do operador solicitante */
  nivelOperador?: string | null;
}

export interface ResultadoAssinaturaInstitucional {
  autorizado: boolean;
  imagemBase64?: string | null;
  motivoBloqueio?: string;
  deliberacao?: {
    pedidoId?: string | null;
    autorizadorNome?: string | null;
    dataAutorizacao?: string | null;
  };
}

/**
 * Serviço centralizado para fornecimento seguro de assinaturas institucionais dinâmicas.
 * 
 * Regra de Segurança Inegociável:
 * - A assinatura do Pastor Presidente em Cartas de Mudança e Desligamento exige
 *   deliberação positiva registrada pela Presidência (status = 'autorizado').
 * - Não é liberada em pré-visualizações não autorizadas.
 * - Registro e isolamento estrito por tenant (ministry_id).
 */
export class AssinaturasInstitucionaisService {
  /**
   * Recupera a assinatura institucional solicitada verificando as regras formais
   * de governança e deliberação da Presidência.
   */
  public static async obterAssinaturaAutorizada(
    params: ParametrosRecuperacaoAssinatura
  ): Promise<ResultadoAssinaturaInstitucional> {
    const {
      ministryId,
      tipoAssinatura,
      contextoDocumento,
      memberId,
      documentoId,
      isPreview = false,
      nivelOperador,
    } = params;

    if (!ministryId) {
      return {
        autorizado: false,
        motivoBloqueio: 'Ministério não informado.',
      };
    }

    // 1. Regra de segurança obrigatória: Cartas de Mudança e Desligamento
    const isCartaRestrita =
      contextoDocumento === 'mudanca' ||
      contextoDocumento === 'desligamento' ||
      contextoDocumento === 'carta_mudanca' ||
      contextoDocumento === 'carta_desligamento' ||
      contextoDocumento?.includes('mudanca') ||
      contextoDocumento?.includes('desligamento');

    let deliberacaoInfo: ResultadoAssinaturaInstitucional['deliberacao'];

    if (isCartaRestrita && tipoAssinatura === 'assinatura_presidente') {
      // Bloqueio imediato se for apenas pré-visualização não autorizada
      if (isPreview) {
        return {
          autorizado: false,
          motivoBloqueio: 'A assinatura da Presidência não é exibida em pré-visualizações sem deliberação prévia registrada.',
        };
      }

      // Validar formalmente deliberação no backend
      if (!memberId && !documentoId) {
        return {
          autorizado: false,
          motivoBloqueio: 'Identificação do membro ou documento ausente para validar a deliberação presidencial.',
        };
      }
    }

    const admin = createServerClient();

    if (isCartaRestrita && tipoAssinatura === 'assinatura_presidente') {
      const tipoNormalizado = contextoDocumento?.includes('desligamento') ? 'desligamento' : 'mudanca';

      const validacao = await CartasService.validarEmissaoOuImpressaoCarta(
        admin,
        ministryId,
        memberId || '',
        tipoNormalizado,
        '',
        nivelOperador || ''
      );

      if (!validacao.autorizado) {
        return {
          autorizado: false,
          motivoBloqueio: validacao.mensagem || 'Emissão não autorizada pela Presidência.',
        };
      }

      deliberacaoInfo = {
        pedidoId: validacao.pedidoId,
        autorizadorNome: validacao.autorizadorNome,
        dataAutorizacao: validacao.dataAutorizacao,
      };
    }

    // 2. Buscar a imagem no perfil do ministério (configurations.church_profile)
    const { data: configRow, error: configErr } = await admin
      .from('configurations')
      .select('church_profile')
      .eq('ministry_id', ministryId)
      .maybeSingle();

    if (configErr) {
      console.error('[AssinaturasInstitucionaisService] Erro ao consultar configurations:', configErr);
      return {
        autorizado: false,
        motivoBloqueio: 'Erro ao consultar configurações institucionais.',
      };
    }

    const churchProfile = (configRow as any)?.church_profile || {};
    const imagemBase64 = churchProfile[tipoAssinatura] || null;

    if (!imagemBase64) {
      return {
        autorizado: false,
        motivoBloqueio: `Assinatura "${tipoAssinatura}" não cadastrada no perfil institucional do ministério.`,
      };
    }

    return {
      autorizado: true,
      imagemBase64,
      deliberacao: deliberacaoInfo,
    };
  }
}
