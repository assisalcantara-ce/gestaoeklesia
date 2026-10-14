import type {
  TipoMovimentacao,
  DirigenteDesignacao,
  DirigenteMovimentacao,
  DirigenteTermoPatrimonial,
  CongregacaoLiderancaView,
  MinistroElegivelBusca,
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
  dirigente_novo_member_id: string;
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
        dirigente_atual_member_id: desig?.member_id || null,
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
   * Consulta pessoas elegíveis cadastradas no perfil ministerial de ministro.
   * Regras:
   * 1. Exige no mínimo 3 caracteres de busca.
   * 2. Consulta restrita ao ministry_id autenticado (isolamento multi-tenant).
   * 3. Filtra apenas ministros ativos (role = 'ministro' ou tipo_cadastro = 'ministro').
   * 4. Exclui estritamente membros comuns, congregados, crianças e visitantes.
   * 5. Retorna nome, matrícula, CPF, cargo ministerial e congregação atual.
   */
  public static async buscarMinistrosElegiveis(
    supabase: any,
    ministryId: string,
    termoBusca: string,
    limite = 15
  ): Promise<MinistroElegivelBusca[]> {
    const termo = (termoBusca || '').trim();
    if (termo.length < 3) return [];
    if (!ministryId) throw new Error('Identificação do ministério ausente para a consulta.');

    const sanitized = termo.replace(/[,()]/g, '');
    if (!sanitized) return [];

    const { data, error } = await supabase
      .from('members')
      .select('id, name, matricula, cpf, cargo_ministerial, congregacao_id, role, tipo_cadastro, status, foto_url, congregacoes(nome)')
      .eq('ministry_id', ministryId)
      .or('status.eq.active,status.eq.ativo')
      .or('role.eq.ministro,tipo_cadastro.eq.ministro')
      .or(`name.ilike.%${sanitized}%,matricula.ilike.%${sanitized}%,cpf.ilike.%${sanitized}%`)
      .order('name', { ascending: true })
      .limit(limite);

    if (error) {
      console.error('Erro na consulta de ministros elegíveis:', error);
      throw new Error(`Falha na consulta de ministros elegíveis: ${error.message}`);
    }

    return (data || [])
      .filter((m: any) => {
        const r = (m.role || '').toLowerCase();
        const tc = (m.tipo_cadastro || '').toLowerCase();
        if (['membro', 'congregado', 'crianca', 'visitante'].includes(r)) return false;
        if (['membro', 'congregado', 'crianca', 'visitante'].includes(tc)) return false;
        return r === 'ministro' || tc === 'ministro';
      })
      .map((m: any) => ({
        id: m.id,
        nome: m.name,
        matricula: m.matricula || null,
        cpf: m.cpf || null,
        cargo_ministerial: m.cargo_ministerial || 'Ministro',
        congregacao_id: m.congregacao_id || null,
        congregacao_nome: m.congregacoes?.nome || null,
        foto_url: m.foto_url || null,
      }));
  }

  /**
   * Valida se um obreiro é elegível para assumir liderança (ministro ativo do tenant).
   */
  public static async validarElegibilidadeMinistro(
    supabase: any,
    ministryId: string,
    memberId: string
  ): Promise<{
    id: string;
    nome: string;
    matricula: string | null;
    cpf: string | null;
    cargo_ministerial: string | null;
  }> {
    if (!memberId) {
      throw new Error('É obrigatório selecionar um ministro elegível cadastrado no sistema.');
    }

    const { data: member, error } = await supabase
      .from('members')
      .select('id, name, matricula, cpf, cargo_ministerial, role, tipo_cadastro, status, ministry_id')
      .eq('id', memberId)
      .eq('ministry_id', ministryId)
      .maybeSingle();

    if (error || !member) {
      throw new Error('Ministro selecionado não encontrado ou pertencente a outro ministério.');
    }

    const st = (member.status || '').toLowerCase();
    if (st !== 'active' && st !== 'ativo') {
      throw new Error(`O ministro selecionado (${member.name}) encontra-se com status "${member.status}". Apenas ministros ativos podem ser designados.`);
    }

    const r = (member.role || '').toLowerCase();
    const tc = (member.tipo_cadastro || '').toLowerCase();
    const isNaoElegivel = ['membro', 'congregado', 'crianca', 'visitante'].includes(r) || ['membro', 'congregado', 'crianca', 'visitante'].includes(tc);
    const isMinistro = r === 'ministro' || tc === 'ministro';

    if (!isMinistro || isNaoElegivel) {
      throw new Error(`O cadastro de ${member.name} não possui o perfil de ministro. Membros comuns, congregados e crianças não são elegíveis para liderar congregações.`);
    }

    return {
      id: member.id,
      nome: member.name,
      matricula: member.matricula || null,
      cpf: member.cpf || null,
      cargo_ministerial: member.cargo_ministerial || 'Pastor',
    };
  }

  /**
   * Registra um evento no histórico individual do obreiro (members.custom_fields).
   * Idempotente: se já existir evento com a mesma chave ou id_movimentacao + tipo_evento, não duplica.
   */
  public static async registrarEventoHistoricoObreiro(
    supabase: any,
    ministryId: string,
    memberId: string,
    evento: {
      id: string;
      movimentacao_id: string;
      tipo_evento: 'posse_dirigente' | 'saida_dirigente';
      tipo_movimentacao: string;
      data: string;
      data_hora_efetivacao: string;
      local: string;
      congregacao_nome: string;
      cargo: string;
      justificativa: string;
      descricao: string;
      responsavel: string;
      usuario_id: string;
    }
  ): Promise<void> {
    if (!memberId || !ministryId) return;

    const { data: member, error: fetchErr } = await supabase
      .from('members')
      .select('id, custom_fields, cargo_ministerial')
      .eq('id', memberId)
      .eq('ministry_id', ministryId)
      .maybeSingle();

    if (fetchErr || !member) return;

    const cf = (member.custom_fields && typeof member.custom_fields === 'object')
      ? { ...(member.custom_fields as Record<string, any>) }
      : {};

    const historicoAtual: any[] = Array.isArray(cf.historico_processos)
      ? [...cf.historico_processos]
      : Array.isArray(cf.historicoProcessos)
      ? [...cf.historicoProcessos]
      : [];

    // Prevenção de duplicidade estrita (idempotência)
    const exists = historicoAtual.some(
      (h) =>
        h.id === evento.id ||
        (h.movimentacao_id === evento.movimentacao_id && h.tipo_evento === evento.tipo_evento)
    );

    if (exists) return;

    const novoItem = {
      id: evento.id,
      processo_id: evento.movimentacao_id,
      movimentacao_id: evento.movimentacao_id,
      ministry_id: ministryId,
      member_id: memberId,
      tipo_evento: evento.tipo_evento,
      tipo_movimentacao: evento.tipo_movimentacao,
      data: evento.data,
      data_hora_efetivacao: evento.data_hora_efetivacao,
      local: evento.local,
      congregacao_nome: evento.congregacao_nome,
      cargo: evento.cargo,
      cargo_resultante: evento.tipo_evento === 'posse_dirigente' ? evento.cargo : null,
      cargo_anterior: evento.tipo_evento === 'saida_dirigente' ? evento.cargo : null,
      justificativa: evento.justificativa,
      parecer: evento.justificativa,
      descricao: evento.descricao,
      responsavel: evento.responsavel,
      usuario_id: evento.usuario_id,
      criado_em: evento.data_hora_efetivacao,
    };

    const nextHistorico = [...historicoAtual, novoItem];

    const { error: upErr } = await supabase
      .from('members')
      .update({
        custom_fields: {
          ...cf,
          historico_processos: nextHistorico,
          historicoProcessos: nextHistorico,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', memberId)
      .eq('ministry_id', ministryId);

    if (upErr) {
      console.error(`Erro ao gravar histórico individual do obreiro ${memberId}:`, upErr);
      throw new Error(`Falha ao registrar histórico individual do ministro: ${upErr.message}`);
    }
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

    if (!input.congregacao_destino_id) {
      throw new Error('A congregação de destino é obrigatória para a proposta.');
    }

    // 1. Valida que a congregação pertence ao mesmo ministério
    const { data: congDest, error: congErr } = await supabase
      .from('congregacoes')
      .select('id, nome, ministry_id')
      .eq('id', input.congregacao_destino_id)
      .eq('ministry_id', user.ministryId)
      .maybeSingle();

    if (congErr || !congDest) {
      throw new Error('Congregação não encontrada ou pertencente a outro ministério.');
    }

    // 2. Valida elegibilidade do novo dirigente selecionado no perfil de ministro ativo
    const ministroElegivel = await this.validarElegibilidadeMinistro(
      supabase,
      user.ministryId,
      input.dirigente_novo_member_id
    );

    // 3. Valida dirigente anterior (se houver member_id informado, deve pertencer ao mesmo ministério)
    if (input.dirigente_anterior_member_id) {
      const { data: antMem } = await supabase
        .from('members')
        .select('id')
        .eq('id', input.dirigente_anterior_member_id)
        .eq('ministry_id', user.ministryId)
        .maybeSingle();

      if (!antMem) {
        console.warn('Dirigente anterior não encontrado no ministério; prosseguindo com dados textuais.');
      }
    }

    // 4. Verifica se a congregação destino possui bens cadastrados no patrimônio
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
      titulo: input.titulo || `Substituição de Liderança — ${congDest.nome}`,
      congregacao_destino_id: input.congregacao_destino_id,
      congregacao_origem_id: input.congregacao_origem_id || null,
      dirigente_novo_member_id: ministroElegivel.id,
      dirigente_novo_nome: ministroElegivel.nome,
      dirigente_novo_cargo: input.dirigente_novo_cargo || ministroElegivel.cargo_ministerial || 'Pastor',
      dirigente_novo_cpf: ministroElegivel.cpf || input.dirigente_novo_cpf || null,
      dirigente_novo_matricula: ministroElegivel.matricula || input.dirigente_novo_matricula || null,
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

    if (!input.movimentacao_id) {
      throw new Error('ID da movimentação é obrigatório para efetivação.');
    }

    const dataEfetiva = input.data_efetiva || new Date().toISOString().slice(0, 10);

    // Operação Atômica Transacional Exclusiva via PostgreSQL (RPC)
    // Elimina o risco de gravações parciais ou inconsistências em caso de falha.
    if (!supabase || typeof supabase.rpc !== 'function') {
      throw new Error('Cliente de banco de dados não suporta chamadas RPC atômicas.');
    }

    const { data: rpcRes, error: rpcErr } = await supabase.rpc('efetivar_movimentacao_dirigente', {
      p_ministry_id: user.ministryId,
      p_movimentacao_id: input.movimentacao_id,
      p_user_id: user.userId,
      p_user_name: user.userName,
      p_data_efetiva: dataEfetiva,
      p_divergencias: input.divergencias_patrimoniais || null,
    });

    if (rpcErr) {
      throw new Error(`Falha na efetivação atômica da movimentação: ${rpcErr.message}`);
    }

    if (!rpcRes || !rpcRes.sucesso) {
      throw new Error(rpcRes?.erro || 'A transação atômica de efetivação não retornou confirmação de sucesso.');
    }

    // Carrega os dados atualizados gerados pela transação atômica
    const { data: movAtual, error: movErr } = await supabase
      .from('dirigentes_movimentacoes')
      .select('*')
      .eq('id', input.movimentacao_id)
      .eq('ministry_id', user.ministryId)
      .single();

    if (movErr || !movAtual) {
      throw new Error(`Movimentação efetivada, mas houve erro ao carregar os dados atualizados: ${movErr?.message || 'não encontrada'}`);
    }

    const { data: desigAtual, error: desigErr } = await supabase
      .from('dirigentes_designacoes')
      .select('*')
      .eq('id', rpcRes.nova_designacao_id)
      .eq('ministry_id', user.ministryId)
      .single();

    if (desigErr || !desigAtual) {
      throw new Error(`Movimentação efetivada, mas houve erro ao carregar a designação gerada: ${desigErr?.message || 'não encontrada'}`);
    }

    return {
      movimentacao: movAtual as DirigenteMovimentacao,
      novaDesignacao: desigAtual as DirigenteDesignacao,
    };
  }
}
