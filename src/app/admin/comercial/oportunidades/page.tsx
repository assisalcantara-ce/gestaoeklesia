'use client'

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { authenticatedFetch } from '@/lib/api-client'
import { useAdminAuth } from '@/providers/AdminAuthProvider'
import AdminSidebar from '@/components/AdminSidebar'

import {
  Briefcase,
  Search,
  Calendar,
  User,
  Mail,
  Phone,
  Clock,
  Edit2,
  X
} from 'lucide-react'

type Oportunidade = {
  id: string
  ministry_id: string
  ministry_name: string
  responsavel: string
  email: string
  telefone: string
  plano_solicitado: string
  observacao: string | null
  observacao_interna: string | null
  created_at: string
  updated_at?: string
  updated_by?: string | null
  status: string
  historico?: Array<{
    id: string
    status_anterior: string
    status_novo: string
    usuario: string
    observacao: string
    created_at: string
  }>
}

export default function OportunidadesPage() {
  const { isLoading, isAuthenticated } = useAdminAuth()
  const router = useRouter()


  const [oportunidades, setOportunidades] = useState<Oportunidade[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Estados dos filtros
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterPlano, setFilterPlano] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')

  // Estado da Oportunidade Selecionada (Modal de Edição)
  const [selectedOpt, setSelectedOpt] = useState<Oportunidade | null>(null)
  const [editStatus, setEditStatus] = useState('')
  const [editObservacaoInterna, setEditObservacaoInterna] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/admin/login')
    }
  }, [isLoading, isAuthenticated, router])

  useEffect(() => {
    if (isAuthenticated) {
      fetchOportunidades()
    }
  }, [isAuthenticated])

  const fetchOportunidades = async () => {
    try {
      setLoading(true)
      const response = await authenticatedFetch('/api/v1/admin/oportunidades')
      if (!response.ok) {
        throw new Error('Erro ao carregar oportunidades')
      }
      const data = await response.json()
      setOportunidades(data.oportunidades || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleOpenDetail = (opt: Oportunidade) => {
    setSelectedOpt(opt)
    setEditStatus(opt.status)
    setEditObservacaoInterna(opt.observacao_interna || '')
    setSuccess('')
    setError('')
  }

  const handleSaveStatus = async () => {
    if (!selectedOpt) return
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const response = await authenticatedFetch(`/api/v1/admin/oportunidades/${selectedOpt.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: editStatus,
          observacao_interna: editObservacaoInterna
        })
      })

      if (!response.ok) {
        const payload = await response.json()
        throw new Error(payload.error || 'Erro ao atualizar oportunidade')
      }

      setSuccess('Oportunidade atualizada com sucesso!')
      
      // Atualiza lista localmente, gravando reativamente a entrada de histórico
      setOportunidades(prev =>
        prev.map(item => {
          if (item.id === selectedOpt.id) {
            const novoHistorico = [
              {
                id: Math.random().toString(),
                status_anterior: selectedOpt.status,
                status_novo: editStatus,
                usuario: 'Você (Admin)',
                observacao: editObservacaoInterna,
                created_at: new Date().toISOString()
              },
              ...(item.historico || [])
            ]
            return {
              ...item,
              status: editStatus,
              observacao_interna: editObservacaoInterna,
              historico: novoHistorico
            }
          }
          return item
        })
      )

      setTimeout(() => {
        setSelectedOpt(null)
      }, 1500)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  // Filtragem local
  const filteredOportunidades = oportunidades.filter((opt) => {
    const matchesStatus = filterStatus === 'all' || opt.status.toLowerCase() === filterStatus.toLowerCase()
    const matchesPlano = filterPlano === 'all' || opt.plano_solicitado.toLowerCase().includes(filterPlano.toLowerCase())
    const matchesSearch = opt.ministry_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      opt.responsavel.toLowerCase().includes(searchTerm.toLowerCase()) ||
      opt.email.toLowerCase().includes(searchTerm.toLowerCase())

    return matchesStatus && matchesPlano && matchesSearch
  })

  const getStatusBadgeClass = (status: string) => {
    switch (status.toLowerCase().trim()) {
      case 'novo':
        return 'bg-red-100 text-red-800'
      case 'primeiro contato':
      case 'primeiro_contato':
        return 'bg-indigo-100 text-indigo-800'
      case 'em negociação':
      case 'em_negociacao':
        return 'bg-blue-100 text-blue-800'
      case 'proposta enviada':
      case 'proposta_enviada':
        return 'bg-amber-100 text-amber-800'
      case 'aguardando cliente':
      case 'aguardando_cliente':
        return 'bg-purple-100 text-purple-800'
      case 'convertido':
        return 'bg-green-100 text-green-800'
      case 'perdido':
        return 'bg-slate-100 text-slate-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }


  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-900 text-white">
        Carregando...
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-gray-900">
      <AdminSidebar />

      <main className="flex-1 overflow-auto">
        {/* Top Header */}
        <div className="sticky top-0 bg-gray-950 border-b border-gray-800 px-6 py-4 z-10 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <Briefcase className="text-blue-500" />
              Comercial: Oportunidades
            </h2>
            <p className="text-gray-400 text-sm mt-1">
              Acompanhe as propostas e solicitações dos planos comerciais do Gestão Eklésia.
            </p>
          </div>
        </div>

        {/* Content Area */}
        <div className="p-6 space-y-6">
          
          {/* Barra de Filtros */}
          <div className="bg-gray-800 p-4 rounded-xl border border-gray-700 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Busca por Ministério</label>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-3.5 text-gray-500" />
                <input
                  type="text"
                  placeholder="Nome do ministério ou responsável..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Status</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full px-3 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="all">Todos os Status</option>
                <option value="novo">Novo</option>
                <option value="primeiro contato">Primeiro Contato</option>
                <option value="em negociação">Em Negociação</option>
                <option value="proposta enviada">Proposta Enviada</option>
                <option value="aguardando cliente">Aguardando Cliente</option>
                <option value="convertido">Convertido</option>
                <option value="perdido">Perdido</option>
              </select>
            </div>


            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Plano solicitado</label>
              <select
                value={filterPlano}
                onChange={(e) => setFilterPlano(e.target.value)}
                className="w-full px-3 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="all">Todos os Planos</option>
                <option value="starter">Starter</option>
                <option value="intermediario">Intermediário</option>
                <option value="profissional">Profissional</option>
              </select>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setSearchTerm('')
                  setFilterStatus('all')
                  setFilterPlano('all')
                }}
                className="w-full py-2.5 bg-gray-700 hover:bg-gray-650 text-white rounded-lg text-sm font-semibold transition"
              >
                Limpar Filtros
              </button>
            </div>
          </div>

          {/* Listagem */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
            {loading ? (
              <div className="p-12 text-center text-gray-400 font-semibold">
                Carregando solicitações comerciais...
              </div>
            ) : filteredOportunidades.length === 0 ? (
              <div className="p-12 text-center text-gray-400 font-semibold">
                Nenhuma oportunidade comercial encontrada com os filtros selecionados.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-300">
                  <thead className="bg-gray-900/60 border-b border-gray-700 text-xs font-semibold uppercase tracking-wider text-gray-400">
                    <tr>
                      <th className="px-6 py-4">Ministério</th>
                      <th className="px-6 py-4">Responsável</th>
                      <th className="px-6 py-4">Plano</th>
                      <th className="px-6 py-4">Data Solicitação</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {filteredOportunidades.map((opt) => (
                      <tr key={opt.id} className="hover:bg-gray-750 transition">
                        <td className="px-6 py-4 font-bold text-white">
                          {opt.ministry_name}
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-semibold text-slate-100">{opt.responsavel}</div>
                          <div className="text-xs text-gray-400 mt-0.5">{opt.email}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-bold text-blue-400">{opt.plano_solicitado}</span>
                        </td>
                        <td className="px-6 py-4 text-xs font-semibold text-gray-400">
                          {new Date(opt.created_at).toLocaleDateString('pt-BR')} às {new Date(opt.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold ${getStatusBadgeClass(opt.status)}`}>
                            {opt.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => handleOpenDetail(opt)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 hover:text-blue-300 font-bold rounded-lg text-xs transition"
                          >
                            <Edit2 size={12} />
                            Ver Detalhes
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Modal Lateral de Detalhes da Oportunidade */}
      {selectedOpt && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/60 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-gray-900 border-l border-gray-800 h-full p-6 md:p-8 flex flex-col justify-between overflow-y-auto">
            <div className="space-y-6">
              <div className="flex justify-between items-start">
                <div>
                  <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold ${getStatusBadgeClass(selectedOpt.status)}`}>
                    {selectedOpt.status}
                  </span>
                  <h3 className="text-xl font-bold text-white mt-2">{selectedOpt.ministry_name}</h3>
                </div>
                <button
                  onClick={() => setSelectedOpt(null)}
                  className="p-1 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Sucesso/Erro no Modal */}
              {success && (
                <div className="bg-emerald-950/40 border border-emerald-900 text-emerald-300 px-4 py-3 rounded-lg text-xs font-semibold">
                  {success}
                </div>
              )}
              {error && (
                <div className="bg-red-950/40 border border-red-900 text-red-300 px-4 py-3 rounded-lg text-xs font-semibold">
                  {error}
                </div>
              )}

              {/* Informações Completas */}
              <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 border-b border-gray-700 pb-2">Dados de Contato</h4>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-2.5 text-gray-300">
                    <User size={16} className="text-gray-500" />
                    <span className="font-semibold text-white">{selectedOpt.responsavel}</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-gray-300">
                    <Mail size={16} className="text-gray-500" />
                    <a href={`mailto:${selectedOpt.email}`} className="hover:underline hover:text-blue-400">{selectedOpt.email}</a>
                  </div>
                  <div className="flex items-center gap-2.5 text-gray-300">
                    <Phone size={16} className="text-gray-500" />
                    <span>{selectedOpt.telefone || 'Sem telefone cadastrado'}</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-gray-300">
                    <Calendar size={16} className="text-gray-500" />
                    <span>Solicitado em: {new Date(selectedOpt.created_at).toLocaleDateString('pt-BR')} às {new Date(selectedOpt.created_at).toLocaleTimeString('pt-BR')}</span>
                  </div>
                </div>
              </div>

              {/* Detalhes da Proposta */}
              <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 border-b border-gray-700 pb-2">Plano Solicitado</h4>
                <p className="text-sm font-bold text-blue-400">{selectedOpt.plano_solicitado}</p>
                {selectedOpt.observacao && (
                  <div className="mt-3">
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Observações do Lead:</p>
                    <p className="text-xs text-gray-300 bg-gray-900 p-2.5 border border-gray-750 rounded-lg mt-1 whitespace-pre-wrap">{selectedOpt.observacao}</p>
                  </div>
                )}
              </div>

              {/* Alterar Status */}
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400">Alterar Status</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="Novo">Novo</option>
                  <option value="Primeiro Contato">Primeiro Contato</option>
                  <option value="Em Negociação">Em Negociação</option>
                  <option value="Proposta Enviada">Proposta Enviada</option>
                  <option value="Aguardando Cliente">Aguardando Cliente</option>
                  <option value="Convertido">Convertido</option>
                  <option value="Perdido">Perdido</option>
                </select>
              </div>

              {/* Observação Interna */}
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400">Observações Internas (Histórico Comercial)</label>
                <textarea
                  rows={4}
                  value={editObservacaoInterna}
                  onChange={(e) => setEditObservacaoInterna(e.target.value)}
                  placeholder="Escreva anotações internas, propostas enviadas ou histórico de contato comercial..."
                  className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500 outline-none resize-none"
                />
              </div>

              {selectedOpt.updated_at && (
                <div className="flex items-center gap-1.5 text-[10px] text-gray-500 font-semibold">
                  <Clock size={12} />
                  Atualizado em {new Date(selectedOpt.updated_at).toLocaleDateString('pt-BR')} por {selectedOpt.updated_by || 'Sistema'}
                </div>
              )}

              {/* Histórico da Negociação */}
              <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 border-b border-gray-700 pb-2">Histórico da Negociação</h4>
                {selectedOpt.historico && selectedOpt.historico.length > 0 ? (
                  <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                    {selectedOpt.historico.map((h) => (
                      <div key={h.id} className="text-xs bg-gray-900/60 p-2.5 rounded-lg border border-gray-750 space-y-1">
                        <div className="flex justify-between items-center text-[10px] font-bold text-gray-500 uppercase">
                          <span>{h.usuario || 'Sistema'}</span>
                          <span>{new Date(h.created_at).toLocaleDateString('pt-BR')} às {new Date(h.created_at).toLocaleTimeString('pt-BR')}</span>
                        </div>
                        {h.status_anterior && h.status_novo && (
                          <div className="text-slate-300 font-semibold mt-0.5">
                            Status: <span className="text-red-400">{h.status_anterior}</span> → <span className="text-emerald-400">{h.status_novo}</span>
                          </div>
                        )}
                        {h.observacao && (
                          <p className="text-gray-400 mt-1 italic whitespace-pre-wrap">{h.observacao}</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 italic">Nenhuma movimentação comercial registrada ainda.</p>
                )}
              </div>
            </div>


            <div className="flex gap-3 pt-6 border-t border-gray-800 mt-6">
              <button
                onClick={() => setSelectedOpt(null)}
                className="flex-1 py-2.5 bg-gray-800 hover:bg-gray-750 text-white rounded-lg text-sm font-semibold transition cursor-pointer"
                disabled={saving}
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveStatus}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition cursor-pointer"
                disabled={saving}
              >
                {saving ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
