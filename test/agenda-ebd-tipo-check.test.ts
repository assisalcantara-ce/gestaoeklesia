import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  normalizarTipoAgendaEvento,
  TIPOS_VALIDOS_AGENDA_EVENTOS,
  AgendaRecorrenciaService,
  RecorrenciaConfig,
} from '../src/lib/agenda-recorrencia-service';
import { PlanningConflictService, EventoParaConflito } from '../src/lib/planning-conflict-service';

describe('Agenda Gestão Eklésia — Regressão Constraint agenda_eventos_tipo_check & EBD', () => {
  // Lista exata de valores aceitos pela constraint SQL:
  // CONSTRAINT agenda_eventos_tipo CHECK (tipo IN ('culto', 'reuniao', 'aula', 'evento', 'tarefa', 'outro'))
  const CONSTRAINT_ALLOWED_TYPES = new Set(['culto', 'reuniao', 'aula', 'evento', 'tarefa', 'outro']);

  describe('1. Validação de Mapeamento contra a Check Constraint', () => {
    it('garante que todos os TIPOS_VALIDOS_AGENDA_EVENTOS pertençam à constraint do Postgres', () => {
      for (const t of TIPOS_VALIDOS_AGENDA_EVENTOS) {
        assert.ok(
          CONSTRAINT_ALLOWED_TYPES.has(t),
          `Tipo ${t} não é permitido pela constraint agenda_eventos_tipo_check`
        );
      }
    });

    it('normaliza categoria departamento / EBD para "aula" (permitido pela constraint)', () => {
      // EBD configurada com categoria "departamento" ou nome contendo EBD
      const tipoNormalizado1 = normalizarTipoAgendaEvento('departamento', 'departamento', 'Escola Bíblica Dominical (EBD)');
      assert.equal(tipoNormalizado1, 'aula');
      assert.ok(CONSTRAINT_ALLOWED_TYPES.has(tipoNormalizado1));

      const tipoNormalizado2 = normalizarTipoAgendaEvento(undefined, 'departamento', 'EBD Adultos');
      assert.equal(tipoNormalizado2, 'aula');
      assert.ok(CONSTRAINT_ALLOWED_TYPES.has(tipoNormalizado2));

      const tipoNormalizado3 = normalizarTipoAgendaEvento('ebd', undefined, 'EBD');
      assert.equal(tipoNormalizado3, 'aula');
      assert.ok(CONSTRAINT_ALLOWED_TYPES.has(tipoNormalizado3));
    });

    it('normaliza qualquer outra categoria de agenda_tipos para tipos válidos da constraint', () => {
      // Todas as categorias possíveis de agenda_tipos:
      // ('culto', 'reuniao', 'evento', 'missoes', 'departamento', 'administrativo')
      const casosDeTeste = [
        { cat: 'culto', nome: 'Culto de Doutrina', esperado: 'culto' },
        { cat: 'reuniao', nome: 'Reunião Ministerial', esperado: 'reuniao' },
        { cat: 'evento', nome: 'Congresso de Jovens', esperado: 'evento' },
        { cat: 'missoes', nome: 'Conferência Missionária', esperado: 'evento' },
        { cat: 'departamento', nome: 'Ensaio Geral', esperado: 'reuniao' },
        { cat: 'departamento', nome: 'Escola Bíblica', esperado: 'aula' },
        { cat: 'administrativo', nome: 'Atendimento Pastoral', esperado: 'tarefa' },
        { cat: 'administrativo', nome: 'Assembleia Geral', esperado: 'reuniao' },
        { cat: 'desconhecido', nome: 'Custom', esperado: 'outro' },
      ];

      for (const { cat, nome, esperado } of casosDeTeste) {
        const resultado = normalizarTipoAgendaEvento(cat, cat, nome);
        assert.equal(resultado, esperado, `Falha ao normalizar categoria ${cat} com nome ${nome}`);
        assert.ok(
          CONSTRAINT_ALLOWED_TYPES.has(resultado),
          `Resultado ${resultado} viola a constraint agenda_eventos_tipo_check`
        );
      }
    });
  });

  describe('2. Recorrência de EBD para Todo o Campo (Todas as Congregações)', () => {
    it('gera evento pai e todas as ocorrências filhas com tipo válido e sem violação de constraint', () => {
      const anoRef = 2026;
      const config: RecorrenciaConfig = {
        frequencia: 'semanal',
        diasSemana: [0], // Domingos
        anoReferencia: anoRef,
        dataFimRecorrencia: `${anoRef}-12-31`,
      };

      // 1ª ocorrência automática de domingo em 2026 às 09:00
      const primeiraData = AgendaRecorrenciaService.calcularPrimeiraOcorrencia({
        ano: anoRef,
        config,
        hora: 9,
        minuto: 0,
      });

      assert.ok(primeiraData, 'Deveria calcular a primeira data');
      const dataInicioBaseStr = primeiraData.toISOString();
      const dataFimBaseStr = new Date(primeiraData.getTime() + 2 * 60 * 60 * 1000).toISOString();

      const ocorrencias = AgendaRecorrenciaService.gerarOcorrencias({
        dataInicio: dataInicioBaseStr,
        dataFim: dataFimBaseStr,
        config,
        limiteMaximo: 60,
      });

      assert.ok(ocorrencias.length > 50, `Deveria gerar ~52 domingos no ano, gerou ${ocorrencias.length}`);

      // Simulação do payload enviado ao backend
      const tipoSelecionado = {
        id: 'tipo-ebd-uuid',
        nome: 'Escola Bíblica Dominical (EBD)',
        categoria: 'departamento',
      };

      const tipoCalculado = normalizarTipoAgendaEvento(
        tipoSelecionado.categoria,
        undefined,
        tipoSelecionado.nome
      );

      // Validação do tipo calculado do Pai
      assert.equal(tipoCalculado, 'aula');
      assert.ok(CONSTRAINT_ALLOWED_TYPES.has(tipoCalculado));

      // Payload do Pai
      const paiPayload = {
        ministry_id: 'min-123',
        titulo: 'Escola Bíblica Dominical',
        tipo: tipoCalculado,
        tipo_id: tipoSelecionado.id,
        church_id: null, // Todo o Campo
        escopo: 'organizacao',
        gera_bloqueio: false, // Não gera bloqueio forçado
        calendario_oficial: false,
        recorrente: true,
        recorrencia_tipo: 'semanal',
        data_inicio: ocorrencias[0].dataInicio,
        data_fim: ocorrencias[0].dataFim,
      };

      assert.equal(paiPayload.church_id, null);
      assert.equal(paiPayload.escopo, 'organizacao');
      assert.equal(paiPayload.gera_bloqueio, false);
      assert.ok(CONSTRAINT_ALLOWED_TYPES.has(paiPayload.tipo));

      // Payloads das Filhas (como construído no route.ts)
      const filhasPayload = ocorrencias.slice(1).map((f) => ({
        ministry_id: 'min-123',
        titulo: paiPayload.titulo,
        tipo: normalizarTipoAgendaEvento(paiPayload.tipo, undefined, paiPayload.titulo),
        tipo_id: paiPayload.tipo_id,
        church_id: paiPayload.church_id,
        escopo: paiPayload.escopo,
        gera_bloqueio: paiPayload.gera_bloqueio,
        calendario_oficial: paiPayload.calendario_oficial,
        recorrente: true,
        recorrencia_tipo: 'semanal',
        recorrencia_pai_id: 'pai-uuid',
        data_inicio: f.dataInicio,
        data_fim: f.dataFim,
      }));

      assert.equal(filhasPayload.length, ocorrencias.length - 1);

      // Verifica cada uma das filhas geradas
      for (const filha of filhasPayload) {
        assert.ok(
          CONSTRAINT_ALLOWED_TYPES.has(filha.tipo),
          `Filha com tipo "${filha.tipo}" viola a constraint agenda_eventos_tipo_check`
        );
        assert.equal(filha.church_id, null, 'Filha deve herdar church_id nulo para Todo o Campo');
        assert.equal(filha.escopo, 'organizacao', 'Filha deve herdar escopo organizacao');
        assert.equal(filha.gera_bloqueio, false, 'Filha não deve gerar bloqueio automático');
      }
    });

    it('não gera bloqueio indevido de outras congregações para evento recorrente de EBD com gera_bloqueio = false', () => {
      const ebdGeral: EventoParaConflito = {
        id: 'ebd-1',
        titulo: 'Escola Bíblica Dominical',
        data_inicio: '2026-10-18T09:00:00.000Z',
        data_fim: '2026-10-18T11:00:00.000Z',
        church_id: null,
        escopo: 'organizacao',
        gera_bloqueio: false, // EBD geral normal NÃO bloqueia
        calendario_oficial: false,
      };

      const eventoLocalCongregacaoA: EventoParaConflito = {
        titulo: 'Reunião de Louvor - Congregação A',
        data_inicio: '2026-10-18T09:30:00.000Z',
        data_fim: '2026-10-18T10:30:00.000Z',
        church_id: 'cong-a',
        escopo: 'divisao1',
        gera_bloqueio: false,
        calendario_oficial: false,
      };

      const resultado = PlanningConflictService.avaliarConflitosEmMemoria(
        [ebdGeral],
        eventoLocalCongregacaoA
      );

      assert.equal(
        resultado.status,
        'SEM_CONFLITO',
        'EBD com gera_bloqueio = false não deve impedir agendamentos locais'
      );
    });
  });
});
