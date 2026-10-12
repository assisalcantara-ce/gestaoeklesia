'use client';

import { use, useEffect, useState } from 'react';
import {
  Loader2,
  Church,
  RefreshCw,
  Calendar,
  Clock,
  MessageCircle,
  ChevronRight,
  Smartphone,
  ExternalLink,
  Lock,
} from 'lucide-react';
import ChatAcolhimento from './ChatAcolhimento';
import { ChatCultoContext, isValidAppUrl } from '@/lib/acolhimento-chat-states';

interface PublicCultoResponse {
  valido: boolean;
  culto?: {
    tipo_culto: string;
    data_culto: string;
    horario_culto: string;
    congregacao_nome: string;
    igreja_nome: string;
    logo_url?: string | null;
    app_url?: string | null;
  };
  error?: string;
  code?: string;
  app_url?: string | null;
  igreja_nome?: string;
  logo_url?: string | null;
}

function formatarDataExtenso(dataStr?: string): string {
  if (!dataStr) return '';
  try {
    const parts = dataStr.split('-');
    if (parts.length === 3) {
      const ano = parseInt(parts[0], 10);
      const mes = parseInt(parts[1], 10) - 1;
      const dia = parseInt(parts[2], 10);
      const d = new Date(ano, mes, dia, 12, 0, 0);
      return new Intl.DateTimeFormat('pt-BR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(d);
    }
    return dataStr;
  } catch {
    return dataStr;
  }
}

export default function PublicAcolhimentoChatPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const resolvedParams = use(params);
  const token = resolvedParams.token;

  const [loading, setLoading] = useState(true);
  const [chatIniciado, setChatIniciado] = useState(false);
  const [errorInfo, setErrorInfo] = useState<{
    message: string;
    code?: string;
    appUrl?: string | null;
    igrejaNome?: string;
    logoUrl?: string | null;
  } | null>(null);
  const [cultoContext, setCultoContext] = useState<ChatCultoContext | null>(null);

  const fetchCultoData = async () => {
    if (!token) {
      setErrorInfo({
        message: 'Link de acolhimento inválido ou ausente.',
        code: 'TOKEN_INVALIDO',
      });
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorInfo(null);

    try {
      const res = await fetch(`/api/v1/public/acolhimento/${encodeURIComponent(token)}`, {
        cache: 'no-store',
      });

      const data: PublicCultoResponse = await res.json().catch(() => ({
        valido: false,
        error: 'Resposta inválida do servidor.',
      }));

      if (!res.ok || !data.valido || !data.culto) {
        setErrorInfo({
          message: data.error || 'Este link de acolhimento não está disponível.',
          code: data.code,
          appUrl: data.app_url || null,
          igrejaNome: data.igreja_nome || 'Gestão Eklésia',
          logoUrl: data.logo_url || null,
        });
        return;
      }

      const resolvedAppUrl = data.culto.app_url || data.app_url || null;

      setCultoContext({
        tipoCulto: data.culto.tipo_culto,
        dataCulto: data.culto.data_culto,
        horarioCulto: data.culto.horario_culto,
        congregacaoNome: data.culto.congregacao_nome,
        igrejaNome: data.culto.igreja_nome,
        logoUrl: data.culto.logo_url || null,
        appUrl: resolvedAppUrl,
        app_url: resolvedAppUrl,
      });
    } catch (err) {
      console.error('[PublicAcolhimento] Erro ao carregar dados:', err);
      setErrorInfo({
        message: 'Não foi possível carregar as informações do culto. Verifique sua conexão e tente novamente.',
        code: 'NETWORK_ERROR',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCultoData();
  }, [token]);

  // 1. Estado de Carregamento
  if (loading) {
    return (
      <div className="min-h-[100dvh] w-full flex items-center justify-center p-4 bg-[#0A2E63] bg-[url('/img/BG_acolhimento.png')] bg-cover bg-top bg-no-repeat">
        <div className="bg-slate-900/60 backdrop-blur-md border border-white/20 rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center shadow-inner">
            <Loader2 className="w-8 h-8 text-sky-400 animate-spin" />
          </div>
          <div>
            <h2 className="text-white font-semibold text-lg">Iniciando Acolhimento...</h2>
            <p className="text-blue-100/80 text-xs mt-1">Conectando ao canal oficial da congregação</p>
          </div>
        </div>
      </div>
    );
  }

  // 2. Estado de Erro / Expiração (Culto encerrado, passado ou token expirado)
  if (errorInfo || !cultoContext) {
    const isEncerradoOuPassado =
      errorInfo?.code === 'CULTO_ENCERRADO' ||
      errorInfo?.code === 'CULTO_PASSADO' ||
      errorInfo?.code === 'TOKEN_EXPIRADO' ||
      errorInfo?.code === 'TOKEN_INATIVO';

    const appUrl = errorInfo?.appUrl;
    const igrejaNome = errorInfo?.igrejaNome || 'Gestão Eklésia';
    const logoUrl = errorInfo?.logoUrl;

    return (
      <div className="min-h-[100dvh] w-full flex items-center justify-center p-4 sm:p-6 bg-[#0A2E63] bg-[url('/img/BG_acolhimento.png')] bg-cover bg-top bg-no-repeat">
        <div className="bg-white/95 backdrop-blur-md rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl text-center border border-slate-100">
          {/* Logo da Igreja se disponível */}
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={igrejaNome}
              className="w-16 h-16 rounded-2xl object-cover mx-auto mb-4 border border-slate-200 shadow-md bg-slate-50"
            />
          ) : (
            <img
              src="/img/logoh.png"
              alt="Gestão Eklésia"
              className="h-12 w-auto object-contain mx-auto mb-4 drop-shadow-sm"
            />
          )}

          <p className="text-[11px] uppercase tracking-wider font-extrabold text-[#062E6F] mb-1">
            {igrejaNome}
          </p>

          <h2 className="text-slate-900 font-bold text-lg sm:text-xl mb-3">
            {isEncerradoOuPassado ? 'Acolhimento Encerrado' : 'Link Não Disponível'}
          </h2>

          <p className="text-slate-600 text-xs sm:text-sm leading-relaxed mb-6">
            {errorInfo?.message || 'A janela de acolhimento para este culto já foi encerrada.'}
          </p>

          {/* Convite para o Aplicativo Oficial quando configurado e validado */}
          {isValidAppUrl(appUrl) ? (
            <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl mb-6 text-left">
              <div className="flex items-center gap-2 mb-2">
                <Smartphone className="w-5 h-5 text-blue-700" />
                <h3 className="text-xs font-semibold text-blue-950">
                  Fique Conectado(a) com a Igreja
                </h3>
              </div>
              <p className="text-xs text-blue-900/90 leading-relaxed mb-4">
                Acesse o aplicativo oficial para acompanhar estudos, escalas, avisos e mensagens da congregação!
              </p>
              <a
                href={appUrl.trim()}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3.5 px-4 bg-gradient-to-r from-[#0066FF] to-[#0052CC] hover:from-[#005AE6] hover:to-[#0047B3] text-white rounded-xl font-medium text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-2 active:scale-98"
              >
                <Smartphone className="w-4 h-4 text-blue-200" />
                <span>Acessar Aplicativo Oficial</span>
                <ExternalLink className="w-3.5 h-3.5 text-blue-200" />
              </a>
            </div>
          ) : (
            <div className="p-3.5 bg-blue-50/70 border border-blue-100 rounded-2xl mb-6 text-left flex items-start gap-3">
              <Church className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
              <p className="text-xs text-blue-900 leading-normal">
                Agradecemos grandemente por sua visita! Procure nossos recepcionistas na entrada para ser acolhido(a) pessoalmente.
              </p>
            </div>
          )}

          {!isEncerradoOuPassado && (
            <button
              onClick={fetchCultoData}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white rounded-xl font-medium text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              Tentar Novamente
            </button>
          )}
        </div>
      </div>
    );
  }

  // 3. Landing Pública de Apresentação (com o fundo oficial e layout fiel à referência)
  if (!chatIniciado) {
    const dataFormatada = formatarDataExtenso(cultoContext.dataCulto);
    const igrejaNomeExibicao = cultoContext.igrejaNome || 'IEADMI — ASSEMBLEIA DE DEUS DE MISSÕES';
    const congregacaoNomeExibicao = cultoContext.congregacaoNome || 'TEMPLO CENTRAL';

    return (
      <div className="min-h-[100dvh] w-full flex flex-col justify-between bg-[#0A2E63] bg-[url('/img/BG_acolhimento.png')] bg-cover bg-top bg-no-repeat overflow-x-hidden">
        <div className="max-w-md w-full mx-auto px-4 py-3 sm:py-5 flex flex-col min-h-[100dvh] justify-between">
          {/* Topo / Cabeçalho Institucional Reorganizado */}
          <header className="pt-2 sm:pt-3 w-full shrink-0">
            <div className="bg-white/90 backdrop-blur-md px-3.5 py-2.5 rounded-2xl shadow-md border border-white/80 flex items-center gap-3">
              {/* Logomarca da igreja à esquerda */}
              <div className="shrink-0 flex items-center justify-center">
                {cultoContext.logoUrl ? (
                  <img
                    src={cultoContext.logoUrl}
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

          {/* Espaço flexível para valorizar a fotografia */}
          <div className="h-20 sm:h-28 md:h-32 pointer-events-none" aria-hidden="true" />

          {/* Bloco Central: Seja muito bem-vindo(a)! */}
          <main className="flex flex-col text-center">
            <div className="px-2 mb-4 sm:mb-6">
              <h1 className="text-3xl sm:text-[38px] font-black text-white tracking-tight leading-[1.1] drop-shadow-md">
                Seja muito<br />
                <span className="text-[#38BDF8]">bem-vindo(a)!</span>
              </h1>

              {/* Traço decorativo dourado */}
              <div className="w-12 h-1 bg-amber-400 rounded-full mx-auto my-2.5 shadow-sm" />

              <p className="text-white font-bold text-sm sm:text-base leading-snug drop-shadow-sm">
                É uma alegria receber você em nossa casa.
              </p>
              <p className="text-blue-100/90 text-[11px] sm:text-xs mt-1 max-w-[270px] sm:max-w-xs mx-auto leading-relaxed drop-shadow-sm">
                Queremos conhecer você e tornar sua visita ainda mais especial.
              </p>
            </div>

            {/* Card Branco com Informações do Culto */}
            <div className="bg-white rounded-3xl p-4 sm:p-5 shadow-2xl border border-white/70 space-y-3 mb-3 text-left">
              {/* CULTO */}
              <div className="flex items-center gap-3.5 pb-2.5 border-b border-slate-100">
                <div className="w-11 h-11 rounded-2xl bg-[#E0F2FE] text-[#0284C7] flex items-center justify-center shrink-0">
                  <Church className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                    CULTO
                  </span>
                  <span className="text-slate-900 font-extrabold text-sm sm:text-base leading-tight block truncate">
                    {cultoContext.tipoCulto || 'Culto de Celebração'}
                  </span>
                </div>
              </div>

              {/* DATA */}
              <div className={`flex items-center gap-3.5 ${cultoContext.horarioCulto ? 'pb-2.5 border-b border-slate-100' : ''}`}>
                <div className="w-11 h-11 rounded-2xl bg-[#E0F2FE] text-[#0284C7] flex items-center justify-center shrink-0">
                  <Calendar className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                    DATA
                  </span>
                  <span className="text-slate-900 font-extrabold text-sm sm:text-base leading-tight block capitalize truncate">
                    {dataFormatada}
                  </span>
                </div>
              </div>

              {/* HORÁRIO (se disponível) */}
              {cultoContext.horarioCulto && (
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-2xl bg-[#E0F2FE] text-[#0284C7] flex items-center justify-center shrink-0">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                      HORÁRIO
                    </span>
                    <span className="text-slate-900 font-extrabold text-sm sm:text-base leading-tight block">
                      {cultoContext.horarioCulto}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Botão de Ação: Iniciar meu acolhimento */}
            <button
              onClick={() => setChatIniciado(true)}
              className="w-full py-4 px-5 bg-gradient-to-r from-[#0066FF] to-[#0052CC] hover:from-[#005AE6] hover:to-[#0047B3] active:scale-[0.98] text-white rounded-2xl font-bold text-sm sm:text-base shadow-xl shadow-blue-600/30 transition-all flex items-center justify-between cursor-pointer group mb-3"
            >
              <div className="flex items-center gap-2.5">
                <MessageCircle className="w-5 h-5 text-white/90 group-hover:scale-110 transition-transform" />
                <span>Iniciar meu acolhimento</span>
              </div>
              <ChevronRight className="w-5 h-5 text-white/90 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </main>

          {/* Rodapé Seguro LGPD */}
          <footer className="pb-2 text-center">
            <div className="flex items-center justify-center gap-2.5 py-1 text-slate-500 text-left max-w-xs mx-auto">
              <div className="w-7 h-7 rounded-lg bg-blue-100/70 text-blue-700 flex items-center justify-center shrink-0">
                <Lock className="w-3.5 h-3.5" />
              </div>
              <p className="text-[11px] leading-tight text-slate-600 font-medium">
                Seus dados são protegidos e tratados em conformidade com a LGPD.
              </p>
            </div>
          </footer>
        </div>
      </div>
    );
  }

  // 4. Estado Ativo: Renderiza o Chat Conversacional Guiado
  return <ChatAcolhimento token={token} context={cultoContext} />;
}
