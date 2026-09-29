'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import PageLayout from '@/components/PageLayout';
import { useRequireModulo } from '@/hooks/useRequireModulo';
import { usePlanFeatures } from '@/hooks/usePlanFeatures';
import { createClient } from '@/lib/supabase-client';
import {
  ArrowLeft,
  Search,
  AlertTriangle,
  CheckCircle2,
  FileText,
  UserCheck,
  RefreshCw,
  Eye,
  Paperclip,
  Clock,
  Send,
  Mail,
  AlertCircle,
  Settings,
  MailCheck,
  Check,
  RotateCw,
} from 'lucide-react';

const formatarTamanhoArquivo = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

interface FaltaItem {
  id: string;
  reuniao_id: string;
  participante_id: string;
  member_id: string;
  ministry_id: string;
  data_geracao_falta: string;
  situacao: 'registrada' | 'justificada' | 'abonada';
  gerada_por?: string | null;
  reunioes?: {
    id: string;
    titulo: string;
    data_reuniao: string;
    horario_inicio: string;
    local: string;
    status?: string;
    congregacao_id?: string | null;
  } | null;
  members?: {
    id: string;
    name: string;
    email?: string | null;
  } | null;
  reunioes_participantes?: {
    id: string;
    nome_ministro_snapshot: string;
    cargo_snapshot: string;
    nome_congregacao_snapshot: string | null;
    congregacao_id_snapshot: string | null;
    area_snapshot: string | null;
    status_presenca: string;
  } | null;
  reunioes_justificativas?: Array<{
    id: string;
    tipo_justificativa: string;
    motivo: string;
    anexo_documento_url?: string | null;
    registrado_em: string;
    registrado_por?: string | null;
  }>;
  reunioes_advertencias?: Array<{
    id: string;
    numero_protocolo: string;
    status_envio: string;
    email_destinatario?: string | null;
    erro_mensagem?: string | null;
    enviada_em?: string | null;
    pdf_url?: string | null;
  }>;
}

export default function FaltasJustificativasPage() {
  const { ctx, bloqueado } = useRequireModulo('reunioes');
  const planFeatures = usePlanFeatures();

  // Estados de dados
  const [loading, setLoading] = useState(true);
  const [faltas, setFaltas] = useState<FaltaItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [filtroSituacao, setFiltroSituacao] = useState<string>('todas');
  const [filtroBusca, setFiltroBusca] = useState<string>('');
  const [filtroDataInicio, setFiltroDataInicio] = useState<string>('');
  const [filtroDataFim, setFiltroDataFim] = useState<string>('');

  // Modais
  const [faltaSelecionada, setFaltaSelecionada] = useState<FaltaItem | null>(null);
  const [modalDetalhesAberto, setModalDetalhesAberto] = useState(false);
  const [modalJustificarAberto, setModalJustificarAberto] = useState(false);
  const [modalAbonarAberto, setModalAbonarAberto] = useState(false);

  // Modal de Confirmação de Envio Individual
  const [modalConfirmarEnvioAberto, setModalConfirmarEnvioAberto] = useState(false);
  const [faltaParaEnvio, setFaltaParaEnvio] = useState<FaltaItem | null>(null);
  const [emailDestinoEdicao, setEmailDestinoEdicao] = useState<string>('');

  // Modal de Envio em Massa
  const [modalEnvioMassaAberto, setModalEnvioMassaAberto] = useState(false);
  const [incluirReenviosMassa, setIncluirReenviosMassa] = useState(false);
  const [processandoMassa, setProcessandoMassa] = useState(false);
  const [resultadoMassa, setResultadoMassa] = useState<{
    mensagem: string;
    resumo: {
      total_processados: number;
      enviadas: number;
      reenviadas: number;
      sem_email: number;
      falhas: number;
      ignoradas: number;
    };
  } | null>(null);

  // Estado de envio individual
  const [enviandoEmail, setEnviandoEmail] = useState<boolean>(false);
  const [feedbackEnvio, setFeedbackEnvio] = useState<{
    tipo: 'sucesso' | 'erro';
    texto: string;
  } | null>(null);

  // Formulário de Justificativa
  const [tipoJustificativa, setTipoJustificativa] = useState<string>('manuscrita_secretaria');
  const [motivoJustificativa, setMotivoJustificativa] = useState<string>('');
  const [arquivoAnexo, setArquivoAnexo] = useState<File | null>(null);
  const [erroArquivo, setErroArquivo] = useState<string | null>(null);
  const [enviandoAnexo, setEnviandoAnexo] = useState<boolean>(false);
  const [salvando, setSalvando] = useState<boolean>(false);
  const [motivoAbono, setMotivoAbono] = useState<string>('');

  const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB
  const EXTENSOES_PERMITIDAS = ['pdf', 'jpg', 'jpeg', 'png'];

  const handleSelecionarArquivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setErroArquivo(null);

    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (!EXTENSOES_PERMITIDAS.includes(ext)) {
      setErroArquivo('Formato inválido. Selecione um arquivo PDF, JPG ou PNG.');
      setArquivoAnexo(null);
      return;
    }

    if (file.size > MAX_FILE_BYTES) {
      setErroArquivo('O arquivo não pode exceder 5 MB.');
      setArquivoAnexo(null);
      return;
    }

    setArquivoAnexo(file);
  };

  // Helper de Autenticação
  const fetchAutenticado = useCallback(async (url: string, options: RequestInit = {}) => {
    const supabase = createClient();
    const { data: { session }, error: sessionErr } = await supabase.auth.getSession();

    if (sessionErr || !session?.access_token) {
      throw new Error('Sessão expirada ou não autenticada. Faça login novamente.');
    }

    const headers = new Headers(options.headers || {});
    headers.set('Authorization', `Bearer ${session.access_token}`);

    return fetch(url, {
      ...options,
      headers,
    });
  }, []);

  // 1. Carregar Listagem de Faltas
  const carregarFaltas = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (filtroSituacao !== 'todas') params.append('situacao', filtroSituacao);
      if (filtroDataInicio) params.append('data_inicio', filtroDataInicio);
      if (filtroDataFim) params.append('data_fim', filtroDataFim);

      const res = await fetchAutenticado(`/api/v1/reunioes/faltas?${params.toString()}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao consultar faltas ministeriais.');
      }

      setFaltas(data.faltas || []);
    } catch (err: any) {
      setError(err?.message || 'Falha de comunicação com o servidor.');
    } finally {
      setLoading(false);
    }
  }, [filtroSituacao, filtroDataInicio, filtroDataFim, fetchAutenticado]);

  useEffect(() => {
    if (!bloqueado) {
      carregarFaltas();
    }
  }, [bloqueado, carregarFaltas]);

  const abrirDetalhes = (falta: FaltaItem) => {
    setFaltaSelecionada(falta);
    setFeedbackEnvio(null);
    setModalDetalhesAberto(true);
  };

  // Abrir modal para envio individual
  const abrirConfirmacaoEnvio = (falta: FaltaItem) => {
    setFaltaParaEnvio(falta);
    const emailInicial = falta.reunioes_advertencias?.[0]?.email_destinatario || falta.members?.email || '';
    setEmailDestinoEdicao(emailInicial);
    setFeedbackEnvio(null);
    setModalConfirmarEnvioAberto(true);
  };

  // Executar envio individual confirmado
  const executarEnvioIndividual = async () => {
    if (!faltaParaEnvio) return;
    setEnviandoEmail(true);
    setFeedbackEnvio(null);

    try {
      // Obter ou criar advertência se ainda não existir
      let advertenciaId = faltaParaEnvio.reunioes_advertencias?.[0]?.id;

      if (!advertenciaId) {
        // Se ainda não existia advertência, dispara a criação via endpoint em massa para 1 id
        const resCriar = await fetchAutenticado('/api/v1/reunioes/advertencias/enviar-massa', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            falta_ids: [faltaParaEnvio.id],
            incluir_reenvios: true,
          }),
        });
        const dataCriar = await resCriar.json();
        if (!resCriar.ok || dataCriar.resumo?.falhas > 0) {
          throw new Error(dataCriar.mensagem || 'Falha ao despachar advertência.');
        }

        setFeedbackEnvio({
          tipo: 'sucesso',
          texto: 'Carta de advertência gerada e enviada com sucesso.',
        });
        await carregarFaltas();
        setModalConfirmarEnvioAberto(false);
        return;
      }

      const res = await fetchAutenticado(`/api/v1/reunioes/advertencias/${advertenciaId}/enviar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          forcar_reenvio: true,
          email_destinatario: emailDestinoEdicao.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.sucesso) {
        throw new Error(data.error || data.detail || 'Falha ao despachar e-mail da advertência.');
      }

      setFeedbackEnvio({
        tipo: 'sucesso',
        texto: 'Carta de advertência enviada com sucesso.',
      });

      await carregarFaltas();
      setModalConfirmarEnvioAberto(false);
    } catch (err: any) {
      setFeedbackEnvio({
        tipo: 'erro',
        texto: err?.message || 'Erro inesperado ao enviar e-mail.',
      });
    } finally {
      setEnviandoEmail(false);
    }
  };

  // Executar envio em massa
  const executarEnvioMassa = async () => {
    setProcessandoMassa(true);
    setResultadoMassa(null);

    try {
      const res = await fetchAutenticado('/api/v1/reunioes/advertencias/enviar-massa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          incluir_reenvios: incluirReenviosMassa,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao processar envio em lote.');
      }

      setResultadoMassa({
        mensagem: data.mensagem,
        resumo: data.resumo,
      });

      await carregarFaltas();
    } catch (err: any) {
      alert(err?.message || 'Falha no processamento em massa.');
    } finally {
      setProcessandoMassa(false);
    }
  };

  // 2. Filtro Local por Texto (Ministro / Congregação / Reunião)
  const faltasFiltradas = useMemo(() => {
    if (!filtroBusca.trim()) return faltas;
    const term = filtroBusca.toLowerCase().trim();
    return faltas.filter((f) => {
      const nome = f.reunioes_participantes?.nome_ministro_snapshot?.toLowerCase() || '';
      const cargo = f.reunioes_participantes?.cargo_snapshot?.toLowerCase() || '';
      const cong = f.reunioes_participantes?.nome_congregacao_snapshot?.toLowerCase() || '';
      const reuniao = f.reunioes?.titulo?.toLowerCase() || '';
      return nome.includes(term) || cargo.includes(term) || cong.includes(term) || reuniao.includes(term);
    });
  }, [faltas, filtroBusca]);

  // Contagens para o envio em massa
  const estatisticasMassa = useMemo(() => {
    const naoJustificadas = faltas.filter((f) => f.situacao === 'registrada');
    const totalNaoJustificadas = naoJustificadas.length;

    let comEmail = 0;
    let semEmail = 0;
    let jaEnviadas = 0;
    let pendentesEnvio = 0;

    for (const f of naoJustificadas) {
      const email = f.reunioes_advertencias?.[0]?.email_destinatario || f.members?.email;
      if (email && email.includes('@')) {
        comEmail++;
      } else {
        semEmail++;
      }

      const adv = f.reunioes_advertencias?.[0];
      if (adv?.status_envio === 'enviada') {
        jaEnviadas++;
      } else {
        pendentesEnvio++;
      }
    }

    return {
      totalNaoJustificadas,
      comEmail,
      semEmail,
      jaEnviadas,
      pendentesEnvio,
    };
  }, [faltas]);

  // 3. Salvar Justificativa
  const salvarJustificativa = async () => {
    if (!faltaSelecionada || !motivoJustificativa.trim() || salvando) return;

    try {
      setSalvando(true);
      setErroArquivo(null);

      let urlAnexo: string | null = null;

      if (arquivoAnexo) {
        setEnviandoAnexo(true);
        const formData = new FormData();
        formData.append('file', arquivoAnexo);
        formData.append('falta_id', faltaSelecionada.id);

        const uploadRes = await fetchAutenticado('/api/v1/reunioes/faltas/anexo', {
          method: 'POST',
          body: formData,
        });

        const uploadData = await uploadRes.json();
        if (!uploadRes.ok || !uploadData.url) {
          throw new Error(uploadData.error || 'Erro ao enviar anexo da justificativa.');
        }

        urlAnexo = uploadData.url;
        setEnviandoAnexo(false);
      }

      const res = await fetchAutenticado(`/api/v1/reunioes/faltas/${faltaSelecionada.id}/justificar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo_justificativa: tipoJustificativa,
          motivo: motivoJustificativa.trim(),
          anexo_documento_url: urlAnexo,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao salvar justificativa.');
      }

      setFaltas((prev) =>
        prev.map((f) =>
          f.id === faltaSelecionada.id
            ? {
                ...f,
                situacao: 'justificada',
                reunioes_justificativas: [data.justificativa, ...(f.reunioes_justificativas || [])],
              }
            : f
        )
      );

      setModalJustificarAberto(false);
      setMotivoJustificativa('');
      setArquivoAnexo(null);
      setErroArquivo(null);
      setFaltaSelecionada(null);
    } catch (err: any) {
      alert(err?.message || 'Erro ao registrar justificativa.');
    } finally {
      setSalvando(false);
      setEnviandoAnexo(false);
    }
  };

  // 4. Salvar Abono
  const salvarAbono = async () => {
    if (!faltaSelecionada || salvando) return;

    try {
      setSalvando(true);
      const res = await fetchAutenticado(`/api/v1/reunioes/faltas/${faltaSelecionada.id}/abonar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          motivo_abono: motivoAbono.trim() || 'Abonado pela Secretaria Geral',
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao abonar falta.');
      }

      setFaltas((prev) =>
        prev.map((f) => (f.id === faltaSelecionada.id ? { ...f, situacao: 'abonada' } : f))
      );

      setModalAbonarAberto(false);
      setMotivoAbono('');
      setFaltaSelecionada(null);
    } catch (err: any) {
      alert(err?.message || 'Erro ao abonar falta.');
    } finally {
      setSalvando(false);
    }
  };

  // Contadores de Resumo
  const totalRegistradas = useMemo(() => faltas.filter((f) => f.situacao === 'registrada').length, [faltas]);
  const totalJustificadas = useMemo(() => faltas.filter((f) => f.situacao === 'justificada').length, [faltas]);
  const totalAbonadas = useMemo(() => faltas.filter((f) => f.situacao === 'abonada').length, [faltas]);

  if (bloqueado) return null;

  if (ctx.loading || planFeatures.loading) {
    return (
      <PageLayout title="Faltas e Justificativas" description="Gestão de ausências e justificativas ministeriais" activeMenu="reunioes">
        <div className="flex flex-col items-center justify-center p-20 text-slate-500 gap-3">
          <RefreshCw className="w-7 h-7 animate-spin text-teal-600" />
          <span className="text-sm font-semibold">Carregando prontuário de faltas...</span>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title="Faltas e Justificativas"
      description="Prontuário de ausências ministeriais, justificativas e envio de Cartas de Advertência pela Secretaria Geral"
      activeMenu="reunioes"
      headerExtra={
        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/reunioes"
            className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold rounded-xl transition border border-slate-200 shadow-sm active:scale-95"
          >
            <ArrowLeft className="w-4 h-4 text-slate-600" />
            <span>Voltar para Reuniões</span>
          </Link>

          <Link
            href="/reunioes/configuracoes"
            className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold rounded-xl transition border border-slate-200 shadow-sm active:scale-95"
            title="Configurar textos da Carta de Advertência"
          >
            <Settings className="w-4 h-4 text-slate-600" />
            <span>Configurações</span>
          </Link>

          <button
            onClick={carregarFaltas}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-xl transition border border-slate-300 shadow-sm active:scale-95"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Atualizar Lista</span>
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* ─── Cards de Resumo Executivo ─── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 flex flex-col justify-between group">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 text-xs font-bold uppercase tracking-wider">Total de Faltas</span>
              <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 border border-slate-200/80 flex items-center justify-center group-hover:scale-105 transition">
                <FileText className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <p className="text-3xl font-black text-slate-900 tracking-tight leading-none">{faltas.length}</p>
              <p className="text-[11px] text-slate-500 font-medium mt-1.5 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-slate-400" />
                Histórico geral registrado
              </p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 flex flex-col justify-between group">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 text-xs font-bold uppercase tracking-wider">Não Justificadas</span>
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-700 border border-rose-100/80 flex items-center justify-center group-hover:scale-105 transition">
                <AlertTriangle className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <p className="text-3xl font-black text-rose-700 tracking-tight leading-none">{totalRegistradas}</p>
              <p className="text-[11px] text-rose-600 font-medium mt-1.5 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                Elegíveis para advertência
              </p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 flex flex-col justify-between group">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 text-xs font-bold uppercase tracking-wider">Justificadas</span>
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 border border-amber-100/80 flex items-center justify-center group-hover:scale-105 transition">
                <Clock className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <p className="text-3xl font-black text-amber-700 tracking-tight leading-none">{totalJustificadas}</p>
              <p className="text-[11px] text-amber-700 font-medium mt-1.5 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                Comprovantes validados
              </p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 flex flex-col justify-between group">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 text-xs font-bold uppercase tracking-wider">Abonadas</span>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100/80 flex items-center justify-center group-hover:scale-105 transition">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <p className="text-3xl font-black text-emerald-700 tracking-tight leading-none">{totalAbonadas}</p>
              <p className="text-[11px] text-emerald-700 font-medium mt-1.5 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Secretaria Geral
              </p>
            </div>
          </div>
        </div>

        {/* ─── Barra de Filtros e Ação em Massa ─── */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            {/* Filtros */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 flex-1">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar por ministro, congregação ou reunião..."
                  value={filtroBusca}
                  onChange={(e) => setFiltroBusca(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <select
                  value={filtroSituacao}
                  onChange={(e) => setFiltroSituacao(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-teal-500 font-medium"
                >
                  <option value="todas">Todas as Situações</option>
                  <option value="registrada">Não Justificadas (Registradas)</option>
                  <option value="justificada">Justificadas</option>
                  <option value="abonada">Abonadas</option>
                </select>
              </div>

              <div>
                <input
                  type="date"
                  value={filtroDataInicio}
                  onChange={(e) => setFiltroDataInicio(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-teal-500"
                  title="Data inicial"
                />
              </div>

              <div>
                <input
                  type="date"
                  value={filtroDataFim}
                  onChange={(e) => setFiltroDataFim(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-teal-500"
                  title="Data final"
                />
              </div>
            </div>

            {/* Ação de Envio em Massa */}
            <div className="flex-shrink-0 pt-1 lg:pt-0">
              <button
                type="button"
                onClick={() => {
                  setResultadoMassa(null);
                  setModalEnvioMassaAberto(true);
                }}
                disabled={estatisticasMassa.totalNaoJustificadas === 0}
                className="w-full lg:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-500 hover:to-teal-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl shadow transition active:scale-95 border border-teal-500/30"
              >
                <MailCheck className="w-4 h-4" />
                <span>Enviar Cartas de Advertência</span>
                {estatisticasMassa.pendentesEnvio > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-white/20 text-white text-[10px] font-black">
                    {estatisticasMassa.pendentesEnvio}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* ─── Tabela de Faltas ─── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-slate-400 space-y-3">
              <div className="w-8 h-8 border-4 border-teal-500/30 border-t-teal-500 rounded-full animate-spin mx-auto" />
              <p className="text-sm">Carregando prontuário de faltas...</p>
            </div>
          ) : error ? (
            <div className="p-8 text-center text-rose-500 space-y-2">
              <AlertTriangle className="w-8 h-8 mx-auto" />
              <p className="text-sm font-semibold">{error}</p>
            </div>
          ) : faltasFiltradas.length === 0 ? (
            <div className="p-12 text-center text-slate-400 space-y-2">
              <UserCheck className="w-12 h-12 text-slate-300 mx-auto" />
              <p className="text-base font-bold text-slate-700">Nenhuma falta encontrada</p>
              <p className="text-xs text-slate-500">Nenhum registro corresponde aos filtros selecionados.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold text-xs uppercase tracking-wider">
                  <tr>
                    <th className="py-3.5 px-4">Ministro</th>
                    <th className="py-3.5 px-4">Congregação</th>
                    <th className="py-3.5 px-4">Reunião Convocada</th>
                    <th className="py-3.5 px-4">Data Falta</th>
                    <th className="py-3.5 px-4">Situação</th>
                    <th className="py-3.5 px-4">Status Advertência</th>
                    <th className="py-3.5 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {faltasFiltradas.map((falta) => {
                    const p = falta.reunioes_participantes;
                    const r = falta.reunioes;
                    const adv = falta.reunioes_advertencias?.[0];

                    return (
                      <tr key={falta.id} className="hover:bg-slate-50/80 transition">
                        {/* Ministro */}
                        <td className="py-3.5 px-4">
                          <p className="font-bold text-slate-900">{p?.nome_ministro_snapshot || 'Ministro'}</p>
                          <p className="text-xs text-slate-500">{p?.cargo_snapshot || 'Ministro'}</p>
                        </td>

                        {/* Congregação */}
                        <td className="py-3.5 px-4 text-slate-700">
                          <p className="text-xs font-semibold">{p?.nome_congregacao_snapshot || 'Sede'}</p>
                          {p?.area_snapshot && <p className="text-[11px] text-slate-400">{p.area_snapshot}</p>}
                        </td>

                        {/* Reunião */}
                        <td className="py-3.5 px-4">
                          <p className="font-semibold text-slate-800 line-clamp-1">{r?.titulo || 'Reunião'}</p>
                          <p className="text-xs text-slate-500">
                            {r?.data_reuniao ? new Date(r.data_reuniao + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}
                          </p>
                        </td>

                        {/* Data Falta */}
                        <td className="py-3.5 px-4 text-xs text-slate-600">
                          {new Date(falta.data_geracao_falta).toLocaleDateString('pt-BR')}
                        </td>

                        {/* Situação */}
                        <td className="py-3.5 px-4">
                          {falta.situacao === 'registrada' && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 text-xs font-bold border border-rose-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                              Não Justificada
                            </span>
                          )}
                          {falta.situacao === 'justificada' && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-bold border border-amber-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                              Justificada
                            </span>
                          )}
                          {falta.situacao === 'abonada' && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              Abonada
                            </span>
                          )}
                        </td>

                        {/* Status da Advertência */}
                        <td className="py-3.5 px-4 text-xs">
                          {falta.situacao !== 'registrada' ? (
                            <span className="text-slate-400 italic text-[11px]">—</span>
                          ) : adv?.status_envio === 'enviada' ? (
                            <div className="space-y-0.5">
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                Advertência Enviada
                              </span>
                              {adv.enviada_em && (
                                <p className="text-[10px] text-slate-400">
                                  {new Date(adv.enviada_em).toLocaleDateString('pt-BR')} às {new Date(adv.enviada_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                </p>
                              )}
                            </div>
                          ) : adv?.status_envio === 'erro_envio' ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200" title={adv.erro_mensagem || 'Erro de envio'}>
                              <AlertCircle className="w-3 h-3 text-rose-600" />
                              Falha no Envio
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                              <Clock className="w-3 h-3 text-slate-500" />
                              Advertência Pendente
                            </span>
                          )}
                        </td>

                        {/* Coluna AÇÕES */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                            {/* Detalhes (Sempre presente) */}
                            <button
                              onClick={() => abrirDetalhes(falta)}
                              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition inline-flex items-center gap-1 active:scale-95"
                              title="Ver prontuário"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              Detalhes
                            </button>

                            {/* Caso: Justificada */}
                            {falta.situacao === 'justificada' && (
                              <button
                                onClick={() => abrirDetalhes(falta)}
                                className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-xs font-bold transition inline-flex items-center gap-1 active:scale-95"
                              >
                                <Paperclip className="w-3.5 h-3.5" />
                                Justificativa
                              </button>
                            )}

                            {/* Caso: Não Justificada (Registrada) */}
                            {falta.situacao === 'registrada' && (
                              <>
                                <button
                                  onClick={() => {
                                    setFaltaSelecionada(falta);
                                    setModalJustificarAberto(true);
                                  }}
                                  className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg text-xs font-bold transition active:scale-95"
                                >
                                  Justificar
                                </button>

                                <button
                                  onClick={() => {
                                    setFaltaSelecionada(falta);
                                    setModalAbonarAberto(true);
                                  }}
                                  className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-bold transition active:scale-95"
                                >
                                  Abonar
                                </button>

                                {/* Ações de Envio da Carta */}
                                {adv?.status_envio === 'enviada' ? (
                                  <>
                                    <button
                                      onClick={() => abrirConfirmacaoEnvio(falta)}
                                      className="px-2.5 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-300 rounded-lg text-xs font-bold transition inline-flex items-center gap-1 active:scale-95"
                                      title="Reenviar carta por e-mail"
                                    >
                                      <RotateCw className="w-3 h-3 text-teal-700" />
                                      Reenviar
                                    </button>

                                    <a
                                      href={`/api/v1/reunioes/advertencias/${adv.id}/pdf`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold transition inline-flex items-center gap-1 active:scale-95"
                                      title="Visualizar PDF da Carta"
                                    >
                                      <FileText className="w-3.5 h-3.5 text-slate-600" />
                                      Ver Carta
                                    </a>
                                  </>
                                ) : (
                                  <button
                                    onClick={() => abrirConfirmacaoEnvio(falta)}
                                    className="px-2.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold transition shadow-xs inline-flex items-center gap-1 active:scale-95"
                                  >
                                    <Send className="w-3 h-3" />
                                    Enviar Carta
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ─── MODAL: CONFIRMAR ENVIO INDIVIDUAL DE ADVERTÊNCIA ─── */}
      {modalConfirmarEnvioAberto && faltaParaEnvio && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <Send className="w-5 h-5 text-teal-600" />
                <h2 className="text-base font-bold text-slate-800">
                  {faltaParaEnvio.reunioes_advertencias?.[0]?.status_envio === 'enviada'
                    ? 'Reenviar Carta de Advertência'
                    : 'Enviar Carta de Advertência'}
                </h2>
              </div>
              <button
                onClick={() => setModalConfirmarEnvioAberto(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1">
                <span className="text-slate-400 font-bold text-[10px] uppercase">Ministro Destinatário</span>
                <p className="text-sm font-black text-slate-900">
                  {faltaParaEnvio.reunioes_participantes?.nome_ministro_snapshot}
                </p>
                <p className="text-slate-600">
                  {faltaParaEnvio.reunioes_participantes?.cargo_snapshot} • {faltaParaEnvio.reunioes_participantes?.nome_congregacao_snapshot || 'Sede'}
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <span className="text-slate-400 font-bold text-[10px] uppercase">Reunião Referente</span>
                <p className="font-bold text-slate-800">{faltaParaEnvio.reunioes?.titulo}</p>
                <p className="text-slate-500">
                  Data: {faltaParaEnvio.reunioes?.data_reuniao ? new Date(faltaParaEnvio.reunioes.data_reuniao + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}
                </p>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">E-mail do Ministro (Destinatário):</label>
                <input
                  type="email"
                  value={emailDestinoEdicao}
                  onChange={(e) => setEmailDestinoEdicao(e.target.value)}
                  placeholder="exemplo@email.com"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl text-[11px] text-teal-900 leading-relaxed space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-teal-700" />
                  Geração Dinâmica Oficial
                </p>
                <p>
                  A carta será gerada automaticamente com o logotipo institucional e os textos normativos configurados pelo seu ministério.
                </p>
              </div>

              {feedbackEnvio && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-start gap-2 ${
                    feedbackEnvio.tipo === 'sucesso'
                      ? 'bg-emerald-50 border border-emerald-200 text-emerald-800 font-medium'
                      : 'bg-rose-50 border border-rose-200 text-rose-800'
                  }`}
                >
                  {feedbackEnvio.tipo === 'sucesso' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">{feedbackEnvio.texto}</div>
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setModalConfirmarEnvioAberto(false)}
                className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={executarEnvioIndividual}
                disabled={enviandoEmail || !emailDestinoEdicao.includes('@')}
                className="flex-1 py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow transition flex items-center justify-center gap-1.5"
              >
                {enviandoEmail ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Enviando...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Confirmar e Enviar</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: ENVIO EM MASSA DE CARTAS ─── */}
      {modalEnvioMassaAberto && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <MailCheck className="w-5 h-5 text-teal-600" />
                <h2 className="text-base font-bold text-slate-800">Envio de Cartas em Lote</h2>
              </div>
              <button
                onClick={() => setModalEnvioMassaAberto(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs text-slate-600">
              <p className="leading-relaxed text-slate-700">
                A Secretaria Geral pode despachar as cartas de advertência em lote para todas as faltas não justificadas de reuniões encerradas.
              </p>

              {/* Quadro de Auditoria Pré-Envio */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Total Faltosos</span>
                  <p className="text-xl font-black text-slate-900 mt-0.5">{estatisticasMassa.totalNaoJustificadas}</p>
                </div>
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <span className="text-[10px] font-bold uppercase text-emerald-700">Com E-mail Válido</span>
                  <p className="text-xl font-black text-emerald-800 mt-0.5">{estatisticasMassa.comEmail}</p>
                </div>
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl">
                  <span className="text-[10px] font-bold uppercase text-rose-700">Sem E-mail Cadastrado</span>
                  <p className="text-xl font-black text-rose-800 mt-0.5">{estatisticasMassa.semEmail}</p>
                </div>
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <span className="text-[10px] font-bold uppercase text-amber-700">Já Enviadas Anteriormente</span>
                  <p className="text-xl font-black text-amber-800 mt-0.5">{estatisticasMassa.jaEnviadas}</p>
                </div>
              </div>

              {/* Opção de Incluir Reenvios */}
              <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 transition cursor-pointer">
                <input
                  type="checkbox"
                  checked={incluirReenviosMassa}
                  onChange={(e) => setIncluirReenviosMassa(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                />
                <div>
                  <span className="font-bold text-slate-800 block text-xs">Incluir reenvios</span>
                  <span className="text-[11px] text-slate-500 leading-tight block mt-0.5">
                    Se marcado, enviará novamente mesmo para os ministros que já receberam a carta anteriormente.
                  </span>
                </div>
              </label>

              {/* Resultado pós-processamento */}
              {resultadoMassa && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
                  <p className="text-xs font-bold text-emerald-900">{resultadoMassa.mensagem}</p>
                  <div className="grid grid-cols-4 gap-2 text-center text-[10px] font-bold pt-1">
                    <div className="bg-white p-1.5 rounded border border-emerald-200">
                      <span className="text-emerald-700 block">{resultadoMassa.resumo.enviadas}</span>
                      <span className="text-slate-500">Enviadas</span>
                    </div>
                    <div className="bg-white p-1.5 rounded border border-emerald-200">
                      <span className="text-teal-700 block">{resultadoMassa.resumo.reenviadas}</span>
                      <span className="text-slate-500">Reenviadas</span>
                    </div>
                    <div className="bg-white p-1.5 rounded border border-emerald-200">
                      <span className="text-amber-700 block">{resultadoMassa.resumo.sem_email}</span>
                      <span className="text-slate-500">Sem e-mail</span>
                    </div>
                    <div className="bg-white p-1.5 rounded border border-emerald-200">
                      <span className="text-rose-700 block">{resultadoMassa.resumo.falhas}</span>
                      <span className="text-slate-500">Falhas</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setModalEnvioMassaAberto(false)}
                className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={executarEnvioMassa}
                disabled={processandoMassa || estatisticasMassa.comEmail === 0}
                className="flex-1 py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow transition flex items-center justify-center gap-1.5"
              >
                {processandoMassa ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Processando lote...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Disparar Lote</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: DETALHES DA FALTA & HISTÓRICO ─── */}
      {modalDetalhesAberto && faltaSelecionada && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-lg font-bold text-slate-800">Prontuário da Ausência</h2>
              <button onClick={() => setModalDetalhesAberto(false)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs text-slate-600">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-1">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Ministro</p>
                <p className="text-base font-black text-slate-900">
                  {faltaSelecionada.reunioes_participantes?.nome_ministro_snapshot}
                </p>
                <p className="text-slate-600">
                  {faltaSelecionada.reunioes_participantes?.cargo_snapshot} •{' '}
                  {faltaSelecionada.reunioes_participantes?.nome_congregacao_snapshot || 'Sede'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <p className="text-slate-400 font-bold uppercase text-[10px]">Reunião</p>
                  <p className="font-bold text-slate-800 mt-0.5">{faltaSelecionada.reunioes?.titulo}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <p className="text-slate-400 font-bold uppercase text-[10px]">Data do Evento</p>
                  <p className="font-bold text-slate-800 mt-0.5">
                    {faltaSelecionada.reunioes?.data_reuniao
                      ? new Date(faltaSelecionada.reunioes.data_reuniao + 'T00:00:00').toLocaleDateString('pt-BR')
                      : '—'}
                  </p>
                </div>
              </div>

              {/* Justificativas registradas */}
              <div className="border-t pt-3 space-y-2">
                <h3 className="font-bold text-slate-800 text-xs">Histórico de Justificativas</h3>
                {faltaSelecionada.reunioes_justificativas && faltaSelecionada.reunioes_justificativas.length > 0 ? (
                  faltaSelecionada.reunioes_justificativas.map((j) => (
                    <div key={j.id} className="p-3 bg-amber-50/60 border border-amber-200 rounded-xl space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-amber-900 uppercase text-[10px] tracking-wider">
                          Tipo: {j.tipo_justificativa}
                        </span>
                        <span className="text-[10px] text-amber-700">
                          {new Date(j.registrado_em).toLocaleString('pt-BR')}
                        </span>
                      </div>
                      <p className="text-xs text-amber-950">{j.motivo}</p>
                      {j.anexo_documento_url && (
                        <a
                          href={j.anexo_documento_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 hover:underline pt-1"
                        >
                          <Paperclip className="w-3 h-3" />
                          Ver Documento Anexo
                        </a>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-slate-400 text-xs italic">Nenhuma justificativa apresentada até o momento.</p>
                )}
              </div>

              {/* Advertência associada */}
              {faltaSelecionada.reunioes_advertencias && faltaSelecionada.reunioes_advertencias.length > 0 && (() => {
                const adv = faltaSelecionada.reunioes_advertencias[0];
                const emailDestino = adv.email_destinatario || faltaSelecionada.members?.email || '';

                return (
                  <div className="border-t pt-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                        Carta de Advertência Oficial
                      </h3>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                        Documento Gerado Eletronicamente
                      </span>
                    </div>

                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200/80">
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase">Protocolo Oficial</span>
                          <p className="font-black text-slate-900 text-sm">{adv.numero_protocolo}</p>
                        </div>

                        <div className="text-left sm:text-right">
                          <span className="text-[10px] font-bold text-slate-400 uppercase block">Status do Envio</span>
                          {adv.status_envio === 'enviada' ? (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-100/70 px-2.5 py-0.5 rounded-full border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3" />
                              Enviada {adv.enviada_em ? `em ${new Date(adv.enviada_em).toLocaleDateString('pt-BR')} às ${new Date(adv.enviada_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : ''}
                            </span>
                          ) : adv.status_envio === 'erro_envio' ? (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-700 bg-rose-100/70 px-2.5 py-0.5 rounded-full border border-rose-200">
                              <AlertCircle className="w-3 h-3" />
                              Erro no envio
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-600 bg-slate-200/70 px-2.5 py-0.5 rounded-full border border-slate-300">
                              <Clock className="w-3 h-3" />
                              Pendente
                            </span>
                          )}
                        </div>
                      </div>

                      {adv.status_envio === 'erro_envio' && adv.erro_mensagem && (
                        <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-[11px] text-rose-800 flex items-start gap-2">
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <strong className="block">Falha no envio anterior:</strong>
                            <span>{adv.erro_mensagem}</span>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-2 text-xs text-slate-700 bg-white p-2.5 rounded-xl border border-slate-200">
                        <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                        <div className="flex-1 truncate">
                          <span className="text-slate-400 text-[11px]">Destinatário: </span>
                          <strong className="text-slate-800">{emailDestino || 'E-mail não informado no cadastro do ministro'}</strong>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 pt-1">
                        <a
                          href={`/api/v1/reunioes/advertencias/${adv.id}/pdf`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 min-w-[130px] px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 border border-slate-300"
                        >
                          <FileText className="w-4 h-4 text-slate-600" />
                          Visualizar PDF
                        </a>

                        {faltaSelecionada.situacao === 'registrada' && (
                          <button
                            onClick={() => {
                              setModalDetalhesAberto(false);
                              abrirConfirmacaoEnvio(faltaSelecionada);
                            }}
                            className="flex-1 min-w-[150px] px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shadow transition flex items-center justify-center gap-1.5"
                          >
                            <Send className="w-4 h-4" />
                            <span>{adv.status_envio === 'enviada' ? 'Reenviar Carta' : 'Enviar Carta'}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            <button
              onClick={() => setModalDetalhesAberto(false)}
              className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition"
            >
              Fechar Prontuário
            </button>
          </div>
        </div>
      )}

      {/* ─── MODAL: JUSTIFICAR FALTA ─── */}
      {modalJustificarAberto && faltaSelecionada && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-base font-bold text-slate-800">Apresentar Justificativa</h2>
              <button onClick={() => setModalJustificarAberto(false)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Ministro</span>
                <p className="font-bold text-slate-900">{faltaSelecionada.reunioes_participantes?.nome_ministro_snapshot}</p>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Tipo de Justificativa</label>
                <select
                  value={tipoJustificativa}
                  onChange={(e) => setTipoJustificativa(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-800 bg-slate-50 focus:outline-none focus:border-teal-500"
                >
                  <option value="manuscrita_secretaria">Manuscrita entregue na Secretaria</option>
                  <option value="atestado_medico">Atestado Médico / Saúde</option>
                  <option value="trabalho">Compromisso Profissional / Trabalho</option>
                  <option value="viagem">Viagem Ministerial / Pessoal</option>
                  <option value="antecipada">Justificativa Prévia Antecipada</option>
                  <option value="outros">Outros Motivos</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Motivo / Fundamentação</label>
                <textarea
                  value={motivoJustificativa}
                  onChange={(e) => setMotivoJustificativa(e.target.value)}
                  rows={3}
                  placeholder="Descreva o motivo apresentado pelo ministro..."
                  className="w-full p-3 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Documento Comprobatório (Opcional - até 5MB)</label>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleSelecionarArquivo}
                  className="w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100"
                />
                {erroArquivo && <p className="text-rose-600 text-[11px] mt-1">{erroArquivo}</p>}
                {arquivoAnexo && (
                  <p className="text-slate-600 text-[11px] mt-1">
                    Selecionado: <strong>{arquivoAnexo.name}</strong> ({formatarTamanhoArquivo(arquivoAnexo.size)})
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setModalJustificarAberto(false)}
                className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={salvarJustificativa}
                disabled={salvando || enviandoAnexo || !motivoJustificativa.trim()}
                className="flex-1 py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow transition"
              >
                {salvando || enviandoAnexo ? 'Gravando...' : 'Salvar Justificativa'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: ABONAR FALTA ─── */}
      {modalAbonarAberto && faltaSelecionada && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-base font-bold text-slate-800">Abonar Falta Ministerial</h2>
              <button onClick={() => setModalAbonarAberto(false)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-slate-600 leading-relaxed">
                Tem certeza que deseja formalizar o <strong>abono institucional</strong> da falta de{' '}
                <strong>{faltaSelecionada.reunioes_participantes?.nome_ministro_snapshot}</strong>?
              </p>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Motivo do Abono (Opcional)</label>
                <input
                  type="text"
                  value={motivoAbono}
                  onChange={(e) => setMotivoAbono(e.target.value)}
                  placeholder="Ex: Deliberação da Mesa Diretora / Secretaria Geral"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-teal-500"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setModalAbonarAberto(false)}
                className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={salvarAbono}
                disabled={salvando}
                className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow transition"
              >
                {salvando ? 'Abonando...' : 'Confirmar Abono'}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  );
}
