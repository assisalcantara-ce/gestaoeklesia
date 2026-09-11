import crypto from 'crypto';
import { SupabaseClient } from '@supabase/supabase-js';
import { resolverUsuarioIndividual } from '@/lib/user-resolver';

export interface DadosMaterializacaoTenant {
  ministryId: string;
  nomeInstitucao: string;
  cnpj: string | null;
  endereco: string | null;
  nomeMaster: string | null;
  emailMaster: string | null;
  planoNome: string;
  valorMensal: number | null;
  periodicidade: string;
  dataInicio: string;
  numeroContrato: string;
}

export interface ResultadoMaterializacao {
  conteudoMaterializado: string;
  hashSha256: string;
  dadosUtilizados: DadosMaterializacaoTenant;
}

export class MaterializacaoContratoService {
  private client: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.client = client;
  }

  /**
   * Coleta dados cadastrais reais e oficiais do tenant, assinaturas, planos e MASTER.
   */
  async obterDadosOficiaisTenant(ministryId: string, userIdMaster?: string): Promise<DadosMaterializacaoTenant> {
    if (!ministryId || ministryId.trim().length === 0) {
      throw new Error('O ID do ministério é obrigatório para materialização do contrato.');
    }

    const cleanMinistryId = ministryId.trim();

    // 1. Consultar a tabela `ministries`
    const { data: ministry, error: ministryErr } = await this.client
      .from('ministries')
      .select('*')
      .eq('id', cleanMinistryId)
      .single();

    if (ministryErr || !ministry) {
      throw new Error(`Ministério com ID "${cleanMinistryId}" não foi localizado.`);
    }

    // 2. Resolver dados do MASTER
    const masterId = userIdMaster || ministry.user_id;
    let nomeMaster: string | null = null;
    let emailMaster: string | null = null;

    if (masterId) {
      const usuarioResolvido = await resolverUsuarioIndividual(this.client, masterId);
      if (usuarioResolvido) {
        nomeMaster = usuarioResolvido.name || null;
        emailMaster = usuarioResolvido.email || null;
      }
    }

    // 3. Resolver CNPJ e Endereço das tabelas de configuração ou campos de ministries
    let cnpj: string | null = ministry.cnpj_cpf || ministry.cnpj || ministry.documento || null;
    let endereco: string | null = ministry.endereco || null;

    // Se não tiver cnpj/endereço em ministries, buscar na tabela `igreja_config` ou `configuracoes`
    if (!cnpj || !endereco) {
      const { data: configIgreja } = await this.client
        .from('igreja_config')
        .select('cnpj, endereco, numero, bairro, cidade, uf, cep')
        .eq('ministry_id', cleanMinistryId)
        .maybeSingle();

      if (configIgreja) {
        if (!cnpj && configIgreja.cnpj) cnpj = configIgreja.cnpj;
        if (!endereco && configIgreja.endereco) {
          const partes = [
            configIgreja.endereco,
            configIgreja.numero ? `nº ${configIgreja.numero}` : null,
            configIgreja.bairro,
            configIgreja.cidade && configIgreja.uf ? `${configIgreja.cidade}/${configIgreja.uf}` : configIgreja.cidade,
            configIgreja.cep ? `CEP ${configIgreja.cep}` : null,
          ].filter(Boolean);
          endereco = partes.join(', ');
        }
      }
    }

    // 4. Resolver Plano Comercial Oficial via PlanResolutionService (tabela oficial subscription_plans)
    const { PlanResolutionService } = await import('@/lib/platform/billing/PlanResolutionService');
    const planoResolvido = await PlanResolutionService.resolveMinistryPlan(this.client, cleanMinistryId);

    let planoNome: string | null = null;
    let valorMensal: number | null = null;

    if (planoResolvido) {
      planoNome = planoResolvido.name;
      valorMensal = planoResolvido.price_monthly;
    }

    // Se o plano ainda estiver indefinido ou for inválido, bloquear com erro técnico explícito
    if (!planoNome) {
      throw new Error(`Inconsistência cadastral: O ministério "${ministry.name || cleanMinistryId}" não possui um plano comercial ativo válido definido na plataforma.`);
    }

    const dataInicio = ministry.subscription_start_date || ministry.created_at || new Date().toISOString();
    const numeroContrato = `CTR-${cleanMinistryId.slice(0, 8).toUpperCase()}-${new Date(dataInicio).getFullYear()}`;

    return {
      ministryId: cleanMinistryId,
      nomeInstitucao: ministry.name || ministry.nome_fantasia || 'Instituição Contratante',
      cnpj: cnpj || null,
      endereco: endereco || null,
      nomeMaster: nomeMaster || null,
      emailMaster: emailMaster || null,
      planoNome: planoNome,
      valorMensal: valorMensal,
      periodicidade: 'Mensal',
      dataInicio: new Date(dataInicio).toLocaleDateString('pt-BR'),
      numeroContrato: numeroContrato,
    };
  }

  /**
   * Interpola os placeholders do Markdown com os dados reais do tenant e calcula o SHA-256 final imutável.
   */
  materializarConteudo(conteudoMdBase: string, dados: DadosMaterializacaoTenant): ResultadoMaterializacao {
    let conteudo = conteudoMdBase || '';

    const formatarMoeda = (val: number | null) => {
      if (val === null || val === undefined) return 'Conforme Tabela de Preços Vigente';
      return `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    const mapaPlaceholders: Record<string, string> = {
      '{{CONTRATANTE_NOME}}': dados.nomeInstitucao,
      '{{CONTRATANTE_CNPJ}}': dados.cnpj ? `CNPJ nº ${dados.cnpj}` : 'CNPJ não informado',
      '{{CONTRATANTE_ENDERECO}}': dados.endereco || 'Endereço cadastral na plataforma',
      '{{REPRESENTANTE_NOME}}': dados.nomeMaster || 'Representante Legal Cadastrado',
      '{{REPRESENTANTE_EMAIL}}': dados.emailMaster || 'E-mail principal do responsável',
      '{{PLANO_NOME}}': dados.planoNome,
      '{{VALOR_CONTRATADO}}': formatarMoeda(dados.valorMensal),
      '{{PERIODICIDADE}}': dados.periodicidade,
      '{{DATA_INICIO}}': dados.dataInicio,
      '{{NUMERO_CONTRATO}}': dados.numeroContrato,
    };

    // Substituir todos os placeholders
    Object.entries(mapaPlaceholders).forEach(([key, val]) => {
      const regex = new RegExp(key.replace(/[{}]/g, '\\$&'), 'g');
      conteudo = conteudo.replace(regex, val);
    });

    // Se o documento original não possuía bloco de cabeçalho com os dados do contratante, injetar um bloco formal padronizado
    if (!conteudo.includes(dados.nomeInstitucao) && !conteudo.includes('{{CONTRATANTE_NOME}}')) {
      const cabecalhoFormal = `
### ANEXO DE QUALIFICAÇÃO E CONDIÇÕES PARTICULARES

**CONTRATANTE:** ${dados.nomeInstitucao}  
**CNPJ:** ${dados.cnpj ? dados.cnpj : 'Pessoa Jurídica/Instituição cadastrada na plataforma'}  
**ENDEREÇO:** ${dados.endereco || 'Endereço cadastral'}  
**REPRESENTANTE LEGAL (MASTER):** ${dados.nomeMaster || 'Responsável Principal'} (${dados.emailMaster || 'Email cadastrado'})  

**CONDIÇÕES COMERCIAIS CONTRATADAS:**  
- **Plano de Assinatura:** ${dados.planoNome}  
- **Valor da Mensalidade:** ${formatarMoeda(dados.valorMensal)}  
- **Periodicidade:** ${dados.periodicidade}  
- **Data de Início da Vigência:** ${dados.dataInicio}  
- **Número de Controle Interno:** ${dados.numeroContrato}  

---

`;
      conteudo = cabecalhoFormal + conteudo;
    }

    // Calcular o SHA-256 exato do conteúdo final materializado
    const hashSha256 = crypto.createHash('sha256').update(conteudo).digest('hex');

    return {
      conteudoMaterializado: conteudo,
      hashSha256,
      dadosUtilizados: dados,
    };
  }
}
