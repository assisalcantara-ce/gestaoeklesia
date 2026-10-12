'use client';

import { use, useEffect, useState } from 'react';
import { Loader2, AlertCircle, Church, RefreshCw } from 'lucide-react';
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
  };
  error?: string;
  code?: string;
}

export default function PublicAcolhimentoChatPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const resolvedParams = use(params);
  const token = resolvedParams.token;

  const [loading, setLoading] = useState(true);
  const [errorInfo, setErrorInfo] = useState<{ message: string; code?: string } | null>(null);
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
        });
        return;
      }

      setCultoContext({
        tipoCulto: data.culto.tipo_culto,
        dataCulto: data.culto.data_culto,
        horarioCulto: data.culto.horario_culto,
        congregacaoNome: data.culto.congregacao_nome,
        igrejaNome: data.culto.igreja_nome,
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

  // 2. Estado de Erro (Token inválido, expirado, culto encerrado)
  if (errorInfo || !cultoContext) {
    return (
      <div className="min-h-[100dvh] bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl text-center border border-slate-200">
          <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-amber-200">
            <AlertCircle className="w-8 h-8" />
          </div>

          <h2 className="text-slate-900 font-bold text-lg sm:text-xl mb-2">
            Link Não Disponível
          </h2>

          <p className="text-slate-600 text-xs sm:text-sm leading-relaxed mb-6">
            {errorInfo?.message || 'Este link de acolhimento não está mais disponível ou expirou.'}
          </p>

          <div className="p-3.5 bg-blue-50/70 border border-blue-100 rounded-2xl mb-6 text-left flex items-start gap-3">
            <Church className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-900 leading-normal">
              Está participando do culto? Procure os recepcionistas na entrada do templo para ser acolhido(a) pessoalmente!
            </p>
          </div>

          <button
            onClick={fetchCultoData}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white rounded-xl font-medium text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            Tentar Novamente
          </button>
        </div>
      </div>
    );
  }

  // 3. Estado Sucesso: Renderiza o Chat Conversacional
  return <ChatAcolhimento token={token} context={cultoContext} />;
}
