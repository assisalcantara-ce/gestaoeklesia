'use client';

import { useState, useEffect } from 'react';

export interface MembroReativandoData {
  id?: string;
  matricula?: string;
  nome?: string;
  cpf?: string;
  cargo_ministerial?: string;
  cargoMinisterial?: string;
}

export interface ConfirmReativarModalProps {
  isOpen: boolean;
  membro: MembroReativandoData | null;
  onConfirm: (motivo?: string) => void;
  onCancel: () => void;
  carregando?: boolean;
}

export default function ConfirmReativarModal({
  isOpen,
  membro,
  onConfirm,
  onCancel,
  carregando = false,
}: ConfirmReativarModalProps) {
  const [motivo, setMotivo] = useState('');

  useEffect(() => {
    if (isOpen) {
      setMotivo('');
    }
  }, [isOpen, membro]);

  if (!isOpen || !membro) return null;

  const cargo = membro.cargo_ministerial || membro.cargoMinisterial;

  const handleConfirm = () => {
    const motivoFinal = motivo.trim() || 'Reativação no rol de membros ativos';
    onConfirm(motivoFinal);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4.5 border-b-2 border-emerald-500 bg-gradient-to-r from-emerald-600 to-teal-700 text-white">
          <span className="text-2xl">👤✅</span>
          <div>
            <h2 className="text-lg font-bold">Confirmar Reativação de Membro</h2>
            <p className="text-xs text-emerald-100 font-medium">
              Retorna o membro para o rol de membros ativos
            </p>
          </div>
        </div>

        {/* Conteúdo */}
        <div className="px-6 py-5 space-y-4">
          <p className="text-slate-700 text-sm font-semibold">
            Deseja reativar o cadastro deste membro?
          </p>

          {/* Dados do Membro */}
          <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl space-y-1.5 text-xs text-slate-700">
            <div className="flex justify-between items-center py-0.5 border-b border-slate-200/60">
              <span className="font-semibold text-slate-500">Nome:</span>
              <span className="font-bold text-slate-900">{membro.nome || '—'}</span>
            </div>
            <div className="flex justify-between items-center py-0.5 border-b border-slate-200/60">
              <span className="font-semibold text-slate-500">Matrícula:</span>
              <span className="font-mono font-medium text-slate-800">{membro.matricula || '—'}</span>
            </div>
            {membro.cpf && (
              <div className="flex justify-between items-center py-0.5 border-b border-slate-200/60">
                <span className="font-semibold text-slate-500">CPF:</span>
                <span className="font-mono text-slate-800">{membro.cpf}</span>
              </div>
            )}
            {cargo && (
              <div className="flex justify-between items-center py-0.5">
                <span className="font-semibold text-slate-500">Cargo:</span>
                <span className="font-medium text-slate-800">{cargo}</span>
              </div>
            )}
          </div>

          <div className="bg-teal-50 border-l-4 border-teal-500 p-3.5 rounded-r-xl">
            <p className="text-xs text-teal-900 leading-relaxed">
              <span className="font-bold">ℹ️ Histórico preservado:</span> Todo o histórico anterior será mantido e um novo
              evento de reativação cadastral será registrado com data e responsável.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
              Observações / Motivo da Reativação (Opcional)
            </label>
            <input
              type="text"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex: Retorno às atividades da igreja..."
              className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition"
            />
          </div>
        </div>

        {/* Botões */}
        <div className="flex gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50/80">
          <button
            type="button"
            onClick={handleConfirm}
            disabled={carregando}
            className="flex-1 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl transition font-bold text-xs shadow-sm flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            ✓ Confirmar Reativação
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={carregando}
            className="px-5 py-2.5 bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl transition font-semibold text-xs cursor-pointer"
          >
            ✕ Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
