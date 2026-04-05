'use client'

import { useState, useEffect } from 'react'
import { Eye, X, CheckCircle, Trash2, XCircle } from 'lucide-react'
import { authenticatedFetch } from '@/lib/api-client'

interface PreRegistration {
  id: string
  ministry_name: string
  pastor_name: string
  email: string
  whatsapp: string
  cpf_cnpj: string
  plan: string
  trial_expires_at: string
  status: 'trial' | 'encerrado' | 'efetivado'
  created_at: string
}

interface Plano {
  id: string
  name: string
  slug: string
  price_monthly: number
}

export default function TrialSignupsWidget() {
  const [signups, setSignups] = useState<PreRegistration[]>([])
  const [planos, setPlanos] = useState<Plano[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'trial' | 'encerrado'>('trial')
  const [selectedSignup, setSelectedSignup] = useState<PreRegistration | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showEfetivarModal, setShowEfetivarModal] = useState(false)
  const [efetivarSignup, setEfetivarSignup] = useState<PreRegistration | null>(null)
  const [planoSelecionado, setPlanoSelecionado] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [confirmDeleteSignup, setConfirmDeleteSignup] = useState<PreRegistration | null>(null)

  const isExpired = (s: PreRegistration) => new Date(s.trial_expires_at) < new Date()

  // Classificação client-side por data, independente do status no banco
  const emTeste = signups.filter(s => s.status === 'trial' && !isExpired(s))
  const expirados = signups.filter(s => s.status === 'encerrado' || (s.status === 'trial' && isExpired(s)))
  const filteredSignups = activeTab === 'trial' ? emTeste : expirados

  const fetchData = async () => {
    try {
      setLoading(true)
      const [signupsRes, planosRes] = await Promise.all([
        authenticatedFetch('/api/v1/admin/pre-registrations?limit=50'),
        authenticatedFetch('/api/v1/admin/plans'),
      ])
      if (signupsRes.ok) {
        const payload = await signupsRes.json()
        setSignups(payload.data || [])
      }
      if (planosRes.ok) {
        const payload = await planosRes.json()
        setPlanos(payload.data || payload || [])
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const daysUntilExpiry = (expiryDate: string) => {
    const diff = new Date(expiryDate).getTime() - new Date().getTime()
    return Math.ceil(diff / (1000 * 60 * 60 * 24))
  }

  const handleCancelarTrial = async (id: string) => {
    setActionLoading(id + '_cancelar')
    try {
      const res = await authenticatedFetch('/api/v1/admin/pre-registrations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'encerrado' }),
      })
      if (res.ok) await fetchData()
    } finally {
      setActionLoading(null)
    }
  }

  const handleDeletar = async (id: string) => {
    setActionLoading(id + '_deletar')
    setConfirmDeleteSignup(null)
    try {
      const res = await authenticatedFetch('/api/v1/admin/pre-registrations', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (res.ok) await fetchData()
    } finally {
      setActionLoading(null)
    }
  }

  const handleEfetivar = async () => {
    if (!efetivarSignup) return
    setActionLoading(efetivarSignup.id + '_efetivar')
    try {
      const res = await authenticatedFetch('/api/v1/admin/approve-trial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pre_registration_id: efetivarSignup.id,
          approve: true,
          plan: planoSelecionado || efetivarSignup.plan,
        }),
      })
      if (res.ok) {
        setShowEfetivarModal(false)
        setEfetivarSignup(null)
        await fetchData()
      }
    } finally {
      setActionLoading(null)
    }
  }

  if (loading) {
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-lg shadow p-6">
        <p className="text-gray-400">Carregando...</p>
      </div>
    )
  }

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg shadow p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-white">📝 Pré-Cadastros</h3>
          <span className="inline-flex items-center justify-center w-6 h-6 text-xs font-bold text-white bg-blue-600 rounded-full">
            {signups.filter(s => s.status !== 'efetivado').length}
          </span>
        </div>
        <button
          type="button"
          onClick={fetchData}
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
          Em Teste ({emTeste.length})
        </button>
        <button
          onClick={() => setActiveTab('encerrado')}
          className={`px-4 py-2 text-sm font-medium transition ${
            activeTab === 'encerrado'
              ? 'text-red-400 border-b-2 border-red-400'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          Expirado ({expirados.length})
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
                <th className="text-left px-4 py-2 font-semibold text-gray-300">Ministério</th>
                <th className="text-left px-4 py-2 font-semibold text-gray-300">Pastor</th>
                <th className="text-left px-4 py-2 font-semibold text-gray-300">Email</th>
                <th className="text-left px-4 py-2 font-semibold text-gray-300">Vence em</th>
                <th className="text-left px-4 py-2 font-semibold text-gray-300">Cadastrado</th>
                <th className="text-center px-4 py-2 font-semibold text-gray-300">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {filteredSignups.map((signup) => (
                <tr key={signup.id} className="hover:bg-gray-700/40 transition">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-100">{signup.ministry_name}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-300">{signup.pastor_name}</td>
                  <td className="px-4 py-3 text-gray-300 text-xs">{signup.email}</td>
                  <td className="px-4 py-3">
                    <span className={isExpired(signup) ? 'text-red-400 font-semibold' : 'text-yellow-400 font-semibold'}>
                      {new Date(signup.trial_expires_at).toLocaleDateString('pt-BR')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {new Date(signup.created_at).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5 justify-center flex-wrap">
                      {/* Ver detalhes â€” ambas as abas */}
                      <button
                        onClick={() => { setSelectedSignup(signup); setShowDetailModal(true) }}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-blue-500 text-white text-xs font-medium rounded hover:bg-blue-600 transition"
                      >
                        <Eye className="w-3 h-3" />
                        Ver
                      </button>

                      {/* Cancelar Trial — apenas na aba Em Teste */}
                      {activeTab === 'trial' && (
                        <button
                          onClick={() => handleCancelarTrial(signup.id)}
                          disabled={!!actionLoading}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-600 text-white text-xs font-medium rounded hover:bg-yellow-700 transition disabled:opacity-50"
                        >
                          <XCircle className="w-3 h-3" />
                          {actionLoading === signup.id + '_cancelar' ? '...' : 'Cancelar'}
                        </button>
                      )}

                      {/* Efetivar + Deletar â€” só na aba Expirado */}
                      {activeTab === 'encerrado' && (
                        <>
                          <button
                            onClick={() => {
                              setEfetivarSignup(signup)
                              setPlanoSelecionado(signup.plan || (planos[0]?.slug ?? ''))
                              setShowEfetivarModal(true)
                            }}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-green-600 text-white text-xs font-medium rounded hover:bg-green-700 transition"
                          >
                            <CheckCircle className="w-3 h-3" />
                            Efetivar
                          </button>

                          <button
                              onClick={() => setConfirmDeleteSignup(signup)}
                              className="inline-flex items-center gap-1 px-2 py-1 bg-red-700 text-white text-xs font-medium rounded hover:bg-red-800 transition"
                            >
                              <Trash2 className="w-3 h-3" />
                              Deletar
                            </button>
                        </>
                      )}
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
            <h2 className="text-2xl font-bold text-white mb-4">📋 {selectedSignup.ministry_name}</h2>
            <div className="space-y-4 mb-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-400 font-semibold uppercase">Pastor</p>
                  <p className="text-sm text-gray-100">{selectedSignup.pastor_name}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 font-semibold uppercase">Status</p>
                  <p className="text-sm font-medium">
                    {isExpired(selectedSignup)
                      ? <span className="text-red-400">Expirado</span>
                      : <span className="text-green-400">Em Teste</span>}
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
                  <p className="text-xs text-gray-400 font-semibold uppercase">Plano</p>
                  <p className="text-sm capitalize text-gray-100">{selectedSignup.plan || 'â€”'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 font-semibold uppercase">Cadastrado em</p>
                  <p className="text-sm text-gray-100">{new Date(selectedSignup.created_at).toLocaleDateString('pt-BR')}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 font-semibold uppercase">Vence em</p>
                  <p className="text-sm text-gray-100">{new Date(selectedSignup.trial_expires_at).toLocaleDateString('pt-BR')}</p>
                </div>
              </div>
              {!isExpired(selectedSignup) && (
                <div className="bg-blue-900/40 border border-blue-700 rounded-lg p-3">
                  <p className="text-xs text-blue-300 font-semibold uppercase mb-1">Dias restantes</p>
                  <p className="text-sm text-blue-100">{daysUntilExpiry(selectedSignup.trial_expires_at)} dias</p>
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

      {/* Modal Efetivar em Plano */}
      {showEfetivarModal && efetivarSignup && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-lg shadow-xl max-w-md w-full p-6 text-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white">Efetivar em Plano</h2>
              <button onClick={() => setShowEfetivarModal(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-300 mb-1">
              Ministério: <span className="font-semibold text-white">{efetivarSignup.ministry_name}</span>
            </p>
            <p className="text-xs text-gray-500 mb-4">
              Isso criará a instituição na base de produção com acesso ativo.
            </p>
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-300 mb-2">Selecionar plano</label>
              <select
                value={planoSelecionado}
                onChange={(e) => setPlanoSelecionado(e.target.value)}
                className="w-full rounded-lg bg-gray-800 border border-gray-600 text-gray-100 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              >
                {planos.map((p) => (
                  <option key={p.id} value={p.slug || p.name?.toLowerCase()}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowEfetivarModal(false)}
                className="flex-1 px-4 py-2 bg-gray-700 text-gray-100 rounded-lg hover:bg-gray-600 transition text-sm font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={handleEfetivar}
                disabled={!!actionLoading}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm font-medium disabled:opacity-50"
              >
                {actionLoading ? 'Processando...' : 'Confirmar Efetivação'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmar Exclusão */}
      {confirmDeleteSignup && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-red-800 rounded-2xl shadow-2xl max-w-sm w-full p-6 text-gray-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-900/60 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-400" />
              </div>
              <h2 className="text-lg font-bold text-white">Excluir pré-cadastro?</h2>
            </div>
            <p className="text-sm text-gray-300 mb-1">
              Você está prestes a excluir permanentemente:
            </p>
            <div className="bg-gray-800 rounded-lg px-4 py-3 mb-5">
              <p className="font-semibold text-white text-sm">{confirmDeleteSignup.ministry_name}</p>
              <p className="text-xs text-gray-400">{confirmDeleteSignup.pastor_name} · {confirmDeleteSignup.email}</p>
            </div>
            <p className="text-xs text-red-400 mb-5">Esta ação não pode ser desfeita.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDeleteSignup(null)}
                className="flex-1 px-4 py-2 bg-gray-700 text-gray-100 rounded-lg hover:bg-gray-600 transition text-sm font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDeletar(confirmDeleteSignup.id)}
                disabled={!!actionLoading}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm font-semibold disabled:opacity-50"
              >
                {actionLoading ? 'Excluindo...' : 'Sim, excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
