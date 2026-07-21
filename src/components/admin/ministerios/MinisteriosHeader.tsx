'use client'

interface MinisteriosHeaderProps {
  titulo: string
  descricao: string
}

export default function MinisteriosHeader({ titulo, descricao }: MinisteriosHeaderProps) {
  return (
    <div className="sticky top-0 bg-gray-950 border-b border-gray-800 px-6 py-4 z-10">
      <h2 className="text-2xl font-bold text-white">{titulo}</h2>
      <p className="text-gray-400 text-sm mt-1">{descricao}</p>
    </div>
  )
}
