/**
 * Serviço de Negócio e Governança do Módulo de Discipulado
 * Gestão Eklésia — Fase 1: Fundação e Acolhimento
 *
 * Regras Estritas:
 * 1. Telefone é usado na entrada para localizar visitantes de culto_visitantes.
 * 2. CPF é o identificador oficial para busca/duplicidade na tabela members (Secretaria).
 * 3. Se o registro principal for 'membro' ou 'ministro', NUNCA é rebaixado.
 * 4. Conversão transacional vincula converted_to_member_id e converted_at em culto_visitantes,
 *    retirando-o da lista de visitantes ativos sem usar deleted_at (preserva integridade histórica).
 * 5. Garante 1 única jornada ativa por membro (uq_discipulado_membro_ativo), permitindo histórico de jornadas passadas.
 */

import { validarCpf as validarCpfOficial } from '../lib/mascaras.ts';

export interface VisitanteDiscipuladoBusca {
  id: string;
  nome: string;
  telefone: string | null;
  cidade: string | null;
  bairro: string | null;
  igreja_origem: string | null;
  congregacao_id: string | null;
  congregacao_nome?: string | null;
  ultimo_culto?: string | null;
  total_visitas: number;
}

export interface IniciarJornadaDiscipuladoInput {
  ministryId: string;
  congregacaoId?: string | null;
  telefone?: string | null;
  cpf: string;
  nome: string;
  dataNascimento?: string | null;
  sexo?: 'M' | 'F' | 'outro' | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
  cep?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  responsavelId?: string | null;
  visitanteId?: string | null;
  dataDecisao?: string;
  observacoes?: string | null;
}

export interface IniciarJornadaResult {
  sucesso: boolean;
  memberId: string;
  jornadaId: string;
  isNovoMember: boolean;
  tipoCadastroFinal: string;
  visitanteVinculado: boolean;
  mensagem: string;
}

export class DiscipuladoService {
  /**
   * Higieniza telefone mantendo somente dígitos.
   */
  public static normalizarTelefone(tel?: string | null): string {
    if (!tel) return '';
    return tel.replace(/\D/g, '');
  }

  /**
   * Higieniza CPF mantendo somente 11 dígitos.
   */
  public static normalizarCpf(cpf?: string | null): string {
    if (!cpf) return '';
    return cpf.replace(/\D/g, '').slice(0, 11);
  }

  /**
   * Algoritmo oficial de validação de CPF da Secretaria do Gestão Eklésia.
   */
  public static validarCPF(cpf: string): boolean {
    return validarCpfOficial(cpf);
  }

  public static async buscarVisitantesPorTelefone(
    supabase: any,
    ministryId: string,
    telefoneInput: string
  ): Promise<VisitanteDiscipuladoBusca[]> {
    const telDigitos = this.normalizarTelefone(telefoneInput);
    if (!telDigitos || telDigitos.length < 8) return [];

    const { data, error } = await supabase
      .from('culto_visitantes')
      .select(`
        id, nome, telefone, cidade, bairro, igreja_origem, congregacao_id,
        created_at, deleted_at, converted_to_member_id,
        congregacoes ( id, nome )
      `)
      .eq('ministry_id', ministryId)
      .is('converted_to_member_id', null)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error || !data) {
      console.error('[DiscipuladoService.buscarVisitantesPorTelefone]', error);
      return [];
    }

    // Filtragem em memória pelos dígitos do telefone para imunidade a formatos de máscaras
    const match = data.filter((v: any) => {
      const vTel = this.normalizarTelefone(v.telefone);
      return vTel.includes(telDigitos) || telDigitos.includes(vTel);
    });

    return match.map((v: any) => ({
      id: v.id,
      nome: v.nome,
      telefone: v.telefone,
      cidade: v.cidade,
      bairro: v.bairro,
      igreja_origem: v.igreja_origem,
      congregacao_id: v.congregacao_id,
      congregacao_nome: v.congregacoes?.nome || null,
      total_visitas: 1,
    }));
  }

  /**
   * Busca pessoa existente na base principal (members) pelo CPF.
   */
  public static async buscarMembroPorCpf(
    supabase: any,
    ministryId: string,
    cpf: string
  ) {
    const cleanCpf = this.normalizarCpf(cpf);
    if (cleanCpf.length !== 11) return null;

    const { data, error } = await supabase
      .from('members')
      .select('id, name, cpf, phone, celular, whatsapp, tipo_cadastro, status, cargo_ministerial, congregacao_id')
      .eq('ministry_id', ministryId)
      .eq('cpf', cleanCpf)
      .maybeSingle();

    if (error) {
      console.error('[DiscipuladoService.buscarMembroPorCpf]', error);
      return null;
    }

    return data;
  }

  /**
   * Converte o novo convertido e inicia a Jornada de Discipulado com integridade transacional.
   */
  public static async iniciarJornada(
    supabase: any,
    input: IniciarJornadaDiscipuladoInput
  ): Promise<IniciarJornadaResult> {
    const cleanCpf = this.normalizarCpf(input.cpf);
    if (!cleanCpf || !this.validarCPF(cleanCpf)) {
      throw new Error('CPF inválido. Forneça um CPF válido para registro oficial na Secretaria.');
    }

    if (!input.nome || !input.nome.trim()) {
      throw new Error('O nome do novo convertido é obrigatório.');
    }

    // 1. Execução Atômica via PostgreSQL RPC (ACID Transaction)
    if (typeof supabase?.rpc === 'function') {
      const { data: rpcData, error: rpcError } = await supabase.rpc('iniciar_jornada_discipulado_rpc', {
        p_ministry_id: input.ministryId,
        p_cpf: cleanCpf,
        p_nome: input.nome.trim(),
        p_telefone: this.normalizarTelefone(input.telefone) || null,
        p_congregacao_id: input.congregacaoId || null,
        p_responsavel_id: input.responsavelId || null,
        p_visitante_id: input.visitanteId || null,
        p_data_nascimento: input.dataNascimento || null,
        p_sexo: input.sexo || null,
        p_bairro: input.bairro || null,
        p_cidade: input.cidade || null,
        p_estado: input.estado || null,
        p_cep: input.cep || null,
        p_logradouro: input.logradouro || null,
        p_numero: input.numero || null,
        p_data_decisao: input.dataDecisao || null,
        p_observacoes: input.observacoes || null,
      });

      if (!rpcError && rpcData) {
        return {
          sucesso: true,
          memberId: rpcData.member_id,
          jornadaId: rpcData.jornada_id,
          isNovoMember: rpcData.is_novo_member,
          tipoCadastroFinal: rpcData.tipo_cadastro_final,
          visitanteVinculado: rpcData.visitante_vinculado,
          mensagem: rpcData.mensagem || 'Jornada iniciada com sucesso em transação atômica.',
        };
      }

      // Se a RPC falhou com regra de negócio ou validação, propaga imediatamente
      if (rpcError && rpcError.code !== '42883' && !rpcError.message?.includes('function public.iniciar_jornada_discipulado_rpc')) {
        throw new Error(rpcError.message || 'Erro na transação de discipulado.');
      }
    }

    // Fallback: Execução cliente-servidor resiliente caso a RPC não esteja carregada no ambiente de mock
    // 1. Verificar se já existe registro em members pelo CPF
    const membroExistente = await this.buscarMembroPorCpf(supabase, input.ministryId, cleanCpf);

    let memberId: string;
    let isNovoMember = false;
    let tipoCadastroFinal = 'congregado';

    if (membroExistente) {
      memberId = membroExistente.id;
      // Regra 3: Nunca rebaixar membros ou ministros existentes
      const tc = String(membroExistente.tipo_cadastro || '').toLowerCase();
      if (tc === 'membro' || tc === 'ministro') {
        tipoCadastroFinal = tc;
      } else {
        tipoCadastroFinal = 'congregado';
      }
    } else {
      // 2. Criar novo registro oficial como Congregado na tabela members
      isNovoMember = true;
      tipoCadastroFinal = 'congregado';

      const telDigitos = this.normalizarTelefone(input.telefone);
      const novoMemberPayload: any = {
        ministry_id: input.ministryId,
        congregacao_id: input.congregacaoId || null,
        name: input.nome.trim(),
        cpf: cleanCpf,
        phone: telDigitos || null,
        celular: telDigitos || null,
        whatsapp: telDigitos || null,
        tipo_cadastro: 'congregado',
        status: 'active',
        bairro: input.bairro || null,
        cidade: input.cidade || null,
        estado: input.estado || null,
        cep: input.cep || null,
        logradouro: input.logradouro || null,
        numero: input.numero || null,
        data_nascimento: input.dataNascimento || null,
        sexo: input.sexo || null,
      };

      const { data: memberCriado, error: errMember } = await supabase
        .from('members')
        .insert(novoMemberPayload)
        .select('id')
        .single();

      if (errMember || !memberCriado) {
        console.error('[DiscipuladoService.iniciarJornada] Erro ao criar member:', errMember);
        throw new Error(`Erro ao cadastrar congregado na Secretaria: ${errMember?.message || 'Falha de inserção'}`);
      }

      memberId = memberCriado.id;
    }

    // 3. Regra 5: Bloquear apenas jornadas ativas simultâneas (permite histórico de concluídas)
    const { data: jornadaAtiva, error: errJornadaCheck } = await supabase
      .from('discipulado_jornadas')
      .select('id, fase, status, created_at')
      .eq('ministry_id', input.ministryId)
      .eq('member_id', memberId)
      .eq('status', 'ativo')
      .maybeSingle();

    if (errJornadaCheck) {
      console.error('[DiscipuladoService.iniciarJornada] Erro ao checar jornada ativa:', errJornadaCheck);
    }

    if (jornadaAtiva) {
      throw new Error(
        `Este discípulo já possui uma jornada de discipulado ATIVA em andamento (Fase: ${jornadaAtiva.fase}). Conclua ou pause a jornada atual antes de iniciar outra.`
      );
    }

    // 4. Inserir a nova Jornada vinculada ao member_id
    const jornadaPayload: any = {
      ministry_id: input.ministryId,
      congregacao_id: input.congregacaoId || null,
      member_id: memberId,
      responsavel_id: input.responsavelId || null,
      visitante_origem_id: input.visitanteId || null,
      origem: input.visitanteId ? 'acolhimento' : 'culto',
      fase: 'primeiros_passos',
      status: 'ativo',
      data_decisao: input.dataDecisao || new Date().toISOString().slice(0, 10),
      data_inicio: new Date().toISOString().slice(0, 10),
      observacoes: input.observacoes || null,
    };

    const { data: novaJornada, error: errJornada } = await supabase
      .from('discipulado_jornadas')
      .insert(jornadaPayload)
      .select('id')
      .single();

    if (errJornada || !novaJornada) {
      console.error('[DiscipuladoService.iniciarJornada] Erro ao criar jornada:', errJornada);
      throw new Error(`Erro ao inicializar jornada de discipulado: ${errJornada?.message || 'Falha de inserção'}`);
    }

    // 5. Regra 6: Vínculo explícito de conversão do visitante (SEM usar deleted_at)
    let visitanteVinculado = false;
    if (input.visitanteId) {
      const { error: errUpdateVis } = await supabase
        .from('culto_visitantes')
        .update({
          converted_to_member_id: memberId,
          converted_at: new Date().toISOString(),
        })
        .eq('id', input.visitanteId)
        .eq('ministry_id', input.ministryId);

      if (!errUpdateVis) {
        visitanteVinculado = true;
      }
    } else if (input.telefone) {
      // Se não passou visitanteId direto mas o telefone corresponde, marca as visitas deste telefone
      const telDigitos = this.normalizarTelefone(input.telefone);
      if (telDigitos.length >= 8) {
        await supabase
          .from('culto_visitantes')
          .update({
            converted_to_member_id: memberId,
            converted_at: new Date().toISOString(),
          })
          .eq('ministry_id', input.ministryId)
          .eq('telefone', input.telefone)
          .is('converted_to_member_id', null);
      }
    }

    return {
      sucesso: true,
      memberId,
      jornadaId: novaJornada.id,
      isNovoMember,
      tipoCadastroFinal,
      visitanteVinculado,
      mensagem: isNovoMember
        ? 'Novo convertido cadastrado como Congregado e jornada de discipulado iniciada com sucesso!'
        : `Cadastro existente localizado (${tipoCadastroFinal.toUpperCase()}) e nova jornada de discipulado vinculada com sucesso!`,
    };
  }

  /**
   * Inicia a Jornada de Discipulado vinculando a um Congregado existente na Secretaria (public.members).
   * Regra oficial: Não cria nem altera membros, apenas inicia a jornada com validação de duplicidade ativa.
   */
  public static async iniciarJornadaParaCongregado(
    supabase: any,
    params: {
      ministryId: string;
      memberId: string;
      responsavelId?: string | null;
      congregacaoId?: string | null;
      dataDecisao?: string;
      observacoes?: string | null;
    }
  ): Promise<IniciarJornadaResult> {
    const { ministryId, memberId, responsavelId, congregacaoId, dataDecisao, observacoes } = params;

    if (!memberId) {
      throw new Error('O congregado selecionado é obrigatório.');
    }

    // 1. Obter e validar o membro na Secretaria
    const { data: member, error: errMember } = await supabase
      .from('members')
      .select('id, name, cpf, tipo_cadastro, status, congregacao_id')
      .eq('id', memberId)
      .eq('ministry_id', ministryId)
      .single();

    if (errMember || !member) {
      throw new Error('Congregado não encontrado ou não pertence a este ministério.');
    }

    // 2. Verificar se o tipo de cadastro é congregado
    const tipo = String(member.tipo_cadastro || '').toLowerCase();
    if (tipo !== 'congregado') {
      throw new Error(`Apenas congregados podem ser acolhidos no Discipulado. O registro atual deste membro é: ${tipo.toUpperCase()}.`);
    }

    // 3. Impedir jornadas ativas simultâneas
    const { data: jornadaAtiva, error: errJornadaCheck } = await supabase
      .from('discipulado_jornadas')
      .select('id, fase, status, created_at')
      .eq('ministry_id', ministryId)
      .eq('member_id', memberId)
      .eq('status', 'ativo')
      .maybeSingle();

    if (errJornadaCheck) {
      console.error('[DiscipuladoService.iniciarJornadaParaCongregado] Erro check ativo:', errJornadaCheck);
    }

    if (jornadaAtiva) {
      throw new Error(
        `Este congregado já possui uma jornada de discipulado ATIVA em andamento (Fase: ${jornadaAtiva.fase}). Não é permitida duplicidade.`
      );
    }

    // 4. Inserir a nova jornada vinculada ao member_id existente
    const targetCongregacao = congregacaoId || member.congregacao_id || null;
    const jornadaPayload: any = {
      ministry_id: ministryId,
      congregacao_id: targetCongregacao,
      member_id: memberId,
      responsavel_id: responsavelId || null,
      origem: 'culto',
      fase: 'primeiros_passos',
      status: 'ativo',
      data_decisao: dataDecisao || new Date().toISOString().slice(0, 10),
      data_inicio: new Date().toISOString().slice(0, 10),
      observacoes: observacoes || null,
    };

    const { data: novaJornada, error: errInsert } = await supabase
      .from('discipulado_jornadas')
      .insert(jornadaPayload)
      .select('id')
      .single();

    if (errInsert || !novaJornada) {
      console.error('[DiscipuladoService.iniciarJornadaParaCongregado] Erro insert:', errInsert);
      throw new Error(`Erro ao iniciar jornada de discipulado: ${errInsert?.message || 'Falha de inserção.'}`);
    }

    return {
      sucesso: true,
      memberId: member.id,
      jornadaId: novaJornada.id,
      isNovoMember: false,
      tipoCadastroFinal: 'congregado',
      visitanteVinculado: false,
      mensagem: `Jornada de discipulado iniciada com sucesso para o congregado ${member.name}!`,
    };
  }
}
