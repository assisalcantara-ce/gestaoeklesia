'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import NotificationModal from '@/components/NotificationModal';
import { createClient } from '@/lib/supabase-client';
import { useRequireSupabaseAuth } from '@/hooks/useRequireSupabaseAuth';
import { formatPhone } from '@/lib/mascaras';

interface Membro {
  id: string;
  nome: string;
  cpf: string;
  email?: string;
  telefone?: string;
  dataNascimento?: string;
  rg?: string;
}

interface Funcionario {
  id: string;
  ministry_id: string;
  member_id: string;
  nome?: string;
  cpf?: string;
  email?: string;
  grupo: string;
  funcao: string;
  telefone?: string;
  whatsapp?: string;
  rg?: string;
  endereco?: string;
  cep?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  dataNascimento?: string;
  data_admissao: string;
  status: 'ATIVO' | 'INATIVO';
  banco?: string;
  agencia?: string;
  conta_corrente?: string;
  pix?: string;
  obs?: string;
  created_at?: string;
  updated_at?: string;
  member_name?: string;
  member_cpf?: string;
}

const GRUPOS_FUNCAO = [
  { valor: '', label: 'Escolha um Grupo' },
  { valor: 'administrativo', label: 'Administrativo' },
  { valor: 'financeiro', label: 'Financeiro' },
  { valor: 'pastoral', label: 'Pastoral' },
  { valor: 'manutencao', label: 'Manutenção' },
  { valor: 'seguranca', label: 'Segurança' },
  { valor: 'limpeza', label: 'Limpeza' },
  { valor: 'eventos', label: 'Eventos' }
];

const FUNCOES = [
  { valor: '', label: 'Escolha uma Função' },
  { valor: 'gerente', label: 'Gerente' },
  { valor: 'assistente', label: 'Assistente' },
  { valor: 'especialista', label: 'Especialista' },
  { valor: 'operacional', label: 'Operacional' },
  { valor: 'supervisor', label: 'Supervisor' }
];

const BANCOS = [
  { valor: '', label: 'Escolha um Banco' },
  { valor: 'BB', label: 'Banco do Brasil' },
  { valor: 'CEF', label: 'Caixa Econômica Federal' },
  { valor: 'ITAU', label: 'Itaú' },
  { valor: 'BRADESCO', label: 'Bradesco' },
  { valor: 'SANTANDER', label: 'Santander' },
  { valor: 'NUBANK', label: 'Nubank' },
  { valor: 'INTER', label: 'Inter' }
];

const UFDADOS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];

export default function GerenciarFuncionarios() {
  const supabase = createClient();
  const { loading: authLoading } = useRequireSupabaseAuth();

  const [membros, setMembros] = useState<Membro[]>([]);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [searchMembro, setSearchMembro] = useState('');
  const [searchResults, setSearchResults] = useState<Membro[]>([]);
  const [membroSelecionado, setMembroSelecionado] = useState<Membro | null>(null);
  const [filtroGrupo, setFiltroGrupo] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('ATIVO');
  const [modalSucesso, setModalSucesso] = useState<{ isOpen: boolean; title: string; message: string; type: 'success' | 'error' | 'warning' | 'info' }>({ isOpen: false, title: '', message: '', type: 'success' });
  const [abaAtiva, setAbaAtiva] = useState<'cadastro' | 'lista'>('cadastro');
  const [activeMenu, setActiveMenu] = useState<string>('funcionarios');

  const [formData, setFormData] = useState({
    grupo: '',
    funcao: '',
    email: '',
    telefone: '',
    whatsapp: '',
    rg: '',
    endereco: '',
    cep: '',
    bairro: '',
    cidade: '',
    uf: '',
    dataNascimento: '',
    dataAdmissao: new Date().toISOString().split('T')[0],
    status: 'ATIVO',
    banco: '',
    agencia: '',
    contaCorrente: '',
    pix: '',
    obs: ''
  });

  const getAccessTokenOrThrow = async () => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error('Não autenticado');
    return token;
  };

  const carregarMembros = async () => {
    try {
      const accessToken = await getAccessTokenOrThrow();
      const response = await fetch('/api/v1/members?limit=1000', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Erro ao carregar membros');

      if (data.data) {
        const membrosMapeados = data.data.map((m: any) => ({
          id: m.id,
          nome: m.name || '',
          cpf: m.cpf || '',
          email: m.email || '',
          telefone: m.phone || '',
          dataNascimento: m.birth_date || '',
          rg: m.rg || '',
        }));
        setMembros(membrosMapeados);
      }
    } catch (error) {
      console.error('Erro ao carregar membros:', error);
    }
  };

  const carregarFuncionarios = async () => {
    try {
      const accessToken = await getAccessTokenOrThrow();
      const response = await fetch('/api/v1/employees?limit=1000', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Erro ao carregar funcionários');

      if (data.data) {
        setFuncionarios(data.data);
      }
    } catch (error) {
      console.error('Erro ao carregar funcionários:', error);
    }
  };

  // Carregar membros do Supabase e funcionários da API
  useEffect(() => {
    carregarMembros();
    carregarFuncionarios();
  }, []);

  // Buscar membros
  const handleSearchMembro = (valor: string) => {
    setSearchMembro(valor);
    if (valor.length < 2) {
      setSearchResults([]);
      return;
    }

    const resultados = membros.filter(m =>
      m.nome.toLowerCase().includes(valor.toLowerCase()) ||
      m.cpf.includes(valor)
    );

    setSearchResults(resultados);
  };

  // Selecionar membro e preencher dados
  const handleSelecionarMembro = (membro: Membro) => {
    setMembroSelecionado(membro);
    setSearchMembro('');
    setSearchResults([]);

    // Preencher campos automaticamente
    setFormData(prev => ({
      ...prev,
      email: membro.email || '',
      telefone: membro.telefone || '',
      rg: membro.rg || '',
      dataNascimento: membro.dataNascimento || ''
    }));
  };

  // Limpar seleção de membro
  const handleLimparMembro = () => {
    setMembroSelecionado(null);
    setFormData({
      grupo: '',
      funcao: '',
      email: '',
      telefone: '',
      whatsapp: '',
      rg: '',
      endereco: '',
      cep: '',
      bairro: '',
      cidade: '',
      uf: '',
      dataNascimento: '',
      dataAdmissao: new Date().toISOString().split('T')[0],
      status: 'ATIVO',
      banco: '',
      agencia: '',
      contaCorrente: '',
      pix: '',
      obs: ''
    });
  };

  // Atualizar campo do formulário
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    const nextValue = name === 'telefone' || name === 'whatsapp'
      ? formatPhone(value)
      : value;
    setFormData(prev => ({
      ...prev,
      [name]: nextValue
    }));
  };

  // Cadastrar funcionário
  const handleCadastrar = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!membroSelecionado) {
      setModalSucesso({
        isOpen: true,
        title: 'Erro',
        message: 'Selecione um membro para cadastrar como funcionário.',
        type: 'error'
      });
      return;
    }

    if (!formData.grupo || !formData.funcao) {
      setModalSucesso({
        isOpen: true,
        title: 'Erro',
        message: 'Grupo e Função são obrigatórios.',
        type: 'error'
      });
      return;
    }

    try {
      const accessToken = await getAccessTokenOrThrow();
      // Enviar dados para API
      const response = await fetch('/api/v1/employees', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          member_id: membroSelecionado.id,
          grupo: formData.grupo,
          funcao: formData.funcao,
          email: formData.email,
          telefone: formData.telefone,
          whatsapp: formData.whatsapp,
          rg: formData.rg,
          endereco: formData.endereco,
          cep: formData.cep,
          bairro: formData.bairro,
          cidade: formData.cidade,
          uf: formData.uf,
          data_admissao: formData.dataAdmissao,
          status: formData.status,
          banco: formData.banco,
          agencia: formData.agencia,
          conta_corrente: formData.contaCorrente,
          pix: formData.pix,
          obs: formData.obs
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao cadastrar funcionário');
      }

      setModalSucesso({
        isOpen: true,
        title: 'Sucesso!',
        message: `Funcionário ${membroSelecionado.nome} cadastrado com sucesso.`,
        type: 'success'
      });

      // Recarregar lista de funcionários
      await carregarFuncionarios();

      // Limpar formulário
      handleLimparMembro();
    } catch (error: any) {
      setModalSucesso({
        isOpen: true,
        title: 'Erro',
        message: error.message || 'Erro ao cadastrar funcionário',
        type: 'error'
      });
    }
  };

  // Deletar funcionário
  const handleDeletar = async (id: string) => {
    try {
      const accessToken = await getAccessTokenOrThrow();
      const response = await fetch(`/api/v1/employees/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erro ao deletar funcionário');
      }

      await carregarFuncionarios();

      setModalSucesso({
        isOpen: true,
        title: 'Sucesso!',
        message: 'Funcionário removido com sucesso.',
        type: 'success'
      });
    } catch (error: any) {
      setModalSucesso({
        isOpen: true,
        title: 'Erro',
        message: error.message || 'Erro ao remover funcionário',
        type: 'error'
      });
    }
  };

  // Filtrar funcionários
  const funcionariosFiltrados = funcionarios.filter(f => {
    if (filtroGrupo && f.grupo !== filtroGrupo) return false;
    if (f.status !== filtroStatus) return false;
    return true;
  });

  if (authLoading) return <div className="p-8">Carregando...</div>;

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar activeMenu={activeMenu} setActiveMenu={setActiveMenu} />

      <div className="flex-1 overflow-auto">
        <div className="p-6 max-w-7xl mx-auto">
          {/* Cabeçalho */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-4xl">👔</span>
              <h1 className="text-3xl font-bold text-gray-800">Gerenciar Funcionários</h1>
            </div>
            <p className="text-gray-600">Gerencie os funcionários da instituição</p>
          </div>

          {/* Abas */}
          <div className="mb-6 border-b border-gray-300">
            <div className="flex gap-4">
              <button
                onClick={() => setAbaAtiva('cadastro')}
                className={`px-6 py-3 font-semibold border-b-2 transition ${
                  abaAtiva === 'cadastro'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-800'
                }`}
              >
                ➕ Cadastrar Novo
              </button>
              <button
                onClick={() => setAbaAtiva('lista')}
                className={`px-6 py-3 font-semibold border-b-2 transition ${
                  abaAtiva === 'lista'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-800'
                }`}
              >
                📋 Lista de Funcionários ({funcionarios.length})
              </button>
            </div>
          </div>

          {/* ABA: CADASTRO */}
          {abaAtiva === 'cadastro' && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <form onSubmit={handleCadastrar}>
                {/* SEÇÃO: BUSCA E SELEÇÃO DE MEMBRO */}
                <div className="mb-8">
                  <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <span>👥</span> Dados Pessoais
                  </h2>

                  {/* Busca de Membro */}
                  <div className="mb-4">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Buscar Membro *
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Digite nome ou CPF do membro..."
                        value={searchMembro}
                        onChange={(e) => handleSearchMembro(e.target.value)}
                        className="w-full px-4 py-2 border-2 border-teal-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />

                      {/* Dropdown de resultados */}
                      {searchResults.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-300 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                          {searchResults.map(membro => (
                            <button
                              key={membro.id}
                              type="button"
                              onClick={() => handleSelecionarMembro(membro)}
                              className="w-full text-left px-4 py-2 hover:bg-blue-50 border-b border-gray-200 last:border-0"
                            >
                              <div className="font-semibold">{membro.nome}</div>
                              <div className="text-sm text-gray-500">CPF: {membro.cpf}</div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Membro Selecionado */}
                  {membroSelecionado && (
                    <div className="mb-4 p-4 bg-green-50 border-2 border-green-500 rounded-lg">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-bold text-green-800">{membroSelecionado.nome}</h3>
                          <p className="text-sm text-green-700">CPF: {membroSelecionado.cpf}</p>
                        </div>
                        <button
                          type="button"
                          onClick={handleLimparMembro}
                          className="text-green-700 hover:text-green-900 font-semibold"
                        >
                          ✕ Limpar
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Campos de Dados Pessoais (preenchidos dinamicamente) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">
                        Email
                      </label>
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        placeholder="email@example.com"
                        className="w-full px-3 py-2 border-2 border-teal-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">
                        CPF *
                      </label>
                      <input
                        type="text"
                        value={membroSelecionado?.cpf || ''}
                        disabled
                        className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg bg-gray-100 text-gray-600"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">
                        RG
                      </label>
                      <input
                        type="text"
                        name="rg"
                        value={formData.rg}
                        onChange={handleInputChange}
                        placeholder="00.000.000-0"
                        className="w-full px-3 py-2 border-2 border-teal-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">
                        Data de Nascimento
                      </label>
                      <input
                        type="date"
                        name="dataNascimento"
                        value={formData.dataNascimento}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border-2 border-teal-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">
                        Telefone Celular
                      </label>
                      <input
                        type="tel"
                        name="telefone"
                        value={formData.telefone}
                        onChange={handleInputChange}
                        placeholder="(11) 99999-9999"
                        className="w-full px-3 py-2 border-2 border-teal-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">
                        Whatsapp *
                      </label>
                      <input
                        type="tel"
                        name="whatsapp"
                        value={formData.whatsapp}
                        onChange={handleInputChange}
                        placeholder="(11) 99999-9999"
                        className="w-full px-3 py-2 border-2 border-teal-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>

                {/* SEÇÃO: INFORMAÇÕES PROFISSIONAIS */}
                <div className="mb-8 p-4 bg-gray-50 rounded-lg">
                  <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <span>💼</span> Informações Profissionais
                  </h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">
                        Grupo *
                      </label>
                      <select
                        name="grupo"
                        value={formData.grupo}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border-2 border-teal-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {GRUPOS_FUNCAO.map(g => (
                          <option key={g.valor} value={g.valor}>{g.label}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">
                        Função *
                      </label>
                      <select
                        name="funcao"
                        value={formData.funcao}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border-2 border-teal-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {FUNCOES.map(f => (
                          <option key={f.valor} value={f.valor}>{f.label}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">
                        Data de Admissão
                      </label>
                      <input
                        type="date"
                        name="dataAdmissao"
                        value={formData.dataAdmissao}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border-2 border-teal-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">
                        STATUS
                      </label>
                      <select
                        name="status"
                        value={formData.status}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border-2 border-teal-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="ATIVO">ATIVO</option>
                        <option value="INATIVO">INATIVO</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* SEÇÃO: ENDEREÇO */}
                <div className="mb-8 p-4 bg-gray-50 rounded-lg">
                  <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <span>📍</span> Endereço
                  </h2>

                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">
                        CEP
                      </label>
                      <input
                        type="text"
                        name="cep"
                        value={formData.cep}
                        onChange={handleInputChange}
                        placeholder="00000-000"
                        className="w-full px-3 py-2 border-2 border-teal-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">
                        Endereço
                      </label>
                      <input
                        type="text"
                        name="endereco"
                        value={formData.endereco}
                        onChange={handleInputChange}
                        placeholder="Rua, Avenida, etc..."
                        className="w-full px-3 py-2 border-2 border-teal-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">
                          Bairro
                        </label>
                        <input
                          type="text"
                          name="bairro"
                          value={formData.bairro}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border-2 border-teal-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">
                          Cidade
                        </label>
                        <input
                          type="text"
                          name="cidade"
                          value={formData.cidade}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border-2 border-teal-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">
                          UF
                        </label>
                        <select
                          name="uf"
                          value={formData.uf}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border-2 border-teal-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Escolha um Estado</option>
                          {UFDADOS.map(uf => (
                            <option key={uf} value={uf}>{uf}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* SEÇÃO: DADOS FINANCEIROS */}
                <div className="mb-8 p-4 bg-gray-50 rounded-lg">
                  <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <span>💰</span> Dados Financeiros
                  </h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">
                        Banco
                      </label>
                      <select
                        name="banco"
                        value={formData.banco}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border-2 border-teal-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {BANCOS.map(b => (
                          <option key={b.valor} value={b.valor}>{b.label}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">
                        Agência
                      </label>
                      <input
                        type="text"
                        name="agencia"
                        value={formData.agencia}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border-2 border-teal-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">
                        Conta Corrente
                      </label>
                      <input
                        type="text"
                        name="contaCorrente"
                        value={formData.contaCorrente}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border-2 border-teal-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">
                        PIX
                      </label>
                      <input
                        type="text"
                        name="pix"
                        value={formData.pix}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border-2 border-teal-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>

                {/* SEÇÃO: OBSERVAÇÕES */}
                <div className="mb-8 p-4 bg-gray-50 rounded-lg">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    OBS.
                  </label>
                  <textarea
                    name="obs"
                    value={formData.obs}
                    onChange={handleInputChange}
                    placeholder="Observações adicionais..."
                    className="w-full px-3 py-2 border-2 border-teal-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    rows={3}
                  />
                </div>

                {/* BOTÃO CADASTRAR */}
                <button
                  type="submit"
                  className="w-full px-6 py-3 bg-teal-500 text-white font-bold rounded-lg hover:bg-teal-600 transition shadow-md"
                >
                  CADASTRAR
                </button>
              </form>
            </div>
          )}

          {/* ABA: LISTA */}
          {abaAtiva === 'lista' && (
            <div className="bg-white rounded-lg shadow-md p-6">
              {/* FILTROS */}
              <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Filtrar por Grupo
                  </label>
                  <select
                    value={filtroGrupo}
                    onChange={(e) => setFiltroGrupo(e.target.value)}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Todos os Grupos</option>
                    {GRUPOS_FUNCAO.filter(g => g.valor).map(g => (
                      <option key={g.valor} value={g.valor}>{g.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Status
                  </label>
                  <select
                    value={filtroStatus}
                    onChange={(e) => setFiltroStatus(e.target.value as 'ATIVO' | 'INATIVO')}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="ATIVO">ATIVO</option>
                    <option value="INATIVO">INATIVO</option>
                  </select>
                </div>
              </div>

              {/* TABELA */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-200 text-gray-800">
                      <th className="px-4 py-3 text-left font-semibold">Nome</th>
                      <th className="px-4 py-3 text-left font-semibold">CPF</th>
                      <th className="px-4 py-3 text-left font-semibold">Grupo</th>
                      <th className="px-4 py-3 text-left font-semibold">Função</th>
                      <th className="px-4 py-3 text-left font-semibold">Email</th>
                      <th className="px-4 py-3 text-left font-semibold">WhatsApp</th>
                      <th className="px-4 py-3 text-left font-semibold">Adm.</th>
                      <th className="px-4 py-3 text-left font-semibold">Status</th>
                      <th className="px-4 py-3 text-center font-semibold">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {funcionariosFiltrados.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-4 py-6 text-center text-gray-500">
                          Nenhum funcionário encontrado.
                        </td>
                      </tr>
                    ) : (
                      funcionariosFiltrados.map(func => (
                        <tr key={func.id} className="border-b border-gray-200 hover:bg-gray-50">
                          <td className="px-4 py-3 font-semibold">{func.member_name || func.nome}</td>
                          <td className="px-4 py-3">{func.member_cpf || func.cpf}</td>
                          <td className="px-4 py-3">
                            <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold">
                              {func.grupo}
                            </span>
                          </td>
                          <td className="px-4 py-3">{func.funcao}</td>
                          <td className="px-4 py-3">{func.email || '-'}</td>
                          <td className="px-4 py-3">{func.whatsapp || '-'}</td>
                          <td className="px-4 py-3 text-sm">{new Date(func.data_admissao).toLocaleDateString()}</td>
                          <td className="px-4 py-3">
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                              func.status === 'ATIVO' 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {func.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => handleDeletar(func.id)}
                              className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition text-xs font-semibold"
                            >
                              Deletar
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      <NotificationModal
        isOpen={modalSucesso.isOpen}
        title={modalSucesso.title}
        message={modalSucesso.message}
        type={modalSucesso.type}
        onClose={() => setModalSucesso({ isOpen: false, title: '', message: '', type: 'success' })}
      />
    </div>
  );
}
