'use client'

import { useState, useEffect } from 'react'
import { AlertCircle, CheckCircle, Eye } from 'lucide-react'
import NotificationModal from './NotificationModal'
import { authenticatedFetch } from '@/lib/api-client'

interface PreRegistration {
  id: string
  ministry_name: string
  pastor_name: string
  email: string
  whatsapp: string
  cpf_cnpj: string
  quantity_temples: number
  quantity_members: number
  trial_expires_at: string
  status: 'trial' | 'encerrado'
  created_at: string
}

export default function TrialSignupsWidget() {
  const [signups, setSignups] = useState<PreRegistration[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'trial' | 'encerrado'>('trial')
  const [selectedSignup, setSelectedSignup] = useState<PreRegistration | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [notification, setNotification] = useState<{ isOpen: boolean; type: 'success' | 'error' | 'warning' | 'info'; title: string; message: string }>({ isOpen: false, type: 'success', title: '', message: '' })
  const fetchTrialSignups = async () => {
    try {
      setLoading(true)
      const response = await authenticatedFetch('/api/v1/admin/pre-registrations?limit=50')
      if (!response.ok) {
        throw new Error('Erro ao carregar pré-cadastros')
      }

      const payload = await response.json()
      setSignups(payload.data || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTrialSignups()
  }, [])

  const daysUntilExpiry = (expiryDate: string) => {
    const expiry = new Date(expiryDate)
    const today = new Date()
    const diff = expiry.getTime() - today.getTime()
    return Math.ceil(diff / (1000 * 60 * 60 * 24))
  }

  const filteredSignups = signups.filter(s => s.status === activeTab)

  if (loading) {
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-lg shadow p-6">
        <p className="text-gray-400">Carregando...</p>
      </div>
    )
  }

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg shadow p-6">
      {/* Header com abas */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-white">
            📝 Pré-Cadastros
          </h3>
          <span className="inline-flex items-center justify-center w-6 h-6 text-xs font-bold leading-none text-white transform bg-blue-600 rounded-full">
            {signups.length}
          </span>
        </div>
        <button
          type="button"
          onClick={fetchTrialSignups}
          className="px-3 py-1 rounded-lg bg-orange-500 text-white text-xs font-semibold hover:bg-orange-400"
        >
          Atualizar
        </button>
      </div>

      {/* Abas */}
      <div className="flex gap-2 mb-4 border-b border-gray-700">
        <button
          onClick={() => setActiveTab('trial')}
          className={`px-4 py-2 text-sm font-medium transition ${
            activeTab === 'trial'
              ? 'text-green-400 border-b-2 border-green-400'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          Em Teste ({signups.filter(s => s.status === 'trial').length})
        </button>
        <button
          onClick={() => setActiveTab('encerrado')}
          className={`px-4 py-2 text-sm font-medium transition ${
            activeTab === 'encerrado'
              ? 'text-red-400 border-b-2 border-red-400'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          Expirado ({signups.filter(s => s.status === 'encerrado').length})
        </button>
      </div>

      {filteredSignups.length === 0 ? (
        <p className="text-gray-400 text-sm py-4">
          {activeTab === 'trial' ? 'Nenhum pré-cadastro em teste' : 'Nenhum pré-cadastro expirado'}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-700 bg-gray-900">
              <tr>
                <th className="text-left px-4 py-2 font-semibold text-gray-300">
                  Ministério
                </th>
                <th className="text-left px-4 py-2 font-semibold text-gray-300">
                  Pastor
                </th>
                <th className="text-left px-4 py-2 font-semibold text-gray-300">
                  Email
                </th>
                <th className="text-left px-4 py-2 font-semibold text-gray-300">
                  Vence em
                </th>
                <th className="text-left px-4 py-2 font-semibold text-gray-300">
                  Cadastrado
                </th>
                <th className="text-center px-4 py-2 font-semibold text-gray-300">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {filteredSignups.map((signup) => (
                <tr key={signup.id} className="hover:bg-gray-700/40 transition">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-100">
                      {signup.ministry_name}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-gray-300">
                    {signup.pastor_name}
                  </td>
                  <td className="px-4 py-3 text-gray-300 text-xs">
                    {signup.email}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className="text-red-400 font-semibold">
                      {new Date(signup.trial_expires_at).toLocaleDateString('pt-BR')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {new Date(signup.created_at).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 justify-center">
                      <button
                        onClick={() => {
                          setSelectedSignup(signup)
                          setShowDetailModal(true)
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-blue-500 text-white text-xs font-medium rounded hover:bg-blue-600 transition"
                        title="Ver detalhes"
                      >
                        <Eye className="w-3 h-3" />
                        Ver
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-gray-700">
        <p className="text-xs text-gray-500">
          💡 Dica: Use a aba "Em Teste" para acompanhar trials ativos. "Expirado" mostra testes que já venceram.
        </p>
      </div>

      {/* Modal de Detalhes */}
      {showDetailModal && selectedSignup && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-lg shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto text-gray-100">
            <h2 className="text-2xl font-bold text-white mb-4">
              📋 {selectedSignup.ministry_name}
            </h2>

            <div className="space-y-4 mb-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-400 font-semibold uppercase">Pastor</p>
                  <p className="text-sm text-gray-100">{selectedSignup.pastor_name}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 font-semibold uppercase">Status</p>
                  <p className="text-sm font-medium">
                    {selectedSignup.status === 'trial' ? (
                      <span className="text-green-400">Em Teste</span>
                    ) : (
                      <span className="text-red-400">Expirado</span>
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 font-semibold uppercase">Email</p>
                  <p className="text-sm text-gray-100">{selectedSignup.email}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 font-semibold uppercase">WhatsApp</p>
                  <p className="text-sm text-gray-100">{selectedSignup.whatsapp}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 font-semibold uppercase">CPF/CNPJ</p>
                  <p className="text-sm text-gray-100">{selectedSignup.cpf_cnpj}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 font-semibold uppercase">Templos</p>
                  <p className="text-sm text-gray-100">{selectedSignup.quantity_temples}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 font-semibold uppercase">Membros</p>
                  <p className="text-sm text-gray-100">{selectedSignup.quantity_members}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 font-semibold uppercase">Cadastrado em</p>
                  <p className="text-sm text-gray-100">
                    {new Date(selectedSignup.created_at).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              </div>

              {selectedSignup.status === 'trial' && (
                <div className="bg-blue-900/40 border border-blue-700 rounded-lg p-3">
                  <p className="text-xs text-blue-300 font-semibold uppercase mb-2">Validade do Trial</p>
                  <p className="text-sm text-blue-100">
                    Vence em {new Date(selectedSignup.trial_expires_at).toLocaleDateString('pt-BR')}
                  </p>
                  <p className="text-xs text-blue-300 mt-2">
                    ({daysUntilExpiry(selectedSignup.trial_expires_at)} dias restantes)
                  </p>
                </div>
              )}

              {selectedSignup.status === 'encerrado' && (
                <div className="bg-red-900/40 border border-red-700 rounded-lg p-3">
                  <p className="text-xs text-red-300 font-semibold uppercase">Expirado</p>
                  <p className="text-sm text-red-100">
                    Expirou em {new Date(selectedSignup.trial_expires_at).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              )}
            </div>

            <button
              onClick={() => setShowDetailModal(false)}
              className="w-full px-4 py-2 bg-gray-700 text-gray-100 rounded-lg hover:bg-gray-600 transition font-medium"
            >
              Fechar
            </button>
          </div>
        </div>
      )}


      {/* Notificação Modal */}
      <NotificationModal
        isOpen={notification.isOpen}
        type={notification.type}
        title={notification.title}
        message={notification.message}
        onClose={() => setNotification({ ...notification, isOpen: false })}
        autoClose={notification.type === 'success' ? 3000 : undefined}
      />
    </div>
  )
}
