'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import { useRequireSupabaseAuth } from '@/hooks/useRequireSupabaseAuth';
import { createClient } from '@/lib/supabase-client';

interface Usuario {
  id: string;
  nome: string;
  email: string;
  email_confirmed?: boolean;
  nivel: 'administrador' | 'financeiro' | 'operador' | 'supervisor' | 'superintendente' | 'coordenador';
  congregacao?: string;
  congregacao_id?: string | null;
  supervisao?: string;
  status: 'ativo' | 'inativo';
}

interface NivelAcesso {
  id: string;
  nome: string;
  descricao: string;
  icon: string;
  cor: string;
}

interface CongregacaoOption {
  id: string;
  nome: string;
}

export default function UsuariosPage() {
  const [activeMenu, setActiveMenu] = useState('usuarios');
  const { loading: authLoading } = useRequireSupabaseAuth();
  const supabase = useMemo(() => createClient(), []);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [usuariosLoading, setUsuariosLoading] = useState(true);
  const [usuariosError, setUsuariosError] = useState('');
  const [congregacoes, setCongregacoes] = useState<CongregacaoOption[]>([]);
  const [congregacoesLoading, setCongregacoesLoading] = useState(true);
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    nivel: '',
    congregacao_id: '',
    senha: '',
    confirmar_senha: '',
  });
  const [formError, setFormError] = useState('');
  const [formStatus, setFormStatus] = useState('');
  const [creatingUser, setCreatingUser] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [editEmailConfirmed, setEditEmailConfirmed] = useState(true);
  const [editOriginalStatus, setEditOriginalStatus] = useState<'ativo' | 'inativo'>('ativo');
  const [editData, setEditData] = useState({
    user_id: '',
    nome: '',
    email: '',
    nivel: '',
    congregacao_id: '',
    status: 'ativo',
    senha: '',
    confirmar_senha: '',
  });

  const [showForm, setShowForm] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const nivelAcessoInfo: NivelAcesso[] = [
    {
      id: 'administrador',
      nome: 'Administrador',
      descricao: 'Pastor Presidente / Sede do Ministério - Acesso total ao sistema',
      icon: '👑',
      cor: 'bg-purple-100 border-purple-300',
    },
    {
      id: 'financeiro',
      nome: 'Financeiro',
      descricao: 'Funções reduzidas com acesso ao módulo financeiro',
      icon: '💳',
      cor: 'bg-blue-100 border-blue-300',
    },
    {
      id: 'supervisor',
      nome: 'Supervisor',
      descricao: 'Responsável por um grupo de congregações/regional',
      icon: '🗺️',
      cor: 'bg-indigo-100 border-indigo-300',
    },
    {
      id: 'operador',
      nome: 'Operador',
      descricao: 'Pastores de Congregação - Gerenciamento local',
      icon: '🏢',
      cor: 'bg-green-100 border-green-300',
    },
    {
      id: 'superintendente',
      nome: 'Superintendente',
      descricao: 'Líder Geral de EBD do Ministério - Acesso apenas a EBD',
      icon: '📚',
      cor: 'bg-orange-100 border-orange-300',
    },
    {
      id: 'coordenador',
      nome: 'Coordenador',
      descricao: 'Líder Local de EBD da Congregação - Acesso apenas a EBD local',
      icon: '👥',
      cor: 'bg-yellow-100 border-yellow-300',
    },
  ];

  const getNivelInfo = (nivel: string) => {
    return nivelAcessoInfo.find(n => n.id === nivel);
  };

  const getCorNivel = (nivel: string) => {
    const info = getNivelInfo(nivel);
    return info?.cor || 'bg-gray-100 border-gray-300';
  };

  const getNomeNivel = (nivel: string) => {
    const info = getNivelInfo(nivel);
    return info?.nome || nivel;
  };

  const getIconNivel = (nivel: string) => {
    const info = getNivelInfo(nivel);
    return info?.icon || '👤';
  };

  const getCountByLevel = (nivelId: string) => {
    return usuarios.filter(u => u.nivel === nivelId).length;
  };

  useEffect(() => {
    const loadUsuarios = async () => {
      if (authLoading) return;
      setUsuariosLoading(true);
      setUsuariosError('');

      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        setUsuariosError('Sessao expirada.');
        setUsuariosLoading(false);
        return;
      }

      const res = await fetch('/api/usuarios', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        const err = await res.json();
        setUsuariosError(err?.error || 'Falha ao carregar usuarios.');
        setUsuariosLoading(false);
        return;
      }

      const payload = await res.json();
      setUsuarios(payload?.data || []);
      setUsuariosLoading(false);
    };

    loadUsuarios();
  }, [authLoading, supabase]);

  useEffect(() => {
    const loadCongregacoes = async () => {
      if (authLoading) return;
      setCongregacoesLoading(true);

      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        setCongregacoes([]);
        setCongregacoesLoading(false);
        return;
      }

      const { data: rows, error } = await supabase
        .from('congregacoes')
        .select('id, nome')
        .order('nome');

      if (!error && rows) {
        setCongregacoes(rows as CongregacaoOption[]);
      } else {
        setCongregacoes([]);
      }

      setCongregacoesLoading(false);
    };

    loadCongregacoes();
  }, [authLoading, supabase]);

  const openEditModal = (usuario: Usuario & { congregacao_id?: string | null }) => {
    setEditError('');
    setEditStatus('');
    setEditEmailConfirmed(Boolean(usuario.email_confirmed));
    setEditOriginalStatus(usuario.status);
    setEditData({
      user_id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      nivel: usuario.nivel,
      congregacao_id: usuario.congregacao_id || '',
      status: usuario.status,
      senha: '',
      confirmar_senha: '',
    });
    setEditOpen(true);
  };

  const handleEditChange = (field: keyof typeof editData, value: string) => {
    setEditData(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveEdit = async () => {
    setEditError('');
    setEditStatus('');

    if (!editData.nome.trim() || !editData.email.trim() || !editData.nivel) {
      setEditError('Preencha nome, email e nivel de acesso.');
      return;
    }

    if (editData.senha && editData.senha.length < 6) {
      setEditError('Senha precisa ter pelo menos 6 caracteres.');
      return;
    }

    if (editData.senha && editData.senha !== editData.confirmar_senha) {
      setEditError('As senhas nao coincidem.');
      return;
    }

    if ((editData.nivel === 'operador' || editData.nivel === 'coordenador') && !editData.congregacao_id) {
      setEditError('Congregacao obrigatoria para este nivel.');
      return;
    }

    if (editOriginalStatus === 'ativo' && editData.status === 'inativo') {
      const confirmed = window.confirm('Tem certeza que deseja desativar este usuario?');
      if (!confirmed) return;
    }

    setEditSaving(true);

    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      setEditError('Sessao expirada.');
      setEditSaving(false);
      return;
    }

    const res = await fetch('/api/usuarios', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        user_id: editData.user_id,
        nome: editData.nome.trim(),
        email: editData.email.trim(),
        nivel: editData.nivel,
        congregacao_id: editData.congregacao_id || null,
        status: editData.status,
        senha: editData.senha ? editData.senha : undefined,
      })
    });

    if (!res.ok) {
      const err = await res.json();
      setEditError(err?.error || 'Falha ao salvar usuario.');
      setEditSaving(false);
      return;
    }

    setEditStatus('Usuario atualizado com sucesso.');
    setEditSaving(false);

    const { data: sessionData } = await supabase.auth.getSession();
    const refreshToken = sessionData.session?.access_token;
    if (refreshToken) {
      const refresh = await fetch('/api/usuarios', {
        headers: { Authorization: `Bearer ${refreshToken}` }
      });
      if (refresh.ok) {
        const payload = await refresh.json();
        setUsuarios(payload?.data || []);
      }
    }
  };

  const handleFormChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleCreateUser = async () => {
    setFormError('');
    setFormStatus('');

    if (!formData.nome.trim() || !formData.email.trim() || !formData.nivel) {
      setFormError('Preencha nome, email e nivel de acesso.');
      return;
    }

    if (!formData.senha.trim() || formData.senha.length < 6) {
      setFormError('Informe uma senha com pelo menos 6 caracteres.');
      return;
    }

    if ((formData.nivel === 'operador' || formData.nivel === 'coordenador') && !formData.congregacao_id) {
      setFormError('Congregacao obrigatoria para este nivel.');
      return;
    }

    if (formData.senha !== formData.confirmar_senha) {
      setFormError('As senhas nao coincidem.');
      return;
    }

    setCreatingUser(true);

    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      setFormError('Sessao expirada.');
      setCreatingUser(false);
      return;
    }

    const res = await fetch('/api/usuarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        nome: formData.nome.trim(),
        email: formData.email.trim(),
        nivel: formData.nivel,
        congregacao_id: formData.congregacao_id || null,
        senha: formData.senha,
      })
    });

    if (!res.ok) {
      const err = await res.json();
      setFormError(err?.error || 'Falha ao criar usuario.');
      setCreatingUser(false);
      return;
    }

    setFormStatus('Usuario criado com sucesso.');
    setFormData({
      nome: '',
      email: '',
      nivel: '',
      congregacao_id: '',
      senha: '',
      confirmar_senha: '',
    });
    setSelectedLevel('');
    setCreatingUser(false);

    const { data: sessionData } = await supabase.auth.getSession();
    const refreshToken = sessionData.session?.access_token;
    if (refreshToken) {
      const refresh = await fetch('/api/usuarios', {
        headers: { Authorization: `Bearer ${refreshToken}` }
      });
      if (refresh.ok) {
        const payload = await refresh.json();
        setUsuarios(payload?.data || []);
      }
    }
  };

  // Paginação
  const totalPages = Math.max(1, Math.ceil(usuarios.length / itemsPerPage));
  const startIndex = usuarios.length === 0 ? 0 : (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const usuariosPaginados = usuarios.slice(startIndex, endIndex);

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar activeMenu={activeMenu} setActiveMenu={setActiveMenu} />

      {/* MAIN CONTENT */}
      <div className="flex-1 overflow-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-4xl font-bold text-[#123b63]">Usuários</h1>
              <p className="text-gray-600 mt-2">Gerencie usuários e seus níveis de acesso</p>
            </div>
            <button
              onClick={() => setShowForm(!showForm)}
              className="bg-[#0284c7] text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition font-semibold"
            >
              + Novo Usuário
            </button>
          </div>

          {/* Níveis de Acesso */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            {nivelAcessoInfo.map(nivel => (
              <div
                key={nivel.id}
                className={`${nivel.cor} border-2 rounded-lg p-4 cursor-pointer transition hover:shadow-lg flex items-center justify-between`}
              >
                <div className="flex-1">
                  <div className="text-2xl mb-1">{nivel.icon}</div>
                  <h3 className="font-bold text-[#123b63] text-sm">{nivel.nome}</h3>
                  <p className="text-xs text-gray-700">{nivel.descricao}</p>
                </div>
                <div className="text-right ml-3">
                  <p className="text-2xl font-bold text-[#123b63]">{getCountByLevel(nivel.id)}</p>
                  <p className="text-xs text-gray-600">usuário{getCountByLevel(nivel.id) !== 1 ? 's' : ''}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Form de novo usuário */}
          {showForm && (
            <div className="bg-white rounded-lg p-6 shadow-md mb-6 border-2 border-[#123b63]">
              <h2 className="text-2xl font-bold text-[#123b63] mb-4">Adicionar Novo Usuário</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <input
                  type="text"
                  placeholder="Nome completo"
                  value={formData.nome}
                  onChange={(e) => handleFormChange('nome', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-[#0284c7]"
                />
                <input
                  type="email"
                  placeholder="E-mail"
                  value={formData.email}
                  onChange={(e) => handleFormChange('email', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-[#0284c7]"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-semibold text-[#123b63] mb-2">Nível de Acesso</label>
                  <select
                    value={formData.nivel}
                    onChange={(e) => {
                      const value = e.target.value;
                      handleFormChange('nivel', value);
                      setSelectedLevel(value);
                    }}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-[#0284c7]"
                  >
                    <option value="">Selecione um nível</option>
                    {nivelAcessoInfo.map(nivel => (
                      <option key={nivel.id} value={nivel.id}>
                        {nivel.icon} {nivel.nome}
                      </option>
                    ))}
                  </select>
                </div>
                {selectedLevel && (selectedLevel === 'operador' || selectedLevel === 'coordenador') && (
                  <select
                    value={formData.congregacao_id}
                    onChange={(e) => handleFormChange('congregacao_id', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-[#0284c7]"
                    disabled={congregacoesLoading}
                  >
                    <option value="">Selecione a congregacao</option>
                    {congregacoes.map((c) => (
                      <option key={c.id} value={c.id}>{c.nome}</option>
                    ))}
                  </select>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <input
                  type="password"
                  placeholder="Senha"
                  value={formData.senha}
                  onChange={(e) => handleFormChange('senha', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-[#0284c7]"
                />
                <input
                  type="password"
                  placeholder="Confirmar Senha"
                  value={formData.confirmar_senha}
                  onChange={(e) => handleFormChange('confirmar_senha', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-[#0284c7]"
                />
              </div>

              {formError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 text-sm text-red-700 rounded">
                  {formError}
                </div>
              )}
              {formStatus && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 text-sm text-green-700 rounded">
                  {formStatus}
                </div>
              )}

              <div className="flex gap-6">
                <button
                  onClick={() => setShowForm(false)}
                  className="flex-1 bg-gray-300 text-[#123b63] px-6 py-3 rounded-lg hover:bg-gray-400 transition font-semibold"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCreateUser}
                  disabled={creatingUser}
                  className="flex-1 bg-[#0284c7] text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition font-semibold"
                >
                  {creatingUser ? 'Criando...' : 'Criar Usuário'}
                </button>
              </div>
            </div>
          )}

          {/* Lista de Usuários */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden mt-4">
            <div className="bg-[#123b63] text-white px-6 py-3">
              <h2 className="text-xl font-bold">Usuários Cadastrados ({usuarios.length})</h2>
            </div>

            {usuariosError && (
              <div className="px-6 py-4 text-sm text-red-700 bg-red-50 border-b border-red-200">
                {usuariosError}
              </div>
            )}


            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100 border-b">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-[#123b63]">Nome</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-[#123b63]">E-mail</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-[#123b63]">Nível de Acesso</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-[#123b63]">Congregação</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-[#123b63]">Status</th>
                    <th className="px-6 py-4 text-center text-sm font-semibold text-[#123b63]">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {usuariosLoading ? (
                    <tr>
                      <td className="px-6 py-6 text-sm text-gray-500" colSpan={6}>Carregando usuarios...</td>
                    </tr>
                  ) : usuariosPaginados.length === 0 ? (
                    <tr>
                      <td className="px-6 py-6 text-sm text-gray-500" colSpan={6}>Nenhum usuario encontrado.</td>
                    </tr>
                  ) : usuariosPaginados.map((usuario, index) => (
                    <tr
                      key={usuario.id}
                      className={`border-b hover:bg-gray-50 transition ${
                        index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                      }`}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${getCorNivel(usuario.nivel)}`}>
                            {getIconNivel(usuario.nivel)}
                          </div>
                          <div>
                            <div className="font-semibold text-[#123b63]">{usuario.nome}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-700">{usuario.email}</td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getCorNivel(usuario.nivel)} border border-gray-300`}>
                          {getNomeNivel(usuario.nivel)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-700">{usuario.congregacao || '—'}</td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                          usuario.status === 'ativo'
                            ? 'bg-green-100 text-green-800 border border-green-300'
                            : 'bg-red-100 text-red-800 border border-red-300'
                        }`}>
                          {usuario.status === 'ativo' ? '✓ Ativo' : '✗ Inativo'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex gap-2 justify-center">
                          <button
                            onClick={() => openEditModal(usuario)}
                            className="text-blue-600 hover:text-blue-800 font-semibold text-sm"
                          >
                            Editar
                          </button>
                          <span className="text-gray-300">|</span>
                          <button className="text-red-600 hover:text-red-800 font-semibold text-sm">Remover</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Paginação */}
            <div className="bg-gray-50 px-6 py-4 flex items-center justify-between border-t">
              <div className="text-sm text-gray-600">
                Mostrando {usuarios.length === 0 ? 0 : startIndex + 1} a {Math.min(endIndex, usuarios.length)} de {usuarios.length} usuários
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition font-semibold text-sm"
                >
                  ← Anterior
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`px-3 py-2 rounded-lg font-semibold text-sm transition ${
                        currentPage === page
                          ? 'bg-[#0284c7] text-white'
                          : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition font-semibold text-sm"
                >
                  Próxima →
                </button>
              </div>
            </div>
          </div>
        </div>

        {editOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="bg-white w-full max-w-2xl rounded-lg shadow-lg">
              <div className="px-6 py-4 border-b flex items-center justify-between">
                <h3 className="text-lg font-semibold text-[#123b63]">Editar Usuário</h3>
                <button
                  onClick={() => setEditOpen(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-[#123b63] mb-2">Nome</label>
                    <input
                      value={editData.nome}
                      onChange={(e) => handleEditChange('nome', e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-[#0284c7]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-[#123b63] mb-2">E-mail</label>
                    <input
                      type="email"
                      value={editData.email}
                      onChange={(e) => handleEditChange('email', e.target.value)}
                      disabled={!editEmailConfirmed}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-[#0284c7]"
                    />
                    {!editEmailConfirmed && (
                      <p className="text-xs text-gray-500 mt-1">
                        Email nao confirmado. Alteracao bloqueada.
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-[#123b63] mb-2">Nível de Acesso</label>
                    <select
                      value={editData.nivel}
                      onChange={(e) => handleEditChange('nivel', e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-[#0284c7]"
                    >
                      <option value="">Selecione</option>
                      {nivelAcessoInfo.map(nivel => (
                        <option key={nivel.id} value={nivel.id}>
                          {nivel.icon} {nivel.nome}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-[#123b63] mb-2">Status</label>
                    <select
                      value={editData.status}
                      onChange={(e) => handleEditChange('status', e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-[#0284c7]"
                    >
                      <option value="ativo">Ativo</option>
                      <option value="inativo">Inativo</option>
                    </select>
                  </div>
                </div>

                {(editData.nivel === 'operador' || editData.nivel === 'coordenador') && (
                  <div>
                    <label className="block text-sm font-semibold text-[#123b63] mb-2">Congregação</label>
                    <select
                      value={editData.congregacao_id}
                      onChange={(e) => handleEditChange('congregacao_id', e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-[#0284c7]"
                      disabled={congregacoesLoading}
                    >
                      <option value="">Selecione a congregacao</option>
                      {congregacoes.map((c) => (
                        <option key={c.id} value={c.id}>{c.nome}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-[#123b63] mb-2">Nova Senha</label>
                    <input
                      type="password"
                      value={editData.senha}
                      onChange={(e) => handleEditChange('senha', e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-[#0284c7]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-[#123b63] mb-2">Confirmar Senha</label>
                    <input
                      type="password"
                      value={editData.confirmar_senha}
                      onChange={(e) => handleEditChange('confirmar_senha', e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-[#0284c7]"
                    />
                  </div>
                </div>

                {editError && (
                  <div className="p-3 bg-red-50 border border-red-200 text-sm text-red-700 rounded">
                    {editError}
                  </div>
                )}
                {editStatus && (
                  <div className="p-3 bg-green-50 border border-green-200 text-sm text-green-700 rounded">
                    {editStatus}
                  </div>
                )}
              </div>

              <div className="px-6 py-4 border-t flex flex-col sm:flex-row gap-2 justify-end">
                <button
                  onClick={() => setEditOpen(false)}
                  className="px-4 py-2 rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={editSaving}
                  className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {editSaving ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
