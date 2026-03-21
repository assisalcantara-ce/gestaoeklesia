'use client'

export const dynamic = 'force-dynamic';

import { useState } from 'react'
import AdminSidebar from '@/components/AdminSidebar'
import { useAppDialog } from '@/providers/AppDialogProvider'
import { Plus, Trash2, Edit2, Shield, CreditCard, Headphones } from 'lucide-react'

interface User {
  id: string
  email: string
  role: 'admin' | 'financeiro' | 'suporte'
  createdAt: string
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
  const [users, setUsers] = useState<User[]>([
    {
      id: '1',
      email: 'admin@gestaoeclesial.local',
      role: 'admin',
      createdAt: '2025-01-01',
    },
  ])

  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    password: '',
    role: 'suporte' as 'admin' | 'financeiro' | 'suporte',
    cpf: '',
    rg: '',
    data_nascimento: '',
    data_admissao: '',
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.email || !formData.password) {
      await dialog.alert({ title: 'Atenção', type: 'warning', message: 'Preencha todos os campos' })
      return
    }

    const newUser: User = {
      id: String(users.length + 1),
      email: formData.email,
      role: formData.role,
      createdAt: new Date().toLocaleDateString('pt-BR'),
    }

    setUsers([...users, newUser])
    setFormData({ 
      nome: '', email: '', password: '', role: 'suporte', 
      cpf: '', rg: '', data_nascimento: '', data_admissao: '', funcao: '',
      telefone: '', whatsapp: '', cep: '', endereco: '', cidade: '', bairro: '', uf: '',
      banco: '', agencia: '', conta_corrente: '', pix: '', obs: ''
    })
    setShowForm(false)
  }

  const handleDeleteUser = async (id: string) => {
    if (users.find((u) => u.id === id)?.role === 'admin' && users.filter((u) => u.role === 'admin').length === 1) {
      await dialog.alert({ title: 'Atenção', type: 'warning', message: 'Não é possível deletar o último usuário admin' })
      return
    }
    setUsers(users.filter((u) => u.id !== id))
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
                      type="date"
                      name="data_nascimento"
                      value={formData.data_nascimento}
                      onChange={handleInputChange}
                      className="bg-gray-900 text-white border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
                    />
                    <input
                      type="date"
                      name="data_admissao"
                      value={formData.data_admissao}
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
                        <td className="px-6 py-3 text-white">{user.email}</td>
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
                        <td className="px-6 py-3 text-gray-400 text-sm">{user.createdAt}</td>
                        <td className="px-6 py-3">
                          <div className="flex gap-2">
                            <button className="p-2 hover:bg-gray-600 rounded transition text-blue-400">
                              <Edit2 size={16} />
                            </button>
                            <button
                              onClick={() => handleDeleteUser(user.id)}
                              className="p-2 hover:bg-gray-600 rounded transition text-red-400"
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

            {users.length === 0 && (
              <div className="px-6 py-12 text-center">
                <p className="text-gray-400">Nenhum usuário cadastrado ainda</p>
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
    </div>
  )
}
