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
    <div className="sticky top-0 bg-[#02201d]/90 backdrop-blur-md border-b border-[#0E4D43]/70 px-6 py-4 z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        {onBack && (
          <button
            onClick={onBack}
            type="button"
            className="p-2 rounded-xl bg-[#073B34] text-[#A7C4BC] hover:text-white hover:bg-[#0B453B] border border-[#0E4D43] transition flex items-center justify-center shrink-0 cursor-pointer"
            title="Voltar para a lista de ministérios"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}
        <div>
          <h2 className="text-2xl font-bold text-[#F8FAFC]">{titulo}</h2>
          <p className="text-[#A7C4BC] text-xs mt-1">{descricao}</p>
        </div>
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </div>
  )
}
