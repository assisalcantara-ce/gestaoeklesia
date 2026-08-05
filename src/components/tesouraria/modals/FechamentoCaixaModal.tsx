'use client';

import { X, Lock } from 'lucide-react';

export interface FechamentoCaixaModalProps {
  isOpen: boolean;
  onClose: () => void;
  cxModal: any;
  fechaDataInicio: string;
  setFechaDataInicio?: (val: string) => void;
  fechaDataFim: string;
  setFechaDataFim: (val: string) => void;
  fechaSaldoInicial: string;
  setFechaSaldoInicial: (val: string) => void;
  fechaObs: string;
  setFechaObs: (val: string) => void;
  salvandoFecha: boolean;
  handleFecharMes: () => void;
  entLivePeriodo: number;
  saiLivePeriodo: number;
  saldoFinalModal: number;
  fmtBRL: (val: number) => string;
}

export default function FechamentoCaixaModal({
  isOpen,
  onClose,
  cxModal,
  fechaDataInicio,
  setFechaDataInicio,
  fechaDataFim,
  setFechaDataFim,
  fechaSaldoInicial,
  setFechaSaldoInicial,
  fechaObs,
  setFechaObs,
  salvandoFecha,
  handleFecharMes,
  entLivePeriodo,
  saiLivePeriodo,
  saldoFinalModal,
  fmtBRL,
}: FechamentoCaixaModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 w-full max-w-md space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-base font-bold text-[#123b63]">Fechar Caixa</h3>
            <p className="text-sm text-gray-500">{cxModal?.nome}</p>
          </div>
          <button onClick={onClose}>
            <X className="h-5 w-5 text-gray-400" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Data Inicial</label>
            <input
              type="date"
              value={fechaDataInicio}
              onChange={(e) => setFechaDataInicio && setFechaDataInicio(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#123b63]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Data Final (Fechamento)</label>
            <input
              type="date"
              value={fechaDataFim}
              onChange={(e) => setFechaDataFim(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#123b63]"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Saldo inicial do período (R$)</label>
          <input
            type="text"
            inputMode="decimal"
            placeholder="0,00"
            value={fechaSaldoInicial}
            onChange={(e) => setFechaSaldoInicial(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
          />
          {cxModal?.fechAnt && (
            <p className="text-xs text-gray-400 mt-1">
              Sugerido: {fmtBRL(cxModal.fechAnt.saldo_final)} (saldo de{' '}
              {cxModal.fechAnt.mes_referencia.split('-').reverse().join('/')})
            </p>
          )}
        </div>
        <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-gray-500">Entradas do período:</span>
            <span className="font-semibold text-green-600">{fmtBRL(entLivePeriodo)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Saídas do período:</span>
            <span className="font-semibold text-red-500">{fmtBRL(saiLivePeriodo)}</span>
          </div>
          <div className="flex justify-between border-t pt-1 mt-1">
            <span className="text-gray-700 font-semibold">Saldo final:</span>
            <span className={`font-bold ${saldoFinalModal >= 0 ? 'text-[#123b63]' : 'text-red-600'}`}>
              {fmtBRL(saldoFinalModal)}
            </span>
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Observações</label>
          <textarea
            rows={2}
            value={fechaObs}
            onChange={(e) => setFechaObs(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none"
          />
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleFecharMes}
            disabled={salvandoFecha}
            className="flex-1 flex items-center justify-center gap-2 py-2 bg-[#123b63] text-white rounded-lg text-sm font-semibold hover:bg-[#0f2a45] transition disabled:opacity-50"
          >
            <Lock className="h-4 w-4" /> {salvandoFecha ? 'Fechando...' : 'Confirmar Fechamento'}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
