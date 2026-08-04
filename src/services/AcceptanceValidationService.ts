import { DocumentosJuridicosService } from '@/services/DocumentosJuridicosService';
import { AceitesService } from '@/services/AceitesService';
import type {
  ResultadoValidacaoAceitesDTO,
  DocumentoPendenteAceiteDTO,
} from '@/types/juridico';

export class AcceptanceValidationService {
  private documentosService: DocumentosJuridicosService;
  private aceitesService: AceitesService;

  constructor(customClient?: any) {
    this.documentosService = new DocumentosJuridicosService(customClient);
    this.aceitesService = new AceitesService(customClient);
  }

  /**
   * Avalia se um determinado usuário possui pendências de aceite de documentos jurídicos OBRIGATÓRIOS e PUBLICADOS.
   *
   * @param userId Identificador único do usuário
   * @param ministryId Identificador único do tenant / ministério
   * @returns Estrutura com status de pendência e lista de documentos a serem aceitos
   */
  async verificarPendenciasAceite(
    userId: string,
    ministryId: string
  ): Promise<ResultadoValidacaoAceitesDTO> {
    if (!userId || userId.trim().length === 0) {
      throw new Error('O ID do usuário é obrigatório para validação de aceites.');
    }
    if (!ministryId || ministryId.trim().length === 0) {
      throw new Error('O ID do ministério (ministry_id) é obrigatório para validação de aceites.');
    }

    const cleanUserId = userId.trim();
    const cleanMinistryId = ministryId.trim();

    // 1. Buscar todos os documentos com status PUBLICADO, ativo = true e obrigatorio = true
    const todosDocumentos = await this.documentosService.listarDocumentos({
      status: 'PUBLICADO',
      ativo: true,
    });

    const documentosObrigatorios = todosDocumentos.filter((doc) => doc.obrigatorio === true);

    // 2. Agrupar por tipo de documento e identificar a versão vigente (a mais recente publicada)
    const mapaVigentesPorTipo = new Map<string, typeof documentosObrigatorios[0]>();

    for (const doc of documentosObrigatorios) {
      const docExistente = mapaVigentesPorTipo.get(doc.tipo);
      if (!docExistente) {
        mapaVigentesPorTipo.set(doc.tipo, doc);
      } else {
        // Se houver mais de um publicado do mesmo tipo, comparar data de publicação/criação
        const dataExistente = new Date(docExistente.publicado_em || docExistente.created_at).getTime();
        const dataNova = new Date(doc.publicado_em || doc.created_at).getTime();
        if (dataNova > dataExistente) {
          mapaVigentesPorTipo.set(doc.tipo, doc);
        }
      }
    }

    const documentosVigentes = Array.from(mapaVigentesPorTipo.values());
    const documentosPendentes: DocumentoPendenteAceiteDTO[] = [];

    // Carregar histórico de aceites do usuário no tenant para rastrear a última versão aceita
    const aceitesUsuario = await this.aceitesService.consultarAceitesPorUsuario(cleanUserId, cleanMinistryId);

    // 3. Para cada documento vigente obrigatório, verificar se o usuário aceitou exatamente essa versão
    for (const doc of documentosVigentes) {
      const jaAceitouExata = await this.aceitesService.verificarSeUsuarioAceitouVersao(
        cleanMinistryId,
        cleanUserId,
        doc.id,
        doc.versao
      );

      if (!jaAceitouExata) {
        // Buscar se o usuário já aceitou alguma versão anterior deste mesmo tipo de documento
        // Rastreando por documento_id ou filtrando aceites históricos do usuário
        const aceitesDoTipo = aceitesUsuario.filter(
          (a) => a.documento_id === doc.id || a.documento_id === doc.documento_raiz_id
        );

        // Se houver mais de um aceite histórico, pegar o mais recente
        const ultimoAceite = aceitesDoTipo.length > 0
          ? aceitesDoTipo.sort((a, b) => new Date(b.aceito_em).getTime() - new Date(a.aceito_em).getTime())[0]
          : null;

        documentosPendentes.push({
          id: doc.id,
          tipo: doc.tipo,
          titulo: doc.titulo,
          versao: doc.versao,
          versao_publicada: doc.versao,
          ultima_versao_aceita: ultimoAceite ? ultimoAceite.versao_aceita : null,
          hash_sha256: doc.hash_sha256,
          publicado_em: doc.publicado_em,
          obrigatorio: doc.obrigatorio,
        });
      }
    }

    return {
      possui_pendencias: documentosPendentes.length > 0,
      total_pendencias: documentosPendentes.length,
      documentos_pendentes: documentosPendentes,
    };
  }
}
