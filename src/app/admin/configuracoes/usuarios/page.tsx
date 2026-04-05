'use client'

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react'
import AdminSidebar from '@/components/AdminSidebar'
import { authenticatedFetch } from '@/lib/api-client'
import { useAppDialog } from '@/providers/AppDialogProvider'
import { Plus, Trash2, Edit2, Shield, CreditCard, Headphones } from 'lucide-react'
import { useAdminAuth } from '@/providers/AdminAuthProvider'

interface AdminUser {
  id: string
  email: string
  nome: string
  role: 'admin' | 'financeiro' | 'suporte'
  criado_em: string
}

const ROLE_CONFIG = {
  admin: {
    label: 'Admin',
    description: 'Acesso total ao painel administrativo',
    icon: Shield,
    color: 'bg-red-600',
  },
  financeiro: {
    label: 'Financeiro',
    description: 'Acesso a cadastro e área financeira + tickets financeiros',
    icon: CreditCard,
    color: 'bg-blue-600',
  },
  suporte: {
    label: 'Suporte',
    description: 'Consulta cadastro e atende tickets de suporte (não financeiro)',
    icon: Headphones,
    color: 'bg-green-600',
  },
}

export default function UsuariosPage() {
  const dialog = useAppDialog()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null)
  const [editFormData, setEditFormData] = useState({ email: '', password: '', role: 'suporte' as AdminUser['role'] })
  const [confirmDeleteUser, setConfirmDeleteUser] = useState<AdminUser | null>(null)

  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    password: '',
    role: 'suporte' as 'admin' | 'financeiro' | 'suporte',
    cpf: '',
    rg: '',
    funcao: '',
    telefone: '',
    whatsapp: '',
    cep: '',
    endereco: '',
    cidade: '',
    bairro: '',
    uf: '',
    banco: '',
    agencia: '',
    conta_corrente: '',
    pix: '',
    obs: '',
  })

  const [showForm, setShowForm] = useState(false)

  const fetchUsers = async () => {
    try {
      setLoadingUsers(true)
      const res = await authenticatedFetch('/api/admin/usuarios')
      if (res.ok) {
        const data = await res.json()
        setUsers(
          (data || []).map((u: any) => ({
            id: u.id,
            email: u.email,
            nome: u.nome || '',
            role: u.role || 'suporte',
            criado_em: u.criado_em || u.data_admissao || '',
          }))
        )
      }
    } finally {
      setLoadingUsers(false)
    }
  }

  useEffect(() => { fetchUsers() }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.email || !formData.password || !formData.nome) {
      await dialog.alert({ title: 'Atenção', type: 'warning', message: 'Nome, email e senha são obrigatórios' })
      return
    }
    setActionLoading(true)
    try {
      const res = await authenticatedFetch('/api/admin/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      const data = await res.json()
      if (!res.ok) {
        await dialog.alert({ title: 'Erro', type: 'error', message: data.error || 'Erro ao criar usuário' })
        return
      }
      setFormData({
        nome: '', email: '', password: '', role: 'suporte',
        cpf: '', rg: '', funcao: '',
        telefone: '', whatsapp: '', cep: '', endereco: '', cidade: '', bairro: '', uf: '',
        banco: '', agencia: '', conta_corrente: '', pix: '', obs: ''
      })
      setShowForm(false)
      await fetchUsers()
    } finally {
      setActionLoading(false)
    }
  }

  const handleEditOpen = (user: AdminUser) => {
    setEditingUser(user)
    setEditFormData({ email: user.email, password: '', role: user.role })
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingUser) return
    if (!editFormData.email) {
      await dialog.alert({ title: 'Atenção', type: 'warning', message: 'Email é obrigatório' })
      return
    }
    setActionLoading(true)
    try {
      const payload: any = { email: editFormData.email, role: editFormData.role }
      if (editFormData.password.trim()) payload.password = editFormData.password.trim()
      const res = await authenticatedFetch(`/api/admin/usuarios?id=${editingUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) {
        await dialog.alert({ title: 'Erro', type: 'error', message: data.error || 'Erro ao atualizar usuário' })
        return
      }
      setEditingUser(null)
      await fetchUsers()
    } finally {
      setActionLoading(false)
    }
  }

  const doDeleteUser = async () => {
    if (!confirmDeleteUser) return
    setActionLoading(true)
    try {
      const res = await authenticatedFetch(`/api/admin/usuarios?id=${confirmDeleteUser.id}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (!res.ok) {
        await dialog.alert({ title: 'Erro', type: 'error', message: data.error || 'Erro ao remover usuário' })
        return
      }
      setConfirmDeleteUser(null)
      await fetchUsers()
    } finally {
      setActionLoading(false)
    }
  }

  const { adminUser } = useAdminAuth()

  // Função utilitária para saber se é o próprio usuário logado
  const isSelf = (user: AdminUser): boolean => {
    if (!adminUser) return false
    return (
      user.email === adminUser.email ||
      !!(adminUser.id && user.id === adminUser.id)
    )
  }

  return (
    <div className="flex h-screen bg-gray-900">
      <AdminSidebar />

      <main className="flex-1 overflow-auto">
        <div className="sticky top-0 bg-gray-950 border-b border-gray-800 px-6 py-4 z-10">
          <h2 className="text-2xl font-bold text-white">PAINEL ADMINISTRATIVO: Gerenciamento de Usuários</h2>
          <p className="text-gray-400 text-sm mt-1">
            Crie e gerencie usuários com diferentes níveis de permissão
          </p>
        </div>

        <div className="p-6 space-y-6">
          {/* Botão Adicionar Usuário */}
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-bold text-white">Usuários do Sistema</h3>
            <button
              onClick={() => setShowForm(!showForm)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition"
            >
              <Plus size={20} />
              Adicionar Usuário
            </button>
          </div>

          {/* Formulário de Adição */}
          {showForm && (
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <h4 className="text-lg font-bold text-white mb-4">Novo Usuário</h4>
              <form onSubmit={handleAddUser} className="space-y-4">
                <div>
                  <label className="block text-gray-400 text-sm mb-2">Email</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full bg-gray-900 text-white border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
                    placeholder="usuario@exemplo.com"
                  />
                </div>

                <div>
                  <label className="block text-gray-400 text-sm mb-2">Senha</label>
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    className="w-full bg-gray-900 text-white border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
                    placeholder="Digite uma senha segura"
                  />
                </div>

                <div>
                  <label className="block text-gray-400 text-sm mb-2">Nível de Permissão</label>
                  <select
                    name="role"
                    value={formData.role}
                    onChange={handleInputChange}
                    className="w-full bg-gray-900 text-white border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
                  >
                    <option value="suporte">Suporte - Consulta cadastro e atende tickets</option>
                    <option value="financeiro">Financeiro - Cadastro e área financeira</option>
                    <option value="admin">Admin - Acesso total</option>
                  </select>
                </div>

                {/* Dados Pessoais */}
                <div className="border-t border-gray-700 pt-4 mt-4">
                  <h4 className="text-gray-300 font-bold text-sm mb-4 uppercase">📋 Dados Pessoais</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input
                      type="text"
                      name="nome"
                      placeholder="Nome Completo"
                      value={formData.nome}
                      onChange={handleInputChange}
                      className="col-span-1 md:col-span-2 bg-gray-900 text-white border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
                    />
                    <input
                      type="text"
                      name="cpf"
                      placeholder="CPF (000.000.000-00)"
                      value={formData.cpf}
                      onChange={handleInputChange}
                      className="bg-gray-900 text-white border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
                    />
                    <input
                      type="text"
                      name="rg"
                      placeholder="RG"
                      value={formData.rg}
                      onChange={handleInputChange}
                      className="bg-gray-900 text-white border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
                    />
                    <input
                      type="text"
                      name="funcao"
                      placeholder="Função/Cargo"
                      value={formData.funcao}
                      onChange={handleInputChange}
                      className="bg-gray-900 text-white border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Contato */}
                <div className="border-t border-gray-700 pt-4 mt-4">
                  <h4 className="text-gray-300 font-bold text-sm mb-4 uppercase">📱 Contato</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input
                      type="text"
                      name="telefone"
                      placeholder="Telefone"
                      value={formData.telefone}
                      onChange={handleInputChange}
                      className="bg-gray-900 text-white border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
                    />
                    <input
                      type="text"
                      name="whatsapp"
                      placeholder="WhatsApp"
                      value={formData.whatsapp}
                      onChange={handleInputChange}
                      className="bg-gray-900 text-white border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Endereço */}
                <div className="border-t border-gray-700 pt-4 mt-4">
                  <h4 className="text-gray-300 font-bold text-sm mb-4 uppercase">🏠 Endereço</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <input
                      type="text"
                      name="cep"
                      placeholder="CEP"
                      value={formData.cep}
                      onChange={handleInputChange}
                      className="bg-gray-900 text-white border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
                    />
                    <input
                      type="text"
                      name="endereco"
                      placeholder="Endereço"
                      value={formData.endereco}
                      onChange={handleInputChange}
                      className="col-span-1 md:col-span-2 bg-gray-900 text-white border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
                    />
                    <input
                      type="text"
                      name="cidade"
                      placeholder="Cidade"
                      value={formData.cidade}
                      onChange={handleInputChange}
                      className="bg-gray-900 text-white border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
                    />
                    <input
                      type="text"
                      name="bairro"
                      placeholder="Bairro"
                      value={formData.bairro}
                      onChange={handleInputChange}
                      className="bg-gray-900 text-white border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
                    />
                    <input
                      type="text"
                      name="uf"
                      placeholder="UF"
                      maxLength={2}
                      value={formData.uf}
                      onChange={handleInputChange}
                      className="bg-gray-900 text-white border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500 uppercase"
                    />
                  </div>
                </div>

                {/* Dados Financeiros - só aparece para Financeiro */}
                {formData.role === 'financeiro' && (
                  <div className="border-t border-gray-700 pt-4 mt-4">
                    <h4 className="text-gray-300 font-bold text-sm mb-4 uppercase">💳 Dados Financeiros</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <input
                        type="text"
                        name="banco"
                        placeholder="Banco"
                        value={formData.banco}
                        onChange={handleInputChange}
                        className="bg-gray-900 text-white border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
                      />
                      <input
                        type="text"
                        name="agencia"
                        placeholder="Agência"
                        value={formData.agencia}
                        onChange={handleInputChange}
                        className="bg-gray-900 text-white border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
                      />
                      <input
                        type="text"
                        name="conta_corrente"
                        placeholder="Conta Corrente"
                        value={formData.conta_corrente}
                        onChange={handleInputChange}
                        className="bg-gray-900 text-white border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
                      />
                      <input
                        type="text"
                        name="pix"
                        placeholder="Chave PIX"
                        value={formData.pix}
                        onChange={handleInputChange}
                        className="col-span-1 md:col-span-2 bg-gray-900 text-white border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
                      />
                      <textarea
                        name="obs"
                        placeholder="Observações"
                        value={formData.obs}
                        onChange={handleInputChange}
                        rows={3}
                        className="col-span-1 md:col-span-2 bg-gray-900 text-white border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                )}

                <div className="flex gap-3 mt-6">
                  <button
                    type="submit"
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg transition font-medium"
                  >
                    Criar Usuário
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-lg transition font-medium"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Tabela de Usuários */}
          <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-700 bg-gray-900">
                    <th className="px-6 py-3 text-left text-gray-400 text-sm font-semibold">Email</th>
                    <th className="px-6 py-3 text-left text-gray-400 text-sm font-semibold">Nível de Permissão</th>
                    <th className="px-6 py-3 text-left text-gray-400 text-sm font-semibold">Data de Criação</th>
                    <th className="px-6 py-3 text-left text-gray-400 text-sm font-semibold">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {users.map((user) => {
                    const roleConfig = ROLE_CONFIG[user.role]
                    const RoleIcon = roleConfig.icon

                    return (
                      <tr key={user.id} className="hover:bg-gray-700 transition">
                        <td className="px-6 py-3">
                          <p className="text-white">{user.email}</p>
                          {user.nome && <p className="text-gray-400 text-xs">{user.nome}</p>}
                        </td>
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-2">
                            <div className={`${roleConfig.color} p-1 rounded`}>
                              <RoleIcon size={16} className="text-white" />
                            </div>
                            <div>
                              <p className="text-white font-medium">{roleConfig.label}</p>
                              <p className="text-gray-400 text-xs">{roleConfig.description}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-3 text-gray-400 text-sm">
                          {user.criado_em ? new Date(user.criado_em).toLocaleDateString('pt-BR') : '-'}
                        </td>
                        <td className="px-6 py-3">
                          <div className="flex gap-2">
                            <button
                              onClick={() => !isSelf(user) && handleEditOpen(user)}
                              className={`p-2 hover:bg-gray-600 rounded transition text-blue-400 ${isSelf(user) ? 'opacity-40 cursor-not-allowed' : ''}`}
                              title={isSelf(user) ? 'Você não pode editar sua própria conta' : 'Editar'}
                              disabled={isSelf(user)}
                            >
                              <Edit2 size={16} />
                            </button>
                            <button
                              onClick={() => !isSelf(user) && setConfirmDeleteUser(user)}
                              className={`p-2 hover:bg-gray-600 rounded transition text-red-400 ${isSelf(user) ? 'opacity-40 cursor-not-allowed' : ''}`}
                              title={isSelf(user) ? 'Você não pode remover sua própria conta' : 'Remover'}
                              disabled={isSelf(user)}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {users.length === 0 && !loadingUsers && (
              <div className="px-6 py-12 text-center">
                <p className="text-gray-400">Nenhum usuário cadastrado ainda</p>
              </div>
            )}
            {loadingUsers && (
              <div className="px-6 py-12 text-center">
                <p className="text-gray-400">Carregando...</p>
              </div>
            )}
          </div>

          {/* Legenda de Permissões */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(ROLE_CONFIG).map(([key, config]) => {
              const Icon = config.icon
              return (
                <div key={key} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`${config.color} p-2 rounded`}>
                      <Icon size={20} className="text-white" />
                    </div>
                    <h5 className="text-white font-bold">{config.label}</h5>
                  </div>
                  <p className="text-gray-400 text-sm">{config.description}</p>
                </div>
              )
            })}
          </div>
        </div>
      </main>

      {/* Modal: Editar usuário */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl max-w-md w-full p-6 text-gray-100">
            <h2 className="text-lg font-bold text-white mb-5">Editar usuário</h2>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-gray-400 text-sm mb-1">Email</label>
                <input
                  type="email"
                  value={editFormData.email}
                  onChange={(e) => setEditFormData((p) => ({ ...p, email: e.target.value }))}
                  className="w-full bg-gray-800 text-white border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-gray-400 text-sm mb-1">Nova senha <span className="text-gray-500">(deixe em branco para não alterar)</span></label>
                <input
                  type="password"
                  value={editFormData.password}
                  onChange={(e) => setEditFormData((p) => ({ ...p, password: e.target.value }))}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full bg-gray-800 text-white border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-gray-400 text-sm mb-1">Permissão</label>
                <select
                  value={editFormData.role}
                  onChange={(e) => setEditFormData((p) => ({ ...p, role: e.target.value as AdminUser['role'] }))}
                  className="w-full bg-gray-800 text-white border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
                >
                  <option value="suporte">Suporte</option>
                  <option value="financeiro">Financeiro</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  disabled={actionLoading}
                  className="flex-1 px-4 py-2 bg-gray-700 text-gray-100 rounded-lg hover:bg-gray-600 transition text-sm font-medium disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-semibold disabled:opacity-50"
                >
                  {actionLoading ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Confirmar exclusão */}
      {confirmDeleteUser && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-red-800 rounded-2xl shadow-2xl max-w-sm w-full p-6 text-gray-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-900/60 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-400" />
              </div>
              <h2 className="text-lg font-bold text-white">Remover usuário?</h2>
            </div>
            <p className="text-sm text-gray-300 mb-2">Você está prestes a remover:</p>
            <div className="bg-gray-800 rounded-lg px-4 py-3 mb-4">
              <p className="font-semibold text-white text-sm">{confirmDeleteUser.nome || confirmDeleteUser.email}</p>
              <p className="text-xs text-gray-400">{confirmDeleteUser.email} · {ROLE_CONFIG[confirmDeleteUser.role]?.label}</p>
            </div>
            <div className="bg-red-950/40 border border-red-800/50 rounded-lg px-4 py-3 mb-5">
              <p className="text-xs text-red-400 font-medium">⚠️ O acesso será revogado imediatamente.</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDeleteUser(null)}
                disabled={actionLoading}
                className="flex-1 px-4 py-2 bg-gray-700 text-gray-100 rounded-lg hover:bg-gray-600 transition text-sm font-medium disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={doDeleteUser}
                disabled={actionLoading}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm font-semibold disabled:opacity-50"
              >
                {actionLoading ? 'Removendo...' : 'Sim, remover'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
