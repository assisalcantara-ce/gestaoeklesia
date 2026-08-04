import { AcceptanceValidationService } from '@/services/AcceptanceValidationService';
import type { ResultadoValidacaoAceitesDTO } from '@/types/juridico';

export class JuridicoAcceptanceMiddleware {
  private validationService: AcceptanceValidationService;

  constructor(customClient?: any) {
    this.validationService = new AcceptanceValidationService(customClient);
  }

  /**
   * Invoca a infraestrutura de validação de aceites obrigatórios para um contexto de usuário e tenant.
   * Não realiza bloqueio ou redirecionamento HTTP nesta etapa, retornando a estrutura de diagnósticos.
   *
   * @param userId Identificador único do usuário autenticado
   * @param ministryId Identificador único do ministério / tenant
   * @returns Estrutura detalhada de diagnóstico de aceites pendentes
   */
  async validarAceitesUsuario(
    userId: string,
    ministryId: string
  ): Promise<ResultadoValidacaoAceitesDTO> {
    return this.validationService.verificarPendenciasAceite(userId, ministryId);
  }
}
