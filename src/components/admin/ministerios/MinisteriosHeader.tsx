'use client'

import { ArrowLeft } from 'lucide-react'

interface MinisteriosHeaderProps {
  titulo: string
  descricao: string
  onBack?: () => void
  actions?: React.ReactNode
}

export default function MinisteriosHeader({ titulo, descricao, onBack, actions }: MinisteriosHeaderProps) {
  return (
    <div className="sticky top-0 bg-gray-950 border-b border-gray-800 px-6 py-4 z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        {onBack && (
          <button
            onClick={onBack}
            type="button"
            className="p-2 rounded-lg bg-gray-800 text-gray-300 hover:text-white hover:bg-gray-700 border border-gray-700 transition flex items-center justify-center shrink-0"
            title="Voltar para a lista de ministérios"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}
        <div>
          <h2 className="text-2xl font-bold text-white">{titulo}</h2>
          <p className="text-gray-400 text-sm mt-1">{descricao}</p>
        </div>
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </div>
  )
}
