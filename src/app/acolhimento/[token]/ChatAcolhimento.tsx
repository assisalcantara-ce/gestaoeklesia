'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Send,
  Loader2,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Sparkles,
  ShieldCheck,
  Heart,
  Church,
} from 'lucide-react';
import {
  ChatCultoContext,
  ChatState,
  createInitialChatState,
  processChatAction,
  QuickReply,
} from '@/lib/acolhimento-chat-states';
import { formatPhone } from '@/lib/mascaras';

interface ChatAcolhimentoProps {
  token: string;
  context: ChatCultoContext;
}

export default function ChatAcolhimento({ token, context }: ChatAcolhimentoProps) {
  const [chatState, setChatState] = useState<ChatState>(() => createInitialChatState(context));
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Auto-scroll para a última mensagem
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatState.messages, isTyping]);

  // Foco automático no input ao mudar de etapa
  useEffect(() => {
    if (chatState.currentStep !== 'FINALIZADO' && !isSubmitting) {
      inputRef.current?.focus();
    }
  }, [chatState.currentStep, isSubmitting]);

  // Enviar para a API após confirmação e consentimento LGPD
  const handleFinalSubmit = async (stateToSubmit: ChatState) => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const payload = {
        nome: stateToSubmit.data.nome,
        telefone: stateToSubmit.data.telefone,
        bairro: stateToSubmit.data.bairro,
        primeira_visita: stateToSubmit.data.primeira_visita,
        pedido_oracao: stateToSubmit.data.pedido_oracao,
        consentimento_lgpd: true,
      };

      const response = await fetch(`/api/v1/public/acolhimento/${encodeURIComponent(token)}/salvar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const errorText = data.error || 'Não foi possível registrar seu acolhimento. Tente novamente.';
        setErrorMessage(errorText);
        const { nextState } = processChatAction(stateToSubmit, {
          type: 'SUBMIT_ERROR',
          error: errorText,
        });
        setChatState(nextState);
        return;
      }

      setSubmitSuccess(true);
      const { nextState } = processChatAction(stateToSubmit, { type: 'SUBMIT_SUCCESS' });
      setChatState(nextState);
    } catch (err: any) {
      console.error('[ChatAcolhimento] Erro na submissão:', err);
      const errorText = 'Falha de comunicação com o servidor. Verifique sua conexão e tente novamente.';
      setErrorMessage(errorText);
      const { nextState } = processChatAction(stateToSubmit, {
        type: 'SUBMIT_ERROR',
        error: errorText,
      });
      setChatState(nextState);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Processar ação do usuário (seja digitação ou clique em resposta rápida)
  const handleUserAction = (type: 'INPUT' | 'QUICK_REPLY', value: string) => {
    if (!value.trim() && type === 'INPUT') return;
    if (isSubmitting || isTyping) return;

    setErrorMessage(null);

    // Efeito sutil de digitação do anfitrião
    setIsTyping(true);

    const { nextState, error } = processChatAction(chatState, { type, value });

    if (error) {
      setIsTyping(false);
      setErrorMessage(error);
      return;
    }

    setInputValue('');

    setTimeout(() => {
      setIsTyping(false);
      setChatState(nextState);

      // Se o usuário acabou de confirmar no passo CONFIRMACAO
      if (
        chatState.currentStep === 'CONFIRMACAO' &&
        nextState.data.consentimento_lgpd === true &&
        nextState.currentStep !== 'FINALIZADO'
      ) {
        handleFinalSubmit(nextState);
      }
    }, 450);
  };

  const handleSubmitInput = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    handleUserAction('INPUT', inputValue);
  };

  const handleQuickReplyClick = (reply: QuickReply) => {
    handleUserAction('QUICK_REPLY', reply.value);
  };

  const handleRestart = () => {
    if (confirm('Deseja reiniciar a conversa do acolhimento?')) {
      setChatState(createInitialChatState(context));
      setInputValue('');
      setErrorMessage(null);
      setSubmitSuccess(false);
    }
  };

  // Máscara dinâmica no input de telefone
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (chatState.currentStep === 'TELEFONE') {
      // Se não for comando de pular, aplica máscara
      if (!val.toLowerCase().startsWith('p')) {
        setInputValue(formatPhone(val));
        return;
      }
    }
    setInputValue(val);
  };

  // Obter placeholder dinâmico
  const getInputPlaceholder = () => {
    switch (chatState.currentStep) {
      case 'NOME':
        return 'Digite seu nome completo...';
      case 'TELEFONE':
        return 'Digite seu WhatsApp com DDD...';
      case 'BAIRRO':
        return 'Digite o bairro onde mora...';
      case 'PRIMEIRA_VISITA':
        return 'Toque em uma das opções acima...';
      case 'PEDIDO_ORACAO':
        return 'Escreva seu pedido ou motivo de oração...';
      case 'CONFIRMACAO':
        return 'Toque em Confirmar ou Corrigir...';
      default:
        return 'Digite sua mensagem...';
    }
  };

  // Última mensagem do anfitrião para exibir quick replies ativas
  const lastBotMessage = [...chatState.messages]
    .reverse()
    .find((m) => m.sender === 'bot');

  const showQuickReplies =
    !isTyping &&
    !isSubmitting &&
    !submitSuccess &&
    lastBotMessage?.quickReplies &&
    lastBotMessage.quickReplies.length > 0 &&
    chatState.currentStep !== 'FINALIZADO';

  return (
    <div className="flex flex-col h-[100dvh] max-w-lg mx-auto bg-slate-50 shadow-2xl relative overflow-hidden border-x border-slate-200">
      {/* Top Header */}
      <header className="bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 text-white px-4 py-3 shadow-md flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center border border-white/20 shadow-inner">
              <Church className="w-5 h-5 text-blue-200" />
            </div>
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-400 border-2 border-blue-900 rounded-full animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="font-semibold text-sm sm:text-base leading-tight">
                {context.igrejaNome || 'Gestão Eklésia'}
              </h1>
              <span className="inline-flex items-center px-1.5 py-0.2 text-[10px] font-medium bg-blue-500/30 text-blue-200 rounded border border-blue-400/30">
                Acolhimento
              </span>
            </div>
            <p className="text-xs text-blue-200/90 truncate max-w-[230px] sm:max-w-[280px]">
              {context.congregacaoNome ? `${context.congregacaoNome}` : 'Boas-vindas'}
              {context.tipoCulto ? ` • ${context.tipoCulto}` : ''}
            </p>
          </div>
        </div>

        <button
          onClick={handleRestart}
          title="Reiniciar atendimento"
          aria-label="Reiniciar atendimento"
          className="p-2 text-blue-200 hover:text-white hover:bg-white/10 rounded-full transition-colors active:scale-95"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </header>

      {/* Área do Chat */}
      <main className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-100/70">
        <div className="text-center my-1">
          <span className="inline-flex items-center gap-1 px-3 py-1 bg-white/80 border border-slate-200 text-slate-500 text-[11px] rounded-full shadow-xs">
            <ShieldCheck className="w-3 h-3 text-emerald-600" /> Canal seguro de acolhimento oficial
          </span>
        </div>

        {chatState.messages.map((message) => {
          const isBot = message.sender === 'bot';
          return (
            <div
              key={message.id}
              className={`flex flex-col ${isBot ? 'items-start' : 'items-end'} transition-all`}
            >
              <div
                className={`max-w-[85%] sm:max-w-[80%] rounded-2xl px-4 py-3 shadow-xs text-sm sm:text-[15px] leading-relaxed whitespace-pre-wrap ${
                  isBot
                    ? 'bg-white text-slate-800 border border-slate-200/90 rounded-tl-xs font-normal'
                    : 'bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-tr-xs font-medium shadow-sm'
                }`}
              >
                {message.text}
              </div>
              <span className="text-[10px] text-slate-400 mt-1 px-1">
                {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          );
        })}

        {/* Indicador de Digitação do Anfitrião */}
        {isTyping && (
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-2xl rounded-tl-xs px-4 py-2.5 w-fit shadow-xs animate-pulse">
            <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
            <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
            <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></span>
            <span className="text-xs text-slate-400 ml-1.5">Digitando...</span>
          </div>
        )}

        {/* Indicador de envio em andamento */}
        {isSubmitting && (
          <div className="flex items-center justify-center gap-2 py-3 px-4 bg-blue-50 border border-blue-200 rounded-xl text-blue-800 text-xs font-medium animate-pulse">
            <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
            Salvando seu acolhimento com carinho...
          </div>
        )}

        {/* Mensagem de Erro com Alerta */}
        {errorMessage && (
          <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
            <div className="flex-1 font-medium">{errorMessage}</div>
          </div>
        )}

        {/* Card de Boas-Vindas em Sucesso */}
        {submitSuccess && (
          <div className="mt-4 p-5 bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl shadow-sm text-center">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3 shadow-inner">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h3 className="font-semibold text-emerald-950 text-base mb-1">
              Registro Concluído!
            </h3>
            <p className="text-xs text-emerald-800 leading-relaxed max-w-xs mx-auto mb-4">
              Agradecemos de coração pela sua visita. Que este culto seja um canal de bênçãos na sua vida e na sua família!
            </p>
            <div className="inline-flex items-center gap-1.5 text-xs text-emerald-700 font-medium bg-emerald-100/70 px-3 py-1.5 rounded-full">
              <Heart className="w-3.5 h-3.5 fill-emerald-600 text-emerald-600" />
              Você é sempre bem-vindo(a)!
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </main>

      {/* Botões de Resposta Rápida (Quick Replies) */}
      {showQuickReplies && (
        <div className="px-4 py-2 bg-slate-50/95 border-t border-slate-200/80 flex flex-wrap gap-2 justify-center transition-all">
          {lastBotMessage?.quickReplies?.map((reply) => (
            <button
              key={reply.id}
              onClick={() => handleQuickReplyClick(reply)}
              className="px-3.5 py-2 text-xs sm:text-sm font-medium bg-white text-blue-700 border border-blue-200 hover:border-blue-400 hover:bg-blue-50/80 active:scale-95 rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-3 h-3 text-blue-500" />
              {reply.label}
            </button>
          ))}
        </div>
      )}

      {/* Input de Digitação Inferior */}
      {chatState.currentStep !== 'FINALIZADO' && !submitSuccess && (
        <footer className="p-3 bg-white border-t border-slate-200 z-10">
          <form onSubmit={handleSubmitInput} className="flex items-center gap-2">
            <input
              ref={inputRef}
              type={chatState.currentStep === 'TELEFONE' ? 'tel' : 'text'}
              value={inputValue}
              onChange={handleInputChange}
              placeholder={getInputPlaceholder()}
              disabled={isSubmitting || isTyping}
              className="flex-1 bg-slate-100 text-slate-800 text-sm px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all placeholder:text-slate-400"
            />
            <button
              type="submit"
              disabled={!inputValue.trim() || isSubmitting || isTyping}
              aria-label="Enviar mensagem"
              className="p-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:hover:bg-blue-600 text-white rounded-xl shadow-sm transition-all active:scale-95 cursor-pointer disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>

          <p className="text-[10px] text-center text-slate-400 mt-2 flex items-center justify-center gap-1">
            <ShieldCheck className="w-3 h-3 text-slate-400" />
            Seus dados são protegidos e tratados em conformidade com a LGPD
          </p>
        </footer>
      )}
    </div>
  );
}
