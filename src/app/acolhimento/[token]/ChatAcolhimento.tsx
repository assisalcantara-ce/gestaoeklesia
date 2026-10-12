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
  ExternalLink,
} from 'lucide-react';
import {
  ChatCultoContext,
  ChatState,
  createInitialChatState,
  processChatAction,
  QuickReply,
  normalizeAppUrl,
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
    if (chatState.currentStep !== 'FINALIZADO' && !isSubmitting && !submitSuccess) {
      inputRef.current?.focus();
    }
  }, [chatState.currentStep, isSubmitting, submitSuccess]);

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
      setInputValue(formatPhone(val));
      return;
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

  // 1. Tela Final Dedicada de Acolhimento Concluído
  if (chatState.currentStep === 'FINALIZADO' || submitSuccess) {
    const rawAppUrl = context.appUrl || context.app_url;
    const targetAppUrl = normalizeAppUrl(rawAppUrl);
    const igrejaNomeExibicao = context.igrejaNome || 'IEADMI — ASSEMBLEIA DE DEUS DE MISSÕES';
    const congregacaoNomeExibicao = context.congregacaoNome || 'TEMPLO CENTRAL';

    const handleOpenApp = (e: React.MouseEvent<HTMLAnchorElement>) => {
      if (targetAppUrl) {
        e.preventDefault();
        try {
          window.open(targetAppUrl, '_blank', 'noopener,noreferrer');
        } catch {
          window.location.href = targetAppUrl;
        }
      }
    };

    return (
      <div className="min-h-[100dvh] w-full flex flex-col justify-between bg-[#0A2E63] bg-[url('/img/BG_acolhimento.png')] bg-cover bg-top bg-no-repeat overflow-x-hidden selection:bg-sky-500 selection:text-white">
        <div className="max-w-md w-full mx-auto px-4 py-3 sm:py-5 flex flex-col min-h-[100dvh] justify-between">
          {/* Topo / Cabeçalho Institucional Reorganizado */}
          <header className="pt-2 sm:pt-3 w-full shrink-0">
            <div className="bg-white/90 backdrop-blur-md px-3.5 py-2.5 rounded-2xl shadow-md border border-white/80 flex items-center gap-3">
              {/* Logomarca da igreja à esquerda */}
              <div className="shrink-0 flex items-center justify-center">
                {context.logoUrl ? (
                  <img
                    src={context.logoUrl}
                    alt={igrejaNomeExibicao}
                    className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl object-contain bg-white border border-slate-200/80 shadow-xs"
                  />
                ) : (
                  <img
                    src="/img/logoh.png"
                    alt="Gestão Eklésia"
                    className="h-9 sm:h-10 w-auto object-contain max-w-[85px] drop-shadow-xs"
                  />
                )}
              </div>

              {/* Nome do Ministério e Congregação ao lado */}
              <div className="flex flex-col min-w-0 flex-1 text-left">
                <h2 className="text-[#062E6F] text-xs sm:text-[13px] font-black tracking-tight uppercase leading-snug truncate">
                  {igrejaNomeExibicao}
                </h2>
                <p className="text-[#0066FF] text-[10px] sm:text-[11px] font-extrabold tracking-wider uppercase mt-0.5 truncate">
                  {congregacaoNomeExibicao}
                </p>
              </div>
            </div>
          </header>

          {/* Espaço livre superior para valorizar a fotografia */}
          <div className="h-6 sm:h-10 pointer-events-none" aria-hidden="true" />

          {/* Card Central de Sucesso Dedicado */}
          <main className="bg-white rounded-3xl p-5 sm:p-7 shadow-2xl border border-white/80 text-center my-auto">
            {/* Ícone de Sucesso */}
            <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-br from-emerald-400 to-teal-500 text-white rounded-3xl flex items-center justify-center mx-auto mb-3 sm:mb-4 shadow-lg shadow-emerald-500/25">
              <CheckCircle2 className="w-8 h-8 sm:w-9 sm:h-9" />
            </div>

            <h1 className="text-xl sm:text-2xl font-black text-slate-900 leading-tight mb-2">
              Acolhimento concluído!<br />
              <span className="text-[#0066FF]">Que alegria receber você!</span>
            </h1>

            {/* Traço decorativo dourado */}
            <div className="w-12 h-1 bg-amber-400 rounded-full mx-auto my-3 shadow-xs" />

            {/* Mensagem de agradecimento */}
            <p className="text-slate-700 text-xs sm:text-sm leading-relaxed mb-4">
              Agradecemos de coração pela sua visita hoje, <strong className="font-bold text-slate-900">{chatState.data.nome}</strong>! Que este culto seja um canal de grandes bênçãos na sua vida e na sua família.
            </p>

            {/* Botão Destacado do Aplicativo Oficial (abaixo da mensagem de agradecimento e antes das boas-vindas) */}
            {targetAppUrl && (
              <a
                href={targetAppUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleOpenApp}
                className="w-full py-3.5 px-4 my-3 bg-gradient-to-r from-[#0066FF] to-[#0052CC] hover:from-[#005AE6] hover:to-[#0047B3] text-white rounded-2xl font-bold text-xs sm:text-sm shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center gap-2 active:scale-98 cursor-pointer border border-blue-400/30"
              >
                <span>📱</span>
                <span>Acessar Aplicativo da Igreja</span>
                <ExternalLink className="w-3.5 h-3.5 text-white/80 shrink-0" />
              </a>
            )}

            {/* Card Institucional */}
            <div className="p-3.5 bg-blue-50/70 border border-blue-100 rounded-2xl text-left flex items-start gap-3 mb-4">
              <Church className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
              <p className="text-xs text-blue-900 leading-relaxed">
                Nossa congregação está de braços abertos para você e sua família. Sinta-se em casa em todos os nossos cultos!
              </p>
            </div>

            {/* Mensagem de boas-vindas final */}
            <div className="inline-flex items-center gap-1.5 text-xs text-emerald-700 font-semibold bg-emerald-50 px-3.5 py-1.5 rounded-full border border-emerald-200/60">
              <Heart className="w-3.5 h-3.5 fill-emerald-600 text-emerald-600" />
              Você é sempre bem-vindo(a)!
            </div>
          </main>

          {/* Rodapé Seguro LGPD */}
          <footer className="pb-1 sm:pb-2 text-center shrink-0">
            <p className="text-[11px] text-blue-200/80 flex items-center justify-center gap-1.5 font-medium drop-shadow-xs">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-300" />
              Seus dados são protegidos e tratados em conformidade com a LGPD
            </p>
          </footer>
        </div>
      </div>
    );
  }

  // 2. Chat Conversacional Ativo
  const lastBotMessage = [...chatState.messages]
    .reverse()
    .find((m) => m.sender === 'bot');

  const showQuickReplies =
    !isTyping &&
    !isSubmitting &&
    !submitSuccess &&
    lastBotMessage?.quickReplies &&
    lastBotMessage.quickReplies.length > 0;

  return (
    <div className="min-h-[100dvh] w-full flex flex-col justify-between bg-[#0A2E63] bg-[url('/img/BG_acolhimento.png')] bg-cover bg-top bg-no-repeat overflow-x-hidden selection:bg-sky-500 selection:text-white">
      <div className="max-w-md w-full mx-auto h-[100dvh] max-h-[100dvh] flex flex-col justify-between shadow-2xl bg-slate-950/40 backdrop-blur-xs relative overflow-hidden border-x border-white/10">
        {/* Top Header */}
        <header className="bg-[#0A2E63]/95 backdrop-blur-md text-white px-4 py-3 shadow-md flex items-center justify-between z-20 border-b border-white/10 shrink-0">
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
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-400 border-2 border-[#0A2E63] rounded-full animate-pulse" />
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
          {!submitSuccess && (
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
                  className={`max-w-[85%] sm:max-w-[80%] rounded-2xl px-4 py-3 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap shadow-sm transition-all ${
                    isBot
                      ? 'bg-white/95 text-slate-800 border border-white/80 rounded-bl-xs'
                      : 'bg-gradient-to-r from-[#0066FF] to-[#0052CC] text-white rounded-br-xs font-normal shadow-blue-500/10'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            );
          })}

          {/* Indicador de Digitação do Bot ou Consulta de Telefone */}
          {isTyping && (
            <div className="flex items-center gap-2 text-slate-300 text-xs py-1 animate-pulse">
              <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                <Sparkles className="w-3.5 h-3.5 text-sky-300" />
              </div>
              <span className="italic text-[11px] text-blue-100 bg-slate-900/40 px-2.5 py-1 rounded-full">
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

          <div ref={messagesEndRef} />
        </main>

        {/* Botões de Resposta Rápida (Quick Replies) */}
        {showQuickReplies && (
          <div className="px-4 py-2.5 bg-slate-900/60 backdrop-blur-md border-t border-white/10 flex flex-wrap gap-2 justify-center transition-all z-10">
            {lastBotMessage?.quickReplies?.map((reply) => (
              <button
                key={reply.id}
                onClick={() => handleQuickReplyClick(reply)}
                className="px-4 py-2 text-xs sm:text-sm font-semibold bg-white/95 hover:bg-white text-blue-700 border border-blue-200 active:scale-95 rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                {reply.label}
              </button>
            ))}
          </div>
        )}

        {/* Input de Digitação Inferior */}
        {!submitSuccess && (
          <footer className="p-3 bg-white/95 backdrop-blur-md border-t border-slate-200/80 z-20 shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
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
                className="p-2.5 bg-gradient-to-r from-[#0066FF] to-[#0052CC] hover:from-[#005AE6] hover:to-[#0047B3] disabled:opacity-40 text-white rounded-xl shadow-md transition-all active:scale-95 cursor-pointer disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>

            <p className="text-[10px] text-center text-slate-500 mt-2 flex items-center justify-center gap-1 font-medium">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
              Seus dados são protegidos e tratados em conformidade com a LGPD
            </p>
          </footer>
        )}
      </div>
    </div>
  );
}
