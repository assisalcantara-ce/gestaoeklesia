import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PlanningConflictService, EventoParaConflito } from '../src/lib/planning-conflict-service';

describe('Agenda Gestão Eklésia — Semântica de Todo o Campo (Todas as Congregações)', () => {
  const inicioIso = '2026-10-18T09:00:00.000Z';
  const fimIso = '2026-10-18T11:00:00.000Z';

  describe('1. Semântica e Persistência do Escopo de Abrangência', () => {
    it('cria evento para Todo o Campo com church_id nulo e escopo organizacao', () => {
      // Simulação do payload gerado pelo formulário e useAgenda ao selecionar Todo o Campo
      const formSelection = {
        church_id: '',
        local: 'Todo o Campo (Todas as Congregações)',
      };

      const finalChurchId = formSelection.church_id || null;
      const finalEscopo = finalChurchId ? 'divisao1' : 'organizacao';
      const finalLocal = finalChurchId ? formSelection.local : (formSelection.local || 'Todo o Campo (Todas as Congregações)');

      assert.equal(finalChurchId, null);
      assert.equal(finalEscopo, 'organizacao');
      assert.equal(finalLocal, 'Todo o Campo (Todas as Congregações)');
    });

    it('preserva evento de congregação individual com church_id e escopo divisao1', () => {
      const formSelection = {
        church_id: 'cong-bairro-novo',
        local: 'Congregação Bairro Novo',
      };

      const finalChurchId = formSelection.church_id || null;
      const finalEscopo = finalChurchId ? 'divisao1' : 'organizacao';
      const finalLocal = formSelection.local;

      assert.equal(finalChurchId, 'cong-bairro-novo');
      assert.equal(finalEscopo, 'divisao1');
      assert.equal(finalLocal, 'Congregação Bairro Novo');
    });

    it('na edição, preserva a abrangência existente sem converter evento local em geral', () => {
      const eventoExistenteLocal = {
        id: 'evt-1',
        titulo: 'Culto de Oração',
        church_id: 'cong-sede',
        local: 'Templo Central (Sede)',
        escopo: 'divisao1',
      };

      const resolvedChurchId = eventoExistenteLocal.church_id || '';
      const resolvedEscopo = eventoExistenteLocal.escopo || (resolvedChurchId ? 'divisao1' : 'organizacao');

      assert.equal(resolvedChurchId, 'cong-sede');
      assert.equal(resolvedEscopo, 'divisao1');
    });

    it('na edição de evento geral, preserva church_id nulo e escopo organizacao', () => {
      const eventoExistenteGeral = {
        id: 'evt-2',
        titulo: 'Escola Bíblica Dominical',
        church_id: null,
        local: 'Todo o Campo (Todas as Congregações)',
        escopo: 'organizacao',
      };

      const resolvedChurchId = eventoExistenteGeral.church_id || '';
      let resolvedLocal = eventoExistenteGeral.local || '';
      if (!resolvedChurchId && (!resolvedLocal || resolvedLocal === 'Sede Geral')) {
        resolvedLocal = 'Todo o Campo (Todas as Congregações)';
      }
      const resolvedEscopo = eventoExistenteGeral.escopo || (resolvedChurchId ? 'divisao1' : 'organizacao');

      assert.equal(resolvedChurchId, '');
      assert.equal(resolvedLocal, 'Todo o Campo (Todas as Congregações)');
      assert.equal(resolvedEscopo, 'organizacao');
    });
  });

  describe('2. Regras de Visualização nas Agendas de Congregações', () => {
    // Banco simulado de eventos
    const eventosBanco = [
      {
        id: 'ebd-campo',
        titulo: 'Escola Bíblica Dominical — Geral',
        church_id: null, // Todo o Campo
        escopo: 'organizacao',
        gera_bloqueio: false,
      },
      {
        id: 'culto-cong-a',
        titulo: 'Culto da Família na Congregação A',
        church_id: 'cong-a',
        escopo: 'divisao1',
        gera_bloqueio: false,
      },
      {
        id: 'culto-cong-b',
        titulo: 'Culto de Jovens na Congregação B',
        church_id: 'cong-b',
        escopo: 'divisao1',
        gera_bloqueio: false,
      },
    ];

    it('visão geral inclui eventos de Todo o Campo (church_id nulo ou escopo organizacao)', () => {
      const filtro = (evt: typeof eventosBanco[0]) => !evt.church_id || evt.escopo === 'organizacao' || evt.gera_bloqueio;
      const resultado = eventosBanco.filter(filtro);

      assert.ok(resultado.some(e => e.id === 'ebd-campo'));
    });

    it('visão da Congregação A inclui seus eventos locais E os eventos de Todo o Campo', () => {
      const visualizacao = 'cong-a';
      const filtro = (evt: typeof eventosBanco[0]) => evt.church_id === visualizacao || evt.church_id === null;
      const resultado = eventosBanco.filter(filtro);

      assert.equal(resultado.length, 2);
      assert.ok(resultado.some(e => e.id === 'ebd-campo'));
      assert.ok(resultado.some(e => e.id === 'culto-cong-a'));
      assert.ok(!resultado.some(e => e.id === 'culto-cong-b')); // Não vaza cong-b
    });

    it('visão da Congregação B inclui seus eventos locais E os eventos de Todo o Campo', () => {
      const visualizacao = 'cong-b';
      const filtro = (evt: typeof eventosBanco[0]) => evt.church_id === visualizacao || evt.church_id === null;
      const resultado = eventosBanco.filter(filtro);

      assert.equal(resultado.length, 2);
      assert.ok(resultado.some(e => e.id === 'ebd-campo'));
      assert.ok(resultado.some(e => e.id === 'culto-cong-b'));
      assert.ok(!resultado.some(e => e.id === 'culto-cong-a')); // Não vaza cong-a
    });
  });

  describe('3. Mecanismo de Conflitos e Bloqueios (PlanningConflictService)', () => {
    it('evento para Todo o Campo com gera_bloqueio = false NÃO bloqueia outras congregações', () => {
      // Exemplo: EBD que ocorre simultaneamente em todo o campo sem impedir programações
      const ebdGeral: EventoParaConflito = {
        id: 'ebd-1',
        titulo: 'EBD — Todo o Campo',
        data_inicio: inicioIso,
        data_fim: fimIso,
        church_id: null,
        escopo: 'organizacao',
        gera_bloqueio: false,
      };

      const cultoLocal: EventoParaConflito = {
        titulo: 'Manhã com Deus — Congregação A',
        data_inicio: inicioIso,
        data_fim: fimIso,
        church_id: 'cong-a',
        escopo: 'divisao1',
        gera_bloqueio: false,
      };

      const resultado = PlanningConflictService.avaliarConflitosEmMemoria([ebdGeral], cultoLocal);
      assert.equal(resultado.status, 'SEM_CONFLITO');
      assert.equal(resultado.motivo, null);
    });

    it('evento para Todo o Campo com gera_bloqueio = true BLOQUEIA agendamentos em todas as congregações', () => {
      // Exemplo: Convenção Estadual Oficial que proíbe cultos locais no mesmo horário
      const convencaoGeral: EventoParaConflito = {
        id: 'convencao-1',
        titulo: 'Convenção Geral Ministerial',
        data_inicio: inicioIso,
        data_fim: fimIso,
        church_id: null,
        escopo: 'organizacao',
        gera_bloqueio: true,
      };

      const tentativaCultoLocal: EventoParaConflito = {
        titulo: 'Tentativa de Culto Local',
        data_inicio: inicioIso,
        data_fim: fimIso,
        church_id: 'cong-qualquer',
        escopo: 'divisao1',
        gera_bloqueio: false,
      };

      const resultado = PlanningConflictService.avaliarConflitosEmMemoria([convencaoGeral], tentativaCultoLocal);
      assert.equal(resultado.status, 'BLOQUEIO');
      assert.equal(resultado.regra_aplicada, 'BLOQUEIO_GERAL_MINISTERIAL');
      assert.match(resultado.motivo || '', /Bloqueios gerais do ministério impedem agendamentos em todas as congregações/);
    });

    it('evento local com gera_bloqueio = true bloqueia apenas a própria congregação, permitindo outras', () => {
      const bloqueioLocalCongA: EventoParaConflito = {
        id: 'reforma-cong-a',
        titulo: 'Manutenção Predial Congregação A',
        data_inicio: inicioIso,
        data_fim: fimIso,
        church_id: 'cong-a',
        escopo: 'divisao1',
        gera_bloqueio: true,
      };

      // Tentativa na mesma congregação -> BLOQUEIO
      const tentativaMesmaCong = {
        titulo: 'Reunião de Oração Cong A',
        data_inicio: inicioIso,
        data_fim: fimIso,
        church_id: 'cong-a',
        escopo: 'divisao1',
        gera_bloqueio: false,
      };
      const resMesma = PlanningConflictService.avaliarConflitosEmMemoria([bloqueioLocalCongA], tentativaMesmaCong);
      assert.equal(resMesma.status, 'BLOQUEIO');
      assert.equal(resMesma.regra_aplicada, 'BLOQUEIO_LOCAL_CONGREGACAO');

      // Tentativa em outra congregação -> PERMITIDO
      const tentativaOutraCong = {
        titulo: 'Culto Normal Cong B',
        data_inicio: inicioIso,
        data_fim: fimIso,
        church_id: 'cong-b',
        escopo: 'divisao1',
        gera_bloqueio: false,
      };
      const resOutra = PlanningConflictService.avaliarConflitosEmMemoria([bloqueioLocalCongA], tentativaOutraCong);
      assert.equal(resOutra.status, 'SEM_CONFLITO');
    });
  });

  describe('4. Matriz de Autorização e Isolamento por Perfil', () => {
    function validarPermissaoCriacao(
      role: 'administrador' | 'secretario_geral' | 'secretario_local',
      userCongregacaoId: string | null,
      targetChurchId: string | null,
      targetGeraBloqueio: boolean
    ): { autorizado: boolean; code?: string } {
      if (role === 'secretario_local') {
        if (!userCongregacaoId) return { autorizado: false, code: 'LOCAL_NO_CHURCH' };
        if (!targetChurchId || targetChurchId !== userCongregacaoId) {
          return { autorizado: false, code: 'CHURCH_SCOPE_VIOLATION' };
        }
        if (targetGeraBloqueio) {
          return { autorizado: false, code: 'BLOCK_PERMISSION_DENIED' };
        }
      }
      return { autorizado: true };
    }

    it('administradores e secretário-geral podem criar eventos para Todo o Campo (targetChurchId = null)', () => {
      const resAdmin = validarPermissaoCriacao('administrador', null, null, false);
      assert.equal(resAdmin.autorizado, true);

      const resSecGeral = validarPermissaoCriacao('secretario_geral', null, null, false);
      assert.equal(resSecGeral.autorizado, true);
    });

    it('secretário local NÃO pode criar evento para Todo o Campo', () => {
      const resLocal = validarPermissaoCriacao('secretario_local', 'minha-cong', null, false);
      assert.equal(resLocal.autorizado, false);
      assert.equal(resLocal.code, 'CHURCH_SCOPE_VIOLATION');
    });

    it('secretário local NÃO pode ativar gera_bloqueio', () => {
      const resBloqueio = validarPermissaoCriacao('secretario_local', 'minha-cong', 'minha-cong', true);
      assert.equal(resBloqueio.autorizado, false);
      assert.equal(resBloqueio.code, 'BLOCK_PERMISSION_DENIED');
    });

    it('secretário local pode criar evento na sua própria congregação sem bloqueio', () => {
      const resValido = validarPermissaoCriacao('secretario_local', 'minha-cong', 'minha-cong', false);
      assert.equal(resValido.autorizado, true);
    });
  });
});
