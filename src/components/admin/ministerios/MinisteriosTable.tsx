'use client'

import { useState } from 'react'
import type { Ministry as SupabaseMinistry } from '@/types/supabase'
import Link from 'next/link'

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
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null)

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

  const toggleDropdown = (id: string) => {
    if (openDropdownId === id) {
      setOpenDropdownId(null)
    } else {
      setOpenDropdownId(id)
    }
  }

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg shadow overflow-visible">
      <table className="w-full text-left border-collapse">
        <thead className="bg-gray-900 border-b border-gray-750">
          <tr>
            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Ministério / Contato</th>
            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Assinatura e Licença</th>
            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Última Atividade</th>
            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-750">
          {ministerios.map((ministerio) => {
            const statusDetail = getDetailedStatus(ministerio)
            const isDropdownOpen = openDropdownId === ministerio.id

            return (
              <tr key={ministerio.id} className="hover:bg-gray-700/30 transition duration-150">
                {/* Coluna Ministério e Contato agrupados */}
                <td className="px-6 py-4">
                  <div className="flex flex-col space-y-1">
                    <Link
                      href={`/admin/ministerios/${ministerio.id}`}
                      className="text-sm font-semibold text-white hover:text-blue-400 transition"
                    >
                      {ministerio.name}
                    </Link>
                    <span className="text-xs text-gray-400">{ministerio.email_admin}</span>
                    {ministerio.phone && (
                      <span className="text-[11px] text-gray-500">{formatPhoneDisplay(ministerio.phone)}</span>
                    )}
                  </div>
                </td>

                {/* Coluna Status e Licenciamento */}
                <td className="px-6 py-4">
                  <div className="flex flex-col space-y-1 items-start">
                    <span className={`px-2.5 py-0.5 rounded text-[11px] font-bold border ${statusDetail.class}`}>
                      {statusDetail.label}
                    </span>
                    <span className="text-[11px] text-gray-400">
                      Plano: <span className="text-gray-200 uppercase font-semibold">{ministerio.plan || 'Starter'}</span>
                    </span>
                  </div>
                </td>

                {/* Coluna Ultima Atividade */}
                <td className="px-6 py-4 text-sm text-gray-400">
                  Não informado
                </td>

                {/* Coluna Acoes com Dropdown */}
                <td className="px-6 py-4 text-right">
                  <div className="relative inline-flex items-center gap-2">
                    <Link
                      href={`/admin/ministerios/${ministerio.id}`}
                      className="px-3 py-1.5 bg-blue-600/10 hover:bg-blue-600 border border-blue-500/20 hover:border-blue-500 text-blue-300 hover:text-white rounded-lg text-xs font-semibold transition"
                    >
                      Abrir Cockpit
                    </Link>

                    <div className="relative">
                      <button
                        onClick={() => toggleDropdown(ministerio.id)}
                        className="px-2 py-1.5 bg-gray-700 hover:bg-gray-650 text-gray-300 hover:text-white rounded-lg border border-gray-600 transition text-xs font-bold"
                      >
                        ⚙️
                      </button>

                      {isDropdownOpen && (
                        <>
                          {/* Overlay invisivel para fechar o dropdown */}
                          <div className="fixed inset-0 z-10" onClick={() => setOpenDropdownId(null)} />
                          <div className="absolute right-0 mt-2 w-48 bg-gray-900 border border-gray-750 rounded-lg shadow-xl py-1.5 z-20 text-left">
                            <button
                              onClick={() => {
                                onEdit(ministerio)
                                setOpenDropdownId(null)
                              }}
                              className="w-full px-4 py-2 text-xs font-medium text-gray-300 hover:bg-gray-800 hover:text-white transition text-left"
                            >
                              📝 Editar Cadastro
                            </button>
                            <button
                              onClick={() => {
                                onBilling(ministerio)
                                setOpenDropdownId(null)
                              }}
                              className="w-full px-4 py-2 text-xs font-medium text-gray-300 hover:bg-gray-800 hover:text-white transition text-left"
                            >
                              💰 Gerar Cobrança
                            </button>
                            <button
                              onClick={() => {
                                onActivate(ministerio)
                                setOpenDropdownId(null)
                              }}
                              className="w-full px-4 py-2 text-xs font-medium text-gray-300 hover:bg-gray-800 hover:text-white transition text-left"
                            >
                              ⚡ Ativar / Renovar
                            </button>
                            <button
                              onClick={() => {
                                onPrintLabel(ministerio)
                                setOpenDropdownId(null)
                              }}
                              className="w-full px-4 py-2 text-xs font-medium text-gray-300 hover:bg-gray-800 hover:text-white transition text-left"
                            >
                              🏷️ Imprimir Etiqueta
                            </button>
                            <hr className="border-gray-800 my-1" />
                            <button
                              onClick={() => {
                                onDelete(ministerio)
                                setOpenDropdownId(null)
                              }}
                              className="w-full px-4 py-2 text-xs font-medium text-red-400 hover:bg-red-950/20 transition text-left"
                            >
                              🚨 Excluir Conta
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {/* Paginação */}
      {totalItems > itemsPerPage && (
        <div className="px-6 py-4 bg-gray-900/50 border-t border-gray-750 flex items-center justify-between gap-4 flex-wrap">
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
