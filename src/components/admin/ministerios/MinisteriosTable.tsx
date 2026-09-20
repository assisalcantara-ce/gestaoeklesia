'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { Ministry as SupabaseMinistry } from '@/types/supabase'
import Link from 'next/link'
import DashboardEmptyState from '@/components/dashboard/DashboardEmptyState'
import { Inbox, MoreVertical } from 'lucide-react'

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
  onTechnicalAccess?: (m: SupabaseMinistry) => void
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
  onTechnicalAccess,
}: MinisteriosTableProps) {
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null)
  const [dropdownCoords, setDropdownCoords] = useState<{ top: number; left: number } | null>(null)

  // Fechar dropdown ao rolar a página, redimensionar a janela ou pressionar Escape
  useEffect(() => {
    if (!openDropdownId) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenDropdownId(null)
        setDropdownCoords(null)
      }
    }

    const handleClose = () => {
      setOpenDropdownId(null)
      setDropdownCoords(null)
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('scroll', handleClose, true)
    window.addEventListener('resize', handleClose)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('scroll', handleClose, true)
      window.removeEventListener('resize', handleClose)
    }
  }, [openDropdownId])

  if (loading) {
    return <div className="text-center text-gray-400 py-12">Carregando...</div>
  }

  if (ministerios.length === 0) {
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-8 flex items-center justify-center">
        <div className="text-gray-300 dark-theme-empty w-full max-w-lg">
          <DashboardEmptyState
            icon={Inbox}
            title="Nenhum Ministério Cadastrado"
            description="Não há registros de clientes ou tenants cadastrados na plataforma para a consulta selecionada. Inicie adicionando o primeiro!"
            action={{
              label: "+ Novo Ministério",
              onClick: () => {
                window.location.href = '/admin/ministerios/novo'
              },
              icon: Inbox
            }}
          />
        </div>
      </div>
    )
  }

  const totalPages = Math.ceil(totalItems / itemsPerPage)

  const toggleDropdown = (id: string, e: React.MouseEvent<HTMLButtonElement>) => {
    if (openDropdownId === id) {
      setOpenDropdownId(null)
      setDropdownCoords(null)
      return
    }

    const btnRect = e.currentTarget.getBoundingClientRect()
    const menuWidth = 192 // w-48 = 12rem = 192px
    const menuHeight = onTechnicalAccess ? 220 : 180 // altura aproximada do menu com ou sem acesso técnico
    const spaceBelow = window.innerHeight - btnRect.bottom
    const spaceAbove = btnRect.top

    // Se o espaço abaixo for insuficiente e acima tiver mais espaço, abrir para cima
    const openUpwards = spaceBelow < menuHeight && spaceAbove > spaceBelow

    const top = openUpwards
      ? Math.max(8, btnRect.top - menuHeight - 6)
      : Math.min(window.innerHeight - menuHeight - 8, btnRect.bottom + 6)
    const left = Math.max(8, btnRect.right - menuWidth)

    setDropdownCoords({ top, left })
    setOpenDropdownId(id)
  }

  return (
    <div className="bg-[#073B34] border border-[#0E4D43] rounded-2xl shadow-sm overflow-visible">
      <table className="w-full text-left border-collapse">
        <thead className="bg-[#02201d] border-b border-[#0E4D43]">
          <tr>
            <th className="px-6 py-4 text-xs font-bold text-[#A7C4BC] uppercase tracking-wider">Ministério / Contato</th>
            <th className="px-6 py-4 text-xs font-bold text-[#A7C4BC] uppercase tracking-wider">Assinatura e Licença</th>
            <th className="px-6 py-4 text-xs font-bold text-[#A7C4BC] uppercase tracking-wider">Última Atividade</th>
            <th className="px-6 py-4 text-xs font-bold text-[#A7C4BC] uppercase tracking-wider text-right">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#0E4D43]/60">
          {ministerios.map((ministerio) => {
            const statusDetail = getDetailedStatus(ministerio)
            const isDropdownOpen = openDropdownId === ministerio.id

            return (
              <tr key={ministerio.id} className="hover:bg-[#0B453B]/50 transition duration-150">
                {/* Coluna Ministério e Contato agrupados */}
                <td className="px-6 py-4">
                  <div className="flex flex-col space-y-1">
                    <Link
                      href={`/admin/ministerios/${ministerio.id}`}
                      className="text-sm font-semibold text-[#F8FAFC] hover:text-[#10B981] transition"
                    >
                      {ministerio.name}
                    </Link>
                    <span className="text-xs text-[#A7C4BC]">{ministerio.email_admin}</span>
                    {ministerio.phone && (
                      <span className="text-[11px] text-[#6E9B91]">{formatPhoneDisplay(ministerio.phone)}</span>
                    )}
                  </div>
                </td>

                {/* Coluna Status e Licenciamento */}
                <td className="px-6 py-4">
                  <div className="flex flex-col space-y-1 items-start">
                    <span className={`px-2.5 py-0.5 rounded text-[11px] font-bold border ${statusDetail.class}`}>
                      {statusDetail.label}
                    </span>
                    <span className="text-[11px] text-[#A7C4BC]">
                      Plano: <span className="text-[#F8FAFC] uppercase font-semibold">{ministerio.plan || 'Starter'}</span>
                    </span>
                  </div>
                </td>

                {/* Coluna Ultima Atividade */}
                <td className="px-6 py-4 text-sm text-[#A7C4BC]">
                  Não informado
                </td>

                {/* Coluna Acoes com Dropdown */}
                <td className="px-6 py-4 text-right">
                  <div className="relative inline-flex items-center gap-2">
                    <Link
                      href={`/admin/ministerios/${ministerio.id}`}
                      className="px-3 py-1.5 bg-[#059669]/15 hover:bg-[#059669] border border-[#10B981]/30 hover:border-[#10B981] text-[#10B981] hover:text-white rounded-xl text-xs font-semibold transition cursor-pointer"
                    >
                      Abrir Cockpit
                    </Link>

                    <div className="relative">
                      <button
                        onClick={(e) => toggleDropdown(ministerio.id, e)}
                        className="p-1.5 bg-[#032C28] hover:bg-[#0B453B] text-[#A7C4BC] hover:text-white rounded-xl border border-[#0E4D43] transition text-xs font-bold cursor-pointer"
                        title="Mais opções"
                        aria-label="Mais opções"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {isDropdownOpen && typeof document !== 'undefined' && dropdownCoords && createPortal(
                        <>
                          {/* Overlay invisivel para fechar o dropdown */}
                          <div
                            style={{ position: 'fixed', inset: 0, zIndex: 99998 }}
                            onClick={() => {
                              setOpenDropdownId(null)
                              setDropdownCoords(null)
                            }}
                          />
                          <div
                            style={{
                              position: 'fixed',
                              top: `${dropdownCoords.top}px`,
                              left: `${dropdownCoords.left}px`,
                              zIndex: 99999,
                            }}
                            className="w-48 bg-[#02201d] border border-[#0E4D43] rounded-xl shadow-2xl py-1.5 text-left animate-in fade-in zoom-in-95 duration-100"
                          >
                            <button
                              onClick={() => {
                                onEdit(ministerio)
                                setOpenDropdownId(null)
                                setDropdownCoords(null)
                              }}
                              className="w-full px-4 py-2 text-xs font-medium text-[#A7C4BC] hover:bg-[#073B34] hover:text-white transition text-left cursor-pointer"
                            >
                              📝 Editar Cadastro
                            </button>
                            <button
                              onClick={() => {
                                onBilling(ministerio)
                                setOpenDropdownId(null)
                                setDropdownCoords(null)
                              }}
                              className="w-full px-4 py-2 text-xs font-medium text-[#A7C4BC] hover:bg-[#073B34] hover:text-white transition text-left cursor-pointer"
                            >
                              💰 Gerar Cobrança
                            </button>
                            {onTechnicalAccess && (
                              <button
                                onClick={() => {
                                  onTechnicalAccess(ministerio)
                                  setOpenDropdownId(null)
                                  setDropdownCoords(null)
                                }}
                                className="w-full px-4 py-2 text-xs font-semibold text-[#10B981] hover:bg-[#059669]/20 hover:text-white transition text-left flex items-center gap-2 border-t border-[#0E4D43] mt-1 pt-2 cursor-pointer"
                              >
                                <span>🛠️</span>
                                <span>Acesso Técnico Nativo</span>
                              </button>
                            )}
                            <button
                              onClick={() => {
                                onActivate(ministerio)
                                setOpenDropdownId(null)
                                setDropdownCoords(null)
                              }}
                              className="w-full px-4 py-2 text-xs font-medium text-[#A7C4BC] hover:bg-[#073B34] hover:text-white transition text-left cursor-pointer"
                            >
                              ⚡ Ativar / Renovar
                            </button>
                            <button
                              onClick={() => {
                                onPrintLabel(ministerio)
                                setOpenDropdownId(null)
                                setDropdownCoords(null)
                              }}
                              className="w-full px-4 py-2 text-xs font-medium text-[#A7C4BC] hover:bg-[#073B34] hover:text-white transition text-left cursor-pointer"
                            >
                              🏷️ Imprimir Etiqueta
                            </button>
                            <hr className="border-[#0E4D43] my-1" />
                            <button
                              onClick={() => {
                                onDelete(ministerio)
                                setOpenDropdownId(null)
                                setDropdownCoords(null)
                              }}
                              className="w-full px-4 py-2 text-xs font-medium text-rose-400 hover:bg-rose-950/40 transition text-left cursor-pointer"
                            >
                              🚨 Excluir Conta
                            </button>
                          </div>
                        </>,
                        document.body
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
      <div className="px-6 py-4 bg-[#02201d]/60 border-t border-[#0E4D43] flex items-center justify-between gap-4 flex-wrap">
        <span className="text-xs text-[#A7C4BC]">
          Mostrando {totalItems > 0 ? Math.min(totalItems, (currentPage - 1) * itemsPerPage + 1) : 0} a {Math.min(totalItems, currentPage * itemsPerPage)} de {totalItems} ministérios
        </span>
        {totalPages > 1 && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 bg-[#032C28] hover:bg-[#0B453B] text-[#A7C4BC] hover:text-white text-xs font-bold rounded-lg border border-[#0E4D43] transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
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
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                    isCurrent
                      ? 'bg-[#059669] text-white border border-[#10B981]'
                      : 'bg-[#032C28] text-[#A7C4BC] border border-[#0E4D43] hover:bg-[#0B453B] hover:text-white'
                  }`}
                >
                  {p}
                </button>
              )
            })}
            <button
              onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 bg-[#032C28] hover:bg-[#0B453B] text-[#A7C4BC] hover:text-white text-xs font-bold rounded-lg border border-[#0E4D43] transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              Próximo
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
