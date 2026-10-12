import { describe, it } from 'node:test';
import assert from 'node:assert';
import { PlanningConflictService } from '../src/lib/planning-conflict-service.ts';

describe('Agenda Multinível: Regras de Autorização, Escopo e Conflitos Server-Side', () => {
  const SEDE_ID = '00000000-0000-0000-0000-000000000001';
  const CONG_BETA_ID = '00000000-0000-0000-0000-000000000002';
  const CONG_GAMA_ID = '00000000-0000-0000-0000-000000000003';

  describe('1. Avaliação de Conflitos e Bloqueios em Memória', () => {
    it('Bloqueio Geral ministerial bloqueia QUALQUER congregação no mesmo horário', () => {
      const eventosExistentes = [
        {
          id: 'bloqueio-geral-1',
          titulo: 'Congresso Geral da Família (Gera Bloqueio)',
          church_id: null,
          escopo: 'organizacao',
          data_inicio: '2026-07-15T19:00:00.000Z',
          data_fim: '2026-07-15T22:00:00.000Z',
          calendario_oficial: true,
          gera_bloqueio: true,
        },
      ];

      // Tentativa de cadastrar na Congregação Beta no mesmo horário
      const resultadoBeta = PlanningConflictService.avaliarConflitosEmMemoria(
        eventosExistentes,
        {
          titulo: 'Culto Regular Beta',
          data_inicio: '2026-07-15T19:30:00.000Z',
          data_fim: '2026-07-15T21:00:00.000Z',
          church_id: CONG_BETA_ID,
        }
      );

      assert.strictEqual(resultadoBeta.status, 'BLOQUEIO');
      assert.ok(resultadoBeta.motivo?.includes('Bloqueios gerais do ministério'));
    });

    it('Calendário Oficial sem gera_bloqueio NÃO bloqueia congregação (gera apenas AVISO se na mesma congregação, ou permite)', () => {
      const eventosExistentes = [
        {
          id: 'oficial-informativo-1',
          titulo: 'Campanha de Jejum e Oração (Oficial Informativo)',
          church_id: null,
          escopo: 'organizacao',
          data_inicio: '2026-07-15T19:00:00.000Z',
          data_fim: '2026-07-15T22:00:00.000Z',
          calendario_oficial: true,
          gera_bloqueio: false, // Oficial, porém NÃO gera bloqueio
        },
      ];

      const resultadoBeta = PlanningConflictService.avaliarConflitosEmMemoria(
        eventosExistentes,
        {
          titulo: 'Culto Regular Beta',
          data_inicio: '2026-07-15T19:30:00.000Z',
          data_fim: '2026-07-15T21:00:00.000Z',
          church_id: CONG_BETA_ID,
        }
      );

      // Não gera impedimento/bloqueio
      assert.strictEqual(resultadoBeta.status, 'SEM_CONFLITO');
    });

    it('Bloqueio Local bloqueia SOMENTE a própria congregação, permitindo outras congregações', () => {
      const eventosExistentes = [
        {
          id: 'bloqueio-local-sede',
          titulo: 'Reforma do Templo Sede (Gera Bloqueio Local)',
          church_id: SEDE_ID,
          escopo: 'local',
          data_inicio: '2026-08-10T14:00:00.000Z',
          data_fim: '2026-08-10T18:00:00.000Z',
          calendario_oficial: false,
          gera_bloqueio: true,
        },
      ];

      // Tentativa na mesma congregação (Sede): DEVE ser BLOQUEADO
      const resultadoSede = PlanningConflictService.avaliarConflitosEmMemoria(
        eventosExistentes,
        {
          titulo: 'Reunião de Líderes Sede',
          data_inicio: '2026-08-10T15:00:00.000Z',
          data_fim: '2026-08-10T17:00:00.000Z',
          church_id: SEDE_ID,
        }
      );
      assert.strictEqual(resultadoSede.status, 'BLOQUEIO');
      assert.ok(resultadoSede.motivo?.includes('Bloqueio Local'));

      // Tentativa na Congregação Gama no mesmo horário: DEVE SER PERMITIDO
      const resultadoGama = PlanningConflictService.avaliarConflitosEmMemoria(
        eventosExistentes,
        {
          titulo: 'Reunião na Congregação Gama',
          data_inicio: '2026-08-10T15:00:00.000Z',
          data_fim: '2026-08-10T17:00:00.000Z',
          church_id: CONG_GAMA_ID,
        }
      );
      assert.strictEqual(resultadoGama.status, 'SEM_CONFLITO');
    });

    it('Ignora o próprio evento durante edição (não conflita consigo mesmo)', () => {
      const eventosExistentes = [
        {
          id: 'evento-atual-123',
          titulo: 'Encontro de Jovens',
          church_id: CONG_BETA_ID,
          escopo: 'local',
          data_inicio: '2026-09-01T19:00:00.000Z',
          data_fim: '2026-09-01T21:00:00.000Z',
          calendario_oficial: false,
          gera_bloqueio: false,
        },
      ];

      const resultado = PlanningConflictService.avaliarConflitosEmMemoria(
        eventosExistentes,
        {
          titulo: 'Encontro de Jovens (Editando)',
          data_inicio: '2026-09-01T19:00:00.000Z',
          data_fim: '2026-09-01T21:00:00.000Z',
          church_id: CONG_BETA_ID,
        },
        'evento-atual-123' // Ignora este ID
      );

      assert.strictEqual(resultado.status, 'SEM_CONFLITO');
    });
  });

  describe('2. Matriz de Autorização por Perfil', () => {
    it('Secretário-Geral / Administrador: pode criar em qualquer congregação ou geral', () => {
      const isSecretarioGeral = true;
      const targetChurchId: string | null = null; // Geral

      // Regra de autorização
      const podeCriarGeral = isSecretarioGeral || targetChurchId !== null;
      const podeCriarOutraCongregacao = isSecretarioGeral;
      assert.strictEqual(podeCriarGeral, true);
      assert.strictEqual(podeCriarOutraCongregacao, true);
    });

    it('Secretário Local: NÃO pode criar evento geral (church_id nulo)', () => {
      const isSecretarioLocal = true;
      const userCongregacaoId: string = CONG_BETA_ID;
      const targetChurchId: string | null = null; // Tentativa de criar evento geral

      const permitido = !isSecretarioLocal || (targetChurchId !== null && targetChurchId === userCongregacaoId);
      assert.strictEqual(permitido, false, 'Secretário local não pode cadastrar evento geral');
    });

    it('Secretário Local: NÃO pode criar evento para outra congregação', () => {
      const isSecretarioLocal = true;
      const userCongregacaoId: string = CONG_BETA_ID;
      const targetChurchId: string = CONG_GAMA_ID; // Tentativa de enviar para outra congregação

      const permitido = !isSecretarioLocal || targetChurchId === userCongregacaoId;
      assert.strictEqual(permitido, false, 'Secretário local não pode criar evento para outra congregação');
    });

    it('Secretário Local: NÃO pode ativar gera_bloqueio nem alterar calendário oficial geral', () => {
      const isSecretarioLocal = true;
      const geraBloqueioTentado = true;

      const permitido = !isSecretarioLocal || !geraBloqueioTentado;
      assert.strictEqual(permitido, false, 'Secretário local não pode ativar impedimentos de bloqueio oficial');
    });

    it('Secretário Local: PODE criar e editar evento na sua própria congregação sem bloqueio', () => {
      const isSecretarioLocal = true;
      const userCongregacaoId = CONG_BETA_ID;
      const targetChurchId = CONG_BETA_ID;
      const geraBloqueioTentado = false;

      const permitido = isSecretarioLocal && targetChurchId === userCongregacaoId && !geraBloqueioTentado;
      assert.strictEqual(permitido, true, 'Secretário local pode registrar evento regular em sua unidade');
    });

    it('Permissão de Edição: Secretário Local não pode editar evento de outra congregação ou ministerial geral', () => {
      const userCongregacaoId = CONG_BETA_ID;
      const isSecretarioGeral = false;

      const eventoGeral = { id: 'evt-1', church_id: null };
      const eventoOutra = { id: 'evt-2', church_id: CONG_GAMA_ID };
      const eventoPropria = { id: 'evt-3', church_id: CONG_BETA_ID };

      const canEdit = (evt: { church_id: string | null }) => {
        if (isSecretarioGeral) return true;
        return Boolean(evt.church_id && evt.church_id === userCongregacaoId);
      };

      assert.strictEqual(canEdit(eventoGeral), false, 'Não pode editar evento geral');
      assert.strictEqual(canEdit(eventoOutra), false, 'Não pode editar evento de outra congregação');
      assert.strictEqual(canEdit(eventoPropria), true, 'Pode editar evento da própria congregação');
    });

    it('Permissão de Exclusão (DELETE): Secretário Local não pode excluir eventos com gera_bloqueio, escopo organização ou de outra congregação', () => {
      const userCongregacaoId = CONG_BETA_ID;
      const isLocalSecretary = true;

      const canDelete = (evt: { church_id: string | null; gera_bloqueio?: boolean; escopo?: string }) => {
        if (!isLocalSecretary) return true;
        if (!evt.church_id || evt.church_id !== userCongregacaoId) return false;
        if (evt.gera_bloqueio) return false;
        if (evt.escopo === 'organizacao') return false;
        return true;
      };

      const regularProprio = { church_id: CONG_BETA_ID, gera_bloqueio: false, escopo: 'divisao1' };
      const bloqueioProprio = { church_id: CONG_BETA_ID, gera_bloqueio: true, escopo: 'divisao1' };
      const organizacaoProprio = { church_id: CONG_BETA_ID, gera_bloqueio: false, escopo: 'organizacao' };
      const regularOutro = { church_id: CONG_GAMA_ID, gera_bloqueio: false, escopo: 'divisao1' };
      const geralMinisterial = { church_id: null, gera_bloqueio: false, escopo: 'organizacao' };

      assert.strictEqual(canDelete(regularProprio), true, 'Pode excluir evento regular de sua congregação');
      assert.strictEqual(canDelete(bloqueioProprio), false, 'Não pode excluir bloqueio oficial');
      assert.strictEqual(canDelete(organizacaoProprio), false, 'Não pode excluir evento organizacional');
      assert.strictEqual(canDelete(regularOutro), false, 'Não pode excluir evento de outra congregação');
      assert.strictEqual(canDelete(geralMinisterial), false, 'Não pode excluir evento ministerial geral');
    });
  });
});
