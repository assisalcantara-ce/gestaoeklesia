'use client'

import type { Ministry as SupabaseMinistry } from '@/types/supabase'
import Link from 'next/link'
import MinistryRowActions from './MinistryRowActions'

interface MinisteriosTableProps {
  loading: boolean
  ministerios: SupabaseMinistry[]
  totalItems: number
  currentPage: number
  itemsPerPage: number
  onPageChange: (page: number) => void
  getDetailedStatus: (m: SupabaseMinistry) => {
    label: string
    class: string
    type: string
  }
  formatPhoneDisplay: (value: string | null | undefined) => string
  onEdit: (m: SupabaseMinistry) => void
  onActivate: (m: SupabaseMinistry) => void
  onBilling: (m: SupabaseMinistry) => void
  onPrintLabel: (m: SupabaseMinistry) => void
  onDelete: (m: SupabaseMinistry) => void
}

export default function MinisteriosTable({
  loading,
  ministerios,
  totalItems,
  currentPage,
  itemsPerPage,
  onPageChange,
  getDetailedStatus,
  formatPhoneDisplay,
  onEdit,
  onActivate,
  onBilling,
  onPrintLabel,
  onDelete,
}: MinisteriosTableProps) {
  if (loading) {
    return <div className="text-center text-gray-400 py-12">Carregando...</div>
  }

  if (ministerios.length === 0) {
    return (
      <div className="text-center text-gray-400 py-12">
        Nenhum ministério cadastrado
      </div>
    )
  }

  const totalPages = Math.ceil(totalItems / itemsPerPage)

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg shadow overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-900">
          <tr>
            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-300">Nome</th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-300">Email</th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-300">Telefone</th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-300">Status</th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-300">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-700">
          {ministerios.map((ministerio) => {
            const statusDetail = getDetailedStatus(ministerio)
            return (
              <tr key={ministerio.id} className="hover:bg-gray-700/40">
                <td className="px-6 py-4 text-sm text-gray-100">
                  <Link href={`/admin/ministerios/${ministerio.id}`} className="hover:text-blue-400 font-medium transition">
                    {ministerio.name}
                  </Link>
                </td>
                <td className="px-6 py-4 text-sm text-gray-300">{ministerio.email_admin}</td>
                <td className="px-6 py-4 text-sm text-gray-300">{formatPhoneDisplay(ministerio.phone)}</td>
                <td className="px-6 py-4 text-sm">
                  <div className="flex flex-col gap-1">
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold self-start border ${statusDetail.class}`}>
                      {statusDetail.label}
                    </span>
                    {ministerio.plan && (
                      <span className="text-[10px] text-gray-400 uppercase tracking-wider">
                        Plano: {ministerio.plan}
                      </span>
                    )}
                  </div>
                </td>
                <MinistryRowActions
                  ministerio={ministerio}
                  statusDetail={statusDetail}
                  onEdit={onEdit}
                  onActivate={onActivate}
                  onBilling={onBilling}
                  onPrintLabel={onPrintLabel}
                  onDelete={onDelete}
                />
              </tr>
            )
          })}
        </tbody>
      </table>

      {/* Paginação */}
      {totalItems > itemsPerPage && (
        <div className="px-6 py-4 bg-gray-900/50 border-t border-gray-700 flex items-center justify-between gap-4 flex-wrap">
          <span className="text-xs text-gray-400">
            Mostrando {Math.min(totalItems, (currentPage - 1) * itemsPerPage + 1)} a {Math.min(totalItems, currentPage * itemsPerPage)} de {totalItems} ministérios
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white text-xs font-bold rounded-lg border border-gray-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Anterior
            </button>
            {Array.from({ length: totalPages }).map((_, idx) => {
              const p = idx + 1
              const isCurrent = p === currentPage
              return (
                <button
                  key={p}
                  onClick={() => onPageChange(p)}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                    isCurrent
                      ? 'bg-blue-600 text-white border border-blue-500'
                      : 'bg-gray-800 text-gray-300 border border-gray-700 hover:bg-gray-700 hover:text-white'
                  }`}
                >
                  {p}
                </button>
              )
            })}
            <button
              onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white text-xs font-bold rounded-lg border border-gray-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Próximo
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
