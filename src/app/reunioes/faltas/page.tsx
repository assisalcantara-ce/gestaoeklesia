'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import PageLayout from '@/components/PageLayout';
import { useRequireModulo } from '@/hooks/useRequireModulo';
import { usePlanFeatures } from '@/hooks/usePlanFeatures';
import { createClient } from '@/lib/supabase-client';
import {
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
  Upload,
  Trash2,
} from 'lucide-react';

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

  // Estado de envio de e-mail da advertência
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

  const formatarTamanhoArquivo = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

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

  // ─── Helper de Autenticação ───────────────────────────────────────────────
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

  // ─── 1. Carregar Listagem de Faltas ────────────────────────────────────────
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

  const handleEnviarEmailAdvertencia = async (advertenciaId: string) => {
    setEnviandoEmail(true);
    setFeedbackEnvio(null);

    try {
      const res = await fetchAutenticado(`/api/v1/reunioes/advertencias/${advertenciaId}/enviar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forcar_reenvio: true }),
      });

      const data = await res.json();

      if (!res.ok || !data.sucesso) {
        throw new Error(data.error || data.detail || 'Falha ao despachar e-mail da advertência.');
      }

      setFeedbackEnvio({
        tipo: 'sucesso',
        texto: 'Carta enviada com sucesso.',
      });

      // Recarregar faltas e atualizar faltaSelecionada
      const params = new URLSearchParams();
      if (filtroSituacao !== 'todas') params.append('situacao', filtroSituacao);
      if (filtroDataInicio) params.append('data_inicio', filtroDataInicio);
      if (filtroDataFim) params.append('data_fim', filtroDataFim);

      const resList = await fetchAutenticado(`/api/v1/reunioes/faltas?${params.toString()}`);
      const dataList = await resList.json();
      if (resList.ok && dataList.faltas) {
        setFaltas(dataList.faltas);
        const atualizada = dataList.faltas.find((f: FaltaItem) => f.id === faltaSelecionada?.id);
        if (atualizada) setFaltaSelecionada(atualizada);
      }
    } catch (err: any) {
      setFeedbackEnvio({
        tipo: 'erro',
        texto: err?.message || 'Erro inesperado ao enviar e-mail.',
      });
    } finally {
      setEnviandoEmail(false);
    }
  };

  // ─── 2. Filtro Local por Texto (Ministro / Congregação / Reunião) ──────────
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

  // ─── 3. Ação: Salvar Justificativa ─────────────────────────────────────────
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

      // Atualizar lista localmente
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

  // ─── 4. Ação: Salvar Abono ─────────────────────────────────────────────────
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

      // Atualizar lista localmente
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

  // ─── Contadores de Resumo ──────────────────────────────────────────────────
  const totalRegistradas = useMemo(() => faltas.filter((f) => f.situacao === 'registrada').length, [faltas]);
  const totalJustificadas = useMemo(() => faltas.filter((f) => f.situacao === 'justificada').length, [faltas]);
  const totalAbonadas = useMemo(() => faltas.filter((f) => f.situacao === 'abonada').length, [faltas]);

  if (ctx.loading || planFeatures.loading) {
    return (
      <PageLayout title="Faltas e Justificativas" description="Gestão de ausências e justificativas ministeriais" activeMenu="reunioes">
        <div className="flex items-center justify-center p-12 text-slate-500">Carregando módulo...</div>
      </PageLayout>
    );
  }

  if (!planFeatures.has_modulo_reunioes || !planFeatures.hasFeature('meetings_module')) {
    return (
      <PageLayout title="Faltas e Justificativas" description="Gestão de ausências e justificativas ministeriais" activeMenu="reunioes">
        <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm text-center max-w-2xl mx-auto space-y-4 my-8">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
          <h2 className="text-xl font-bold text-slate-800">Recurso Indisponível no seu Plano</h2>
          <p className="text-slate-600 text-sm">A gestão de faltas e justificativas ministeriais está disponível a partir do Plano Intermediário.</p>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title="Faltas e Justificativas"
      description="Prontuário de ausências ministeriais, justificativas e abonos da Secretaria Geral"
      activeMenu="reunioes"
      backHref="/reunioes"
      backLabel="Voltar para Reuniões"
      headerExtra={
        <div className="flex items-center gap-3">
          <button
            onClick={carregarFaltas}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-xl transition border border-slate-300 shadow-sm"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Atualizar Lista</span>
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* ─── Cards de Resumo ─── */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total de Faltas</p>
              <p className="text-2xl font-black text-slate-800 mt-0.5">{faltas.length}</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-rose-200 shadow-sm flex items-center gap-4 border-l-4 border-l-rose-500">
            <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-rose-600 uppercase tracking-wider">Não Justificadas</p>
              <p className="text-2xl font-black text-rose-700 mt-0.5">{totalRegistradas}</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-amber-200 shadow-sm flex items-center gap-4 border-l-4 border-l-amber-500">
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-amber-600 uppercase tracking-wider">Justificadas</p>
              <p className="text-2xl font-black text-amber-700 mt-0.5">{totalJustificadas}</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-emerald-200 shadow-sm flex items-center gap-4 border-l-4 border-l-emerald-500">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Abonadas</p>
              <p className="text-2xl font-black text-emerald-700 mt-0.5">{totalAbonadas}</p>
            </div>
          </div>
        </div>

        {/* ─── Barra de Filtros ─── */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-5 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por ministro, congregação ou reunião..."
                value={filtroBusca}
                onChange={(e) => setFiltroBusca(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-teal-500"
              />
            </div>

            <div className="md:col-span-3">
              <select
                value={filtroSituacao}
                onChange={(e) => setFiltroSituacao(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:border-teal-500 font-medium"
              >
                <option value="todas">Todas as Situações</option>
                <option value="registrada">Não Justificadas (Registradas)</option>
                <option value="justificada">Justificadas</option>
                <option value="abonada">Abonadas</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <input
                type="date"
                value={filtroDataInicio}
                onChange={(e) => setFiltroDataInicio(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:border-teal-500"
                title="Data inicial"
              />
            </div>

            <div className="md:col-span-2">
              <input
                type="date"
                value={filtroDataFim}
                onChange={(e) => setFiltroDataFim(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:border-teal-500"
                title="Data final"
              />
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
                    <th className="py-3.5 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {faltasFiltradas.map((falta) => {
                    const p = falta.reunioes_participantes;
                    const r = falta.reunioes;

                    return (
                      <tr key={falta.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3.5 px-4">
                          <p className="font-bold text-slate-900">{p?.nome_ministro_snapshot || 'Ministro'}</p>
                          <p className="text-xs text-slate-500">{p?.cargo_snapshot || 'Ministro'}</p>
                        </td>

                        <td className="py-3.5 px-4 text-slate-700">
                          <p className="text-xs font-semibold">{p?.nome_congregacao_snapshot || 'Sede'}</p>
                          {p?.area_snapshot && <p className="text-[11px] text-slate-400">{p.area_snapshot}</p>}
                        </td>

                        <td className="py-3.5 px-4">
                          <p className="font-semibold text-slate-800 line-clamp-1">{r?.titulo || 'Reunião'}</p>
                          <p className="text-xs text-slate-500">
                            {r?.data_reuniao ? new Date(r.data_reuniao + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}
                          </p>
                        </td>

                        <td className="py-3.5 px-4 text-xs text-slate-600">
                          {new Date(falta.data_geracao_falta).toLocaleDateString('pt-BR')}
                        </td>

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

                        <td className="py-3.5 px-4 text-right space-x-1.5">
                          <button
                            onClick={() => abrirDetalhes(falta)}
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition inline-flex items-center gap-1"
                            title="Ver detalhes"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Detalhes
                          </button>

                          {falta.situacao === 'registrada' && (
                            <button
                              onClick={() => {
                                setFaltaSelecionada(falta);
                                setModalJustificarAberto(true);
                              }}
                              className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg text-xs font-bold transition"
                            >
                              Justificar
                            </button>
                          )}

                          {falta.situacao !== 'abonada' && (
                            <button
                              onClick={() => {
                                setFaltaSelecionada(falta);
                                setModalAbonarAberto(true);
                              }}
                              className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-bold transition"
                            >
                              Abonar
                            </button>
                          )}
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

      {/* ─── MODAL 1: DETALHES DA FALTA & HISTÓRICO ─── */}
      {modalDetalhesAberto && faltaSelecionada && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
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
                      {/* Protocolo e Status de Envio */}
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

                      {/* Exibição detalhada de erro de envio anterior se houver */}
                      {adv.status_envio === 'erro_envio' && adv.erro_mensagem && (
                        <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-[11px] text-rose-800 flex items-start gap-2">
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <strong className="block">Falha no envio anterior:</strong>
                            <span>{adv.erro_mensagem}</span>
                          </div>
                        </div>
                      )}

                      {/* Destinatário do E-mail */}
                      <div className="flex items-center gap-2 text-xs text-slate-700 bg-white p-2.5 rounded-xl border border-slate-200">
                        <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                        <div className="flex-1 truncate">
                          <span className="text-slate-400 text-[11px]">Destinatário: </span>
                          <strong className="text-slate-800">{emailDestino || 'E-mail não informado no cadastro do ministro'}</strong>
                        </div>
                      </div>

                      {/* Feedback de envio em tempo real */}
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

                      {/* Botões de Ação */}
                      <div className="flex flex-wrap gap-2 pt-1">
                        <a
                          href={`/api/v1/reunioes/advertencias/${adv.id}/pdf`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 min-w-[130px] px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 border border-slate-300"
                        >
                          <FileText className="w-4 h-4 text-slate-600" />
                          Visualizar PDF
                        </a>

                        <button
                          onClick={() => handleEnviarEmailAdvertencia(adv.id)}
                          disabled={enviandoEmail || !emailDestino}
                          className="flex-1 min-w-[150px] px-3.5 py-2.5 bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-500 hover:to-teal-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl shadow transition flex items-center justify-center gap-1.5"
                          title={
                            !emailDestino
                              ? 'Ministro sem e-mail cadastrado'
                              : 'Enviar notificação oficial por e-mail'
                          }
                        >
                          {enviandoEmail ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin" />
                              <span>Enviando...</span>
                            </>
                          ) : (
                            <>
                              <Send className="w-4 h-4" />
                              <span>{adv.status_envio === 'enviada' ? 'Reenviar por e-mail' : 'Enviar por e-mail'}</span>
                            </>
                          )}
                        </button>
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

      {/* ─── MODAL 2: JUSTIFICAR FALTA ─── */}
      {modalJustificarAberto && faltaSelecionada && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-800">Justificar Falta Ministerial</h2>
                <p className="text-xs text-slate-500">
                  {faltaSelecionada.reunioes_participantes?.nome_ministro_snapshot}
                </p>
              </div>
              <button onClick={() => setModalJustificarAberto(false)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Tipo de Justificativa *</label>
                <select
                  value={tipoJustificativa}
                  onChange={(e) => setTipoJustificativa(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-teal-500 font-medium"
                >
                  <option value="manuscrita_secretaria">Manuscrita / Entregue na Secretaria</option>
                  <option value="atestado_medico">Atestado Médico / Saúde</option>
                  <option value="trabalho">Compromisso de Trabalho</option>
                  <option value="viagem">Viagem Ministerial / Pessoal</option>
                  <option value="antecipada">Justificativa Antecipada</option>
                  <option value="no_checkin">Registrada na Recepção</option>
                  <option value="outros">Outros Motivos</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Motivo / Parecer Detalhado *</label>
                <textarea
                  rows={3}
                  value={motivoJustificativa}
                  onChange={(e) => setMotivoJustificativa(e.target.value)}
                  placeholder="Descreva o motivo apresentado pelo ministro..."
                  className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Documento Comprobatório / Anexo (Opcional)
                </label>

                {!arquivoAnexo ? (
                  <div className="space-y-1.5">
                    <label className="border-2 border-dashed border-slate-200 hover:border-teal-500 bg-slate-50/70 hover:bg-teal-50/30 rounded-2xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer transition text-center group">
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,image/jpeg,image/png,application/pdf"
                        onChange={handleSelecionarArquivo}
                        disabled={salvando}
                        className="hidden"
                      />
                      <div className="w-10 h-10 rounded-full bg-white shadow-sm border border-slate-200 flex items-center justify-center text-teal-600 group-hover:scale-110 transition">
                        <Upload className="w-5 h-5" />
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-xs font-bold text-slate-800">
                          Anexar documento
                        </p>
                        <p className="text-[11px] text-slate-500">
                          PDF, JPG ou PNG — máximo 5 MB
                        </p>
                      </div>
                    </label>
                    {erroArquivo && (
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-rose-600 px-1">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{erroArquivo}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-3 bg-teal-50/60 border border-teal-200 rounded-2xl flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center shrink-0">
                        {arquivoAnexo.name.toLowerCase().endsWith('.pdf') ? (
                          <FileText className="w-4 h-4" />
                        ) : (
                          <Paperclip className="w-4 h-4" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 truncate" title={arquivoAnexo.name}>
                          {arquivoAnexo.name}
                        </p>
                        <p className="text-[10px] text-teal-700 font-medium">
                          {formatarTamanhoArquivo(arquivoAnexo.size)}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setArquivoAnexo(null);
                        setErroArquivo(null);
                      }}
                      disabled={salvando}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                      title="Remover arquivo"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-500">
                A justificativa não apagará o registro original da falta; apenas alterará o status para{' '}
                <strong className="text-amber-700">Justificada</strong> no prontuário.
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => {
                  setModalJustificarAberto(false);
                  setArquivoAnexo(null);
                  setErroArquivo(null);
                }}
                disabled={salvando}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl"
              >
                Cancelar
              </button>
              <button
                onClick={salvarJustificativa}
                disabled={!motivoJustificativa.trim() || salvando}
                className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow transition flex items-center justify-center gap-1.5"
              >
                {salvando ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>{enviandoAnexo ? 'Enviando anexo...' : 'Salvando...'}</span>
                  </>
                ) : (
                  'Confirmar Justificativa'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL 3: ABONAR FALTA ─── */}
      {modalAbonarAberto && faltaSelecionada && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h2 className="text-base font-bold text-slate-800">Abonar Falta Ministerial?</h2>
              <p className="text-xs text-slate-600">
                {faltaSelecionada.reunioes_participantes?.nome_ministro_snapshot} •{' '}
                {faltaSelecionada.reunioes?.titulo}
              </p>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Motivo do Abono (Opcional)</label>
                <input
                  type="text"
                  value={motivoAbono}
                  onChange={(e) => setMotivoAbono(e.target.value)}
                  placeholder="Ex: Liberado pela Presidência / Motivo de Força Maior"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl text-[11px] text-emerald-900 leading-relaxed">
                O abono formaliza o perdão da ausência pela Secretaria Geral sem apagar o histórico da convocação.
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setModalAbonarAberto(false)}
                disabled={salvando}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl"
              >
                Voltar
              </button>
              <button
                onClick={salvarAbono}
                disabled={salvando}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow transition"
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
