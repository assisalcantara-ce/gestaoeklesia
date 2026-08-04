import { AceitesRepository } from '@/repositories/AceitesRepository';
import type { TenantAceite, RegistrarAceiteDTO } from '@/types/juridico';

export class AceitesService {
  private repository: AceitesRepository;

  constructor(customClient?: any) {
    this.repository = new AceitesRepository(customClient);
  }

  async registrarAceite(dto: RegistrarAceiteDTO): Promise<TenantAceite> {
    if (!dto.ministry_id || dto.ministry_id.trim().length === 0) {
      throw new Error('O ID do ministério (ministry_id) é obrigatório.');
    }
    if (!dto.user_id || dto.user_id.trim().length === 0) {
      throw new Error('O ID do usuário (user_id) é obrigatório.');
    }
    if (!dto.documento_id || dto.documento_id.trim().length === 0) {
      throw new Error('O ID do documento (documento_id) é obrigatório.');
    }
    if (!dto.versao_aceita || dto.versao_aceita.trim().length === 0) {
      throw new Error('A versão aceita (versao_aceita) é obrigatória.');
    }
    if (!dto.hash_documento || dto.hash_documento.trim().length === 0) {
      throw new Error('O hash do documento (hash_documento) é obrigatório.');
    }

    const ministryId = dto.ministry_id.trim();
    const userId = dto.user_id.trim();
    const documentoId = dto.documento_id.trim();
    const versaoAceita = dto.versao_aceita.trim();

    // Impedir registro duplicado do mesmo aceite
    const jaAceitou = await this.verificarSeUsuarioAceitouVersao(
      ministryId,
      userId,
      documentoId,
      versaoAceita
    );

    if (jaAceitou) {
      throw new Error(
        `O usuário "${userId}" já registrou o aceite da versão "${versaoAceita}" deste documento no tenant.`
      );
    }

    return this.repository.registrar({
      ...dto,
      ministry_id: ministryId,
      user_id: userId,
      documento_id: documentoId,
      versao_aceita: versaoAceita,
      hash_documento: dto.hash_documento.trim(),
    });
  }

  async consultarAceitesPorUsuario(userId: string, ministryId?: string): Promise<TenantAceite[]> {
    if (!userId || userId.trim().length === 0) {
      throw new Error('O ID do usuário é obrigatório.');
    }
    return this.repository.consultarPorUsuario(userId.trim(), ministryId?.trim());
  }

  async consultarAceitesPorDocumento(documentoId: string, ministryId?: string): Promise<TenantAceite[]> {
    if (!documentoId || documentoId.trim().length === 0) {
      throw new Error('O ID do documento é obrigatório.');
    }
    return this.repository.consultarPorDocumento(documentoId.trim(), ministryId?.trim());
  }

  async verificarSeUsuarioAceitouVersao(
    ministryId: string,
    userId: string,
    documentoId: string,
    versaoAceita: string
  ): Promise<boolean> {
    if (!ministryId || ministryId.trim().length === 0) {
      throw new Error('O ID do ministério é obrigatório para verificar o aceite.');
    }
    if (!userId || userId.trim().length === 0) {
      throw new Error('O ID do usuário é obrigatório para verificar o aceite.');
    }
    if (!documentoId || documentoId.trim().length === 0) {
      throw new Error('O ID do documento é obrigatório para verificar o aceite.');
    }
    if (!versaoAceita || versaoAceita.trim().length === 0) {
      throw new Error('A versão aceita é obrigatória para verificar o aceite.');
    }

    const aceite = await this.repository.buscarAceiteEspecifico(
      ministryId.trim(),
      userId.trim(),
      documentoId.trim(),
      versaoAceita.trim()
    );

    return !!aceite;
  }
}
