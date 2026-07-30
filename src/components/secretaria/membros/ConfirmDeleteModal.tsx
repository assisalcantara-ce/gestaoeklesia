'use client';

export interface MembroDeletandoData {
  matricula?: string;
  nome?: string;
  cpf?: string;
}

export interface ConfirmDeleteModalProps {
  isOpen: boolean;
  membro: MembroDeletandoData | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDeleteModal({
  isOpen,
  membro,
  onConfirm,
  onCancel,
}: ConfirmDeleteModalProps) {
  if (!isOpen || !membro) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b-2 border-red-500 bg-gradient-to-r from-red-600 to-red-700">
          <span className="text-3xl">⚠️</span>
          <h2 className="text-lg font-bold text-white">Confirmar Deleção</h2>
        </div>

        {/* Conteúdo */}
        <div className="px-6 py-6 space-y-4">
          <p className="text-gray-700 font-semibold">
            Tem certeza que deseja deletar este membro?
          </p>
          <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
            <p className="text-sm text-gray-700">
              <span className="font-semibold">Matrícula:</span> {membro.matricula || '—'}
            </p>
            <p className="text-sm text-gray-700">
              <span className="font-semibold">Nome:</span> {membro.nome || '—'}
            </p>
            <p className="text-sm text-gray-700">
              <span className="font-semibold">CPF:</span> {membro.cpf || '—'}
            </p>
          </div>
          <div className="bg-yellow-50 border-l-4 border-yellow-500 p-3 rounded">
            <p className="text-xs text-yellow-800">
              <span className="font-semibold">⚠️ Atenção:</span> Esta ação é irreversível e não pode ser desfeita.
            </p>
          </div>
        </div>

        {/* Botões */}
        <div className="flex gap-4 px-6 py-4 border-t border-gray-300 bg-gray-50">
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg hover:from-red-700 hover:to-red-800 transition font-semibold text-sm"
          >
            ✓ Deletar
          </button>
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition font-semibold text-sm"
          >
            ✕ Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
