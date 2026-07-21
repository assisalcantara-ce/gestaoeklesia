'use client'

import type { Ministry as SupabaseMinistry } from '@/types/supabase'

interface DeleteConfirmationDialogProps {
  confirmDeleteMinisterio: SupabaseMinistry | null
  deleteLoading: boolean
  onCancel: () => void
  onDelete: () => void
}

export default function DeleteConfirmationDialog({
  confirmDeleteMinisterio,
  deleteLoading,
  onCancel,
  onDelete,
}: DeleteConfirmationDialogProps) {
  if (!confirmDeleteMinisterio) return null

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-red-800 rounded-2xl shadow-2xl max-w-sm w-full p-6 text-gray-100">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-900/60 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-white">Remover ministério?</h2>
        </div>
        <p className="text-sm text-gray-300 mb-1">
          Você está prestes a remover permanentemente:
        </p>
        <div className="bg-gray-800 rounded-lg px-4 py-3 mb-4">
          <p className="font-semibold text-white text-sm">{confirmDeleteMinisterio.name}</p>
          {confirmDeleteMinisterio.email_admin && (
            <p className="text-xs text-gray-400">{confirmDeleteMinisterio.email_admin}</p>
          )}
        </div>
        <div className="bg-red-950/40 border border-red-800/50 rounded-lg px-4 py-3 mb-5">
          <p className="text-xs text-red-400 font-medium">⚠️ Esta ação é irreversível. Todos os dados do ministério serão excluídos.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={deleteLoading}
            className="flex-1 px-4 py-2 bg-gray-700 text-gray-100 rounded-lg hover:bg-gray-600 transition text-sm font-medium disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={onDelete}
            disabled={deleteLoading}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm font-semibold disabled:opacity-50"
          >
            {deleteLoading ? 'Removendo...' : 'Sim, remover'}
          </button>
        </div>
      </div>
    </div>
  )
}
