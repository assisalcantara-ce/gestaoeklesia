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
   * Método tenant-safe que busca a versão histórica exata contratada e o histórico de aceites institucionais.
   */
  async buscarDetalhesContratoTenant(ministryId: string): Promise<import('@/types/juridico').DetalhesContratoTenantDTO> {
    if (!ministryId || ministryId.trim().length === 0) {
      throw new Error('O ID do ministério (ministry_id) é obrigatório.');
    }

    const cleanMinistryId = ministryId.trim();

    // 1. Buscar o contrato mais recente do tenant
    const contratos = await this.repository.buscarPorMinistryId(cleanMinistryId);
    const contrato = contratos[0] || null;

    let documentoBase: import('@/types/juridico').DocumentoJuridico | null = null;
    let assinadoPorUsuario: { id: string; email?: string | null; full_name?: string | null } | null = null;
    let conteudoEfetivo: string | null = null;

    if (contrato) {
      // Verificar se o contrato necessita de reparação de snapshot (se for legado, sem conteudo_customizado ou com plano PADRAO)
      const precisaReparacao =
        !contrato.conteudo_customizado ||
        contrato.conteudo_customizado.trim().length === 0 ||
        contrato.conteudo_customizado.includes('Pessoa jurídica regularmente cadastrada') ||
        contrato.conteudo_customizado.includes('{{CONTRATANTE_NOME}}') ||
        contrato.plano_contratado === 'PADRAO' ||
        !contrato.plano_contratado;

      if (precisaReparacao) {
        try {
          const { MaterializacaoContratoService } = await import('@/services/MaterializacaoContratoService');
          const matService = new MaterializacaoContratoService((this.repository as any).client);
          const dadosTenant = await matService.obterDadosOficiaisTenant(cleanMinistryId, contrato.assinado_por || undefined);

          // Buscar documento base para servir de matriz
          let docBaseParaMatriz: import('@/types/juridico').DocumentoJuridico | null = documentoBase;
          if (!docBaseParaMatriz) {
            const documentosPublicados = await this.documentosService.listarDocumentos({
              tipo: 'CONTRATO_SERVICO',
              status: 'PUBLICADO',
              ativo: true,
            });
            docBaseParaMatriz = documentosPublicados[0] || null;
          }

          if (docBaseParaMatriz) {
            const matResultado = matService.materializarConteudo(docBaseParaMatriz.conteudo_md, dadosTenant);

            const payloadAtualizacao = {
              documento_base_id: contrato.documento_base_id || docBaseParaMatriz.id,
              documento_raiz_id: contrato.documento_raiz_id || docBaseParaMatriz.documento_raiz_id || docBaseParaMatriz.id,
              versao_documento: contrato.versao_documento || docBaseParaMatriz.versao,
              hash_documento: matResultado.hashSha256,
              plano_contratado: dadosTenant.planoNome,
              valor_mensal: contrato.valor_mensal !== null && contrato.valor_mensal !== undefined ? contrato.valor_mensal : dadosTenant.valorMensal,
              conteudo_customizado: matResultado.conteudoMaterializado,
              numero_contrato: contrato.numero_contrato || dadosTenant.numeroContrato,
            };

            // Atualizar o banco de dados com a materialização oficial
            await (this.repository as any).client
              .from('tenant_contratos')
              .update(payloadAtualizacao)
              .eq('id', contrato.id);

            // Atualizar objeto em memória para retorno consistente
            contrato.conteudo_customizado = matResultado.conteudoMaterializado;
            contrato.hash_documento = matResultado.hashSha256;
            contrato.plano_contratado = dadosTenant.planoNome;
            contrato.valor_mensal = payloadAtualizacao.valor_mensal;
            contrato.numero_contrato = payloadAtualizacao.numero_contrato;
            documentoBase = docBaseParaMatriz;
          }
        } catch (repErr) {
          console.warn('[ContratosService] Erro ao efetuar reparação de contrato legado:', repErr);
        }
      }

      // Definir conteúdo efetivo do snapshot impresso
      conteudoEfetivo = contrato.conteudo_customizado || null;

      // Se ainda não tiver documento base carregado, carregar por documento_base_id
      if (!documentoBase && contrato.documento_base_id) {
        try {
          documentoBase = await this.documentosService.buscarPorId(contrato.documento_base_id);
        } catch {}
      }

      // Buscar informações do usuário representante que realizou a assinatura (se assinado_por estiver preenchido)
      if (contrato.assinado_por) {
        const client = (this.repository as any).client;
        const { data: userData } = await client
          .from('profiles')
          .select('id, email, full_name, nome')
          .eq('id', contrato.assinado_por)
          .maybeSingle();

        if (userData) {
          assinadoPorUsuario = {
            id: userData.id,
            email: userData.email || null,
            full_name: userData.full_name || userData.nome || null,
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

    return {
      contrato,
      documento_base: documentoBase,
      assinado_por_usuario: assinadoPorUsuario,
      conteudo_efetivo: conteudoEfetivo,
      historico_documentos: historicoDocumentos,
    };
  }
}
