/**
 * Serviço de Negócio e Governança Pedagógica do Módulo de Discipulado
 * Gestão Eklésia — Fase 2: Currículo, Turmas, Matrículas, Aulas e Progresso
 *
 * Invariantes Fundamentais:
 * 1. O Catálogo CPAD possui 26 lições canônicas neutras distribuídas em 2 Volumes.
 * 2. Chamada/Presença física é segregada da validação pedagógica do aprendizado.
 * 3. Atingir 26 lições conclui apenas a etapa pedagógica (fase = 'preparacao_batismo'),
 *    mantendo rigorosamente status = 'ativo' até batismo/aclamação e membresia pela Secretaria.
 * 4. Integridade multi-tenant em cada operação: todas as entidades validam ministry_id.
 * 5. RPCs transacionais são utilizadas para atomicidade do diário de classe e das reposições.
 */

export interface LicaoCpad {
  id: string;
  volume: number;
  numero: number;
  identificador_referencia: string;
  titulo_padrao: string;
  titulo_sugerido?: string | null;
  titulo_validado: boolean;
  descricao_tematica?: string | null;
  ativo: boolean;
}

export interface EquipeDiscipuladoItem {
  id: string;
  ministry_id: string;
  congregacao_id?: string | null;
  member_id: string;
  papel: 'discipulador' | 'professor' | 'coordenador';
  autorizado_por_id: string;
  data_autorizacao: string;
  ativo: boolean;
  data_inativacao?: string | null;
  motivo_inativacao?: string | null;
  observacoes?: string | null;
  member?: {
    id: string;
    name: string;
    phone?: string | null;
    celular?: string | null;
    foto_url?: string | null;
  };
  congregacao?: {
    id: string;
    nome: string;
  } | null;
}

export interface TurmaDiscipuladoItem {
  id: string;
  ministry_id: string;
  congregacao_id?: string | null;
  nome: string;
  professor_titular_id: string;
  professor_adjunto_id?: string | null;
  modalidade: 'presencial' | 'online' | 'hibrido';
  is_intercongregacional: boolean;
  dias_horarios?: string | null;
  local_sala?: string | null;
  capacidade?: number | null;
  data_inicio?: string | null;
  data_previsao_fim?: string | null;
  status: 'planejada' | 'ativa' | 'concluida' | 'cancelada';
  observacoes?: string | null;
  professor_titular?: {
    id: string;
    name: string;
    foto_url?: string | null;
  };
  congregacao?: {
    id: string;
    nome: string;
  } | null;
  total_alunos?: number;
}

export interface TurmaAlunoMatricula {
  id: string;
  ministry_id: string;
  turma_id: string;
  jornada_id: string;
  member_id: string;
  data_matricula: string;
  status: 'ativo' | 'concluido' | 'transferido' | 'desistente' | 'trancado';
  motivo_desligamento?: string | null;
  member?: {
    id: string;
    name: string;
    phone?: string | null;
    celular?: string | null;
    foto_url?: string | null;
  };
  jornada?: {
    id: string;
    fase: string;
    status: string;
    licoes_concluidas: number;
    congregacao_id?: string | null;
  };
}

export interface ChamadaAlunoInput {
  jornada_id: string;
  member_id: string;
  status: 'presente' | 'ausente' | 'falta_justificada';
  justificativa?: string | null;
}

export interface RegistrarAulaInput {
  turmaId: string;
  licaoId: string;
  professorId: string;
  dataAula: string;
  statusAula: 'agendada' | 'realizada' | 'cancelada' | 'remanejada';
  motivoCancelamento?: string | null;
  chamadas: ChamadaAlunoInput[];
  validarPedagogicoPresentes: boolean;
  conteudoMinistrado?: string | null;
  observacoes?: string | null;
}

export interface ValidarLicaoIndividualInput {
  jornadaId: string;
  licaoId: string;
  validadorId: string;
  modalidade: 'discipulado_individual' | 'reposicao_individual' | 'reposicao_turma_externa' | 'aproveitamento_estudos';
  dataValidacao: string;
  aproveitamentoNota?: number | null;
  observacoes?: string | null;
}

export class DiscipuladoPedagogicoService {
  /**
   * 1. Consulta o catálogo canônico das 26 lições ordenadas por volume e número.
   */
  public static async listarCatalogoLicoes(supabase: any): Promise<LicaoCpad[]> {
    const { data, error } = await supabase
      .from('discipulado_licoes')
      .select('*')
      .eq('ativo', true)
      .order('numero', { ascending: true });

    if (error) {
      throw new Error(`Erro ao consultar catálogo CPAD: ${error.message}`);
    }
    return data || [];
  }

  /**
   * 2. Consulta o progresso pedagógico individual de uma jornada (lições validadas vs pendentes).
   */
  public static async consultarProgressoJornada(
    supabase: any,
    ministryId: string,
    jornadaId: string
  ) {
    // Busca os dados da jornada com membro
    const { data: jornada, error: errJor } = await supabase
      .from('discipulado_jornadas')
      .select(`
        id, ministry_id, congregacao_id, fase, status, licoes_concluidas,
        member:members!discipulado_jornadas_member_id_fkey ( id, name, foto_url )
      `)
      .eq('id', jornadaId)
      .eq('ministry_id', ministryId)
      .single();

    if (errJor || !jornada) {
      throw new Error('Jornada de discipulado não encontrada ou não pertence a este ministério.');
    }

    // Busca todas as lições validadas para esta jornada
    const { data: validadas, error: errVal } = await supabase
      .from('discipulado_progresso_licoes')
      .select(`
        id, licao_id, modalidade_conclusao, data_validacao, aproveitamento_nota, observacoes_pedagogicas,
        licao:discipulado_licoes ( id, volume, numero, identificador_referencia, titulo_padrao, titulo_validado ),
        validador:members!discipulado_progresso_licoes_validador_id_fkey ( id, name )
      `)
      .eq('jornada_id', jornadaId)
      .eq('ministry_id', ministryId)
      .order('data_validacao', { ascending: true });

    if (errVal) {
      throw new Error(`Erro ao consultar progresso pedagógico: ${errVal.message}`);
    }

    // Busca o histórico de presenças / chamadas
    const { data: chamadas, error: errChamadas } = await supabase
      .from('discipulado_turma_chamadas')
      .select(`
        id, status_presenca, justificativa, created_at,
        aula:discipulado_turma_aulas (
          id, data_aula, status_aula,
          licao:discipulado_licoes ( id, volume, numero, titulo_padrao ),
          turma:discipulado_turmas ( id, nome )
        )
      `)
      .eq('jornada_id', jornadaId)
      .eq('ministry_id', ministryId)
      .order('created_at', { ascending: false });

    if (errChamadas) {
      throw new Error(`Erro ao consultar histórico de chamadas: ${errChamadas.message}`);
    }

    return {
      jornada,
      total_validadas: (validadas || []).length,
      licoes_validadas: validadas || [],
      historico_chamadas: chamadas || []
    };
  }

  /**
   * 3. Gerenciamento de Turmas: Listagem com filtros por status e congregação.
   */
  public static async listarTurmas(
    supabase: any,
    ministryId: string,
    filtros?: { congregacaoId?: string | null; status?: string | null }
  ): Promise<TurmaDiscipuladoItem[]> {
    let query = supabase
      .from('discipulado_turmas')
      .select(`
        id, ministry_id, congregacao_id, nome, professor_titular_id, professor_adjunto_id,
        modalidade, is_intercongregacional, dias_horarios, local_sala, capacidade,
        data_inicio, data_previsao_fim, status, observacoes,
        professor_titular:members!discipulado_turmas_professor_titular_id_fkey ( id, name, foto_url ),
        congregacao:congregacoes ( id, nome )
      `)
      .eq('ministry_id', ministryId)
      .order('created_at', { ascending: false });

    if (filtros?.status && filtros.status !== 'todos') {
      query = query.eq('status', filtros.status);
    }
    if (filtros?.congregacaoId) {
      query = query.or(`congregacao_id.eq.${filtros.congregacaoId},is_intercongregacional.eq.true`);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`Erro ao listar turmas: ${error.message}`);
    }
    return data || [];
  }

  /**
   * 4. Matrícula de Aluno em Turma com histórico auditável.
   */
  public static async matricularAluno(
    supabase: any,
    ministryId: string,
    turmaId: string,
    jornadaId: string,
    operadorMemberId?: string | null
  ) {
    // 1. Validar a turma e o tenant
    const { data: turma, error: errTurma } = await supabase
      .from('discipulado_turmas')
      .select('id, ministry_id, status, capacidade')
      .eq('id', turmaId)
      .eq('ministry_id', ministryId)
      .single();

    if (errTurma || !turma) {
      throw new Error('Turma informada não existe ou pertence a outro ministério.');
    }
    if (turma.status === 'cancelada' || turma.status === 'concluida') {
      throw new Error(`Não é possível matricular aluno em turma com status '${turma.status}'.`);
    }

    // 2. Validar a jornada e resgatar member_id
    const { data: jornada, error: errJor } = await supabase
      .from('discipulado_jornadas')
      .select('id, ministry_id, member_id, status')
      .eq('id', jornadaId)
      .eq('ministry_id', ministryId)
      .single();

    if (errJor || !jornada) {
      throw new Error('Jornada de discipulado informada não existe ou pertence a outro ministério.');
    }

    // 3. Inserir matrícula com tratamento de conflito (anti-duplicidade na mesma turma)
    const { data: matricula, error: errMatricula } = await supabase
      .from('discipulado_turma_alunos')
      .insert({
        ministry_id: ministryId,
        turma_id: turmaId,
        jornada_id: jornadaId,
        member_id: jornada.member_id,
        status: 'ativo'
      })
      .select('id')
      .single();

    if (errMatricula) {
      if (errMatricula.code === '23505') {
        throw new Error('Este discípulo já possui matrícula ativa nesta turma.');
      }
      throw new Error(`Erro ao matricular aluno na turma: ${errMatricula.message}`);
    }

    // 4. Registrar evento no histórico
    await supabase.from('discipulado_turma_historico').insert({
      ministry_id: ministryId,
      matricula_id: matricula.id,
      turma_destino_id: turmaId,
      tipo_evento: 'matricula_inicial',
      motivo: 'Matrícula regular iniciada pelo operador.',
      registrado_por_id: operadorMemberId || null
    });

    return { sucesso: true, matriculaId: matricula.id };
  }

  /**
   * 5. Transferência de Turma com rastreamento no histórico.
   */
  public static async transferirTurma(
    supabase: any,
    ministryId: string,
    matriculaId: string,
    novaTurmaId: string,
    motivo: string,
    operadorMemberId?: string | null
  ) {
    // 1. Busca matrícula atual
    const { data: matAtual, error: errMat } = await supabase
      .from('discipulado_turma_alunos')
      .select('id, ministry_id, turma_id, jornada_id, member_id, status')
      .eq('id', matriculaId)
      .eq('ministry_id', ministryId)
      .single();

    if (errMat || !matAtual) {
      throw new Error('Matrícula informada não encontrada.');
    }

    // 2. Valida nova turma
    const { data: novaTurma, error: errNovaTurma } = await supabase
      .from('discipulado_turmas')
      .select('id, ministry_id, status')
      .eq('id', novaTurmaId)
      .eq('ministry_id', ministryId)
      .single();

    if (errNovaTurma || !novaTurma) {
      throw new Error('Nova turma de destino não encontrada neste ministério.');
    }

    // 3. Atualiza matrícula anterior para 'transferido'
    await supabase
      .from('discipulado_turma_alunos')
      .update({ status: 'transferido', motivo_desligamento: `Transferido para turma ${novaTurmaId}: ${motivo}` })
      .eq('id', matriculaId);

    // 4. Cria nova matrícula na nova turma
    const { data: novaMat, error: errNovaMat } = await supabase
      .from('discipulado_turma_alunos')
      .insert({
        ministry_id: ministryId,
        turma_id: novaTurmaId,
        jornada_id: matAtual.jornada_id,
        member_id: matAtual.member_id,
        status: 'ativo'
      })
      .select('id')
      .single();

    if (errNovaMat) {
      throw new Error(`Falha ao registrar matrícula na nova turma: ${errNovaMat.message}`);
    }

    // 5. Registra no histórico
    await supabase.from('discipulado_turma_historico').insert({
      ministry_id: ministryId,
      matricula_id: novaMat.id,
      turma_origem_id: matAtual.turma_id,
      turma_destino_id: novaTurmaId,
      tipo_evento: 'transferencia',
      motivo,
      registrado_por_id: operadorMemberId || null
    });

    return { sucesso: true, novaMatriculaId: novaMat.id };
  }

  /**
   * 6. Registro de Aula e Chamada via RPC atômica blindada.
   */
  public static async registrarAulaEChamada(
    supabase: any,
    input: RegistrarAulaInput
  ) {
    const { data, error } = await supabase.rpc('registrar_aula_e_chamada_turma_rpc', {
      p_turma_id: input.turmaId,
      p_licao_id: input.licaoId,
      p_professor_id: input.professorId,
      p_data_aula: input.dataAula,
      p_status_aula: input.statusAula,
      p_motivo_cancelamento: input.motivoCancelamento || null,
      p_chamadas: input.chamadas,
      p_validar_pedagogico_presentes: input.validarPedagogicoPresentes,
      p_conteudo_ministrado: input.conteudoMinistrado || null,
      p_obs: input.observacoes || null
    });

    if (error) {
      throw new Error(`Erro na execução do diário de classe: ${error.message}`);
    }
    return data;
  }

  /**
   * 7. Validação Pedagógica Individual / Reposição de Lição via RPC atômica.
   */
  public static async validarLicaoIndividual(
    supabase: any,
    input: ValidarLicaoIndividualInput
  ) {
    const { data, error } = await supabase.rpc('validar_licao_individual_rpc', {
      p_jornada_id: input.jornadaId,
      p_licao_id: input.licaoId,
      p_validador_id: input.validadorId,
      p_modalidade: input.modalidade,
      p_data_validacao: input.dataValidacao,
      p_nota: input.aproveitamentoNota || null,
      p_obs: input.observacoes || null
    });

    if (error) {
      throw new Error(`Erro ao validar lição individualmente: ${error.message}`);
    }
    return data;
  }
}
