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
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 w-full max-w-md space-y-4">
        <div className="flex justify-between items-center border-b pb-3.5 border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-700 border border-teal-200 flex items-center justify-center font-bold">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Fechar Caixa</h3>
              <p className="text-xs text-slate-500 font-medium">{cxModal?.nome}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Data Inicial</label>
            <input
              type="date"
              value={fechaDataInicio}
              onChange={(e) => setFechaDataInicio && setFechaDataInicio(e.target.value)}
              className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Data Final</label>
            <input
              type="date"
              value={fechaDataFim}
              onChange={(e) => setFechaDataFim(e.target.value)}
              className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Saldo inicial do período (R$)</label>
          <input
            type="text"
            inputMode="decimal"
            placeholder="0,00"
            value={fechaSaldoInicial}
            onChange={(e) => setFechaSaldoInicial(e.target.value)}
            className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition"
          />
          {cxModal?.fechAnt && (
            <p className="text-xs text-slate-500 font-medium mt-1">
              Sugerido: <span className="font-bold text-teal-700">{fmtBRL(cxModal.fechAnt.saldo_final)}</span> (saldo de{' '}
              {cxModal.fechAnt.mes_referencia.split('-').reverse().join('/')})
            </p>
          )}
        </div>

        <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 text-sm space-y-1.5">
          <div className="flex justify-between items-center">
            <span className="text-slate-500 text-xs font-semibold uppercase">Entradas no período:</span>
            <span className="font-bold text-[#15803d]">{fmtBRL(entLivePeriodo)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-500 text-xs font-semibold uppercase">Saídas no período:</span>
            <span className="font-bold text-[#be123c]">{fmtBRL(saiLivePeriodo)}</span>
          </div>
          <div className="flex justify-between items-center border-t border-slate-200/80 pt-2 mt-1">
            <span className="text-slate-800 font-bold text-xs uppercase tracking-wider">Saldo final estimado:</span>
            <span className={`text-base font-extrabold ${saldoFinalModal >= 0 ? 'text-[#1e3a8a]' : 'text-[#881337]'}`}>
              {fmtBRL(saldoFinalModal)}
            </span>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Observações</label>
          <textarea
            rows={2}
            value={fechaObs}
            onChange={(e) => setFechaObs(e.target.value)}
            className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition resize-none"
            placeholder="Observações contábeis do fechamento..."
          />
        </div>

        <div className="flex gap-2.5 pt-1">
          <button
            onClick={handleFecharMes}
            disabled={salvandoFecha}
            className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 bg-teal-700 text-white rounded-xl text-sm font-bold hover:bg-teal-800 transition disabled:opacity-50 cursor-pointer shadow-xs border border-teal-800"
          >
            <Lock className="h-4 w-4" /> {salvandoFecha ? 'Fechando...' : 'Confirmar Fechamento'}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 border border-slate-300 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-50 transition cursor-pointer shadow-2xs"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
