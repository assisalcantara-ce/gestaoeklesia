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

    // 2. Agrupar por documento_raiz_id (documento lógico) e identificar a versão vigente (a mais recente publicada)
    const mapaVigentesPorRaiz = new Map<string, typeof documentosObrigatorios[0]>();

    for (const doc of documentosObrigatorios) {
      const raizId = doc.documento_raiz_id || doc.id;
      const docExistente = mapaVigentesPorRaiz.get(raizId);
      if (!docExistente) {
        mapaVigentesPorRaiz.set(raizId, doc);
      } else {
        // Se houver mais de um publicado para a mesma raiz lógica, comparar data de publicação/criação
        const dataExistente = new Date(docExistente.publicado_em || docExistente.created_at).getTime();
        const dataNova = new Date(doc.publicado_em || doc.created_at).getTime();
        if (dataNova > dataExistente) {
          mapaVigentesPorRaiz.set(raizId, doc);
        }
      }
    }

    const documentosVigentes = Array.from(mapaVigentesPorRaiz.values());
    const documentosPendentes: DocumentoPendenteAceiteDTO[] = [];

    // Carregar histórico de aceites do usuário no tenant para rastrear a última versão aceita
    const aceitesUsuario = await this.aceitesService.consultarAceitesPorUsuario(cleanUserId, cleanMinistryId);

    // Buscar todas as versões de documentos para resolver documento_raiz_id dos aceites se necessário
    const todosDocs = await this.documentosService.listarDocumentos({});
    const mapaDocsPorId = new Map(todosDocs.map((d) => [d.id, d]));

    // 3. Para cada documento vigente obrigatório, verificar se o usuário aceitou exatamente essa versão
    for (const doc of documentosVigentes) {
      const raizIdAtual = doc.documento_raiz_id || doc.id;

      const jaAceitouExata = await this.aceitesService.verificarSeUsuarioAceitouVersao(
        cleanMinistryId,
        cleanUserId,
        doc.id,
        doc.versao
      );

      if (!jaAceitouExata) {
        // Rastrear aceites que pertencem estritamente ao mesmo documento_raiz_id
        const aceitesDoMesmoDocumento = aceitesUsuario.filter((a) => {
          if (a.documento_id === doc.id || a.documento_id === raizIdAtual) return true;
          const docAceito = mapaDocsPorId.get(a.documento_id);
          if (docAceito) {
            const raizDocAceito = docAceito.documento_raiz_id || docAceito.id;
            return raizDocAceito === raizIdAtual;
          }
          return false;
        });

        // Se houver aceites históricos para este documento_raiz_id, obter o mais recente
        const ultimoAceite = aceitesDoMesmoDocumento.length > 0
          ? aceitesDoMesmoDocumento.sort((a, b) => new Date(b.aceito_em).getTime() - new Date(a.aceito_em).getTime())[0]
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
