'use client';

import { useState, useEffect } from 'react';
import { X, Loader2, Phone, Mail, CheckCircle, AlertCircle } from 'lucide-react';
import { formatPhone, onlyDigits } from '@/lib/mascaras';

export interface MembroContatoData {
  id: string;
  nome: string;
  matricula?: string;
  whatsapp?: string;
  celular?: string;
  email?: string;
}

export interface EditarContatoAniversarianteModalProps {
  isOpen: boolean;
  membro: MembroContatoData | null;
  onClose: () => void;
  onSuccess: (updated: { id: string; whatsapp: string; email: string }) => void;
}

export default function EditarContatoAniversarianteModal({
  isOpen,
  membro,
  onClose,
  onSuccess,
}: EditarContatoAniversarianteModalProps) {
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

  useEffect(() => {
    if (isOpen && membro) {
      setWhatsapp(formatPhone(membro.whatsapp || membro.celular || ''));
      setEmail(membro.email || '');
      setErro(null);
      setSucesso(false);
      setLoading(false);
    }
  }, [isOpen, membro]);

  if (!isOpen || !membro) return null;

  const handleWhatsappChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setWhatsapp(formatPhone(e.target.value));
    if (erro) setErro(null);
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    if (erro) setErro(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);

    const cleanWhatsapp = onlyDigits(whatsapp);
    const cleanEmail = email.trim();

    // Validação WhatsApp
    if (cleanWhatsapp.length > 0 && (cleanWhatsapp.length < 10 || cleanWhatsapp.length > 11)) {
      setErro('Informe um número de WhatsApp válido com DDD (10 ou 11 dígitos).');
      return;
    }

    // Validação Email
    if (cleanEmail.length > 0 && !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(cleanEmail)) {
      setErro('Informe um endereço de e-mail válido (exemplo@dominio.com).');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`/api/v1/members/${membro.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          whatsapp: cleanWhatsapp || null,
          celular: cleanWhatsapp || null,
          phone: cleanWhatsapp || null,
          email: cleanEmail.toLowerCase() || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Falha ao salvar as alterações de contato.');
      }

      setSucesso(true);

      setTimeout(() => {
        onSuccess({
          id: membro.id,
          whatsapp: cleanWhatsapp,
          email: cleanEmail.toLowerCase(),
        });
        onClose();
      }, 700);
    } catch (err: any) {
      setErro(err?.message || 'Ocorreu um erro ao atualizar os contatos.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-contato-titulo"
      >
        {/* Header Compacto */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-teal-100 text-teal-800 flex items-center justify-center font-bold text-xs shrink-0">
              ✏️
            </div>
            <div>
              <h2 id="modal-contato-titulo" className="text-sm font-bold text-slate-900 leading-tight">
                Atualizar contato
              </h2>
              <p className="text-[11px] text-slate-500 font-medium">
                {membro.nome} {membro.matricula ? `• Matrícula: ${membro.matricula}` : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition disabled:opacity-50"
            aria-label="Fechar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {erro && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
              <span>{erro}</span>
            </div>
          )}

          {sucesso && (
            <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold">
              <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>Contatos atualizados com sucesso!</span>
            </div>
          )}

          {/* Campo WhatsApp */}
          <div className="space-y-1.5">
            <label htmlFor="input-whatsapp" className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-emerald-600" />
              WhatsApp
            </label>
            <input
              id="input-whatsapp"
              type="text"
              value={whatsapp}
              onChange={handleWhatsappChange}
              disabled={loading || sucesso}
              placeholder="(00) 00000-0000"
              maxLength={15}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 transition"
            />
            <p className="text-[10px] text-slate-400">
              Formato nacional com DDD. Deixe em branco para remover.
            </p>
          </div>

          {/* Campo E-mail */}
          <div className="space-y-1.5">
            <label htmlFor="input-email" className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-blue-600" />
              E-mail
            </label>
            <input
              id="input-email"
              type="email"
              value={email}
              onChange={handleEmailChange}
              disabled={loading || sucesso}
              placeholder="exemplo@igreja.com.br"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 transition"
            />
            <p className="text-[10px] text-slate-400">
              Endereço eletrônico válido. Deixe em branco para remover.
            </p>
          </div>

          {/* Rodapé / Ações */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={loading || sucesso}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 transition disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || sucesso}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 active:scale-[0.99] transition shadow-xs flex items-center gap-1.5 disabled:opacity-50"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{loading ? 'Salvando...' : 'Salvar alterações'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
