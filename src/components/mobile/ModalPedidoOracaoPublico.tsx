'use client';

/**
 * ModalPedidoOracaoPublico
 * 
 * Permite que visitantes e membros enviem pedidos de oração pelo App do Membro
 * público com proteção contra abuso e design mobile-first.
 */

import { useState } from 'react';
import { HeartHandshake, Send, X, CheckCircle2, AlertCircle, Loader2, ShieldCheck } from 'lucide-react';

interface ModalPedidoOracaoPublicoProps {
  isOpen: boolean;
  onClose: () => void;
  slug: string;
  igrejaNome: string;
  congregacoes?: Array<{ id: string; nome: string }>;
}

export default function ModalPedidoOracaoPublico({
  isOpen,
  onClose,
  slug,
  igrejaNome,
  congregacoes = [],
}: ModalPedidoOracaoPublicoProps) {
  const [assunto, setAssunto] = useState('');
  const [descricao, setDescricao] = useState('');
  const [nome, setNome] = useState('');
  const [contato, setContato] = useState('');
  const [congregacaoId, setCongregacaoId] = useState('');
  const [sigiloso, setSigiloso] = useState(true);

  const [loading, setLoading] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assunto.trim() || !descricao.trim()) {
      setErro('Por favor, preencha o assunto e o pedido de oração.');
      return;
    }

    setLoading(true);
    setErro(null);

    try {
      const res = await fetch(`/api/v1/public/igreja/${encodeURIComponent(slug)}/oracao`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assunto: assunto.trim(),
          descricao: descricao.trim(),
          nome_solicitante: nome.trim() || null,
          contato_solicitante: contato.trim() || null,
          congregacao_id: congregacaoId || null,
          tipo: 'oracao',
          sigiloso,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Falha ao enviar pedido de oração.');
      }

      setSucesso(true);
      setAssunto('');
      setDescricao('');
      setNome('');
      setContato('');
    } catch (err: any) {
      setErro(err.message || 'Erro ao enviar pedido de oração.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetAndClose = () => {
    setSucesso(false);
    setErro(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-md max-h-[92vh] overflow-y-auto bg-[#0f172a] border-t sm:border border-slate-800 rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl relative animate-in slide-in-from-bottom duration-300 text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={handleResetAndClose}
          className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition"
          aria-label="Fechar"
        >
          <X size={20} />
        </button>

        {sucesso ? (
          <div className="flex flex-col items-center text-center py-6">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-4 animate-in zoom-in-95">
              <CheckCircle2 size={36} />
            </div>

            <h3 className="text-xl font-bold text-white mb-2">Pedido Recebido com Sucesso!</h3>
            <p className="text-sm text-slate-300 leading-relaxed mb-6">
              O seu motivo de oração foi entregue à liderança e ao ministério de intercessão da{' '}
              <strong className="text-white">{igrejaNome}</strong>. Estaremos orando por você.
            </p>

            <button
              type="button"
              onClick={handleResetAndClose}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-sm shadow-lg shadow-blue-500/25 transition cursor-pointer"
            >
              Concluir
            </button>
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-pink-500/15 border border-pink-500/30 flex items-center justify-center text-pink-400">
                <HeartHandshake size={22} />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Pedido de Oração</h3>
                <p className="text-xs text-slate-400">{igrejaNome}</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 mb-4 leading-relaxed">
              Compartilhe seu motivo de oração, ação de graças ou clamor. Nossa equipe pastoral e de intercessão estará orando por você.
            </p>

            {erro && (
              <div className="mb-4 p-3 bg-red-950/40 border border-red-500/30 rounded-xl flex items-center gap-2 text-xs text-red-300">
                <AlertCircle size={16} className="shrink-0 text-red-400" />
                <span>{erro}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Motivo ou Assunto *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Saúde da família, causas espirituais, emprego..."
                  value={assunto}
                  onChange={(e) => setAssunto(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Seu Pedido em Detalhes *
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="Escreva com liberdade seu motivo de oração..."
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-xl p-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Seu Nome (opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Nome ou Anônimo"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    WhatsApp (opcional)
                  </label>
                  <input
                    type="tel"
                    placeholder="(99) 99999-9999"
                    value={contato}
                    onChange={(e) => setContato(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
                  />
                </div>
              </div>

              {congregacoes.length > 0 && (
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Congregação mais próxima
                  </label>
                  <select
                    value={congregacaoId}
                    onChange={(e) => setCongregacaoId(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 transition"
                  >
                    <option value="">Igreja Sede / Geral</option>
                    {congregacoes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="pt-1 flex items-center justify-between text-xs text-slate-400">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={sigiloso}
                    onChange={(e) => setSigiloso(e.target.checked)}
                    className="rounded border-slate-700 text-blue-600 focus:ring-0"
                  />
                  <span>Tratar com sigilo pastoral</span>
                </label>
                <div className="flex items-center gap-1 text-[11px] text-emerald-400">
                  <ShieldCheck size={13} />
                  <span>Protegido</span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Enviando Pedido...</span>
                    </>
                  ) : (
                    <>
                      <span>Enviar Pedido de Oração</span>
                      <Send size={15} />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
