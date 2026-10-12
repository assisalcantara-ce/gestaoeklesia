'use client';

import { use, useEffect, useState } from 'react';
import {
  Loader2,
  AlertCircle,
  Church,
  RefreshCw,
  Calendar,
  Clock,
  MapPin,
  Heart,
  MessageCircle,
  Smartphone,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';
import ChatAcolhimento from './ChatAcolhimento';
import { ChatCultoContext } from '@/lib/acolhimento-chat-states';

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

      setCultoContext({
        tipoCulto: data.culto.tipo_culto,
        dataCulto: data.culto.data_culto,
        horarioCulto: data.culto.horario_culto,
        congregacaoNome: data.culto.congregacao_nome,
        igrejaNome: data.culto.igreja_nome,
        logoUrl: data.culto.logo_url || null,
        appUrl: data.culto.app_url || null,
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
      <div className="min-h-[100dvh] bg-gradient-to-br from-[#062E6F] via-[#0A4499] to-[#1565C0] flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center shadow-inner">
            <Loader2 className="w-8 h-8 text-white animate-spin" />
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
      <div className="min-h-[100dvh] bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4 sm:p-6">
        <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl text-center border border-slate-200">
          {/* Logo da Igreja se disponível */}
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={igrejaNome}
              className="w-16 h-16 rounded-2xl object-cover mx-auto mb-4 border border-slate-200 shadow-md bg-slate-50"
            />
          ) : (
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 border ${
              isEncerradoOuPassado
                ? 'bg-blue-50 text-blue-700 border-blue-200'
                : 'bg-amber-50 text-amber-600 border-amber-200'
            }`}>
              {isEncerradoOuPassado ? <Church className="w-7 h-7" /> : <AlertCircle className="w-7 h-7" />}
            </div>
          )}

          <p className="text-xs uppercase tracking-wider font-semibold text-blue-700 mb-1">
            {igrejaNome}
          </p>

          <h2 className="text-slate-900 font-bold text-lg sm:text-xl mb-3">
            {isEncerradoOuPassado ? 'Acolhimento Encerrado' : 'Link Não Disponível'}
          </h2>

          <p className="text-slate-600 text-xs sm:text-sm leading-relaxed mb-6">
            {errorInfo?.message || 'A janela de acolhimento para este culto já foi encerrada.'}
          </p>

          {/* Convite para o Aplicativo Oficial quando configurado */}
          {appUrl && appUrl.trim() ? (
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
                className="w-full py-3 px-4 bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-800 hover:to-indigo-800 text-white rounded-xl font-medium text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-2 active:scale-98"
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

  // 3. Landing Pública de Apresentação (antes de iniciar o chat)
  if (!chatIniciado) {
    const dataFormatada = formatarDataExtenso(cultoContext.dataCulto);

    return (
      <div className="min-h-[100dvh] bg-gradient-to-br from-slate-900 via-[#0A2E63] to-slate-950 flex flex-col justify-between p-4 sm:p-6 text-slate-100">
        {/* Topo / Identidade Visual */}
        <header className="max-w-md w-full mx-auto pt-4 sm:pt-8 text-center flex flex-col items-center">
          {cultoContext.logoUrl ? (
            <img
              src={cultoContext.logoUrl}
              alt={cultoContext.igrejaNome || 'Logo'}
              className="w-20 h-20 rounded-3xl object-cover mb-4 shadow-xl border-2 border-white/20 bg-white/10 backdrop-blur-md"
            />
          ) : (
            <div className="w-16 h-16 rounded-3xl bg-blue-600/30 border border-blue-400/40 backdrop-blur-md flex items-center justify-center mb-4 shadow-xl text-blue-200">
              <Church className="w-8 h-8" />
            </div>
          )}

          <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-300/90 bg-blue-950/60 border border-blue-800/60 px-3 py-1 rounded-full mb-2">
            Canal Oficial de Acolhimento
          </span>

          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            {cultoContext.igrejaNome || 'Gestão Eklésia'}
          </h1>
          <p className="text-xs sm:text-sm text-blue-200/80 mt-1 flex items-center justify-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            {cultoContext.congregacaoNome || 'Congregação Local'}
          </p>
        </header>

        {/* Card Central com Informações do Culto */}
        <main className="max-w-md w-full mx-auto my-6 bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-6 sm:p-7 shadow-2xl text-center">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mx-auto mb-4 text-white shadow-lg shadow-blue-500/20">
            <Heart className="w-6 h-6 fill-white/20" />
          </div>

          <h2 className="text-lg sm:text-xl font-bold text-white mb-2">
            Seja muito bem-vindo(a)!
          </h2>

          <p className="text-xs sm:text-sm text-blue-100/90 leading-relaxed mb-6">
            Preparamos este espaço exclusivo para receber você com todo o amor da nossa igreja.
            É uma honra enorme ter você conosco!
          </p>

          {/* Detalhes do Culto de Hoje */}
          <div className="bg-black/25 border border-white/10 rounded-2xl p-4 text-left space-y-2.5 mb-6">
            <div className="flex items-center gap-2.5 text-xs text-blue-100">
              <Church className="w-4 h-4 text-blue-300 shrink-0" />
              <span className="font-semibold text-white">{cultoContext.tipoCulto || 'Culto de Celebração'}</span>
            </div>

            {dataFormatada && (
              <div className="flex items-center gap-2.5 text-xs text-blue-200/90 capitalize">
                <Calendar className="w-4 h-4 text-blue-400 shrink-0" />
                <span>{dataFormatada}</span>
              </div>
            )}

            {cultoContext.horarioCulto && (
              <div className="flex items-center gap-2.5 text-xs text-blue-200/90">
                <Clock className="w-4 h-4 text-blue-400 shrink-0" />
                <span>Horário: {cultoContext.horarioCulto}</span>
              </div>
            )}
          </div>

          {/* Botão de Iniciar Acolhimento */}
          <button
            onClick={() => setChatIniciado(true)}
            className="w-full py-4 px-6 bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 active:scale-98 text-white rounded-2xl font-bold text-sm sm:text-base shadow-xl shadow-blue-500/25 transition-all flex items-center justify-center gap-2.5 cursor-pointer group"
          >
            <MessageCircle className="w-5 h-5 text-blue-200 group-hover:scale-110 transition-transform" />
            <span>Iniciar meu acolhimento</span>
          </button>
        </main>

        {/* Rodapé Seguro LGPD */}
        <footer className="max-w-md w-full mx-auto pb-4 text-center">
          <p className="text-[11px] text-blue-200/60 flex items-center justify-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
            Seus dados são protegidos e tratados em conformidade com a LGPD
          </p>
        </footer>
      </div>
    );
  }

  // 4. Estado Ativo: Renderiza o Chat Conversacional Guiado
  return <ChatAcolhimento token={token} context={cultoContext} />;
}
