import { ContratosRepository } from '@/repositories/ContratosRepository';
import { DocumentosJuridicosService } from '@/services/DocumentosJuridicosService';
import { AuditoriaJuridicaService } from '@/services/AuditoriaJuridicaService';
import type { TenantContrato, CriarContratoVinculadoDTO } from '@/types/juridico';

export class ContratosService {
  private repository: ContratosRepository;
  private documentosService: DocumentosJuridicosService;
  private auditoriaService: AuditoriaJuridicaService;

  constructor(customClient?: any) {
    this.repository = new ContratosRepository(customClient);
    this.documentosService = new DocumentosJuridicosService(customClient);
    this.auditoriaService = new AuditoriaJuridicaService(customClient);
  }

  /**
   * Cria automaticamente o contrato vinculado para um tenant que está sendo convertido/ativado no Billing.
   * Associa o documento PUBLICADO vigente do tipo CONTRATO_SERVICO ao novo contrato com status ATIVO.
   */
  async criarContratoAoConverter(dto: CriarContratoVinculadoDTO): Promise<TenantContrato> {
    if (!dto.ministry_id || dto.ministry_id.trim().length === 0) {
      throw new Error('O ID do ministério (ministry_id) é obrigatório para gerar o contrato.');
    }
    if (!dto.plano_contratado || dto.plano_contratado.trim().length === 0) {
      throw new Error('O plano contratado é obrigatório para gerar o contrato.');
    }

    const cleanMinistryId = dto.ministry_id.trim();
    const cleanPlano = dto.plano_contratado.trim();

    // 1. Localizar o documento PUBLICADO vigente do tipo CONTRATO_SERVICO
    const documentosPublicados = await this.documentosService.listarDocumentos({
      tipo: 'CONTRATO_SERVICO',
      status: 'PUBLICADO',
      ativo: true,
    });

    if (documentosPublicados.length === 0) {
      throw new Error('Não há nenhum modelo de "CONTRATO_SERVICO" no status PUBLICADO vigente.');
    }

    // Se houver mais de um, selecionar o mais recente
    const docVigente = documentosPublicados.sort(
      (a, b) => new Date(b.publicado_em || b.created_at).getTime() - new Date(a.publicado_em || a.created_at).getTime()
    )[0];

    const dataInicio = dto.data_inicio ? new Date(dto.data_inicio).toISOString() : new Date().toISOString();
    const numeroContrato = `CTR-${cleanMinistryId.slice(0, 8).toUpperCase()}-${Date.now()}`;

    // 2. Persistir registro do contrato com status = AGUARDANDO_ASSINATURA (pendente de aceite formal pós-conversão)
    const contratoCriado = await this.repository.criar({
      ministry_id: cleanMinistryId,
      documento_base_id: docVigente.id,
      documento_raiz_id: docVigente.documento_raiz_id || docVigente.id,
      versao_documento: docVigente.versao,
      hash_documento: docVigente.hash_sha256 || 'HASH_INICIAL_CONTRATO',
      plano_contratado: cleanPlano,
      numero_contrato: numeroContrato,
      status: 'AGUARDANDO_ASSINATURA',
      valor_mensal: dto.valor_mensal !== undefined ? dto.valor_mensal : null,
      data_inicio: dataInicio,
      assinado_por: dto.assinado_por || null,
    });

    // 3. Registrar auditoria obrigatória da criação do contrato
    await this.auditoriaService.registrarEvento({
      usuario_id: dto.assinado_por || '00000000-0000-0000-0000-000000000000',
      ministry_id: cleanMinistryId,
      documento_id: docVigente.id,
      versao: docVigente.versao,
      hash_documento: docVigente.hash_sha256 || 'HASH_INICIAL_CONTRATO',
      tipo_evento: 'CONTRATO_CRIADO',
      detalhes: {
        contrato_id: contratoCriado.id,
        numero_contrato: contratoCriado.numero_contrato,
        plano_contratado: cleanPlano,
        status: contratoCriado.status,
        data_inicio: contratoCriado.data_inicio,
      },
    });

    return contratoCriado;
  }

  /**
   * Verifica se o tenant possui algum contrato comercial no status AGUARDANDO_ASSINATURA.
   * Utilizado para sinalizar o aceite contratual pendente pós-conversão comercial.
   */
  async verificarContratoPendenteAssinatura(ministryId: string): Promise<TenantContrato | null> {
    if (!ministryId || ministryId.trim().length === 0) return null;
    const contratos = await this.repository.buscarPorMinistryId(ministryId.trim());
    const pendente = contratos.find((c) => c.status === 'AGUARDANDO_ASSINATURA');
    return pendente || null;
  }
}
