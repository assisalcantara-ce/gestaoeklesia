'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase-client';
import {
  FileText,
  Upload,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  X,
  FileCheck,
  ShieldCheck,
  Info,
} from 'lucide-react';

interface ModeloInfo {
  id: string;
  nome_arquivo: string;
  tamanho_bytes: number;
  atualizado_em: string;
  url_download?: string | null;
}

interface ModalModeloAdvertenciaProps {
  aberto: boolean;
  onFechar: () => void;
  onModeloAtualizado?: () => void;
}

export default function ModalModeloAdvertencia({
  aberto,
  onFechar,
  onModeloAtualizado,
}: ModalModeloAdvertenciaProps) {
  const [carregando, setCarregando] = useState<boolean>(true);
  const [salvando, setSalvando] = useState<boolean>(false);
  const [modelo, setModelo] = useState<ModeloInfo | null>(null);
  const [configurado, setConfigurado] = useState<boolean>(false);
  const [arquivoSelecionado, setArquivoSelecionado] = useState<File | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  const fetchAutenticado = useCallback(async (url: string, options: RequestInit = {}) => {
    const supabase = createClient();
    const {
      data: { session },
      error: sessionErr,
    } = await supabase.auth.getSession();

    if (sessionErr || !session?.access_token) {
      throw new Error('Sessão expirada ou não autenticada. Faça login novamente.');
    }

    const headers = new Headers(options.headers || {});
    headers.set('Authorization', `Bearer ${session.access_token}`);

    return fetch(url, { ...options, headers });
  }, []);

  const carregarModelo = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const res = await fetchAutenticado('/api/v1/reunioes/configuracoes/modelo-advertencia');
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Falha ao consultar modelo oficial.');
      }

      setConfigurado(Boolean(data.configurado));
      setModelo(data.modelo || null);
    } catch (err: any) {
      setErro(err?.message || 'Erro ao buscar informações do modelo oficial.');
    } finally {
      setCarregando(false);
    }
  }, [fetchAutenticado]);

  useEffect(() => {
    if (aberto) {
      setArquivoSelecionado(null);
      setSucesso(null);
      setErro(null);
      carregarModelo();
    }
  }, [aberto, carregarModelo]);

  if (!aberto) return null;

  const handleSelecionarArquivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErro(null);
    setSucesso(null);
    const files = e.target.files;
    if (!files || files.length === 0) {
      setArquivoSelecionado(null);
      return;
    }

    const file = files[0];
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setErro('Apenas arquivos no formato PDF são aceitos.');
      setArquivoSelecionado(null);
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setErro('O arquivo selecionado excede o limite máximo permitido de 10MB.');
      setArquivoSelecionado(null);
      return;
    }

    setArquivoSelecionado(file);
  };

  const handleSalvarUpload = async () => {
    if (!arquivoSelecionado || salvando) return;

    setSalvando(true);
    setErro(null);
    setSucesso(null);

    try {
      const formData = new FormData();
      formData.append('file', arquivoSelecionado);

      const res = await fetchAutenticado('/api/v1/reunioes/configuracoes/modelo-advertencia', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Falha ao realizar upload do modelo oficial.');
      }

      setSucesso('Modelo oficial de Carta de Advertência cadastrado com sucesso!');
      setArquivoSelecionado(null);
      if (inputRef.current) inputRef.current.value = '';

      await carregarModelo();
      if (onModeloAtualizado) onModeloAtualizado();
    } catch (err: any) {
      setErro(err?.message || 'Erro ao enviar arquivo para o servidor.');
    } finally {
      setSalvando(false);
    }
  };

  const formatBytes = (bytes?: number) => {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-xl w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Top Header */}
        <div className="bg-gradient-to-r from-[#123b63] to-[#0a233c] text-white p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center border border-white/20">
              <FileText className="w-5 h-5 text-teal-300" />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">Modelo Oficial de Advertência</h3>
              <p className="text-xs text-slate-300 mt-0.5">Configuração do documento oficial por instituição</p>
            </div>
          </div>
          <button
            onClick={onFechar}
            className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-sm text-slate-600">
          {/* Informational Guidance */}
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex gap-3 text-blue-900">
            <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-xs leading-relaxed">
              <strong className="block font-semibold mb-0.5">Modelo Institucional de Referência:</strong>
              Cadastre o modelo oficial de <strong>Carta de Advertência</strong> da sua denominação/convenção. O Eklésia utilizará sua estrutura e regimento como referência para <strong>gerar dinamicamente os documentos oficiais em PDF preenchidos com os dados reais de cada ministro faltoso</strong>.
            </div>
          </div>

          {/* Feedback messages */}
          {erro && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl p-3.5 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1">{erro}</div>
            </div>
          )}

          {sucesso && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl p-3.5 flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{sucesso}</div>
            </div>
          )}

          {/* Current Status Box */}
          <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center justify-between">
              <span>Status Atual</span>
              {carregando && <RefreshCw className="w-3.5 h-3.5 animate-spin text-teal-600" />}
            </div>

            {carregando ? (
              <div className="py-4 text-center text-xs text-slate-400">Verificando modelo cadastrado...</div>
            ) : configurado && modelo ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full border border-emerald-200">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Modelo de Referência Ativo
                  </span>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 p-3.5 space-y-1.5 text-xs">
                  <div className="flex justify-between items-center text-slate-700">
                    <span className="text-slate-400">Arquivo:</span>
                    <span className="font-semibold truncate max-w-[260px]" title={modelo.nome_arquivo}>
                      {modelo.nome_arquivo}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-slate-700">
                    <span className="text-slate-400">Tamanho:</span>
                    <span className="font-medium">{formatBytes(modelo.tamanho_bytes)}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-700">
                    <span className="text-slate-400">Última atualização:</span>
                    <span className="font-medium">
                      {modelo.atualizado_em ? new Date(modelo.atualizado_em).toLocaleString('pt-BR') : '—'}
                    </span>
                  </div>
                </div>

                {modelo.url_download && (
                  <div>
                    <a
                      href={modelo.url_download}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-700 hover:text-teal-900 bg-teal-50 hover:bg-teal-100 px-3 py-1.5 rounded-lg border border-teal-200 transition"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Visualizar PDF de Referência
                    </a>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-800 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong>Nenhum modelo cadastrado.</strong>
                  <p className="mt-0.5 text-amber-700">
                    Faça o upload do PDF institucional de referência para manter conformidade com os modelos eclesiásticos da sua liderança.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Upload Box */}
          <div className="border-2 border-dashed border-slate-300 rounded-2xl p-5 text-center hover:border-teal-500 transition bg-slate-50/50">
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,application/pdf"
              onChange={handleSelecionarArquivo}
              className="hidden"
              id="input-pdf-oficial"
            />
            <label htmlFor="input-pdf-oficial" className="cursor-pointer block space-y-2">
              <div className="w-12 h-12 bg-teal-50 text-teal-700 rounded-2xl flex items-center justify-center mx-auto border border-teal-200">
                <Upload className="w-6 h-6" />
              </div>
              <div className="text-xs font-bold text-slate-700">
                {arquivoSelecionado ? (
                  <span className="text-teal-700 flex items-center justify-center gap-1">
                    <FileCheck className="w-4 h-4" />
                    {arquivoSelecionado.name} ({formatBytes(arquivoSelecionado.size)})
                  </span>
                ) : (
                  <span>Clique para selecionar o PDF oficial da instituição</span>
                )}
              </div>
              <p className="text-[11px] text-slate-400">Formato aceito: PDF (tamanho máximo: 10MB)</p>
            </label>
          </div>
        </div>

        {/* Footer actions */}
        <div className="bg-slate-50 border-t border-slate-200 p-4 px-6 flex items-center justify-end gap-3">
          <button
            onClick={onFechar}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-xl transition"
          >
            Fechar
          </button>

          <button
            onClick={handleSalvarUpload}
            disabled={!arquivoSelecionado || salvando}
            className="flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-[#123b63] hover:bg-[#1a4f85] disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow transition"
          >
            {salvando ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Enviando...</span>
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                <span>{configurado ? 'Substituir Modelo Oficial' : 'Salvar Modelo Oficial'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
