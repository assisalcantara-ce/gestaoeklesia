import { ContratosRepository } from '@/repositories/ContratosRepository';
import { DocumentosJuridicosService } from '@/services/DocumentosJuridicosService';
import { AuditoriaJuridicaService } from '@/services/AuditoriaJuridicaService';
import { resolverUsuarioIndividual } from '@/lib/user-resolver';
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

    // 1. Localizar o plano comercial real do tenant via MaterializacaoContratoService
    const { MaterializacaoContratoService } = await import('@/services/MaterializacaoContratoService');
    const matService = new MaterializacaoContratoService(this.repository['client']);
    const dadosTenant = await matService.obterDadosOficiaisTenant(cleanMinistryId, dto.assinado_por || undefined);

    const cleanPlano = dadosTenant.planoNome;
    const valorMensalReal = dto.valor_mensal !== undefined ? dto.valor_mensal : dadosTenant.valorMensal;

    // 2. Localizar o documento PUBLICADO vigente do tipo CONTRATO_SERVICO
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

    // Materializar o conteúdo contratual com os dados oficiais do tenant
    const matResultado = matService.materializarConteudo(docVigente.conteudo_md, dadosTenant);

    const dataInicio = dto.data_inicio ? new Date(dto.data_inicio).toISOString() : new Date().toISOString();
    const numeroContrato = dadosTenant.numeroContrato;

    // 3. Persistir registro do contrato com status = AGUARDANDO_ASSINATURA e snapshot imutável
    const contratoCriado = await this.repository.criar({
      ministry_id: cleanMinistryId,
      documento_base_id: docVigente.id,
      documento_raiz_id: docVigente.documento_raiz_id || docVigente.id,
      versao_documento: docVigente.versao,
      hash_documento: matResultado.hashSha256,
      plano_contratado: cleanPlano,
      numero_contrato: numeroContrato,
      conteudo_customizado: matResultado.conteudoMaterializado,
      status: 'AGUARDANDO_ASSINATURA',
      valor_mensal: valorMensalReal,
      snapshot_status: 'INTEGRO_IMUTAVEL',
      origem_snapshot: 'CELEBRACAO_ORIGINAL',
      integridade_verificada: true,
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

  /**
   * Busca os detalhes completos do contrato e histórico de documentos institucionais do tenant.
   * Método 100% READ-ONLY que busca a versão histórica exata contratada, o histórico de aceites
   * e o diagnóstico de integridade sem executar nenhuma mutação no banco de dados.
   */
  async buscarDetalhesContratoTenant(ministryId: string): Promise<import('@/types/juridico').DetalhesContratoTenantDTO> {
    if (!ministryId || ministryId.trim().length === 0) {
      throw new Error('O ID do ministério (ministry_id) é obrigatório.');
    }

    const cleanMinistryId = ministryId.trim();

    // 1. Buscar o contrato mais recente do tenant (consulta READ-ONLY)
    const contratos = await this.repository.buscarPorMinistryId(cleanMinistryId);
    // Seleciona preferencialmente o contrato ATIVO vigência atual
    const contrato = contratos.find((c) => c.status === 'ATIVO') || contratos[0] || null;

    let documentoBase: import('@/types/juridico').DocumentoJuridico | null = null;
    let assinadoPorUsuario: { id: string; email?: string | null; full_name?: string | null } | null = null;
    let conteudoEfetivo: string | null = null;

    if (contrato) {
      // Prioridade 1: Conteúdo customizado / snapshot imutável salvo diretamente no contrato
      if (contrato.conteudo_customizado && contrato.conteudo_customizado.trim().length > 0) {
        conteudoEfetivo = contrato.conteudo_customizado;
      }

      // Buscar documento base por documento_base_id se existir
      if (contrato.documento_base_id) {
        try {
          documentoBase = await this.documentosService.buscarPorId(contrato.documento_base_id);
        } catch {}
      }

      // Se ainda não tiver documento base nem snapshot, buscar modelo matriz publicado para visualização de referência (READ-ONLY)
      if (!documentoBase) {
        try {
          const documentosPublicados = await this.documentosService.listarDocumentos({
            tipo: 'CONTRATO_SERVICO',
            status: 'PUBLICADO',
            ativo: true,
          });
          documentoBase = documentosPublicados[0] || null;
        } catch {}
      }

      // Se o snapshot não existe, utilizar o texto do documento base como referência visual em memória (sem gravar no DB)
      if (!conteudoEfetivo && documentoBase) {
        conteudoEfetivo = documentoBase.conteudo_md;
      }

      // Buscar informações do usuário representante que realizou a assinatura (se assinado_por estiver preenchido)
      if (contrato.assinado_por) {
        const client = (this.repository as any).client;
        const usuarioResolvido = await resolverUsuarioIndividual(client, contrato.assinado_por);

        if (usuarioResolvido) {
          assinadoPorUsuario = {
            id: usuarioResolvido.id,
            email: usuarioResolvido.email || null,
            full_name: usuarioResolvido.name || null,
          };
        } else {
          assinadoPorUsuario = { id: contrato.assinado_por };
        }
      }
    }

    // 2. Montar histórico de documentos e contratos institucionais do tenant
    // Buscar todos os aceites do tenant
    const { data: todosAceites } = await (this.repository as any).client
      .from('tenant_aceites')
      .select('*')
      .eq('ministry_id', cleanMinistryId)
      .order('aceito_em', { ascending: false });

    const aceitesDoTenant = (todosAceites || []) as import('@/types/juridico').TenantAceite[];

    // Buscar todos os documentos jurídicos para mapear tipo, escopo e conteúdo
    const todosDocs = await this.documentosService.listarDocumentos({});
    const mapaDocs = new Map(todosDocs.map((d) => [d.id, d]));

    // Filtrar apenas aceites institucionais (CONTRATO_SERVICO, ADITIVO ou escopo INSTITUCIONAL)
    const aceitesInstitucionais = aceitesDoTenant.filter((a) => {
      const doc = mapaDocs.get(a.documento_id);
      if (!doc) return true; // Se não achar o doc, inclui no histórico preventivamente
      return doc.escopo === 'INSTITUCIONAL' || ['CONTRATO_SERVICO', 'ADITIVO'].includes(doc.tipo);
    });

    // Coletar IDs de usuários para resolver nomes
    const userIds = Array.from(new Set(aceitesInstitucionais.map((a) => a.user_id).filter(Boolean)));
    const mapaUsuarios = new Map<string, { full_name?: string | null; email?: string | null }>();

    if (userIds.length > 0) {
      const { data: profiles } = await (this.repository as any).client
        .from('profiles')
        .select('id, email, full_name, nome')
        .in('id', userIds);

      (profiles || []).forEach((p: any) => {
        mapaUsuarios.set(p.id, {
          email: p.email || null,
          full_name: p.full_name || p.nome || null,
        });
      });
    }

    const historicoDocumentos: import('@/types/juridico').ItemHistoricoDocumentoInstitucionalDTO[] = aceitesInstitucionais.map((a) => {
      const doc = mapaDocs.get(a.documento_id);
      const userObj = mapaUsuarios.get(a.user_id);

      return {
        id: a.id,
        tipo: doc?.tipo || 'CONTRATO_SERVICO',
        titulo: doc?.titulo || 'Contrato de Prestação de Serviços',
        versao: a.versao_aceita,
        hash_sha256: a.hash_documento,
        aceito_em: a.aceito_em,
        aceito_por_id: a.user_id,
        aceito_por_nome: userObj?.full_name || null,
        aceito_por_email: userObj?.email || null,
        conteudo_md: doc?.conteudo_md || null,
      };
    });

    // 3. Executar diagnóstico de integridade em memória (100% READ-ONLY)
    const { ValidadorIntegridadeJuridicaService } = await import('@/services/ValidadorIntegridadeJuridicaService');
    const validador = new ValidadorIntegridadeJuridicaService();
    const ultimoAceiteInstitucional = aceitesInstitucionais[0] || null;
    const diagnostico = validador.diagnosticarIntegridade(contrato, ultimoAceiteInstitucional);

    return {
      contrato,
      documento_base: documentoBase,
      assinado_por_usuario: assinadoPorUsuario,
      conteudo_efetivo: conteudoEfetivo,
      historico_documentos: historicoDocumentos,
      diagnostico_integridade: diagnostico,
    };
  }
}
