/**
 * Máquina de Estados Pura para o Chat do Agente Inteligente de Acolhimento
 * Módulo: Gestão Eklésia - Acolhimento de Visitantes
 * 
 * Arquivo: src/lib/acolhimento-chat-states.ts
 */

import { formatPhone, onlyDigits } from './mascaras';

export type StepId =
  | 'NOME'
  | 'TELEFONE'
  | 'BAIRRO'
  | 'PRIMEIRA_VISITA'
  | 'PEDIDO_ORACAO'
  | 'CONFIRMACAO'
  | 'FINALIZADO';

export interface ChatCultoContext {
  tipoCulto?: string;
  dataCulto?: string;
  horarioCulto?: string;
  congregacaoNome?: string;
  igrejaNome?: string;
}

export interface AcolhimentoData {
  nome: string;
  telefone: string | null;
  bairro: string | null;
  primeira_visita: boolean;
  pedido_oracao: string | null;
  consentimento_lgpd: boolean;
}

export interface QuickReply {
  id: string;
  label: string;
  value: string;
}

export interface ChatMessage {
  id: string;
  sender: 'bot' | 'user';
  text: string;
  stepId?: StepId;
  quickReplies?: QuickReply[];
  timestamp: number;
}

export interface ChatState {
  currentStep: StepId;
  data: AcolhimentoData;
  messages: ChatMessage[];
  context: ChatCultoContext;
  isSubmitting?: boolean;
  error?: string | null;
}

export type UserAction =
  | { type: 'INPUT'; value: string }
  | { type: 'QUICK_REPLY'; value: string }
  | { type: 'START_SUBMIT' }
  | { type: 'SUBMIT_SUCCESS' }
  | { type: 'SUBMIT_ERROR'; error: string }
  | { type: 'RESTART' };

let messageCounter = 0;
export function createMessageId(): string {
  messageCounter += 1;
  return `msg_${Date.now()}_${messageCounter}`;
}

/**
 * Normaliza e capitaliza nomes próprios.
 */
export function formatNome(raw: string): string {
  const trimmed = raw.trim().replace(/\s+/g, ' ');
  return trimmed
    .split(' ')
    .map((word) => {
      const lower = word.toLowerCase();
      if (['de', 'da', 'do', 'das', 'dos', 'e'].includes(lower)) {
        return lower;
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

/**
 * Verifica se a entrada do usuário indica a intenção de pular a pergunta.
 */
export function isSkipCommand(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  const skipKeywords = [
    'pular',
    'pula',
    'pulo',
    'skip',
    'ignorar',
    'ignora',
    'não quero',
    'nao quero',
    'não informar',
    'nao informar',
    'sem telefone',
    'sem whatsapp',
    'sem bairro',
    'sem pedido',
    'nenhum',
    'nenhuma',
    'nada',
    'depois',
    'passar',
  ];
  return skipKeywords.includes(normalized);
}

/**
 * Validação de Nome (Obrigatório, min 2 caracteres).
 */
export function validateName(raw: string): { valid: boolean; error?: string; value?: string } {
  const clean = raw.trim();
  if (!clean) {
    return { valid: false, error: 'Por favor, digite seu nome para que possamos lhe conhecer melhor!' };
  }
  if (isSkipCommand(clean)) {
    return {
      valid: false,
      error: 'Seu nome é muito especial para nós! Por favor, informe seu nome para continuarmos.',
    };
  }
  if (clean.length < 2) {
    return { valid: false, error: 'Por favor, digite um nome válido com pelo menos 2 letras.' };
  }
  return { valid: true, value: formatNome(clean) };
}

/**
 * Validação de Telefone / WhatsApp (Opcional).
 */
export function validatePhone(raw: string): { valid: boolean; error?: string; value?: string | null } {
  const clean = raw.trim();
  if (!clean || isSkipCommand(clean)) {
    return { valid: true, value: null };
  }

  // Remove caracteres não-dígitos
  let digits = onlyDigits(clean);

  // Se começou com 55 (DDI Brasil) e tem 12 ou 13 dígitos, remove o 55 inicial
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) {
    digits = digits.slice(2);
  }

  if (digits.length < 10 || digits.length > 11) {
    return {
      valid: false,
      error: 'Por favor, informe um WhatsApp válido com DDD (ex: 11 98765-4321) ou clique em "Pular".',
    };
  }

  // Não permitir DDD iniciado por 0
  if (digits.startsWith('0')) {
    digits = digits.slice(1);
    if (digits.length < 10 || digits.length > 11) {
      return {
        valid: false,
        error: 'Por favor, informe um número de telefone com DDD válido ou clique em "Pular".',
      };
    }
  }

  return { valid: true, value: formatPhone(digits) };
}

/**
 * Validação de Bairro (Opcional).
 */
export function validateBairro(raw: string): { valid: boolean; error?: string; value?: string | null } {
  const clean = raw.trim();
  if (!clean || isSkipCommand(clean)) {
    return { valid: true, value: null };
  }
  if (clean.length > 100) {
    return { valid: true, value: clean.slice(0, 100).trim() };
  }
  return { valid: true, value: clean };
}

/**
 * Parser de Primeira Visita (Sim / Não).
 */
export function parsePrimeiraVisita(raw: string): { valid: boolean; error?: string; value?: boolean } {
  const clean = raw.trim().toLowerCase();

  const simKeywords = [
    'sim',
    's',
    '1',
    'primeira',
    'primeira vez',
    'sim, primeira vez!',
    'sim, primeira vez',
    'sim, é a primeira vez',
    'sim, e a primeira vez',
    'sou novo',
    'visita',
  ];

  const naoKeywords = [
    'não',
    'nao',
    'n',
    '2',
    'já estive',
    'ja estive',
    'já estive aqui antes',
    'ja estive aqui antes',
    'já vim antes',
    'ja vim antes',
    'já vim',
    'ja vim',
    'não, já vim antes',
    'nao, ja vim antes',
    'já sou de casa',
    'ja sou de casa',
    'não é primeira vez',
    'nao e primeira vez',
  ];

  if (simKeywords.includes(clean)) {
    return { valid: true, value: true };
  }
  if (naoKeywords.includes(clean)) {
    return { valid: true, value: false };
  }

  return {
    valid: false,
    error: 'Por favor, selecione uma das opções: "Sim, primeira vez!" ou "Não, já estive aqui antes".',
  };
}

/**
 * Validação de Pedido de Oração (Opcional).
 */
export function parsePedidoOracao(raw: string): { valid: boolean; error?: string; value?: string | null } {
  const clean = raw.trim();
  if (!clean || isSkipCommand(clean)) {
    return { valid: true, value: null };
  }
  if (clean.length > 2000) {
    return { valid: true, value: clean.slice(0, 2000).trim() };
  }
  return { valid: true, value: clean };
}

/**
 * Retorna mensagem de acolhimento inicial com base no contexto do culto.
 */
export function getWelcomeMessage(context: ChatCultoContext = {}): string {
  const partes: string[] = ['Graça e Paz! Seja muito bem-vindo(a)'];

  if (context.congregacaoNome) {
    partes.push(`à ${context.congregacaoNome}`);
  } else if (context.igrejaNome) {
    partes.push(`à ${context.igrejaNome}`);
  }

  if (context.tipoCulto) {
    partes.push(`para o ${context.tipoCulto}`);
  }

  const saudacao = partes.join(' ') + '! 🙏✨';
  return `${saudacao}\n\nÉ uma alegria imensa ter você aqui conosco hoje. Para que possamos acolher você com todo carinho, como você gostaria de ser chamado(a)?`;
}

/**
 * Gera o texto do resumo e consentimento LGPD.
 */
export function generateConfirmationSummary(data: AcolhimentoData): string {
  const telExibicao = data.telefone ? data.telefone : 'Não informado';
  const bairroExibicao = data.bairro ? data.bairro : 'Não informado';
  const primeiraVisitaExibicao = data.primeira_visita ? 'Sim (1ª visita)' : 'Já estive aqui antes';
  const oracaoExibicao = data.pedido_oracao ? `"${data.pedido_oracao}"` : 'Nenhum pedido informado';

  return `Perfeito, ${data.nome}! Confira se suas informações estão certinhas:\n\n` +
    `👤 Nome: ${data.nome}\n` +
    `📱 WhatsApp: ${telExibicao}\n` +
    `📍 Bairro: ${bairroExibicao}\n` +
    `⛪ Primeira visita: ${primeiraVisitaExibicao}\n` +
    `🙏 Pedido de oração: ${oracaoExibicao}\n\n` +
    `🔒 Consentimento LGPD:\n` +
    `Seus dados serão tratados com segurança e sigilo, exclusivamente para acolhimento pastoral e intercessão pela nossa congregação.`;
}

/**
 * Cria o estado inicial da máquina de estados do chat.
 */
export function createInitialChatState(context: ChatCultoContext = {}): ChatState {
  const initialData: AcolhimentoData = {
    nome: '',
    telefone: null,
    bairro: null,
    primeira_visita: true,
    pedido_oracao: null,
    consentimento_lgpd: false,
  };

  const welcomeText = getWelcomeMessage(context);

  const initialMessage: ChatMessage = {
    id: createMessageId(),
    sender: 'bot',
    text: welcomeText,
    stepId: 'NOME',
    timestamp: Date.now(),
  };

  return {
    currentStep: 'NOME',
    data: initialData,
    messages: [initialMessage],
    context,
    isSubmitting: false,
    error: null,
  };
}

/**
 * Transição pura da máquina de estados.
 */
export function processChatAction(
  state: ChatState,
  action: UserAction
): { nextState: ChatState; error?: string } {
  // Se for ação de reiniciar
  if (action.type === 'RESTART') {
    return {
      nextState: createInitialChatState(state.context),
    };
  }

  // Se for início de submissão
  if (action.type === 'START_SUBMIT') {
    return {
      nextState: {
        ...state,
        isSubmitting: true,
        error: null,
      },
    };
  }

  // Se submissão terminou com sucesso
  if (action.type === 'SUBMIT_SUCCESS') {
    const successMsg: ChatMessage = {
      id: createMessageId(),
      sender: 'bot',
      text: `Glória a Deus! Tudo confirmado com sucesso, ${state.data.nome}! 🎉\n\nNossa congregação se alegra grandemente em ter você conosco hoje. Sinta-se em casa e que o Senhor fale profundamente ao seu coração durante esta ministração! 🙏💙`,
      stepId: 'FINALIZADO',
      timestamp: Date.now(),
    };

    return {
      nextState: {
        ...state,
        currentStep: 'FINALIZADO',
        isSubmitting: false,
        error: null,
        messages: [...state.messages, successMsg],
      },
    };
  }

  // Se submissão terminou com erro
  if (action.type === 'SUBMIT_ERROR') {
    return {
      nextState: {
        ...state,
        isSubmitting: false,
        error: action.error,
      },
      error: action.error,
    };
  }

  const rawInput = action.value;
  const userMsg: ChatMessage = {
    id: createMessageId(),
    sender: 'user',
    text: rawInput,
    timestamp: Date.now(),
  };

  switch (state.currentStep) {
    case 'NOME': {
      const result = validateName(rawInput);
      if (!result.valid || !result.value) {
        return {
          nextState: { ...state, error: result.error },
          error: result.error,
        };
      }

      const updatedData: AcolhimentoData = {
        ...state.data,
        nome: result.value,
      };

      const botMsg: ChatMessage = {
        id: createMessageId(),
        sender: 'bot',
        text: `Muito prazer, ${result.value}! 🤝\n\nSe você desejar receber uma mensagem de acolhimento e avisos especiais da congregação no seu WhatsApp, digite o seu número com DDD.\n\n(Se preferir não informar agora, basta clicar no botão abaixo).`,
        stepId: 'TELEFONE',
        quickReplies: [{ id: 'skip_tel', label: 'Pular este passo ⏭️', value: 'pular' }],
        timestamp: Date.now(),
      };

      return {
        nextState: {
          ...state,
          currentStep: 'TELEFONE',
          data: updatedData,
          messages: [...state.messages, userMsg, botMsg],
          error: null,
        },
      };
    }

    case 'TELEFONE': {
      const result = validatePhone(rawInput);
      if (!result.valid) {
        return {
          nextState: { ...state, error: result.error },
          error: result.error,
        };
      }

      const updatedData: AcolhimentoData = {
        ...state.data,
        telefone: result.value ?? null,
      };

      const displayText = result.value ? result.value : 'Passo pulado';
      userMsg.text = displayText;

      const botMsg: ChatMessage = {
        id: createMessageId(),
        sender: 'bot',
        text: `Que bênção! Em qual bairro você mora? 🏘️\nIsso nos ajuda a saber se você é nosso vizinho ou veio de outra localidade!\n\n(Ou você pode clicar em pular caso prefira).`,
        stepId: 'BAIRRO',
        quickReplies: [{ id: 'skip_bairro', label: 'Pular este passo ⏭️', value: 'pular' }],
        timestamp: Date.now(),
      };

      return {
        nextState: {
          ...state,
          currentStep: 'BAIRRO',
          data: updatedData,
          messages: [...state.messages, userMsg, botMsg],
          error: null,
        },
      };
    }

    case 'BAIRRO': {
      const result = validateBairro(rawInput);
      const updatedData: AcolhimentoData = {
        ...state.data,
        bairro: result.value ?? null,
      };

      const displayText = result.value ? result.value : 'Passo pulado';
      userMsg.text = displayText;

      const botMsg: ChatMessage = {
        id: createMessageId(),
        sender: 'bot',
        text: `Conta pra gente: esta é a sua primeira vez em nossa congregação? ⛪`,
        stepId: 'PRIMEIRA_VISITA',
        quickReplies: [
          { id: 'visita_sim', label: 'Sim, primeira vez! ✨', value: 'sim' },
          { id: 'visita_nao', label: 'Não, já estive aqui antes 🤝', value: 'nao' },
        ],
        timestamp: Date.now(),
      };

      return {
        nextState: {
          ...state,
          currentStep: 'PRIMEIRA_VISITA',
          data: updatedData,
          messages: [...state.messages, userMsg, botMsg],
          error: null,
        },
      };
    }

    case 'PRIMEIRA_VISITA': {
      const result = parsePrimeiraVisita(rawInput);
      if (!result.valid || typeof result.value !== 'boolean') {
        return {
          nextState: { ...state, error: result.error },
          error: result.error,
        };
      }

      const updatedData: AcolhimentoData = {
        ...state.data,
        primeira_visita: result.value,
      };

      userMsg.text = result.value ? 'Sim, é minha primeira vez!' : 'Não, já estive aqui antes.';

      const botMsg: ChatMessage = {
        id: createMessageId(),
        sender: 'bot',
        text: `Nossa equipe pastoral tem um compromisso de orar por você e pela sua família! 🙏\n\nVocê gostaria de deixar algum pedido de oração especial ou motivo de agradecimento? (Pode escrever aqui ou clicar em pular).`,
        stepId: 'PEDIDO_ORACAO',
        quickReplies: [{ id: 'skip_oracao', label: 'Não tenho pedidos (Pular) ⏭️', value: 'pular' }],
        timestamp: Date.now(),
      };

      return {
        nextState: {
          ...state,
          currentStep: 'PEDIDO_ORACAO',
          data: updatedData,
          messages: [...state.messages, userMsg, botMsg],
          error: null,
        },
      };
    }

    case 'PEDIDO_ORACAO': {
      const result = parsePedidoOracao(rawInput);
      const updatedData: AcolhimentoData = {
        ...state.data,
        pedido_oracao: result.value ?? null,
      };

      const displayText = result.value ? result.value : 'Nenhum pedido de oração informado';
      userMsg.text = displayText;

      const summaryText = generateConfirmationSummary(updatedData);

      const botMsg: ChatMessage = {
        id: createMessageId(),
        sender: 'bot',
        text: summaryText,
        stepId: 'CONFIRMACAO',
        quickReplies: [
          { id: 'confirmar', label: '✅ Confirmar e Concluir', value: 'confirmar' },
          { id: 'corrigir', label: '✏️ Corrigir dados', value: 'recomecar' },
        ],
        timestamp: Date.now(),
      };

      return {
        nextState: {
          ...state,
          currentStep: 'CONFIRMACAO',
          data: updatedData,
          messages: [...state.messages, userMsg, botMsg],
          error: null,
        },
      };
    }

    case 'CONFIRMACAO': {
      const clean = rawInput.trim().toLowerCase();

      if (['recomecar', 'corrigir', 'corrigir dados', 'voltar'].includes(clean)) {
        return {
          nextState: createInitialChatState(state.context),
        };
      }

      if (['confirmar', 'sim', 'concluir', 'ok', 'concordo', '✅ confirmar e concluir'].includes(clean)) {
        const updatedData: AcolhimentoData = {
          ...state.data,
          consentimento_lgpd: true,
        };

        userMsg.text = 'Confirmado com consentimento LGPD ✅';

        return {
          nextState: {
            ...state,
            data: updatedData,
            messages: [...state.messages, userMsg],
            error: null,
          },
        };
      }

      return {
        nextState: {
          ...state,
          error: 'Por favor, toque em "✅ Confirmar e Concluir" ou "✏️ Corrigir dados".',
        },
        error: 'Por favor, toque em "✅ Confirmar e Concluir" ou "✏️ Corrigir dados".',
      };
    }

    case 'FINALIZADO': {
      return {
        nextState: state,
      };
    }

    default:
      return {
        nextState: state,
      };
  }
}
