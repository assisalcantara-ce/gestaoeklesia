'use client';

import { useState, useEffect } from 'react';
import { 
  Users, UserPlus, ArrowRightLeft, Search, Phone, Mail, 
  CheckCircle2, AlertCircle, RefreshCw, X,
  UserCheck, HeartHandshake, AlertTriangle, Trash2
} from 'lucide-react';
import { 
  CelulaItem, CelulaParticipanteItem, CelulaTransferenciaItem,
  CelulaPapelParticipante, CelulaParticipanteStatus, SalvarParticipanteInput,
  TransferirParticipanteInput
} from '@/types/celulas';
import { authenticatedFetch } from '@/lib/api-client';

interface TabParticipantesProps {
  celulas: CelulaItem[];
  congregacoes: { id: string; nome: string }[];
  termoCelula: string;
}

const PAPEIS_MAP: Record<CelulaPapelParticipante, { label: string; cor: string }> = {
  lider: { label: 'Líder', cor: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  vice_lider: { label: 'Vice-Líder', cor: 'bg-teal-100 text-teal-800 border-teal-300' },
  anfitriao: { label: 'Anfitrião', cor: 'bg-amber-100 text-amber-800 border-amber-300' },
  lider_em_treinamento: { label: 'Líder em Treinamento', cor: 'bg-indigo-100 text-indigo-800 border-indigo-300' },
  membro: { label: 'Membro', cor: 'bg-blue-100 text-blue-800 border-blue-300' },
  congregante: { label: 'Congregante', cor: 'bg-sky-100 text-sky-800 border-sky-300' },
  visitante_regular: { label: 'Visitante Regular', cor: 'bg-purple-100 text-purple-800 border-purple-300' },
  crianca: { label: 'Criança', cor: 'bg-pink-100 text-pink-800 border-pink-300' },
};

const STATUS_MAP: Record<CelulaParticipanteStatus, { label: string; cor: string }> = {
  ativo: { label: 'Ativo', cor: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  inativo: { label: 'Inativo', cor: 'bg-slate-100 text-slate-600 border-slate-200' },
  transferido: { label: 'Transferido', cor: 'bg-amber-50 text-amber-700 border-amber-200' },
  desligado: { label: 'Desligado', cor: 'bg-rose-50 text-rose-700 border-rose-200' },
};

export function TabParticipantes({ celulas, congregacoes, termoCelula }: TabParticipantesProps) {
  const [participantes, setParticipantes] = useState<CelulaParticipanteItem[]>([]);
  const [transferencias, setTransferencias] = useState<CelulaTransferenciaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingTransf, setLoadingTransf] = useState(false);
  const [subAba, setSubAba] = useState<'lista' | 'historico'>('lista');

  // Filtros
  const [busca, setBusca] = useState('');
  const [filtroCelula, setFiltroCelula] = useState('todas');
  const [filtroStatus, setFiltroStatus] = useState('ativo');
  const [filtroPapel, setFiltroPapel] = useState('todos');

  // Mensagens
  const [mensagem, setMensagem] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null);

  // Modal Novo / Editar Participante
  const [modalParticipanteAberto, setModalParticipanteAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [_participanteEdicao, setParticipanteEdicao] = useState<CelulaParticipanteItem | null>(null);
  const [origemVinculo, setOrigemVinculo] = useState<'membro' | 'visitante' | 'manual'>('membro');

  // Busca integrada de membros existentes
  const [buscaMembro, setBuscaMembro] = useState('');
  const [buscandoMembros, setBuscandoMembros] = useState(false);
  const [membrosEncontrados, setMembrosEncontrados] = useState<Array<{ id: string; name: string; email?: string; phone?: string; cpf?: string }>>([]);
  const [membroSelecionado, setMembroSelecionado] = useState<{ id: string; name: string; email?: string; phone?: string } | null>(null);

  // Busca integrada de visitantes do acolhimento/cultos
  const [buscaVisitanteTel, setBuscaVisitanteTel] = useState('');
  const [buscandoVisitantes, setBuscandoVisitantes] = useState(false);
  const [visitantesEncontrados, setVisitantesEncontrados] = useState<Array<{ id: string; nome: string; telefone?: string; cidade?: string; congregacao_nome?: string }>>([]);
  const [visitanteSelecionado, setVisitanteSelecionado] = useState<{ id: string; nome: string; telefone?: string } | null>(null);

  // Form State
  const [formPart, setFormPart] = useState<SalvarParticipanteInput>({
    celula_id: '',
    congregacao_id: '',
    member_id: null,
    nome_completo: '',
    email: '',
    telefone: '',
    papel: 'membro',
    status: 'ativo',
    data_ingresso: new Date().toISOString().slice(0, 10),
  });

  // Modal Transferência
  const [modalTransfAberto, setModalTransfAberto] = useState(false);
  const [transferindo, setTransferindo] = useState(false);
  const [participanteParaTransferir, setParticipanteParaTransferir] = useState<CelulaParticipanteItem | null>(null);
  const [formTransf, setFormTransf] = useState<TransferirParticipanteInput>({
    participante_id: '',
    celula_destino_id: '',
    motivo: '',
  });

  // Modal Excluir
  const [modalExcluirAberto, setModalExcluirAberto] = useState(false);
  const [participanteExcluir, setParticipanteExcluir] = useState<CelulaParticipanteItem | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  // Carregar Participantes
  const carregarParticipantes = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filtroCelula !== 'todas') params.append('celula_id', filtroCelula);
      if (filtroStatus !== 'todos') params.append('status', filtroStatus);
      if (busca.trim()) params.append('busca', busca.trim());

      const res = await authenticatedFetch(`/api/v1/celulas/participantes?${params.toString()}`);
      const json = await res.json();
      if (res.ok) {
        setParticipantes(json.data || []);
      } else {
        throw new Error(json.error || 'Erro ao carregar participantes');
      }
    } catch (err: any) {
      setMensagem({ tipo: 'erro', texto: err.message });
    } finally {
      setLoading(false);
    }
  };

  // Carregar Transferências
  const carregarTransferencias = async () => {
    try {
      setLoadingTransf(true);
      const params = new URLSearchParams();
      if (filtroCelula !== 'todas') params.append('celula_id', filtroCelula);

      const res = await authenticatedFetch(`/api/v1/celulas/transferencias?${params.toString()}`);
      const json = await res.json();
      if (res.ok) {
        setTransferencias(json.data || []);
      }
    } catch (err: any) {
      console.warn('Erro ao carregar histórico de transferências:', err);
    } finally {
      setLoadingTransf(false);
    }
  };

  useEffect(() => {
    carregarParticipantes();
  }, [filtroCelula, filtroStatus]);

  useEffect(() => {
    if (subAba === 'historico') {
      carregarTransferencias();
    }
  }, [subAba, filtroCelula]);

  // Buscar Membros em tempo real
  useEffect(() => {
    if (origemVinculo !== 'membro' || buscaMembro.trim().length < 3) {
      setMembrosEncontrados([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setBuscandoMembros(true);
        const res = await authenticatedFetch(`/api/v1/members?search=${encodeURIComponent(buscaMembro.trim())}&limit=8`);
        const json = await res.json();
        if (res.ok && json.data) {
          setMembrosEncontrados(json.data.map((m: any) => ({
            id: m.id,
            name: m.name || m.nome,
            email: m.email,
            phone: m.phone || m.celular || m.whatsapp,
            cpf: m.cpf,
          })));
        }
      } catch (e) {
        console.warn('Erro na busca de membros:', e);
      } finally {
        setBuscandoMembros(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [buscaMembro, origemVinculo]);

  // Buscar Visitantes por Telefone
  const buscarVisitantesAcolhimento = async () => {
    const telDigits = buscaVisitanteTel.replace(/\D/g, '');
    if (telDigits.length < 4) {
      setMensagem({ tipo: 'erro', texto: 'Informe pelo menos 4 dígitos do telefone para buscar visitantes.' });
      return;
    }
    try {
      setBuscandoVisitantes(true);
      const res = await authenticatedFetch(`/api/v1/discipulado/visitantes?telefone=${encodeURIComponent(telDigits)}`);
      const json = await res.json();
      if (res.ok && json.visitantes) {
        setVisitantesEncontrados(json.visitantes);
        if (json.visitantes.length === 0) {
          setMensagem({ tipo: 'erro', texto: 'Nenhum visitante de acolhimento encontrado com este telefone.' });
        }
      } else {
        throw new Error(json.error || 'Erro ao buscar visitantes');
      }
    } catch (err: any) {
      setMensagem({ tipo: 'erro', texto: err.message });
    } finally {
      setBuscandoVisitantes(false);
    }
  };

  // Abrir Modal de Criação
  const abrirNovoParticipante = () => {
    setParticipanteEdicao(null);
    setOrigemVinculo('membro');
    setMembroSelecionado(null);
    setVisitanteSelecionado(null);
    setBuscaMembro('');
    setBuscaVisitanteTel('');
    setFormPart({
      celula_id: celulas[0]?.id || '',
      congregacao_id: celulas[0]?.congregacao_id || congregacoes[0]?.id || '',
      member_id: null,
      nome_completo: '',
      email: '',
      telefone: '',
      papel: 'membro',
      status: 'ativo',
      data_ingresso: new Date().toISOString().slice(0, 10),
    });
    setModalParticipanteAberto(true);
  };

  // Abrir Modal de Edição
  const abrirEditarParticipante = (p: CelulaParticipanteItem) => {
    setParticipanteEdicao(p);
    setOrigemVinculo(p.member_id ? 'membro' : 'manual');
    setMembroSelecionado(p.member_id ? {
      id: p.member_id,
      name: p.nome_completo,
      email: p.email || undefined,
      phone: p.telefone || undefined,
    } : null);
    setFormPart({
      id: p.id,
      celula_id: p.celula_id,
      congregacao_id: p.congregacao_id || '',
      member_id: p.member_id || null,
      nome_completo: p.nome_completo,
      email: p.email || '',
      telefone: p.telefone || '',
      papel: p.papel,
      status: p.status,
      data_ingresso: p.data_ingresso,
    });
    setModalParticipanteAberto(true);
  };

  // Salvar Participante
  const salvarParticipante = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formPart.celula_id) {
      setMensagem({ tipo: 'erro', texto: 'Selecione a célula vinculada.' });
      return;
    }
    if (!formPart.nome_completo.trim()) {
      setMensagem({ tipo: 'erro', texto: 'O nome completo é obrigatório.' });
      return;
    }

    try {
      setSalvando(true);
      const payload: SalvarParticipanteInput = {
        ...(formPart.id ? { id: formPart.id } : {}),
        celula_id: formPart.celula_id,
        congregacao_id: formPart.congregacao_id || null,
        member_id: formPart.member_id || null,
        nome_completo: formPart.nome_completo.trim(),
        email: formPart.email?.trim() || null,
        telefone: formPart.telefone?.trim() || null,
        papel: formPart.papel,
        status: formPart.status,
        data_ingresso: formPart.data_ingresso,
      };

      const res = await authenticatedFetch('/api/v1/celulas/participantes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Erro ao salvar participante.');
      }

      setMensagem({
        tipo: 'sucesso',
        texto: formPart.id ? 'Vínculo do participante atualizado com sucesso!' : 'Participante adicionado à célula com sucesso!'
      });
      setModalParticipanteAberto(false);
      carregarParticipantes();
    } catch (err: any) {
      setMensagem({ tipo: 'erro', texto: err.message });
    } finally {
      setSalvando(false);
    }
  };

  // Abrir Transferência
  const abrirTransferencia = (p: CelulaParticipanteItem) => {
    setParticipanteParaTransferir(p);
    setFormTransf({
      participante_id: p.id,
      celula_destino_id: celulas.find(c => c.id !== p.celula_id)?.id || '',
      motivo: '',
    });
    setModalTransfAberto(true);
  };

  // Confirmar Transferência
  const executarTransferencia = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTransf.celula_destino_id) {
      setMensagem({ tipo: 'erro', texto: 'Selecione a célula de destino.' });
      return;
    }

    try {
      setTransferindo(true);
      const res = await authenticatedFetch('/api/v1/celulas/transferencias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formTransf),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Erro ao realizar transferência.');
      }

      setMensagem({
        tipo: 'sucesso',
        texto: `Participante transferido com sucesso! O histórico foi registrado para auditoria.`
      });
      setModalTransfAberto(false);
      setParticipanteParaTransferir(null);
      carregarParticipantes();
      if (subAba === 'historico') carregarTransferencias();
    } catch (err: any) {
      setMensagem({ tipo: 'erro', texto: err.message });
    } finally {
      setTransferindo(false);
    }
  };

  // Excluir Vínculo
  const confirmarExclusao = async () => {
    if (!participanteExcluir) return;
    try {
      setExcluindo(true);
      const res = await authenticatedFetch(`/api/v1/celulas/participantes?id=${participanteExcluir.id}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Erro ao remover vínculo do participante.');
      }
      setMensagem({ tipo: 'sucesso', texto: 'Participante desvinculado com sucesso!' });
      setModalExcluirAberto(false);
      setParticipanteExcluir(null);
      carregarParticipantes();
    } catch (err: any) {
      setMensagem({ tipo: 'erro', texto: err.message });
    } finally {
      setExcluindo(false);
    }
  };

  // Filtragem local por papel e busca adicional
  const participantesFiltrados = participantes.filter(p => {
    if (filtroPapel !== 'todos' && p.papel !== filtroPapel) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Feedback Mensagem */}
      {mensagem && (
        <div
          className={`flex items-center justify-between p-4 rounded-xl text-xs sm:text-sm font-medium border shadow-2xs ${
            mensagem.tipo === 'sucesso'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {mensagem.tipo === 'sucesso' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-rose-600" />}
            <span>{mensagem.texto}</span>
          </div>
          <button onClick={() => setMensagem(null)} className="text-xs font-bold underline hover:opacity-80 cursor-pointer">
            Fechar
          </button>
        </div>
      )}

      {/* Sub-abas: Lista de Participantes vs Histórico de Transferências */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center bg-slate-200/70 p-1 rounded-xl w-fit">
          <button
            type="button"
            onClick={() => setSubAba('lista')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              subAba === 'lista'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Participantes ({participantesFiltrados.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setSubAba('historico')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              subAba === 'historico'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            <span>Histórico de Transferências</span>
          </button>
        </div>

        <button
          type="button"
          onClick={abrirNovoParticipante}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-700 rounded-xl transition text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-sm cursor-pointer"
        >
          <UserPlus size={16} className="text-white" />
          <span>+ Vincular Participante</span>
        </button>
      </div>

      {subAba === 'lista' && (
        <div className="space-y-4">
          {/* Barra de Filtros */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs flex flex-wrap items-center gap-3">
            {/* Busca por texto */}
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por nome, email ou telefone..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && carregarParticipantes()}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-teal-600 focus:bg-white transition"
              />
            </div>

            {/* Filtro por Célula */}
            <div className="min-w-[180px]">
              <select
                value={filtroCelula}
                onChange={(e) => setFiltroCelula(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-600 cursor-pointer"
              >
                <option value="todas">Todas as {termoCelula}s</option>
                {celulas.map(c => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </div>

            {/* Filtro por Papel */}
            <div className="min-w-[150px]">
              <select
                value={filtroPapel}
                onChange={(e) => setFiltroPapel(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-600 cursor-pointer"
              >
                <option value="todos">Todos os Papéis</option>
                {Object.entries(PAPEIS_MAP).map(([key, val]) => (
                  <option key={key} value={key}>{val.label}</option>
                ))}
              </select>
            </div>

            {/* Filtro por Situação */}
            <div className="min-w-[140px]">
              <select
                value={filtroStatus}
                onChange={(e) => setFiltroStatus(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-600 cursor-pointer"
              >
                <option value="todos">Todos os Status</option>
                <option value="ativo">Somente Ativos</option>
                <option value="inativo">Inativos</option>
                <option value="transferido">Transferidos</option>
                <option value="desligado">Desligados</option>
              </select>
            </div>

            <button
              type="button"
              onClick={carregarParticipantes}
              className="p-2.5 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
              title="Atualizar listagem"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Tabela de Participantes */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
            {loading ? (
              <div className="p-12 text-center text-slate-500 font-medium flex flex-col items-center gap-3">
                <RefreshCw className="w-8 h-8 animate-spin text-teal-600" />
                <span>Carregando participantes...</span>
              </div>
            ) : participantesFiltrados.length === 0 ? (
              <div className="p-12 text-center text-slate-500 font-medium flex flex-col items-center gap-2">
                <Users className="w-10 h-10 text-slate-300" />
                <span className="text-sm font-semibold text-slate-700">Nenhum participante encontrado</span>
                <span className="text-xs text-slate-500 max-w-sm">
                  Utilize o botão acima para vincular membros ou visitantes a uma {termoCelula.toLowerCase()}.
                </span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-slate-50 text-slate-600 uppercase text-[11px] font-bold border-b border-slate-200/80 tracking-wider">
                    <tr>
                      <th className="py-3.5 px-4">Participante</th>
                      <th className="py-3.5 px-4">{termoCelula} & Congregação</th>
                      <th className="py-3.5 px-4">Papel</th>
                      <th className="py-3.5 px-4">Situação</th>
                      <th className="py-3.5 px-4">Ingresso</th>
                      <th className="py-3.5 px-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-800">
                    {participantesFiltrados.map((p) => {
                      const papelInfo = PAPEIS_MAP[p.papel] || { label: p.papel, cor: 'bg-slate-100 text-slate-700' };
                      const statusInfo = STATUS_MAP[p.status] || { label: p.status, cor: 'bg-slate-100 text-slate-700' };

                      return (
                        <tr key={p.id} className="hover:bg-slate-50/70 transition">
                          <td className="py-3.5 px-4">
                            <div className="flex flex-col">
                              <span className="font-bold text-slate-900 flex items-center gap-1.5">
                                {p.nome_completo}
                                {p.member_id && (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200" title="Membro Oficial">
                                    Membro
                                  </span>
                                )}
                              </span>
                              <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                                {p.telefone && (
                                  <span className="flex items-center gap-1">
                                    <Phone className="w-3 h-3 text-slate-400" />
                                    {p.telefone}
                                  </span>
                                )}
                                {p.email && (
                                  <span className="flex items-center gap-1">
                                    <Mail className="w-3 h-3 text-slate-400" />
                                    {p.email}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex flex-col">
                              <span className="font-semibold text-slate-800">
                                {p.celula?.nome || 'Sem Célula'}
                              </span>
                              <span className="text-xs text-slate-500">
                                {p.congregacao?.nome || 'Sede'}
                              </span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${papelInfo.cor}`}>
                              {papelInfo.label}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${statusInfo.cor}`}>
                              {statusInfo.label}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-xs text-slate-600">
                            {p.data_ingresso ? new Date(p.data_ingresso + 'T12:00:00Z').toLocaleDateString('pt-BR') : '-'}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {p.status === 'ativo' && (
                                <button
                                  type="button"
                                  onClick={() => abrirTransferencia(p)}
                                  className="px-2.5 py-1 text-xs font-bold text-teal-700 hover:text-teal-900 bg-teal-50 hover:bg-teal-100 rounded-lg border border-teal-200 transition flex items-center gap-1 cursor-pointer"
                                  title="Transferir para outra célula"
                                >
                                  <ArrowRightLeft className="w-3 h-3" />
                                  <span>Transferir</span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => abrirEditarParticipante(p)}
                                className="px-2.5 py-1 text-xs font-medium text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition cursor-pointer"
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setParticipanteExcluir(p);
                                  setModalExcluirAberto(true);
                                }}
                                className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                                title="Remover participante"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {subAba === 'historico' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200/80 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Rastreabilidade de Transferências</h3>
                <p className="text-xs text-slate-500">Histórico cronológico de movimentação de participantes entre {termoCelula.toLowerCase()}s</p>
              </div>
              <button
                type="button"
                onClick={carregarTransferencias}
                className="p-2 text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingTransf ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {loadingTransf ? (
              <div className="p-12 text-center text-slate-500 font-medium flex flex-col items-center gap-3">
                <RefreshCw className="w-8 h-8 animate-spin text-teal-600" />
                <span>Carregando histórico...</span>
              </div>
            ) : transferencias.length === 0 ? (
              <div className="p-12 text-center text-slate-500 font-medium flex flex-col items-center gap-2">
                <ArrowRightLeft className="w-10 h-10 text-slate-300" />
                <span className="text-sm font-semibold text-slate-700">Nenhuma transferência registrada</span>
                <span className="text-xs text-slate-500">Quando participantes forem transferidos entre células, os registros auditáveis aparecerão aqui.</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-slate-50 text-slate-600 uppercase text-[11px] font-bold border-b border-slate-200/80">
                    <tr>
                      <th className="py-3 px-4">Data/Hora</th>
                      <th className="py-3 px-4">Participante</th>
                      <th className="py-3 px-4">Origem</th>
                      <th className="py-3 px-4">Destino</th>
                      <th className="py-3 px-4">Motivo Informado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-800">
                    {transferencias.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-3 px-4 text-xs text-slate-600 whitespace-nowrap">
                          {new Date(t.data_transferencia).toLocaleString('pt-BR')}
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-900">
                          {t.participante?.nome_completo || 'Participante'}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-xs font-medium">
                            {t.celula_origem?.nome || 'Célula de Origem'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold">
                            {t.celula_destino?.nome || 'Célula de Destino'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-600 italic">
                          {t.motivo || 'Transferência ministerial de rotina'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Vincular / Editar Participante */}
      {modalParticipanteAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full shadow-2xl overflow-hidden my-8 animate-in fade-in duration-200">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-teal-100 text-teal-800 rounded-xl">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {formPart.id ? 'Editar Participante' : 'Vincular Participante'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Gestão de membros e integrantes da {termoCelula.toLowerCase()}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalParticipanteAberto(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={salvarParticipante} className="p-6 space-y-4">
              {/* Seleção de Origem do Vínculo */}
              {!formPart.id && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Origem do Participante
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setOrigemVinculo('membro');
                        setFormPart(prev => ({ ...prev, member_id: null, nome_completo: '', email: '', telefone: '' }));
                      }}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition flex flex-col items-center gap-1 cursor-pointer ${
                        origemVinculo === 'membro'
                          ? 'bg-teal-50 border-teal-600 text-teal-900 shadow-2xs'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <UserCheck className="w-4 h-4 text-teal-700" />
                      <span>Membro Existente</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setOrigemVinculo('visitante');
                        setFormPart(prev => ({ ...prev, member_id: null, nome_completo: '', email: '', telefone: '', papel: 'visitante_regular' }));
                      }}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition flex flex-col items-center gap-1 cursor-pointer ${
                        origemVinculo === 'visitante'
                          ? 'bg-purple-50 border-purple-600 text-purple-900 shadow-2xs'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <HeartHandshake className="w-4 h-4 text-purple-700" />
                      <span>Acolhimento</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setOrigemVinculo('manual');
                        setFormPart(prev => ({ ...prev, member_id: null, nome_completo: '', email: '', telefone: '' }));
                      }}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition flex flex-col items-center gap-1 cursor-pointer ${
                        origemVinculo === 'manual'
                          ? 'bg-blue-50 border-blue-600 text-blue-900 shadow-2xs'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <Users className="w-4 h-4 text-blue-700" />
                      <span>Avulso / Externo</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Busca de Membro com Autocomplete */}
              {origemVinculo === 'membro' && !formPart.id && (
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/90 space-y-2">
                  <label className="block text-xs font-bold text-slate-800">
                    Localizar Membro Cadastrado
                  </label>
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Digite o nome ou CPF do membro..."
                      value={buscaMembro}
                      onChange={(e) => setBuscaMembro(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
                    />
                    {buscandoMembros && (
                      <RefreshCw className="w-4 h-4 text-teal-600 animate-spin absolute right-3 top-1/2 -translate-y-1/2" />
                    )}
                  </div>

                  {membrosEncontrados.length > 0 && (
                    <div className="max-h-40 overflow-y-auto divide-y divide-slate-100 bg-white border border-slate-200 rounded-lg shadow-sm">
                      {membrosEncontrados.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            setMembroSelecionado(m);
                            setFormPart(prev => ({
                              ...prev,
                              member_id: m.id,
                              nome_completo: m.name,
                              email: m.email || '',
                              telefone: m.phone || '',
                            }));
                            setMembrosEncontrados([]);
                            setBuscaMembro(m.name);
                          }}
                          className="w-full text-left p-2.5 hover:bg-teal-50 transition flex items-center justify-between cursor-pointer"
                        >
                          <div>
                            <span className="font-bold text-xs text-slate-900 block">{m.name}</span>
                            <span className="text-[11px] text-slate-500">
                              {m.cpf ? `CPF: ${m.cpf}` : ''} {m.phone ? `• Tel: ${m.phone}` : ''}
                            </span>
                          </div>
                          <span className="text-xs text-teal-700 font-bold">Selecionar</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {membroSelecionado && (
                    <div className="p-2.5 bg-emerald-50 rounded-lg border border-emerald-200 text-xs flex items-center justify-between">
                      <span className="text-emerald-800 font-bold">
                        ✓ Selecionado: {membroSelecionado.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setMembroSelecionado(null);
                          setBuscaMembro('');
                          setFormPart(prev => ({ ...prev, member_id: null, nome_completo: '', email: '', telefone: '' }));
                        }}
                        className="text-emerald-700 hover:text-emerald-900 font-bold underline cursor-pointer"
                      >
                        Trocar
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Busca de Visitante de Acolhimento */}
              {origemVinculo === 'visitante' && !formPart.id && (
                <div className="p-3.5 bg-purple-50/70 rounded-xl border border-purple-200/90 space-y-2">
                  <label className="block text-xs font-bold text-purple-950">
                    Buscar Visitante do Acolhimento por Telefone
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Telefone (DDD + número)..."
                      value={buscaVisitanteTel}
                      onChange={(e) => setBuscaVisitanteTel(e.target.value)}
                      className="flex-1 px-3 py-2 bg-white border border-purple-200 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-purple-600"
                    />
                    <button
                      type="button"
                      onClick={buscarVisitantesAcolhimento}
                      disabled={buscandoVisitantes}
                      className="px-3.5 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {buscandoVisitantes ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                      <span>Buscar</span>
                    </button>
                  </div>

                  {visitantesEncontrados.length > 0 && (
                    <div className="max-h-36 overflow-y-auto divide-y divide-purple-100 bg-white border border-purple-200 rounded-lg shadow-sm">
                      {visitantesEncontrados.map((v) => (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => {
                            setVisitanteSelecionado(v);
                            setFormPart(prev => ({
                              ...prev,
                              nome_completo: v.nome,
                              telefone: v.telefone || '',
                              papel: 'visitante_regular',
                            }));
                            setVisitantesEncontrados([]);
                          }}
                          className="w-full text-left p-2.5 hover:bg-purple-50 transition flex items-center justify-between cursor-pointer"
                        >
                          <div>
                            <span className="font-bold text-xs text-purple-950 block">{v.nome}</span>
                            <span className="text-[11px] text-purple-600">
                              Tel: {v.telefone || 'Não informado'} {v.cidade ? `• ${v.cidade}` : ''}
                            </span>
                          </div>
                          <span className="text-xs text-purple-700 font-bold">Importar</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {visitanteSelecionado && (
                    <div className="p-2.5 bg-purple-100/70 rounded-lg border border-purple-300 text-xs flex items-center justify-between">
                      <span className="text-purple-900 font-bold">
                        ✓ Importado: {visitanteSelecionado.nome}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setVisitanteSelecionado(null);
                          setFormPart(prev => ({ ...prev, nome_completo: '', telefone: '' }));
                        }}
                        className="text-purple-700 hover:text-purple-900 font-bold underline cursor-pointer"
                      >
                        Limpar
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Campos do Participante */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nome Completo <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formPart.nome_completo}
                  onChange={(e) => setFormPart(prev => ({ ...prev, nome_completo: e.target.value }))}
                  placeholder="Nome do integrante"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal-600 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Telefone / WhatsApp</label>
                  <input
                    type="text"
                    value={formPart.telefone || ''}
                    onChange={(e) => setFormPart(prev => ({ ...prev, telefone: e.target.value }))}
                    placeholder="(00) 00000-0000"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-teal-600 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">E-mail</label>
                  <input
                    type="email"
                    value={formPart.email || ''}
                    onChange={(e) => setFormPart(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="email@exemplo.com"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-teal-600 focus:bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {termoCelula} Vinculada <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={formPart.celula_id}
                    onChange={(e) => {
                      const cId = e.target.value;
                      const c = celulas.find(item => item.id === cId);
                      setFormPart(prev => ({
                        ...prev,
                        celula_id: cId,
                        congregacao_id: c?.congregacao_id || prev.congregacao_id,
                      }));
                    }}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-teal-600 focus:bg-white cursor-pointer"
                  >
                    <option value="">Selecione...</option>
                    {celulas.map(c => (
                      <option key={c.id} value={c.id}>{c.nome}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Papel na {termoCelula}</label>
                  <select
                    value={formPart.papel}
                    onChange={(e) => setFormPart(prev => ({ ...prev, papel: e.target.value as CelulaPapelParticipante }))}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-teal-600 focus:bg-white cursor-pointer"
                  >
                    {Object.entries(PAPEIS_MAP).map(([key, val]) => (
                      <option key={key} value={key}>{val.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Situação do Vínculo</label>
                  <select
                    value={formPart.status}
                    onChange={(e) => setFormPart(prev => ({ ...prev, status: e.target.value as CelulaParticipanteStatus }))}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-teal-600 focus:bg-white cursor-pointer"
                  >
                    <option value="ativo">Ativo</option>
                    <option value="inativo">Inativo</option>
                    <option value="transferido">Transferido</option>
                    <option value="desligado">Desligado</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Data de Ingresso</label>
                  <input
                    type="date"
                    value={formPart.data_ingresso}
                    onChange={(e) => setFormPart(prev => ({ ...prev, data_ingresso: e.target.value }))}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-teal-600 focus:bg-white"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setModalParticipanteAberto(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvando}
                  className="px-5 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {salvando ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <UserCheck className="w-3.5 h-3.5" />}
                  <span>{formPart.id ? 'Salvar Alterações' : 'Concluir Vínculo'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Transferência de Célula */}
      {modalTransfAberto && participanteParaTransferir && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full shadow-2xl overflow-hidden animate-in fade-in duration-200">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-100 text-amber-800 rounded-xl">
                  <ArrowRightLeft className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Transferir Participante</h3>
                  <p className="text-xs text-slate-500">Mudar integrante para outra {termoCelula.toLowerCase()}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalTransfAberto(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/60 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={executarTransferencia} className="p-6 space-y-4">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
                <span className="text-slate-500 block">Participante:</span>
                <span className="font-bold text-slate-900 text-sm block">
                  {participanteParaTransferir.nome_completo}
                </span>
                <span className="text-slate-600 block mt-1">
                  Célula Atual: <strong>{participanteParaTransferir.celula?.nome || 'Célula de Origem'}</strong>
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nova {termoCelula} de Destino <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={formTransf.celula_destino_id}
                  onChange={(e) => setFormTransf(prev => ({ ...prev, celula_destino_id: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-teal-600 focus:bg-white cursor-pointer"
                >
                  <option value="">Selecione a célula destino...</option>
                  {celulas
                    .filter(c => c.id !== participanteParaTransferir.celula_id)
                    .map(c => (
                      <option key={c.id} value={c.id}>{c.nome}</option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Motivo da Transferência</label>
                <textarea
                  rows={3}
                  value={formTransf.motivo || ''}
                  onChange={(e) => setFormTransf(prev => ({ ...prev, motivo: e.target.value }))}
                  placeholder="Ex: Mudança de endereço, compatibilidade de horários, solicitação pastoral..."
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-teal-600 focus:bg-white"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setModalTransfAberto(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={transferindo}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {transferindo ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ArrowRightLeft className="w-3.5 h-3.5" />}
                  <span>Confirmar Transferência</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Confirmar Exclusão */}
      {modalExcluirAberto && participanteExcluir && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-sm w-full p-6 shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-base font-bold text-slate-900">Remover Participante?</h4>
              <p className="text-xs text-slate-500 mt-1">
                Deseja realmente remover o vínculo de <strong>{participanteExcluir.nome_completo}</strong> com a {termoCelula.toLowerCase()}?
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModalExcluirAberto(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarExclusao}
                disabled={excluindo}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                {excluindo ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>Remover</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
