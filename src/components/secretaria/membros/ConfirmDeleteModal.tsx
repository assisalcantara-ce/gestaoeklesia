'use client';

import { useState, useEffect } from 'react';

export interface MembroDeletandoData {
  id?: string;
  matricula?: string;
  nome?: string;
  cpf?: string;
  cargo_ministerial?: string;
  cargoMinisterial?: string;
}

export interface ConfirmInativarModalProps {
  isOpen: boolean;
  membro: MembroDeletandoData | null;
  onConfirm: (motivo?: string) => void;
  onCancel: () => void;
  carregando?: boolean;
}

export type ConfirmDeleteModalProps = ConfirmInativarModalProps;

const MOTIVOS_SUGERIDOS = [
  'Mudança de cidade / residência',
  'Afastamento voluntário',
  'Decisão pastoral / administrativa',
  'Frequenta outra denominação',
  'Ausência prolongada',
];

export function ConfirmInativarModal({
  isOpen,
  membro,
  onConfirm,
  onCancel,
  carregando = false,
}: ConfirmInativarModalProps) {
  const [motivo, setMotivo] = useState('');

  useEffect(() => {
    if (isOpen) {
      setMotivo('');
    }
  }, [isOpen, membro]);

  if (!isOpen || !membro) return null;

  const cargo = membro.cargo_ministerial || membro.cargoMinisterial;

  const handleConfirm = () => {
    const motivoFinal = motivo.trim() || 'Inativação solicitada via painel da secretaria';
    onConfirm(motivoFinal);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4.5 border-b-2 border-amber-500 bg-gradient-to-r from-amber-600 via-amber-700 to-rose-700 text-white">
          <span className="text-2xl">👤🚫</span>
          <div>
            <h2 className="text-lg font-bold">Confirmar Inativação</h2>
            <p className="text-xs text-amber-100 font-medium">
              Altera o status para Inativo preservando todo o histórico e vínculos
            </p>
          </div>
        </div>

        {/* Conteúdo */}
        <div className="px-6 py-5 space-y-4">
          <p className="text-slate-700 text-sm font-semibold">
            Tem certeza que deseja inativar o cadastro deste membro?
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

          {/* Aviso Educativo: Preservação de dados e reversibilidade */}
          <div className="bg-emerald-50 border-l-4 border-emerald-500 p-3.5 rounded-r-xl">
            <p className="text-xs text-emerald-900 leading-relaxed">
              <span className="font-bold">ℹ️ Histórico e vínculos 100% preservados:</span> A inativação não exclui o registro.
              Documentos emitidos, carteirinhas, dízimos e todo o histórico ministerial são mantidos. O membro poderá ser{' '}
              <span className="font-bold underline">reativado</span> a qualquer momento.
            </p>
          </div>

          {/* Campo: Motivo da Inativação */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
              Motivo da Inativação <span className="text-rose-500">*</span>
            </label>

            {/* Sugestões rápidas de motivos */}
            <div className="flex flex-wrap gap-1.5">
              {MOTIVOS_SUGERIDOS.map((sugestao) => (
                <button
                  key={sugestao}
                  type="button"
                  onClick={() => setMotivo(sugestao)}
                  className={`text-[11px] px-2.5 py-1 rounded-lg border transition font-medium cursor-pointer ${
                    motivo === sugestao
                      ? 'bg-amber-100 border-amber-300 text-amber-900 font-bold'
                      : 'bg-slate-100/80 border-slate-200 text-slate-600 hover:bg-slate-200/70 hover:text-slate-800'
                  }`}
                >
                  {sugestao}
                </button>
              ))}
            </div>

            <textarea
              rows={2}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Descreva o motivo da inativação para registro no histórico..."
              className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition"
            />
          </div>
        </div>

        {/* Botões */}
        <div className="flex gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50/80">
          <button
            type="button"
            onClick={handleConfirm}
            disabled={carregando}
            className="flex-1 px-4 py-2.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white rounded-xl transition font-bold text-xs shadow-sm flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            ✓ Confirmar Inativação
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

export default ConfirmInativarModal;
