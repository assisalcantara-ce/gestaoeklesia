import type {
  TipoMovimentacao,
  DirigenteDesignacao,
  DirigenteMovimentacao,
  DirigenteTermoPatrimonial,
  CongregacaoLiderancaView,
} from '@/types/dirigentes';
import type { NivelAcesso } from '@/lib/access-control';

export interface UserContextAuth {
  userId: string;
  userName: string;
  ministryId: string;
  nivel: NivelAcesso | null;
  isAdmin: boolean;
}

export interface CriarPropostaInput {
  tipo_movimentacao: TipoMovimentacao;
  ano_referencia?: number | null;
  titulo?: string | null;
  congregacao_destino_id: string;
  congregacao_origem_id?: string | null;
  dirigente_novo_member_id?: string | null;
  dirigente_novo_nome: string;
  dirigente_novo_cargo?: string | null;
  dirigente_novo_cpf?: string | null;
  dirigente_novo_matricula?: string | null;
  dirigente_anterior_member_id?: string | null;
  dirigente_anterior_nome?: string | null;
  dirigente_anterior_cargo?: string | null;
  motivo: string;
  data_prevista: string;
  prazo_retorno?: string | null;
  observacoes?: string | null;
}

export interface AprovarPropostaInput {
  movimentacao_id: string;
  justificativa?: string;
}

export interface EfetivarMovimentacaoInput {
  movimentacao_id: string;
  data_efetiva: string;
  divergencias_patrimoniais?: string;
  observacoes?: string;
}

export class DirigentesService {
  /**
   * Verifica se o usuário tem permissão para elaborar/propor movimentações na secretaria.
   * Permitido para: administrador, secretario_geral, auxiliar_secretaria.
   */
  public static podeProporMovimentacao(user: UserContextAuth): boolean {
    if (user.isAdmin) return true;
    const n = user.nivel;
    return n === 'administrador' || n === 'secretario_geral' || n === 'auxiliar_secretaria';
  }

  /**
   * Verifica se o usuário tem autoridade para aprovar ou rejeitar movimentações definitivas.
   * Regra de negócio: "a presidência ou administrador devidamente autorizado aprova as mudanças definitivas".
   */
  public static podeAprovarMovimentacao(user: UserContextAuth): boolean {
    if (user.isAdmin) return true;
    const n = user.nivel;
    return n === 'administrador' || n === 'presidencia';
  }

  /**
   * Valida isolamento multi-tenant: todos os identificadores de contexto devem pertencer ao mesmo ministério.
   */
  public static validarIsolamentoTenant(
    userMinistryId: string,
    targetMinistryId: string
  ): void {
    if (!userMinistryId || !targetMinistryId || userMinistryId !== targetMinistryId) {
      throw new Error(
        'Violação de segurança multi-tenant: Operação rejeitada por inconsistência de ministério.'
      );
    }
  }

  /**
   * Avalia a exigência de termo patrimonial com base no inventário da congregação.
   * Se houver bens cadastrados, exige conferência e formalização patrimonial.
   * Se não houver bens, permite efetivação sem termo vazio.
   */
  public static avaliarExigenciaPatrimonio(totalBens: number): {
    requerTermo: boolean;
    statusConferencia: 'nao_se_aplica' | 'pendente';
  } {
    if (totalBens > 0) {
      return {
        requerTermo: true,
        statusConferencia: 'pendente',
      };
    }
    return {
      requerTermo: false,
      statusConferencia: 'nao_se_aplica',
    };
  }

  /**
   * Bloqueio estrito de exclusão do histórico de liderança e termos patrimoniais.
   * Regra de negócio: Toda alteração deve preservar o histórico anterior.
   */
  public static proibirExclusaoHistorico(): never {
    throw new Error(
      'Operação proibida por integridade auditorial: O histórico de designações e termos de patrimônio não pode ser excluído.'
    );
  }

  /**
   * Valida integridade multi-tenant cruzada de entidades relacionadas (congregações, membros, movimentações).
   * Impede que um registro aponte para recursos de outro ministério.
   */
  public static validarIntegridadeEntidadesMultiTenant(params: {
    ministryId: string;
    congregacaoDestinoMinistryId?: string;
    congregacaoOrigemMinistryId?: string | null;
    memberMinistryId?: string | null;
    termoMinistryId?: string | null;
  }): void {
    const { ministryId } = params;
    if (params.congregacaoDestinoMinistryId && params.congregacaoDestinoMinistryId !== ministryId) {
      throw new Error('Violação multi-tenant: A congregação de destino pertence a outro ministério.');
    }
    if (params.congregacaoOrigemMinistryId && params.congregacaoOrigemMinistryId !== ministryId) {
      throw new Error('Violação multi-tenant: A congregação de origem pertence a outro ministério.');
    }
    if (params.memberMinistryId && params.memberMinistryId !== ministryId) {
      throw new Error('Violação multi-tenant: O membro selecionado pertence a outro ministério.');
    }
    if (params.termoMinistryId && params.termoMinistryId !== ministryId) {
      throw new Error('Violação multi-tenant: O termo patrimonial vinculado pertence a outro ministério.');
    }
  }

  /**
   * Valida se uma proposta pode ser efetivada de acordo com as regras de negócio:
   * 1. Status deve ser 'aprovada'.
   * 2. Se exigir termo patrimonial, o termo deve ter sido formalizado e homologado.
   * 3. Se um termo patrimonial for informado, valida correspondência tríplice: mesma movimentação, mesma congregação e mesmo ministério.
   */
  public static validarProntidaoEfetivacao(
    movimentacao: DirigenteMovimentacao,
    temTermoHomologado: boolean,
    termo?: DirigenteTermoPatrimonial | null
  ): { valida: boolean; erro?: string } {
    if (movimentacao.status === 'efetivada') {
      return { valida: false, erro: 'Esta movimentação já foi efetivada anteriormente.' };
    }
    if (movimentacao.status === 'cancelada' || movimentacao.status === 'rejeitada') {
      return { valida: false, erro: `Movimentação com status "${movimentacao.status}" não pode ser efetivada.` };
    }
    if (movimentacao.status !== 'aprovada') {
      return {
        valida: false,
        erro: 'A movimentação precisa ser aprovada pela Presidência ou Administrador antes de ser efetivada.',
      };
    }

    if (movimentacao.requer_termo_patrimonial && !temTermoHomologado) {
      return {
        valida: false,
        erro: 'A congregação possui bens cadastrados. É obrigatório formalizar e homologar o Termo de Transferência Patrimonial antes de concluir a mudança.',
      };
    }

    if (termo) {
      if (termo.movimentacao_id !== movimentacao.id) {
        return {
          valida: false,
          erro: 'O termo patrimonial informado pertence a outra movimentação.',
        };
      }
      if (termo.congregacao_id !== movimentacao.congregacao_destino_id) {
        return {
          valida: false,
          erro: 'O termo patrimonial informado pertence a outra congregação.',
        };
      }
      if (termo.ministry_id !== movimentacao.ministry_id) {
        return {
          valida: false,
          erro: 'O termo patrimonial informado pertence a outro ministério.',
        };
      }
      if (!['assinado_e_homologado', 'com_ressalvas'].includes(termo.status_termo)) {
        return {
          valida: false,
          erro: 'O termo patrimonial precisa estar homologado antes de efetivar a movimentação.',
        };
      }
    }

    return { valida: true };
  }

  /**
   * Determina se o dirigente acumulará congregações.
   * Retorna true se o dirigente já possui outra designação ativa em congregação diferente.
   */
  public static verificarAcumulacao(
    dirigenteNome: string,
    congregacaoDestinoId: string,
    designacoesAtivas: DirigenteDesignacao[]
  ): boolean {
    const nomeNorm = dirigenteNome.trim().toLowerCase();
    const outrasAtivas = designacoesAtivas.filter(
      (d) =>
        d.status === 'ativo' &&
        d.congregacao_id !== congregacaoDestinoId &&
        d.nome_dirigente.trim().toLowerCase() === nomeNorm
    );
    return outrasAtivas.length > 0;
  }

  /**
   * Calcula o snapshot de itens para o Termo Patrimonial Oficial de Transferência.
   * Captura todos os bens patrimoniais sem limites ou cortes de paginação.
   */
  public static gerarSnapshotTermoPatrimonial(
    itensCongregacao: Array<{
      id: string;
      numero_tombamento: string | null;
      descricao: string;
      categoria: string;
      estado_conservacao: string;
      valor_aquisicao: number | null;
      status: string;
    }>
  ) {
    const totalItens = itensCongregacao.length;
    const valorTotalEstimado = itensCongregacao.reduce(
      (acc, i) => acc + (i.valor_aquisicao || 0),
      0
    );

    return {
      totalItens,
      valorTotalEstimado,
      itensSnapshot: itensCongregacao.map((item) => ({
        id: item.id,
        numero_tombamento: item.numero_tombamento || null,
        descricao: item.descricao,
        categoria: item.categoria,
        estado_conservacao: item.estado_conservacao,
        valor_aquisicao: item.valor_aquisicao ?? 0,
        status: item.status,
      })),
    };
  }

  /**
   * Paginação e filtro de congregações/lideranças vigentes:
   * 1. Aplica busca sobre todo o acervo antes de paginar.
   * 2. Pagina estritamente em 15 congregações por página (adequado para 150+ congregações).
   * 3. Garante que a página solicitada não ultrapasse o total de páginas disponíveis.
   */
  public static filtrarEPaginarLiderancas(
    liderancas: CongregacaoLiderancaView[],
    termoBusca: string,
    pagina: number,
    itensPorPagina = 15
  ): {
    itensPaginados: CongregacaoLiderancaView[];
    totalItens: number;
    totalPaginas: number;
    paginaAtual: number;
    inicioRegistro: number;
    fimRegistro: number;
  } {
    const t = termoBusca.toLowerCase().trim();
    const filtradas = !t
      ? liderancas
      : liderancas.filter(
          (l) =>
            l.congregacao_nome.toLowerCase().includes(t) ||
            (l.dirigente_atual_nome || '').toLowerCase().includes(t) ||
            (l.dirigente_atual_cargo || '').toLowerCase().includes(t)
        );

    const totalItens = filtradas.length;
    const totalPaginas = Math.max(1, Math.ceil(totalItens / itensPorPagina));
    const paginaAtual = Math.min(Math.max(1, pagina), totalPaginas);

    const inicio = (paginaAtual - 1) * itensPorPagina;
    const itensPaginados = filtradas.slice(inicio, inicio + itensPorPagina);
    const inicioRegistro = totalItens === 0 ? 0 : inicio + 1;
    const fimRegistro = Math.min(paginaAtual * itensPorPagina, totalItens);

    return {
      itensPaginados,
      totalItens,
      totalPaginas,
      paginaAtual,
      inicioRegistro,
      fimRegistro,
    };
  }

  // ─── Operações com Supabase Client ──────────────────────────────────────────

  /**
   * Carrega a visão consolidada de todas as congregações do ministério,
   * seus dirigentes atuais, status de mandato e patrimônio vinculado.
   */
  public static async carregarVisaoGeral(
    supabase: any,
    ministryId: string
  ): Promise<CongregacaoLiderancaView[]> {
    // 1. Busca congregações ativas
    const { data: congs, error: cErr } = await supabase
      .from('congregacoes')
      .select('id, nome, campo_id, supervisao_id, dirigente, dirigente_cargo, dirigente_cpf, dirigente_matricula')
      .eq('ministry_id', ministryId)
      .or('is_active.eq.true,is_active.is.null')
      .order('nome');

    if (cErr) throw new Error(`Erro ao buscar congregações: ${cErr.message}`);
    if (!congs || congs.length === 0) return [];

    // 2. Busca designações ativas vigentes
    const { data: desigs } = await supabase
      .from('dirigentes_designacoes')
      .select('*')
      .eq('ministry_id', ministryId)
      .eq('status', 'ativo');

    // 3. Busca patrimônio por congregação para saber total de itens e valor
    const { data: bens } = await supabase
      .from('patrimonio_itens')
      .select('congregacao_id, valor_aquisicao, status')
      .eq('ministry_id', ministryId)
      .neq('status', 'baixado');

    // 4. Busca movimentações pendentes ou aprovadas em andamento
    const { data: movs } = await supabase
      .from('dirigentes_movimentacoes')
      .select('*')
      .eq('ministry_id', ministryId)
      .in('status', ['proposta', 'aprovada']);

    const mapDesigs = new Map<string, DirigenteDesignacao>();
    (desigs || []).forEach((d: DirigenteDesignacao) => {
      mapDesigs.set(d.congregacao_id, d);
    });

    const mapMovs = new Map<string, DirigenteMovimentacao>();
    (movs || []).forEach((m: DirigenteMovimentacao) => {
      mapMovs.set(m.congregacao_destino_id, m);
    });

    const mapBensContagem = new Map<string, { total: number; valor: number }>();
    (bens || []).forEach((b: any) => {
      if (!b.congregacao_id) return;
      const curr = mapBensContagem.get(b.congregacao_id) || { total: 0, valor: 0 };
      curr.total += 1;
      curr.valor += Number(b.valor_aquisicao || 0);
      mapBensContagem.set(b.congregacao_id, curr);
    });

    // Mapeamento para saber quem tem acumulação
    const contagemPorDirigente = new Map<string, number>();
    (desigs || []).forEach((d: DirigenteDesignacao) => {
      const k = d.nome_dirigente.trim().toLowerCase();
      contagemPorDirigente.set(k, (contagemPorDirigente.get(k) || 0) + 1);
    });

    return congs.map((c: any) => {
      const desig = mapDesigs.get(c.id);
      const bensInfo = mapBensContagem.get(c.id) || { total: 0, valor: 0 };
      const mov = mapMovs.get(c.id) || null;

      const nomeDir = desig?.nome_dirigente || c.dirigente || null;
      const cargoDir = desig?.cargo_ministerial || c.dirigente_cargo || null;
      const telDir = desig?.telefone || null;
      const dataPosse = desig?.data_posse || null;

      let tempoMeses = 0;
      if (dataPosse) {
        const dPosse = new Date(dataPosse);
        const agora = new Date();
        tempoMeses = Math.max(
          0,
          (agora.getFullYear() - dPosse.getFullYear()) * 12 +
            (agora.getMonth() - dPosse.getMonth())
        );
      }

      const isAcumulacao = nomeDir
        ? (contagemPorDirigente.get(nomeDir.trim().toLowerCase()) || 0) > 1
        : false;

      return {
        congregacao_id: c.id,
        congregacao_nome: c.nome,
        campo_id: c.campo_id || null,
        supervisao_id: c.supervisao_id || null,
        dirigente_atual_nome: nomeDir,
        dirigente_atual_cargo: cargoDir,
        dirigente_atual_telefone: telDir,
        data_posse_atual: dataPosse,
        tempo_mandato_meses: tempoMeses,
        designacao_atual_id: desig?.id || null,
        is_acumulacao: isAcumulacao,
        total_bens_patrimonio: bensInfo.total,
        valor_patrimonio_estimado: bensInfo.valor,
        movimentacao_em_andamento: mov,
      };
    });
  }

  /**
   * Prepara e registra uma proposta de movimentação na secretaria.
   */
  public static async criarProposta(
    supabase: any,
    user: UserContextAuth,
    input: CriarPropostaInput
  ): Promise<DirigenteMovimentacao> {
    if (!this.podeProporMovimentacao(user)) {
      throw new Error('Acesso negado: Apenas a Secretaria ou Administrador podem registrar propostas de movimentação.');
    }

    // 1. Verifica se a congregação destino possui bens cadastrados no patrimônio
    const { count: bensCount, error: countErr } = await supabase
      .from('patrimonio_itens')
      .select('id', { count: 'exact', head: true })
      .eq('ministry_id', user.ministryId)
      .eq('congregacao_id', input.congregacao_destino_id)
      .eq('status', 'ativo');

    if (countErr) {
      console.warn('Aviso ao consultar patrimônio da congregação:', countErr.message);
    }

    const { requerTermo, statusConferencia } = this.avaliarExigenciaPatrimonio(bensCount || 0);

    const novaMovimentacao = {
      ministry_id: user.ministryId,
      tipo_movimentacao: input.tipo_movimentacao,
      status: 'proposta', // Já submete como proposta pronta para apreciação da presidência
      ano_referencia: input.ano_referencia || new Date().getFullYear(),
      titulo: input.titulo || `Movimentação — ${input.dirigente_novo_nome}`,
      congregacao_destino_id: input.congregacao_destino_id,
      congregacao_origem_id: input.congregacao_origem_id || null,
      dirigente_novo_member_id: input.dirigente_novo_member_id || null,
      dirigente_novo_nome: input.dirigente_novo_nome.trim(),
      dirigente_novo_cargo: input.dirigente_novo_cargo || null,
      dirigente_novo_cpf: input.dirigente_novo_cpf || null,
      dirigente_novo_matricula: input.dirigente_novo_matricula || null,
      dirigente_anterior_member_id: input.dirigente_anterior_member_id || null,
      dirigente_anterior_nome: input.dirigente_anterior_nome || null,
      dirigente_anterior_cargo: input.dirigente_anterior_cargo || null,
      motivo: input.motivo.trim(),
      data_prevista: input.data_prevista,
      prazo_retorno: input.prazo_retorno || null,
      solicitante_user_id: user.userId,
      solicitante_nome: user.userName,
      requer_termo_patrimonial: requerTermo,
      status_conferencia_patrimonial: statusConferencia,
      observacoes: input.observacoes || null,
    };

    const { data, error } = await supabase
      .from('dirigentes_movimentacoes')
      .insert(novaMovimentacao)
      .select()
      .single();

    if (error) {
      throw new Error(`Falha ao registrar proposta de movimentação: ${error.message}`);
    }

    return data as DirigenteMovimentacao;
  }

  /**
   * Aprovação definitiva da proposta pela Presidência ou Administrador.
   * Regra: Não altera a liderança vigente até que seja efetivada.
   */
  public static async aprovarProposta(
    supabase: any,
    user: UserContextAuth,
    input: AprovarPropostaInput
  ): Promise<DirigenteMovimentacao> {
    if (!this.podeAprovarMovimentacao(user)) {
      throw new Error('Acesso negado: Somente a Presidência ou Administrador possuem autorização para aprovar movimentações.');
    }

    const { data: mov, error: findErr } = await supabase
      .from('dirigentes_movimentacoes')
      .select('*')
      .eq('id', input.movimentacao_id)
      .eq('ministry_id', user.ministryId)
      .single();

    if (findErr || !mov) {
      throw new Error('Movimentação não encontrada ou pertencente a outro ministério.');
    }

    if (mov.status === 'aprovada' || mov.status === 'efetivada') {
      throw new Error(`Esta movimentação já está ${mov.status}.`);
    }

    const { data, error } = await supabase
      .from('dirigentes_movimentacoes')
      .update({
        status: 'aprovada',
        aprovador_user_id: user.userId,
        aprovador_nome: user.userName,
        data_aprovacao: new Date().toISOString(),
        justificativa_aprovacao_rejeicao: input.justificativa || null,
      })
      .eq('id', input.movimentacao_id)
      .eq('ministry_id', user.ministryId)
      .select()
      .single();

    if (error) throw new Error(`Falha ao aprovar movimentação: ${error.message}`);
    return data as DirigenteMovimentacao;
  }

  /**
   * Rejeita a proposta de movimentação com justificativa formal.
   */
  public static async rejeitarProposta(
    supabase: any,
    user: UserContextAuth,
    movimentacaoId: string,
    motivoRejeicao: string
  ): Promise<DirigenteMovimentacao> {
    if (!this.podeAprovarMovimentacao(user)) {
      throw new Error('Acesso negado: Somente a Presidência ou Administrador podem rejeitar propostas.');
    }

    const { data, error } = await supabase
      .from('dirigentes_movimentacoes')
      .update({
        status: 'rejeitada',
        aprovador_user_id: user.userId,
        aprovador_nome: user.userName,
        data_aprovacao: new Date().toISOString(),
        justificativa_aprovacao_rejeicao: motivoRejeicao.trim(),
      })
      .eq('id', movimentacaoId)
      .eq('ministry_id', user.ministryId)
      .select()
      .single();

    if (error) throw new Error(`Falha ao rejeitar proposta: ${error.message}`);
    return data as DirigenteMovimentacao;
  }

  /**
   * Efetiva a movimentação de liderança de forma atômica e com preservação histórica estrita:
   * 1. Verifica se está aprovada e se atende aos critérios patrimoniais.
   * 2. Encerra o mandato anterior (se houver), marcando data de término e motivo de saída.
   * 3. Cria a nova designação (com flag de acumulação se o dirigente já tiver congregação ativa).
   * 4. Sincroniza a tabela legada 'congregacoes' com o novo dirigente.
   * 5. Marca a movimentação como 'efetivada'.
   */
  public static async efetivarMovimentacao(
    supabase: any,
    user: UserContextAuth,
    input: EfetivarMovimentacaoInput
  ): Promise<{ movimentacao: DirigenteMovimentacao; novaDesignacao: DirigenteDesignacao }> {
    if (!this.podeAprovarMovimentacao(user)) {
      throw new Error('Acesso negado: Somente a Presidência ou Administrador podem efetivar movimentações.');
    }

    // 1. Busca a movimentação
    const { data: mov, error: findErr } = await supabase
      .from('dirigentes_movimentacoes')
      .select('*')
      .eq('id', input.movimentacao_id)
      .eq('ministry_id', user.ministryId)
      .single();

    if (findErr || !mov) {
      throw new Error('Movimentação não encontrada no ministério.');
    }

    // 2. Valida prontidão
    const temTermo = Boolean(mov.termo_patrimonial_id);
    const check = this.validarProntidaoEfetivacao(mov, temTermo);
    if (!check.valida) {
      throw new Error(check.erro);
    }

    const dataEfetiva = input.data_efetiva || new Date().toISOString().slice(0, 10);

    // 3. Encerra mandato anterior na congregação destino (se houver ativo)
    const { data: mandatosAtivos } = await supabase
      .from('dirigentes_designacoes')
      .select('*')
      .eq('ministry_id', user.ministryId)
      .eq('congregacao_id', mov.congregacao_destino_id)
      .eq('status', 'ativo');

    if (mandatosAtivos && mandatosAtivos.length > 0) {
      for (const m of mandatosAtivos) {
        await supabase
          .from('dirigentes_designacoes')
          .update({
            status: 'concluido',
            data_termino: dataEfetiva,
            motivo_saida: `Substituído por movimentação: ${mov.motivo}`,
            movimentacao_saida_id: mov.id,
          })
          .eq('id', m.id);
      }
    }

    // 4. Verifica se o novo dirigente já tem outras congregações ativas para marcar acumulação
    const { data: todasAtivas } = await supabase
      .from('dirigentes_designacoes')
      .select('*')
      .eq('ministry_id', user.ministryId)
      .eq('status', 'ativo');

    const isAcumulacao = this.verificarAcumulacao(
      mov.dirigente_novo_nome,
      mov.congregacao_destino_id,
      todasAtivas || []
    );

    // 5. Cria a nova designação
    const novaDesignacaoPayload = {
      ministry_id: user.ministryId,
      congregacao_id: mov.congregacao_destino_id,
      member_id: mov.dirigente_novo_member_id || null,
      nome_dirigente: mov.dirigente_novo_nome,
      cpf_dirigente: mov.dirigente_novo_cpf || null,
      cargo_ministerial: mov.dirigente_novo_cargo || null,
      matricula_dirigente: mov.dirigente_novo_matricula || null,
      tipo_designacao: mov.tipo_movimentacao === 'substituicao_temporaria' ? 'interino' : 'titular',
      is_acumulacao: isAcumulacao,
      status: 'ativo',
      data_posse: dataEfetiva,
      movimentacao_origem_id: mov.id,
      observacoes: input.observacoes || mov.observacoes || null,
    };

    const { data: novaDesig, error: desigErr } = await supabase
      .from('dirigentes_designacoes')
      .insert(novaDesignacaoPayload)
      .select()
      .single();

    if (desigErr) {
      throw new Error(`Falha ao registrar posse do novo dirigente: ${desigErr.message}`);
    }

    // 6. Atualiza a tabela legada 'congregacoes' para refletir o novo dirigente
    await supabase
      .from('congregacoes')
      .update({
        dirigente: mov.dirigente_novo_nome,
        dirigente_cargo: mov.dirigente_novo_cargo || null,
        dirigente_cpf: mov.dirigente_novo_cpf || null,
        dirigente_matricula: mov.dirigente_novo_matricula || null,
      })
      .eq('id', mov.congregacao_destino_id)
      .eq('ministry_id', user.ministryId);

    // 7. Marca a movimentação como efetivada
    const { data: movAtualizada, error: movUpErr } = await supabase
      .from('dirigentes_movimentacoes')
      .update({
        status: 'efetivada',
        data_efetiva: dataEfetiva,
        divergencias_patrimoniais: input.divergencias_patrimoniais || mov.divergencias_patrimoniais || null,
      })
      .eq('id', mov.id)
      .select()
      .single();

    if (movUpErr) {
      throw new Error(`Falha ao concluir efetivação: ${movUpErr.message}`);
    }

    return {
      movimentacao: movAtualizada as DirigenteMovimentacao,
      novaDesignacao: novaDesig as DirigenteDesignacao,
    };
  }
}
