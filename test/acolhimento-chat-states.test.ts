import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createInitialChatState,
  processChatAction,
  validateName,
  validatePhone,
  validateBairro,
  parsePrimeiraVisita,
  parsePedidoOracao,
  formatNome,
  isSkipCommand,
  generateConfirmationSummary,
} from '../src/lib/acolhimento-chat-states';

describe('Agente Inteligente de Acolhimento - Máquina de Estados Pura', () => {
  describe('Validações Unitárias e Utilitários', () => {
    it('1. formatNome: capitaliza nomes próprios preservando preposições', () => {
      assert.equal(formatNome('joão da silva'), 'João da Silva');
      assert.equal(formatNome('MARIA DE SOUZA DOS SANTOS'), 'Maria de Souza dos Santos');
      assert.equal(formatNome('  pedro   alvares   cabral  '), 'Pedro Alvares Cabral');
    });

    it('2. isSkipCommand: detecta variações de comandos para pular etapa', () => {
      assert.equal(isSkipCommand('pular'), true);
      assert.equal(isSkipCommand('PULAR'), true);
      assert.equal(isSkipCommand('pula'), true);
      assert.equal(isSkipCommand('skip'), true);
      assert.equal(isSkipCommand('ignorar'), true);
      assert.equal(isSkipCommand('não quero'), true);
      assert.equal(isSkipCommand('nao informar'), true);
      assert.equal(isSkipCommand('sem telefone'), true);
      assert.equal(isSkipCommand('Carlos'), false);
      assert.equal(isSkipCommand('11999999999'), false);
    });

    it('3. validateName: exige nome válido com no mínimo 2 caracteres e proíbe pular', () => {
      const vazio = validateName('');
      assert.equal(vazio.valid, false);

      const espacos = validateName('   ');
      assert.equal(espacos.valid, false);

      const tentouPular = validateName('pular');
      assert.equal(tentouPular.valid, false);
      assert.match(tentouPular.error || '', /especial para nós/i);

      const curto = validateName('A');
      assert.equal(curto.valid, false);

      const valido = validateName('gabriel ferreira');
      assert.equal(valido.valid, true);
      assert.equal(valido.value, 'Gabriel Ferreira');
    });

    it('4. validatePhone: aceita números válidos (10 ou 11 dígitos), DDI 55 ou comandos de pular', () => {
      const pulado = validatePhone('pular');
      assert.equal(pulado.valid, true);
      assert.equal(pulado.value, null);

      const celular11 = validatePhone('11987654321');
      assert.equal(celular11.valid, true);
      assert.equal(celular11.value, '(11) 98765-4321');

      const fixo10 = validatePhone('1133221100');
      assert.equal(fixo10.valid, true);
      assert.equal(fixo10.value, '(11) 3322-1100');

      const comDDI = validatePhone('+55 (21) 99888-7766');
      assert.equal(comDDI.valid, true);
      assert.equal(comDDI.value, '(21) 99888-7766');

      const invalidoCurto = validatePhone('123456');
      assert.equal(invalidoCurto.valid, false);
      assert.match(invalidoCurto.error || '', /WhatsApp válido/i);
    });

    it('5. validateBairro: aceita texto, trunca acima de 100 caracteres ou aceita pular', () => {
      const pulado = validateBairro('pular');
      assert.equal(pulado.valid, true);
      assert.equal(pulado.value, null);

      const bairroNormal = validateBairro('Jardim das Flores');
      assert.equal(bairroNormal.valid, true);
      assert.equal(bairroNormal.value, 'Jardim das Flores');

      const longo = 'A'.repeat(120);
      const resultadoLongo = validateBairro(longo);
      assert.equal(resultadoLongo.valid, true);
      assert.equal(resultadoLongo.value?.length, 100);
    });

    it('6. parsePrimeiraVisita: interpreta respostas positivas, negativas e rejeita texto ambíguo', () => {
      assert.equal(parsePrimeiraVisita('sim').value, true);
      assert.equal(parsePrimeiraVisita('Sim, primeira vez!').value, true);
      assert.equal(parsePrimeiraVisita('1').value, true);

      assert.equal(parsePrimeiraVisita('não').value, false);
      assert.equal(parsePrimeiraVisita('nao').value, false);
      assert.equal(parsePrimeiraVisita('Já estive aqui antes').value, false);
      assert.equal(parsePrimeiraVisita('2').value, false);

      const ambiguo = parsePrimeiraVisita('talvez');
      assert.equal(ambiguo.valid, false);
      assert.match(ambiguo.error || '', /selecione uma das opções/i);
    });

    it('7. parsePedidoOracao: aceita texto de intercessão ou comando de pular', () => {
      const pulado = parsePedidoOracao('pular');
      assert.equal(pulado.valid, true);
      assert.equal(pulado.value, null);

      const oracao = parsePedidoOracao('Oração pela saúde da minha família');
      assert.equal(oracao.valid, true);
      assert.equal(oracao.value, 'Oração pela saúde da minha família');
    });

    it('8. generateConfirmationSummary: sintetiza todos os dados e inclui nota da LGPD', () => {
      const resumo = generateConfirmationSummary({
        nome: 'Lucas Lima',
        telefone: '(11) 98765-4321',
        bairro: 'Centro',
        primeira_visita: true,
        pedido_oracao: 'Pela aprovação no vestibular',
        consentimento_lgpd: true,
      });

      assert.match(resumo, /Lucas Lima/);
      assert.match(resumo, /\(11\) 98765-4321/);
      assert.match(resumo, /Centro/);
      assert.match(resumo, /1ª visita/);
      assert.match(resumo, /Pela aprovação no vestibular/);
      assert.match(resumo, /LGPD/);
    });
  });

  describe('Transições e Fluxo Conversacional Completo', () => {
    it('9. Fluxo completo passo a passo com preenchimento total de dados', () => {
      let state = createInitialChatState({
        tipoCulto: 'Culto de Celebração',
        congregacaoNome: 'Sede Central',
        igrejaNome: 'Igreja Batista Fonte',
      });

      assert.equal(state.currentStep, 'NOME');
      assert.equal(state.messages.length, 1);
      assert.match(state.messages[0].text, /Sede Central/);

      // Passo 1: Informa Nome
      let stepResult = processChatAction(state, { type: 'INPUT', value: 'ana beatriz' });
      assert.equal(stepResult.error, undefined);
      state = stepResult.nextState;
      assert.equal(state.currentStep, 'TELEFONE');
      assert.equal(state.data.nome, 'Ana Beatriz');

      // Passo 2: Informa Telefone
      stepResult = processChatAction(state, { type: 'INPUT', value: '11977778888' });
      assert.equal(stepResult.error, undefined);
      state = stepResult.nextState;
      assert.equal(state.currentStep, 'BAIRRO');
      assert.equal(state.data.telefone, '(11) 97777-8888');

      // Passo 3: Informa Bairro
      stepResult = processChatAction(state, { type: 'INPUT', value: 'Vila Mariana' });
      assert.equal(stepResult.error, undefined);
      state = stepResult.nextState;
      assert.equal(state.currentStep, 'PRIMEIRA_VISITA');
      assert.equal(state.data.bairro, 'Vila Mariana');

      // Passo 4: Responde Primeira Visita (Sim)
      stepResult = processChatAction(state, { type: 'QUICK_REPLY', value: 'sim' });
      assert.equal(stepResult.error, undefined);
      state = stepResult.nextState;
      assert.equal(state.currentStep, 'PEDIDO_ORACAO');
      assert.equal(state.data.primeira_visita, true);

      // Passo 5: Informa Pedido de Oração
      stepResult = processChatAction(state, {
        type: 'INPUT',
        value: 'Pela saúde da minha mãe e emprego para o meu irmão',
      });
      assert.equal(stepResult.error, undefined);
      state = stepResult.nextState;
      assert.equal(state.currentStep, 'CONFIRMACAO');
      assert.equal(state.data.pedido_oracao, 'Pela saúde da minha mãe e emprego para o meu irmão');

      // Passo 6: Confirmação com consentimento LGPD
      stepResult = processChatAction(state, { type: 'QUICK_REPLY', value: 'confirmar' });
      assert.equal(stepResult.error, undefined);
      state = stepResult.nextState;
      assert.equal(state.data.consentimento_lgpd, true);

      // Finalização da submissão com sucesso
      stepResult = processChatAction(state, { type: 'SUBMIT_SUCCESS' });
      state = stepResult.nextState;
      assert.equal(state.currentStep, 'FINALIZADO');
      assert.match(state.messages[state.messages.length - 1].text, /Glória a Deus! Tudo confirmado com sucesso/);
    });

    it('10. Fluxo com pulo de todos os campos opcionais (telefone, bairro, oração)', () => {
      let state = createInitialChatState();

      // Passo 1: Nome
      let stepResult = processChatAction(state, { type: 'INPUT', value: 'Marcos Paulo' });
      state = stepResult.nextState;
      assert.equal(state.currentStep, 'TELEFONE');

      // Passo 2: Pular telefone
      stepResult = processChatAction(state, { type: 'QUICK_REPLY', value: 'pular' });
      state = stepResult.nextState;
      assert.equal(state.currentStep, 'BAIRRO');
      assert.equal(state.data.telefone, null);

      // Passo 3: Pular bairro
      stepResult = processChatAction(state, { type: 'QUICK_REPLY', value: 'pular' });
      state = stepResult.nextState;
      assert.equal(state.currentStep, 'PRIMEIRA_VISITA');
      assert.equal(state.data.bairro, null);

      // Passo 4: Não é primeira visita
      stepResult = processChatAction(state, { type: 'QUICK_REPLY', value: 'nao' });
      state = stepResult.nextState;
      assert.equal(state.currentStep, 'PEDIDO_ORACAO');
      assert.equal(state.data.primeira_visita, false);

      // Passo 5: Pular oração
      stepResult = processChatAction(state, { type: 'QUICK_REPLY', value: 'pular' });
      state = stepResult.nextState;
      assert.equal(state.currentStep, 'CONFIRMACAO');
      assert.equal(state.data.pedido_oracao, null);

      // Passo 6: Confirmar LGPD
      stepResult = processChatAction(state, { type: 'QUICK_REPLY', value: 'confirmar' });
      state = stepResult.nextState;
      assert.equal(state.data.consentimento_lgpd, true);
    });

    it('11. Tratamento de input inválido não deve alterar estado e deve retornar erro', () => {
      const state = createInitialChatState();

      // Nome com apenas 1 letra
      const resultado = processChatAction(state, { type: 'INPUT', value: 'Z' });
      assert.equal(resultado.nextState.currentStep, 'NOME');
      assert.notEqual(resultado.error, undefined);
    });

    it('12. Ação de recomeçar reinicia o estado preservando o contexto do culto', () => {
      let state = createInitialChatState({ congregacaoNome: 'Congregação Norte' });
      let stepResult = processChatAction(state, { type: 'INPUT', value: 'Renato' });
      state = stepResult.nextState;
      assert.equal(state.currentStep, 'TELEFONE');

      // Usuário decide reiniciar
      stepResult = processChatAction(state, { type: 'RESTART' });
      state = stepResult.nextState;
      assert.equal(state.currentStep, 'NOME');
      assert.equal(state.data.nome, '');
      assert.equal(state.context.congregacaoNome, 'Congregação Norte');
    });

    it('13. Tratamento de erro na submissão (SUBMIT_ERROR)', () => {
      let state = createInitialChatState();
      state = processChatAction(state, { type: 'START_SUBMIT' }).nextState;
      assert.equal(state.isSubmitting, true);

      const stepResult = processChatAction(state, {
        type: 'SUBMIT_ERROR',
        error: 'Falha de conexão com o servidor',
      });

      assert.equal(stepResult.nextState.isSubmitting, false);
      assert.equal(stepResult.nextState.error, 'Falha de conexão com o servidor');
    });
  });
});
