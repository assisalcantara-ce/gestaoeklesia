import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createInitialChatState,
  processChatAction,
  getSuccessMessage,
} from '../src/lib/acolhimento-chat-states';
import { normalizeBrazilianPhone, getPhoneSearchVariants } from '../src/lib/telefone-utils';

describe('Agente Inteligente de Acolhimento - Evolução 1 & 2', () => {
  describe('1. Normalização e Validação de Telefones Brasileiros', () => {
    it('normaliza números com formatos equivalentes (traços, espaços, parênteses, +55)', () => {
      const f1 = normalizeBrazilianPhone('(11) 98765-4321');
      const f2 = normalizeBrazilianPhone('+5511987654321');
      const f3 = normalizeBrazilianPhone('11 98765 4321');
      const f4 = normalizeBrazilianPhone('005511987654321');
      const f5 = normalizeBrazilianPhone('11987654321');

      assert.equal(f1.valid, true);
      assert.equal(f2.valid, true);
      assert.equal(f3.valid, true);
      assert.equal(f4.valid, true);
      assert.equal(f5.valid, true);

      assert.equal(f1.formatted, '(11) 98765-4321');
      assert.equal(f2.formatted, '(11) 98765-4321');
      assert.equal(f3.formatted, '(11) 98765-4321');
      assert.equal(f4.formatted, '(11) 98765-4321');
      assert.equal(f5.formatted, '(11) 98765-4321');
      assert.equal(f1.digits, '11987654321');
    });

    it('identifica e rejeita DDD ausente como ambíguo sem inferir automaticamente', () => {
      const semDdd8 = normalizeBrazilianPhone('9876-5432');
      assert.equal(semDdd8.valid, false);
      assert.equal(semDdd8.ambiguous, true);
      assert.match(semDdd8.error || '', /DDD ausente/i);

      const semDdd9 = normalizeBrazilianPhone('98765-4321');
      assert.equal(semDdd9.valid, false);
      assert.equal(semDdd9.ambiguous, true);
      assert.match(semDdd9.error || '', /DDD ausente/i);
    });

    it('rejeita DDDs inexistentes no Brasil', () => {
      const dddInvalido = normalizeBrazilianPhone('01 98765-4321');
      assert.equal(dddInvalido.valid, false);

      const ddd20 = normalizeBrazilianPhone('20 98765-4321');
      assert.equal(ddd20.valid, false);
      assert.match(ddd20.error || '', /não é um código de área brasileiro válido/i);
    });

    it('gera variantes de busca para reconciliação com o histórico', () => {
      const variantes = getPhoneSearchVariants('11987654321');
      assert.ok(variantes.includes('(11) 98765-4321'));
      assert.ok(variantes.includes('11987654321'));
      assert.ok(variantes.includes('5511987654321'));
      assert.ok(variantes.includes('+5511987654321'));
    });
  });

  describe('2. Fluxo Conversacional Iniciando por Telefone', () => {
    it('inicia no estado TELEFONE com mensagem de boas-vindas adequada', () => {
      const state = createInitialChatState({
        tipoCulto: 'Culto de Celebração',
        congregacaoNome: 'Templo Central',
      });

      assert.equal(state.currentStep, 'TELEFONE');
      assert.match(state.messages[0].text, /WhatsApp com DDD/i);
      assert.match(state.messages[0].text, /Templo Central/i);
      assert.equal(state.messages[0].quickReplies?.[0].value, 'pular');
    });

    it('fluxo para visitante NOVO: telefone -> nome -> bairro -> primeira visita -> oração -> confirmação', () => {
      let state = createInitialChatState();

      // 1. Informa telefone
      state = processChatAction(state, { type: 'INPUT', value: '11 98765-4321' }).nextState;
      assert.equal(state.data.telefone, '(11) 98765-4321');

      // 2. Backend retorna que não encontrou histórico (novo visitante)
      state = processChatAction(state, {
        type: 'IDENTIFIED_VISITANTE',
        payload: { encontrado: false, recorrente: false },
      }).nextState;
      assert.equal(state.currentStep, 'NOME');
      assert.equal(state.data.primeira_visita, true);

      // 3. Informa nome
      state = processChatAction(state, { type: 'INPUT', value: 'Mateus Oliveira' }).nextState;
      assert.equal(state.currentStep, 'BAIRRO');
      assert.equal(state.data.nome, 'Mateus Oliveira');

      // 4. Informa bairro
      state = processChatAction(state, { type: 'INPUT', value: 'Vila Mariana' }).nextState;
      assert.equal(state.currentStep, 'PRIMEIRA_VISITA');
      assert.equal(state.data.bairro, 'Vila Mariana');

      // 5. Confirma primeira visita
      state = processChatAction(state, { type: 'QUICK_REPLY', value: 'sim' }).nextState;
      assert.equal(state.currentStep, 'PEDIDO_ORACAO');
      assert.equal(state.data.primeira_visita, true);

      // 6. Informa pedido de oração
      state = processChatAction(state, { type: 'INPUT', value: 'Pela saúde da minha mãe' }).nextState;
      assert.equal(state.currentStep, 'CONFIRMACAO');
      assert.equal(state.data.pedido_oracao, 'Pela saúde da minha mãe');

      // 7. Confirmação com consentimento LGPD
      state = processChatAction(state, { type: 'QUICK_REPLY', value: 'confirmar' }).nextState;
      assert.equal(state.data.consentimento_lgpd, true);
    });

    it('fluxo para visitante RECORRENTE: telefone -> confirma identidade -> oração -> confirmação (pula nome, bairro e primeira visita)', () => {
      let state = createInitialChatState();

      // 1. Informa telefone
      state = processChatAction(state, { type: 'INPUT', value: '21 99999-8888' }).nextState;
      assert.equal(state.data.telefone, '(21) 99999-8888');

      // 2. Backend encontra cadastro existente no ministério
      state = processChatAction(state, {
        type: 'IDENTIFIED_VISITANTE',
        payload: {
          encontrado: true,
          recorrente: true,
          nome: 'Priscila Alcantara',
          bairro: 'Copacabana',
          ambiguo: false,
        },
      }).nextState;

      assert.equal(state.currentStep, 'CONFIRMAR_RECORRENTE');
      assert.match(state.messages[state.messages.length - 1].text, /Priscila/);

      // 3. Visitante confirma que é ela
      state = processChatAction(state, { type: 'QUICK_REPLY', value: 'sim' }).nextState;
      assert.equal(state.currentStep, 'PEDIDO_ORACAO');
      assert.equal(state.data.nome, 'Priscila Alcantara');
      assert.equal(state.data.bairro, 'Copacabana');
      assert.equal(state.data.primeira_visita, false);
      assert.equal(state.data.isRecorrente, true);

      // 4. Pula pedido de oração
      state = processChatAction(state, { type: 'QUICK_REPLY', value: 'pular' }).nextState;
      assert.equal(state.currentStep, 'CONFIRMACAO');
      assert.equal(state.data.pedido_oracao, null);

      // 5. Confirmação
      state = processChatAction(state, { type: 'QUICK_REPLY', value: 'confirmar' }).nextState;
      assert.equal(state.data.consentimento_lgpd, true);
    });

    it('fluxo seguro em caso de AMBIGUIDADE (múltiplos nomes para o mesmo telefone familiar)', () => {
      let state = createInitialChatState();

      // 1. Informa telefone compartilhado
      state = processChatAction(state, { type: 'INPUT', value: '11 98888-7777' }).nextState;

      // 2. Backend detecta cadastro ambíguo na família
      state = processChatAction(state, {
        type: 'IDENTIFIED_VISITANTE',
        payload: {
          encontrado: true,
          recorrente: true,
          ambiguo: true,
        },
      }).nextState;

      // Deve pedir o nome para não presumir identidade errada
      assert.equal(state.currentStep, 'NOME');
      assert.match(state.messages[state.messages.length - 1].text, /mais de uma pessoa/i);
    });

    it('fluxo com TELEFONE PULADO avança com segurança diretamente para Nome', () => {
      let state = createInitialChatState();

      state = processChatAction(state, { type: 'QUICK_REPLY', value: 'pular' }).nextState;
      assert.equal(state.currentStep, 'NOME');
      assert.equal(state.data.telefone, null);
    });
  });

  describe('3. Mensagem Final e Link do Aplicativo', () => {
    it('gera mensagem final com link do aplicativo quando appUrl está configurado', () => {
      const msgComApp = getSuccessMessage('Carlos Eduardo', {
        appUrl: 'https://app.gestaoeklesia.com.br',
      });

      assert.match(msgComApp, /Carlos Eduardo/);
      assert.match(msgComApp, /aplicativo oficial da nossa igreja/i);
    });

    it('gera mensagem final limpa sem menção de aplicativo quando appUrl está nulo ou vazio', () => {
      const msgSemApp1 = getSuccessMessage('Ana Paula', {});
      const msgSemApp2 = getSuccessMessage('Ana Paula', { appUrl: null });
      const msgSemApp3 = getSuccessMessage('Ana Paula', { appUrl: '   ' });

      assert.doesNotMatch(msgSemApp1, /aplicativo oficial/i);
      assert.doesNotMatch(msgSemApp2, /aplicativo oficial/i);
      assert.doesNotMatch(msgSemApp3, /aplicativo oficial/i);
      assert.match(msgSemApp1, /Ana Paula/);
    });
  });
});
