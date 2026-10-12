import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createInitialChatState,
  processChatAction,
} from '../src/lib/acolhimento-chat-states';
import { isCultoAbertoHoje, getLocalDateStr } from '../src/lib/timezone-utils';
import { isPublicAcolhimentoPath } from '../src/lib/public-routes';

describe('Agente Inteligente de Acolhimento - Landing, Recorrente e Expiração', () => {
  describe('1. Validação de Janela de Culto e Fuso Horário Local (GMT-3)', () => {
    it('extrai corretamente a data local no padrão YYYY-MM-DD', () => {
      // 2026-10-12 21:00 em Brasília (GMT-3) corresponde a 2026-10-13 00:00 UTC
      const dataNoiteUtc = new Date(Date.UTC(2026, 9, 13, 0, 30, 0)); // 13/10 00:30 UTC = 12/10 21:30 GMT-3
      const localStr = getLocalDateStr(dataNoiteUtc);
      assert.equal(localStr, '2026-10-12');
    });

    it('libera acolhimento somente quando o culto é hoje e o status está Aberto', () => {
      const hojeRef = new Date('2026-10-12T19:00:00-03:00');

      const abertoHoje = isCultoAbertoHoje('2026-10-12', 'Aberto', hojeRef);
      assert.equal(abertoHoje.elegivel, true);
      assert.equal(abertoHoje.motivo, undefined);

      const caseInsensitive = isCultoAbertoHoje('2026-10-12', 'aberto', hojeRef);
      assert.equal(caseInsensitive.elegivel, true);
    });

    it('bloqueia cultos já encerrados ou consolidados mesmo na data de hoje', () => {
      const hojeRef = new Date('2026-10-12T21:30:00-03:00');

      const encerrado = isCultoAbertoHoje('2026-10-12', 'Encerrado', hojeRef);
      assert.equal(encerrado.elegivel, false);
      assert.equal(encerrado.motivo, 'CULTO_ENCERRADO');

      const consolidado = isCultoAbertoHoje('2026-10-12', 'Consolidado', hojeRef);
      assert.equal(consolidado.elegivel, false);
      assert.equal(consolidado.motivo, 'CULTO_ENCERRADO');

      const cancelado = isCultoAbertoHoje('2026-10-12', 'Cancelado', hojeRef);
      assert.equal(cancelado.elegivel, false);
      assert.equal(cancelado.motivo, 'CULTO_ENCERRADO');
    });

    it('bloqueia cultos passados (dias anteriores) e cultos futuros com códigos específicos', () => {
      const hojeRef = new Date('2026-10-12T12:00:00-03:00');

      // Ontem: CULTO_PASSADO
      const ontem = isCultoAbertoHoje('2026-10-11', 'Aberto', hojeRef);
      assert.equal(ontem.elegivel, false);
      assert.equal(ontem.motivo, 'CULTO_PASSADO');

      // Amanhã: CULTO_FUTURO
      const amanha = isCultoAbertoHoje('2026-10-13', 'Aberto', hojeRef);
      assert.equal(amanha.elegivel, false);
      assert.equal(amanha.motivo, 'CULTO_FUTURO');

      // Data inválida ou vazia: CULTO_PASSADO
      const semData = isCultoAbertoHoje(null, 'Aberto', hojeRef);
      assert.equal(semData.elegivel, false);
      assert.equal(semData.motivo, 'CULTO_PASSADO');
    });
  });

  describe('2. Fluxo de Visitante Recorrente Único e Pulo de Perguntas Desnecessárias', () => {
    it('quando há match único, confirma identidade e pula Nome, Bairro e Primeira Visita diretamente para Pedido de Oração', () => {
      const s0 = createInitialChatState({
        tipoCulto: 'Culto de Celebração',
        congregacaoNome: 'Templo Central',
      });

      // Visitante informa o telefone
      const { nextState: s1 } = processChatAction(s0, {
        type: 'INPUT',
        value: '11987654321',
      });
      assert.equal(s1.currentStep, 'TELEFONE');

      // Backend identifica o visitante com dados históricos únicos
      const { nextState: s2 } = processChatAction(s1, {
        type: 'IDENTIFIED_VISITANTE',
        payload: {
          encontrado: true,
          recorrente: true,
          ambiguo: false,
          nome: 'Marcos Vinicius',
          bairro: 'Jardim Primavera',
        },
      });

      assert.equal(s2.currentStep, 'CONFIRMAR_RECORRENTE');
      assert.ok(s2.messages.some((m) => m.text.includes('Marcos Vinicius')));

      // Visitante clica em "Sim, sou eu!"
      const { nextState: s3 } = processChatAction(s2, {
        type: 'QUICK_REPLY',
        value: 'sim',
      });

      // Pula diretamente para PEDIDO_ORACAO
      assert.equal(s3.currentStep, 'PEDIDO_ORACAO');
      assert.equal(s3.data.nome, 'Marcos Vinicius');
      assert.equal(s3.data.bairro, 'Jardim Primavera');
      assert.equal(s3.data.primeira_visita, false);
      assert.equal(s3.data.isRecorrente, true);

      // Usuário informa pedido de oração
      const { nextState: s4 } = processChatAction(s3, {
        type: 'INPUT',
        value: 'Pela saúde da minha família',
      });

      assert.equal(s4.currentStep, 'CONFIRMACAO');
      assert.equal(s4.data.pedido_oracao, 'Pela saúde da minha família');

      // Usuário confirma os dados e LGPD
      const { nextState: s5 } = processChatAction(s4, {
        type: 'QUICK_REPLY',
        value: 'confirmar',
      });

      assert.equal(s5.data.consentimento_lgpd, true);
    });

    it('quando o visitante declara que é outra pessoa, pede o nome sem assumir os dados antigos', () => {
      const s0 = createInitialChatState();

      const { nextState: s1 } = processChatAction(s0, {
        type: 'INPUT',
        value: '11987654321',
      });

      const { nextState: s2 } = processChatAction(s1, {
        type: 'IDENTIFIED_VISITANTE',
        payload: {
          encontrado: true,
          recorrente: true,
          ambiguo: false,
          nome: 'Roberto Carlos',
          bairro: 'Bela Vista',
        },
      });

      // Usuário responde "Não, sou outra pessoa"
      const { nextState: s3 } = processChatAction(s2, {
        type: 'QUICK_REPLY',
        value: 'nao',
      });

      assert.equal(s3.currentStep, 'NOME');
      assert.equal(s3.data.isRecorrente, false);
      assert.equal(s3.data.nome, '');
    });
  });

  describe('3. Fluxo de Telefone Compartilhado na Família (Ambíguo)', () => {
    it('quando o telefone pertence a múltiplos membros, solicita o nome com acolhimento e avança para pedido de oração', () => {
      const s0 = createInitialChatState();

      const { nextState: s1 } = processChatAction(s0, {
        type: 'INPUT',
        value: '11988887777',
      });

      // Backend identifica que este número possui mais de uma pessoa querida associada
      const { nextState: s2 } = processChatAction(s1, {
        type: 'IDENTIFIED_VISITANTE',
        payload: {
          encontrado: true,
          recorrente: true,
          ambiguo: true,
        },
      });

      assert.equal(s2.currentStep, 'NOME');
      assert.equal(s2.identificacaoTemp?.ambiguo, true);
      assert.ok(
        s2.messages.some((m) =>
          m.text.includes('utilizado por mais de uma pessoa querida')
        )
      );

      // Visitante digita seu próprio nome
      const { nextState: s3 } = processChatAction(s2, {
        type: 'INPUT',
        value: 'Camila Fernandes',
      });

      // Em telefone compartilhado, após o visitante dizer o nome, salta direto para pedido de oração
      assert.equal(s3.currentStep, 'PEDIDO_ORACAO');
      assert.equal(s3.data.nome, 'Camila Fernandes');
      assert.equal(s3.data.primeira_visita, false);
      assert.equal(s3.data.isRecorrente, true);
    });
  });

  describe('4. Suporte de Contexto para Landing e Expiração', () => {
    it('inicializa o estado preservando logoUrl e dados visuais do ministério', () => {
      const ctx = {
        tipoCulto: 'Culto de Doutrina',
        dataCulto: '2026-10-12',
        horarioCulto: '19:30',
        congregacaoNome: 'Congregação Betel',
        igrejaNome: 'Igreja Evangélica Renovada',
        logoUrl: 'https://cdn.exemplo.com/logo.png',
        appUrl: 'https://app.igreja.com.br',
      };

      const s = createInitialChatState(ctx);
      assert.equal(s.context.logoUrl, 'https://cdn.exemplo.com/logo.png');
      assert.equal(s.context.appUrl, 'https://app.igreja.com.br');
      assert.equal(s.context.congregacaoNome, 'Congregação Betel');
      assert.equal(s.context.tipoCulto, 'Culto de Doutrina');
    });
  });

  describe('5. Isolamento de Layout da Rota Pública de Acolhimento', () => {
    it('reconhece /acolhimento/[token] como rota pública autônoma (standalone)', () => {
      assert.equal(isPublicAcolhimentoPath('/acolhimento/token-publico-123'), true);
      assert.equal(isPublicAcolhimentoPath('/acolhimento/culto-domingo-noite'), true);
      assert.equal(isPublicAcolhimentoPath('/acolhimento/abcDEF123456'), true);
    });

    it('preserva rotas administrativas /acolhimento/visitantes e /acolhimento/relatorios com Sidebar', () => {
      assert.equal(isPublicAcolhimentoPath('/acolhimento/visitantes'), false);
      assert.equal(isPublicAcolhimentoPath('/acolhimento/visitantes/novo'), false);
      assert.equal(isPublicAcolhimentoPath('/acolhimento/relatorios'), false);
      assert.equal(isPublicAcolhimentoPath('/acolhimento/relatorios/espiritual'), false);
      assert.equal(isPublicAcolhimentoPath('/acolhimento'), false);
    });

    it('rejeita com segurança valores vazios, nulos ou outras rotas', () => {
      assert.equal(isPublicAcolhimentoPath(null), false);
      assert.equal(isPublicAcolhimentoPath(undefined), false);
      assert.equal(isPublicAcolhimentoPath(''), false);
      assert.equal(isPublicAcolhimentoPath('/dashboard'), false);
      assert.equal(isPublicAcolhimentoPath('/secretaria/cultos'), false);
    });
  });
});
