'use client'

interface MinisteriosToolbarProps {
  showForm: boolean
  editingId: string | null
  onToggleForm: () => void
  onOpenImport: () => void
}

export default function MinisteriosToolbar({
  showForm,
  editingId,
  onToggleForm,
  onOpenImport,
}: MinisteriosToolbarProps) {
  return (
    <div className="mb-6 flex items-center gap-3 flex-wrap">
      <button
        onClick={onToggleForm}
        className={`px-6 py-2 text-white rounded transition ${
          showForm
            ? editingId
              ? 'bg-red-600 hover:bg-red-700'
              : 'bg-gray-700 hover:bg-gray-600'
            : 'bg-blue-600 hover:bg-blue-700'
        }`}
      >
        {showForm ? (editingId ? 'Cancelar edição' : 'Cancelar') : '+ Novo Ministério'}
      </button>
      <button
        onClick={onOpenImport}
        className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded transition text-sm font-medium"
      >
        📥 Importar CSV
      </button>
    </div>
  )
}
