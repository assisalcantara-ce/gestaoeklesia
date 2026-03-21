'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase-client'
import { AlertCircle, CheckCircle, Clock, Check, X, Loader, Key, Eye } from 'lucide-react'
import NotificationModal from './NotificationModal'
import { useAppDialog } from '@/providers/AppDialogProvider'

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
  status: 'pending' | 'active' | 'expired' | 'converted'
  created_at: string
}

export default function TrialSignupsWidget() {
  const dialog = useAppDialog()
  const [signups, setSignups] = useState<PreRegistration[]>([])
  const [loading, setLoading] = useState(true)
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [selectedSignup, setSelectedSignup] = useState<PreRegistration | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showCredsModal, setShowCredsModal] = useState(false)
  const [generatingCreds, setGeneratingCreds] = useState(false)
  const [generatedCreds, setGeneratedCreds] = useState<any>(null)
  const [notification, setNotification] = useState<{ isOpen: boolean; type: 'success' | 'error' | 'warning' | 'info'; title: string; message: string }>({ isOpen: false, type: 'success', title: '', message: '' })
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null)

  useEffect(() => {
    if (!supabaseRef.current) {
      supabaseRef.current = createClient()
    }
    
    const supabase = supabaseRef.current
    
    const fetchTrialSignups = async () => {
      try {
        setLoading(true)
        const { data, error } = await supabase
          .from('pre_registrations')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(10)

        if (!error && data) {
          setSignups(data)
        }
      } finally {
        setLoading(false)
      }
    }
    
    fetchTrialSignups()
  }, [])

  const handleApprove = async (preRegId: string) => {
    setApprovingId(preRegId)
    try {
      // Inicializar atendimento (criar registro de attendance_status)
      const initResponse = await fetch('/api/v1/admin/attendance/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pre_registration_id: preRegId })
      })

      const initData = await initResponse.json()

      if (!initData.success) {
        setNotification({ 
          isOpen: true, 
          type: 'error', 
          title: 'Erro ao Inicializar Atendimento', 
          message: initData.error || 'Erro desconhecido' 
        })
        return
      }

      // Redirecionar para o painel de atendimento
      setNotification({ 
        isOpen: true, 
        type: 'success', 
        title: 'Atendimento Iniciado', 
        message: 'Redirecionando para o painel...' 
      })

      // Aguardar 1 segundo para mostrar mensagem, depois redireciona
      setTimeout(() => {
        window.location.href = `/admin/atendimento?focus=${preRegId}`
      }, 1000)

    } catch (error) {
      setNotification({ 
        isOpen: true, 
        type: 'error', 
        title: 'Erro ao processar', 
        message: error instanceof Error ? error.message : String(error) 
      })
    } finally {
      setApprovingId(null)
    }
  }

  const handleGenerateTestCredentials = async () => {
    if (!selectedSignup) return
    
    setGeneratingCreds(true)
    try {
      const response = await fetch('/api/v1/admin/test-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pre_registration_id: selectedSignup.id,
          email: selectedSignup.email,
        }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setGeneratedCreds(data.data)
        
        // Atualizar o pré-cadastro na lista com o novo status
        setSignups(signups.map(signup => 
          signup.id === selectedSignup.id 
            ? { ...signup, status: 'active', trial_expires_at: data.data.expires_at }
            : signup
        ))
        
        // Atualizar o selectedSignup também
        setSelectedSignup({
          ...selectedSignup,
          status: 'active',
          trial_expires_at: data.data.expires_at,
        })
        
        // Mostrar modal de credenciais
        setShowCredsModal(true)
        setNotification({ isOpen: true, type: 'success', title: 'Sucesso!', message: 'Credenciais de teste geradas com sucesso! Válidas por 7 dias.' })
      } else {
        setNotification({ isOpen: true, type: 'error', title: 'Erro ao gerar credenciais', message: data.error || 'Erro desconhecido' })
      }
    } catch (error) {
      setNotification({ isOpen: true, type: 'error', title: 'Erro ao gerar credenciais', message: error instanceof Error ? error.message : String(error) })
    } finally {
      setGeneratingCreds(false)
    }
  }

  const handleReject = async (preRegId: string) => {
    const ok = await dialog.confirm({
      title: 'Confirmar',
      type: 'warning',
      message: 'Tem certeza que deseja rejeitar este pré-cadastro?',
      confirmText: 'OK',
      cancelText: 'Cancelar',
    })
    if (!ok) return

    setRejectingId(preRegId)
    try {
      const response = await fetch('/api/v1/admin/approve-trial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pre_registration_id: preRegId,
          approve: false,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        // Remover da lista
        setSignups(signups.filter(s => s.id !== preRegId))
        setNotification({ isOpen: true, type: 'success', title: 'Pré-cadastro rejeitado', message: 'O registro foi removido da lista.' })
      } else {
        setNotification({ isOpen: true, type: 'error', title: 'Erro ao rejeitar', message: data.error })
      }
    } catch (error) {
      setNotification({ isOpen: true, type: 'error', title: 'Erro ao rejeitar', message: error instanceof Error ? error.message : String(error) })
    } finally {
      setRejectingId(null)
    }
  }

  const daysUntilExpiry = (expiryDate: string) => {
    const expiry = new Date(expiryDate)
    const today = new Date()
    const diff = expiry.getTime() - today.getTime()
    return Math.ceil(diff / (1000 * 60 * 60 * 24))
  }

  const getStatusBadge = (status: string, expiryDate: string) => {
    if (status === 'converted') {
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <CheckCircle className="w-3 h-3" /> Convertido
        </span>
      )
    }

    const daysLeft = daysUntilExpiry(expiryDate)

    if (daysLeft < 0) {
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
          <AlertCircle className="w-3 h-3" /> Expirado
        </span>
      )
    }

    if (status === 'active') {
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <CheckCircle className="w-3 h-3" /> Aprovado
        </span>
      )
    }

    if (daysLeft <= 2) {
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
          <Clock className="w-3 h-3" /> Vence em {daysLeft} dias
        </span>
      )
    }

    return (
      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
        <Clock className="w-3 h-3" /> Pendente
      </span>
    )
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-gray-600">Carregando...</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">
          📝 Pré-Cadastros (Trial)
        </h3>
        <span className="inline-flex items-center justify-center w-6 h-6 text-xs font-bold leading-none text-white transform bg-blue-600 rounded-full">
          {signups.length}
        </span>
      </div>

      {signups.length === 0 ? (
        <p className="text-gray-600 text-sm">Nenhum pré-cadastro registrado</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="text-left px-4 py-2 font-semibold text-gray-700">
                  Ministério
                </th>
                <th className="text-left px-4 py-2 font-semibold text-gray-700">
                  Pastor
                </th>
                <th className="text-left px-4 py-2 font-semibold text-gray-700">
                  Email
                </th>
                <th className="text-left px-4 py-2 font-semibold text-gray-700">
                  Status
                </th>
                <th className="text-left px-4 py-2 font-semibold text-gray-700">
                  Cadastrado
                </th>
                <th className="text-center px-4 py-2 font-semibold text-gray-700">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {signups.map((signup) => (
                <tr key={signup.id} className="hover:bg-gray-50 transition">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">
                      {signup.ministry_name}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {signup.pastor_name}
                  </td>
                  <td className="px-4 py-3 text-gray-700 text-xs">
                    {signup.email}
                  </td>
                  <td className="px-4 py-3">
                    {getStatusBadge(signup.status, signup.trial_expires_at)}
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">
                    {new Date(signup.created_at).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 justify-center flex-wrap">
                      {signup.status === 'pending' ? (
                        <>
                          <button
                            onClick={() => handleApprove(signup.id)}
                            disabled={approvingId === signup.id}
                            className="inline-flex items-center gap-1 px-3 py-1 bg-green-500 text-white text-xs font-medium rounded hover:bg-green-600 disabled:opacity-50 transition"
                            title="Liberar acesso"
                          >
                            {approvingId === signup.id ? (
                              <Loader className="w-3 h-3 animate-spin" />
                            ) : (
                              <Check className="w-3 h-3" />
                            )}
                            Aprovar
                          </button>
                          <button
                            onClick={() => handleReject(signup.id)}
                            disabled={rejectingId === signup.id}
                            className="inline-flex items-center gap-1 px-3 py-1 bg-red-500 text-white text-xs font-medium rounded hover:bg-red-600 disabled:opacity-50 transition"
                            title="Rejeitar pré-cadastro"
                          >
                            {rejectingId === signup.id ? (
                              <Loader className="w-3 h-3 animate-spin" />
                            ) : (
                              <X className="w-3 h-3" />
                            )}
                            Rejeitar
                          </button>
                          <button
                            onClick={() => {
                              setSelectedSignup(signup)
                              setShowDetailModal(true)
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1 bg-blue-500 text-white text-xs font-medium rounded hover:bg-blue-600 transition"
                            title="Ver detalhes"
                          >
                            <Eye className="w-3 h-3" />
                            Detalhes
                          </button>
                        </>
                      ) : signup.status === 'active' ? (
                        <>
                          <button
                            onClick={() => {
                              setSelectedSignup(signup)
                              setShowDetailModal(true)
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1 bg-blue-500 text-white text-xs font-medium rounded hover:bg-blue-600 transition"
                          >
                            <Eye className="w-3 h-3" />
                            Detalhes
                          </button>
                        </>
                      ) : (
                        <span className="text-xs text-gray-500">{signup.status}</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-gray-200">
        <p className="text-xs text-gray-500">
          Dica: Clique em "Aprovar" para liberar o acesso de teste ao usuário. Use "Detalhes" para gerar credenciais e contratos.
        </p>
      </div>

      {/* Modal de Detalhes */}
      {showDetailModal && selectedSignup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              📋 {selectedSignup.ministry_name}
            </h2>

            <div className="space-y-3 mb-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 font-semibold uppercase">Pastor</p>
                  <p className="text-sm text-gray-900">{selectedSignup.pastor_name}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-semibold uppercase">Status</p>
                  <p className="text-sm text-gray-900">{selectedSignup.status}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-semibold uppercase">Email</p>
                  <p className="text-sm text-gray-900">{selectedSignup.email}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-semibold uppercase">WhatsApp</p>
                  <p className="text-sm text-gray-900">{selectedSignup.whatsapp}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-semibold uppercase">Templos</p>
                  <p className="text-sm text-gray-900">{selectedSignup.quantity_temples}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-semibold uppercase">Membros</p>
                  <p className="text-sm text-gray-900">{selectedSignup.quantity_members}</p>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mb-6">
              {selectedSignup.status === 'pending' && (
                <button
                  onClick={() => handleApprove(selectedSignup.id)}
                  disabled={approvingId === selectedSignup.id}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition font-medium"
                >
                  {approvingId === selectedSignup.id ? '⏳' : '✓'} Aprovar
                </button>
              )}
              <button
                onClick={() => {
                  setSelectedSignup(selectedSignup)
                  setShowDetailModal(false)
                  setShowCredsModal(true)
                }}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium flex items-center justify-center gap-2"
              >
                <Key className="w-4 h-4" /> Credenciais
              </button>
            </div>

            <button
              onClick={() => setShowDetailModal(false)}
              className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* Modal de Credenciais */}
      {showCredsModal && selectedSignup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              🔑 Gerar Credenciais de Teste
            </h2>

            {!generatedCreds ? (
              <>
                <p className="text-gray-600 mb-6">
                  Gerar credenciais de teste para {selectedSignup.ministry_name}?
                </p>
                <p className="text-sm text-gray-500 mb-6 bg-blue-50 p-3 rounded border border-blue-200">
                  ℹ️ As credenciais serão válidas por 7 dias e terão acesso completo ao sistema.
                </p>

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowCredsModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleGenerateTestCredentials}
                    disabled={generatingCreds}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition font-medium flex items-center justify-center gap-2"
                  >
                    {generatingCreds ? <Loader className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
                    {generatingCreds ? 'Gerando...' : 'Gerar'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="bg-green-50 border border-green-200 rounded p-4 mb-4">
                  <p className="text-sm text-green-800">✅ Credenciais geradas com sucesso!</p>
                </div>

                <div className="space-y-3 mb-6">
                  <div>
                    <p className="text-xs text-gray-500 font-semibold uppercase mb-1">Usuário</p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={generatedCreds.username}
                        readOnly
                        className="flex-1 px-3 py-2 border border-gray-300 rounded bg-gray-50 text-sm font-mono"
                      />
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(generatedCreds.username)
                          setNotification({ isOpen: true, type: 'success', title: 'Copiado!', message: 'Usuário copiado para a área de transferência' })
                        }}
                        className="px-3 py-2 bg-gray-200 rounded hover:bg-gray-300 transition"
                      >
                        📋
                      </button>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500 font-semibold uppercase mb-1">Senha</p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={generatedCreds.password}
                        readOnly
                        className="flex-1 px-3 py-2 border border-gray-300 rounded bg-gray-50 text-sm font-mono"
                      />
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(generatedCreds.password)
                          setNotification({ isOpen: true, type: 'success', title: 'Copiado!', message: 'Senha copiada para a área de transferência' })
                        }}
                        className="px-3 py-2 bg-gray-200 rounded hover:bg-gray-300 transition"
                      >
                        📋
                      </button>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500 font-semibold uppercase mb-1">URL de Acesso</p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={generatedCreds.access_url}
                        readOnly
                        className="flex-1 px-3 py-2 border border-gray-300 rounded bg-gray-50 text-sm font-mono"
                      />
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(generatedCreds.access_url)
                          setNotification({ isOpen: true, type: 'success', title: 'Copiado!', message: 'URL de acesso copiada para a área de transferência' })
                        }}
                        className="px-3 py-2 bg-gray-200 rounded hover:bg-gray-300 transition"
                      >
                        📋
                      </button>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500 font-semibold uppercase mb-1">Válido até</p>
                    <p className="text-sm text-gray-900">
                      {new Date(generatedCreds.expires_at).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setShowCredsModal(false)}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
                >
                  Fechar
                </button>
              </>
            )}
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
