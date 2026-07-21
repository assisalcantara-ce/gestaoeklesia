'use client';

import { useState } from 'react';
import { X, MessageSquare, Calendar, ArrowRight, Loader2 } from 'lucide-react';
import { InteractionTypes, CrmInteractionDraft } from '@/lib/platform/crm';
import { authenticatedFetch } from '@/lib/api-client';

interface CrmInteractionModalProps {
  isOpen: boolean;
  onClose: () => void;
  clienteNome?: string;
  ministryId?: string;
  onSuccess?: () => void;
}

export default function CrmInteractionModal({ 
  isOpen, 
  onClose, 
  clienteNome, 
  ministryId, 
  onSuccess 
}: CrmInteractionModalProps) {
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<CrmInteractionDraft>({
    tipo: InteractionTypes[0],
    descricao: '',
    proximaAcao: '',
    dataProximaAcao: ''
  });

  if (!isOpen) return null;

  async function handleSave() {
    if (!draft.descricao.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await authenticatedFetch('/api/v1/admin/crm/interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ministryId: ministryId || null,
          tipo: draft.tipo,
          descricao: draft.descricao,
          proximaAcao: draft.proximaAcao,
          dataProximaAcao: draft.dataProximaAcao
        })
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || 'Erro ao registrar interação');
      }

      // Limpar rascunho, fechar modal e disparar callbacks de atualização sem reload da página
      setDraft({
        tipo: InteractionTypes[0],
        descricao: '',
        proximaAcao: '',
        dataProximaAcao: ''
      });
      onClose();
      onSuccess?.();
    } catch (err: any) {
      setError(err?.message || 'Falha ao salvar interação');
    } finally {
      setSaving(false);
    }
  }

  const isFormValid = draft.descricao.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-gray-950 border border-gray-800 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-800 bg-gray-900/50 flex items-center justify-between">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <MessageSquare className="text-blue-500 h-5 w-5" />
            Registrar Interação Comercial
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800 transition cursor-pointer"
            title="Fechar"
            disabled={saving}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content / Form */}
        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-950/40 border border-red-900/60 text-red-400 rounded-xl text-xs">
              {error}
            </div>
          )}

          {clienteNome && (
            <div className="pb-2 border-b border-gray-800/80">
              <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider block">Cliente</span>
              <span className="text-sm font-bold text-white">{clienteNome}</span>
            </div>
          )}

          {/* Tipo de Interação */}
          <div>
            <label className="text-xs font-semibold text-gray-300 block mb-1.5">
              Tipo da Interação
            </label>
            <select
              value={draft.tipo}
              onChange={(e) => setDraft({ ...draft, tipo: e.target.value })}
              disabled={saving}
              className="w-full bg-gray-900 border border-gray-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500 transition disabled:opacity-50"
            >
              {InteractionTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {/* Descrição */}
          <div>
            <label className="text-xs font-semibold text-gray-300 block mb-1.5">
              Descrição do Atendimento *
            </label>
            <textarea
              rows={4}
              value={draft.descricao}
              onChange={(e) => setDraft({ ...draft, descricao: e.target.value })}
              placeholder="Descreva detalhes do contato realizado..."
              disabled={saving}
              className="w-full bg-gray-900 border border-gray-800 rounded-xl p-3.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition resize-none disabled:opacity-50"
            />
          </div>

          {/* Próxima Ação & Data */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-300 block mb-1.5 flex items-center gap-1">
                <ArrowRight className="h-3 w-3 text-blue-500" />
                Próxima Ação Sugerida
              </label>
              <input
                type="text"
                value={draft.proximaAcao}
                onChange={(e) => setDraft({ ...draft, proximaAcao: e.target.value })}
                placeholder="Ex: Realizar follow-up"
                disabled={saving}
                className="w-full bg-gray-900 border border-gray-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition disabled:opacity-50"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-300 block mb-1.5 flex items-center gap-1">
                <Calendar className="h-3 w-3 text-blue-500" />
                Data da Próxima Ação
              </label>
              <input
                type="date"
                value={draft.dataProximaAcao}
                onChange={(e) => setDraft({ ...draft, dataProximaAcao: e.target.value })}
                disabled={saving}
                className="w-full bg-gray-900 border border-gray-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500 transition disabled:opacity-50"
              />
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-gray-800 bg-gray-900/40 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-xs font-semibold transition cursor-pointer disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={!isFormValid || saving}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Salvando...
              </>
            ) : (
              'Salvar Interação'
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
