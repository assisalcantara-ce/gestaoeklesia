/**
 * escala-pregadores-service.ts
 *
 * Camada de serviço de backend para o Módulo Secretaria → Escala de Pregadores.
 * Regras Obrigatórias:
 * 1. O módulo NÃO cria nem modifica datas, horários ou locais de eventos da Agenda Oficial.
 * 2. Elegibilidade estrita: ministro ativo de public.members.
 * 3. Atomicidade em substituições, cancelamentos e remanejamentos com histórico permanente.
 * 4. Fuso institucional: America/Belem.
 */

import { SupabaseClient } from '@supabase/supabase-js';

export interface MinistroElegivel {
  id: string;
  name: string;
  matricula: string | null;
  cargo_ministerial: string | null;
  congregacao_id: string | null;
  congregacao_nome?: string | null;
  foto_url: string | null;
  total_escalas_mes: number;
  total_escalas_ano: number;
  ultima_escala_data: string | null;
  dias_desde_ultima_escala: number | null;
  is_menos_escalado: boolean;
}

export interface EscalaPregadorRow {
  id: string;
  ministry_id: string;
  agenda_evento_id: string | null;
  member_id: string;
  status: 'escalado' | 'confirmado' | 'substituido' | 'cancelado';
  evento_titulo_snapshot: string;
  evento_data_inicio_snapshot: string;
  evento_data_fim_snapshot: string | null;
  evento_church_id_snapshot: string | null;
  evento_local_snapshot: string | null;
  motivo_alteracao: string | null;
  substituido_por_member_id: string | null;
  data_alteracao: string | null;
  tema_mensagem: string | null;
  texto_biblico: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
  member?: {
    id: string;
    name: string;
    matricula: string | null;
    cargo_ministerial: string | null;
    foto_url: string | null;
    congregacao_id: string | null;
  };
  substituto?: {
    id: string;
    name: string;
    cargo_ministerial: string | null;
  };
  evento_atual?: {
    id: string;
    titulo: string;
    data_inicio: string;
    data_fim: string | null;
    church_id: string | null;
    local: string | null;
    status: string;
  };
}

export interface ListarEventosComEscalaParams {
  ministryId: string;
  anoMes?: string; // YYYY-MM
  dataInicioIso?: string;
  dataFimIso?: string;
  churchId?: string | null; // null = todo o campo / todas
  filtroTitulo?: string;
  apenasSemPregador?: boolean;
  pagina?: number;
  itensPorPagina?: number;
}

export interface ListarEventosComEscalaResultado {
  eventos: any[];
  total: number;
  pagina: number;
  itensPorPagina: number;
  totalPaginas: number;
}

export class EscalaPregadoresService {
  /**
   * 1. Listar eventos da Agenda Oficial com indicação do pregador escalado
   * Suporta paginação (retorna ListarEventosComEscalaResultado com eventos e contagem total)
   * ou listagem completa quando pagina não é informada (para relatórios e retrocompatibilidade).
   */
  public static async listarEventosComEscala(
    client: SupabaseClient,
    params: ListarEventosComEscalaParams
  ): Promise<any> {
    const {
      ministryId,
      anoMes,
      dataInicioIso,
      dataFimIso,
      churchId,
      filtroTitulo,
      apenasSemPregador,
      pagina,
      itensPorPagina = 10,
    } = params;

    let rangeInicio = dataInicioIso;
    let rangeFim = dataFimIso;

    if (anoMes && (!rangeInicio || !rangeFim)) {
      const [anoStr, mesStr] = anoMes.split('-');
      const ano = parseInt(anoStr, 10);
      const mes = parseInt(mesStr, 10);
      const startOfMonth = new Date(Date.UTC(ano, mes - 1, 1, 0, 0, 0));
      const endOfMonth = new Date(Date.UTC(ano, mes, 0, 23, 59, 59, 999));
      rangeInicio = startOfMonth.toISOString();
      rangeFim = endOfMonth.toISOString();
    }

    // Busca eventos na agenda_eventos (sem embutir congregacoes diretamente para evitar falha no schema cache do PostgREST)
    // Se paginação for solicitada e NÃO houver filtro apenasSemPregador, podemos contar e paginar direto via range do PostgREST
    const paginacaoDiretaNoBanco = Boolean(pagina && pagina > 0 && !apenasSemPregador);

    let queryEventos = client
      .from('agenda_eventos')
      .select(
        `
        id,
        ministry_id,
        church_id,
        titulo,
        descricao,
        tipo,
        data_inicio,
        data_fim,
        local,
        status,
        visibilidade,
        agenda_tipos ( id, nome, categoria, cor )
      `,
        { count: 'exact' }
      )
      .eq('ministry_id', ministryId)
      .neq('status', 'cancelado')
      .order('data_inicio', { ascending: true })
      .order('id', { ascending: true }); // Ordenação determinística e estável

    if (rangeInicio) {
      queryEventos = queryEventos.gte('data_inicio', rangeInicio);
    }
    if (rangeFim) {
      queryEventos = queryEventos.lte('data_inicio', rangeFim);
    }
    if (churchId) {
      queryEventos = queryEventos.eq('church_id', churchId);
    }
    if (filtroTitulo && filtroTitulo.trim()) {
      queryEventos = queryEventos.ilike('titulo', `%${filtroTitulo.trim()}%`);
    }

    if (paginacaoDiretaNoBanco) {
      const from = (pagina! - 1) * itensPorPagina;
      const to = from + itensPorPagina - 1;
      queryEventos = queryEventos.range(from, to);
    }

    const { data: eventos, count, error: errEventos } = await queryEventos;
    if (errEventos) throw errEventos;

    if (!eventos || eventos.length === 0) {
      if (pagina && pagina > 0) {
        return {
          eventos: [],
          total: 0,
          pagina,
          itensPorPagina,
          totalPaginas: 0,
        };
      }
      return [];
    }

    const eventoIds = eventos.map((e) => e.id);

    // Busca congregações do ministério para mapear igreja/congregação aos eventos de forma desacoplada do PostgREST
    const { data: congregacoesData } = await client
      .from('congregacoes')
      .select('id, nome, is_sede')
      .eq('ministry_id', ministryId);

    const mapaCongregacoes = new Map<string, { id: string; nome: string; is_sede?: boolean }>();
    (congregacoesData || []).forEach((c: any) => {
      mapaCongregacoes.set(c.id, {
        id: c.id,
        nome: c.nome,
        is_sede: c.is_sede,
      });
    });

    // Busca escalas ativas para os eventos carregados
    const { data: escalas, error: errEscalas } = await client
      .from('agenda_escala_pregadores')
      .select(`
        *,
        member:members!member_id ( id, name, matricula, cargo_ministerial, foto_url, congregacao_id )
      `)
      .eq('ministry_id', ministryId)
      .in('agenda_evento_id', eventoIds)
      .in('status', ['escalado', 'confirmado']);

    if (errEscalas) throw errEscalas;

    const mapaEscalaPorEvento = new Map<string, any>();
    (escalas || []).forEach((esc) => {
      if (esc.agenda_evento_id) {
        mapaEscalaPorEvento.set(esc.agenda_evento_id, esc);
      }
    });

    let resultado = eventos.map((evt) => {
      const escalaAtiva = mapaEscalaPorEvento.get(evt.id) || null;
      const cong = evt.church_id ? mapaCongregacoes.get(evt.church_id) || null : null;
      return {
        ...evt,
        congregacoes: cong,
        escala: escalaAtiva,
        escala_ativa: escalaAtiva,
        possui_pregador: !!escalaAtiva,
      };
    });

    if (apenasSemPregador) {
      resultado = resultado.filter((item) => !item.possui_pregador);
    }

    // Se a paginação foi direta no banco (sem filtro apenasSemPregador)
    if (paginacaoDiretaNoBanco) {
      const totalRegistros = typeof count === 'number' ? count : resultado.length;
      return {
        eventos: resultado,
        total: totalRegistros,
        pagina: pagina!,
        itensPorPagina,
        totalPaginas: Math.ceil(totalRegistros / itensPorPagina),
      };
    }

    // Se paginação foi solicitada com filtro apenasSemPregador
    if (pagina && pagina > 0) {
      const totalRegistros = resultado.length;
      const from = (pagina - 1) * itensPorPagina;
      const eventosPaginados = resultado.slice(from, from + itensPorPagina);
      return {
        eventos: eventosPaginados,
        total: totalRegistros,
        pagina,
        itensPorPagina,
        totalPaginas: Math.ceil(totalRegistros / itensPorPagina),
      };
    }

    return resultado;
  }

  /**
   * 2. Buscar dinamicamente ministros ativos com estatísticas de rodízio e filtro de conflitos de horário
   */
  public static async listarMinistrosComRodizio(
    client: SupabaseClient,
    ministryId: string,
    termoOuOpcoes?: string | {
      busca?: string;
      dataInicioIso?: string;
      dataFimIso?: string;
      ignorarEscalaId?: string;
      agendaEventoId?: string;
    }
  ): Promise<MinistroElegivel[]> {
    let termoBusca: string | undefined;
    let dataInicioIso: string | undefined;
    let dataFimIso: string | undefined;
    let ignorarEscalaId: string | undefined;
    let agendaEventoId: string | undefined;

    if (typeof termoOuOpcoes === 'string') {
      termoBusca = termoOuOpcoes;
    } else if (termoOuOpcoes && typeof termoOuOpcoes === 'object') {
      termoBusca = termoOuOpcoes.busca;
      dataInicioIso = termoOuOpcoes.dataInicioIso;
      dataFimIso = termoOuOpcoes.dataFimIso;
      ignorarEscalaId = termoOuOpcoes.ignorarEscalaId;
      agendaEventoId = termoOuOpcoes.agendaEventoId;
    }

    // Se temos um agendaEventoId e faltam as datas, busca na agenda_eventos
    if (agendaEventoId && (!dataInicioIso || !dataFimIso)) {
      const { data: evtRef } = await client
        .from('agenda_eventos')
        .select('data_inicio, data_fim')
        .eq('id', agendaEventoId)
        .eq('ministry_id', ministryId)
        .single();

      if (evtRef) {
        dataInicioIso = dataInicioIso || evtRef.data_inicio;
        dataFimIso = dataFimIso || evtRef.data_fim || (new Date(new Date(evtRef.data_inicio).getTime() + 2 * 3600 * 1000).toISOString());
      }
    }

    // Se temos dataInicioIso sem dataFimIso, calcula padrão de 2 horas
    if (dataInicioIso && !dataFimIso) {
      dataFimIso = new Date(new Date(dataInicioIso).getTime() + 2 * 3600 * 1000).toISOString();
    }

    // Busca ministros ativos
    let queryMembros = client
      .from('members')
      .select(`
        id,
        name,
        matricula,
        cargo_ministerial,
        congregacao_id,
        foto_url,
        status,
        role,
        tipo_cadastro,
        congregacoes ( id, nome )
      `)
      .eq('ministry_id', ministryId)
      .or('status.eq.active,status.eq.ativo')
      .or('role.eq.ministro,tipo_cadastro.eq.ministro')
      .order('name', { ascending: true });

    if (termoBusca && termoBusca.trim()) {
      const termo = termoBusca.trim();
      queryMembros = queryMembros.or(`name.ilike.%${termo}%,cargo_ministerial.ilike.%${termo}%,matricula.ilike.%${termo}%`);
    }

    const { data: ministros, error: errMembros } = await queryMembros;
    if (errMembros) throw errMembros;
    if (!ministros || ministros.length === 0) return [];

    let ministroIds = ministros.map((m) => m.id);

    // FILTRO DE CONFLITO DE HORÁRIO: se informado o intervalo do culto/evento
    if (dataInicioIso && dataFimIso) {
      // Busca todas as escalas ativas que possam colidir com este horário
      // Considera escalas ativas ('escalado', 'confirmado') em que o evento não esteja cancelado
      let queryConflitos = client
        .from('agenda_escala_pregadores')
        .select(`
          id,
          member_id,
          agenda_evento_id,
          evento_data_inicio_snapshot,
          evento_data_fim_snapshot,
          status,
          agenda_eventos ( id, data_inicio, data_fim, status )
        `)
        .eq('ministry_id', ministryId)
        .in('member_id', ministroIds)
        .in('status', ['escalado', 'confirmado']);

      if (ignorarEscalaId) {
        queryConflitos = queryConflitos.neq('id', ignorarEscalaId);
      }

      const { data: escalasConflitantes, error: errConflitos } = await queryConflitos;
      if (!errConflitos && escalasConflitantes) {
        const ministrosComConflito = new Set<string>();
        const targetInicioMs = new Date(dataInicioIso).getTime();
        const targetFimMs = new Date(dataFimIso).getTime();

        escalasConflitantes.forEach((esc: any) => {
          // Se pertencer ao próprio evento que estamos editando/atribuindo, não bloqueia o próprio
          if (agendaEventoId && esc.agenda_evento_id === agendaEventoId) {
            return;
          }

          // Se o evento da agenda foi cancelado, ignora
          if (esc.agenda_eventos && esc.agenda_eventos.status === 'cancelado') {
            return;
          }

          // Horários atuais da Agenda Oficial ou fallback para snapshot
          const evInicio = esc.agenda_eventos?.data_inicio || esc.evento_data_inicio_snapshot;
          if (!evInicio) return;
          const evInicioMs = new Date(evInicio).getTime();
          const evFim = esc.agenda_eventos?.data_fim || esc.evento_data_fim_snapshot || new Date(evInicioMs + 2 * 3600 * 1000).toISOString();
          const evFimMs = new Date(evFim).getTime();

          // Verificação de sobreposição de intervalos: (InicioA < FimB) E (FimA > InicioB)
          if (evInicioMs < targetFimMs && evFimMs > targetInicioMs) {
            ministrosComConflito.add(esc.member_id);
          }
        });

        if (ministrosComConflito.size > 0) {
          // Filtra a lista de ministros removendo os indisponíveis por conflito
          const ministrosDisponiveis = ministros.filter((m) => !ministrosComConflito.has(m.id));
          if (ministrosDisponiveis.length === 0) return [];
          ministros.length = 0;
          ministros.push(...ministrosDisponiveis);
          ministroIds = ministros.map((m) => m.id);
        }
      }
    }

    // Estatísticas de rodízio: escalas ativas ou confirmadas
    const agora = new Date();
    const anoAtual = agora.getUTCFullYear();
    const mesAtual = agora.getUTCMonth();
    const inicioAno = new Date(Date.UTC(anoAtual, 0, 1)).toISOString();
    const inicioMes = new Date(Date.UTC(anoAtual, mesAtual, 1)).toISOString();

    const { data: escalasHist, error: errHist } = await client
      .from('agenda_escala_pregadores')
      .select('member_id, evento_data_inicio_snapshot, status')
      .eq('ministry_id', ministryId)
      .in('member_id', ministroIds)
      .in('status', ['escalado', 'confirmado'])
      .order('evento_data_inicio_snapshot', { ascending: false });

    if (errHist) throw errHist;

    const statsMap = new Map<string, { totalMes: number; totalAno: number; ultimaData: string | null }>();

    (escalasHist || []).forEach((esc) => {
      const cur = statsMap.get(esc.member_id) || { totalMes: 0, totalAno: 0, ultimaData: null };
      const d = esc.evento_data_inicio_snapshot;

      if (!cur.ultimaData || new Date(d).getTime() > new Date(cur.ultimaData).getTime()) {
        cur.ultimaData = d;
      }

      if (d >= inicioAno) {
        cur.totalAno++;
      }
      if (d >= inicioMes) {
        cur.totalMes++;
      }

      statsMap.set(esc.member_id, cur);
    });

    const hojeMs = Date.now();

    const listaComEstatisticas = ministros.map((m: any) => {
      const st = statsMap.get(m.id) || { totalMes: 0, totalAno: 0, ultimaData: null };
      let diasDesdeUltima: number | null = null;

      if (st.ultimaData) {
        const diffMs = hojeMs - new Date(st.ultimaData).getTime();
        diasDesdeUltima = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
      }

      return {
        id: m.id,
        name: m.name,
        matricula: m.matricula,
        cargo_ministerial: m.cargo_ministerial || 'Ministro',
        congregacao_id: m.congregacao_id,
        congregacao_nome: m.congregacoes?.nome || null,
        foto_url: m.foto_url,
        total_escalas_mes: st.totalMes,
        total_escalas_ano: st.totalAno,
        ultima_escala_data: st.ultimaData,
        dias_desde_ultima_escala: diasDesdeUltima,
        is_menos_escalado: false, // calculado a seguir
      };
    });

    // Calcula os "menos escalados" (critério: totalMes === 0 ou no quartil inferior do ano)
    const minEscalasMes = listaComEstatisticas.length > 0
      ? Math.min(...listaComEstatisticas.map((m) => m.total_escalas_mes))
      : 0;

    listaComEstatisticas.forEach((m) => {
      m.is_menos_escalado = m.total_escalas_mes === minEscalasMes;
    });

    return listaComEstatisticas;
  }

  /**
   * 3. Atribuir ministro a um evento/ocorrência existente
   */
  public static async atribuirPregador(
    client: SupabaseClient,
    params: {
      ministryId: string;
      agendaEventoId: string;
      memberId: string;
      status?: 'escalado' | 'confirmado';
      temaMensagem?: string | null;
      textoBiblico?: string | null;
      observacoes?: string | null;
      userId?: string | null;
    }
  ) {
    const { ministryId, agendaEventoId, memberId, status = 'escalado', temaMensagem, textoBiblico, observacoes, userId } = params;

    // A migration possui trigger fn_validar_escala_pregadores que preenche snapshots e valida conflitos
    const { data, error } = await client
      .from('agenda_escala_pregadores')
      .insert([
        {
          ministry_id: ministryId,
          agenda_evento_id: agendaEventoId,
          member_id: memberId,
          status,
          tema_mensagem: temaMensagem ? temaMensagem.trim() : null,
          texto_biblico: textoBiblico ? textoBiblico.trim() : null,
          observacoes: observacoes ? observacoes.trim() : null,
          created_by: userId || null,
        },
      ])
      .select(`
        *,
        member:members!member_id ( id, name, matricula, cargo_ministerial, foto_url )
      `)
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * 4. Editar escala (substituir pregador ou atualizar anotações homiléticas)
   */
  public static async editarEscala(
    client: SupabaseClient,
    params: {
      escalaId: string;
      ministryId: string;
      novoMemberId?: string;
      motivoSubstituicao?: string;
      status?: 'escalado' | 'confirmado';
      temaMensagem?: string | null;
      textoBiblico?: string | null;
      observacoes?: string | null;
      userId?: string | null;
    }
  ) {
    const { escalaId, ministryId, novoMemberId, motivoSubstituicao, status, temaMensagem, textoBiblico, observacoes, userId } = params;

    // Busca escala atual
    const { data: escalaAtual, error: errAtual } = await client
      .from('agenda_escala_pregadores')
      .select('*')
      .eq('id', escalaId)
      .eq('ministry_id', ministryId)
      .single();

    if (errAtual || !escalaAtual) {
      throw new Error('Escala de pregador não encontrada.');
    }

    // Se houve mudança de ministro -> Operação atômica de Substituição com Histórico via RPC
    if (novoMemberId && novoMemberId !== escalaAtual.member_id) {
      if (!motivoSubstituicao || !motivoSubstituicao.trim()) {
        throw new Error('É obrigatório informar o motivo da substituição do pregador.');
      }

      // Executa a transação atômica única no PostgreSQL via RPC (se disponível)
      let rpcResult: any = null;
      let errRpc: any = null;

      if (typeof (client as any).rpc === 'function') {
        const resRpc = await (client as any).rpc('substituir_escala_pregador_rpc', {
          p_escala_id: escalaId,
          p_ministry_id: ministryId,
          p_novo_member_id: novoMemberId,
          p_motivo_substituicao: motivoSubstituicao.trim(),
          p_status: status || 'escalado',
          p_tema_mensagem: temaMensagem !== undefined ? (temaMensagem ? temaMensagem.trim() : null) : escalaAtual.tema_mensagem,
          p_texto_biblico: textoBiblico !== undefined ? (textoBiblico ? textoBiblico.trim() : null) : escalaAtual.texto_biblico,
          p_observacoes: observacoes !== undefined ? (observacoes ? observacoes.trim() : null) : escalaAtual.observacoes,
          p_user_id: userId || null,
        });
        rpcResult = resRpc.data;
        errRpc = resRpc.error;
      } else {
        errRpc = { code: '42883', message: 'client.rpc is not defined' };
      }

      if (errRpc) {
        // Fallback resiliente caso a RPC não esteja carregada no ambiente de mock
        if (errRpc.code === '42883' || errRpc.message?.includes('function public.substituir_escala_pregador_rpc') || !client.rpc) {
          const { error: errSubst } = await client
            .from('agenda_escala_pregadores')
            .update({
              status: 'substituido',
              motivo_alteracao: motivoSubstituicao.trim(),
              substituido_por_member_id: novoMemberId,
              data_alteracao: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', escalaId)
            .eq('ministry_id', ministryId);

          if (errSubst) throw errSubst;

          const { data: novaEscala, error: errNova } = await client
            .from('agenda_escala_pregadores')
            .insert([
              {
                ministry_id: ministryId,
                agenda_evento_id: escalaAtual.agenda_evento_id,
                member_id: novoMemberId,
                status: status || 'escalado',
                tema_mensagem: temaMensagem !== undefined ? (temaMensagem ? temaMensagem.trim() : null) : escalaAtual.tema_mensagem,
                texto_biblico: textoBiblico !== undefined ? (textoBiblico ? textoBiblico.trim() : null) : escalaAtual.texto_biblico,
                observacoes: observacoes !== undefined ? (observacoes ? observacoes.trim() : null) : escalaAtual.observacoes,
                created_by: userId || null,
              },
            ])
            .select(`
              *,
              member:members!member_id ( id, name, matricula, cargo_ministerial, foto_url )
            `)
            .single();

          if (errNova) throw errNova;
          return novaEscala;
        }

        throw errRpc;
      }

      // Retorna a nova escala criada com os dados do membro
      const { data: escalaCompleta } = await client
        .from('agenda_escala_pregadores')
        .select(`
          *,
          member:members!member_id ( id, name, matricula, cargo_ministerial, foto_url )
        `)
        .eq('id', (rpcResult as any)?.id)
        .single();

      return escalaCompleta || rpcResult;
    }

    // Edição simples de dados (tema, status, observações) sem trocar de ministro
    const updates: any = {
      updated_at: new Date().toISOString(),
    };
    if (status) updates.status = status;
    if (temaMensagem !== undefined) updates.tema_mensagem = temaMensagem ? temaMensagem.trim() : null;
    if (textoBiblico !== undefined) updates.texto_biblico = textoBiblico ? textoBiblico.trim() : null;
    if (observacoes !== undefined) updates.observacoes = observacoes ? observacoes.trim() : null;

    const { data: atualizada, error: errUpdate } = await client
      .from('agenda_escala_pregadores')
      .update(updates)
      .eq('id', escalaId)
      .eq('ministry_id', ministryId)
      .select(`
        *,
        member:members!member_id ( id, name, matricula, cargo_ministerial, foto_url )
      `)
      .single();

    if (errUpdate) throw errUpdate;
    return atualizada;
  }

  /**
   * 5. Desfazer escala (cancelamento de atribuição, deixando o evento livre)
   */
  public static async desfazerEscala(
    client: SupabaseClient,
    params: {
      escalaId: string;
      ministryId: string;
      motivoCancelamento: string;
    }
  ) {
    const { escalaId, ministryId, motivoCancelamento } = params;

    if (!motivoCancelamento || !motivoCancelamento.trim()) {
      throw new Error('Informe o motivo do cancelamento da escala.');
    }

    const { data, error } = await client
      .from('agenda_escala_pregadores')
      .update({
        status: 'cancelado',
        motivo_alteracao: motivoCancelamento.trim(),
        data_alteracao: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', escalaId)
      .eq('ministry_id', ministryId)
      .select('*')
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * 6. Remanejar pregador para outro evento já existente
   */
  public static async remanejarPregador(
    client: SupabaseClient,
    params: {
      escalaOrigemId: string;
      novoAgendaEventoId: string;
      ministryId: string;
      motivoRemanejamento: string;
      userId?: string | null;
    }
  ) {
    const { escalaOrigemId, novoAgendaEventoId, ministryId, motivoRemanejamento, userId } = params;

    if (!motivoRemanejamento || !motivoRemanejamento.trim()) {
      throw new Error('Informe o motivo do remanejamento do ministro.');
    }

    // Executa o remanejamento atômico nativo no PostgreSQL via RPC (se disponível)
    let rpcResult: any = null;
    let errRpc: any = null;

    if (typeof (client as any).rpc === 'function') {
      const resRpc = await (client as any).rpc('remanejar_escala_pregador_rpc', {
        p_escala_origem_id: escalaOrigemId,
        p_novo_agenda_evento_id: novoAgendaEventoId,
        p_ministry_id: ministryId,
        p_motivo_remanejamento: motivoRemanejamento.trim(),
        p_user_id: userId || null,
      });
      rpcResult = resRpc.data;
      errRpc = resRpc.error;
    } else {
      errRpc = { code: '42883', message: 'client.rpc is not defined' };
    }

    if (errRpc) {
      // Fallback resiliente caso a RPC não esteja carregada no ambiente de mock
      if (errRpc.code === '42883' || errRpc.message?.includes('function public.remanejar_escala_pregador_rpc') || !client.rpc) {
        // 1. Busca escala de origem
        const { data: origem, error: errOrigem } = await client
          .from('agenda_escala_pregadores')
          .select('*')
          .eq('id', escalaOrigemId)
          .eq('ministry_id', ministryId)
          .single();

        if (errOrigem || !origem) {
          throw new Error('Escala de origem não encontrada.');
        }

        // 2. Cancela a escala anterior com registro de motivo de remanejamento
        const { error: errCancelaOrigem } = await client
          .from('agenda_escala_pregadores')
          .update({
            status: 'cancelado',
            motivo_alteracao: `Remanejado: ${motivoRemanejamento.trim()}`,
            data_alteracao: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', escalaOrigemId)
          .eq('ministry_id', ministryId);

        if (errCancelaOrigem) throw errCancelaOrigem;

        // 3. Cria a nova escala no novo evento da agenda
        const { data: novaEscala, error: errNova } = await client
          .from('agenda_escala_pregadores')
          .insert([
            {
              ministry_id: ministryId,
              agenda_evento_id: novoAgendaEventoId,
              member_id: origem.member_id,
              status: 'escalado',
              tema_mensagem: origem.tema_mensagem,
              texto_biblico: origem.texto_biblico,
              observacoes: origem.observacoes,
              created_by: userId || null,
            },
          ])
          .select(`
            *,
            member:members!member_id ( id, name, matricula, cargo_ministerial, foto_url )
          `)
          .single();

        if (errNova) {
          // Reverte cancelamento da origem em caso de erro na nova
          await client
            .from('agenda_escala_pregadores')
            .update({
              status: origem.status,
              motivo_alteracao: origem.motivo_alteracao,
              data_alteracao: origem.data_alteracao,
            })
            .eq('id', escalaOrigemId);

          throw errNova;
        }

        return novaEscala;
      }

      throw errRpc;
    }

    // Retorna a nova escala criada com dados completos do ministro
    const { data: escalaCompleta } = await client
      .from('agenda_escala_pregadores')
      .select(`
        *,
        member:members!member_id ( id, name, matricula, cargo_ministerial, foto_url )
      `)
      .eq('id', (rpcResult as any)?.id)
      .single();

    return escalaCompleta || rpcResult;
  }

  /**
   * 7. Consultar histórico de atribuições, substituições e cancelamentos
   */
  public static async consultarHistorico(
    client: SupabaseClient,
    params: {
      ministryId: string;
      agendaEventoId?: string;
      memberId?: string;
      limite?: number;
    }
  ): Promise<EscalaPregadorRow[]> {
    const { ministryId, agendaEventoId, memberId, limite = 50 } = params;

    let query = client
      .from('agenda_escala_pregadores')
      .select(`
        *,
        member:members!member_id ( id, name, matricula, cargo_ministerial, foto_url, congregacao_id ),
        substituto:members!substituido_por_member_id ( id, name, cargo_ministerial ),
        evento_atual:agenda_eventos!agenda_evento_id ( id, titulo, data_inicio, data_fim, church_id, local, status )
      `)
      .eq('ministry_id', ministryId)
      .order('created_at', { ascending: false })
      .limit(limite);

    if (agendaEventoId) {
      query = query.eq('agenda_evento_id', agendaEventoId);
    }
    if (memberId) {
      query = query.eq('member_id', memberId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as EscalaPregadorRow[];
  }
}
