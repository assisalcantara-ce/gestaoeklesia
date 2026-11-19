'use client';

import React from 'react';
import {
  User,
  UserPlus,
  Edit3,
  X,
  MapPin,
  Church,
  Image as ImageIcon,
  Search,
  Loader2,
  Check,
  MessageCircle,
  Users,
  FileText,
  RotateCcw,
  Building2,
  GraduationCap,
  Sparkles,
  ScrollText,
  ExternalLink,
  ShieldCheck,
  Heart,
  Baby,
} from 'lucide-react';
import { createClient } from '@/lib/supabase-client';
import EditorFotoMinisterial from './EditorFotoMinisterial';
import { formatCpf, formatCep, formatPhone, validarCpf } from '@/lib/mascaras';

export interface MembroFormModalProps {
  showForm: boolean;
  setShowForm: (show: boolean) => void;
  membroEditando: any;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  dadosPessoais: any;
  setDadosPessoais: React.Dispatch<React.SetStateAction<any>>;
  enderecoData: any;
  setEnderecoData: React.Dispatch<React.SetStateAction<any>>;
  dadosMinisteriais: any;
  setDadosMinisteriais: React.Dispatch<React.SetStateAction<any>>;
  cargoSelecionado: string;
  setCargoSelecionado: (cargo: string) => void;
  dadosCargos: any;
  setDadosCargos: React.Dispatch<React.SetStateAction<any>>;
  nomenclaturas: { divisao1: string; divisao2: string; divisao3: string };
  supervisoesOptions: Array<{ id: string; nome: string }>;
  camposOptions: Array<{ id: string; nome: string }>;
  congregacoesOptions: Array<{ id: string; nome: string }>;
  cargosMinisteriais: Array<any>;
  buscarCep: () => Promise<void>;
  loadingCep: boolean;
  fotoMembro: string | null;
  setFotoMembro: (foto: string | null) => void;
  fileInputRef: any;
  handleFotoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleGirarFoto: () => void;
  salvarMembro: () => Promise<void>;
  salvandoMembro?: boolean;
  fecharFormulario: () => void;
  dizimosHistorico: any[];
  loadingDizimosHistorico: boolean;
  isDizimista: boolean;
  setIsDizimista: (val: boolean) => void;
  isAdmin?: boolean;
  onAbrirMembro?: (id: string) => void;
  recarregarMembros?: () => Promise<void>;
}

export default function MembroFormModal({
  showForm,
  setShowForm: _setShowForm,
  membroEditando,
  activeTab,
  setActiveTab,
  dadosPessoais,
  setDadosPessoais,
  enderecoData,
  setEnderecoData,
  dadosMinisteriais,
  setDadosMinisteriais,
  cargoSelecionado,
  setCargoSelecionado,
  dadosCargos,
  setDadosCargos,
  nomenclaturas,
  supervisoesOptions,
  camposOptions,
  congregacoesOptions,
  cargosMinisteriais,
  buscarCep,
  loadingCep,
  fotoMembro,
  setFotoMembro,
  fileInputRef,
  handleFotoUpload: _handleFotoUpload,
  handleGirarFoto: _handleGirarFoto,
  salvarMembro,
  salvandoMembro = false,
  fecharFormulario,
  dizimosHistorico: _dizimosHistorico,
  loadingDizimosHistorico: _loadingDizimosHistorico,
  isDizimista: _isDizimista,
  setIsDizimista: _setIsDizimista,
  isAdmin = false,
  onAbrirMembro,
  recarregarMembros,
}: MembroFormModalProps) {
  const [editandoMatricula, setEditandoMatricula] = React.useState(false);
  const [buscandoConjuge, setBuscandoConjuge] = React.useState(false);
  const [conjugeMsg, setConjugeMsg] = React.useState<{ tipo: 'sucesso' | 'info' | 'erro'; texto: string } | null>(null);
  const ultimoCpfBuscadoRef = React.useRef<string>('');

  // Estados do Modal Híbrido de Filhos
  const [showModalFilho, setShowModalFilho] = React.useState(false);
  const [tipoAcaoFilho, setTipoAcaoFilho] = React.useState<'vincular' | 'cadastrar'>('vincular');
  const [buscaFilhoTerm, setBuscaFilhoTerm] = React.useState('');
  const [resultadosBuscaFilho, setResultadosBuscaFilho] = React.useState<any[]>([]);
  const [buscandoFilhos, setBuscandoFilhos] = React.useState(false);
  const [novoFilhoNome, setNovoFilhoNome] = React.useState('');
  const [novoFilhoNascimento, setNovoFilhoNascimento] = React.useState('');
  const [novoFilhoSexo, setNovoFilhoSexo] = React.useState('MASCULINO');
  const [novoFilhoCpf, setNovoFilhoCpf] = React.useState('');
  const [novoFilhoTelefone, setNovoFilhoTelefone] = React.useState('');
  const [novoFilhoEmail, setNovoFilhoEmail] = React.useState('');
  const [novoFilhoCongregacaoId, setNovoFilhoCongregacaoId] = React.useState('');
  const [salvandoFilho, setSalvandoFilho] = React.useState(false);
  const [filhoErro, setFilhoErro] = React.useState<string | null>(null);

  // Reseta estado de edição da matrícula ao abrir ou trocar de membro
  React.useEffect(() => {
    setEditandoMatricula(false);
    setConjugeMsg(null);
    ultimoCpfBuscadoRef.current = '';
  }, [showForm, membroEditando?.id]);

  const normalizeDateForInput = (val: any): string => {
    if (!val) return '';
    const s = String(val).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
      return s.slice(0, 10);
    }
    if (/^\d{2}\/\d{2}\/\d{4}/.test(s)) {
      const parts = s.split('/');
      if (parts.length === 3) {
        const [d, m, y] = parts;
        return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      }
    }
    return s;
  };

  const buscarConjugePorCpf = React.useCallback(async (cpfInput: string) => {
    const cleanCpf = (cpfInput || '').replace(/\D/g, '');
    if (cleanCpf.length !== 11) {
      setConjugeMsg(null);
      return;
    }

    setBuscandoConjuge(true);
    setConjugeMsg(null);

    try {
      const supabase = createClient();
      const formattedCpf = `${cleanCpf.slice(0, 3)}.${cleanCpf.slice(3, 6)}.${cleanCpf.slice(6, 9)}-${cleanCpf.slice(9)}`;

      const { data, error } = await supabase
        .from('members')
        .select('id, name, data_nascimento, custom_fields')
        .or(`cpf.eq.${cleanCpf},cpf.eq.${formattedCpf}`)
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Erro ao buscar cônjuge por CPF:', error);
        setConjugeMsg(null);
        return;
      }

      if (data) {
        const cf = (data.custom_fields || {}) as Record<string, any>;
        const nomeEncontrado = data.name || cf.nome || cf.name || '';
        const rawDate = data.data_nascimento || cf.dataNascimento || cf.data_nascimento || '';
        const dataNascEncontrada = normalizeDateForInput(rawDate);

        setDadosPessoais((prev: any) => ({
          ...prev,
          nomeConjuge: nomeEncontrado || prev.nomeConjuge,
          dataNascimentoConjuge: dataNascEncontrada || prev.dataNascimentoConjuge,
        }));

        setConjugeMsg({
          tipo: 'sucesso',
          texto: `✓ Cônjuge localizado na base: ${nomeEncontrado}`,
        });
      } else {
        setConjugeMsg({
          tipo: 'info',
          texto: 'ℹ CPF não localizado na base de membros (você pode preencher manualmente)',
        });
      }
    } catch (err) {
      console.error('Erro na busca de cônjuge por CPF:', err);
    } finally {
      setBuscandoConjuge(false);
    }
  }, [setDadosPessoais]);

  const handleCpfConjugeChange = (val: string) => {
    const formatted = formatCpf(val);
    setDadosPessoais((prev: any) => ({ ...prev, cpfConjuge: formatted }));
    const clean = formatted.replace(/\D/g, '');
    if (clean.length !== 11) {
      setConjugeMsg(null);
      ultimoCpfBuscadoRef.current = '';
    }
  };

  const handleLimparConjuge = () => {
    setDadosPessoais((prev: any) => ({
      ...prev,
      cpfConjuge: '',
      nomeConjuge: '',
      dataNascimentoConjuge: '',
    }));
    setConjugeMsg(null);
    ultimoCpfBuscadoRef.current = '';
  };

  React.useEffect(() => {
    const clean = (dadosPessoais.cpfConjuge || '').replace(/\D/g, '');
    if (clean.length === 11 && clean !== ultimoCpfBuscadoRef.current) {
      const timer = setTimeout(() => {
        ultimoCpfBuscadoRef.current = clean;
        buscarConjugePorCpf(clean);
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [dadosPessoais.cpfConjuge, buscarConjugePorCpf]);

  // Busca pessoas no banco para vincular como filho
  const buscarPessoasParaFilho = React.useCallback(async (termo: string) => {
    const t = termo.trim();
    if (t.length < 2) {
      setResultadosBuscaFilho([]);
      return;
    }

    setBuscandoFilhos(true);
    setFilhoErro(null);
    try {
      const supabase = createClient();
      let query = supabase
        .from('members')
        .select('id, name, matricula, data_nascimento, role, tipo_cadastro, congregacao_id')
        .limit(10);

      if (membroEditando?.id) {
        query = query.neq('id', membroEditando.id);
      }

      const isNumeric = /^\d+$/.test(t);
      if (isNumeric) {
        query = query.or(`matricula.ilike.%${t}%,name.ilike.%${t}%`);
      } else {
        query = query.ilike('name', `%${t}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      setResultadosBuscaFilho(data || []);
    } catch (err: any) {
      console.error('Erro ao pesquisar pessoas para vínculo familiar:', err);
      setFilhoErro('Não foi possível buscar registros.');
    } finally {
      setBuscandoFilhos(false);
    }
  }, [membroEditando?.id]);

  // Vincular pessoa existente
  const handleVincularFilhoExistente = async (pessoa: any) => {
    const filhosAtuais = (dadosPessoais.filhos || []) as any[];
    const jaExiste = filhosAtuais.some(
      (f) => f.memberId === pessoa.id || (f.nome && f.nome.toUpperCase() === pessoa.name?.toUpperCase())
    );

    if (jaExiste) {
      setFilhoErro('Esta pessoa já está vinculada como filho(a).');
      return;
    }

    const novoVinculo = {
      memberId: pessoa.id,
      nome: pessoa.name,
      matricula: pessoa.matricula || '',
      dataNascimento: normalizeDateForInput(pessoa.data_nascimento),
      tipo: 'filho',
    };

    setDadosPessoais((prev: any) => ({
      ...prev,
      filhos: [...(prev.filhos || []), novoVinculo],
    }));

    // Se estamos editando um membro existente, persistir o relacionamento imediatamente na API de família
    if (membroEditando?.id) {
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (token) {
          await fetch(`/api/v1/members/${membroEditando.id}/familia`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              childId: pessoa.id,
              nome: pessoa.name,
              dataNascimento: pessoa.data_nascimento,
              tipo: 'filho',
            }),
          });
        }
      } catch (linkErr) {
        console.warn('Vínculo imediato na API de família falhou (será salvo com o formulário):', linkErr);
      }
    }

    setShowModalFilho(false);
    setBuscaFilhoTerm('');
    setResultadosBuscaFilho([]);
    setFilhoErro(null);
  };

  // Cadastrar novo filho de forma ampliada usando a API oficial de membros
  const handleCadastrarNovoFilho = async () => {
    if (!novoFilhoNome.trim()) {
      setFilhoErro('O nome completo do filho(a) é obrigatório.');
      return;
    }

    if (!novoFilhoNascimento) {
      setFilhoErro('A data de nascimento é obrigatória.');
      return;
    }

    if (!novoFilhoSexo) {
      setFilhoErro('O sexo é obrigatório.');
      return;
    }

    const cleanCpf = novoFilhoCpf.replace(/\D/g, '');
    if (cleanCpf && cleanCpf.length > 0) {
      if (cleanCpf.length !== 11 || !validarCpf(cleanCpf)) {
        setFilhoErro('O CPF informado para o filho(a) é inválido.');
        return;
      }
    }

    const cleanEmail = novoFilhoEmail.trim().toLowerCase();
    if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setFilhoErro('O e-mail informado para o filho(a) é inválido.');
      return;
    }

    setSalvandoFilho(true);
    setFilhoErro(null);

    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Não autenticado');

      // Verificação preventiva de duplicidade de CPF se informado
      if (cleanCpf) {
        const { data: existingCpf } = await supabase
          .from('members')
          .select('id, name')
          .eq('cpf', cleanCpf)
          .maybeSingle();

        if (existingCpf) {
          throw new Error(`Já existe um cadastro com este CPF (${existingCpf.name}). Utilize a opção "Vincular Existente".`);
        }
      }

      // Resolver congregação: selecionada no modal ou herdada do responsável
      const congregacaoFinalId =
        novoFilhoCongregacaoId ||
        (congregacoesOptions || []).find((c) => c.nome === dadosPessoais.supervisao || c.nome === dadosPessoais.congregacao)?.id ||
        membroEditando?.congregacao_id ||
        null;

      const cleanPhone = novoFilhoTelefone.replace(/\D/g, '');

      // Chamada à API oficial POST /api/v1/members
      const res = await fetch('/api/v1/members', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: novoFilhoNome.trim().toUpperCase(),
          data_nascimento: novoFilhoNascimento,
          sexo: novoFilhoSexo || 'MASCULINO',
          cpf: cleanCpf || null,
          celular: cleanPhone || null,
          whatsapp: cleanPhone || null,
          phone: cleanPhone || null,
          email: cleanEmail || null,
          congregacao_id: congregacaoFinalId,
          role: 'crianca',
          tipo_cadastro: 'crianca',
          status: 'active',
          nome_pai: dadosPessoais.sexo === 'MASCULINO' ? (dadosPessoais.nome || membroEditando?.nome) : dadosPessoais.nomePai || null,
          nome_mae: dadosPessoais.sexo === 'FEMININO' ? (dadosPessoais.nome || membroEditando?.nome) : dadosPessoais.nomeMae || null,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Erro ao cadastrar novo filho pela API.');
      }

      const { data: novoMembro } = await res.json();

      const novoVinculo = {
        memberId: novoMembro.id,
        nome: novoMembro.name,
        matricula: novoMembro.matricula || '',
        dataNascimento: normalizeDateForInput(novoMembro.data_nascimento),
        tipo: 'filho',
      };

      setDadosPessoais((prev: any) => ({
        ...prev,
        filhos: [...(prev.filhos || []), novoVinculo],
      }));

      // Se estamos editando um membro existente, persistir o relacionamento imediatamente na API de família
      if (membroEditando?.id) {
        const linkRes = await fetch(`/api/v1/members/${membroEditando.id}/familia`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            childId: novoMembro.id,
            nome: novoMembro.name,
            dataNascimento: novoMembro.data_nascimento,
            tipo: 'filho',
          }),
        });

        if (!linkRes.ok) {
          // Se falhar o vínculo em membro já existente, remover o cadastro criado para não deixar registro órfão
          console.warn('Falha ao vincular o novo filho na API de família. Revertendo cadastro...');
          await fetch(`/api/v1/members/${novoMembro.id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
          }).catch(() => {});
          throw new Error('Falha ao vincular o novo filho ao responsável. Operação cancelada.');
        }
      }

      // Atualizar lista geral de membros em segundo plano
      if (recarregarMembros) {
        void recarregarMembros();
      }

      setShowModalFilho(false);
      setNovoFilhoNome('');
      setNovoFilhoNascimento('');
      setNovoFilhoSexo('MASCULINO');
      setNovoFilhoCpf('');
      setNovoFilhoTelefone('');
      setNovoFilhoEmail('');
      setNovoFilhoCongregacaoId('');
      setFilhoErro(null);
    } catch (err: any) {
      console.error('Erro ao cadastrar novo filho:', err);
      setFilhoErro(err.message || 'Erro ao cadastrar novo filho.');
    } finally {
      setSalvandoFilho(false);
    }
  };

  if (!showForm) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-2 sm:p-4 md:p-6 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-4xl lg:max-w-5xl w-full h-[90vh] max-h-[90vh] flex flex-col overflow-hidden">
        {/* ─── HEADER ─── */}
        <div className="px-6 py-4.5 bg-white border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-teal-50 text-teal-700 border border-teal-200/80 flex items-center justify-center shrink-0 shadow-xs">
              {membroEditando ? <Edit3 className="w-5 h-5 text-teal-700" /> : <UserPlus className="w-5 h-5 text-teal-700" />}
            </div>
            <div className="min-w-0">
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight truncate">
                {membroEditando ? 'Editar Membro' : 'Novo Membro'}
              </h2>
              <p className="text-xs sm:text-sm font-medium text-slate-500 truncate">
                {membroEditando ? (
                  <span className="text-teal-700 font-semibold">{membroEditando.nome || dadosPessoais.nome}</span>
                ) : (
                  'Cadastre uma nova pessoa na sua igreja'
                )}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={fecharFormulario}
            disabled={salvandoMembro}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            aria-label="Fechar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ─── TABS DE NAVEGAÇÃO ─── */}
        <div className="flex border-b border-slate-200/90 bg-white px-6 gap-1 sm:gap-2 overflow-x-auto shrink-0 modal-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab('dados')}
            className={`group relative py-3.5 px-3 font-semibold text-xs sm:text-sm flex items-center gap-2.5 whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'dados'
                ? 'text-emerald-900 font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <div
              className={`p-1.5 rounded-lg transition-colors ${
                activeTab === 'dados'
                  ? 'bg-emerald-100/70 text-emerald-800'
                  : 'bg-slate-100 text-slate-400 group-hover:text-slate-700 group-hover:bg-slate-200/70'
              }`}
            >
              <User className="w-4 h-4" />
            </div>
            <span>Dados</span>
            {activeTab === 'dados' && (
              <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-emerald-600 rounded-t-full shadow-xs" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('endereco')}
            className={`group relative py-3.5 px-3 font-semibold text-xs sm:text-sm flex items-center gap-2.5 whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'endereco'
                ? 'text-emerald-900 font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <div
              className={`p-1.5 rounded-lg transition-colors ${
                activeTab === 'endereco'
                  ? 'bg-emerald-100/70 text-emerald-800'
                  : 'bg-slate-100 text-slate-400 group-hover:text-slate-700 group-hover:bg-slate-200/70'
              }`}
            >
              <MapPin className="w-4 h-4" />
            </div>
            <span>Endereço e Contato</span>
            {activeTab === 'endereco' && (
              <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-emerald-600 rounded-t-full shadow-xs" />
            )}
          </button>

          {dadosPessoais.tipoCadastro === 'ministro' && (
            <button
              type="button"
              onClick={() => setActiveTab('ministerial')}
              className={`group relative py-3.5 px-3 font-semibold text-xs sm:text-sm flex items-center gap-2.5 whitespace-nowrap transition-colors cursor-pointer ${
                activeTab === 'ministerial'
                  ? 'text-emerald-900 font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <div
                className={`p-1.5 rounded-lg transition-colors ${
                  activeTab === 'ministerial'
                    ? 'bg-emerald-100/70 text-emerald-800'
                    : 'bg-slate-100 text-slate-400 group-hover:text-slate-700 group-hover:bg-slate-200/70'
                }`}
              >
                <Church className="w-4 h-4" />
              </div>
              <span>Ministerial</span>
              {activeTab === 'ministerial' && (
                <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-emerald-600 rounded-t-full shadow-xs" />
              )}
            </button>
          )}

          <button
            type="button"
            onClick={() => setActiveTab('foto')}
            className={`group relative py-3.5 px-3 font-semibold text-xs sm:text-sm flex items-center gap-2.5 whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'foto'
                ? 'text-emerald-900 font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <div
              className={`p-1.5 rounded-lg transition-colors ${
                activeTab === 'foto'
                  ? 'bg-emerald-100/70 text-emerald-800'
                  : 'bg-slate-100 text-slate-400 group-hover:text-slate-700 group-hover:bg-slate-200/70'
              }`}
            >
              <ImageIcon className="w-4 h-4" />
            </div>
            <span>Foto</span>
            {activeTab === 'foto' && (
              <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-emerald-600 rounded-t-full shadow-xs" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('familia')}
            className={`group relative py-3.5 px-3 font-semibold text-xs sm:text-sm flex items-center gap-2.5 whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'familia'
                ? 'text-emerald-900 font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <div
              className={`p-1.5 rounded-lg transition-colors ${
                activeTab === 'familia'
                  ? 'bg-emerald-100/70 text-emerald-800'
                  : 'bg-slate-100 text-slate-400 group-hover:text-slate-700 group-hover:bg-slate-200/70'
              }`}
            >
              <Users className="w-4 h-4" />
            </div>
            <span>Família</span>
            {activeTab === 'familia' && (
              <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-emerald-600 rounded-t-full shadow-xs" />
            )}
          </button>
        </div>

        {/* ─── CONTEÚDO DAS ABAS ─── */}
        <div className="flex-1 overflow-y-auto modal-scrollbar p-5 sm:p-7 min-h-0 bg-white">
          {/* ═══════════ ABA: DADOS CADASTRAIS ═══════════ */}
          {activeTab === 'dados' && (
            <div className="space-y-6">
              {/* Seção 1: Identificação Básica */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100 text-slate-800">
                  <User className="w-4 h-4 text-teal-600" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Identificação e Cadastro</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Matrícula */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Matrícula {editandoMatricula && <span className="text-teal-600 font-bold ml-1">(Edição)</span>}
                    </label>
                    <div className="flex gap-2 items-center">
                      <input
                        type="text"
                        placeholder="Automática"
                        value={dadosPessoais.matricula || ''}
                        disabled={!editandoMatricula}
                        onChange={(e) => setDadosPessoais((prev: any) => ({ ...prev, matricula: e.target.value }))}
                        className={`w-full px-3.5 py-2.5 border rounded-xl text-sm font-medium transition ${
                          editandoMatricula
                            ? 'border-teal-500 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600/20'
                            : 'border-slate-200 bg-slate-100 text-slate-600 cursor-not-allowed'
                        }`}
                      />
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => setEditandoMatricula((prev) => !prev)}
                          title={editandoMatricula ? 'Concluir edição de matrícula' : 'Editar matrícula (Admin)'}
                          className={`px-3 py-2.5 text-xs font-bold rounded-xl border transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
                            editandoMatricula
                              ? 'bg-teal-700 text-white border-teal-800 shadow-xs hover:bg-teal-800'
                              : 'bg-white text-teal-700 border-slate-300 hover:bg-teal-50 hover:border-teal-300'
                          }`}
                        >
                          {editandoMatricula ? <Check className="w-3.5 h-3.5" /> : <Edit3 className="w-3.5 h-3.5" />}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* CPF */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      CPF <span className="text-red-500">*</span>
                      {membroEditando && <span className="ml-1.5 text-[11px] text-slate-400 font-normal">(Bloqueado)</span>}
                    </label>
                    <input
                      type="text"
                      placeholder="000.000.000-00"
                      value={formatCpf(dadosPessoais.cpf || '')}
                      onChange={(e) => setDadosPessoais((prev: any) => ({ ...prev, cpf: formatCpf(e.target.value) }))}
                      maxLength={14}
                      className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition"
                    />
                  </div>

                  {/* Tipo de Cadastro */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Tipo de Cadastro <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={dadosPessoais.tipoCadastro || 'membro'}
                      onChange={(e) => {
                        const v = e.target.value;
                        setDadosPessoais((prev: any) => ({ ...prev, tipoCadastro: v }));
                        if (v !== 'ministro') {
                          setActiveTab((activeTab as string) === 'ministerial' ? 'dados' : activeTab);
                        }
                      }}
                      className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition cursor-pointer"
                    >
                      <option value="ministro">Ministro</option>
                      <option value="membro">Membro</option>
                      <option value="congregado">Congregado</option>
                    </select>
                  </div>
                </div>

                {/* Nome */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Nome Completo <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Nome da Pessoa"
                    value={dadosPessoais.nome || ''}
                    onChange={(e) => setDadosPessoais((prev: any) => ({ ...prev, nome: e.target.value }))}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition"
                  />
                </div>

                {/* Data Nascimento, Sexo e Tipo Sanguíneo */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Data de Nascimento <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={dadosPessoais.dataNascimento || ''}
                      onChange={(e) => setDadosPessoais((prev: any) => ({ ...prev, dataNascimento: e.target.value }))}
                      className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Sexo</label>
                    <select
                      value={dadosPessoais.sexo || 'MASCULINO'}
                      onChange={(e) => setDadosPessoais((prev: any) => ({ ...prev, sexo: e.target.value }))}
                      className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition cursor-pointer"
                    >
                      <option>MASCULINO</option>
                      <option>FEMININO</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Tipo Sanguíneo</label>
                    <select
                      value={dadosPessoais.tipoSanguineo || ''}
                      onChange={(e) => setDadosPessoais((prev: any) => ({ ...prev, tipoSanguineo: e.target.value }))}
                      className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition cursor-pointer"
                    >
                      <option value="">- Escolha -</option>
                      <option value="O+">O+</option>
                      <option value="O-">O-</option>
                      <option value="A+">A+</option>
                      <option value="A-">A-</option>
                      <option value="B+">B+</option>
                      <option value="B-">B-</option>
                      <option value="AB+">AB+</option>
                      <option value="AB-">AB-</option>
                    </select>
                  </div>
                </div>

                {/* Escolaridade e Estado Civil */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Escolaridade</label>
                    <select
                      value={dadosPessoais.escolaridade || ''}
                      onChange={(e) => setDadosPessoais((prev: any) => ({ ...prev, escolaridade: e.target.value }))}
                      className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition cursor-pointer"
                    >
                      <option value="">- Escolha -</option>
                      <option value="sem_instrucao">Sem Instrução</option>
                      <option value="fundamental">Ensino Fundamental</option>
                      <option value="medio">Ensino Médio</option>
                      <option value="superior">Ensino Superior</option>
                      <option value="posgraduacao">Pós-Graduação</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Estado Civil</label>
                    <select
                      value={dadosPessoais.estadoCivil || ''}
                      onChange={(e) => setDadosPessoais((prev: any) => ({ ...prev, estadoCivil: e.target.value }))}
                      className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition cursor-pointer"
                    >
                      <option value="">- Escolha -</option>
                      <option value="solteiro">{dadosPessoais.sexo === 'FEMININO' ? 'Solteira' : 'Solteiro'}</option>
                      <option value="casado">{dadosPessoais.sexo === 'FEMININO' ? 'Casada' : 'Casado'}</option>
                      <option value="divorciado">{dadosPessoais.sexo === 'FEMININO' ? 'Divorciada' : 'Divorciado'}</option>
                      <option value="viuvo">{dadosPessoais.sexo === 'FEMININO' ? 'Viúva' : 'Viúvo'}</option>
                      <option value="uniao_estavel">União Estável</option>
                      <option value="outros">Outros</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Seção 2: Dados do Cônjuge (Aparece se casado) */}
              {dadosPessoais.estadoCivil === 'casado' && (
                <div className="bg-[#f8fafc] border border-slate-200/90 rounded-2xl p-4.5 space-y-3.5 transition-all">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-teal-50 text-teal-700 border border-teal-200 flex items-center justify-center">
                        <Users className="w-3.5 h-3.5 text-teal-700" />
                      </div>
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Dados do Cônjuge</h4>
                    </div>
                    {buscandoConjuge && (
                      <span className="text-xs text-teal-700 flex items-center gap-1.5 font-medium">
                        <Loader2 className="animate-spin h-3.5 w-3.5 text-teal-600" />
                        Buscando cônjuge na base...
                      </span>
                    )}
                  </div>

                  <div className="flex flex-col md:flex-row items-end gap-3">
                    {/* 1. CPF do Cônjuge (~24%) */}
                    <div className="w-full md:w-[24%] shrink-0">
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">CPF do Cônjuge</label>
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="000.000.000-00"
                          value={formatCpf(dadosPessoais.cpfConjuge || '')}
                          onChange={(e) => handleCpfConjugeChange(e.target.value)}
                          maxLength={14}
                          className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition pr-9"
                        />
                        {buscandoConjuge ? (
                          <span className="absolute right-3 top-3 text-slate-400">
                            <Loader2 className="animate-spin h-4 w-4 text-teal-600" />
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => buscarConjugePorCpf(dadosPessoais.cpfConjuge || '')}
                            title="Buscar na base de membros"
                            className="absolute right-2.5 top-2.5 p-1 text-slate-400 hover:text-teal-700 transition cursor-pointer"
                          >
                            <Search className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* 2. Nome do Cônjuge (~40-45%, flex-1) */}
                    <div className="w-full md:flex-1 min-w-0">
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">Nome do Cônjuge</label>
                      <input
                        type="text"
                        placeholder="Nome completo do cônjuge"
                        value={dadosPessoais.nomeConjuge || ''}
                        onChange={(e) => setDadosPessoais((prev: any) => ({ ...prev, nomeConjuge: e.target.value }))}
                        className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition"
                      />
                    </div>

                    {/* 3. Data de Nascimento do Cônjuge (~25%) */}
                    <div className="w-full md:w-[24%] shrink-0">
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">Data de Nascimento</label>
                      <input
                        type="date"
                        value={dadosPessoais.dataNascimentoConjuge || ''}
                        onChange={(e) => setDadosPessoais((prev: any) => ({ ...prev, dataNascimentoConjuge: e.target.value }))}
                        className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition"
                      />
                    </div>

                    {/* 4. Botão Limpar */}
                    <div className="w-full md:w-auto shrink-0">
                      <button
                        type="button"
                        onClick={handleLimparConjuge}
                        disabled={
                          !dadosPessoais.cpfConjuge &&
                          !dadosPessoais.nomeConjuge &&
                          !dadosPessoais.dataNascimentoConjuge &&
                          !conjugeMsg
                        }
                        title="Limpar dados do cônjuge"
                        className="w-full md:w-auto h-[42px] px-3.5 py-2.5 border border-slate-300 bg-white hover:bg-slate-50 hover:text-red-600 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:text-slate-600 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Limpar</span>
                      </button>
                    </div>
                  </div>

                  {conjugeMsg && (
                    <div
                      className={`text-xs font-medium px-3.5 py-2 rounded-xl border transition-all ${
                        conjugeMsg.tipo === 'sucesso'
                          ? 'text-emerald-800 bg-emerald-50 border-emerald-200'
                          : 'text-amber-800 bg-amber-50 border-amber-200'
                      }`}
                    >
                      {conjugeMsg.texto}
                    </div>
                  )}
                </div>
              )}

              {/* Seção 3: Filiação */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100 text-slate-800">
                  <Users className="w-4 h-4 text-teal-600" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Filiação</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Nome do Pai</label>
                    <input
                      type="text"
                      placeholder="Nome completo do pai"
                      value={dadosPessoais.nomePai || ''}
                      onChange={(e) => setDadosPessoais((prev: any) => ({ ...prev, nomePai: e.target.value }))}
                      className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Nome da Mãe</label>
                    <input
                      type="text"
                      placeholder="Nome completo da mãe"
                      value={dadosPessoais.nomeMae || ''}
                      onChange={(e) => setDadosPessoais((prev: any) => ({ ...prev, nomeMae: e.target.value }))}
                      className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition"
                    />
                  </div>
                </div>
              </div>

              {/* Seção 4: Documentação e Origem */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100 text-slate-800">
                  <FileText className="w-4 h-4 text-teal-600" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Documentação e Origem</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">RG</label>
                    <input
                      type="text"
                      placeholder="Número do RG"
                      value={dadosPessoais.rg || ''}
                      onChange={(e) => setDadosPessoais((prev: any) => ({ ...prev, rg: e.target.value }))}
                      className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Órgão Emissor</label>
                    <input
                      type="text"
                      placeholder="Ex: SSP, PC, DETRAN"
                      value={dadosPessoais.orgaoEmissor || ''}
                      onChange={(e) => setDadosPessoais((prev: any) => ({ ...prev, orgaoEmissor: e.target.value }))}
                      className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Nacionalidade</label>
                    <select
                      value={dadosPessoais.nacionalidade || 'BRASILEIRA'}
                      onChange={(e) => setDadosPessoais((prev: any) => ({ ...prev, nacionalidade: e.target.value }))}
                      className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition cursor-pointer"
                    >
                      <option>BRASILEIRA</option>
                      <option>ESTRANGEIRA</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Naturalidade</label>
                    <input
                      type="text"
                      placeholder="Cidade natal"
                      value={dadosPessoais.naturalidade || ''}
                      onChange={(e) => setDadosPessoais((prev: any) => ({ ...prev, naturalidade: e.target.value }))}
                      className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">UF Naturalidade</label>
                    <select
                      value={dadosPessoais.uf || ''}
                      onChange={(e) => setDadosPessoais((prev: any) => ({ ...prev, uf: e.target.value }))}
                      className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition cursor-pointer"
                    >
                      <option value="">Selecionar UF</option>
                      <option value="AC">Acre</option>
                      <option value="AL">Alagoas</option>
                      <option value="AP">Amapá</option>
                      <option value="AM">Amazonas</option>
                      <option value="BA">Bahia</option>
                      <option value="CE">Ceará</option>
                      <option value="DF">Distrito Federal</option>
                      <option value="ES">Espírito Santo</option>
                      <option value="GO">Goiás</option>
                      <option value="MA">Maranhão</option>
                      <option value="MT">Mato Grosso</option>
                      <option value="MS">Mato Grosso do Sul</option>
                      <option value="MG">Minas Gerais</option>
                      <option value="PA">Pará</option>
                      <option value="PB">Paraíba</option>
                      <option value="PR">Paraná</option>
                      <option value="PE">Pernambuco</option>
                      <option value="PI">Piauí</option>
                      <option value="RJ">Rio de Janeiro</option>
                      <option value="RN">Rio Grande do Norte</option>
                      <option value="RS">Rio Grande do Sul</option>
                      <option value="RO">Rondônia</option>
                      <option value="RR">Roraima</option>
                      <option value="SC">Santa Catarina</option>
                      <option value="SP">São Paulo</option>
                      <option value="SE">Sergipe</option>
                      <option value="TO">Tocantins</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Seção 5: Dados Eclesiásticos Básicos (Batismo) */}
              <div className={`space-y-4 ${dadosPessoais.tipoCadastro === 'congregado' ? 'opacity-60' : ''}`}>
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100 text-slate-800">
                  <Church className="w-4 h-4 text-teal-600" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Dados Eclesiásticos</h3>
                </div>

                {dadosPessoais.tipoCadastro === 'congregado' && (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg">
                    ℹ Campos de batismo não são aplicáveis para cadastro de Congregado.
                  </p>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Data de Batismo nas Águas</label>
                    <input
                      type="date"
                      value={dadosMinisteriais.dataBatismoAguas || ''}
                      onChange={(e) => setDadosMinisteriais((prev: any) => ({ ...prev, dataBatismoAguas: e.target.value }))}
                      disabled={dadosPessoais.tipoCadastro === 'congregado'}
                      className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Data de Batismo no Espírito Santo</label>
                    <input
                      type="date"
                      value={dadosMinisteriais.dataBatismoEspiritoSanto || ''}
                      onChange={(e) => setDadosMinisteriais((prev: any) => ({ ...prev, dataBatismoEspiritoSanto: e.target.value }))}
                      disabled={dadosPessoais.tipoCadastro === 'congregado'}
                      className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>
              </div>

              {/* Seção 6: Profissão e Dados Eleitorais */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100 text-slate-800">
                  <Sparkles className="w-4 h-4 text-teal-600" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Profissão e Dados Eleitorais</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="md:col-span-1">
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Profissão</label>
                    <input
                      type="text"
                      placeholder="Ex: Professor, Autônomo"
                      value={dadosPessoais.profissao || ''}
                      onChange={(e) => setDadosPessoais((prev: any) => ({ ...prev, profissao: e.target.value }))}
                      className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition"
                    />
                  </div>
                  <div className="md:col-span-1">
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Título Eleitoral</label>
                    <input
                      type="text"
                      placeholder="Número do título"
                      value={dadosPessoais.tituloEleitoral || ''}
                      onChange={(e) => setDadosPessoais((prev: any) => ({ ...prev, tituloEleitoral: e.target.value }))}
                      className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Zona</label>
                    <input
                      type="text"
                      placeholder="Zona"
                      value={dadosPessoais.zonaEleitoral || ''}
                      onChange={(e) => setDadosPessoais((prev: any) => ({ ...prev, zonaEleitoral: e.target.value }))}
                      className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Seção</label>
                    <input
                      type="text"
                      placeholder="Seção"
                      value={dadosPessoais.secaoEleitoral || ''}
                      onChange={(e) => setDadosPessoais((prev: any) => ({ ...prev, secaoEleitoral: e.target.value }))}
                      className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition"
                    />
                  </div>
                </div>
              </div>

              {/* Seção 7: Organização Eclesiástica */}
              {((nomenclaturas?.divisao1 && nomenclaturas.divisao1 !== 'NENHUMA') ||
                (nomenclaturas?.divisao2 && nomenclaturas.divisao2 !== 'NENHUMA') ||
                (nomenclaturas?.divisao3 && nomenclaturas.divisao3 !== 'NENHUMA')) && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-100 text-slate-800">
                    <Building2 className="w-4 h-4 text-teal-600" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Estrutura Organizacional</h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* 1ª Divisão (Ex: IGREJA / CONGREGAÇÃO) */}
                    {nomenclaturas?.divisao1 && nomenclaturas.divisao1 !== 'NENHUMA' && (
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">{nomenclaturas.divisao1} (1ª Divisão)</label>
                        <select
                          value={dadosPessoais.supervisao || ''}
                          onChange={(e) => {
                            const value = e.target.value;
                            const d1Selecionada = (congregacoesOptions || []).find((opt) => opt.nome === value) || null;
                            const d2Relacionada = (d1Selecionada as any)?.campo_id || (d1Selecionada as any)?.supervisao_id
                              ? (camposOptions || []).find((opt) => opt.id === (d1Selecionada as any).campo_id || opt.id === (d1Selecionada as any).supervisao_id) || null
                              : null;
                            const d3Relacionada = (d2Relacionada as any)?.supervisao_id
                              ? (supervisoesOptions || []).find((opt) => opt.id === (d2Relacionada as any).supervisao_id) || null
                              : null;

                            setDadosPessoais((prev: any) => ({
                              ...prev,
                              supervisao: value,
                              campo: d2Relacionada?.nome || prev.campo || '',
                              congregacao: d3Relacionada?.nome || prev.congregacao || '',
                            }));
                          }}
                          className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition cursor-pointer"
                        >
                          <option value="">Selecione</option>
                          {(congregacoesOptions || []).map((opt) => (
                            <option key={opt.id} value={opt.nome}>{opt.nome}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* 2ª Divisão (Ex: GRUPO / CAMPO / SETOR) */}
                    {nomenclaturas?.divisao2 && nomenclaturas.divisao2 !== 'NENHUMA' && (
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">{nomenclaturas.divisao2} (2ª Divisão)</label>
                        <select
                          value={dadosPessoais.campo || ''}
                          onChange={(e) => {
                            const value = e.target.value;
                            setDadosPessoais((prev: any) => ({
                              ...prev,
                              campo: value,
                            }));
                          }}
                          className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition cursor-pointer"
                        >
                          <option value="">Selecione</option>
                          {(camposOptions || []).map((opt) => (
                            <option key={opt.id} value={opt.nome}>{opt.nome}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* 3ª Divisão (Se houver) */}
                    {nomenclaturas?.divisao3 && nomenclaturas.divisao3 !== 'NENHUMA' && (
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">{nomenclaturas.divisao3} (3ª Divisão)</label>
                        <select
                          value={dadosPessoais.congregacao || ''}
                          onChange={(e) => {
                            const value = e.target.value;
                            setDadosPessoais((prev: any) => ({
                              ...prev,
                              congregacao: value,
                            }));
                          }}
                          className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition cursor-pointer"
                        >
                          <option value="">Selecione</option>
                          {(supervisoesOptions || []).map((opt) => (
                            <option key={opt.id} value={opt.nome}>{opt.nome}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Seção 8: Observações Gerais */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Observações Gerais</label>
                <input
                  type="text"
                  placeholder="Informações ou notas adicionais sobre o membro..."
                  value={dadosPessoais.observacoes || ''}
                  onChange={(e) => setDadosPessoais((prev: any) => ({ ...prev, observacoes: e.target.value }))}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition"
                />
              </div>
            </div>
          )}

          {/* ═══════════ ABA: ENDEREÇO + CONTATO ═══════════ */}
          {activeTab === 'endereco' && (
            <div className="space-y-6">
              {/* Endereço Residencial */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100 text-slate-800">
                  <MapPin className="w-4 h-4 text-teal-600" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Endereço Residencial</h3>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">CEP</label>
                    <div className="flex gap-2 max-w-sm">
                      <input
                        type="text"
                        value={formatCep(enderecoData.cep || '')}
                        onChange={(e) => setEnderecoData((prev: any) => ({ ...prev, cep: formatCep(e.target.value) }))}
                        maxLength={9}
                        placeholder="00000-000"
                        className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition"
                      />
                      <button
                        type="button"
                        onClick={buscarCep}
                        disabled={loadingCep}
                        className="px-4 py-2.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl font-bold text-xs sm:text-sm transition flex items-center gap-1.5 shrink-0 shadow-xs cursor-pointer disabled:opacity-60"
                      >
                        {loadingCep ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                        <span>{loadingCep ? 'Buscando...' : 'Buscar CEP'}</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">Logradouro</label>
                      <input
                        type="text"
                        placeholder="Rua, Avenida, Alameda..."
                        value={enderecoData.logradouro || ''}
                        onChange={(e) => setEnderecoData((prev: any) => ({ ...prev, logradouro: e.target.value }))}
                        className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">Número</label>
                      <input
                        type="text"
                        placeholder="Nº ou S/N"
                        value={enderecoData.numero || ''}
                        onChange={(e) => setEnderecoData((prev: any) => ({ ...prev, numero: e.target.value }))}
                        className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">Bairro</label>
                      <input
                        type="text"
                        placeholder="Bairro"
                        value={enderecoData.bairro || ''}
                        onChange={(e) => setEnderecoData((prev: any) => ({ ...prev, bairro: e.target.value }))}
                        className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">Complemento</label>
                      <input
                        type="text"
                        placeholder="Apto, Bloco, Casa..."
                        value={enderecoData.complemento || ''}
                        onChange={(e) => setEnderecoData((prev: any) => ({ ...prev, complemento: e.target.value }))}
                        className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">Cidade</label>
                      <input
                        type="text"
                        placeholder="Cidade"
                        value={enderecoData.cidade || ''}
                        onChange={(e) => setEnderecoData((prev: any) => ({ ...prev, cidade: e.target.value }))}
                        className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition"
                      />
                    </div>
                  </div>

                  {/* Geolocalização (Automática) */}
                  <div className="p-4 bg-[#f8fafc] rounded-2xl border border-slate-200/90 space-y-3">
                    <div className="flex items-center gap-2 text-slate-800">
                      <MapPin className="w-4 h-4 text-teal-600" />
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                        Geolocalização (Automática)
                      </label>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">Latitude</label>
                        <input
                          type="text"
                          value={enderecoData.latitude || ''}
                          disabled
                          className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-100 text-slate-600 cursor-not-allowed font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">Longitude</label>
                        <input
                          type="text"
                          value={enderecoData.longitude || ''}
                          disabled
                          className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-100 text-slate-600 cursor-not-allowed font-mono"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-slate-500">
                      As coordenadas de latitude e longitude são preenchidas automaticamente a partir da consulta do CEP e endereço.
                    </p>
                  </div>
                </div>
              </div>

              {/* Canais de Contato */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100 text-slate-800">
                  <MessageCircle className="w-4 h-4 text-teal-600" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Canais de Contato</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">E-mail</label>
                    <input
                      type="email"
                      placeholder="exemplo@email.com"
                      value={dadosPessoais.email || ''}
                      onChange={(e) => setDadosPessoais((prev: any) => ({ ...prev, email: e.target.value }))}
                      className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Celular</label>
                    <input
                      type="text"
                      placeholder="(00) 00000-0000"
                      value={formatPhone(dadosPessoais.celular || '')}
                      onChange={(e) => setDadosPessoais((prev: any) => ({ ...prev, celular: formatPhone(e.target.value) }))}
                      maxLength={15}
                      className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">WhatsApp</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="(00) 00000-0000"
                        value={formatPhone(dadosPessoais.whatsapp || '')}
                        onChange={(e) => setDadosPessoais((prev: any) => ({ ...prev, whatsapp: formatPhone(e.target.value) }))}
                        maxLength={15}
                        className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (dadosPessoais.whatsapp) {
                            const num = dadosPessoais.whatsapp.replace(/\D/g, '');
                            window.open(`https://wa.me/55${num}`, '_blank');
                          }
                        }}
                        title="Abrir conversa no WhatsApp"
                        className="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition flex items-center justify-center shrink-0 shadow-xs cursor-pointer"
                      >
                        <MessageCircle className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════ ABA: MINISTERIAL ═══════════ */}
          {activeTab === 'ministerial' && (
            <div className="space-y-6">
              {/* Formação e Procedência */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100 text-slate-800">
                  <GraduationCap className="w-4 h-4 text-teal-600" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Formação e Procedência</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Curso Teológico</label>
                    <select
                      value={dadosMinisteriais.cursoTeologico || ''}
                      onChange={(e) => setDadosMinisteriais((prev: any) => ({ ...prev, cursoTeologico: e.target.value }))}
                      className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition cursor-pointer"
                    >
                      <option value="">NÃO TEM</option>
                      <option value="basico">Básico</option>
                      <option value="medio">Médio</option>
                      <option value="bacharel">Bacharel</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Instituição Teológica</label>
                    <input
                      type="text"
                      placeholder="Nome do seminário/instituto"
                      value={dadosMinisteriais.instituicaoTeologica || ''}
                      onChange={(e) => setDadosMinisteriais((prev: any) => ({ ...prev, instituicaoTeologica: e.target.value }))}
                      className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition"
                    />
                  </div>
                  <div className="pt-2 sm:pt-4">
                    <label className="flex items-center gap-2.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={!!dadosMinisteriais.pastorAuxiliar}
                        onChange={(e) => setDadosMinisteriais((prev: any) => ({ ...prev, pastorAuxiliar: e.target.checked }))}
                        className="w-4.5 h-4.5 text-teal-700 rounded-md border-slate-300 focus:ring-teal-600 cursor-pointer"
                      />
                      <span className="text-sm font-semibold text-slate-800">Pastor Auxiliar?</span>
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Procedência</label>
                    <select
                      value={dadosMinisteriais.procedencia || ''}
                      onChange={(e) => setDadosMinisteriais((prev: any) => ({ ...prev, procedencia: e.target.value }))}
                      className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition cursor-pointer"
                    >
                      <option value="">- Definir -</option>
                      <option value="aclamacao">Aclamação</option>
                      <option value="batismo">Batismo</option>
                      <option value="carta">Carta</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Procedência Local</label>
                    <input
                      type="text"
                      placeholder="Igreja ou ministério de origem"
                      value={dadosMinisteriais.procedenciaLocal || ''}
                      onChange={(e) => setDadosMinisteriais((prev: any) => ({ ...prev, procedenciaLocal: e.target.value }))}
                      className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition"
                    />
                  </div>
                </div>
              </div>

              {/* Cargo e Batismos */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100 text-slate-800">
                  <Church className="w-4 h-4 text-teal-600" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Cargo Ministerial & Batismos</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Cargo Ministerial</label>
                    <select
                      value={cargoSelecionado || ''}
                      onChange={(e) => setCargoSelecionado(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition cursor-pointer"
                    >
                      <option value="">- Selecionar Cargo -</option>
                      {cargosMinisteriais
                        ?.filter((cargo: any) => cargo.ativo)
                        .map((cargo: any) => (
                          <option key={cargo.id} value={cargo.nome}>
                            {cargo.nome}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Data Batismo Esp. Santo</label>
                    <input
                      type="date"
                      value={dadosMinisteriais.dataBatismoEspiritoSanto || ''}
                      onChange={(e) => setDadosMinisteriais((prev: any) => ({ ...prev, dataBatismoEspiritoSanto: e.target.value }))}
                      className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Data Batismo Águas</label>
                    <input
                      type="date"
                      value={dadosMinisteriais.dataBatismoAguas || ''}
                      onChange={(e) => setDadosMinisteriais((prev: any) => ({ ...prev, dataBatismoAguas: e.target.value }))}
                      className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition"
                    />
                  </div>
                </div>

                {/* Bloco de Consagração / Recebimento */}
                {cargoSelecionado && (
                  <div className="p-4.5 border border-teal-200/80 rounded-2xl bg-teal-50/40 space-y-3.5">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-teal-600 text-white flex items-center justify-center font-bold text-xs">
                        ✓
                      </div>
                      <h4 className="text-xs font-bold text-teal-900 uppercase tracking-wider">
                        Consagração / Recebimento — {cargoSelecionado}
                      </h4>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">Data da Consagração</label>
                        <input
                          type="date"
                          value={dadosCargos?.[cargoSelecionado]?.dataConsagracaoRecebimento || ''}
                          onChange={(e) =>
                            setDadosCargos((prev: any) => ({
                              ...prev,
                              [cargoSelecionado]: {
                                ...prev?.[cargoSelecionado],
                                dataConsagracaoRecebimento: e.target.value,
                              },
                            }))
                          }
                          className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">Local de Consagração</label>
                        <input
                          type="text"
                          placeholder="Ex: Templo Central"
                          value={dadosCargos?.[cargoSelecionado]?.localConsagracao || ''}
                          onChange={(e) =>
                            setDadosCargos((prev: any) => ({
                              ...prev,
                              [cargoSelecionado]: {
                                ...prev?.[cargoSelecionado],
                                localConsagracao: e.target.value,
                              },
                            }))
                          }
                          className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">Local de Origem</label>
                        <input
                          type="text"
                          placeholder="Ex: Igreja Original"
                          value={dadosCargos?.[cargoSelecionado]?.localOrigem || ''}
                          onChange={(e) =>
                            setDadosCargos((prev: any) => ({
                              ...prev,
                              [cargoSelecionado]: {
                                ...prev?.[cargoSelecionado],
                                localOrigem: e.target.value,
                              },
                            }))
                          }
                          className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Atuação e Função Eclesiástica */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100 text-slate-800">
                  <Sparkles className="w-4 h-4 text-teal-600" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Função e Setor na Igreja</h3>
                </div>

                <div className="flex items-center gap-2.5 p-3.5 border border-slate-200 rounded-xl bg-slate-50/70">
                  <input
                    type="checkbox"
                    id="chkTemFuncao"
                    checked={!!dadosMinisteriais.temFuncaoIgreja}
                    onChange={(e) => setDadosMinisteriais((prev: any) => ({ ...prev, temFuncaoIgreja: e.target.checked }))}
                    className="w-4.5 h-4.5 text-teal-700 rounded-md border-slate-300 focus:ring-teal-600 cursor-pointer"
                  />
                  <label htmlFor="chkTemFuncao" className="text-sm font-semibold text-slate-800 cursor-pointer">
                    Exerce função ou cargo específico na igreja?
                  </label>
                </div>

                {dadosMinisteriais.temFuncaoIgreja && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-2xl bg-teal-50/30 border border-teal-200/80">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">Qual Função?</label>
                      <input
                        type="text"
                        placeholder="Ex: Líder de Louvor, Coordenador Geral"
                        value={dadosMinisteriais.qualFuncao || ''}
                        onChange={(e) => setDadosMinisteriais((prev: any) => ({ ...prev, qualFuncao: e.target.value }))}
                        className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">Setor ou Departamento</label>
                      <input
                        type="text"
                        placeholder="Ex: Ministério de Jovens, Secretaria"
                        value={dadosMinisteriais.setorDepartamento || ''}
                        onChange={(e) => setDadosMinisteriais((prev: any) => ({ ...prev, setorDepartamento: e.target.value }))}
                        className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Observações Ministeriais</label>
                  <textarea
                    rows={2}
                    placeholder="Notas ou observações ministeriais..."
                    value={dadosMinisteriais.observacoesMinisteriais || ''}
                    onChange={(e) => setDadosMinisteriais((prev: any) => ({ ...prev, observacoesMinisteriais: e.target.value }))}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition"
                  />
                </div>
              </div>

              {/* Histórico / Trajetória de Processos, Cartas e Consagrações */}
              {membroEditando && (
                <div className="p-4.5 border border-slate-200 rounded-2xl bg-slate-50/80 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                      <ScrollText className="w-4 h-4 text-teal-700" />
                      <span>Histórico de Processos e Trajetória Ministerial</span>
                    </h3>
                    <span className="text-xs text-slate-500 font-medium">
                      {((membroEditando?.historico_processos || membroEditando?.historicoProcessos || membroEditando?.custom_fields?.historico_processos || []) as Array<any>).length} registro(s)
                    </span>
                  </div>

                  {((membroEditando?.historico_processos || membroEditando?.historicoProcessos || membroEditando?.custom_fields?.historico_processos || []) as Array<any>).length === 0 ? (
                    <p className="text-xs text-slate-500 italic py-3 text-center">
                      Nenhum evento ou processo registrado no histórico deste membro.
                    </p>
                  ) : (
                    <div className="space-y-2.5 max-h-64 overflow-y-auto modal-scrollbar pr-1">
                      {((membroEditando?.historico_processos || membroEditando?.historicoProcessos || membroEditando?.custom_fields?.historico_processos || []) as Array<any>)
                        .slice()
                        .reverse()
                        .map((item: any, idx: number) => {
                          const isHomologado = item.tipo_evento === 'homologacao' || item.status_processo === 'homologar';
                          const isDeferido = item.decisao === 'deferir' || item.status_processo === 'deferir';
                          const isIndeferido = item.decisao === 'indeferir' || item.status_processo === 'indeferir';
                          const isReaberto = item.tipo_evento === 'reabertura';
                          const isMudanca = item.tipo_evento === 'carta_mudanca';
                          const isDesligamento = item.tipo_evento === 'carta_desligamento';
                          const isTransito = item.tipo_evento === 'carta_transito';
                          const isDocumento = item.tipo_evento === 'documento_emitido';
                          const isReativacao = item.tipo_evento === 'reativacao';
                          const isDirigente = item.tipo_evento === 'posse_dirigente' || item.tipo_evento === 'dirigente_posse';

                          let badgeColor = 'bg-sky-50 text-sky-800 border-sky-200';
                          let badgeLabel = 'Início do Processo';

                          if (isMudanca) {
                            badgeColor = 'bg-amber-50 text-amber-800 border-amber-200';
                            badgeLabel = 'Carta de Mudança';
                          } else if (isDesligamento) {
                            badgeColor = 'bg-rose-50 text-rose-800 border-rose-200';
                            badgeLabel = 'Carta de Desligamento';
                          } else if (isTransito) {
                            badgeColor = 'bg-indigo-50 text-indigo-800 border-indigo-200';
                            badgeLabel = 'Carta de Trânsito';
                          } else if (isDocumento) {
                            badgeColor = 'bg-teal-50 text-teal-800 border-teal-200';
                            badgeLabel = item.tipo_documento || 'Documento Emitido';
                          } else if (isReativacao) {
                            badgeColor = 'bg-emerald-50 text-emerald-800 border-emerald-200';
                            badgeLabel = 'Reativação Cadastral';
                          } else if (isDirigente) {
                            badgeColor = 'bg-blue-50 text-blue-800 border-blue-200';
                            badgeLabel = 'Posse de Dirigente';
                          } else if (isHomologado) {
                            badgeColor = 'bg-purple-50 text-purple-800 border-purple-200';
                            badgeLabel = 'Homologado';
                          } else if (isDeferido) {
                            badgeColor = 'bg-emerald-50 text-emerald-800 border-emerald-200';
                            badgeLabel = 'Comissão: Deferido';
                          } else if (isIndeferido) {
                            badgeColor = 'bg-red-50 text-red-800 border-red-200';
                            badgeLabel = 'Comissão: Indeferido';
                          } else if (isReaberto) {
                            badgeColor = 'bg-amber-50 text-amber-800 border-amber-200';
                            badgeLabel = 'Reaberto';
                          }

                          const dataFormatada = item.data
                            ? item.data.split('-').reverse().join('/')
                            : item.data_hora
                            ? new Date(item.data_hora).toLocaleDateString('pt-BR')
                            : item.criado_em
                            ? new Date(item.criado_em).toLocaleDateString('pt-BR')
                            : '-';

                          return (
                            <div
                              key={item.id || idx}
                              className="bg-white p-3 rounded-xl border border-slate-200 text-xs space-y-1.5 shadow-2xs"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${badgeColor}`}>
                                    {badgeLabel}
                                  </span>
                                  {item.numero_documento && (
                                    <span className="font-mono text-[11px] font-bold text-slate-700">
                                      Doc. nº {item.numero_documento}
                                    </span>
                                  )}
                                  {item.numero_processo && (
                                    <span className="font-mono text-[11px] font-bold text-slate-700">
                                      Proc. nº {item.numero_processo}
                                    </span>
                                  )}
                                </div>
                                <span className="text-[10px] text-slate-400 font-medium shrink-0">
                                  {dataFormatada}
                                </span>
                              </div>

                              {item.resultado ? (
                                <div className="font-semibold text-slate-800 text-[11px]">
                                  {item.resultado}
                                </div>
                              ) : item.cargo_anterior || item.cargo_pretendido ? (
                                <div className="text-slate-600 text-[11px]">
                                  {item.cargo_anterior ? `De: ${item.cargo_anterior}` : ''}
                                  {item.cargo_anterior && item.cargo_pretendido ? ' → ' : ''}
                                  {item.cargo_pretendido ? `Para: ${item.cargo_pretendido}` : ''}
                                </div>
                              ) : null}

                              {item.destino && (
                                <div className="text-slate-700 font-medium text-[11px]">
                                  <span className="text-slate-500">Destino:</span> {item.destino}
                                </div>
                              )}

                              {item.motivo && item.motivo !== item.destino && (
                                <div className="text-slate-700 font-medium text-[11px]">
                                  <span className="text-slate-500">Motivo:</span> {item.motivo}
                                </div>
                              )}

                              {item.status_resultante && (
                                <div className="text-slate-600 text-[10px]">
                                  <span className="text-slate-400">Situação:</span>{' '}
                                  <span className={item.status_resultante === 'inativo' ? 'text-amber-700 font-semibold' : 'text-emerald-700 font-semibold'}>
                                    {item.status_resultante === 'inativo' ? 'Inativado no Rol' : 'Ativo no Rol'}
                                  </span>
                                  {item.responsavel ? ` • Resp.: ${item.responsavel}` : ''}
                                </div>
                              )}

                              {item.descricao && (
                                <p className="text-slate-500 text-[10px] italic">
                                  {item.descricao}
                                </p>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ═══════════ ABA: FOTO ═══════════ */}
          {/* ═══════════ ABA: FOTO ═══════════ */}
          {activeTab === 'foto' && (
            <div className="space-y-6">
              <EditorFotoMinisterial
                fotoMembro={fotoMembro}
                onSaveComposicao={(resultado) => setFotoMembro(resultado)}
                fileInputRef={fileInputRef}
              />
            </div>
          )}

          {/* ═══════════ ABA: FAMÍLIA ═══════════ */}
          {activeTab === 'familia' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200/80">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200/80 flex items-center justify-center font-bold">
                    <Users className="w-4 h-4 text-emerald-700" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">Núcleo Familiar</h3>
                    <p className="text-[11px] text-slate-500 font-medium">
                      Organização familiar do membro: responsável, cônjuge e filhos cadastrados
                    </p>
                  </div>
                </div>
              </div>

              {/* 1. BLOCO RESPONSÁVEL (MINISTRO / TITULAR) */}
              <div className="bg-slate-50/70 border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-2xs">
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200/70">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-700" />
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Responsável / Titular
                    </span>
                  </div>
                  <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                    {dadosPessoais.tipoCadastro ? String(dadosPessoais.tipoCadastro).toUpperCase() : 'CADASTRO'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[11px] font-medium">Nome</span>
                    <span className="font-bold text-slate-900 text-sm">
                      {dadosPessoais.nome || membroEditando?.nome || 'Não informado'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px] font-medium">Matrícula</span>
                    <span className="font-mono font-semibold text-slate-700">
                      {dadosPessoais.matricula || membroEditando?.matricula || 'Gerada ao salvar'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px] font-medium">CPF</span>
                    <span className="font-mono text-slate-700">
                      {dadosPessoais.cpf || 'Não informado'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px] font-medium">Congregação</span>
                    <span className="font-medium text-slate-800">
                      {dadosPessoais.supervisao || dadosPessoais.congregacao || 'Sede'}
                    </span>
                  </div>
                </div>
              </div>

              {/* 2. BLOCO CÔNJUGE */}
              <div className="bg-slate-50/70 border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200/70">
                  <div className="flex items-center gap-2">
                    <Heart className="w-4 h-4 text-emerald-700" />
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Cônjuge</span>
                    {dadosPessoais.estadoCivil !== 'casado' && (
                      <span className="text-[11px] text-amber-700 font-medium bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                        Estado Civil: {dadosPessoais.estadoCivil ? dadosPessoais.estadoCivil.replace('_', ' ') : 'Não informado'}
                      </span>
                    )}
                  </div>
                  {buscandoConjuge && (
                    <span className="text-xs text-emerald-800 flex items-center gap-1.5 font-medium">
                      <Loader2 className="animate-spin h-3.5 w-3.5 text-emerald-700" />
                      Buscando na base...
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">CPF do Cônjuge</label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="000.000.000-00"
                        value={formatCpf(dadosPessoais.cpfConjuge || '')}
                        onChange={(e) => handleCpfConjugeChange(e.target.value)}
                        maxLength={14}
                        className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 transition pr-9 shadow-2xs"
                      />
                      <button
                        type="button"
                        onClick={() => buscarConjugePorCpf(dadosPessoais.cpfConjuge || '')}
                        title="Buscar cônjuge na base de membros"
                        className="absolute right-2.5 top-2.5 p-1 text-slate-400 hover:text-emerald-700 transition cursor-pointer"
                      >
                        <Search className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Nome do Cônjuge</label>
                    <input
                      type="text"
                      placeholder="Nome completo do cônjuge"
                      value={dadosPessoais.nomeConjuge || ''}
                      onChange={(e) => setDadosPessoais((prev: any) => ({ ...prev, nomeConjuge: e.target.value }))}
                      className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 transition shadow-2xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Data de Nascimento</label>
                    <input
                      type="date"
                      value={dadosPessoais.dataNascimentoConjuge || ''}
                      onChange={(e) => setDadosPessoais((prev: any) => ({ ...prev, dataNascimentoConjuge: e.target.value }))}
                      className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 transition shadow-2xs"
                    />
                  </div>
                </div>

                {conjugeMsg && (
                  <div
                    className={`text-xs font-medium px-3.5 py-2 rounded-xl border transition-all ${
                      conjugeMsg.tipo === 'sucesso'
                        ? 'text-emerald-800 bg-emerald-50 border-emerald-200'
                        : 'text-amber-800 bg-amber-50 border-amber-200'
                    }`}
                  >
                    {conjugeMsg.texto}
                  </div>
                )}
              </div>

              {/* 3. BLOCO FILHOS */}
              <div className="bg-slate-50/70 border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200/70">
                  <div className="flex items-center gap-2">
                    <Baby className="w-4 h-4 text-emerald-700" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">Filhos</h4>
                    <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                      {((dadosPessoais as any).filhos || []).length}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setTipoAcaoFilho('vincular');
                      setBuscaFilhoTerm('');
                      setResultadosBuscaFilho([]);
                      setNovoFilhoNome('');
                      setNovoFilhoNascimento('');
                      setNovoFilhoSexo('MASCULINO');
                      setNovoFilhoCpf('');
                      setNovoFilhoTelefone('');
                      setNovoFilhoEmail('');
                      setNovoFilhoCongregacaoId(
                        (congregacoesOptions || []).find((c) => c.nome === dadosPessoais.supervisao || c.nome === dadosPessoais.congregacao)?.id ||
                        membroEditando?.congregacao_id ||
                        ''
                      );
                      setFilhoErro(null);
                      setShowModalFilho(true);
                    }}
                    className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <span>+</span>
                    <span>Adicionar Filho</span>
                  </button>
                </div>

                {!((dadosPessoais as any).filhos) || (dadosPessoais as any).filhos.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 text-xs bg-white rounded-xl border border-dashed border-slate-200">
                    Nenhum filho vinculado ou cadastrado neste registro familiar.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {(dadosPessoais as any).filhos.map((filho: any, idx: number) => (
                      <div
                        key={idx}
                        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 bg-white border border-slate-200 rounded-xl shadow-2xs hover:border-emerald-300 transition"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-bold text-slate-900">{filho.nome}</span>
                            {filho.matricula && (
                              <span className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200 font-mono font-medium">
                                Matr. {filho.matricula}
                              </span>
                            )}
                            {filho.memberId ? (
                              <span className="text-[10px] bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-200 font-semibold">
                                Vinculado à base oficial
                              </span>
                            ) : (
                              <span className="text-[10px] bg-slate-50 text-slate-600 px-2 py-0.5 rounded-full border border-slate-200">
                                Registro direto
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                            {filho.dataNascimento ? (
                              <span>Nascimento: <strong>{filho.dataNascimento.split('-').reverse().join('/')}</strong></span>
                            ) : (
                              <span>Nascimento não informado</span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                          {filho.memberId && onAbrirMembro && (
                            <button
                              type="button"
                              onClick={() => onAbrirMembro(filho.memberId)}
                              className="px-2.5 py-1 text-xs text-emerald-800 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100/70 border border-emerald-200 rounded-lg transition cursor-pointer flex items-center gap-1 shadow-2xs"
                              title="Abrir ficha completa deste membro"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              <span>Ver Ficha</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={async () => {
                              const filhoParaRemover = ((dadosPessoais as any).filhos || [])[idx];
                              const lista = ((dadosPessoais as any).filhos || []).filter((_: any, i: number) => i !== idx);
                              setDadosPessoais((prev: any) => ({ ...prev, filhos: lista }));

                              // Se estiver editando um membro existente, remover também na API oficial de família
                              if (membroEditando?.id && (filhoParaRemover?.id || filhoParaRemover?.memberId)) {
                                try {
                                  const relId = filhoParaRemover.id || filhoParaRemover.memberId;
                                  const supabase = createClient();
                                  const { data: { session } } = await supabase.auth.getSession();
                                  const token = session?.access_token;
                                  if (token) {
                                    await fetch(`/api/v1/members/${membroEditando.id}/familia/${relId}`, {
                                      method: 'DELETE',
                                      headers: {
                                        Authorization: `Bearer ${token}`,
                                      },
                                    });
                                  }
                                } catch (delErr) {
                                  console.warn('Remoção imediata na API de família falhou (será salva com o formulário):', delErr);
                                }
                              }
                            }}
                            className="px-2.5 py-1 text-xs text-red-600 hover:text-red-700 border border-red-200 hover:border-red-300 rounded-lg hover:bg-red-50 transition cursor-pointer flex items-center gap-1 shrink-0"
                            title="Desvincular filho (não exclui o cadastro da pessoa)"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Desvincular</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ─── STICKY FOOTER / AÇÕES ─── */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50/80 backdrop-blur-xs shrink-0">
          <button
            type="button"
            onClick={fecharFormulario}
            disabled={salvandoMembro}
            className="px-5 py-2.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl font-bold text-xs sm:text-sm transition shadow-xs cursor-pointer disabled:opacity-50"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={salvarMembro}
            disabled={salvandoMembro}
            className="px-6 py-2.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl font-bold text-xs sm:text-sm transition shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-60"
          >
            {salvandoMembro ? (
              <>
                <Loader2 className="animate-spin h-4 w-4 text-white" />
                <span>{membroEditando ? 'Atualizando...' : 'Salvando...'}</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4 text-white" />
                <span>{membroEditando ? 'Atualizar Membro' : 'Cadastrar Membro'}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Modal Híbrido: Vincular Pessoa Existente ou Cadastrar Novo Filho */}
      {showModalFilho && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[60] p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-teal-700" />
                <h3 className="text-sm font-bold text-slate-800">Adicionar Filho ao Registro Familiar</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowModalFilho(false)}
                className="text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Alternância de Modo */}
            <div className="p-4 border-b border-slate-100 bg-white">
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => {
                    setTipoAcaoFilho('vincular');
                    setFilhoErro(null);
                  }}
                  className={`py-2 text-xs font-bold rounded-lg transition ${
                    tipoAcaoFilho === 'vincular'
                      ? 'bg-white text-teal-800 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Vincular Existente
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTipoAcaoFilho('cadastrar');
                    setFilhoErro(null);
                  }}
                  className={`py-2 text-xs font-bold rounded-lg transition ${
                    tipoAcaoFilho === 'cadastrar'
                      ? 'bg-white text-teal-800 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Cadastrar Novo
                </button>
              </div>
            </div>

            {/* Conteúdo do Modo */}
            <div className="p-5 space-y-4">
              {filhoErro && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                  {filhoErro}
                </div>
              )}

              {tipoAcaoFilho === 'vincular' ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Buscar pessoa na base
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Digite o nome ou matrícula..."
                        value={buscaFilhoTerm}
                        onChange={(e) => {
                          setBuscaFilhoTerm(e.target.value);
                          buscarPessoasParaFilho(e.target.value);
                        }}
                        className="w-full px-3.5 py-2.5 text-xs font-medium border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600"
                      />
                      {buscandoFilhos && (
                        <span className="absolute right-3 top-3 text-slate-400">
                          <Loader2 className="animate-spin h-4 w-4 text-teal-600" />
                        </span>
                      )}
                    </div>
                  </div>

                  {resultadosBuscaFilho.length > 0 && (
                    <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl">
                      {resultadosBuscaFilho.map((p) => (
                        <div
                          key={p.id}
                          onClick={() => handleVincularFilhoExistente(p)}
                          className="p-3 hover:bg-teal-50/60 cursor-pointer transition flex items-center justify-between text-xs"
                        >
                          <div>
                            <p className="font-bold text-slate-800">{p.name}</p>
                            <p className="text-[11px] text-slate-500">
                              Matrícula: {p.matricula || '—'} • {p.role || p.tipo_cadastro || 'membro'}
                            </p>
                          </div>
                          <span className="text-[11px] text-teal-700 font-semibold bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                            Selecionar
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {buscaFilhoTerm.trim().length >= 2 && !buscandoFilhos && resultadosBuscaFilho.length === 0 && (
                    <p className="text-center text-xs text-slate-500 py-3">
                      Nenhuma pessoa encontrada com esse termo.
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-3.5">
                  {/* Nome Completo */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Nome Completo <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Nome completo do filho(a)"
                      value={novoFilhoNome}
                      onChange={(e) => setNovoFilhoNome(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs font-medium border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 shadow-2xs"
                    />
                  </div>

                  {/* Nascimento e Sexo */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Data de Nascimento <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        value={novoFilhoNascimento}
                        onChange={(e) => setNovoFilhoNascimento(e.target.value)}
                        className="w-full px-3.5 py-2 text-xs font-medium border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 bg-white shadow-2xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Sexo <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={novoFilhoSexo}
                        onChange={(e) => setNovoFilhoSexo(e.target.value)}
                        className="w-full px-3.5 py-2 text-xs font-medium border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 bg-white cursor-pointer shadow-2xs"
                      >
                        <option value="MASCULINO">Masculino</option>
                        <option value="FEMININO">Feminino</option>
                      </select>
                    </div>
                  </div>

                  {/* CPF e Telefone (Opcionais) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        CPF <span className="text-[10px] text-slate-400 font-normal">(opcional)</span>
                      </label>
                      <input
                        type="text"
                        placeholder="000.000.000-00"
                        value={formatCpf(novoFilhoCpf)}
                        onChange={(e) => setNovoFilhoCpf(formatCpf(e.target.value))}
                        maxLength={14}
                        className="w-full px-3.5 py-2 text-xs font-medium border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 shadow-2xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Telefone / WhatsApp <span className="text-[10px] text-slate-400 font-normal">(opcional)</span>
                      </label>
                      <input
                        type="text"
                        placeholder="(00) 00000-0000"
                        value={formatPhone(novoFilhoTelefone)}
                        onChange={(e) => setNovoFilhoTelefone(formatPhone(e.target.value))}
                        maxLength={15}
                        className="w-full px-3.5 py-2 text-xs font-medium border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 shadow-2xs"
                      />
                    </div>
                  </div>

                  {/* E-mail e Congregação */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        E-mail <span className="text-[10px] text-slate-400 font-normal">(opcional)</span>
                      </label>
                      <input
                        type="email"
                        placeholder="email@exemplo.com"
                        value={novoFilhoEmail}
                        onChange={(e) => setNovoFilhoEmail(e.target.value)}
                        className="w-full px-3.5 py-2 text-xs font-medium border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 shadow-2xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Congregação
                      </label>
                      <select
                        value={novoFilhoCongregacaoId}
                        onChange={(e) => setNovoFilhoCongregacaoId(e.target.value)}
                        className="w-full px-3.5 py-2 text-xs font-medium border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 bg-white cursor-pointer shadow-2xs"
                      >
                        <option value="">(Herdar da congregação do responsável)</option>
                        {(congregacoesOptions || []).map((cg) => (
                          <option key={cg.id} value={cg.id}>
                            {cg.nome}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-500 leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                    O filho(a) será registrado na base oficial como <strong>Criança</strong> (sem atribuição indevida de membro batizado ou ministro), com vínculo de filiação automático ao titular.
                  </p>
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowModalFilho(false)}
                className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200/60 rounded-xl transition cursor-pointer"
              >
                Cancelar
              </button>
              {tipoAcaoFilho === 'cadastrar' && (
                <button
                  type="button"
                  onClick={handleCadastrarNovoFilho}
                  disabled={salvandoFilho}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-sm disabled:opacity-60 cursor-pointer"
                >
                  {salvandoFilho ? (
                    <>
                      <Loader2 className="animate-spin w-3.5 h-3.5 text-white" />
                      <span>Cadastrando...</span>
                    </>
                  ) : (
                    <span>Cadastrar e Vincular</span>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
