'use client';

/**
 * /app/documentos — Central de Documentos do Membro
 *
 * Permite visualizar documentos emitidos (cartas, declarações) e solicitar novos documentos oficiais.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import MobileShell from '@/components/mobile/MobileShell';
import MobileHeader from '@/components/mobile/MobileHeader';
import MobileBottomNav from '@/components/mobile/MobileBottomNav';
import { createClient } from '@/lib/supabase-client';
import {
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  PlusCircle,
  Eye,
  Printer,
  X,
  Send,
  Sparkles,
  AlertCircle,
  Loader2,
  FileCheck,
} from 'lucide-react';

interface DocumentoItem {
  id: string;
  titulo: string;
  tipo: 'carta' | 'declaracao';
  categoria: string;
  status: string;
  data_emissao: string;
}

interface SolicitacaoItem {
  id: string;
  tipo_carta: 'mudanca' | 'transito' | 'desligamento' | 'recomendacao';
  destino?: string | null;
  observacoes?: string | null;
  status: 'pendente' | 'autorizado' | 'rejeitado';
  data_autorizacao?: string | null;
  motivo_rejeicao?: string | null;
  created_at: string;
}

const TIPO_CARTA_LABELS: Record<string, { label: string; desc: string }> = {
  recomendacao: {
    label: 'Carta de Recomendação',
    desc: 'Para apresentar sua idoneidade e comunhão a outras congregações ou ministérios.',
  },
  transito: {
    label: 'Carta de Trânsito',
    desc: 'Para viagens temporárias ou estadias fora de sua igreja local.',
  },
  mudanca: {
    label: 'Carta de Mudança / Transferência',
    desc: 'Para transferência definitiva de membresia para outra congregação.',
  },
  desligamento: {
    label: 'Carta de Desligamento',
    desc: 'Solicitação formal de desligamento do rol de membros.',
  },
};

const STATUS_SOLICITACAO: Record<
  string,
  { label: string; color: string; icon: React.ElementType }
> = {
  pendente: {
    label: 'Aguardando Secretaria',
    color: 'bg-amber-50 text-amber-700 border-amber-200',
    icon: Clock,
  },
  autorizado: {
    label: 'Autorizado / Pronto',
    color: 'bg-green-50 text-green-700 border-green-200',
    icon: CheckCircle2,
  },
  rejeitado: {
    label: 'Não Aprovado',
    color: 'bg-red-50 text-red-700 border-red-200',
    icon: XCircle,
  },
};

export default function MobileDocumentosPage() {
  const supabase = useMemo(() => createClient(), []);

  const [activeTab, setActiveTab] = useState<'disponiveis' | 'solicitacoes' | 'novo'>('disponiveis');
  const [loading, setLoading] = useState(true);
  const [documentos, setDocumentos] = useState<DocumentoItem[]>([]);
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoItem[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form State
  const [formTipo, setFormTipo] = useState<'recomendacao' | 'transito' | 'mudanca' | 'desligamento'>('recomendacao');
  const [formDestino, setFormDestino] = useState('');
  const [formObservacoes, setFormObservacoes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formSuccess, setFormSuccess] = useState(false);

  // Visualizador Modal State
  const [viewDoc, setViewDoc] = useState<{
    id: string;
    titulo: string;
    rendered_html: string;
  } | null>(null);
  const [viewLoading, setViewLoading] = useState(false);

  const getAccessToken = useCallback(async (): Promise<string | null> => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  }, [supabase]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const token = await getAccessToken();
      if (!token) {
        setErrorMsg('Sessão expirada. Faça login novamente.');
        setLoading(false);
        return;
      }

      const res = await fetch('/api/v1/mobile/documentos', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error('Falha ao carregar documentos.');
      }

      const data = await res.json();
      setDocumentos(data.documentos || []);
      setSolicitacoes(data.solicitacoes || []);
    } catch {
      setErrorMsg('Não foi possível carregar os documentos.');
    } finally {
      setLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleOpenDoc = async (docId: string, titulo: string) => {
    setViewLoading(true);
    try {
      const token = await getAccessToken();
      if (!token) return;

      const res = await fetch(`/api/v1/mobile/documentos/${docId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error('Não foi possível carregar o documento.');

      const data = await res.json();
      setViewDoc({
        id: data.id,
        titulo: data.titulo || titulo,
        rendered_html: data.rendered_html || '',
      });
    } catch {
      alert('Erro ao abrir documento.');
    } finally {
      setViewLoading(false);
    }
  };

  const handlePrint = (html: string, titulo: string) => {
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><title>${titulo}</title>`);
    win.document.write(
      '<style>body{font-family:Arial, sans-serif; padding:24px; color:#111; margin:0;} img{max-width:100%;} @media print{@page{margin:10mm;}}</style>'
    );
    win.document.write('</head><body>');
    win.document.write(html);
    win.document.write('</body></html>');
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const token = await getAccessToken();
      if (!token) return;

      const res = await fetch('/api/v1/mobile/documentos/solicitacoes', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tipo_carta: formTipo,
          destino: formDestino.trim() || null,
          observacoes: formObservacoes.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao enviar solicitação.');
      }

      setFormSuccess(true);
      setFormDestino('');
      setFormObservacoes('');
      await loadData();
      setTimeout(() => {
        setFormSuccess(false);
        setActiveTab('solicitacoes');
      }, 1500);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erro ao processar solicitação.');
    } finally {
      setSubmitting(false);
    }
  };

  const fmtDate = (iso?: string | null) => {
    if (!iso) return '—';
    try {
      return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(new Date(iso));
    } catch {
      return iso;
    }
  };

  return (
    <MobileShell>
      <MobileHeader title="Central de Documentos" showBack={false} />

      <main className="flex-1 pb-24 px-4 pt-4 space-y-4">
        {/* Banner Informativo */}
        <div className="bg-gradient-to-r from-teal-700 to-emerald-800 text-white p-4 rounded-2xl shadow-sm relative overflow-hidden">
          <div className="relative z-10 space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-teal-200 font-semibold tracking-wide uppercase">
              <FileCheck className="w-4 h-4 text-emerald-300" />
              <span>Documentos Oficiais</span>
            </div>
            <h1 className="text-lg font-bold text-white">Meus Documentos</h1>
            <p className="text-xs text-teal-100/90 leading-relaxed">
              Consulte cartas ministeriais e declarações emitidas pela Secretaria ou solicite novos documentos.
            </p>
          </div>
          <div className="absolute right-[-10px] bottom-[-20px] opacity-10 text-white">
            <FileText className="w-32 h-32" />
          </div>
        </div>

        {/* Abas de Navegação */}
        <div className="grid grid-cols-3 gap-1 bg-gray-100/80 p-1 rounded-xl border border-gray-200">
          <button
            onClick={() => setActiveTab('disponiveis')}
            className={`py-2 px-1 text-xs font-bold rounded-lg transition text-center flex items-center justify-center gap-1 ${
              activeTab === 'disponiveis'
                ? 'bg-white text-teal-800 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <FileCheck className="w-3.5 h-3.5" />
            <span>Disponíveis ({documentos.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('solicitacoes')}
            className={`py-2 px-1 text-xs font-bold rounded-lg transition text-center flex items-center justify-center gap-1 ${
              activeTab === 'solicitacoes'
                ? 'bg-white text-teal-800 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Pedidos ({solicitacoes.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('novo')}
            className={`py-2 px-1 text-xs font-bold rounded-lg transition text-center flex items-center justify-center gap-1 ${
              activeTab === 'novo'
                ? 'bg-white text-teal-800 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <PlusCircle className="w-3.5 h-3.5 text-teal-600" />
            <span>Solicitar</span>
          </button>
        </div>

        {/* Mensagem de Erro Geral */}
        {errorMsg && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Loading Global */}
        {loading && (
          <div className="py-16 text-center space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-teal-600 mx-auto" />
            <p className="text-xs text-gray-500 font-medium">Carregando documentos...</p>
          </div>
        )}

        {/* Conteúdo Aba: DISPONÍVEIS */}
        {!loading && activeTab === 'disponiveis' && (
          <div className="space-y-3">
            {documentos.length === 0 ? (
              <div className="py-16 px-4 text-center bg-white border border-gray-100 rounded-2xl shadow-sm space-y-3">
                <FileText className="w-12 h-12 text-gray-300 mx-auto" />
                <div className="space-y-1">
                  <p className="text-sm font-bold text-gray-700">Nenhum documento disponível</p>
                  <p className="text-xs text-gray-400 max-w-xs mx-auto">
                    Quando a Secretaria emitir cartas ou declarações para você, elas aparecerão aqui prontas para visualização e impressão.
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab('novo')}
                  className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-bold rounded-xl transition"
                >
                  <PlusCircle className="w-4 h-4 text-teal-600" />
                  <span>Solicitar Documento</span>
                </button>
              </div>
            ) : (
              documentos.map((doc) => (
                <div
                  key={doc.id}
                  className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm space-y-3 hover:border-teal-200 transition"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${
                          doc.tipo === 'declaracao'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-blue-50 text-blue-700 border border-blue-200'
                        }`}
                      >
                        {doc.tipo === 'declaracao' ? '📄 Declaração' : '📜 Carta Ministerial'}
                      </span>
                      <h2 className="text-sm font-bold text-gray-900 leading-snug">
                        {doc.titulo}
                      </h2>
                    </div>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-50 text-green-700 border border-green-200">
                      <CheckCircle2 className="w-3 h-3 text-green-600" />
                      <span>Liberado</span>
                    </span>
                  </div>

                  <div className="text-xs text-gray-500 pt-1 border-t border-gray-100 flex items-center justify-between">
                    <span>Emitido em: {fmtDate(doc.data_emissao)}</span>
                    <button
                      onClick={() => handleOpenDoc(doc.id, doc.titulo)}
                      disabled={viewLoading}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl transition shadow-sm"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Visualizar / PDF</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Conteúdo Aba: SOLICITAÇÕES */}
        {!loading && activeTab === 'solicitacoes' && (
          <div className="space-y-3">
            {solicitacoes.length === 0 ? (
              <div className="py-16 px-4 text-center bg-white border border-gray-100 rounded-2xl shadow-sm space-y-3">
                <Clock className="w-12 h-12 text-gray-300 mx-auto" />
                <div className="space-y-1">
                  <p className="text-sm font-bold text-gray-700">Nenhum pedido em andamento</p>
                  <p className="text-xs text-gray-400 max-w-xs mx-auto">
                    Você ainda não fez nenhum pedido de documento oficial.
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab('novo')}
                  className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 bg-teal-600 text-white text-xs font-bold rounded-xl transition shadow-sm"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Fazer Novo Pedido</span>
                </button>
              </div>
            ) : (
              solicitacoes.map((sol) => {
                const cfg = STATUS_SOLICITACAO[sol.status] || STATUS_SOLICITACAO.pendente;
                const Icon = cfg.icon;
                const info = TIPO_CARTA_LABELS[sol.tipo_carta] || { label: sol.tipo_carta, desc: '' };

                return (
                  <div
                    key={sol.id}
                    className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5">
                        <h2 className="text-sm font-bold text-gray-900">{info.label}</h2>
                        <p className="text-[11px] text-gray-400">
                          Solicitado em {fmtDate(sol.created_at)}
                        </p>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.color}`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span>{cfg.label}</span>
                      </span>
                    </div>

                    {sol.destino && (
                      <p className="text-xs text-gray-600">
                        <strong>Destino informado:</strong> {sol.destino}
                      </p>
                    )}

                    {sol.observacoes && (
                      <p className="text-xs text-gray-500 italic bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                        "{sol.observacoes}"
                      </p>
                    )}

                    {sol.status === 'rejeitado' && sol.motivo_rejeicao && (
                      <div className="text-xs text-red-700 bg-red-50 border border-red-200 p-2.5 rounded-xl">
                        <strong>Motivo informado pela secretaria:</strong> {sol.motivo_rejeicao}
                      </div>
                    )}

                    {sol.status === 'autorizado' && (
                      <div className="text-xs text-green-700 bg-green-50 border border-green-200 p-2.5 rounded-xl flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                        <span>Autorizado em {fmtDate(sol.data_autorizacao)}. O documento está disponível na aba "Disponíveis".</span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Conteúdo Aba: NOVO PEDIDO */}
        {!loading && activeTab === 'novo' && (
          <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm space-y-4">
            <div className="border-b border-gray-100 pb-3">
              <h2 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-teal-600" />
                <span>Solicitar Documento Oficial</span>
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Seus dados cadastrais (nome, cargo e congregação) são vinculados automaticamente com segurança.
              </p>
            </div>

            {formSuccess ? (
              <div className="py-8 text-center space-y-2">
                <CheckCircle2 className="w-10 h-10 text-green-600 mx-auto animate-bounce" />
                <h3 className="text-sm font-bold text-gray-800">Solicitação Enviada!</h3>
                <p className="text-xs text-gray-500">
                  A Secretaria Geral foi notificada e avaliará o seu pedido.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Tipo de Documento */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-700 block uppercase tracking-wider">
                    Selecione o Documento Desejado *
                  </label>
                  <div className="space-y-2">
                    {Object.entries(TIPO_CARTA_LABELS).map(([key, val]) => (
                      <label
                        key={key}
                        className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${
                          formTipo === key
                            ? 'bg-teal-50/70 border-teal-500 ring-1 ring-teal-500'
                            : 'bg-white border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="radio"
                          name="tipo_carta"
                          value={key}
                          checked={formTipo === key}
                          onChange={() => setFormTipo(key as any)}
                          className="mt-0.5 text-teal-600 focus:ring-teal-500"
                        />
                        <div className="space-y-0.5">
                          <p className="text-xs font-bold text-gray-800">{val.label}</p>
                          <p className="text-[11px] text-gray-500">{val.desc}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Destino (Opcional ou Relevante) */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700 block uppercase tracking-wider">
                    Igreja / Cidade de Destino (Opcional)
                  </label>
                  <input
                    type="text"
                    value={formDestino}
                    onChange={(e) => setFormDestino(e.target.value)}
                    placeholder="Ex: Igreja Evangélica Betel — São Paulo/SP"
                    className="w-full text-xs p-3 rounded-xl border border-gray-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
                  />
                </div>

                {/* Observações */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700 block uppercase tracking-wider">
                    Observações / Motivo (Opcional)
                  </label>
                  <textarea
                    rows={3}
                    value={formObservacoes}
                    onChange={(e) => setFormObservacoes(e.target.value)}
                    placeholder="Detalhes adicionais para a Secretaria Geral..."
                    className="w-full text-xs p-3 rounded-xl border border-gray-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl transition shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Enviando Pedido...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Enviar Solicitação</span>
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        )}

        {/* Modal Visualizador de Documento Oficial (HTML / PDF) */}
        {viewDoc && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-2xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-gray-200">
              {/* Header do Modal */}
              <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/80">
                <div className="space-y-0.5">
                  <h3 className="text-sm font-bold text-gray-900">{viewDoc.titulo}</h3>
                  <p className="text-[11px] text-gray-500">Documento Oficial Autêntico</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePrint(viewDoc.rendered_html, viewDoc.titulo)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl transition shadow-sm"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Imprimir / Salvar PDF</span>
                  </button>
                  <button
                    onClick={() => setViewDoc(null)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Corpo do Documento Renderizado em A4 */}
              <div className="flex-1 overflow-y-auto p-4 bg-gray-100/60 flex justify-center">
                <div
                  className="bg-white shadow-md p-6 max-w-full rounded-lg text-gray-800"
                  dangerouslySetInnerHTML={{ __html: viewDoc.rendered_html }}
                />
              </div>
            </div>
          </div>
        )}
      </main>

      <MobileBottomNav />
    </MobileShell>
  );
}
