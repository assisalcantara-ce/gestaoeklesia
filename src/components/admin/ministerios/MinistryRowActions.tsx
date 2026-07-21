'use client'

import { Pencil, Play, Coins, Tag, Trash2 } from 'lucide-react'
import type { Ministry as SupabaseMinistry } from '@/types/supabase'

interface MinistryRowActionsProps {
  ministerio: SupabaseMinistry
  statusDetail: {
    label: string
    class: string
    type: string
  }
  onEdit: (m: SupabaseMinistry) => void
  onActivate: (m: SupabaseMinistry) => void
  onBilling: (m: SupabaseMinistry) => void
  onPrintLabel: (m: SupabaseMinistry) => void
  onDelete: (m: SupabaseMinistry) => void
}

export default function MinistryRowActions({
  ministerio,
  statusDetail,
  onEdit,
  onActivate,
  onBilling,
  onPrintLabel,
  onDelete,
}: MinistryRowActionsProps) {
  const hasInvoices = (ministerio as any).platform_billing_invoices && (ministerio as any).platform_billing_invoices.length > 0;

  return (
    <td className="px-6 py-4 text-sm flex items-center gap-2">
      <button
        onClick={() => onEdit(ministerio)}
        className="p-1.5 bg-blue-900/40 text-blue-400 hover:text-blue-300 hover:bg-blue-900/60 rounded transition flex items-center justify-center"
        title="Editar"
      >
        <Pencil className="h-4 w-4" />
      </button>
      {(statusDetail.type === 'TRIAL_ATIVO' || statusDetail.type === 'TRIAL_EXPIRADO' || statusDetail.type === 'SUSPENSO') && (
        <button
          onClick={() => onActivate(ministerio)}
          className="p-1.5 bg-yellow-900/40 text-yellow-400 hover:text-yellow-300 hover:bg-yellow-900/60 rounded transition flex items-center justify-center"
          title="Ativar"
        >
          <Play className="h-4 w-4" />
        </button>
      )}
      {!hasInvoices && (
        <button
          onClick={() => onBilling(ministerio)}
          className="p-1.5 bg-green-900/40 text-green-400 hover:text-green-300 hover:bg-green-900/60 rounded transition flex items-center justify-center"
          title="Gerar Fatura"
        >
          <Coins className="h-4 w-4" />
        </button>
      )}
      <button
        onClick={() => onPrintLabel(ministerio)}
        className="p-1.5 bg-purple-900/40 text-purple-400 hover:text-purple-300 hover:bg-purple-900/60 rounded transition flex items-center justify-center"
        title="Imprimir Etiqueta"
      >
        <Tag className="h-4 w-4" />
      </button>
      <button
        onClick={() => onDelete(ministerio)}
        className="p-1.5 bg-red-900/40 text-red-400 hover:text-red-300 hover:bg-red-900/60 rounded transition flex items-center justify-center"
        title="Remover"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </td>
  )
}
