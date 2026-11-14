import { SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { 
  CelulaConfiguracao, 
  CelulaItem, 
  CelulaRede, 
  SalvarCelulaInput,
  CelulaReuniaoItem,
  CelulaFrequenciaItem,
  CelulaChamadaTokenItem,
  SalvarReuniaoInput,
  CelulaParticipanteItem,
  SalvarParticipanteInput,
  TransferirParticipanteInput,
  CelulaTransferenciaItem,
  CelulaEstudoItem,
  SalvarEstudoInput,
  CelulaSupervisaoItem,
  SalvarSupervisaoInput,
  CelulaConsolidadoRelatorio,
  CelulaMultiplicacaoStatus,
  CelulaMultiplicacaoItem,
  SolicitarMultiplicacaoInput,
  AvaliarMultiplicacaoInput,
  EfetivarMultiplicacaoInput,
  CelulaComunicadoItem,
  SalvarComunicadoInput,
  CelulaTemplateMensagemItem,
  SalvarTemplateInput,
  PrepararMensagemWhatsAppInput,
  MensagemWhatsAppPreparada,
  CelulaFiltrosInteligencia,
  CelulaInteligenciaPastoralReport,
  CelulaAlertaOperacional,
  CelulaSaudeItem,
  CelulaEvolucaoPeriodo,
  CelulaStatusImplantacao,
  CelulaEtapaImplantacao
} from '@/types/celulas';

export class CelulasService {
  constructor(private supabase: SupabaseClient) {}

  // --------------------------------------------------------------------------
  // CONFIGURAÇÕES
  // --------------------------------------------------------------------------
  async obterConfiguracao(ministryId: string): Promise<CelulaConfiguracao> {
    const { data, error } = await this.supabase
      .from('celulas_configuracoes')
      .select('*')
      .eq('ministry_id', ministryId)
      .maybeSingle();

    if (error) {
      throw new Error(`Erro ao obter configurações de células: ${error.message}`);
    }

    if (data) {
      return data as CelulaConfiguracao;
    }

    // Retorna default sem persistir se ainda não houver
    return {
      id: '',
      ministry_id: ministryId,
      metodologia: 'livre',
      termo_celula: 'Célula',
      termo_lider: 'Líder',
      termo_supervisor: 'Supervisor',
      dia_padrao_reuniao: 3,
      horario_padrao_reuniao: '20:00:00',
      frequencia_obrigatoria: 'flexivel',
      permite_multiplas_celulas_por_membro: false,
      exige_aprovacao_multiplicacao: true,
      is_ativo: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  async salvarConfiguracao(ministryId: string, input: Partial<CelulaConfiguracao>): Promise<CelulaConfiguracao> {
    const payload = {
      ministry_id: ministryId,
      metodologia: input.metodologia || 'livre',
      termo_celula: input.termo_celula?.trim() || 'Célula',
      termo_lider: input.termo_lider?.trim() || 'Líder',
      termo_supervisor: input.termo_supervisor?.trim() || 'Supervisor',
      dia_padrao_reuniao: input.dia_padrao_reuniao ?? null,
      horario_padrao_reuniao: input.horario_padrao_reuniao || null,
      frequencia_obrigatoria: input.frequencia_obrigatoria || 'flexivel',
      permite_multiplas_celulas_por_membro: Boolean(input.permite_multiplas_celulas_por_membro),
      exige_aprovacao_multiplicacao: input.exige_aprovacao_multiplicacao ?? true,
      is_ativo: input.is_ativo ?? true,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await this.supabase
      .from('celulas_configuracoes')
      .upsert(payload, { onConflict: 'ministry_id' })
      .select('*')
      .single();

    if (error) {
      throw new Error(`Erro ao salvar configurações de células: ${error.message}`);
    }

    return data as CelulaConfiguracao;
  }

  // --------------------------------------------------------------------------
  // REDES
  // --------------------------------------------------------------------------
  async listarRedes(ministryId: string): Promise<CelulaRede[]> {
    const { data, error } = await this.supabase
      .from('celulas_redes')
      .select(`
        id, ministry_id, nome, descricao, cor, icone, coordenador_member_id, is_ativo, created_at, updated_at,
        coordenador:members!celulas_redes_coordenador_member_id_fkey(id, name)
      `)
      .eq('ministry_id', ministryId)
      .order('nome', { ascending: true });

    if (error) {
      throw new Error(`Erro ao listar redes de células: ${error.message}`);
    }

    return (data || []) as unknown as CelulaRede[];
  }

  async criarRede(ministryId: string, input: { nome: string; descricao?: string | null; cor?: string | null; icone?: string | null; coordenador_member_id?: string | null }): Promise<CelulaRede> {
    if (!input.nome || !input.nome.trim()) {
      throw new Error('O nome da rede é obrigatório.');
    }

    // Se houver coordenador, valida se pertence ao mesmo tenant
    if (input.coordenador_member_id) {
      const { data: membroValido } = await this.supabase
        .from('members')
        .select('id')
        .eq('id', input.coordenador_member_id)
        .eq('ministry_id', ministryId)
        .maybeSingle();

      if (!membroValido) {
        throw new Error('O coordenador selecionado não pertence a este ministério.');
      }
    }

    const { data, error } = await this.supabase
      .from('celulas_redes')
      .insert({
        ministry_id: ministryId,
        nome: input.nome.trim(),
        descricao: input.descricao?.trim() || null,
        cor: input.cor?.trim() || '#123b63',
        icone: input.icone?.trim() || 'Users',
        coordenador_member_id: input.coordenador_member_id || null,
        is_ativo: true,
      })
      .select('*')
      .single();

    if (error) {
      throw new Error(`Erro ao criar rede: ${error.message}`);
    }

    return data as CelulaRede;
  }

  // --------------------------------------------------------------------------
  // CÉLULAS (CRUD)
  // --------------------------------------------------------------------------
  async listarCelulas(
    ministryId: string,
    filtros?: {
      congregacao_id?: string | null;
      rede_id?: string | null;
      status?: string | null;
      busca?: string | null;
    }
  ): Promise<CelulaItem[]> {
    let query = this.supabase
      .from('celulas')
      .select(`
        id, ministry_id, congregacao_id, rede_id, supervisao_id, codigo, nome, descricao,
        data_fundacao, status, motivo_status, dia_semana, horario, modalidade,
        cep, logradouro, numero, complemento, bairro, cidade, estado, latitude, longitude,
        lider_member_id, vice_lider_member_id, anfitriao_member_id, supervisor_member_id, celula_mae_id,
        created_at, updated_at,
        congregacao:congregacoes(id, nome),
        rede:celulas_redes(id, nome, cor),
        lider:members!celulas_lider_member_id_fkey(id, name, phone, celular),
        vice_lider:members!celulas_vice_lider_member_id_fkey(id, name),
        supervisor:members!celulas_supervisor_member_id_fkey(id, name),
        anfitriao:members!celulas_anfitriao_member_id_fkey(id, name),
        celula_mae:celulas!celulas_celula_mae_id_fkey(id, nome)
      `)
      .eq('ministry_id', ministryId)
      .order('nome', { ascending: true });

    if (filtros?.congregacao_id) {
      query = query.eq('congregacao_id', filtros.congregacao_id);
    }
    if (filtros?.rede_id) {
      query = query.eq('rede_id', filtros.rede_id);
    }
    if (filtros?.status && filtros.status !== 'todos') {
      query = query.eq('status', filtros.status);
    }
    if (filtros?.busca && filtros.busca.trim()) {
      query = query.ilike('nome', `%${filtros.busca.trim()}%`);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Erro ao listar células: ${error.message}`);
    }

    return (data || []) as unknown as CelulaItem[];
  }

  async obterCelulaPorId(id: string, ministryId: string): Promise<CelulaItem | null> {
    const { data, error } = await this.supabase
      .from('celulas')
      .select(`
        id, ministry_id, congregacao_id, rede_id, supervisao_id, codigo, nome, descricao,
        data_fundacao, status, motivo_status, dia_semana, horario, modalidade,
        cep, logradouro, numero, complemento, bairro, cidade, estado, latitude, longitude,
        lider_member_id, vice_lider_member_id, anfitriao_member_id, supervisor_member_id, celula_mae_id,
        created_at, updated_at,
        congregacao:congregacoes(id, nome),
        rede:celulas_redes(id, nome, cor),
        lider:members!celulas_lider_member_id_fkey(id, name, phone, celular),
        vice_lider:members!celulas_vice_lider_member_id_fkey(id, name),
        supervisor:members!celulas_supervisor_member_id_fkey(id, name),
        anfitriao:members!celulas_anfitriao_member_id_fkey(id, name),
        celula_mae:celulas!celulas_celula_mae_id_fkey(id, nome)
      `)
      .eq('id', id)
      .eq('ministry_id', ministryId)
      .maybeSingle();

    if (error) {
      throw new Error(`Erro ao obter detalhes da célula: ${error.message}`);
    }

    return (data as unknown as CelulaItem) || null;
  }

  async salvarCelula(ministryId: string, input: SalvarCelulaInput): Promise<CelulaItem> {
    if (!input.nome || !input.nome.trim()) {
      throw new Error('O nome da célula é obrigatório.');
    }

    if (input.dia_semana === undefined || input.dia_semana < 0 || input.dia_semana > 6) {
      throw new Error('O dia da semana da reunião deve estar entre 0 (Domingo) e 6 (Sábado).');
    }

    if (!input.horario || !input.horario.trim()) {
      throw new Error('O horário da reunião é obrigatório.');
    }

    // 1. Validação de Vínculos com o mesmo ministry_id (anti cross-tenant)
    if (input.congregacao_id) {
      const { data: cong } = await this.supabase
        .from('congregacoes')
        .select('id')
        .eq('id', input.congregacao_id)
        .eq('ministry_id', ministryId)
        .maybeSingle();
      if (!cong) throw new Error('A congregação informada não pertence a este ministério.');
    }

    if (input.rede_id) {
      const { data: rede } = await this.supabase
        .from('celulas_redes')
        .select('id')
        .eq('id', input.rede_id)
        .eq('ministry_id', ministryId)
        .maybeSingle();
      if (!rede) throw new Error('A rede ministerial informada não pertence a este ministério.');
    }

    const membrosParaValidar = [
      { id: input.lider_member_id, papel: 'líder' },
      { id: input.vice_lider_member_id, papel: 'vice-líder' },
      { id: input.supervisor_member_id, papel: 'supervisor' },
      { id: input.anfitriao_member_id, papel: 'anfitrião' },
    ].filter((m) => Boolean(m.id));

    for (const item of membrosParaValidar) {
      const { data: membro } = await this.supabase
        .from('members')
        .select('id')
        .eq('id', item.id!)
        .eq('ministry_id', ministryId)
        .maybeSingle();
      if (!membro) {
        throw new Error(`O membro selecionado como ${item.papel} não pertence a este ministério.`);
      }
    }

    if (input.celula_mae_id) {
      if (input.id && input.celula_mae_id === input.id) {
        throw new Error('Uma célula não pode ter a si mesma como célula mãe.');
      }
      const { data: mae } = await this.supabase
        .from('celulas')
        .select('id, celula_mae_id')
        .eq('id', input.celula_mae_id)
        .eq('ministry_id', ministryId)
        .maybeSingle();
      if (!mae) throw new Error('A célula de origem/mãe informada não pertence a este ministério.');

      // Prevenção de ciclo indireto na genealogia (A -> B -> A)
      if (input.id && mae.celula_mae_id === input.id) {
        throw new Error('Ciclo de genealogia detectado: a célula selecionada já descende desta célula.');
      }

      // Verificação em profundidade de ancestrais para evitar ciclos de N níveis
      if (input.id) {
        let ancestralAtualId = mae.celula_mae_id;
        const visitados = new Set<string>([input.id, input.celula_mae_id]);
        while (ancestralAtualId) {
          if (ancestralAtualId === input.id) {
            throw new Error('Ciclo indireto de genealogia detectado: esta atribuição geraria uma dependência circular.');
          }
          if (visitados.has(ancestralAtualId)) break;
          visitados.add(ancestralAtualId);
          const { data: prox } = await this.supabase
            .from('celulas')
            .select('celula_mae_id')
            .eq('id', ancestralAtualId)
            .eq('ministry_id', ministryId)
            .maybeSingle();
          ancestralAtualId = prox?.celula_mae_id || null;
        }
      }
    }

    const payload = {
      ministry_id: ministryId,
      congregacao_id: input.congregacao_id || null,
      rede_id: input.rede_id || null,
      supervisao_id: input.supervisao_id || null,
      codigo: input.codigo?.trim() || null,
      nome: input.nome.trim(),
      descricao: input.descricao?.trim() || null,
      data_fundacao: input.data_fundacao || new Date().toISOString().slice(0, 10),
      status: input.status || 'ativa',
      motivo_status: input.motivo_status?.trim() || null,
      dia_semana: input.dia_semana,
      horario: input.horario.trim(),
      modalidade: input.modalidade || 'presencial',
      cep: input.cep?.trim() || null,
      logradouro: input.logradouro?.trim() || null,
      numero: input.numero?.trim() || null,
      complemento: input.complemento?.trim() || null,
      bairro: input.bairro?.trim() || null,
      cidade: input.cidade?.trim() || null,
      estado: input.estado?.trim() || null,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      lider_member_id: input.lider_member_id || null,
      vice_lider_member_id: input.vice_lider_member_id || null,
      anfitriao_member_id: input.anfitriao_member_id || null,
      supervisor_member_id: input.supervisor_member_id || null,
      celula_mae_id: input.celula_mae_id || null,
      updated_at: new Date().toISOString(),
    };

    if (input.id) {
      const { data, error } = await this.supabase
        .from('celulas')
        .update(payload)
        .eq('id', input.id)
        .eq('ministry_id', ministryId)
        .select('*')
        .single();

      if (error) throw new Error(`Erro ao atualizar célula: ${error.message}`);
      return data as CelulaItem;
    } else {
      const { data, error } = await this.supabase
        .from('celulas')
        .insert(payload)
        .select('*')
        .single();

      if (error) throw new Error(`Erro ao cadastrar célula: ${error.message}`);
      return data as CelulaItem;
    }
  }

  // --------------------------------------------------------------------------
  // LOTE 2: REUNIÕES E FREQUÊNCIA
  // --------------------------------------------------------------------------

  async listarReunioes(
    ministryId: string,
    filtros?: {
      celula_id?: string | null;
      congregacao_id?: string | null;
      data_inicio?: string | null;
      data_fim?: string | null;
      status?: string | null;
    }
  ): Promise<CelulaReuniaoItem[]> {
    let query = this.supabase
      .from('celulas_reunioes')
      .select(`
        id, ministry_id, celula_id, congregacao_id, data_reuniao, horario_inicio, horario_termino,
        modalidade, status, motivo_cancelamento, tema_estudo, estudo_id, observacoes,
        presentes_membros, presentes_visitantes, presentes_criancas, total_presentes,
        conversoes_decisoes, reconciliacoes, testemunhos, pedidos_oracao, valor_oferta,
        finalizada_em, finalizada_por, editada_pos_fechamento, justificativa_edicao,
        created_at, updated_at,
        celula:celulas(id, nome, congregacao_id),
        congregacao:congregacoes(id, nome)
      `)
      .eq('ministry_id', ministryId)
      .order('data_reuniao', { ascending: false });

    if (filtros?.celula_id) {
      query = query.eq('celula_id', filtros.celula_id);
    }
    if (filtros?.congregacao_id) {
      query = query.eq('congregacao_id', filtros.congregacao_id);
    }
    if (filtros?.data_inicio) {
      query = query.gte('data_reuniao', filtros.data_inicio);
    }
    if (filtros?.data_fim) {
      query = query.lte('data_reuniao', filtros.data_fim);
    }
    if (filtros?.status) {
      query = query.eq('status', filtros.status);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`Erro ao listar reuniões de células: ${error.message}`);
    }

    return (data || []) as unknown as CelulaReuniaoItem[];
  }

  async obterReuniaoPorId(ministryId: string, id: string): Promise<CelulaReuniaoItem | null> {
    const { data, error } = await this.supabase
      .from('celulas_reunioes')
      .select(`
        id, ministry_id, celula_id, congregacao_id, data_reuniao, horario_inicio, horario_termino,
        modalidade, status, motivo_cancelamento, tema_estudo, estudo_id, observacoes,
        presentes_membros, presentes_visitantes, presentes_criancas, total_presentes,
        conversoes_decisoes, reconciliacoes, testemunhos, pedidos_oracao, valor_oferta,
        finalizada_em, finalizada_por, editada_pos_fechamento, justificativa_edicao,
        created_at, updated_at,
        celula:celulas(id, nome, congregacao_id),
        congregacao:congregacoes(id, nome)
      `)
      .eq('id', id)
      .eq('ministry_id', ministryId)
      .maybeSingle();

    if (error) {
      throw new Error(`Erro ao obter reunião: ${error.message}`);
    }

    return (data || null) as unknown as CelulaReuniaoItem | null;
  }

  async salvarReuniao(ministryId: string, input: SalvarReuniaoInput, userId?: string): Promise<CelulaReuniaoItem> {
    if (!input.celula_id) {
      throw new Error('A identificação da célula é obrigatória.');
    }
    if (!input.data_reuniao) {
      throw new Error('A data da reunião é obrigatória.');
    }

    // 1. Validar se a célula pertence ao tenant
    const { data: celula, error: errCelula } = await this.supabase
      .from('celulas')
      .select('id, ministry_id, congregacao_id, status')
      .eq('id', input.celula_id)
      .eq('ministry_id', ministryId)
      .single();

    if (errCelula || !celula) {
      throw new Error('A célula indicada não existe ou não pertence a este ministério.');
    }

    const congregacaoId = input.congregacao_id || celula.congregacao_id;

    // 2. Se for edição de reunião já existente, verificar status e governança
    let reuniaoExistente: CelulaReuniaoItem | null = null;
    if (input.id) {
      reuniaoExistente = await this.obterReuniaoPorId(ministryId, input.id);
      if (!reuniaoExistente) {
        throw new Error('Reunião não encontrada para atualização.');
      }
      if (reuniaoExistente.status === 'finalizada' && !input.justificativa_edicao?.trim()) {
        throw new Error('Esta reunião já foi finalizada. Para efetuar alterações posteriores, informe obrigatoriamente a justificativa.');
      }
    }

    // 3. Montar payload de atualização/inserção
    const statusFinal = input.status || (reuniaoExistente ? reuniaoExistente.status : 'planejada');
    const isFinalizando = statusFinal === 'finalizada' && (!reuniaoExistente || reuniaoExistente.status !== 'finalizada');

    const payload = {
      ministry_id: ministryId,
      celula_id: input.celula_id,
      congregacao_id: congregacaoId,
      data_reuniao: input.data_reuniao,
      horario_inicio: input.horario_inicio || '20:00:00',
      horario_termino: input.horario_termino || null,
      modalidade: input.modalidade || 'presencial',
      status: statusFinal,
      motivo_cancelamento: input.motivo_cancelamento?.trim() || null,
      tema_estudo: input.tema_estudo?.trim() || null,
      observacoes: input.observacoes?.trim() || null,
      presentes_membros: input.presentes_membros ?? 0,
      presentes_visitantes: input.presentes_visitantes ?? 0,
      presentes_criancas: input.presentes_criancas ?? 0,
      conversoes_decisoes: input.conversoes_decisoes ?? 0,
      reconciliacoes: input.reconciliacoes ?? 0,
      testemunhos: input.testemunhos ?? 0,
      pedidos_oracao: input.pedidos_oracao ?? 0,
      valor_oferta: input.valor_oferta ?? 0,
      finalizada_em: isFinalizando ? new Date().toISOString() : (reuniaoExistente?.finalizada_em || null),
      finalizada_por: isFinalizando && userId ? userId : (reuniaoExistente?.finalizada_por || null),
      editada_pos_fechamento: reuniaoExistente?.status === 'finalizada' ? true : false,
      justificativa_edicao: input.justificativa_edicao?.trim() || reuniaoExistente?.justificativa_edicao || null,
      updated_at: new Date().toISOString(),
    };

    let reuniaoSalva: CelulaReuniaoItem;
    if (input.id) {
      const { data, error } = await this.supabase
        .from('celulas_reunioes')
        .update(payload)
        .eq('id', input.id)
        .eq('ministry_id', ministryId)
        .select('*')
        .single();

      if (error) throw new Error(`Erro ao atualizar reunião: ${error.message}`);
      reuniaoSalva = data as unknown as CelulaReuniaoItem;
    } else {
      const { data, error } = await this.supabase
        .from('celulas_reunioes')
        .insert(payload)
        .select('*')
        .single();

      if (error) {
        if (error.code === '23505') {
          throw new Error('Já existe uma reunião registrada para esta célula nesta mesma data.');
        }
        throw new Error(`Erro ao cadastrar reunião: ${error.message}`);
      }
      reuniaoSalva = data as unknown as CelulaReuniaoItem;
    }

    // 4. Salvar frequência individual quando enviada
    if (input.frequencias && Array.isArray(input.frequencias)) {
      // Deletar frequências anteriores desta reunião e reinserir
      await this.supabase
        .from('celulas_frequencias')
        .delete()
        .eq('reuniao_id', reuniaoSalva.id)
        .eq('ministry_id', ministryId);

      if (input.frequencias.length > 0) {
        const registrosFreq = input.frequencias.map(f => ({
          ministry_id: ministryId,
          reuniao_id: reuniaoSalva.id,
          celula_id: reuniaoSalva.celula_id,
          member_id: f.member_id || null,
          nome_participante: f.nome_participante.trim(),
          tipo_participante: f.tipo_participante || 'membro',
          presente: Boolean(f.presente),
          justificativa_ausencia: f.justificativa_ausencia?.trim() || null,
        }));

        const { error: errFreq } = await this.supabase
          .from('celulas_frequencias')
          .insert(registrosFreq);

        if (errFreq) {
          throw new Error(`Erro ao registrar frequência nominal da reunião: ${errFreq.message}`);
        }
      }
    }

    return reuniaoSalva;
  }

  async listarFrequenciasDaReuniao(ministryId: string, reuniaoId: string): Promise<CelulaFrequenciaItem[]> {
    const { data, error } = await this.supabase
      .from('celulas_frequencias')
      .select(`
        id, ministry_id, reuniao_id, celula_id, member_id, nome_participante, tipo_participante,
        presente, justificativa_ausencia, created_at,
        member:members(id, name, phone)
      `)
      .eq('reuniao_id', reuniaoId)
      .eq('ministry_id', ministryId)
      .order('nome_participante', { ascending: true });

    if (error) {
      throw new Error(`Erro ao listar presenças da reunião: ${error.message}`);
    }

    return (data || []) as unknown as CelulaFrequenciaItem[];
  }

  // --------------------------------------------------------------------------
  // LINKS TEMPORÁRIOS DE CHAMADA / RELATÓRIO RÁPIDO
  // --------------------------------------------------------------------------

  async gerarTokenChamadaRapida(
    ministryId: string,
    input: {
      celula_id: string;
      reuniao_id?: string | null;
      tipo_acesso?: 'frequencia_reuniao' | 'relatorio_rapido';
      duracao_horas?: number;
    },
    userId?: string
  ): Promise<{ rawToken: string; tokenItem: CelulaChamadaTokenItem }> {
    if (!input.celula_id) {
      throw new Error('A célula é obrigatória para emissão do link.');
    }

    // 1. Validar célula no tenant
    const { data: celula, error: errCelula } = await this.supabase
      .from('celulas')
      .select('id, ministry_id, congregacao_id')
      .eq('id', input.celula_id)
      .eq('ministry_id', ministryId)
      .single();

    if (errCelula || !celula) {
      throw new Error('Célula não encontrada ou não pertence a este ministério.');
    }

    // 2. Gerar token criptográfico imprevisível de 32 bytes (64 caracteres hex)
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const duracaoHoras = input.duracao_horas && input.duracao_horas > 0 ? input.duracao_horas : 24;
    const expiresAt = new Date(Date.now() + duracaoHoras * 3600 * 1000).toISOString();

    const payload = {
      ministry_id: ministryId,
      congregacao_id: celula.congregacao_id,
      celula_id: celula.id,
      reuniao_id: input.reuniao_id || null,
      token_hash: tokenHash,
      tipo_acesso: input.tipo_acesso || 'frequencia_reuniao',
      status: 'ativo',
      expires_at: expiresAt,
      created_by: userId || null,
      created_at: new Date().toISOString(),
    };

    const { data, error } = await this.supabase
      .from('celulas_chamada_tokens')
      .upsert(payload, { onConflict: 'celula_id,reuniao_id' })
      .select('*')
      .single();

    if (error) {
      throw new Error(`Erro ao gerar link de chamada rápida: ${error.message}`);
    }

    return {
      rawToken,
      tokenItem: data as CelulaChamadaTokenItem,
    };
  }

  async validarTokenChamadaRapida(rawToken: string): Promise<{
    valido: boolean;
    motivo?: string;
    tokenItem?: CelulaChamadaTokenItem;
    celula?: CelulaItem;
    reuniao?: CelulaReuniaoItem | null;
  }> {
    if (!rawToken || rawToken.trim().length < 32) {
      return { valido: false, motivo: 'Token inválido ou com formato incorreto.' };
    }

    const tokenHash = crypto.createHash('sha256').update(rawToken.trim()).digest('hex');

    const { data: tokenItem, error } = await this.supabase
      .from('celulas_chamada_tokens')
      .select('*')
      .eq('token_hash', tokenHash)
      .maybeSingle();

    if (error || !tokenItem) {
      return { valido: false, motivo: 'Link de acesso não encontrado.' };
    }

    if (tokenItem.status !== 'ativo') {
      return { valido: false, motivo: `Este link está ${tokenItem.status}.` };
    }

    if (new Date(tokenItem.expires_at) < new Date()) {
      return { valido: false, motivo: 'Este link expirou.' };
    }

    // Buscar dados da célula
    const { data: celula } = await this.supabase
      .from('celulas')
      .select('*')
      .eq('id', tokenItem.celula_id)
      .maybeSingle();

    let reuniao: CelulaReuniaoItem | null = null;
    if (tokenItem.reuniao_id) {
      const { data: r } = await this.supabase
        .from('celulas_reunioes')
        .select('*')
        .eq('id', tokenItem.reuniao_id)
        .maybeSingle();
      reuniao = (r || null) as unknown as CelulaReuniaoItem | null;
    }

    return {
      valido: true,
      tokenItem: tokenItem as CelulaChamadaTokenItem,
      celula: celula as CelulaItem,
      reuniao,
    };
  }

  // --------------------------------------------------------------------------
  // LOTE 3: PARTICIPANTES E TRANSFERÊNCIAS
  // --------------------------------------------------------------------------

  async listarParticipantes(
    ministryId: string,
    filtros?: {
      celula_id?: string | null;
      congregacao_id?: string | null;
      status?: string | null;
      busca?: string | null;
    }
  ): Promise<CelulaParticipanteItem[]> {
    let query = this.supabase
      .from('celulas_participantes')
      .select(`
        id, ministry_id, celula_id, congregacao_id, member_id, nome_completo, email, telefone,
        papel, status, data_ingresso, data_saida, motivo_saida, created_at, updated_at,
        celula:celulas(id, nome),
        congregacao:congregacoes(id, nome),
        member:members(id, name, phone, email)
      `)
      .eq('ministry_id', ministryId)
      .order('nome_completo', { ascending: true });

    if (filtros?.celula_id) {
      query = query.eq('celula_id', filtros.celula_id);
    }
    if (filtros?.congregacao_id) {
      query = query.eq('congregacao_id', filtros.congregacao_id);
    }
    if (filtros?.status) {
      query = query.eq('status', filtros.status);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`Erro ao listar participantes de células: ${error.message}`);
    }

    let participantes = (data || []) as unknown as CelulaParticipanteItem[];
    if (filtros?.busca?.trim()) {
      const termo = filtros.busca.trim().toLowerCase();
      participantes = participantes.filter(p => 
        p.nome_completo.toLowerCase().includes(termo) ||
        (p.email && p.email.toLowerCase().includes(termo)) ||
        (p.telefone && p.telefone.includes(termo))
      );
    }

    return participantes;
  }

  async salvarParticipante(ministryId: string, input: SalvarParticipanteInput): Promise<CelulaParticipanteItem> {
    if (!input.celula_id) {
      throw new Error('A célula é obrigatória.');
    }
    if (!input.nome_completo || !input.nome_completo.trim()) {
      throw new Error('O nome do participante é obrigatório.');
    }

    // 1. Validar célula no tenant
    const { data: celula, error: errCelula } = await this.supabase
      .from('celulas')
      .select('id, ministry_id, congregacao_id')
      .eq('id', input.celula_id)
      .eq('ministry_id', ministryId)
      .single();

    if (errCelula || !celula) {
      throw new Error('A célula informada não existe ou não pertence a este ministério.');
    }

    const congregacaoId = input.congregacao_id || celula.congregacao_id;

    // 2. Se for membro existente de public.members, validar tenant e unicidade de vínculo ativo
    if (input.member_id) {
      const { data: membro } = await this.supabase
        .from('members')
        .select('id, name, email, phone, celular')
        .eq('id', input.member_id)
        .eq('ministry_id', ministryId)
        .maybeSingle();

      if (!membro) {
        throw new Error('O membro selecionado não pertence a este ministério.');
      }

      // Verificar regra de 1 célula ativa por membro (caso este vínculo seja 'ativo')
      const statusFinal = input.status || 'ativo';
      if (statusFinal === 'ativo') {
        const { data: vinculoExistente } = await this.supabase
          .from('celulas_participantes')
          .select('id, celula_id, celula:celulas(nome)')
          .eq('ministry_id', ministryId)
          .eq('member_id', input.member_id)
          .eq('status', 'ativo')
          .maybeSingle();

        if (vinculoExistente && (!input.id || vinculoExistente.id !== input.id)) {
          const nomeCelula = (vinculoExistente as any).celula?.nome || 'outra célula';
          throw new Error(`Este membro já possui um vínculo ativo na célula "${nomeCelula}". Para movê-lo, utilize a operação de Transferência.`);
        }
      }
    }

    const payload = {
      ministry_id: ministryId,
      celula_id: input.celula_id,
      congregacao_id: congregacaoId,
      member_id: input.member_id || null,
      nome_completo: input.nome_completo.trim(),
      email: input.email?.trim() || null,
      telefone: input.telefone?.trim() || null,
      papel: input.papel || 'membro',
      status: input.status || 'ativo',
      data_ingresso: input.data_ingresso || new Date().toISOString().slice(0, 10),
      updated_at: new Date().toISOString(),
    };

    if (input.id) {
      const { data, error } = await this.supabase
        .from('celulas_participantes')
        .update(payload)
        .eq('id', input.id)
        .eq('ministry_id', ministryId)
        .select('*')
        .single();

      if (error) throw new Error(`Erro ao atualizar participante: ${error.message}`);
      return data as unknown as CelulaParticipanteItem;
    } else {
      const { data, error } = await this.supabase
        .from('celulas_participantes')
        .insert(payload)
        .select('*')
        .single();

      if (error) {
        if (error.code === '23505') {
          throw new Error('Este participante já possui um vínculo ativo em uma célula deste ministério.');
        }
        throw new Error(`Erro ao cadastrar participante: ${error.message}`);
      }
      return data as unknown as CelulaParticipanteItem;
    }
  }

  async transferirParticipante(ministryId: string, input: TransferirParticipanteInput, userId?: string): Promise<CelulaTransferenciaItem> {
    if (!input.participante_id) {
      throw new Error('A identificação do participante é obrigatória.');
    }
    if (!input.celula_destino_id) {
      throw new Error('A célula de destino é obrigatória.');
    }

    // 1. Obter participante atual
    const { data: part, error: errPart } = await this.supabase
      .from('celulas_participantes')
      .select('*')
      .eq('id', input.participante_id)
      .eq('ministry_id', ministryId)
      .single();

    if (errPart || !part) {
      throw new Error('Participante não encontrado neste ministério.');
    }

    if (part.celula_id === input.celula_destino_id) {
      throw new Error('A célula de destino deve ser diferente da célula atual.');
    }

    // 2. Validar célula destino
    const { data: celulaDestino, error: errDestino } = await this.supabase
      .from('celulas')
      .select('id, ministry_id, congregacao_id, status')
      .eq('id', input.celula_destino_id)
      .eq('ministry_id', ministryId)
      .single();

    if (errDestino || !celulaDestino) {
      throw new Error('A célula de destino não existe ou não pertence a este ministério.');
    }

    const celulaOrigemId = part.celula_id;

    // 3. Atualizar participante com a nova célula e congregação
    const { error: errUpdate } = await this.supabase
      .from('celulas_participantes')
      .update({
        celula_id: celulaDestino.id,
        congregacao_id: celulaDestino.congregacao_id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', part.id)
      .eq('ministry_id', ministryId);

    if (errUpdate) {
      throw new Error(`Erro ao transferir participante: ${errUpdate.message}`);
    }

    // 4. Registrar histórico da transferência
    const { data: transf, error: errTransf } = await this.supabase
      .from('celulas_transferencias')
      .insert({
        ministry_id: ministryId,
        participante_id: part.id,
        member_id: part.member_id || null,
        celula_origem_id: celulaOrigemId,
        celula_destino_id: celulaDestino.id,
        motivo: input.motivo?.trim() || null,
        solicitado_por: userId || null,
      })
      .select('*')
      .single();

    if (errTransf) {
      throw new Error(`Erro ao registrar log de transferência: ${errTransf.message}`);
    }

    return transf as unknown as CelulaTransferenciaItem;
  }

  // --------------------------------------------------------------------------
  // LOTE 4: ESTUDOS BÍBLICOS
  // --------------------------------------------------------------------------
  async listarEstudos(
    ministryId: string, 
    filtros: { 
      congregacaoId?: string | null; 
      redeId?: string | null; 
      status?: string | null; 
      somentePublicados?: boolean;
      busca?: string | null;
    } = {}
  ): Promise<CelulaEstudoItem[]> {
    let query = this.supabase
      .from('celulas_estudos')
      .select(`
        *,
        congregacao:congregacoes(id, nome),
        rede:celulas_redes(id, nome)
      `)
      .eq('ministry_id', ministryId);

    if (filtros.congregacaoId) {
      query = query.eq('congregacao_id', filtros.congregacaoId);
    }

    if (filtros.redeId) {
      query = query.eq('rede_id', filtros.redeId);
    }

    if (filtros.status) {
      query = query.eq('status', filtros.status);
    } else if (filtros.somentePublicados) {
      query = query.eq('status', 'publicado');
    }

    if (filtros.busca) {
      const term = `%${filtros.busca.trim()}%`;
      query = query.or(`titulo.ilike.${term},tema.ilike.${term},serie.ilike.${term}`);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Erro ao listar estudos bíblicos: ${error.message}`);
    }

    return (data || []) as unknown as CelulaEstudoItem[];
  }

  async obterEstudoPorId(ministryId: string, estudoId: string): Promise<CelulaEstudoItem | null> {
    const { data, error } = await this.supabase
      .from('celulas_estudos')
      .select(`
        *,
        congregacao:congregacoes(id, nome),
        rede:celulas_redes(id, nome)
      `)
      .eq('id', estudoId)
      .eq('ministry_id', ministryId)
      .maybeSingle();

    if (error) {
      throw new Error(`Erro ao buscar estudo bíblico: ${error.message}`);
    }

    return data as unknown as CelulaEstudoItem | null;
  }

  async salvarEstudo(ministryId: string, input: SalvarEstudoInput, userId?: string): Promise<CelulaEstudoItem> {
    if (!input.titulo || !input.titulo.trim()) {
      throw new Error('O título do estudo é obrigatório.');
    }
    if (!input.desenvolvimento || !input.desenvolvimento.trim()) {
      throw new Error('O desenvolvimento do estudo é obrigatório.');
    }

    // Se vinculou a uma congregação, validar pertença ao ministério
    if (input.congregacao_id) {
      const { data: cong, error: errCong } = await this.supabase
        .from('congregacoes')
        .select('id, ministry_id')
        .eq('id', input.congregacao_id)
        .eq('ministry_id', ministryId)
        .single();

      if (errCong || !cong) {
        throw new Error('A congregação informada não pertence a este ministério.');
      }
    }

    // Se vinculou a uma rede, validar pertença ao ministério
    if (input.rede_id) {
      const { data: rede, error: errRede } = await this.supabase
        .from('celulas_redes')
        .select('id, ministry_id')
        .eq('id', input.rede_id)
        .eq('ministry_id', ministryId)
        .single();

      if (errRede || !rede) {
        throw new Error('A rede informada não pertence a este ministério.');
      }
    }

    const payload: Record<string, unknown> = {
      ministry_id: ministryId,
      congregacao_id: input.congregacao_id || null,
      rede_id: input.rede_id || null,
      titulo: input.titulo.trim(),
      tema: input.tema?.trim() || null,
      serie: input.serie?.trim() || null,
      numero_licao: input.numero_licao || null,
      referencias_biblicas: input.referencias_biblicas?.trim() || null,
      objetivo: input.objetivo?.trim() || null,
      quebra_gelo: input.quebra_gelo?.trim() || null,
      introducao: input.introducao?.trim() || null,
      desenvolvimento: input.desenvolvimento.trim(),
      perguntas_discussao: input.perguntas_discussao?.trim() || null,
      aplicacao_pratica: input.aplicacao_pratica?.trim() || null,
      conclusao: input.conclusao?.trim() || null,
      oracao_final: input.oracao_final?.trim() || null,
      status: input.status || 'rascunho',
      data_publicacao_inicio: input.data_publicacao_inicio || null,
      data_publicacao_fim: input.data_publicacao_fim || null,
      updated_at: new Date().toISOString(),
    };

    if (input.id) {
      // Atualização
      const { data, error } = await this.supabase
        .from('celulas_estudos')
        .update(payload)
        .eq('id', input.id)
        .eq('ministry_id', ministryId)
        .select('*')
        .single();

      if (error) {
        throw new Error(`Erro ao atualizar estudo: ${error.message}`);
      }

      return data as unknown as CelulaEstudoItem;
    } else {
      // Inserção
      payload.autor_user_id = userId || null;
      payload.created_at = new Date().toISOString();
      payload.versao = 1;

      const { data, error } = await this.supabase
        .from('celulas_estudos')
        .insert(payload)
        .select('*')
        .single();

      if (error) {
        throw new Error(`Erro ao criar estudo bíblico: ${error.message}`);
      }

      return data as unknown as CelulaEstudoItem;
    }
  }

  // --------------------------------------------------------------------------
  // LOTE 4: SUPERVISÃO PASTORAL E VISITAS
  // --------------------------------------------------------------------------
  async listarSupervisoes(
    ministryId: string, 
    filtros: { 
      celulaId?: string | null; 
      congregacaoId?: string | null; 
      status?: string | null;
      apenasComApoioSolicitado?: boolean;
    } = {}
  ): Promise<CelulaSupervisaoItem[]> {
    let query = this.supabase
      .from('celulas_supervisoes')
      .select(`
        *,
        celula:celulas(id, nome),
        congregacao:congregacoes(id, nome),
        supervisor:members(id, name)
      `)
      .eq('ministry_id', ministryId);

    if (filtros.celulaId) {
      query = query.eq('celula_id', filtros.celulaId);
    }

    if (filtros.congregacaoId) {
      query = query.eq('congregacao_id', filtros.congregacaoId);
    }

    if (filtros.status) {
      query = query.eq('status', filtros.status);
    }

    if (filtros.apenasComApoioSolicitado) {
      query = query.eq('solicitou_apoio_pastoral', true);
    }

    const { data, error } = await query.order('data_agendada', { ascending: false });

    if (error) {
      throw new Error(`Erro ao listar supervisões pastorais: ${error.message}`);
    }

    return (data || []) as unknown as CelulaSupervisaoItem[];
  }

  async salvarSupervisao(ministryId: string, input: SalvarSupervisaoInput, userId?: string): Promise<CelulaSupervisaoItem> {
    if (!input.celula_id) {
      throw new Error('A célula supervisionada é obrigatória.');
    }
    if (!input.data_agendada) {
      throw new Error('A data da supervisão é obrigatória.');
    }

    // 1. Validar célula
    const { data: celula, error: errCelula } = await this.supabase
      .from('celulas')
      .select('id, ministry_id, congregacao_id')
      .eq('id', input.celula_id)
      .eq('ministry_id', ministryId)
      .single();

    if (errCelula || !celula) {
      throw new Error('A célula informada não existe ou não pertence a este ministério.');
    }

    // 2. Se supervisor_member_id informado, validar pertença ao ministério
    if (input.supervisor_member_id) {
      const { data: member, error: errMem } = await this.supabase
        .from('members')
        .select('id, ministry_id')
        .eq('id', input.supervisor_member_id)
        .eq('ministry_id', ministryId)
        .single();

      if (errMem || !member) {
        throw new Error('O supervisor selecionado não pertence a este ministério.');
      }
    }

    const congregacaoId = input.congregacao_id || celula.congregacao_id;

    const payload: Record<string, unknown> = {
      ministry_id: ministryId,
      celula_id: celula.id,
      congregacao_id: congregacaoId,
      supervisor_member_id: input.supervisor_member_id || null,
      tipo: input.tipo || 'visita',
      status: input.status || 'agendada',
      data_agendada: input.data_agendada,
      data_realizada: input.data_realizada || null,
      diagnostico_saude: input.diagnostico_saude || 'saudavel',
      observacoes_pastorais: input.observacoes_pastorais?.trim() || null,
      plano_acao: input.plano_acao?.trim() || null,
      solicitou_apoio_pastoral: Boolean(input.solicitou_apoio_pastoral),
      detalhe_apoio: input.detalhe_apoio?.trim() || null,
      updated_at: new Date().toISOString(),
    };

    if (input.id) {
      const { data, error } = await this.supabase
        .from('celulas_supervisoes')
        .update(payload)
        .eq('id', input.id)
        .eq('ministry_id', ministryId)
        .select('*')
        .single();

      if (error) {
        throw new Error(`Erro ao atualizar supervisão: ${error.message}`);
      }

      return data as unknown as CelulaSupervisaoItem;
    } else {
      payload.registrado_por_user_id = userId || null;
      payload.created_at = new Date().toISOString();

      const { data, error } = await this.supabase
        .from('celulas_supervisoes')
        .insert(payload)
        .select('*')
        .single();

      if (error) {
        throw new Error(`Erro ao cadastrar supervisão pastoral: ${error.message}`);
      }

      return data as unknown as CelulaSupervisaoItem;
    }
  }

  // --------------------------------------------------------------------------
  // LOTE 4: RELATÓRIO CONSOLIDADO E INTELIGÊNCIA PASTORAL
  // --------------------------------------------------------------------------
  async obterRelatorioConsolidado(
    ministryId: string, 
    congregacaoId?: string | null
  ): Promise<CelulaConsolidadoRelatorio> {
    // 1. Células
    let celulasQuery = this.supabase
      .from('celulas')
      .select('id, status', { count: 'exact' })
      .eq('ministry_id', ministryId);

    if (congregacaoId) {
      celulasQuery = celulasQuery.eq('congregacao_id', congregacaoId);
    }

    const { data: celulasData } = await celulasQuery;
    const totalCelulas = celulasData?.length || 0;
    const celulasAtivas = (celulasData || []).filter(c => c.status === 'ativa').length;

    // 2. Participantes e Líderes
    let partQuery = this.supabase
      .from('celulas_participantes')
      .select('id, status, papel')
      .eq('ministry_id', ministryId);

    if (congregacaoId) {
      partQuery = partQuery.eq('congregacao_id', congregacaoId);
    }

    const { data: partData } = await partQuery;
    const totalParticipantes = partData?.length || 0;
    const participantesAtivos = (partData || []).filter(p => p.status === 'ativo').length;
    const lideresAtivos = (partData || []).filter(p => p.status === 'ativo' && (p.papel === 'lider' || p.papel === 'vice_lider')).length;

    // 3. Reuniões
    let reunioesQuery = this.supabase
      .from('celulas_reunioes')
      .select('id, presencas_total, presencas_visitantes, status')
      .eq('ministry_id', ministryId)
      .eq('status', 'finalizada');

    if (congregacaoId) {
      reunioesQuery = reunioesQuery.eq('congregacao_id', congregacaoId);
    }

    const { data: reunioesData } = await reunioesQuery;
    const reunioesMes = reunioesData?.length || 0;
    const somaPresencas = (reunioesData || []).reduce((acc, r) => acc + (r.presencas_total || 0), 0);
    const totalVisitantes = (reunioesData || []).reduce((acc, r) => acc + (r.presencas_visitantes || 0), 0);
    const mediaPresenca = reunioesMes > 0 ? Math.round(somaPresencas / reunioesMes) : 0;

    // 4. Supervisões
    let supQuery = this.supabase
      .from('celulas_supervisoes')
      .select('id, status, solicitou_apoio_pastoral')
      .eq('ministry_id', ministryId);

    if (congregacaoId) {
      supQuery = supQuery.eq('congregacao_id', congregacaoId);
    }

    const { data: supData } = await supQuery;
    const supervisoesPendentes = (supData || []).filter(s => s.status === 'agendada').length;
    const solicitacoesApoioAbertas = (supData || []).filter(s => s.solicitou_apoio_pastoral && s.status !== 'realizada').length;

    return {
      total_celulas: totalCelulas,
      celulas_ativas: celulasAtivas,
      total_participantes: totalParticipantes,
      participantes_ativos: participantesAtivos,
      lideres_ativos: lideresAtivos,
      reunioes_mes: reunioesMes,
      media_presenca_reuniao: mediaPresenca,
      total_visitantes_mes: totalVisitantes,
      supervisoes_pendentes: supervisoesPendentes,
      solicitacoes_apoio_abertas: solicitacoesApoioAbertas,
    };
  }

  // --------------------------------------------------------------------------
  // LOTE 5: MULTIPLICAÇÃO ASSISTIDA E GENEALOGIA
  // --------------------------------------------------------------------------
  async listarMultiplicacoes(
    ministryId: string,
    filtros: {
      congregacaoId?: string | null;
      status?: string | null;
      celulaOrigemId?: string | null;
    } = {}
  ): Promise<CelulaMultiplicacaoItem[]> {
    let query = this.supabase
      .from('celulas_multiplicacoes')
      .select(`
        *,
        celula_origem:celulas!celulas_multiplicacoes_celula_origem_id_fkey(id, nome),
        celula_filha:celulas!celulas_multiplicacoes_celula_filha_id_fkey(id, nome),
        novo_lider:members!celulas_multiplicacoes_novo_lider_member_id_fkey(id, name),
        congregacao:congregacoes(id, nome)
      `)
      .eq('ministry_id', ministryId);

    if (filtros.congregacaoId) {
      query = query.eq('congregacao_id', filtros.congregacaoId);
    }
    if (filtros.status) {
      query = query.eq('status', filtros.status);
    }
    if (filtros.celulaOrigemId) {
      query = query.eq('celula_origem_id', filtros.celulaOrigemId);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Erro ao listar processos de multiplicação: ${error.message}`);
    }

    return (data || []) as unknown as CelulaMultiplicacaoItem[];
  }

  async obterMultiplicacaoPorId(ministryId: string, multiplicacaoId: string): Promise<CelulaMultiplicacaoItem | null> {
    const { data, error } = await this.supabase
      .from('celulas_multiplicacoes')
      .select(`
        *,
        celula_origem:celulas!celulas_multiplicacoes_celula_origem_id_fkey(id, nome),
        celula_filha:celulas!celulas_multiplicacoes_celula_filha_id_fkey(id, nome),
        novo_lider:members!celulas_multiplicacoes_novo_lider_member_id_fkey(id, name),
        congregacao:congregacoes(id, nome)
      `)
      .eq('id', multiplicacaoId)
      .eq('ministry_id', ministryId)
      .maybeSingle();

    if (error) {
      throw new Error(`Erro ao buscar multiplicação: ${error.message}`);
    }

    if (!data) return null;

    // Buscar participantes planejados
    const { data: partData } = await this.supabase
      .from('celulas_multiplicacao_participantes')
      .select(`
        *,
        participante:celulas_participantes(id, nome_completo, papel, member:members(id, name))
      `)
      .eq('multiplicacao_id', multiplicacaoId);

    const mult = data as unknown as CelulaMultiplicacaoItem;
    mult.participantes = (partData || []) as any;

    return mult;
  }

  async solicitarMultiplicacao(
    ministryId: string, 
    input: SolicitarMultiplicacaoInput, 
    userId?: string
  ): Promise<CelulaMultiplicacaoItem> {
    if (!input.celula_origem_id) {
      throw new Error('A célula de origem (célula mãe) é obrigatória.');
    }
    if (!input.nome_nova_celula || !input.nome_nova_celula.trim()) {
      throw new Error('O nome da nova célula é obrigatório.');
    }

    // 1. Validar célula de origem
    const { data: celulaOrigem, error: errOrigem } = await this.supabase
      .from('celulas')
      .select('id, ministry_id, congregacao_id, rede_id, status')
      .eq('id', input.celula_origem_id)
      .eq('ministry_id', ministryId)
      .single();

    if (errOrigem || !celulaOrigem) {
      throw new Error('A célula de origem não existe ou não pertence a este ministério.');
    }

    // 2. Validar líder planejado, se fornecido
    if (input.novo_lider_member_id) {
      const { data: lider, error: errLider } = await this.supabase
        .from('members')
        .select('id, ministry_id')
        .eq('id', input.novo_lider_member_id)
        .eq('ministry_id', ministryId)
        .single();

      if (errLider || !lider) {
        throw new Error('O líder planejado para a nova célula não pertence a este ministério.');
      }
    }

    const congregacaoId = input.congregacao_id || celulaOrigem.congregacao_id;

    // 3. Criar registro de multiplicação
    const { data: mult, error: errMult } = await this.supabase
      .from('celulas_multiplicacoes')
      .insert({
        ministry_id: ministryId,
        congregacao_id: congregacaoId,
        celula_origem_id: celulaOrigem.id,
        nome_nova_celula: input.nome_nova_celula.trim(),
        novo_lider_member_id: input.novo_lider_member_id || null,
        novo_vice_lider_member_id: input.novo_vice_lider_member_id || null,
        novo_anfitriao_member_id: input.novo_anfitriao_member_id || null,
        dia_reuniao: input.dia_reuniao || null,
        horario_reuniao: input.horario_reuniao || null,
        endereco_local: input.endereco_local?.trim() || null,
        status: 'solicitada',
        data_planejada: input.data_planejada || null,
        motivo_planejamento: input.motivo_planejamento?.trim() || null,
        solicitado_por_user_id: userId || null,
      })
      .select('*')
      .single();

    if (errMult || !mult) {
      throw new Error(`Erro ao solicitar multiplicação de célula: ${errMult?.message}`);
    }

    // 4. Inserir participantes planejados se houver
    if (input.participantes && input.participantes.length > 0) {
      const registrosPart = input.participantes.map(p => ({
        ministry_id: ministryId,
        multiplicacao_id: mult.id,
        participante_id: p.participante_id,
        papel_planejado: p.papel_planejado || 'membro',
        transferido_efetivo: false,
      }));

      await this.supabase
        .from('celulas_multiplicacao_participantes')
        .insert(registrosPart);
    }

    return mult as unknown as CelulaMultiplicacaoItem;
  }

  async avaliarMultiplicacao(
    ministryId: string, 
    input: AvaliarMultiplicacaoInput, 
    userId?: string
  ): Promise<CelulaMultiplicacaoItem> {
    const { data: mult, error: errFind } = await this.supabase
      .from('celulas_multiplicacoes')
      .select('*')
      .eq('id', input.multiplicacao_id)
      .eq('ministry_id', ministryId)
      .single();

    if (errFind || !mult) {
      throw new Error('Processo de multiplicação não encontrado.');
    }

    if (mult.status === 'efetivada') {
      throw new Error('Não é possível alterar uma multiplicação já efetivada.');
    }

    let novoStatus: CelulaMultiplicacaoStatus;
    const updatePayload: Record<string, unknown> = {
      avaliado_por_user_id: userId || null,
      updated_at: new Date().toISOString(),
    };

    if (input.acao === 'aprovar') {
      novoStatus = 'aprovada';
      updatePayload.justificativa_aprovacao = input.justificativa?.trim() || 'Aprovado pela coordenação/pastor';
    } else if (input.acao === 'rejeitar') {
      novoStatus = 'rejeitada';
      updatePayload.motivo_rejeicao = input.justificativa?.trim() || 'Multiplicação reprovada';
    } else {
      novoStatus = 'cancelada';
      updatePayload.motivo_rejeicao = input.justificativa?.trim() || 'Cancelado';
    }

    updatePayload.status = novoStatus;

    const { data, error } = await this.supabase
      .from('celulas_multiplicacoes')
      .update(updatePayload)
      .eq('id', mult.id)
      .eq('ministry_id', ministryId)
      .select('*')
      .single();

    if (error) {
      throw new Error(`Erro ao avaliar multiplicação: ${error.message}`);
    }

    return data as unknown as CelulaMultiplicacaoItem;
  }

  async efetivarMultiplicacao(
    ministryId: string, 
    input: EfetivarMultiplicacaoInput, 
    userId?: string
  ): Promise<{ multiplicacao: CelulaMultiplicacaoItem; novaCelula: CelulaItem }> {
    // 1. Tentar executar via RPC transacional do PostgreSQL (garantia de atomicidade estrita) quando disponível
    if (typeof this.supabase.rpc === 'function') {
      const { data: rpcData, error: errRpc } = await this.supabase.rpc('efetivar_multiplicacao_celula', {
        p_ministry_id: ministryId,
        p_multiplicacao_id: input.multiplicacao_id,
        p_user_id: userId || null,
      });

      if (!errRpc && rpcData) {
        // Buscar objetos completos para retorno padronizado
        const { data: multAtualizada } = await this.supabase
          .from('celulas_multiplicacoes')
          .select('*')
          .eq('id', input.multiplicacao_id)
          .single();

        const { data: novaCelulaData } = await this.supabase
          .from('celulas')
          .select('*')
          .eq('id', rpcData.nova_celula_id)
          .single();

        return {
          multiplicacao: multAtualizada as unknown as CelulaMultiplicacaoItem,
          novaCelula: novaCelulaData as unknown as CelulaItem,
        };
      }

      // Se o RPC falhou por erro de negócio/permissão, repassar exceção imediatamente
      if (errRpc && !errRpc.message?.includes('function') && !errRpc.message?.includes('does not exist')) {
        throw new Error(`Erro ao efetivar multiplicação: ${errRpc.message}`);
      }
    }

    // Fallback transacional em memória / JS (usado em testes ou caso o RPC ainda não tenha sido aplicado no Supabase)
    // 1. Buscar processo de multiplicação aprovado
    const { data: mult, error: errMult } = await this.supabase
      .from('celulas_multiplicacoes')
      .select('*')
      .eq('id', input.multiplicacao_id)
      .eq('ministry_id', ministryId)
      .single();

    if (errMult || !mult) {
      throw new Error('Processo de multiplicação não encontrado.');
    }

    if (mult.status === 'efetivada') {
      throw new Error('Esta multiplicação já foi efetivada anteriormente.');
    }

    if (mult.status !== 'aprovada') {
      throw new Error(`Apenas processos com status 'aprovada' podem ser efetivados (Status atual: ${mult.status}).`);
    }

    // 2. Buscar célula mãe para herdar congregação, rede e genealogia
    const { data: celulaMae, error: errMae } = await this.supabase
      .from('celulas')
      .select('*')
      .eq('id', mult.celula_origem_id)
      .eq('ministry_id', ministryId)
      .single();

    if (errMae || !celulaMae) {
      throw new Error('Célula mãe não encontrada.');
    }

    // 3. Criar a nova célula com genealogia íntegra (celula_mae_id apontando para a origem)
    const { data: novaCelula, error: errNovaCelula } = await this.supabase
      .from('celulas')
      .insert({
        ministry_id: ministryId,
        congregacao_id: mult.congregacao_id || celulaMae.congregacao_id,
        rede_id: celulaMae.rede_id,
        nome: mult.nome_nova_celula,
        celula_mae_id: celulaMae.id,
        lider_member_id: mult.novo_lider_member_id || null,
        vice_lider_member_id: mult.novo_vice_lider_member_id || null,
        anfitriao_member_id: mult.novo_anfitriao_member_id || null,
        dia_semana: mult.dia_reuniao ?? celulaMae.dia_semana,
        horario: mult.horario_reuniao ?? celulaMae.horario,
        endereco: mult.endereco_local || celulaMae.endereco,
        status: 'ativa',
        data_inicio: new Date().toISOString().split('T')[0],
      })
      .select('*')
      .single();

    if (errNovaCelula || !novaCelula) {
      throw new Error(`Erro ao gerar a nova célula multiplicada: ${errNovaCelula?.message}`);
    }

    // 4. Migrar participantes selecionados
    const { data: planejados } = await this.supabase
      .from('celulas_multiplicacao_participantes')
      .select('*')
      .eq('multiplicacao_id', mult.id)
      .eq('ministry_id', ministryId);

    if (planejados && planejados.length > 0) {
      for (const item of planejados) {
        await this.supabase
          .from('celulas_participantes')
          .update({
            celula_id: novaCelula.id,
            congregacao_id: novaCelula.congregacao_id,
            papel: item.papel_planejado || 'membro',
            updated_at: new Date().toISOString(),
          })
          .eq('id', item.participante_id)
          .eq('ministry_id', ministryId);

        await this.supabase
          .from('celulas_transferencias')
          .insert({
            ministry_id: ministryId,
            participante_id: item.participante_id,
            celula_origem_id: celulaMae.id,
            celula_destino_id: novaCelula.id,
            motivo: `Multiplicação da célula: ${mult.nome_nova_celula}`,
            solicitado_por: userId || null,
          });

        await this.supabase
          .from('celulas_multiplicacao_participantes')
          .update({ transferido_efetivo: true })
          .eq('id', item.id);
      }
    }

    // 5. Atualizar multiplicação para 'efetivada' com vínculo à nova célula
    const { data: multAtualizada, error: errAtualizarMult } = await this.supabase
      .from('celulas_multiplicacoes')
      .update({
        celula_filha_id: novaCelula.id,
        status: 'efetivada',
        data_efetivacao: new Date().toISOString(),
        efetivado_por_user_id: userId || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', mult.id)
      .select('*')
      .single();

    if (errAtualizarMult) {
      throw new Error(`Erro ao finalizar status da multiplicação: ${errAtualizarMult.message}`);
    }

    return {
      multiplicacao: multAtualizada as unknown as CelulaMultiplicacaoItem,
      novaCelula: novaCelula as unknown as CelulaItem,
    };
  }

  // --------------------------------------------------------------------------
  // LOTE 6: COMUNICAÇÃO MINISTERIAL E NOTIFICAÇÕES
  // --------------------------------------------------------------------------
  async listarComunicados(
    ministryId: string,
    filtros: {
      congregacaoId?: string | null;
      redeId?: string | null;
      celulaId?: string | null;
      status?: string | null;
    } = {}
  ): Promise<CelulaComunicadoItem[]> {
    let query = this.supabase
      .from('celulas_comunicados')
      .select(`
        *,
        congregacao:congregacoes(id, nome),
        rede:celulas_redes(id, nome),
        celula:celulas(id, nome)
      `)
      .eq('ministry_id', ministryId);

    if (filtros.congregacaoId) {
      query = query.eq('congregacao_id', filtros.congregacaoId);
    }
    if (filtros.redeId) {
      query = query.eq('rede_id', filtros.redeId);
    }
    if (filtros.celulaId) {
      query = query.eq('celula_id', filtros.celulaId);
    }
    if (filtros.status) {
      query = query.eq('status', filtros.status);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Erro ao listar comunicados de células: ${error.message}`);
    }

    return (data || []) as unknown as CelulaComunicadoItem[];
  }

  async salvarComunicado(
    ministryId: string,
    input: SalvarComunicadoInput,
    userId?: string
  ): Promise<CelulaComunicadoItem> {
    if (!input.titulo || !input.titulo.trim()) {
      throw new Error('O título do comunicado é obrigatório.');
    }
    if (!input.conteudo || !input.conteudo.trim()) {
      throw new Error('O conteúdo do comunicado é obrigatório.');
    }

    // Se informou congregação, validar pertença ao ministério
    if (input.congregacao_id) {
      const { data: cong, error: errCong } = await this.supabase
        .from('congregacoes')
        .select('id, ministry_id')
        .eq('id', input.congregacao_id)
        .eq('ministry_id', ministryId)
        .single();

      if (errCong || !cong) {
        throw new Error('A congregação informada não pertence a este ministério.');
      }
    }

    // Se informou célula, validar pertença ao ministério
    if (input.celula_id) {
      const { data: celula, error: errCelula } = await this.supabase
        .from('celulas')
        .select('id, ministry_id')
        .eq('id', input.celula_id)
        .eq('ministry_id', ministryId)
        .single();

      if (errCelula || !celula) {
        throw new Error('A célula informada não pertence a este ministério.');
      }
    }

    const payload: Record<string, unknown> = {
      ministry_id: ministryId,
      congregacao_id: input.congregacao_id || null,
      rede_id: input.rede_id || null,
      celula_id: input.celula_id || null,
      publico_alvo: input.publico_alvo || 'todos',
      titulo: input.titulo.trim(),
      conteudo: input.conteudo.trim(),
      prioridade: input.prioridade || 'normal',
      status: input.status || 'publicado',
      data_expiracao: input.data_expiracao || null,
      updated_at: new Date().toISOString(),
    };

    if (input.id) {
      const { data, error } = await this.supabase
        .from('celulas_comunicados')
        .update(payload)
        .eq('id', input.id)
        .eq('ministry_id', ministryId)
        .select('*')
        .single();

      if (error) {
        throw new Error(`Erro ao atualizar comunicado: ${error.message}`);
      }

      return data as unknown as CelulaComunicadoItem;
    } else {
      payload.autor_user_id = userId || null;
      payload.created_at = new Date().toISOString();

      const { data, error } = await this.supabase
        .from('celulas_comunicados')
        .insert(payload)
        .select('*')
        .single();

      if (error) {
        throw new Error(`Erro ao criar comunicado: ${error.message}`);
      }

      return data as unknown as CelulaComunicadoItem;
    }
  }

  async listarTemplates(ministryId: string): Promise<CelulaTemplateMensagemItem[]> {
    const { data, error } = await this.supabase
      .from('celulas_templates_mensagens')
      .select('*')
      .eq('ministry_id', ministryId)
      .order('tipo', { ascending: true });

    if (error) {
      throw new Error(`Erro ao listar templates de mensagens: ${error.message}`);
    }

    // Se ainda não houver templates, retornar templates padrão do sistema
    if (!data || data.length === 0) {
      return [
        {
          id: 'default-lembrete',
          ministry_id: ministryId,
          tipo: 'lembrete_reuniao',
          titulo: 'Lembrete de Célula',
          corpo_texto: 'Paz do Senhor, {nome}! Hoje temos nossa reunião da {celula} às {horario}. Esperamos por você!',
          variaveis_disponiveis: ['{nome}', '{celula}', '{dia}', '{horario}', '{endereco}'],
          is_ativo: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 'default-boas-vindas',
          ministry_id: ministryId,
          tipo: 'boas_vindas',
          titulo: 'Boas-vindas à Célula',
          corpo_texto: 'Olá, {nome}! Foi uma alegria receber você na {celula}. Que Deus abençoe ricamente sua vida!',
          variaveis_disponiveis: ['{nome}', '{celula}'],
          is_ativo: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];
    }

    return data as unknown as CelulaTemplateMensagemItem[];
  }

  async salvarTemplate(
    ministryId: string,
    input: SalvarTemplateInput
  ): Promise<CelulaTemplateMensagemItem> {
    if (!input.titulo || !input.titulo.trim()) {
      throw new Error('O título do template é obrigatório.');
    }
    if (!input.corpo_texto || !input.corpo_texto.trim()) {
      throw new Error('O corpo da mensagem é obrigatório.');
    }

    const payload: Record<string, unknown> = {
      ministry_id: ministryId,
      tipo: input.tipo,
      titulo: input.titulo.trim(),
      corpo_texto: input.corpo_texto.trim(),
      variaveis_disponiveis: input.variaveis_disponiveis || ['{nome}', '{celula}', '{horario}'],
      is_ativo: input.is_ativo !== undefined ? Boolean(input.is_ativo) : true,
      updated_at: new Date().toISOString(),
    };

    if (input.id) {
      const { data, error } = await this.supabase
        .from('celulas_templates_mensagens')
        .update(payload)
        .eq('id', input.id)
        .eq('ministry_id', ministryId)
        .select('*')
        .single();

      if (error) {
        throw new Error(`Erro ao atualizar template: ${error.message}`);
      }

      return data as unknown as CelulaTemplateMensagemItem;
    } else {
      payload.created_at = new Date().toISOString();
      const { data, error } = await this.supabase
        .from('celulas_templates_mensagens')
        .insert(payload)
        .select('*')
        .single();

      if (error) {
        throw new Error(`Erro ao cadastrar template: ${error.message}`);
      }

      return data as unknown as CelulaTemplateMensagemItem;
    }
  }

  async prepararMensagemWhatsAppManual(
    ministryId: string,
    input: PrepararMensagemWhatsAppInput,
    userId?: string
  ): Promise<MensagemWhatsAppPreparada> {
    // 1. Obter dados da célula
    const { data: celula, error: errCelula } = await this.supabase
      .from('celulas')
      .select('id, ministry_id, congregacao_id, nome, horario, dia_semana, endereco')
      .eq('id', input.celula_id)
      .eq('ministry_id', ministryId)
      .single();

    if (errCelula || !celula) {
      throw new Error('Célula não encontrada ou de outro ministério.');
    }

    // 2. Obter dados do participante
    const { data: participante, error: errPart } = await this.supabase
      .from('celulas_participantes')
      .select('id, nome_completo, telefone, celula_id')
      .eq('id', input.participante_id)
      .eq('ministry_id', ministryId)
      .single();

    if (errPart || !participante) {
      throw new Error('Participante não encontrado ou de outro ministério.');
    }

    if (!participante.telefone || !participante.telefone.trim()) {
      throw new Error('O participante selecionado não possui telefone de contato cadastrado.');
    }

    // 3. Obter template correspondente ou default
    const templates = await this.listarTemplates(ministryId);
    const templateEscolhido = templates.find(t => t.tipo === input.template_tipo) || templates[0];

    // 4. Interpolar variáveis no texto
    let textoFinal = templateEscolhido.corpo_texto
      .replace(/{nome}/g, participante.nome_completo)
      .replace(/{celula}/g, celula.nome)
      .replace(/{horario}/g, celula.horario || 'horário habitual')
      .replace(/{endereco}/g, celula.endereco || 'local habitual');

    if (input.variaveis_adicionais) {
      for (const [chave, valor] of Object.entries(input.variaveis_adicionais)) {
        textoFinal = textoFinal.replace(new RegExp(`{${chave}}`, 'g'), valor);
      }
    }

    // Limpar telefone (apenas números)
    const numeroLimpo = participante.telefone.replace(/\D/g, '');
    const telefoneE164 = numeroLimpo.startsWith('55') ? numeroLimpo : `55${numeroLimpo}`;

    // Montar link direto do WhatsApp web/mobile (sem disparo automático)
    const encodedTexto = encodeURIComponent(textoFinal);
    const linkWhatsApp = `https://wa.me/${telefoneE164}?text=${encodedTexto}`;

    // 5. Registrar no log de auditoria operacional
    const { data: logRecord } = await this.supabase
      .from('celulas_mensagens_logs')
      .insert({
        ministry_id: ministryId,
        congregacao_id: celula.congregacao_id,
        celula_id: celula.id,
        canal: 'whatsapp_manual',
        destinatario_nome: participante.nome_completo,
        destinatario_contato: telefoneE164,
        conteudo_enviado: textoFinal,
        status_envio: 'preparado',
        enviado_por_user_id: userId || null,
      })
      .select('id')
      .maybeSingle();

    return {
      link_whatsapp: linkWhatsApp,
      destinatario_nome: participante.nome_completo,
      destinatario_telefone: telefoneE164,
      mensagem: textoFinal,
      log_id: logRecord?.id,
    };
  }

  // --------------------------------------------------------------------------
  // LOTE 7: INTELIGÊNCIA PASTORAL E RELATÓRIOS CONSOLIDADOS AVANÇADOS
  // --------------------------------------------------------------------------
  async gerarPainelInteligenciaPastoral(
    ministryId: string,
    filtros: CelulaFiltrosInteligencia = {}
  ): Promise<CelulaInteligenciaPastoralReport> {
    const agora = new Date();
    const dataFimStr = filtros.data_fim || agora.toISOString().split('T')[0];
    
    // Default para início: 90 dias atrás (3 meses operacionais) se não especificado
    const dataInicioPadrao = new Date(agora.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const dataInicioStr = filtros.data_inicio || dataInicioPadrao;

    // 1. Consultar Células no escopo
    let celulasQuery = this.supabase
      .from('celulas')
      .select('id, ministry_id, congregacao_id, rede_id, supervisao_id, nome, status, data_fundacao, lider_member_id, leader:members!celulas_lider_member_id_fkey(name)')
      .eq('ministry_id', ministryId);

    if (filtros.congregacao_id) {
      celulasQuery = celulasQuery.eq('congregacao_id', filtros.congregacao_id);
    }
    if (filtros.rede_id) {
      celulasQuery = celulasQuery.eq('rede_id', filtros.rede_id);
    }
    if (filtros.celula_id) {
      celulasQuery = celulasQuery.eq('id', filtros.celula_id);
    }

    const { data: celulasData, error: errCelulas } = await celulasQuery;
    if (errCelulas) {
      throw new Error(`Erro ao buscar células para inteligência pastoral: ${errCelulas.message}`);
    }
    const celulas = celulasData || [];
    const celulaIds = celulas.map(c => c.id);

    const totalCelulas = celulas.length;
    const celulasAtivas = celulas.filter(c => c.status === 'ativa').length;
    const celulasEmFormacao = celulas.filter(c => c.status === 'em_formacao').length;
    const celulasInativas = celulas.filter(c => c.status === 'inativa' || c.status === 'pausada').length;

    // 2. Consultar Participantes Vinculados
    let participantesQuery = this.supabase
      .from('celulas_participantes')
      .select('id, celula_id, congregacao_id, member_id, status, papel, nome_completo')
      .eq('ministry_id', ministryId);

    if (filtros.congregacao_id) {
      participantesQuery = participantesQuery.eq('congregacao_id', filtros.congregacao_id);
    }
    if (filtros.celula_id) {
      participantesQuery = participantesQuery.eq('celula_id', filtros.celula_id);
    }

    const { data: partData } = await participantesQuery;
    // Filtrar participantes que pertencem às células já filtradas por rede (se houver filtro de rede)
    const participantes = (partData || []).filter(p => celulaIds.length === 0 || celulaIds.includes(p.celula_id));

    const totalMembrosVinculados = participantes.length;
    const participantesRegularesAtivos = participantes.filter(p => p.status === 'ativo').length;
    const lideresAtuantes = participantes.filter(p => p.status === 'ativo' && (p.papel === 'lider' || p.papel === 'vice_lider')).length;

    // 3. Consultar Reuniões no Período
    let reunioesQuery = this.supabase
      .from('celulas_reunioes')
      .select('id, celula_id, congregacao_id, data_reuniao, status, total_presentes, presentes_membros, presentes_visitantes, presentes_criancas, conversoes_decisoes, reconciliacoes')
      .eq('ministry_id', ministryId)
      .gte('data_reuniao', dataInicioStr)
      .lte('data_reuniao', dataFimStr)
      .order('data_reuniao', { ascending: true });

    if (filtros.congregacao_id) {
      reunioesQuery = reunioesQuery.eq('congregacao_id', filtros.congregacao_id);
    }
    if (filtros.celula_id) {
      reunioesQuery = reunioesQuery.eq('celula_id', filtros.celula_id);
    }

    const { data: reunioesData } = await reunioesQuery;
    const reunioes = (reunioesData || []).filter(r => celulaIds.length === 0 || celulaIds.includes(r.celula_id));

    const reunioesRealizadas = reunioes.filter(r => r.status === 'finalizada');
    const reunioesCanceladas = reunioes.filter(r => r.status === 'cancelada').length;

    let presencasTotaisAcumuladas = 0;
    let visitantesTotais = 0;
    let conversoesDecisoes = 0;
    let reconciliacoes = 0;

    for (const r of reunioesRealizadas) {
      presencasTotaisAcumuladas += (r.total_presentes || (r.presentes_membros + r.presentes_visitantes) || 0);
      visitantesTotais += (r.presentes_visitantes || 0);
      conversoesDecisoes += (r.conversoes_decisoes || 0);
      reconciliacoes += (r.reconciliacoes || 0);
    }

    // 4. Consultar Frequências Nominais para Pessoas Únicas Identificadas
    const reuniaoIdsRealizadas = reunioesRealizadas.map(r => r.id);
    let presencasUnicasIdentificadas = 0;

    if (reuniaoIdsRealizadas.length > 0) {
      const { data: freqData } = await this.supabase
        .from('celulas_frequencias')
        .select('member_id, nome_participante, presente')
        .eq('ministry_id', ministryId)
        .eq('presente', true)
        .in('reuniao_id', reuniaoIdsRealizadas);

      if (freqData && freqData.length > 0) {
        const pessoasUnicasSet = new Set<string>();
        for (const f of freqData) {
          if (f.member_id) {
            pessoasUnicasSet.add(`m_${f.member_id}`);
          } else if (f.nome_participante) {
            pessoasUnicasSet.add(`n_${f.nome_participante.trim().toLowerCase()}`);
          }
        }
        presencasUnicasIdentificadas = pessoasUnicasSet.size;
      }
    }

    // 5. Consultar Supervisões Pastoral e Solicitações de Apoio
    let supQuery = this.supabase
      .from('celulas_supervisoes')
      .select('id, celula_id, congregacao_id, status, solicitou_apoio_pastoral, data_agendada, detalhe_apoio')
      .eq('ministry_id', ministryId);

    if (filtros.congregacao_id) {
      supQuery = supQuery.eq('congregacao_id', filtros.congregacao_id);
    }
    if (filtros.celula_id) {
      supQuery = supQuery.eq('celula_id', filtros.celula_id);
    }

    const { data: supData } = await supQuery;
    const supervisoes = (supData || []).filter(s => celulaIds.length === 0 || celulaIds.includes(s.celula_id));

    const supervisoesRealizadas = supervisoes.filter(s => s.status === 'realizada').length;
    const solicitacoesApoioPendentes = supervisoes.filter(s => s.solicitou_apoio_pastoral && s.status !== 'realizada').length;

    // 6. Consultar Multiplicações Efetivadas no Período
    let multQuery = this.supabase
      .from('celulas_multiplicacoes')
      .select('id, congregacao_id, celula_origem_id, status, data_efetivacao')
      .eq('ministry_id', ministryId)
      .eq('status', 'efetivada');

    if (filtros.congregacao_id) {
      multQuery = multQuery.eq('congregacao_id', filtros.congregacao_id);
    }

    const { data: multData } = await multQuery;
    const multiplicacoes = (multData || []).filter(m => {
      if (celulaIds.length > 0 && !celulaIds.includes(m.celula_origem_id)) return false;
      if (!m.data_efetivacao) return false;
      const d = m.data_efetivacao.split('T')[0];
      return d >= dataInicioStr && d <= dataFimStr;
    });
    const totalMultiplicacoes = multiplicacoes.length;

    // 7. Alertas Operacionais e Diagnóstico de Saúde por Célula
    const alertasOperacionais: CelulaAlertaOperacional[] = [];
    const saudeCelulas: CelulaSaudeItem[] = [];

    const hojeMs = agora.getTime();

    for (const celula of celulas) {
      if (celula.status !== 'ativa') continue;

      const reunioesDaCelula = reunioesRealizadas
        .filter(r => r.celula_id === celula.id)
        .sort((a, b) => new Date(b.data_reuniao).getTime() - new Date(a.data_reuniao).getTime());

      const participantesDaCelula = participantes.filter(p => p.celula_id === celula.id && p.status === 'ativo');
      const ultimaReuniao = reunioesDaCelula[0] || null;

      let diasDesdeUltimaReuniao: number | null = null;
      if (ultimaReuniao) {
        const diffMs = hojeMs - new Date(ultimaReuniao.data_reuniao).getTime();
        diasDesdeUltimaReuniao = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
      }

      // Média de presença nas últimas 4 reuniões
      const ultimas4 = reunioesDaCelula.slice(0, 4);
      const somaPresencas4 = ultimas4.reduce((acc, r) => acc + (r.total_presentes || (r.presentes_membros + r.presentes_visitantes) || 0), 0);
      const mediaPresenca4 = ultimas4.length > 0 ? Math.round(somaPresencas4 / ultimas4.length) : 0;

      const visitantesCelula = reunioesDaCelula.reduce((acc, r) => acc + (r.presentes_visitantes || 0), 0);
      const decisoesCelula = reunioesDaCelula.reduce((acc, r) => acc + (r.conversoes_decisoes || 0), 0);

      // Classificação estimada de saúde operacional
      let diagnosticoEstimado: 'saudavel' | 'atencao' | 'critico' | 'pronta_multiplicar' = 'saudavel';

      if (participantesDaCelula.length >= 15 && mediaPresenca4 >= 12) {
        diagnosticoEstimado = 'pronta_multiplicar';
        alertasOperacionais.push({
          tipo: 'preparacao_multiplicacao',
          nivel: 'baixo',
          celula_id: celula.id,
          celula_nome: celula.nome,
          congregacao_id: celula.congregacao_id,
          mensagem: `Célula com ${participantesDaCelula.length} participantes ativos e média de ${mediaPresenca4} presentes. Elegível para plano de multiplicação.`,
          data_referencia: ultimaReuniao?.data_reuniao || null,
        });
      } else if (diasDesdeUltimaReuniao !== null && diasDesdeUltimaReuniao > 21) {
        diagnosticoEstimado = 'critico';
        alertasOperacionais.push({
          tipo: 'sem_reuniao_recente',
          nivel: 'critico',
          celula_id: celula.id,
          celula_nome: celula.nome,
          congregacao_id: celula.congregacao_id,
          mensagem: `Sem reuniões realizadas há ${diasDesdeUltimaReuniao} dias. Risco de desmobilização.`,
          data_referencia: ultimaReuniao?.data_reuniao || null,
        });
      } else if (diasDesdeUltimaReuniao !== null && diasDesdeUltimaReuniao > 14) {
        diagnosticoEstimado = 'atencao';
        alertasOperacionais.push({
          tipo: 'relatorio_pendente',
          nivel: 'medio',
          celula_id: celula.id,
          celula_nome: celula.nome,
          congregacao_id: celula.congregacao_id,
          mensagem: `Relatório de reunião pendente há mais de 14 dias.`,
          data_referencia: ultimaReuniao?.data_reuniao || null,
        });
      } else if (ultimas4.length >= 3 && mediaPresenca4 < 3) {
        diagnosticoEstimado = 'atencao';
        alertasOperacionais.push({
          tipo: 'baixa_frequencia',
          nivel: 'medio',
          celula_id: celula.id,
          celula_nome: celula.nome,
          congregacao_id: celula.congregacao_id,
          mensagem: `Baixa frequência consistente (média de ${mediaPresenca4} participantes nas últimas reuniões).`,
          data_referencia: ultimaReuniao?.data_reuniao || null,
        });
      }

      saudeCelulas.push({
        celula_id: celula.id,
        celula_nome: celula.nome,
        congregacao_id: celula.congregacao_id,
        lider_nome: (celula as any).leader?.name || null,
        total_participantes: participantesDaCelula.length,
        media_presenca_ultimas_4_reunioes: mediaPresenca4,
        total_visitantes_periodo: visitantesCelula,
        decisoes_periodo: decisoesCelula,
        ultima_reuniao_data: ultimaReuniao?.data_reuniao || null,
        dias_desde_ultima_reuniao: diasDesdeUltimaReuniao,
        diagnostico_estimado: diagnosticoEstimado,
      });
    }

    // Verificar solicitações de apoio em aberto para alertas
    const apoiosAbertos = supervisoes.filter(s => s.solicitou_apoio_pastoral && s.status !== 'realizada');
    for (const ap of apoiosAbertos) {
      const cel = celulas.find(c => c.id === ap.celula_id);
      alertasOperacionais.push({
        tipo: 'solicitacao_apoio',
        nivel: 'alto',
        celula_id: ap.celula_id,
        celula_nome: cel?.nome || 'Célula',
        congregacao_id: ap.congregacao_id,
        mensagem: ap.detalhe_apoio || 'Solicitação de intervenção ou apoio pastoral pendente de atendimento.',
        data_referencia: ap.data_agendada,
      });
    }

    // 8. Série Temporal de Evolução Mensal (YYYY-MM)
    const mapaMeses = new Map<string, CelulaEvolucaoPeriodo>();

    for (const r of reunioesRealizadas) {
      const mesKey = r.data_reuniao.substring(0, 7); // 'YYYY-MM'
      if (!mapaMeses.has(mesKey)) {
        mapaMeses.set(mesKey, {
          periodo_mes: mesKey,
          reunioes_realizadas: 0,
          presencas_acumuladas: 0,
          pessoas_unicas_presentes: 0,
          visitantes_total: 0,
          conversoes_decisoes: 0,
          multiplicacoes_efetivadas: 0,
        });
      }

      const item = mapaMeses.get(mesKey)!;
      item.reunioes_realizadas += 1;
      item.presencas_acumuladas += (r.total_presentes || (r.presentes_membros + r.presentes_visitantes) || 0);
      item.visitantes_total += (r.presentes_visitantes || 0);
      item.conversoes_decisoes += (r.conversoes_decisoes || 0);
    }

    // Adicionar contagem de multiplicações na série temporal
    for (const m of multiplicacoes) {
      if (m.data_efetivacao) {
        const mesKey = m.data_efetivacao.substring(0, 7);
        if (mapaMeses.has(mesKey)) {
          mapaMeses.get(mesKey)!.multiplicacoes_efetivadas += 1;
        }
      }
    }

    const serieTemporal = Array.from(mapaMeses.values()).sort((a, b) => a.periodo_mes.localeCompare(b.periodo_mes));

    return {
      periodo: {
        inicio: dataInicioStr,
        fim: dataFimStr,
        fuso_horario: 'America/Sao_Paulo (UTC-3)',
      },
      escopo: {
        ministry_id: ministryId,
        congregacao_id: filtros.congregacao_id || null,
        rede_id: filtros.rede_id || null,
        celula_id: filtros.celula_id || null,
      },
      indicadores_gerais: {
        total_celulas: totalCelulas,
        celulas_ativas: celulasAtivas,
        celulas_em_formacao: celulasEmFormacao,
        celulas_inativas: celulasInativas,
        total_membros_vinculados: totalMembrosVinculados,
        participantes_regulares_ativos: participantesRegularesAtivos,
        lideres_atuantes: lideresAtuantes,
        reunioes_realizadas: reunioesRealizadas.length,
        reunioes_canceladas: reunioesCanceladas,
        presencas_totais_acumuladas: presencasTotaisAcumuladas,
        presencas_unicas_identificadas: presencasUnicasIdentificadas,
        visitantes_totais: visitantesTotais,
        conversoes_decisoes: conversoesDecisoes,
        reconciliacoes: reconciliacoes,
        multiplicacoes_efetivadas: totalMultiplicacoes,
        supervisoes_realizadas: supervisoesRealizadas,
        solicitacoes_apoio_pendentes: solicitacoesApoioPendentes,
      },
      alertas_operacionais: alertasOperacionais,
      saude_celulas: saudeCelulas,
      serie_temporal: serieTemporal,
    };
  }

  async exportarRelatorioInteligenciaPastoral(
    ministryId: string,
    formato: 'csv' | 'json',
    filtros: CelulaFiltrosInteligencia = {}
  ): Promise<{ conteudo: string; contentType: string; filename: string }> {
    const dados = await this.gerarPainelInteligenciaPastoral(ministryId, filtros);

    if (formato === 'json') {
      return {
        conteudo: JSON.stringify(dados, null, 2),
        contentType: 'application/json',
        filename: `relatorio-inteligencia-celulas-${dados.periodo.inicio}-${dados.periodo.fim}.json`,
      };
    }

    // Formato CSV tabular auditado (sem dados pessoais sensíveis expostos, estritamente operacional)
    const linhas: string[] = [];
    linhas.push('RELATORIO DE INTELIGENCIA PASTORAL - MODULO CELULAS');
    linhas.push(`Periodo;${dados.periodo.inicio} a ${dados.periodo.fim};Fuso;${dados.periodo.fuso_horario}`);
    linhas.push(`Ministerio;${dados.escopo.ministry_id};Congregacao;${dados.escopo.congregacao_id || 'Todas'};Rede;${dados.escopo.rede_id || 'Todas'}`);
    linhas.push('');
    linhas.push('INDICADORES GERAIS');
    linhas.push(`Total de Celulas;${dados.indicadores_gerais.total_celulas}`);
    linhas.push(`Celulas Ativas;${dados.indicadores_gerais.celulas_ativas}`);
    linhas.push(`Participantes Regulares Ativos;${dados.indicadores_gerais.participantes_regulares_ativos}`);
    linhas.push(`Lideres Atuantes;${dados.indicadores_gerais.lideres_atuantes}`);
    linhas.push(`Reunioes Realizadas;${dados.indicadores_gerais.reunioes_realizadas}`);
    linhas.push(`Reunioes Canceladas;${dados.indicadores_gerais.reunioes_canceladas}`);
    linhas.push(`Presencas Totais Acumuladas;${dados.indicadores_gerais.presencas_totais_acumuladas}`);
    linhas.push(`Presencas Unicas Identificadas;${dados.indicadores_gerais.presencas_unicas_identificadas}`);
    linhas.push(`Visitantes Totais;${dados.indicadores_gerais.visitantes_totais}`);
    linhas.push(`Conversoes e Decisoes;${dados.indicadores_gerais.conversoes_decisoes}`);
    linhas.push(`Multiplicacoes Efetivadas;${dados.indicadores_gerais.multiplicacoes_efetivadas}`);
    linhas.push(`Supervisoes Realizadas;${dados.indicadores_gerais.supervisoes_realizadas}`);
    linhas.push(`Solicitacoes Apoio Pendentes;${dados.indicadores_gerais.solicitacoes_apoio_pendentes}`);
    linhas.push('');
    linhas.push('ACOMPANHAMENTO DE SAUDE DAS CELULAS');
    linhas.push('Celula;Lider;Participantes Ativos;Media Presenca 4 Reunioes;Visitantes Periodo;Decisoes Periodo;Ultima Reuniao;Dias Sem Reuniao;Diagnostico Operacional');

    for (const s of dados.saude_celulas) {
      const nomeLimpo = (s.celula_nome || '').replace(/;/g, ' ');
      const liderLimpo = (s.lider_nome || 'N/A').replace(/;/g, ' ');
      linhas.push(`${nomeLimpo};${liderLimpo};${s.total_participantes};${s.media_presenca_ultimas_4_reunioes};${s.total_visitantes_periodo};${s.decisoes_periodo};${s.ultima_reuniao_data || 'N/A'};${s.dias_desde_ultima_reuniao ?? 'N/A'};${s.diagnostico_estimado}`);
    }

    linhas.push('');
    linhas.push('ALERTAS OPERACIONAIS ATIVOS');
    linhas.push('Tipo;Nivel;Celula;Mensagem;Data Referencia');
    for (const a of dados.alertas_operacionais) {
      const celLimpo = (a.celula_nome || '').replace(/;/g, ' ');
      const msgLimpa = (a.mensagem || '').replace(/;/g, ' ');
      linhas.push(`${a.tipo};${a.nivel};${celLimpo};${msgLimpa};${a.data_referencia || 'N/A'}`);
    }

    return {
      conteudo: linhas.join('\r\n'),
      contentType: 'text/csv; charset=utf-8',
      filename: `relatorio-inteligencia-celulas-${dados.periodo.inicio}-${dados.periodo.fim}.csv`,
    };
  }

  // --------------------------------------------------------------------------
  // LOTE 8: ASSISTENTE DE IMPLANTAÇÃO E CONTROLE GRADUAL
  // --------------------------------------------------------------------------
  async obterStatusImplantacao(ministryId: string): Promise<CelulaStatusImplantacao> {
    const config = await this.obterConfiguracao(ministryId);

    // 1. Redes cadastradas
    const { data: redes } = await this.supabase
      .from('celulas_redes')
      .select('id')
      .eq('ministry_id', ministryId);
    const totalRedes = redes?.length || 0;

    // 2. Células cadastradas
    const { data: celulas } = await this.supabase
      .from('celulas')
      .select('id, lider_member_id')
      .eq('ministry_id', ministryId);
    const totalCelulas = celulas?.length || 0;
    const totalLideres = (celulas || []).filter(c => c.lider_member_id !== null).length;

    // Critérios das etapas conceituais
    const etapaMetodologiaOk = Boolean(config.id && config.metodologia && config.termo_celula);
    const etapaOrganizacaoOk = totalRedes > 0 || totalCelulas > 0;
    const etapaLiderancaOk = totalLideres > 0;
    const etapaReunioesOk = config.dia_padrao_reuniao !== null && Boolean(config.frequencia_obrigatoria);
    const etapaOpcionaisOk = Boolean(config.id);
    const etapaRevisaoOk = config.is_ativo && etapaMetodologiaOk && etapaOrganizacaoOk;

    let etapaAtual: CelulaEtapaImplantacao = 'metodologia';
    if (!etapaMetodologiaOk) {
      etapaAtual = 'metodologia';
    } else if (!etapaOrganizacaoOk) {
      etapaAtual = 'organizacao';
    } else if (!etapaLiderancaOk) {
      etapaAtual = 'lideranca';
    } else if (!etapaReunioesOk) {
      etapaAtual = 'reunioes';
    } else if (!etapaOpcionaisOk) {
      etapaAtual = 'funcionalidades_opcionais';
    } else {
      etapaAtual = 'revisao';
    }

    return {
      is_ativo: config.is_ativo,
      etapa_atual: etapaAtual,
      concluido: etapaRevisaoOk,
      etapas_status: {
        metodologia: etapaMetodologiaOk,
        organizacao: etapaOrganizacaoOk,
        lideranca: etapaLiderancaOk,
        reunioes: etapaReunioesOk,
        funcionalidades_opcionais: etapaOpcionaisOk,
        revisao: etapaRevisaoOk,
      },
      total_redes: totalRedes,
      total_celulas: totalCelulas,
      total_lideres_designados: totalLideres,
      configuracao: config,
    };
  }

  async alternarAtivacaoModulo(ministryId: string, ativar: boolean): Promise<CelulaConfiguracao> {
    const configAtual = await this.obterConfiguracao(ministryId);
    return this.salvarConfiguracao(ministryId, {
      ...configAtual,
      is_ativo: ativar,
    });
  }
}


