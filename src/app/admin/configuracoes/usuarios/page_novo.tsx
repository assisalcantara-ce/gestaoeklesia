'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, Edit2, Shield, CreditCard, Headphones, AlertCircle } from 'lucide-react'
import AdminSidebar from '@/components/AdminSidebar'
import { useAppDialog } from '@/providers/AppDialogProvider'

interface User {
  id: string
  email: string
  role: 'admin' | 'financeiro' | 'suporte'
  nome: string
  cpf?: string
  rg?: string
  data_nascimento?: string
  data_admissao: string
  status: 'ATIVO' | 'INATIVO'
  telefone?: string
  whatsapp?: string
  cep?: string
  endereco?: string
  cidade?: string
  bairro?: string
  uf?: string
  banco?: string
  agencia?: string
  conta_corrente?: string
  pix?: string
  obs?: string
  funcao?: string
  grupo?: string
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
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    nome: '',
    cpf: '',
    rg: '',
    data_nascimento: '',
    data_admissao: new Date().toISOString().split('T')[0],
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
    funcao: '',
    grupo: '',
    role: 'suporte' as 'admin' | 'financeiro' | 'suporte',
  })

  const [showForm, setShowForm] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  // Carrega usuários ao montar o componente
  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch('/api/admin/usuarios')
      if (!response.ok) {
        throw new Error('Erro ao carregar usuários')
      }
      const data = await response.json()
      setUsers(data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
      console.error('Erro ao carregar usuários:', err)
    } finally {
      setLoading(false)
    }
  }

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
      setError('Email, senha e nome são obrigatórios')
      return
    }

    try {
      setIsSubmitting(true)
      setError(null)

      const response = await fetch('/api/admin/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Erro ao criar usuário')
      }

      const newUser = await response.json()
      setUsers([...users, newUser])
      setFormData({
        email: '',
        password: '',
        nome: '',
        cpf: '',
        rg: '',
        data_nascimento: '',
        data_admissao: new Date().toISOString().split('T')[0],
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
        funcao: '',
        grupo: '',
        role: 'suporte',
      })
      setShowForm(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
      console.error('Erro ao criar usuário:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteUser = async (id: string) => {
    const user = users.find((u) => u.id === id)
    if (user?.role === 'admin' && users.filter((u) => u.role === 'admin').length === 1) {
      setError('Não é possível deletar o último usuário admin')
      return
    }

    const ok = await dialog.confirm({
      title: 'Confirmar',
      type: 'warning',
      message: `Deseja deletar o usuário ${user?.email}?`,
      confirmText: 'OK',
      cancelText: 'Cancelar',
    })
    if (!ok) return

    try {
      setError(null)
      const response = await fetch(`/api/admin/usuarios?id=${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Erro ao deletar usuário')
      }

      setUsers(users.filter((u) => u.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
      console.error('Erro ao deletar usuário:', err)
    }
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
          {/* Mensagem de Erro */}
          {error && (
            <div className="flex items-center gap-3 p-4 bg-red-900/20 border border-red-700 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-500" />
              <p className="text-red-200 text-sm">{error}</p>
            </div>
          )}

          {/* Botão Adicionar Usuário */}
          <button
            onClick={() => {
              setShowForm(!showForm)
              setEditingId(null)
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            <Plus className="w-5 h-5" />
            Adicionar Usuário
          </button>

          {/* Formulário */}
          {showForm && (
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
              <h3 className="text-lg font-bold text-white mb-6">
                {editingId ? 'Editar Usuário' : 'Novo Usuário'}
              </h3>

              <form onSubmit={handleAddUser} className="space-y-6">
                {/* Seção: Dados de Acesso */}
                <div>
                  <h4 className="text-sm font-bold text-gray-300 mb-4 uppercase tracking-wider">Dados de Acesso</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <input
                      type="email"
                      name="email"
                      placeholder="Email"
                      value={formData.email}
                      onChange={handleInputChange}
                      className="px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                      required
                    />
                    <input
                      type="password"
                      name="password"
                      placeholder="Senha"
                      value={formData.password}
                      onChange={handleInputChange}
                      className="px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                      required
                    />
                    <select
                      name="role"
                      value={formData.role}
                      onChange={handleInputChange}
                      className="px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="suporte">Suporte</option>
                      <option value="financeiro">Financeiro</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                </div>

                {/* Seção: Dados Pessoais */}
                <div>
                  <h4 className="text-sm font-bold text-gray-300 mb-4 uppercase tracking-wider">Dados Pessoais</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <input
                      type="text"
                      name="nome"
                      placeholder="Nome Completo"
                      value={formData.nome}
                      onChange={handleInputChange}
                      className="col-span-1 md:col-span-3 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                      required
                    />
                    <input
                      type="text"
                      name="cpf"
                      placeholder="CPF (000.000.000-00)"
                      value={formData.cpf}
                      onChange={handleInputChange}
                      className="px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                    />
                    <input
                      type="text"
                      name="rg"
                      placeholder="RG"
                      value={formData.rg}
                      onChange={handleInputChange}
                      className="px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                    />
                    <input
                      type="date"
                      name="data_nascimento"
                      value={formData.data_nascimento}
                      onChange={handleInputChange}
                      className="px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    />
                    <input
                      type="date"
                      name="data_admissao"
                      value={formData.data_admissao}
                      onChange={handleInputChange}
                      className="px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    />
                    <select
                      name="funcao"
                      value={formData.funcao}
                      onChange={handleInputChange}
                      className="px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="">Selecione uma Função</option>
                      <option value="Gerente">Gerente</option>
                      <option value="Auxiliar">Auxiliar</option>
                      <option value="Supervisor">Supervisor</option>
                    </select>
                  </div>
                </div>

                {/* Seção: Contato */}
                <div>
                  <h4 className="text-sm font-bold text-gray-300 mb-4 uppercase tracking-wider">Contato</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <input
                      type="text"
                      name="telefone"
                      placeholder="Telefone"
                      value={formData.telefone}
                      onChange={handleInputChange}
                      className="px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                    />
                    <input
                      type="text"
                      name="whatsapp"
                      placeholder="WhatsApp"
                      value={formData.whatsapp}
                      onChange={handleInputChange}
                      className="px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Seção: Endereço */}
                <div>
                  <h4 className="text-sm font-bold text-gray-300 mb-4 uppercase tracking-wider">Endereço</h4>
                  <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                    <input
                      type="text"
                      name="cep"
                      placeholder="CEP"
                      value={formData.cep}
                      onChange={handleInputChange}
                      className="col-span-1 md:col-span-2 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                    />
                    <input
                      type="text"
                      name="endereco"
                      placeholder="Endereço"
                      value={formData.endereco}
                      onChange={handleInputChange}
                      className="col-span-1 md:col-span-4 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                    />
                    <input
                      type="text"
                      name="cidade"
                      placeholder="Cidade"
                      value={formData.cidade}
                      onChange={handleInputChange}
                      className="col-span-1 md:col-span-2 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                    />
                    <input
                      type="text"
                      name="bairro"
                      placeholder="Bairro"
                      value={formData.bairro}
                      onChange={handleInputChange}
                      className="col-span-1 md:col-span-2 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                    />
                    <input
                      type="text"
                      name="uf"
                      placeholder="UF"
                      maxLength={2}
                      value={formData.uf}
                      onChange={handleInputChange}
                      className="col-span-1 md:col-span-2 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 uppercase"
                    />
                  </div>
                </div>

                {/* Seção: Dados Financeiros (apenas para Financeiro) */}
                {formData.role === 'financeiro' && (
                  <div>
                    <h4 className="text-sm font-bold text-gray-300 mb-4 uppercase tracking-wider">Dados Financeiros</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <input
                        type="text"
                        name="banco"
                        placeholder="Banco"
                        value={formData.banco}
                        onChange={handleInputChange}
                        className="px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                      />
                      <input
                        type="text"
                        name="agencia"
                        placeholder="Agência"
                        value={formData.agencia}
                        onChange={handleInputChange}
                        className="px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                      />
                      <input
                        type="text"
                        name="conta_corrente"
                        placeholder="Conta Corrente"
                        value={formData.conta_corrente}
                        onChange={handleInputChange}
                        className="px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                      />
                      <input
                        type="text"
                        name="pix"
                        placeholder="Chave PIX"
                        value={formData.pix}
                        onChange={handleInputChange}
                        className="col-span-1 md:col-span-3 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                )}

                {/* Observações */}
                <div>
                  <label className="block text-sm font-bold text-gray-300 mb-2 uppercase tracking-wider">
                    Observações
                  </label>
                  <textarea
                    name="obs"
                    placeholder="Adicione observações sobre o usuário"
                    value={formData.obs}
                    onChange={handleInputChange}
                    rows={3}
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Botões */}
                <div className="flex gap-4 pt-6 border-t border-gray-700">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded-lg font-medium transition-colors"
                  >
                    {isSubmitting ? 'Salvando...' : editingId ? 'Atualizar Usuário' : 'Criar Usuário'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false)
                      setEditingId(null)
                      setFormData({
                        email: '',
                        password: '',
                        nome: '',
                        cpf: '',
                        rg: '',
                        data_nascimento: '',
                        data_admissao: new Date().toISOString().split('T')[0],
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
                        funcao: '',
                        grupo: '',
                        role: 'suporte',
                      })
                    }}
                    className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Tabela de Usuários */}
          <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-900 border-b border-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-300 uppercase">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-300 uppercase">Nome</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-300 uppercase">Nível</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-300 uppercase">Data Admissão</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-300 uppercase">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-gray-400">
                        Carregando usuários...
                      </td>
                    </tr>
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-gray-400">
                        Nenhum usuário cadastrado
                      </td>
                    </tr>
                  ) : (
                    users.map((user) => {
                      const RoleIcon = ROLE_CONFIG[user.role].icon
                      return (
                        <tr key={user.id} className="border-t border-gray-700 hover:bg-gray-700/50">
                          <td className="px-6 py-4 text-sm text-gray-300">{user.email}</td>
                          <td className="px-6 py-4 text-sm text-gray-300">{user.nome}</td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <div
                                className={`${ROLE_CONFIG[user.role].color} p-2 rounded-lg flex items-center justify-center`}
                              >
                                <RoleIcon className="w-4 h-4 text-white" />
                              </div>
                              <span className="text-sm text-gray-300">{ROLE_CONFIG[user.role].label}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-400">
                            {new Date(user.data_admissao).toLocaleDateString('pt-BR')}
                          </td>
                          <td className="px-6 py-4 flex gap-2">
                            <button
                              onClick={() => {
                                // TODO: Implementar edição
                                void dialog.alert({ title: 'Aviso', type: 'info', message: 'Função de edição em desenvolvimento' })
                              }}
                              className="p-2 hover:bg-blue-600/20 rounded-lg text-blue-400 hover:text-blue-300 transition-colors"
                              title="Editar"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteUser(user.id)}
                              className="p-2 hover:bg-red-600/20 rounded-lg text-red-400 hover:text-red-300 transition-colors"
                              title="Deletar"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Legenda de Permissões */}
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <h3 className="text-lg font-bold text-white mb-6">Níveis de Permissão</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {Object.entries(ROLE_CONFIG).map(([key, config]) => {
                const Icon = config.icon
                return (
                  <div key={key} className="flex gap-4">
                    <div className={`${config.color} p-3 rounded-lg flex-shrink-0 h-fit`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="font-bold text-white">{config.label}</p>
                      <p className="text-sm text-gray-400 mt-1">{config.description}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
