'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { authenticatedFetch } from '@/lib/api-client';
import { useUserContext } from '@/hooks/useUserContext';
import {
  FileText,
  ShieldCheck,
  Calendar,
  UserCheck,
  Clock,
  AlertCircle,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  History,
  ChevronDown,
  ChevronUp,
  Award,
} from 'lucide-react';
import type {
  DetalhesContratoTenantDTO,
  TenantContrato,
  ItemHistoricoDocumentoInstitucionalDTO,
} from '@/types/juridico';

export default function MeuContratoPage() {
  const userCtx = useUserContext();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detalhes, setDetalhes] = useState<DetalhesContratoTenantDTO | null>(null);

  // Modal para visualização de documentos históricos
  const [docHistoricoModal, setDocHistoricoModal] = useState<ItemHistoricoDocumentoInstitucionalDTO | null>(null);
  const [exibirHistorico, setExibirHistorico] = useState(true);

  useEffect(() => {
    if (userCtx.loading) return;

    const carregarContrato = async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await authenticatedFetch('/api/v1/juridico/meu-contrato');

        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}));
          throw new Error(errJson.error || 'Não foi possível carregar os dados contratuais.');
        }

        const json = await res.json();
        if (json.success && json.data) {
          setDetalhes(json.data);
        } else {
          setDetalhes(null);
        }
      } catch (err: any) {
        setError(err.message || 'Erro ao carregar os dados contratuais.');
      } finally {
        setLoading(false);
      }
    };

    carregarContrato();
  }, [userCtx.loading]);

  const contrato: TenantContrato | null = detalhes?.contrato || null;

  // Renderizar o badge de status contratual com UX profissional
  const renderStatusBadge = (status?: string) => {
    switch (status) {
      case 'ATIVO':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-600 border border-emerald-500/30 rounded-full text-xs font-bold">
            <CheckCircle2 size={14} className="text-emerald-500" /> Contrato Ativo
          </span>
        );
      case 'AGUARDANDO_ASSINATURA':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 text-amber-600 border border-amber-500/30 rounded-full text-xs font-bold">
            <Clock size={14} className="text-amber-500 animate-pulse" /> Aguardando Assinatura
          </span>
        );
      case 'CANCELADO':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-500/10 text-red-600 border border-red-500/30 rounded-full text-xs font-bold">
            <AlertCircle size={14} className="text-red-500" /> Contrato Cancelado
          </span>
        );
      case 'EXPIRADO':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-orange-500/10 text-orange-600 border border-orange-500/30 rounded-full text-xs font-bold">
            <AlertTriangle size={14} className="text-orange-500" /> Contrato Expirado
          </span>
        );
      case 'RESCINDIDO':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-gray-500/10 text-gray-600 border border-gray-500/30 rounded-full text-xs font-bold">
            <AlertCircle size={14} className="text-gray-500" /> Contrato Rescindido
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-500/10 text-blue-600 border border-blue-500/30 rounded-full text-xs font-bold">
            <ShieldCheck size={14} className="text-blue-500" /> Sem Contrato Ativo
          </span>
        );
    }
  };

  const formatarData = (iso?: string | null) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="flex-1 overflow-auto bg-[#f4f6f9] p-6">
      {/* Header da Tela */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
              📄 Gestão Jurídica & Meu Contrato
            </h1>
            {renderStatusBadge(contrato?.status)}
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Consulta oficial dos termos contratuais e históricos jurídicos vinculados à sua instituição.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 flex flex-col items-center justify-center gap-3">
          <Loader2 size={32} className="animate-spin text-blue-600" />
          <p className="text-sm text-gray-600 font-medium">Carregando dados contratuais reais...</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-red-700 flex items-center gap-3">
          <AlertCircle size={20} className="shrink-0 text-red-600" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      ) : !contrato ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-10 text-center space-y-4">
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto">
            <FileText size={32} />
          </div>
          <h2 className="text-lg font-bold text-gray-800">Sem Contrato Ativo Registrado</h2>
          <p className="text-sm text-gray-500 max-w-md mx-auto leading-relaxed">
            Sua instituição está atualmente operando sem um contrato formal registrado em `tenant_contratos` ou em período de testes / trial.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Card Principal — Metadados do Contrato */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-600 text-white rounded-xl shadow-sm">
                  <Award size={24} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">
                    Contrato de Prestação de Serviços
                  </h2>
                  <p className="text-xs text-gray-500 font-mono mt-0.5">
                    Número: <strong className="text-gray-800">{contrato.numero_contrato || 'CTR-PADRAO'}</strong>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Hash SHA-256 da Versão:</span>
                <span className="font-mono text-xs bg-gray-100 text-gray-700 px-2.5 py-1 rounded-md border border-gray-200 select-all" title={contrato.hash_documento || 'Oficial'}>
                  {contrato.hash_documento ? `${contrato.hash_documento.slice(0, 12)}...` : 'Vigente'}
                </span>
              </div>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-blue-500" /> Plano Contratado
                </p>
                <p className="text-base font-bold text-gray-800">
                  {contrato.plano_contratado?.toUpperCase() || 'PADRAO'}
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                  <FileText size={14} className="text-blue-500" /> Versão Contratada
                </p>
                <p className="text-base font-bold text-gray-800 font-mono">
                  v{contrato.versao_documento || '1.0'}
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar size={14} className="text-blue-500" /> Data de Início
                </p>
                <p className="text-sm font-semibold text-gray-800">
                  {formatarData(contrato.data_inicio)}
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                  <UserCheck size={14} className="text-blue-500" /> Assinado por
                </p>
                <p className="text-sm font-semibold text-gray-800">
                  {detalhes?.assinado_por_usuario?.full_name || detalhes?.assinado_por_usuario?.email || (contrato.assinado_por ? `ID: ${contrato.assinado_por.slice(0, 8)}...` : 'Representante Autorizado')}
                </p>
                {contrato.assinado_em && (
                  <p className="text-[11px] text-gray-400">
                    Em {formatarData(contrato.assinado_em)}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Card com o Conteúdo Completo do Contrato Histórico Aceito */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 px-6 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                <FileText size={16} className="text-blue-600" /> Cláusulas Contratuais Efetivas
              </h3>
              <span className="text-xs text-gray-500">Modo Somente Leitura</span>
            </div>

            <div className="p-6">
              <div className="bg-gray-950 text-gray-200 rounded-xl p-6 font-mono text-xs leading-relaxed max-h-[480px] overflow-y-auto whitespace-pre-wrap selection:bg-blue-900 selection:text-white">
                {detalhes?.conteudo_efetivo || 'Conteúdo do contrato indisponível.'}
              </div>
            </div>
          </div>

          {/* Seção de Histórico de Aceites e Documentos Institucionais */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <button
              onClick={() => setExibirHistorico(!exibirHistorico)}
              className="w-full p-4 px-6 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between hover:bg-gray-100/60 transition"
            >
              <div className="flex items-center gap-2">
                <History size={18} className="text-blue-600" />
                <h3 className="text-sm font-bold text-gray-800">
                  Histórico de Documentos e Aceites Institucionais ({detalhes?.historico_documentos.length || 0})
                </h3>
              </div>
              {exibirHistorico ? <ChevronUp size={18} className="text-gray-500" /> : <ChevronDown size={18} className="text-gray-500" />}
            </button>

            {exibirHistorico && (
              <div className="p-6">
                {!detalhes?.historico_documentos || detalhes.historico_documentos.length === 0 ? (
                  <p className="text-xs text-gray-500 italic">Nenhum registro histórico de aceite institucional localizado.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          <th className="pb-3">Documento</th>
                          <th className="pb-3">Tipo</th>
                          <th className="pb-3">Versão</th>
                          <th className="pb-3">Aceito em</th>
                          <th className="pb-3">Aceito por</th>
                          <th className="pb-3">Hash SHA-256</th>
                          <th className="pb-3 text-right">Ação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 text-xs">
                        {detalhes.historico_documentos.map((item) => (
                          <tr key={item.id} className="hover:bg-gray-50/80 transition">
                            <td className="py-3 font-semibold text-gray-800">{item.titulo}</td>
                            <td className="py-3">
                              <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded font-mono text-[11px]">
                                {item.tipo}
                              </span>
                            </td>
                            <td className="py-3 font-mono font-bold text-blue-600">v{item.versao}</td>
                            <td className="py-3 text-gray-600">{formatarData(item.aceito_em)}</td>
                            <td className="py-3 text-gray-700">
                              {item.aceito_por_nome || item.aceito_por_email || item.aceito_por_id.slice(0, 8)}
                            </td>
                            <td className="py-3 font-mono text-[11px] text-gray-500 select-all" title={item.hash_sha256 || ''}>
                              {item.hash_sha256 ? `${item.hash_sha256.slice(0, 10)}...` : '—'}
                            </td>
                            <td className="py-3 text-right">
                              <button
                                onClick={() => setDocHistoricoModal(item)}
                                className="px-3 py-1 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-md font-semibold transition"
                              >
                                Visualizar
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal de Visualização de Documento Histórico */}
      {docHistoricoModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <div>
                <h3 className="text-base font-bold text-gray-900">{docHistoricoModal.titulo}</h3>
                <p className="text-xs text-gray-500 font-mono">Versão v{docHistoricoModal.versao} • {docHistoricoModal.tipo}</p>
              </div>
              <button
                onClick={() => setDocHistoricoModal(null)}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-200 transition font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-xs bg-gray-50 p-3 rounded-xl border border-gray-200/80">
                <div>
                  <span className="text-gray-500">Aceito em:</span>
                  <p className="font-semibold text-gray-800">{formatarData(docHistoricoModal.aceito_em)}</p>
                </div>
                <div>
                  <span className="text-gray-500">Representante:</span>
                  <p className="font-semibold text-gray-800">{docHistoricoModal.aceito_por_nome || docHistoricoModal.aceito_por_email || docHistoricoModal.aceito_por_id}</p>
                </div>
                <div className="col-span-2">
                  <span className="text-gray-500">Hash SHA-256:</span>
                  <p className="font-mono text-[11px] text-gray-700 break-all select-all">{docHistoricoModal.hash_sha256 || 'N/A'}</p>
                </div>
              </div>

              <div className="bg-gray-950 text-gray-200 rounded-xl p-5 font-mono text-xs leading-relaxed whitespace-pre-wrap">
                {docHistoricoModal.conteudo_md || 'Conteúdo em Markdown indisponível para esta versão histórica.'}
              </div>
            </div>

            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
              <button
                onClick={() => setDocHistoricoModal(null)}
                className="px-5 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-xl text-xs font-semibold transition"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
