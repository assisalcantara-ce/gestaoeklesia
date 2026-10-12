'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Send,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Sparkles,
  ShieldCheck,
  Heart,
  Church,
  Smartphone,
  ExternalLink,
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
  const [isSearchingPhone, setIsSearchingPhone] = useState(false);
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

  // Identificação assíncrona por telefone no backend
  const consultarIdentificacaoTelefone = async (stateComTelefone: ChatState, rawTelefone: string) => {
    setIsTyping(true);
    setIsSearchingPhone(true);
    try {
      const res = await fetch(`/api/v1/public/acolhimento/${encodeURIComponent(token)}/identificar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefone: rawTelefone }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.encontrado) {
        const { nextState } = processChatAction(stateComTelefone, {
          type: 'IDENTIFIED_VISITANTE',
          payload: {
            encontrado: true,
            recorrente: true,
            nome: data.nome,
            bairro: data.bairro,
            ambiguo: data.ambiguo || false,
          },
        });
        setChatState(nextState);
      } else {
        // Novo visitante ou não encontrado
        const { nextState } = processChatAction(stateComTelefone, {
          type: 'IDENTIFIED_VISITANTE',
          payload: {
            encontrado: false,
            recorrente: false,
          },
        });
        setChatState(nextState);
      }
    } catch {
      // Em caso de falha na consulta, avança como novo visitante sem travar a conversa
      const { nextState } = processChatAction(stateComTelefone, {
        type: 'IDENTIFIED_VISITANTE',
        payload: {
          encontrado: false,
          recorrente: false,
        },
      });
      setChatState(nextState);
    } finally {
      setIsTyping(false);
      setIsSearchingPhone(false);
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

    // Se o usuário acabou de fornecer um número de telefone na etapa TELEFONE
    if (chatState.currentStep === 'TELEFONE' && nextState.data.telefone) {
      setChatState(nextState);
      consultarIdentificacaoTelefone(nextState, value);
      return;
    }

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
      case 'TELEFONE':
        return 'Digite seu WhatsApp com DDD...';
      case 'CONFIRMAR_RECORRENTE':
        return 'Toque em Sim ou Não acima...';
      case 'NOME':
        return 'Digite seu nome completo...';
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
            {context.logoUrl ? (
              <img
                src={context.logoUrl}
                alt={context.igrejaNome || 'Logo'}
                className="w-10 h-10 rounded-full object-cover border border-white/20 shadow-inner bg-white/10"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center border border-white/20 shadow-inner">
                <Church className="w-5 h-5 text-blue-200" />
              </div>
            )}
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-400 border-2 border-blue-900 rounded-full animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-sm tracking-tight">Agente de Acolhimento</span>
              <span className="bg-blue-500/30 text-blue-200 text-[10px] px-1.5 py-0.5 rounded-full font-medium">
                Online
              </span>
            </div>
            <p className="text-[11px] text-blue-200/90 truncate max-w-[210px] sm:max-w-xs">
              {context.congregacaoNome || context.igrejaNome || 'Gestão Eklésia'}
            </p>
          </div>
        </div>

        {/* Botão de reiniciar conversa */}
        {chatState.currentStep !== 'FINALIZADO' && !submitSuccess && (
          <button
            onClick={handleRestart}
            title="Recomeçar acolhimento"
            className="p-2 text-blue-200 hover:text-white hover:bg-white/10 rounded-xl transition-all cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        )}
      </header>

      {/* Área Central de Conversa (Chat Messages) */}
      <main className="flex-1 overflow-y-auto p-4 space-y-3.5 scroll-smooth">
        {chatState.messages.map((msg) => {
          const isBot = msg.sender === 'bot';
          return (
            <div
              key={msg.id}
              className={`flex items-end gap-2.5 ${isBot ? 'justify-start' : 'justify-end'}`}
            >
              {isBot && (
                <div className="w-8 h-8 rounded-full bg-blue-700 text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-sm border border-blue-400/30">
                  🙏
                </div>
              )}
              <div
                className={`max-w-[85%] sm:max-w-[80%] rounded-2xl px-4 py-3 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap shadow-xs transition-all ${
                  isBot
                    ? 'bg-white text-slate-800 border border-slate-200/90 rounded-bl-xs'
                    : 'bg-blue-600 text-white rounded-br-xs font-normal shadow-blue-500/10'
                }`}
              >
                {msg.text}
              </div>
            </div>
          );
        })}

        {/* Indicador de Digitação do Bot ou Consulta de Telefone */}
        {isTyping && (
          <div className="flex items-center gap-2 text-slate-400 text-xs py-1 animate-pulse">
            <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            </div>
            <span className="italic text-[11px] text-slate-500">
              {isSearchingPhone
                ? 'Consultando cadastro com carinho... 🔍'
                : 'Anfitrião digitando...'}
            </span>
          </div>
        )}

        {/* Mensagem de Erro Contextual */}
        {errorMessage && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl text-xs flex items-center gap-2 animate-shake">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Card de Boas-Vindas em Sucesso com Botão do Aplicativo */}
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

            <div className="inline-flex items-center gap-1.5 text-xs text-emerald-700 font-medium bg-emerald-100/70 px-3 py-1.5 rounded-full mb-4">
              <Heart className="w-3.5 h-3.5 fill-emerald-600 text-emerald-600" />
              Você é sempre bem-vindo(a)!
            </div>

            {/* Botão de Acesso ao Aplicativo Oficial (exibido somente quando configurado) */}
            {context.appUrl && context.appUrl.trim() && (
              <div className="pt-3 border-t border-emerald-200/80 mt-2">
                <a
                  href={context.appUrl.trim()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 px-4 bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-800 hover:to-indigo-800 text-white font-medium text-xs sm:text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 active:scale-98"
                >
                  <Smartphone className="w-4 h-4 text-blue-200" />
                  <span>Acessar Aplicativo da Igreja</span>
                  <ExternalLink className="w-3.5 h-3.5 text-blue-200" />
                </a>
                <p className="text-[10px] text-emerald-700/80 mt-1.5">
                  Acompanhe avisos, estudos e eventos da igreja pelo app oficial
                </p>
              </div>
            )}
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
