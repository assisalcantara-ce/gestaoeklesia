import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isCultoAbertoHoje, getLocalDateStr } from '../src/lib/timezone-utils';

/**
 * Modelos simulados refletindo o schema real do Gestão Eklésia
 */
interface AgendaEventoMock {
  id: string;
  ministry_id: string;
  titulo: string;
  tipo: string;
  data_inicio: string;
  church_id: string | null;
  status: 'confirmado' | 'cancelado';
}

interface CultoRegistroMock {
  id: string;
  ministry_id: string;
  congregacao_id: string;
  data_culto: string;
  horario_culto: string;
  tipo_culto: string;
  dirigente: string;
  status: 'Aberto' | 'Encerrado' | 'Consolidado' | 'Programado' | 'Cancelado';
  visitantes_presentes: number;
  membros_presentes: number;
  almas_alcancadas: number;
  agenda_evento_id: string | null;
  relatorio_espiritual_id: string | null;
  encerrado_em: string | null;
  observacoes?: string | null;
}

interface CultoTokenMock {
  id: string;
  token: string;
  culto_id: string;
  ministry_id: string;
  is_active: boolean;
  expires_at: string;
}

interface CultoVisitanteMock {
  id: string;
  culto_id: string;
  ministry_id: string;
  nome: string;
  telefone: string | null;
}

/**
 * Simulação da rotina de DELETE /api/v1/agenda com sincronização
 */
function simularDeleteAgendaEvento(
  eventoId: string,
  tenantMinistryId: string,
  db: {
    agenda_eventos: AgendaEventoMock[];
    culto_registros: CultoRegistroMock[];
    culto_tokens: CultoTokenMock[];
    culto_visitantes: CultoVisitanteMock[];
  }
) {
  // 1. Localiza evento no tenant
  const eventoIdx = db.agenda_eventos.findIndex(
    e => e.id === eventoId && e.ministry_id === tenantMinistryId
  );
  if (eventoIdx === -1) {
    return { ok: false, status: 404, error: 'Compromisso não encontrado no ministério.' };
  }

  // 2. Busca cultos vinculados do mesmo ministério
  const cultosVinculados = db.culto_registros.filter(
    c => c.agenda_evento_id === eventoId && c.ministry_id === tenantMinistryId
  );

  const cultoIds = cultosVinculados.map(c => c.id);

  // 3. Invalida tokens ativos de acolhimento (QR Code / link de recepção)
  db.culto_tokens.forEach(t => {
    if (cultoIds.includes(t.culto_id) && t.ministry_id === tenantMinistryId) {
      t.is_active = false;
    }
  });

  // 4. Marca como Cancelado os cultos abertos/programados, preservando registros e visitantes
  cultosVinculados.forEach(c => {
    if (c.status === 'Aberto' || c.status === 'Programado') {
      c.status = 'Cancelado';
      c.observacoes = 'Evento cancelado e removido da Agenda Oficial.';
    }
  });

  // 5. Remove o evento da Agenda Oficial
  db.agenda_eventos.splice(eventoIdx, 1);

  // 6. Simula FK ON DELETE SET NULL do Postgres
  cultosVinculados.forEach(c => {
    c.agenda_evento_id = null;
  });

  return { ok: true, status: 200, id: eventoId };
}

/**
 * Simulação da lógica de montagem da lista em /secretaria/cultos (loadRegistros)
 */
function simularLoadRegistrosCultos(
  tenantMinistryId: string,
  db: {
    agenda_eventos: AgendaEventoMock[];
    culto_registros: CultoRegistroMock[];
  },
  dataReferencia: Date = new Date()
) {
  const todayStr = getLocalDateStr(dataReferencia);

  const rawAgenda = db.agenda_eventos.filter(
    e => e.ministry_id === tenantMinistryId && e.status !== 'cancelado' && e.tipo === 'culto'
  );
  const rawRegistros = db.culto_registros.filter(
    r => r.ministry_id === tenantMinistryId
  );

  const registrosPorAgendaId = new Map<string, CultoRegistroMock>();
  rawRegistros.forEach(r => {
    if (r.agenda_evento_id) {
      registrosPorAgendaId.set(r.agenda_evento_id, r);
    }
  });

  const mergedList: CultoRegistroMock[] = [];

  // Processar eventos da Agenda
  for (const ev of rawAgenda) {
    const evDateStr = getLocalDateStr(ev.data_inicio);
    const existingReg = registrosPorAgendaId.get(ev.id);

    if (existingReg) {
      let computedStatus: CultoRegistroMock['status'] = existingReg.status;
      if (existingReg.status === 'Consolidado') {
        computedStatus = 'Consolidado';
      } else if (existingReg.status === 'Encerrado') {
        computedStatus = 'Encerrado';
      } else if (existingReg.status === 'Cancelado') {
        computedStatus = 'Cancelado';
      } else if (evDateStr > todayStr) {
        computedStatus = 'Programado';
      } else {
        computedStatus = 'Aberto';
      }

      mergedList.push({
        ...existingReg,
        status: computedStatus,
      });
    } else {
      let computedStatus: CultoRegistroMock['status'] = 'Aberto';
      if (evDateStr > todayStr) {
        computedStatus = 'Programado';
      }

      mergedList.push({
        id: `agenda-${ev.id}`,
        ministry_id: tenantMinistryId,
        congregacao_id: ev.church_id || 'sede',
        data_culto: evDateStr,
        horario_culto: '19:30',
        tipo_culto: ev.titulo,
        dirigente: 'A definir',
        status: computedStatus,
        visitantes_presentes: 0,
        membros_presentes: 0,
        almas_alcancadas: 0,
        agenda_evento_id: ev.id,
        relatorio_espiritual_id: null,
        encerrado_em: null,
      });
    }
  }

  const idsAgenda = new Set(rawAgenda.map(ev => ev.id));

  // Processar registros órfãos ou legados
  for (const r of rawRegistros) {
    const jaProcessado = r.agenda_evento_id && idsAgenda.has(r.agenda_evento_id);
    if (jaProcessado) continue;

    // Se o culto foi cancelado, nunca entra na lista de cultos disponíveis
    if (r.status === 'Cancelado') continue;

    // Preserva histórico legítimo
    const temHistorico =
      r.status === 'Encerrado' ||
      r.status === 'Consolidado' ||
      (r.visitantes_presentes || 0) > 0 ||
      (r.membros_presentes || 0) > 0 ||
      (r.almas_alcancadas || 0) > 0 ||
      Boolean(r.relatorio_espiritual_id) ||
      Boolean(r.encerrado_em);

    if (!temHistorico) continue;

    mergedList.push(r);
  }

  return mergedList;
}

/**
 * Simulação da validação pública nas APIs /acolhimento/[token]
 */
function simularValidacaoAcolhimentoPublico(
  tokenString: string,
  db: {
    agenda_eventos: AgendaEventoMock[];
    culto_registros: CultoRegistroMock[];
    culto_tokens: CultoTokenMock[];
  },
  dataReferencia: Date = new Date()
): { permitido: boolean; status: number; code?: string; error?: string } {
  const tokenRecord = db.culto_tokens.find(t => t.token === tokenString);
  if (!tokenRecord) {
    return { permitido: false, status: 404, code: 'TOKEN_NAO_ENCONTRADO', error: 'Token não encontrado.' };
  }

  if (!tokenRecord.is_active) {
    return { permitido: false, status: 410, code: 'TOKEN_INATIVO', error: 'Link de acolhimento desativado.' };
  }

  if (new Date(tokenRecord.expires_at) <= dataReferencia) {
    return { permitido: false, status: 410, code: 'TOKEN_EXPIRADO', error: 'Link de acolhimento expirado.' };
  }

  const culto = db.culto_registros.find(c => c.id === tokenRecord.culto_id);
  if (!culto) {
    return { permitido: false, status: 404, code: 'CULTO_NAO_ENCONTRADO', error: 'Culto não encontrado.' };
  }

  if (culto.status === 'Cancelado') {
    return { permitido: false, status: 410, code: 'CULTO_CANCELADO', error: 'Culto cancelado.' };
  }

  // Se não estiver encerrado/consolidado, valida se evento na agenda existe e não foi cancelado
  if (culto.status !== 'Encerrado' && culto.status !== 'Consolidado') {
    if (!culto.agenda_evento_id) {
      tokenRecord.is_active = false;
      return { permitido: false, status: 410, code: 'EVENTO_AGENDA_CANCELADO', error: 'Evento removido da Agenda.' };
    }

    const agendaEv = db.agenda_eventos.find(
      e => e.id === culto.agenda_evento_id && e.ministry_id === tokenRecord.ministry_id
    );

    if (!agendaEv || agendaEv.status === 'cancelado') {
      tokenRecord.is_active = false;
      return { permitido: false, status: 410, code: 'EVENTO_AGENDA_CANCELADO', error: 'Evento cancelado na Agenda.' };
    }
  }

  const validacaoJanela = isCultoAbertoHoje(culto.data_culto, culto.status, dataReferencia);
  if (!validacaoJanela.elegivel) {
    return { permitido: false, status: 410, code: validacaoJanela.motivo, error: 'Janela de acolhimento fechada.' };
  }

  return { permitido: true, status: 200 };
}

describe('Sincronização entre Agenda e Acolhimento — Exclusão, Histórico e QR Code', () => {
  const hoje = '2026-10-12';
  const hojeRef = new Date('2026-10-12T19:30:00-03:00');
  const TENANT_A = '11111111-1111-1111-1111-111111111111';
  const TENANT_B = '22222222-2222-2222-2222-222222222222';

  it('1. Cenário Reproduzido: Excluir evento na Agenda remove culto órfão da listagem e invalida QR Code', () => {
    const db = {
      agenda_eventos: [
        {
          id: 'ev-teste-1',
          ministry_id: TENANT_A,
          titulo: 'CULTO TESTE',
          tipo: 'culto',
          data_inicio: '2026-10-12T19:30:00-03:00',
          church_id: 'cong-1',
          status: 'confirmado' as const,
        },
      ],
      culto_registros: [
        {
          id: 'culto-reg-1',
          ministry_id: TENANT_A,
          congregacao_id: 'cong-1',
          data_culto: hoje,
          horario_culto: '19:30',
          tipo_culto: 'CULTO TESTE',
          dirigente: 'Dirigente Teste',
          status: 'Aberto' as const,
          visitantes_presentes: 0,
          membros_presentes: 0,
          almas_alcancadas: 0,
          agenda_evento_id: 'ev-teste-1',
          relatorio_espiritual_id: null,
          encerrado_em: null,
        },
      ],
      culto_tokens: [
        {
          id: 'tok-1',
          token: 'token-culto-teste',
          culto_id: 'culto-reg-1',
          ministry_id: TENANT_A,
          is_active: true,
          expires_at: '2026-10-13T19:30:00-03:00',
        },
      ],
      culto_visitantes: [],
    };

    // Antes da exclusão: o culto aparece na listagem e o token é válido
    const listaAntes = simularLoadRegistrosCultos(TENANT_A, db, hojeRef);
    assert.equal(listaAntes.length, 1);
    assert.equal(listaAntes[0].id, 'culto-reg-1');
    assert.equal(listaAntes[0].status, 'Aberto');

    const acessoAntes = simularValidacaoAcolhimentoPublico('token-culto-teste', db, hojeRef);
    assert.equal(acessoAntes.permitido, true);
    assert.equal(acessoAntes.status, 200);

    // Executa exclusão do evento na Agenda
    const resDelete = simularDeleteAgendaEvento('ev-teste-1', TENANT_A, db);
    assert.equal(resDelete.ok, true);

    // Verificação 1: O evento sumiu de agenda_eventos
    assert.equal(db.agenda_eventos.length, 0);

    // Verificação 2: O token em culto_tokens foi marcado is_active = false
    const tokenDb = db.culto_tokens.find(t => t.id === 'tok-1');
    assert.equal(tokenDb?.is_active, false);

    // Verificação 3: O culto operacional foi marcado como 'Cancelado'
    const cultoDb = db.culto_registros.find(c => c.id === 'culto-reg-1');
    assert.equal(cultoDb?.status, 'Cancelado');

    // Verificação 4: Na listagem /secretaria/cultos, o culto órfão NÃO APARECE MAIS!
    const listaDepois = simularLoadRegistrosCultos(TENANT_A, db, hojeRef);
    assert.equal(listaDepois.length, 0);

    // Verificação 5: Ao tentar ler o QR Code /acolhimento/[token], retorna 410 TOKEN_INATIVO
    const acessoDepois = simularValidacaoAcolhimentoPublico('token-culto-teste', db, hojeRef);
    assert.equal(acessoDepois.permitido, false);
    assert.equal(acessoDepois.status, 410);
    assert.equal(acessoDepois.code, 'TOKEN_INATIVO');
  });

  it('2. Preservação estrita de histórico e visitantes cadastrados após exclusão do evento', () => {
    const db = {
      agenda_eventos: [
        {
          id: 'ev-realizado',
          ministry_id: TENANT_A,
          titulo: 'Culto de Domingo com Visitantes',
          tipo: 'culto',
          data_inicio: '2026-10-12T19:00:00-03:00',
          church_id: 'cong-1',
          status: 'confirmado' as const,
        },
      ],
      culto_registros: [
        {
          id: 'culto-com-visitantes',
          ministry_id: TENANT_A,
          congregacao_id: 'cong-1',
          data_culto: hoje,
          horario_culto: '19:00',
          tipo_culto: 'Culto de Domingo',
          dirigente: 'Pastor Local',
          status: 'Aberto' as const,
          visitantes_presentes: 3, // Possui 3 visitantes cadastrados
          membros_presentes: 85,
          almas_alcancadas: 2,
          agenda_evento_id: 'ev-realizado',
          relatorio_espiritual_id: null,
          encerrado_em: null,
        },
      ],
      culto_tokens: [
        {
          id: 'tok-2',
          token: 'token-com-visitantes',
          culto_id: 'culto-com-visitantes',
          ministry_id: TENANT_A,
          is_active: true,
          expires_at: '2026-10-13T19:00:00-03:00',
        },
      ],
      culto_visitantes: [
        { id: 'v-1', culto_id: 'culto-com-visitantes', ministry_id: TENANT_A, nome: 'Visitante Um', telefone: '11999990001' },
        { id: 'v-2', culto_id: 'culto-com-visitantes', ministry_id: TENANT_A, nome: 'Visitante Dois', telefone: '11999990002' },
        { id: 'v-3', culto_id: 'culto-com-visitantes', ministry_id: TENANT_A, nome: 'Visitante Tres', telefone: '11999990003' },
      ],
    };

    // Exclui o evento da Agenda
    const resDelete = simularDeleteAgendaEvento('ev-realizado', TENANT_A, db);
    assert.equal(resDelete.ok, true);

    // Verificação: Nenhum registro de culto_visitantes foi deletado!
    assert.equal(db.culto_visitantes.length, 3);
    assert.equal(db.culto_visitantes[0].nome, 'Visitante Um');
    assert.equal(db.culto_visitantes[1].nome, 'Visitante Dois');
    assert.equal(db.culto_visitantes[2].nome, 'Visitante Tres');

    // O registro em culto_registros não foi deletado
    assert.equal(db.culto_registros.length, 1);
    assert.equal(db.culto_registros[0].visitantes_presentes, 3);
    assert.equal(db.culto_registros[0].almas_alcancadas, 2);

    // Tokens foram desativados para bloquear novos cadastros via QR Code
    assert.equal(db.culto_tokens[0].is_active, false);

    // O acesso pelo QR Code é bloqueado
    const acessoBloqueado = simularValidacaoAcolhimentoPublico('token-com-visitantes', db, hojeRef);
    assert.equal(acessoBloqueado.permitido, false);
    assert.equal(acessoBloqueado.status, 410);
  });

  it('3. Auto-cura em rotas de acolhimento para registros órfãos antigos que já tinham token no banco', () => {
    // Simula a situação onde a exclusão da agenda aconteceu no passado antes da desativação do token
    const db = {
      agenda_eventos: [], // Evento da Agenda já foi deletado
      culto_registros: [
        {
          id: 'culto-orfao-antigo',
          ministry_id: TENANT_A,
          congregacao_id: 'cong-1',
          data_culto: hoje,
          horario_culto: '19:30',
          tipo_culto: 'Culto Órfão Antigo',
          dirigente: 'Pastor',
          status: 'Aberto' as const,
          visitantes_presentes: 0,
          membros_presentes: 0,
          almas_alcancadas: 0,
          agenda_evento_id: null, // FK ficou null por ON DELETE SET NULL
          relatorio_espiritual_id: null,
          encerrado_em: null,
        },
      ],
      culto_tokens: [
        {
          id: 'tok-orfao',
          token: 'token-orfao-antigo',
          culto_id: 'culto-orfao-antigo',
          ministry_id: TENANT_A,
          is_active: true, // Estava ativo no banco
          expires_at: '2026-10-13T19:30:00-03:00',
        },
      ],
      culto_visitantes: [],
    };

    // Ao acessar /acolhimento/[token], o backend detecta a ausência de agenda_evento_id e desativa o token
    const resAcesso = simularValidacaoAcolhimentoPublico('token-orfao-antigo', db, hojeRef);
    assert.equal(resAcesso.permitido, false);
    assert.equal(resAcesso.status, 410);
    assert.equal(resAcesso.code, 'EVENTO_AGENDA_CANCELADO');

    // Confirma que o token foi desativado no banco
    assert.equal(db.culto_tokens[0].is_active, false);

    // Na listagem /secretaria/cultos, o registro órfão sem histórico é filtrado e não aparece
    const lista = simularLoadRegistrosCultos(TENANT_A, db, hojeRef);
    assert.equal(lista.length, 0);
  });

  it('4. Isolamento estrito Multi-Tenant: Excluir evento no Ministério A não afeta Ministério B', () => {
    const db = {
      agenda_eventos: [
        {
          id: 'ev-tenant-a',
          ministry_id: TENANT_A,
          titulo: 'Culto Ministério A',
          tipo: 'culto',
          data_inicio: '2026-10-12T19:30:00-03:00',
          church_id: 'cong-a',
          status: 'confirmado' as const,
        },
        {
          id: 'ev-tenant-b',
          ministry_id: TENANT_B,
          titulo: 'Culto Ministério B',
          tipo: 'culto',
          data_inicio: '2026-10-12T19:30:00-03:00',
          church_id: 'cong-b',
          status: 'confirmado' as const,
        },
      ],
      culto_registros: [
        {
          id: 'culto-a',
          ministry_id: TENANT_A,
          congregacao_id: 'cong-a',
          data_culto: hoje,
          horario_culto: '19:30',
          tipo_culto: 'Culto Ministério A',
          dirigente: 'Pr A',
          status: 'Aberto' as const,
          visitantes_presentes: 0,
          membros_presentes: 0,
          almas_alcancadas: 0,
          agenda_evento_id: 'ev-tenant-a',
          relatorio_espiritual_id: null,
          encerrado_em: null,
        },
        {
          id: 'culto-b',
          ministry_id: TENANT_B,
          congregacao_id: 'cong-b',
          data_culto: hoje,
          horario_culto: '19:30',
          tipo_culto: 'Culto Ministério B',
          dirigente: 'Pr B',
          status: 'Aberto' as const,
          visitantes_presentes: 5,
          membros_presentes: 60,
          almas_alcancadas: 1,
          agenda_evento_id: 'ev-tenant-b',
          relatorio_espiritual_id: null,
          encerrado_em: null,
        },
      ],
      culto_tokens: [
        {
          id: 'tok-a',
          token: 'token-tenant-a',
          culto_id: 'culto-a',
          ministry_id: TENANT_A,
          is_active: true,
          expires_at: '2026-10-13T19:30:00-03:00',
        },
        {
          id: 'tok-b',
          token: 'token-tenant-b',
          culto_id: 'culto-b',
          ministry_id: TENANT_B,
          is_active: true,
          expires_at: '2026-10-13T19:30:00-03:00',
        },
      ],
      culto_visitantes: [
        { id: 'v-b1', culto_id: 'culto-b', ministry_id: TENANT_B, nome: 'Visitante B', telefone: '11999998888' },
      ],
    };

    // Usuário do Ministério A tenta excluir evento do Ministério B: BLOQUEADO
    const deleteInvasivo = simularDeleteAgendaEvento('ev-tenant-b', TENANT_A, db);
    assert.equal(deleteInvasivo.ok, false);
    assert.equal(deleteInvasivo.status, 404);
    assert.equal(db.agenda_eventos.length, 2);
    assert.equal(db.culto_tokens.find(t => t.id === 'tok-b')?.is_active, true);

    // Exclusão legítima no Ministério A
    const deleteLegitimo = simularDeleteAgendaEvento('ev-tenant-a', TENANT_A, db);
    assert.equal(deleteLegitimo.ok, true);

    // Ministério A: token invalidado e culto cancelado
    assert.equal(db.culto_tokens.find(t => t.id === 'tok-a')?.is_active, false);
    assert.equal(db.culto_registros.find(c => c.id === 'culto-a')?.status, 'Cancelado');

    // Ministério B: completamente INTACTO e OPERACIONAL
    const tokenB = db.culto_tokens.find(t => t.id === 'tok-b');
    assert.equal(tokenB?.is_active, true);

    const cultoB = db.culto_registros.find(c => c.id === 'culto-b');
    assert.equal(cultoB?.status, 'Aberto');
    assert.equal(cultoB?.visitantes_presentes, 5);

    const listaB = simularLoadRegistrosCultos(TENANT_B, db, hojeRef);
    assert.equal(listaB.length, 1);
    assert.equal(listaB[0].id, 'culto-b');

    const acessoB = simularValidacaoAcolhimentoPublico('token-tenant-b', db, hojeRef);
    assert.equal(acessoB.permitido, true);
    assert.equal(acessoB.status, 200);
  });

  it('5. Cenário Exato da Solicitação: Culto de hoje presente na Agenda sem registro operacional prévio aparece como Aberto e permite acolhimento', () => {
    // Agenda possui o evento de hoje, mas culto_registros ainda não tem registro operacional (item virtual)
    const db = {
      agenda_eventos: [
        {
          id: 'ev-culto-hoje-novo',
          ministry_id: TENANT_A,
          titulo: 'CULTO TESTE',
          tipo: 'culto',
          data_inicio: '2026-10-12T19:30:00-03:00',
          church_id: 'cong-1',
          status: 'confirmado' as const,
        },
      ],
      culto_registros: [], // Sem registro operacional prévio
      culto_tokens: [],
      culto_visitantes: [],
    };

    // Ao carregar a lista de cultos, o item virtual da agenda deve ser incluído
    const lista = simularLoadRegistrosCultos(TENANT_A, db, hojeRef);
    assert.equal(lista.length, 1);

    const cultoVirtual = lista[0];
    assert.equal(cultoVirtual.id, 'agenda-ev-culto-hoje-novo');
    assert.equal(cultoVirtual.tipo_culto, 'CULTO TESTE');
    assert.equal(cultoVirtual.data_culto, '2026-10-12');
    assert.equal(cultoVirtual.status, 'Aberto'); // Status de hoje é 'Aberto'

    // Avaliação de elegibilidade:
    // const isElegivelAcolhimento = isHoje && reg.status === 'Aberto' && !reg.relatorio_espiritual_id && (Boolean(reg.agenda_evento_id) || reg.id.startsWith('agenda-'));
    const isHoje = cultoVirtual.data_culto === hoje;
    const isElegivelAcolhimento = isHoje &&
      cultoVirtual.status === 'Aberto' &&
      !cultoVirtual.relatorio_espiritual_id &&
      (Boolean(cultoVirtual.agenda_evento_id) || cultoVirtual.id.startsWith('agenda-'));

    assert.equal(isElegivelAcolhimento, true, 'Culto de hoje na Agenda deve ser elegível para Recepção, Link, QR Code e Encerrar');
  });

  it('6. Reconhecimento semântico de culto: Título "CULTO TESTE" com tipo "outro" na Agenda é reconhecido como culto', () => {
    const rawAgendaMock = [
      {
        id: 'ev-semantico-1',
        titulo: 'CULTO TESTE',
        tipo: 'outro', // Criado sem categoria específica de tipo
        data_inicio: '2026-10-12T19:30:00-03:00',
        church_id: null,
        status: 'confirmado',
      },
      {
        id: 'ev-administrativo-1',
        titulo: 'Reunião de Prestação de Contas',
        tipo: 'reuniao',
        data_inicio: '2026-10-12T20:00:00-03:00',
        church_id: null,
        status: 'confirmado',
      },
    ];

    // Filtro semântico adotado na página de cultos
    const cultosFiltrados = rawAgendaMock.filter((ev: any) => {
      const tipoNorm = (ev.tipo || '').toLowerCase().trim();
      const titNorm = (ev.titulo || '').toLowerCase().trim();

      if (tipoNorm === 'culto') return true;
      if (titNorm.includes('culto') || titNorm.includes('ceia') || titNorm.includes('vigilia')) {
        return true;
      }
      return false;
    });

    assert.equal(cultosFiltrados.length, 1);
    assert.equal(cultosFiltrados[0].id, 'ev-semantico-1');
    assert.equal(cultosFiltrados[0].titulo, 'CULTO TESTE');
  });

  it('7. Culto de "Todo o Campo" (sem congregação específica) permanece visível mesmo com filtro de congregação selecionado', () => {
    const cultos = [
      {
        id: 'c-geral',
        congregacao_id: '', // Geral / Todo o Campo
        tipo_culto: 'CULTO TESTE',
        data_culto: '2026-10-12',
        status: 'Aberto' as const,
      },
      {
        id: 'c-local-a',
        congregacao_id: 'cong-a',
        tipo_culto: 'Culto de Oração',
        data_culto: '2026-10-12',
        status: 'Aberto' as const,
      },
      {
        id: 'c-local-b',
        congregacao_id: 'cong-b',
        tipo_culto: 'Culto da Família',
        data_culto: '2026-10-12',
        status: 'Aberto' as const,
      },
    ];

    const filtroCongregacao = 'cong-a';

    // Regra atualizada de filtro de congregação
    const filtrados = cultos.filter(r => {
      // Se tiver congregação específica diferente, descarta; se for evento de Todo o Campo (sem congregação específica), mantém
      if (filtroCongregacao && r.congregacao_id && r.congregacao_id !== filtroCongregacao) return false;
      return true;
    });

    assert.equal(filtrados.length, 2);
    assert.ok(filtrados.some(c => c.id === 'c-geral'), 'Evento de Todo o Campo deve estar presente');
    assert.ok(filtrados.some(c => c.id === 'c-local-a'), 'Evento da congregação A deve estar presente');
    assert.ok(!filtrados.some(c => c.id === 'c-local-b'), 'Evento da congregação B deve ser filtrado');
  });

  it('8. Cultos de datas futuras (ex: CULTO DA FAMÍLIA em 14/10/2026) aparecem como Programado e sem ações antecipadas', () => {
    const db = {
      agenda_eventos: [
        {
          id: 'ev-familia-quarta',
          ministry_id: TENANT_A,
          titulo: 'CULTO DA FAMÍLIA',
          tipo: 'culto',
          data_inicio: '2026-10-14T19:30:00-03:00', // Futuro em relação a 12/10
          church_id: 'cong-1',
          status: 'confirmado' as const,
        },
      ],
      culto_registros: [],
      culto_tokens: [],
      culto_visitantes: [],
    };

    const lista = simularLoadRegistrosCultos(TENANT_A, db, hojeRef);
    assert.equal(lista.length, 1);

    const cultoFuturo = lista[0];
    assert.equal(cultoFuturo.tipo_culto, 'CULTO DA FAMÍLIA');
    assert.equal(cultoFuturo.status, 'Programado'); // Deve ser 'Programado'

    const isHoje = cultoFuturo.data_culto === hoje;
    assert.equal(isHoje, false);

    const isFuturo = cultoFuturo.data_culto > hoje;
    assert.equal(isFuturo, true, 'Deve ser identificado como data futura');

    const isElegivelAcolhimento = isHoje && (cultoFuturo.status as string) === 'Aberto';
    assert.equal(isElegivelAcolhimento, false, 'Cultos futuros não devem permitir acolhimento antecipado');
  });
});
