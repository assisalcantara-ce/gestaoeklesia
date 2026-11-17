import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  HistoricoMinisterialService,
  EventoHistoricoMinisterial,
} from '../src/services/historico-ministerial-service';

describe('Histórico Ministerial Unificado — Agregação e Linha do Tempo', () => {
  const service = new HistoricoMinisterialService();

  // Mock de dados operacionais do caso Danico José Santiago Dias
  const mockMemberDanico = {
    id: 'danico-uuid-001',
    name: 'Danico José Santiago Dias',
    matricula: 'MIN-00982',
    cpf: '12345678901',
    cargo_ministerial: 'Evangelista',
    data_consagracao: null,
    data_batismo_aguas: '2015-05-20',
    data_batismo_espirito_santo: '2016-08-14',
    data_emissao: '2026-01-10',
    data_validade_credencial: '2028-01-10',
    member_since: '2015-01-15',
    status: 'active',
    foto_url: null,
    congregacao_id: 'cong-central',
    congregacoes: { id: 'cong-central', nome: 'Templo Central' },
    dados_cargos: null,
    custom_fields: {},
    created_at: '2020-01-10T10:00:00Z',
  };

  function createMockSupabase(overrides: Record<string, any[]> = {}) {
    return {
      from: (tabela: string) => {
        const queryObj: any = {
          select: () => queryObj,
          eq: () => queryObj,
          order: () => queryObj,
          maybeSingle: async () => {
            if (tabela === 'members') return { data: mockMemberDanico, error: null };
            return { data: null, error: null };
          },
          single: async () => {
            if (tabela === 'members') return { data: mockMemberDanico, error: null };
            return { data: null, error: null };
          },
          then: (resolve: any) => {
            if (tabela === 'members') {
              resolve({ data: mockMemberDanico, error: null });
            } else if (overrides[tabela]) {
              resolve({ data: overrides[tabela], error: null });
            } else {
              resolve({ data: [], error: null });
            }
          },
        };
        return queryObj;
      },
    };
  }

  it('deve extrair e normalizar datas no formato comparável ISO YYYY-MM-DD', () => {
    const extrair = (service as any).extrairDataIso.bind(service);
    assert.equal(extrair('2026-11-14T19:00:00Z'), '2026-11-14');
    assert.equal(extrair('2026-11-14'), '2026-11-14');
    assert.equal(extrair('14/11/2026'), '2026-11-14');
  });

  it('caso Danico: deve consolidar eventos de reuniões, credencial e batismos mesmo sem processo de consagração', async () => {
    const mockSupabase = createMockSupabase({
      reunioes_participantes: [
        {
          id: 'part-001',
          reuniao_id: 'reuniao-14-11',
          status_presenca: 'falta',
          created_at: '2026-11-01T10:00:00Z',
          reuniao: {
            id: 'reuniao-14-11',
            titulo: 'Reunião Ministerial Geral',
            data_reuniao: '2026-11-14',
            horario_inicio: '19:00',
            status: 'encerrada',
          },
        },
      ],
      reunioes_faltas: [
        {
          id: 'falta-001',
          reuniao_id: 'reuniao-14-11',
          data_geracao_falta: '2026-11-14T20:00:00Z',
          situacao: 'registrada',
          motivo_abono: null,
          reuniao: {
            id: 'reuniao-14-11',
            titulo: 'Reunião Ministerial Geral',
            data_reuniao: '2026-11-14',
          },
          justificativa: null,
        },
      ],
    });

    const resultado = await service.obterHistoricoCompleto(
      'danico-uuid-001',
      'ministry-central',
      mockSupabase as any
    );

    // Validação de que não está mais vazio
    assert.ok(resultado.eventos.length > 0, 'O histórico de Danico não deve ser vazio');
    assert.equal(resultado.contadores.todos, resultado.eventos.length);

    // Validação da falta registrada na reunião de 14/11/2026
    const eventoFalta = resultado.eventos.find((e) => e.tipo_evento === 'falta_registrada');
    assert.ok(eventoFalta, 'Deve conter a falta registrada na reunião de 14/11/2026');
    assert.equal(eventoFalta?.data, '2026-11-14');
    assert.match(eventoFalta?.reuniao_titulo || '', /Reunião Ministerial Geral/);
    assert.equal(eventoFalta?.categoria, 'frequencia');

    // Validação da credencial emitida
    const eventoCredencial = resultado.eventos.find((e) => e.categoria === 'credencial');
    assert.ok(eventoCredencial, 'Deve conter a emissão da credencial');
    assert.equal(eventoCredencial?.data, '2026-01-10');

    // Validação de marcos espirituais
    const eventoBatismo = resultado.eventos.find((e) => e.tipo_evento === 'batismo_aguas');
    assert.ok(eventoBatismo, 'Deve conter o batismo nas águas');
    assert.equal(eventoBatismo?.data, '2015-05-20');
  });

  it('deve ordenar eventos em ordem cronológica estritamente decrescente', () => {
    const eventos: EventoHistoricoMinisterial[] = [
      {
        id: '1',
        origem: 'reuniao',
        categoria: 'frequencia',
        tipo_evento: 'presenca_reuniao',
        data: '2026-11-14',
        titulo: 'Reunião de Novembro',
        descricao: '',
        badge: { label: '', bg: '', dot: '', icon: '' },
      },
      {
        id: '2',
        origem: 'credencial',
        categoria: 'credencial',
        tipo_evento: 'emissao_credencial',
        data: '2026-01-10',
        titulo: 'Credencial Emitida',
        descricao: '',
        badge: { label: '', bg: '', dot: '', icon: '' },
      },
      {
        id: '3',
        origem: 'consagracao',
        categoria: 'consagracao',
        tipo_evento: 'homologacao',
        data: '2026-06-15',
        titulo: 'Homologação',
        descricao: '',
        badge: { label: '', bg: '', dot: '', icon: '' },
      },
      {
        id: '4',
        origem: 'espiritual',
        categoria: 'espiritual',
        tipo_evento: 'admissao_membro',
        data: '2015-01-15',
        titulo: 'Admissão',
        descricao: '',
        badge: { label: '', bg: '', dot: '', icon: '' },
      },
    ];

    const ordenados = [...eventos].sort((a, b) => b.data.localeCompare(a.data));
    assert.equal(ordenados[0].id, '1'); // 2026-11-14
    assert.equal(ordenados[1].id, '3'); // 2026-06-15
    assert.equal(ordenados[2].id, '2'); // 2026-01-10
    assert.equal(ordenados[3].id, '4'); // 2015-01-15
  });

  it('deve tratar a situação da falta (abonada, justificada e registrada) com rastreabilidade histórica e eventos distintos', async () => {
    const mockSupabaseAbonada = createMockSupabase({
      reunioes_participantes: [
        {
          id: 'part-01',
          reuniao_id: 'reuniao-01',
          status_presenca: 'falta',
          created_at: '2026-10-01T10:00:00Z',
          reuniao: {
            id: 'reuniao-01',
            titulo: 'Reunião de Outubro',
            data_reuniao: '2026-10-10',
            horario_inicio: '19:00',
          },
        },
      ],
      reunioes_faltas: [
        {
          id: 'falta-abonada-01',
          reuniao_id: 'reuniao-01',
          data_geracao_falta: '2026-10-10T20:00:00Z',
          situacao: 'abonada',
          motivo_abono: 'Em missão oficial da igreja',
          abonada_em: '2026-10-12T14:30:00Z',
          reuniao: { id: 'reuniao-01', titulo: 'Reunião de Outubro', data_reuniao: '2026-10-10' },
          justificativa: {
            id: 'just-01',
            tipo_justificativa: 'viagem',
            motivo: 'Viagem pastoral de missão',
            registrado_em: '2026-10-11T09:00:00Z',
          },
        },
      ],
      reunioes_advertencias: [
        {
          id: 'adv-01',
          falta_id: 'falta-abonada-01',
          reuniao_id: 'reuniao-01',
          numero_protocolo: 'ADV-2026/0001-MIN',
          status_envio: 'gerada',
          created_at: '2026-10-10T21:00:00Z',
        },
      ],
    });

    const res = await service.obterHistoricoCompleto('danico-uuid-001', 'm-01', mockSupabaseAbonada as any);

    // 1. Convocação oficial gerada
    const evConvocacao = res.eventos.find((e) => e.tipo_evento === 'convocacao_reuniao');
    assert.ok(evConvocacao, 'Deve conter a convocação oficial da reunião');

    // 2. Falta registrada mantendo a rastreabilidade
    const evFalta = res.eventos.find((e) => e.tipo_evento === 'falta_registrada');
    assert.ok(evFalta, 'Deve manter o evento de falta registrada original');
    assert.equal(evFalta?.situacao_falta, 'abonada');

    // 3. Justificativa apresentada
    const evJust = res.eventos.find((e) => e.tipo_evento === 'justificativa_apresentada');
    assert.ok(evJust, 'Deve conter o evento de justificativa apresentada');
    assert.equal(evJust?.motivo_justificativa, 'Viagem pastoral de missão');

    // 4. Abono concedido
    const evAbono = res.eventos.find((e) => e.tipo_evento === 'abono_falta');
    assert.ok(evAbono, 'Deve gerar evento de falta abonada');
    assert.equal(evAbono?.motivo_abono, 'Em missão oficial da igreja');
    assert.match(evAbono?.descricao || '', /abonada formalmente/);

    // 5. Advertência formal expedida
    const evAdv = res.eventos.find((e) => e.tipo_evento === 'advertencia_expedida');
    assert.ok(evAdv, 'Deve conter a advertência formal');
    assert.equal(evAdv?.advertencia_protocolo, 'ADV-2026/0001-MIN');
  });

  it('deve garantir unicidade de convocação por reunião sem duplicatas quando há múltiplos snapshots da mesma reunião', async () => {
    const mockSupabaseDuplicata = createMockSupabase({
      reunioes_participantes: [
        {
          id: 'part-01',
          reuniao_id: 'reuniao-14-11',
          status_presenca: 'pendente',
          created_at: '2026-11-01T10:00:00Z',
          reuniao: {
            id: 'reuniao-14-11',
            titulo: 'REUNIÃO MINISTERIAL COM SANTA CEIA',
            data_reuniao: '2026-11-14',
            horario_inicio: '19:00:00',
          },
        },
        {
          id: 'part-02-duplicado',
          reuniao_id: 'reuniao-14-11',
          status_presenca: 'pendente',
          created_at: '2026-11-02T10:00:00Z',
          reuniao: {
            id: 'reuniao-14-11',
            titulo: 'REUNIÃO MINISTERIAL COM SANTA CEIA',
            data_reuniao: '2026-11-14',
            horario_inicio: '19:00:00',
          },
        },
        {
          id: 'part-03-dezembro',
          reuniao_id: 'reuniao-12-12',
          status_presenca: 'pendente',
          created_at: '2026-11-01T10:00:00Z',
          reuniao: {
            id: 'reuniao-12-12',
            titulo: 'REUNIÃO MINISTERIAL COM SANTA CEIA',
            data_reuniao: '2026-12-12',
            horario_inicio: '18:30:00',
          },
        },
      ],
    });

    const res = await service.obterHistoricoCompleto('danico-uuid-001', 'm-01', mockSupabaseDuplicata as any);
    const convs = res.eventos.filter((e) => e.tipo_evento === 'convocacao_reuniao');

    // Deve ter apenas 2 convocações (uma para 14/11 e uma para 12/12), sem duplicar a de 14/11
    assert.equal(convs.length, 2, 'Deve ter exatamente 2 convocações para as 2 reuniões distintas');
    const datas = convs.map((c) => c.data).sort();
    assert.deepEqual(datas, ['2026-11-14', '2026-12-12']);
  });

  it('deve registrar separadamente convocação e check-in confirmado com método e horário', async () => {
    const mockSupabaseCheckin = createMockSupabase({
      reunioes_participantes: [
        {
          id: 'part-checkin',
          reuniao_id: 'reuniao-checkin-id',
          status_presenca: 'presente',
          created_at: '2026-11-01T10:00:00Z',
          reuniao: {
            id: 'reuniao-checkin-id',
            titulo: 'Reunião Pastoral Presencial',
            data_reuniao: '2026-11-14',
            horario_inicio: '19:00',
          },
        },
      ],
      reunioes_checkins: [
        {
          id: 'checkin-uuid-123',
          reuniao_id: 'reuniao-checkin-id',
          data_hora_checkin: '2026-11-14T18:45:00-03:00',
          metodo_leitura: 'qrcode_carteirinha',
          reuniao: {
            id: 'reuniao-checkin-id',
            titulo: 'Reunião Pastoral Presencial',
            data_reuniao: '2026-11-14',
          },
        },
      ],
    });

    const res = await service.obterHistoricoCompleto('danico-uuid-001', 'm-01', mockSupabaseCheckin as any);

    const conv = res.eventos.find((e) => e.tipo_evento === 'convocacao_reuniao');
    assert.ok(conv, 'Deve conter convocação oficial');

    const checkin = res.eventos.find((e) => e.tipo_evento === 'presenca_reuniao');
    assert.ok(checkin, 'Deve conter check-in confirmado');
    assert.equal(checkin?.metodo_leitura, 'qrcode_carteirinha');
    assert.match(checkin?.badge.label || '', /Check-in Confirmado/);
    assert.match(checkin?.descricao || '', /Leitor QR Code/);
  });
});
