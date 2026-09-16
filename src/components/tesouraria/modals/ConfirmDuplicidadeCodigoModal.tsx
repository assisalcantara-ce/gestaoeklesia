'use client';

import { AlertTriangle, X, PlusCircle } from 'lucide-react';

export interface ConfirmDuplicidadeCodigoModalProps {
  isOpen: boolean;
  codigo: string;
  saving?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export default function ConfirmDuplicidadeCodigoModal({
  isOpen,
  codigo,
  saving = false,
  onClose,
  onConfirm,
}: ConfirmDuplicidadeCodigoModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full space-y-4 border border-slate-200 relative animate-in zoom-in-95 duration-150">
        <button
          onClick={onClose}
          disabled={saving}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition p-1 rounded-lg hover:bg-slate-100"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-800 leading-snug">
              Código / ID de Registro Já Utilizado
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Identificamos que este código já existe no sistema.
            </p>
          </div>
        </div>

        {/* Card do Código */}
        <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3 text-center space-y-1">
          <span className="text-[11px] font-semibold text-amber-800 uppercase tracking-wide">
            Código Informado
          </span>
          <div className="text-base font-mono font-black text-slate-800 tracking-wider">
            {codigo || '(Não informado)'}
          </div>
        </div>

        {/* Explicação */}
        <div className="space-y-2 text-xs text-slate-600 leading-relaxed bg-slate-50 border border-slate-200 rounded-xl p-3">
          <p>
            Já existe outro lançamento registrado com este mesmo <strong>Código / ID</strong> nesta igreja/congregação.
          </p>
          <p>
            Caso você utilize o mesmo código para agrupar múltiplos lançamentos de um mesmo <strong>culto, evento ou lote</strong>, você pode confirmar para manter e adicionar mesmo assim.
          </p>
        </div>

        {/* Botões de Ação */}
        <div className="flex flex-col-reverse sm:flex-row gap-2.5 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex-1 py-2.5 px-4 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-100 transition disabled:opacity-50"
          >
            Cancelar e Alterar Código
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={saving}
            className="flex-1 py-2.5 px-4 bg-[#123b63] hover:bg-[#0c2f54] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-sm disabled:opacity-50"
          >
            <PlusCircle className="h-4 w-4 text-emerald-400" />
            {saving ? 'Salvando...' : 'Adicionar Mesmo Assim'}
          </button>
        </div>
      </div>
    </div>
  );
}
