'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useMemo } from 'react';
import PageLayout from '@/components/PageLayout';
import NotificationModal from '@/components/NotificationModal';
import { createClient } from '@/lib/supabase-client';
import { useRequireModulo } from '@/hooks/useRequireModulo';
import { usePlanFeatures } from '@/hooks/usePlanFeatures';
import { formatPhone } from '@/lib/mascaras';
import {
  Briefcase,
  Users,
  UserCheck,
  UserX,
  Layers,
  Plus,
  Search,
  X,
  CheckCircle2,
  Trash2,
  Building,
  Mail,
  Phone,
  Calendar,
  CreditCard,
  MapPin,
  Lock,
  ArrowRight,
  Filter,
  FileText
} from 'lucide-react';

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

const GRUPOS_FUNCAO_BASE = [
  { valor: '', label: 'Escolha um Grupo' },
  { valor: 'administrativo', label: 'Administrativo' },
  { valor: 'financeiro', label: 'Financeiro' },
  { valor: 'pastoral', label: 'Pastoral' },
  { valor: 'manutencao', label: 'Manutenção' },
  { valor: 'seguranca', label: 'Segurança' },
  { valor: 'limpeza', label: 'Limpeza' },
  { valor: 'eventos', label: 'Eventos' }
];

const FUNCOES_BASE = [
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

const FUNCIONARIOS_GRUPOS_KEY = 'funcionarios_grupos_custom';
const FUNCIONARIOS_FUNCOES_KEY = 'funcionarios_funcoes_custom';

const normalizeOptionValue = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

export default function GerenciarFuncionarios() {
  const supabase = createClient();
  const { ctx, bloqueado } = useRequireModulo('funcionarios');
  const planFeatures = usePlanFeatures();

  const [membros, setMembros] = useState<Membro[]>([]);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [searchMembro, setSearchMembro] = useState('');
  const [searchResults, setSearchResults] = useState<Membro[]>([]);
  const [membroSelecionado, setMembroSelecionado] = useState<Membro | null>(null);
  const [filtroGrupo, setFiltroGrupo] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('ATIVO');
  const [modalSucesso, setModalSucesso] = useState<{ isOpen: boolean; title: string; message: string; type: 'success' | 'error' | 'warning' | 'info' }>({ isOpen: false, title: '', message: '', type: 'success' });
  const [abaAtiva, setAbaAtiva] = useState<'cadastro' | 'lista'>('cadastro');
  const [gruposFuncao, setGruposFuncao] = useState(GRUPOS_FUNCAO_BASE);
  const [funcoes, setFuncoes] = useState(FUNCOES_BASE);
  const [novoGrupo, setNovoGrupo] = useState('');
  const [novaFuncao, setNovaFuncao] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [deletandoId, setDeletandoId] = useState<string | null>(null);

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

  useEffect(() => {
    carregarMembros();
    carregarFuncionarios();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const gruposRaw = localStorage.getItem(FUNCIONARIOS_GRUPOS_KEY);
      const funcoesRaw = localStorage.getItem(FUNCIONARIOS_FUNCOES_KEY);

      if (gruposRaw) {
        const parsed = JSON.parse(gruposRaw);
        if (Array.isArray(parsed)) {
          const extras = parsed
            .filter((x: any) => x && typeof x.valor === 'string' && typeof x.label === 'string')
            .map((x: any) => ({ valor: String(x.valor), label: String(x.label) }));
          setGruposFuncao([...GRUPOS_FUNCAO_BASE, ...extras]);
        }
      }

      if (funcoesRaw) {
        const parsed = JSON.parse(funcoesRaw);
        if (Array.isArray(parsed)) {
          const extras = parsed
            .filter((x: any) => x && typeof x.valor === 'string' && typeof x.label === 'string')
            .map((x: any) => ({ valor: String(x.valor), label: String(x.label) }));
          setFuncoes([...FUNCOES_BASE, ...extras]);
        }
      }
    } catch {
      // ignore local parse errors
    }
  }, []);

  const persistCustomOptions = (key: string, options: Array<{ valor: string; label: string }>, baseOptions: Array<{ valor: string; label: string }>) => {
    if (typeof window === 'undefined') return;
    const baseValues = new Set(baseOptions.map(o => o.valor));
    const onlyCustom = options.filter(o => o.valor && !baseValues.has(o.valor));
    localStorage.setItem(key, JSON.stringify(onlyCustom));
  };

  const handleAdicionarGrupo = () => {
    const label = novoGrupo.trim();
    if (!label) return;

    const valor = normalizeOptionValue(label);
    if (!valor) return;

    const existe = gruposFuncao.some(g => g.valor === valor || g.label.toLowerCase() === label.toLowerCase());
    if (existe) {
      setModalSucesso({
        isOpen: true,
        title: 'Aviso',
        message: 'Este grupo já existe na lista.',
        type: 'warning'
      });
      return;
    }

    const next = [...gruposFuncao, { valor, label }];
    setGruposFuncao(next);
    setFormData(prev => ({ ...prev, grupo: valor }));
    setNovoGrupo('');
    persistCustomOptions(FUNCIONARIOS_GRUPOS_KEY, next, GRUPOS_FUNCAO_BASE);
  };

  const handleAdicionarFuncao = () => {
    const label = novaFuncao.trim();
    if (!label) return;

    const valor = normalizeOptionValue(label);
    if (!valor) return;

    const existe = funcoes.some(f => f.valor === valor || f.label.toLowerCase() === label.toLowerCase());
    if (existe) {
      setModalSucesso({
        isOpen: true,
        title: 'Aviso',
        message: 'Esta função já existe na lista.',
        type: 'warning'
      });
      return;
    }

    const next = [...funcoes, { valor, label }];
    setFuncoes(next);
    setFormData(prev => ({ ...prev, funcao: valor }));
    setNovaFuncao('');
    persistCustomOptions(FUNCIONARIOS_FUNCOES_KEY, next, FUNCOES_BASE);
  };

  const handleRemoverGrupoCustom = (valor: string) => {
    const baseValues = new Set(GRUPOS_FUNCAO_BASE.map(g => g.valor));
    if (baseValues.has(valor)) return;

    const next = gruposFuncao.filter(g => g.valor !== valor);
    setGruposFuncao(next);
    if (formData.grupo === valor) {
      setFormData(prev => ({ ...prev, grupo: '' }));
    }
    persistCustomOptions(FUNCIONARIOS_GRUPOS_KEY, next, GRUPOS_FUNCAO_BASE);
  };

  const handleRemoverFuncaoCustom = (valor: string) => {
    const baseValues = new Set(FUNCOES_BASE.map(f => f.valor));
    if (baseValues.has(valor)) return;

    const next = funcoes.filter(f => f.valor !== valor);
    setFuncoes(next);
    if (formData.funcao === valor) {
      setFormData(prev => ({ ...prev, funcao: '' }));
    }
    persistCustomOptions(FUNCIONARIOS_FUNCOES_KEY, next, FUNCOES_BASE);
  };

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

    setSalvando(true);
    try {
      const accessToken = await getAccessTokenOrThrow();
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

      await carregarFuncionarios();
      handleLimparMembro();
    } catch (error: any) {
      setModalSucesso({
        isOpen: true,
        title: 'Erro',
        message: error.message || 'Erro ao cadastrar funcionário',
        type: 'error'
      });
    } finally {
      setSalvando(false);
    }
  };

  // Deletar funcionário
  const handleDeletar = async (id: string) => {
    if (!confirm('Deseja realmente remover este funcionário?')) {
      return;
    }

    setDeletandoId(id);
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
    } finally {
      setDeletandoId(null);
    }
  };

  // Filtrar funcionários
  const funcionariosFiltrados = useMemo(() => {
    return funcionarios.filter(f => {
      if (filtroGrupo && f.grupo !== filtroGrupo) return false;
      if (filtroStatus && f.status !== filtroStatus) return false;
      return true;
    });
  }, [funcionarios, filtroGrupo, filtroStatus]);

  // Cálculos de KPIs no padrão de Membros
  const totalFuncionarios = funcionarios.length;
  const totalAtivos = funcionarios.filter(f => f.status === 'ATIVO').length;
  const totalInativos = funcionarios.filter(f => f.status === 'INATIVO').length;
  const totalDepartamentos = useMemo(() => {
    const s = new Set<string>();
    funcionarios.forEach(f => {
      if (f.grupo) s.add(f.grupo);
    });
    return s.size;
  }, [funcionarios]);

  const gruposCustom = gruposFuncao.filter(g => !GRUPOS_FUNCAO_BASE.some(base => base.valor === g.valor));
  const funcoesCustom = funcoes.filter(f => !FUNCOES_BASE.some(base => base.valor === f.valor));

  const isLocal = ctx.nivel && ['admin_local', 'financeiro_local', 'supervisor', 'viewer'].includes(ctx.nivel);

  if (ctx.loading || planFeatures.loading) {
    return (
      <div className="flex-1 overflow-y-auto bg-[#f4f7fa] min-h-screen flex items-center justify-center p-8">
        <div className="flex items-center gap-3 text-slate-500 font-semibold text-sm bg-white px-6 py-4 rounded-2xl shadow-xs border border-slate-200">
          <div className="w-5 h-5 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
          <span>Carregando gestão de colaboradores...</span>
        </div>
      </div>
    );
  }

  if (!planFeatures.has_modulo_funcionarios || !planFeatures.hasFeature('employees_module')) {
    return (
      <PageLayout title="Funcionários" description="Gestão de Funcionários & RH" activeMenu="funcionarios">
        <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm text-center max-w-2xl mx-auto space-y-5 my-10">
          <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto text-amber-600 shadow-sm border border-amber-200/60">
            <Briefcase className="w-8 h-8 text-amber-600" />
          </div>
          <div>
            <span className="inline-block px-3 py-1 bg-amber-100 text-amber-800 text-xs font-bold rounded-full mb-3">
              Recurso do Plano Intermediário
            </span>
            <h2 className="text-xl font-bold text-slate-800">Módulo Funcionários Indisponível no seu Plano</h2>
          </div>
          <p className="text-slate-600 text-base font-semibold leading-relaxed max-w-lg mx-auto">
            A Gestão de Funcionários & RH está disponível a partir do Plano Intermediário.
          </p>
          <p className="text-slate-500 text-xs leading-relaxed max-w-md mx-auto">
            Faça o upgrade para gerenciar cadastro de colaboradores, funções, folhas e permissões administrativas da instituição.
          </p>
          <div className="pt-3">
            <a
              href="/configuracoes"
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#123b63] text-white text-sm font-semibold rounded-xl hover:bg-[#1a4f85] transition shadow-md hover:shadow-lg"
            >
              Fazer Upgrade / Conhecer Planos
            </a>
          </div>
        </div>
      </PageLayout>
    );
  }

  if (bloqueado || isLocal) {
    return (
      <div className="flex-1 overflow-y-auto bg-[#f4f7fa] min-h-screen flex items-center justify-center p-8">
        <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm text-center max-w-md mx-auto space-y-4">
          <div className="w-14 h-14 bg-rose-50 rounded-2xl flex items-center justify-center mx-auto text-rose-600 border border-rose-200">
            <Lock className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold text-slate-800">Acesso Restrito</h2>
          <p className="text-slate-600 text-sm">
            A gestão de funcionários é de acesso restrito para a Sede do Ministério.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden bg-[#f4f7fa] min-h-screen">
      <div className="p-4 sm:p-6 lg:p-8 max-w-[96rem] mx-auto w-full">
        {/* Header da Página (Padrão Membros) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-teal-700 text-white flex items-center justify-center border border-teal-800 shadow-sm flex-shrink-0">
              <Briefcase className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Funcionários & RH</h1>
              <p className="text-xs sm:text-sm text-slate-600 font-medium mt-0.5">
                Gerencie colaboradores da instituição, vínculos com membros, funções e dados bancários.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={() => {
                handleLimparMembro();
                setAbaAtiva('cadastro');
              }}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold rounded-xl shadow-xs transition flex items-center gap-2 cursor-pointer text-xs sm:text-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Novo Colaborador</span>
            </button>
          </div>
        </div>

        {/* KPIs Coloridos Suaves (Padrão Membros) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* Total de Funcionários (Azul) */}
          <div className="bg-[#ebf5ff] border border-[#d0e6ff] rounded-3xl p-5 relative overflow-hidden shadow-xs hover:shadow-md transition-all flex items-center justify-between">
            <div className="flex items-center gap-3.5 flex-1 min-w-0">
              <div className="w-13 h-13 rounded-2xl bg-white text-[#2563eb] shadow-xs flex items-center justify-center flex-shrink-0 border border-[#dbeafe]">
                <Users className="w-7 h-7" />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold text-slate-800 block truncate">
                  Total de Funcionários
                </span>
                <p className="text-3xl font-black text-slate-900 leading-tight mt-0.5">
                  {totalFuncionarios}
                </p>
                <p className="text-[11px] font-bold text-teal-700 mt-1 truncate">
                  Quadro cadastrado
                </p>
              </div>
            </div>
            <div className="w-8 h-8 rounded-xl bg-[#dbeafe] text-[#2563eb] flex items-center justify-center flex-shrink-0 self-start">
              <Briefcase className="w-4 h-4" />
            </div>
          </div>

          {/* Ativos (Verde) */}
          <div className="bg-[#ecfdf3] border border-[#c7f3d6] rounded-3xl p-5 relative overflow-hidden shadow-xs hover:shadow-md transition-all flex items-center justify-between">
            <div className="flex items-center gap-3.5 flex-1 min-w-0">
              <div className="w-13 h-13 rounded-2xl bg-white text-[#059669] shadow-xs flex items-center justify-center flex-shrink-0 border border-[#d1fae5]">
                <UserCheck className="w-7 h-7" />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold text-slate-800 block truncate">
                  Colaboradores Ativos
                </span>
                <p className="text-3xl font-black text-slate-900 leading-tight mt-0.5">
                  {totalAtivos}
                </p>
                <p className="text-[11px] font-bold text-emerald-700 mt-1 truncate">
                  Em atividade
                </p>
              </div>
            </div>
            <div className="w-8 h-8 rounded-xl bg-[#d1fae5] text-[#059669] flex items-center justify-center flex-shrink-0 self-start">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>

          {/* Inativos (Âmbar) */}
          <div className="bg-[#fff6ea] border border-[#fde4c4] rounded-3xl p-5 relative overflow-hidden shadow-xs hover:shadow-md transition-all flex items-center justify-between">
            <div className="flex items-center gap-3.5 flex-1 min-w-0">
              <div className="w-13 h-13 rounded-2xl bg-white text-[#ea580c] shadow-xs flex items-center justify-center flex-shrink-0 border border-[#ffedd5]">
                <UserX className="w-7 h-7" />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold text-slate-800 block truncate">
                  Inativos / Desligados
                </span>
                <p className="text-3xl font-black text-slate-900 leading-tight mt-0.5">
                  {totalInativos}
                </p>
                <p className="text-[11px] font-bold text-amber-700 mt-1 truncate">
                  Sem vínculo ativo
                </p>
              </div>
            </div>
            <div className="w-8 h-8 rounded-xl bg-[#ffedd5] text-[#ea580c] flex items-center justify-center flex-shrink-0 self-start">
              <X className="w-4 h-4" />
            </div>
          </div>

          {/* Departamentos / Grupos (Roxo) */}
          <div className="bg-[#f5f3ff] border border-[#ddd6fe] rounded-3xl p-5 relative overflow-hidden shadow-xs hover:shadow-md transition-all flex items-center justify-between">
            <div className="flex items-center gap-3.5 flex-1 min-w-0">
              <div className="w-13 h-13 rounded-2xl bg-white text-[#7c3aed] shadow-xs flex items-center justify-center flex-shrink-0 border border-[#ede9fe]">
                <Layers className="w-7 h-7" />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold text-slate-800 block truncate">
                  Grupos & Departamentos
                </span>
                <p className="text-3xl font-black text-slate-900 leading-tight mt-0.5">
                  {totalDepartamentos}
                </p>
                <p className="text-[11px] font-bold text-purple-700 mt-1 truncate">
                  Setores operacionais
                </p>
              </div>
            </div>
            <div className="w-8 h-8 rounded-xl bg-[#ede9fe] text-[#7c3aed] flex items-center justify-center flex-shrink-0 self-start">
              <Building className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* Navegação de Abas por Pills (Padrão Membros) */}
        <div className="flex items-center gap-2.5 mb-6 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setAbaAtiva('cadastro')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              abaAtiva === 'cadastro'
                ? 'bg-teal-700 text-white shadow-sm border border-teal-800'
                : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 hover:text-slate-900 shadow-xs'
            }`}
          >
            <Plus className="w-4 h-4" />
            <span>Cadastrar Novo</span>
          </button>

          <button
            type="button"
            onClick={() => setAbaAtiva('lista')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              abaAtiva === 'lista'
                ? 'bg-teal-700 text-white shadow-sm border border-teal-800'
                : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 hover:text-slate-900 shadow-xs'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Lista de Funcionários ({funcionarios.length})</span>
          </button>
        </div>

        {/* ABA: CADASTRO */}
        {abaAtiva === 'cadastro' && (
          <form onSubmit={handleCadastrar} className="space-y-6">
            {/* Bloco 1: Seleção e Dados Pessoais */}
            <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/90 shadow-sm">
              <div className="flex items-center gap-2.5 pb-4 mb-5 border-b border-slate-100">
                <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-100">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Vínculo de Membro & Dados Pessoais</h2>
                  <p className="text-xs text-slate-500">Selecione um membro cadastrado para vincular como colaborador institucional.</p>
                </div>
              </div>

              {/* Busca de Membro */}
              <div className="mb-5">
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                  Buscar Membro Cadastrado *
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    placeholder="Digite o nome ou CPF do membro..."
                    value={searchMembro}
                    onChange={(e) => handleSearchMembro(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50/70 border border-slate-300 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition"
                  />

                  {/* Dropdown de resultados */}
                  {searchResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-xl z-20 max-h-56 overflow-y-auto divide-y divide-slate-100">
                      {searchResults.map(membro => (
                        <button
                          key={membro.id}
                          type="button"
                          onClick={() => handleSelecionarMembro(membro)}
                          className="w-full text-left px-4 py-3 hover:bg-teal-50/60 transition flex items-center justify-between group"
                        >
                          <div>
                            <p className="text-sm font-bold text-slate-800 group-hover:text-teal-700">{membro.nome}</p>
                            <p className="text-xs text-slate-500">CPF: {membro.cpf || 'Não informado'}</p>
                          </div>
                          <span className="text-xs font-bold text-teal-600 opacity-0 group-hover:opacity-100 transition flex items-center gap-1">
                            Selecionar <ArrowRight className="w-3.5 h-3.5" />
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Membro Selecionado Banner */}
              {membroSelecionado && (
                <div className="mb-5 p-4 bg-emerald-50/70 border border-emerald-300 rounded-2xl flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center flex-shrink-0 shadow-xs">
                      <UserCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs uppercase font-bold tracking-wider text-emerald-800">Membro Selecionado</p>
                      <h3 className="text-sm font-bold text-slate-900">{membroSelecionado.nome}</h3>
                      <p className="text-xs text-slate-600">CPF: {membroSelecionado.cpf}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleLimparMembro}
                    className="px-3 py-1.5 bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-100 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Trocar Membro</span>
                  </button>
                </div>
              )}

              {/* Campos de Dados Pessoais */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                    E-mail
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      placeholder="email@instituicao.org"
                      className="w-full pl-10 pr-3 py-2 bg-slate-50/70 border border-slate-300 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                    CPF (Membro) *
                  </label>
                  <input
                    type="text"
                    value={membroSelecionado?.cpf || ''}
                    disabled
                    placeholder="Selecione um membro acima"
                    className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-slate-600 text-sm font-medium cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                    RG
                  </label>
                  <input
                    type="text"
                    name="rg"
                    value={formData.rg}
                    onChange={handleInputChange}
                    placeholder="00.000.000-0"
                    className="w-full px-3 py-2 bg-slate-50/70 border border-slate-300 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                    Data de Nascimento
                  </label>
                  <div className="relative">
                    <Calendar className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="date"
                      name="dataNascimento"
                      value={formData.dataNascimento}
                      onChange={handleInputChange}
                      className="w-full pl-10 pr-3 py-2 bg-slate-50/70 border border-slate-300 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                    Telefone Fixo / Recado
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="tel"
                      name="telefone"
                      value={formData.telefone}
                      onChange={handleInputChange}
                      placeholder="(11) 99999-9999"
                      className="w-full pl-10 pr-3 py-2 bg-slate-50/70 border border-slate-300 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                    WhatsApp *
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="tel"
                      name="whatsapp"
                      value={formData.whatsapp}
                      onChange={handleInputChange}
                      placeholder="(11) 99999-9999"
                      className="w-full pl-10 pr-3 py-2 bg-slate-50/70 border border-slate-300 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Bloco 2: Cargo & Função Institucional */}
            <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/90 shadow-sm">
              <div className="flex items-center gap-2.5 pb-4 mb-5 border-b border-slate-100">
                <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-100">
                  <Briefcase className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Cargo & Função Institucional</h2>
                  <p className="text-xs text-slate-500">Defina o departamento, função, data de admissão e status operacional.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
                {/* Grupo / Departamento */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Grupo / Departamento *
                  </label>
                  <select
                    name="grupo"
                    value={formData.grupo}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2.5 bg-slate-50/70 border border-slate-300 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition"
                  >
                    {gruposFuncao.map(g => (
                      <option key={g.valor} value={g.valor}>{g.label}</option>
                    ))}
                  </select>

                  <div className="flex gap-2 pt-1">
                    <input
                      type="text"
                      value={novoGrupo}
                      onChange={(e) => setNovoGrupo(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAdicionarGrupo();
                        }
                      }}
                      placeholder="Novo grupo/setor..."
                      className="flex-1 px-3 py-2 bg-slate-50/70 border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition"
                    />
                    <button
                      type="button"
                      onClick={handleAdicionarGrupo}
                      className="px-3 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 shadow-2xs"
                    >
                      <Plus className="w-3.5 h-3.5" /> Adicionar
                    </button>
                  </div>

                  {gruposCustom.length > 0 && (
                    <div className="pt-2">
                      <p className="text-[11px] font-bold text-slate-500 mb-1.5">Grupos personalizados:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {gruposCustom.map(grupo => (
                          <span
                            key={grupo.valor}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-xs font-medium"
                          >
                            <span>{grupo.label}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoverGrupoCustom(grupo.valor)}
                              className="text-slate-400 hover:text-rose-600 font-bold transition"
                              title="Remover grupo"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Função / Atribuição */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Função / Cargo *
                  </label>
                  <select
                    name="funcao"
                    value={formData.funcao}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2.5 bg-slate-50/70 border border-slate-300 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition"
                  >
                    {funcoes.map(f => (
                      <option key={f.valor} value={f.valor}>{f.label}</option>
                    ))}
                  </select>

                  <div className="flex gap-2 pt-1">
                    <input
                      type="text"
                      value={novaFuncao}
                      onChange={(e) => setNovaFuncao(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAdicionarFuncao();
                        }
                      }}
                      placeholder="Nova função..."
                      className="flex-1 px-3 py-2 bg-slate-50/70 border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition"
                    />
                    <button
                      type="button"
                      onClick={handleAdicionarFuncao}
                      className="px-3 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 shadow-2xs"
                    >
                      <Plus className="w-3.5 h-3.5" /> Adicionar
                    </button>
                  </div>

                  {funcoesCustom.length > 0 && (
                    <div className="pt-2">
                      <p className="text-[11px] font-bold text-slate-500 mb-1.5">Funções personalizadas:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {funcoesCustom.map(funcao => (
                          <span
                            key={funcao.valor}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-xs font-medium"
                          >
                            <span>{funcao.label}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoverFuncaoCustom(funcao.valor)}
                              className="text-slate-400 hover:text-rose-600 font-bold transition"
                              title="Remover função"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Data de Admissão & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-100">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                    Data de Admissão *
                  </label>
                  <div className="relative">
                    <Calendar className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="date"
                      name="dataAdmissao"
                      value={formData.dataAdmissao}
                      onChange={handleInputChange}
                      className="w-full pl-10 pr-3 py-2 bg-slate-50/70 border border-slate-300 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                    Status Operacional *
                  </label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 bg-slate-50/70 border border-slate-300 rounded-xl text-slate-800 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition"
                  >
                    <option value="ATIVO">🟢 ATIVO</option>
                    <option value="INATIVO">🔴 INATIVO</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Bloco 3: Endereço & Localização */}
            <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/90 shadow-sm">
              <div className="flex items-center gap-2.5 pb-4 mb-5 border-b border-slate-100">
                <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-100">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Endereço Residencial</h2>
                  <p className="text-xs text-slate-500">Localização de domicílio do colaborador.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                    CEP
                  </label>
                  <input
                    type="text"
                    name="cep"
                    value={formData.cep}
                    onChange={handleInputChange}
                    placeholder="00000-000"
                    className="w-full px-3 py-2 bg-slate-50/70 border border-slate-300 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                    Endereço (Logradouro, Número, Complemento)
                  </label>
                  <input
                    type="text"
                    name="endereco"
                    value={formData.endereco}
                    onChange={handleInputChange}
                    placeholder="Rua, Avenida, Número, Bloco, Apto..."
                    className="w-full px-3 py-2 bg-slate-50/70 border border-slate-300 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                    Bairro
                  </label>
                  <input
                    type="text"
                    name="bairro"
                    value={formData.bairro}
                    onChange={handleInputChange}
                    placeholder="Bairro"
                    className="w-full px-3 py-2 bg-slate-50/70 border border-slate-300 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                    Cidade
                  </label>
                  <input
                    type="text"
                    name="cidade"
                    value={formData.cidade}
                    onChange={handleInputChange}
                    placeholder="Cidade"
                    className="w-full px-3 py-2 bg-slate-50/70 border border-slate-300 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                    UF
                  </label>
                  <select
                    name="uf"
                    value={formData.uf}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 bg-slate-50/70 border border-slate-300 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition"
                  >
                    <option value="">Escolha um Estado</option>
                    {UFDADOS.map(uf => (
                      <option key={uf} value={uf}>{uf}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Bloco 4: Dados Financeiros & Bancários */}
            <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/90 shadow-sm">
              <div className="flex items-center gap-2.5 pb-4 mb-5 border-b border-slate-100">
                <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-100">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Dados Financeiros & Bancários</h2>
                  <p className="text-xs text-slate-500">Informações para pagamento de ajuda de custo, folha ou benefícios.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                    Instituição Bancária
                  </label>
                  <select
                    name="banco"
                    value={formData.banco}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 bg-slate-50/70 border border-slate-300 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition"
                  >
                    {BANCOS.map(b => (
                      <option key={b.valor} value={b.valor}>{b.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                    Agência
                  </label>
                  <input
                    type="text"
                    name="agencia"
                    value={formData.agencia}
                    onChange={handleInputChange}
                    placeholder="0000"
                    className="w-full px-3 py-2 bg-slate-50/70 border border-slate-300 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                    Conta Corrente
                  </label>
                  <input
                    type="text"
                    name="contaCorrente"
                    value={formData.contaCorrente}
                    onChange={handleInputChange}
                    placeholder="00000-0"
                    className="w-full px-3 py-2 bg-slate-50/70 border border-slate-300 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                    Chave PIX
                  </label>
                  <input
                    type="text"
                    name="pix"
                    value={formData.pix}
                    onChange={handleInputChange}
                    placeholder="CPF, e-mail, celular ou aleatória"
                    className="w-full px-3 py-2 bg-slate-50/70 border border-slate-300 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition"
                  />
                </div>
              </div>
            </div>

            {/* Bloco 5: Observações Adicionais */}
            <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/90 shadow-sm">
              <div className="flex items-center gap-2.5 pb-4 mb-5 border-b border-slate-100">
                <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-100">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Observações & Anotações</h2>
                  <p className="text-xs text-slate-500">Histórico contratual, horários de expediente ou particularidades.</p>
                </div>
              </div>

              <div>
                <textarea
                  name="obs"
                  value={formData.obs}
                  onChange={handleInputChange}
                  placeholder="Anotações internas sobre o colaborador..."
                  rows={3}
                  className="w-full px-3 py-2 bg-slate-50/70 border border-slate-300 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition resize-none"
                />
              </div>
            </div>

            {/* Ações do Formulário */}
            <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={handleLimparMembro}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-700 font-bold hover:bg-slate-50 text-xs sm:text-sm transition cursor-pointer"
              >
                Limpar Campos
              </button>
              <button
                type="submit"
                disabled={salvando}
                className="w-full sm:w-auto px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold rounded-xl shadow-xs transition flex items-center justify-center gap-2 cursor-pointer text-xs sm:text-sm disabled:opacity-50"
              >
                {salvando ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Cadastrando...</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    <span>Salvar Colaborador</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* ABA: LISTA */}
        {abaAtiva === 'lista' && (
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
            {/* Toolbar de Filtros */}
            <div className="p-4 sm:p-5 border-b border-slate-200/80 bg-slate-50/50 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
                {/* Filtro por Grupo */}
                <div className="relative flex-1 max-w-xs">
                  <Filter className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <select
                    value={filtroGrupo}
                    onChange={(e) => setFiltroGrupo(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-white border border-slate-300 rounded-xl text-slate-800 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition"
                  >
                    <option value="">Todos os Grupos</option>
                    {gruposFuncao.filter(g => g.valor).map(g => (
                      <option key={g.valor} value={g.valor}>{g.label}</option>
                    ))}
                  </select>
                </div>

                {/* Filtro por Status */}
                <div className="relative w-full sm:w-44">
                  <select
                    value={filtroStatus}
                    onChange={(e) => setFiltroStatus(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-800 text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition"
                  >
                    <option value="">Todos os Status</option>
                    <option value="ATIVO">🟢 ATIVOS</option>
                    <option value="INATIVO">🔴 INATIVOS</option>
                  </select>
                </div>
              </div>

              <div className="text-xs text-slate-500 font-semibold self-end sm:self-center">
                Exibindo <span className="text-slate-900 font-bold">{funcionariosFiltrados.length}</span> colaboradores
              </div>
            </div>

            {/* Tabela de Listagem */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 text-[11px] sm:text-xs uppercase tracking-wider font-bold">
                    <th className="py-3 px-4 sm:px-6">Colaborador</th>
                    <th className="py-3 px-4">Grupo / Departamento</th>
                    <th className="py-3 px-4">Função</th>
                    <th className="py-3 px-4 hidden md:table-cell">Contatos</th>
                    <th className="py-3 px-4 hidden lg:table-cell">Admissão</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {funcionariosFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 px-4 text-center">
                        <div className="max-w-xs mx-auto space-y-2">
                          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                            <Users className="w-6 h-6" />
                          </div>
                          <p className="text-sm font-bold text-slate-700">Nenhum funcionário encontrado</p>
                          <p className="text-xs text-slate-500">
                            Não há colaboradores correspondentes aos filtros selecionados.
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    funcionariosFiltrados.map(func => (
                      <tr key={func.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-3.5 px-4 sm:px-6">
                          <div className="font-bold text-slate-900">
                            {func.member_name || func.nome || 'Nome não registrado'}
                          </div>
                          <div className="text-xs text-slate-500">
                            CPF: {func.member_cpf || func.cpf || 'Não informado'}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-100 capitalize">
                            {func.grupo}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-slate-700 capitalize">
                          {func.funcao}
                        </td>
                        <td className="py-3.5 px-4 hidden md:table-cell">
                          <div className="text-xs text-slate-700 font-medium">
                            {func.whatsapp || func.telefone || '-'}
                          </div>
                          <div className="text-xs text-slate-400 truncate max-w-xs">
                            {func.email || '-'}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 hidden lg:table-cell text-xs text-slate-600 font-medium">
                          {func.data_admissao ? new Date(func.data_admissao).toLocaleDateString() : '-'}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                            func.status === 'ATIVO'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              func.status === 'ATIVO' ? 'bg-emerald-500' : 'bg-rose-500'
                            }`} />
                            {func.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => handleDeletar(func.id)}
                            disabled={deletandoId === func.id}
                            className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer disabled:opacity-50"
                            title="Remover colaborador"
                          >
                            {deletandoId === func.id ? (
                              <div className="w-4 h-4 border-2 border-rose-600 border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
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
