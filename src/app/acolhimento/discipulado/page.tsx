'use client';

/**
 * /acolhimento/discipulado — Central de Acolhimento e Acompanhamento do Discipulado (Fase 1)
 *
 * Características da Implementação:
 * 1. Formulário Inteligente de Conversão:
 *    - Entrada prioritária por Telefone para buscar visitante no Acolhimento (culto_visitantes).
 *    - Se encontrado, preenche automaticamente Nome, Cidade, Bairro e Congregação.
 *    - Solicitação obrigatória do CPF com validação matemática oficial da Secretaria.
 *    - Consulta duplicidade em members: se já existir, vincula sem duplicar; se for Membro ou Ministro, não rebaixa.
 * 2. Transacional e Seguro:
 *    - Marca converted_to_member_id e converted_at no registro do visitante (SEM usar deleted_at).
 *    - Cria a jornada em discipulado_jornadas (garantindo apenas 1 ativa por membro).
 * 3. Listagem e Acompanhamento das Jornadas com filtros por Fase e Status.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import PageLayout from '@/components/PageLayout';
import Section from '@/components/Section';
import NotificationModal from '@/components/NotificationModal';
import ExecutiveMetricCard from '@/components/dashboard/ExecutiveMetricCard';
import { useRequireModulo } from '@/hooks/useRequireModulo';
import { createClient } from '@/lib/supabase-client';
import {
  Users,
  Search,
  PlusCircle,
  CheckCircle2,
  Loader2,
  Phone,
  UserCheck,
  Sparkles,
  ShieldCheck,
  RefreshCw,
  X,
  Compass,
} from 'lucide-react';

function formatPhone(v: string | null | undefined): string {
  if (!v) return 'Não informado';
  const digits = v.replace(/\D/g, '');
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return v;
}

function formatCpf(v: string | null | undefined): string {
  if (!v) return 'Não informado';
  const digits = v.replace(/\D/g, '');
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  }
  return v;
}

export interface JornadaItem {
  id: string;
  fase: string;
  status: string;
  data_decisao: string;
  data_inicio: string;
  data_conclusao?: string | null;
  observacoes?: string | null;
  created_at: string;
  member: {
    id: string;
    name: string;
    cpf: string | null;
    phone: string | null;
    celular: string | null;
    whatsapp: string | null;
    tipo_cadastro: string | null;
    status: string | null;
    foto_url: string | null;
  } | null;
  responsavel?: {
    id: string;
    name: string;
  } | null;
  congregacao?: {
    id: string;
    nome: string;
  } | null;
}

export interface VisitanteSugestao {
  id: string;
  nome: string;
  telefone: string | null;
  cidade: string | null;
  bairro: string | null;
  igreja_origem: string | null;
  congregacao_id: string | null;
  congregacao_nome?: string | null;
}

const FASE_LABELS: Record<string, { label: string; badgeColor: string }> = {
  primeiros_passos: { label: 'Primeiros Passos', badgeColor: 'bg-blue-50 text-blue-700 border-blue-200' },
  fundamentos: { label: 'Fundamentos', badgeColor: 'bg-purple-50 text-purple-700 border-purple-200' },
  preparacao_batismo: { label: 'Candidato ao Batismo', badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  integracao: { label: 'Integração Ministerial', badgeColor: 'bg-amber-50 text-amber-700 border-amber-200' },
};

const STATUS_LABELS: Record<string, { label: string; dotColor: string }> = {
  ativo: { label: 'Em Andamento', dotColor: 'bg-emerald-500' },
  concluido: { label: 'Concluído', dotColor: 'bg-blue-500' },
  pausado: { label: 'Pausado', dotColor: 'bg-amber-500' },
  desistente: { label: 'Desistente', dotColor: 'bg-rose-500' },
};

export default function DiscipuladoPage() {
  const { ctx } = useRequireModulo('secretaria_local');
  const supabase = useMemo(() => createClient(), []);

  const [activeTab, setActiveTab] = useState<'jornadas' | 'nova_jornada'>('jornadas');
  const [jornadas, setJornadas] = useState<JornadaItem[]>([]);
  const [loading, setLoading] = useState(true);
  

  // Filtros
  const [filtroStatus, setFiltroStatus] = useState<string>('ativo');
  const [filtroFase, setFiltroFase] = useState<string>('todas');
  const [buscaTexto, setBuscaTexto] = useState<string>('');

  // Estados do Formulário de Entrada
  const [telInput, setTelInput] = useState('');
  const [buscandoVisitante, setBuscandoVisitante] = useState(false);
  const [visitantesEncontrados, setVisitantesEncontrados] = useState<VisitanteSugestao[]>([]);
  const [visitanteSelecionado, setVisitanteSelecionado] = useState<VisitanteSugestao | null>(null);

  // Dados Cadastrais (Secretaria)
  const [cpfInput, setCpfInput] = useState('');
  const [nomeInput, setNomeInput] = useState('');
  const [nascimentoInput, setNascimentoInput] = useState('');
  const [sexoInput, setSexoInput] = useState<'M' | 'F' | 'outro'>('M');
  const [bairroInput, setBairroInput] = useState('');
  const [cidadeInput, setCidadeInput] = useState('');
  const [dataDecisaoInput, setDataDecisaoInput] = useState(new Date().toISOString().slice(0, 10));
  const [observacoesInput, setObservacoesInput] = useState('');
  const [salvando, setSalvando] = useState(false);

  // Notificações
  const [modalNotify, setModalNotify] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'success' as 'success' | 'error' | 'warning' | 'info',
  });

  const showNotification = (
    type: 'success' | 'error' | 'warning' | 'info',
    title: string,
    message: string
  ) => {
    setModalNotify({ isOpen: true, type, title, message });
  };

  // Carregar jornadas de discipulado
  const loadJornadas = useCallback(async () => {
    if (!ctx?.ministryId) return;
    setLoading(true);
    
    try {
      let query = supabase
        .from('discipulado_jornadas')
        .select(`
          id, fase, status, data_decisao, data_inicio, data_conclusao, observacoes, created_at,
          member:members (
            id, name, cpf, phone, celular, whatsapp, tipo_cadastro, status, foto_url
          ),
          responsavel:members (
            id, name
          ),
          congregacao:congregacoes (
            id, nome
          )
        `)
        .eq('ministry_id', ctx.ministryId)
        .order('created_at', { ascending: false });

      if (filtroStatus !== 'todos') {
        query = query.eq('status', filtroStatus);
      }
      if (filtroFase !== 'todas') {
        query = query.eq('fase', filtroFase);
      }

      const { data, error } = await query;
      if (error) throw error;
      setJornadas((data || []) as unknown as JornadaItem[]);
    } catch (err: any) {
      console.error('[loadJornadas]', err);
      
    } finally {
      setLoading(false);
    }
  }, [ctx?.ministryId, filtroStatus, filtroFase, supabase]);

  useEffect(() => {
    if (!ctx?.loading && ctx?.ministryId) {
      loadJornadas();
    }
  }, [ctx?.loading, ctx?.ministryId, loadJornadas]);

  // Busca rápida de visitante por telefone
  const handleBuscarTelefone = async () => {
    const cleanTel = telInput.replace(/\D/g, '');
    if (!cleanTel || cleanTel.length < 8) {
      showNotification('warning', 'Atenção', 'Informe ao menos 8 dígitos do telefone com DDD para pesquisar.');
      return;
    }

    setBuscandoVisitante(true);
    setVisitantesEncontrados([]);
    try {
      const res = await fetch(`/api/v1/discipulado/visitantes?telefone=${encodeURIComponent(cleanTel)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro na pesquisa.');

      const list: VisitanteSugestao[] = data.visitantes || [];
      setVisitantesEncontrados(list);

      if (list.length === 1) {
        selecionarVisitante(list[0]);
      } else if (list.length === 0) {
        showNotification(
          'info',
          'Visitante não localizado',
          'Nenhum visitante ativo encontrado com este telefone no Acolhimento. Você pode preencher os dados diretamente.'
        );
      }
    } catch (err: any) {
      showNotification('error', 'Erro', err?.message || 'Falha ao buscar visitantes.');
    } finally {
      setBuscandoVisitante(false);
    }
  };

  const selecionarVisitante = (v: VisitanteSugestao) => {
    setVisitanteSelecionado(v);
    setNomeInput(v.nome);
    setBairroInput(v.bairro || '');
    setCidadeInput(v.cidade || '');
    if (v.telefone) setTelInput(formatPhone(v.telefone));
  };

  const limparVisitanteSelecionado = () => {
    setVisitanteSelecionado(null);
  };

  // Salvar / Iniciar Jornada de Discipulado
  const handleSalvarJornada = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ctx?.ministryId) return;

    const cleanCpf = cpfInput.replace(/\D/g, '');
    if (cleanCpf.length !== 11) {
      showNotification('warning', 'CPF Obrigatório', 'Informe um CPF válido com 11 dígitos para o cadastro oficial da Secretaria.');
      return;
    }

    if (!nomeInput.trim()) {
      showNotification('warning', 'Nome Obrigatório', 'Informe o nome do novo convertido.');
      return;
    }

    setSalvando(true);
    try {
      const res = await fetch('/api/v1/discipulado/jornadas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telefone: telInput.replace(/\D/g, '') || null,
          cpf: cleanCpf,
          nome: nomeInput.trim(),
          data_nascimento: nascimentoInput || null,
          sexo: sexoInput,
          bairro: bairroInput.trim() || null,
          cidade: cidadeInput.trim() || null,
          congregacao_id: visitanteSelecionado?.congregacao_id || ctx.congregacaoId || null,
          visitante_id: visitanteSelecionado?.id || null,
          data_decisao: dataDecisaoInput,
          observacoes: observacoesInput.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao registrar jornada de discipulado.');
      }

      showNotification('success', 'Jornada Iniciada', data.mensagem || 'Jornada de discipulado iniciada com sucesso!');

      // Reset form
      setTelInput('');
      setCpfInput('');
      setNomeInput('');
      setBairroInput('');
      setCidadeInput('');
      setObservacoesInput('');
      setVisitanteSelecionado(null);
      setVisitantesEncontrados([]);

      await loadJornadas();
      setActiveTab('jornadas');
    } catch (err: any) {
      showNotification('error', 'Falha no Cadastro', err?.message || 'Erro ao salvar novo discípulo.');
    } finally {
      setSalvando(false);
    }
  };

  // Filtragem local por texto
  const jornadasFiltradas = useMemo(() => {
    if (!buscaTexto.trim()) return jornadas;
    const q = buscaTexto.toLowerCase();
    return jornadas.filter((j) => {
      const nome = j.member?.name?.toLowerCase() || '';
      const cpf = j.member?.cpf || '';
      const tel = j.member?.phone || j.member?.celular || '';
      return nome.includes(q) || cpf.includes(q) || tel.includes(q);
    });
  }, [jornadas, buscaTexto]);

  const metricas = useMemo(() => {
    const totalAtivos = jornadas.filter((j) => j.status === 'ativo').length;
    const totalPrimeirosPassos = jornadas.filter((j) => j.fase === 'primeiros_passos' && j.status === 'ativo').length;
    const totalBatismo = jornadas.filter((j) => j.fase === 'preparacao_batismo' && j.status === 'ativo').length;
    const totalConcluidos = jornadas.filter((j) => j.status === 'concluido').length;
    return { totalAtivos, totalPrimeirosPassos, totalBatismo, totalConcluidos };
  }, [jornadas]);

  return (
    <PageLayout
      title="Discipulado & Acompanhamento"
      description="Acolhimento de novos convertidos, validação na secretaria e acompanhamento espiritual"
    >
      <div className="space-y-6">
        {/* Métricas do Módulo */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <ExecutiveMetricCard
            title="Discípulos Ativos"
            value={metricas.totalAtivos}
            subtitle="Em acompanhamento"
            icon={Users} color="blue"
          />
          <ExecutiveMetricCard
            title="Primeiros Passos"
            value={metricas.totalPrimeirosPassos}
            subtitle="Recém-convertidos"
            icon={Compass} color="indigo"
          />
          <ExecutiveMetricCard
            title="Candidatos ao Batismo"
            value={metricas.totalBatismo}
            subtitle="Preparação doutrinária"
            icon={Sparkles} color="emerald"
          />
          <ExecutiveMetricCard
            title="Jornadas Concluídas"
            value={metricas.totalConcluidos}
            subtitle="Membros integrados"
            icon={UserCheck} color="slate"
          />
        </div>

        {/* Abas Principais */}
        <div className="flex items-center justify-between border-b border-gray-200">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('jornadas')}
              className={`py-3 px-4 font-bold text-sm border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'jornadas'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Users size={16} />
              <span>Painel de Discípulos ({jornadas.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('nova_jornada')}
              className={`py-3 px-4 font-bold text-sm border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'nova_jornada'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <PlusCircle size={16} />
              <span>Novo Convertido / Iniciar Jornada</span>
            </button>
          </div>

          <button
            onClick={loadJornadas}
            disabled={loading}
            className="text-xs font-semibold text-gray-600 hover:text-blue-600 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition cursor-pointer"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin text-blue-600' : ''} />
            <span>Atualizar</span>
          </button>
        </div>

        {/* ─── ABA 1: PAINEL DE JORNADAS ─── */}
        {activeTab === 'jornadas' && (
          <Section title="Painel Geral de Discípulos">
            {/* Barra de Filtros */}
            <div className="p-4 bg-gray-50 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3">
              <div className="relative flex-1 min-w-[240px] max-w-md">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={buscaTexto}
                  onChange={(e) => setBuscaTexto(e.target.value)}
                  placeholder="Buscar discípulo por nome, CPF ou telefone..."
                  className="w-full pl-9 pr-3 py-2 text-xs border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={filtroStatus}
                  onChange={(e) => setFiltroStatus(e.target.value)}
                  className="text-xs border border-gray-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value="ativo">Status: Ativo</option>
                  <option value="concluido">Status: Concluído</option>
                  <option value="pausado">Status: Pausado</option>
                  <option value="desistente">Status: Desistente</option>
                  <option value="todos">Status: Todos</option>
                </select>

                <select
                  value={filtroFase}
                  onChange={(e) => setFiltroFase(e.target.value)}
                  className="text-xs border border-gray-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value="todas">Fase: Todas</option>
                  <option value="primeiros_passos">Primeiros Passos</option>
                  <option value="fundamentos">Fundamentos</option>
                  <option value="preparacao_batismo">Candidato ao Batismo</option>
                  <option value="integracao">Integração</option>
                </select>
              </div>
            </div>

            {/* Listagem */}
            {loading ? (
              <div className="py-16 text-center">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-2" />
                <p className="text-xs text-gray-500 font-medium">Carregando jornadas de discipulado...</p>
              </div>
            ) : jornadasFiltradas.length === 0 ? (
              <div className="py-16 text-center space-y-2">
                <Users className="w-12 h-12 text-gray-300 mx-auto" />
                <h3 className="text-sm font-bold text-gray-700">Nenhum discípulo encontrado</h3>
                <p className="text-xs text-gray-500 max-w-sm mx-auto">
                  Utilize a aba &quot;Novo Convertido / Iniciar Jornada&quot; para registrar conversões e acompanhar discípulos.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-100/70 border-b border-gray-200 text-gray-600 font-semibold uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Discípulo</th>
                      <th className="py-3 px-4">Contatos</th>
                      <th className="py-3 px-4">Fase Atual</th>
                      <th className="py-3 px-4">Data Decisão</th>
                      <th className="py-3 px-4">Congregação</th>
                      <th className="py-3 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {jornadasFiltradas.map((j) => {
                      const faseInfo = FASE_LABELS[j.fase] || { label: j.fase, badgeColor: 'bg-gray-100 text-gray-700' };
                      const statusInfo = STATUS_LABELS[j.status] || { label: j.status, dotColor: 'bg-gray-400' };

                      return (
                        <tr key={j.id} className="hover:bg-gray-50 transition">
                          <td className="py-3.5 px-4 font-bold text-gray-900">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0">
                                {j.member?.name ? j.member.name.slice(0, 2).toUpperCase() : 'ND'}
                              </div>
                              <div>
                                <span className="block font-bold">{j.member?.name || 'Não identificado'}</span>
                                <span className="text-[11px] text-gray-500 font-normal">
                                  CPF: {j.member?.cpf ? formatCpf(j.member.cpf) : '—'} • {j.member?.tipo_cadastro?.toUpperCase()}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-gray-600">
                            <span className="block font-medium">
                              {j.member?.phone || j.member?.celular ? formatPhone(j.member.phone || j.member.celular || '') : '—'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-semibold border ${faseInfo.badgeColor}`}>
                              {faseInfo.label}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-gray-600">
                            {j.data_decisao ? new Date(j.data_decisao).toLocaleDateString('pt-BR') : '—'}
                          </td>
                          <td className="py-3.5 px-4 text-gray-600">
                            {j.congregacao?.nome || 'Sede Geral'}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-700">
                              <span className={`w-2 h-2 rounded-full ${statusInfo.dotColor}`} />
                              {statusInfo.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        )}

        {/* ─── ABA 2: FORMULÁRIO DE ENTRADA DO DISCIPULADO ─── */}
        {activeTab === 'nova_jornada' && (
          <div className="max-w-3xl mx-auto space-y-6">
            {/* ETAPA 1: LOCALIZAR VISITANTE NO ACOLHIMENTO */}
            <Section title="1. Busca Inicial no Acolhimento por Telefone">
              <div className="p-5 space-y-4">
                <p className="text-xs text-gray-600 leading-relaxed">
                  Informe o telefone do novo convertido (anotado em ficha de culto). O sistema verifica se ele já esteve presente como visitante no <strong>Acolhimento</strong> para importar seus dados automaticamente.
                </p>

                <div className="flex gap-2 max-w-md">
                  <div className="relative flex-1">
                    <Phone className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={telInput}
                      onChange={(e) => setTelInput(formatPhone(e.target.value))}
                      placeholder="(00) 00000-0000"
                      className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 font-mono"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleBuscarTelefone}
                    disabled={buscandoVisitante}
                    className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition flex items-center gap-2 cursor-pointer disabled:opacity-60"
                  >
                    {buscandoVisitante ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                    <span>Pesquisar</span>
                  </button>
                </div>

                {/* Visitante Selecionado */}
                {visitanteSelecionado && (
                  <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-2xl flex items-center justify-between gap-3 animate-in fade-in">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-emerald-800">Visitante Identificado:</span>
                        <span className="text-xs font-extrabold text-emerald-950">{visitanteSelecionado.nome}</span>
                      </div>
                      <p className="text-[11px] text-emerald-700">
                        {visitanteSelecionado.bairro ? `${visitanteSelecionado.bairro}, ` : ''}{visitanteSelecionado.cidade || 'Local não informado'} • Congregação: {visitanteSelecionado.congregacao_nome || 'Geral'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={limparVisitanteSelecionado}
                      className="p-1.5 text-emerald-700 hover:text-emerald-900 rounded-lg hover:bg-emerald-100 transition"
                      title="Remover vínculo"
                    >
                      <X size={16} />
                    </button>
                  </div>
                )}

                {/* Lista de visitantes caso encontre mais de um */}
                {!visitanteSelecionado && visitantesEncontrados.length > 1 && (
                  <div className="space-y-2 pt-2 border-t border-gray-200">
                    <p className="text-xs font-bold text-gray-700">Selecione o visitante correspondente:</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {visitantesEncontrados.map((v) => (
                        <div
                          key={v.id}
                          onClick={() => selecionarVisitante(v)}
                          className="p-3 border border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50/50 cursor-pointer transition text-xs space-y-1"
                        >
                          <p className="font-bold text-gray-900">{v.nome}</p>
                          <p className="text-[11px] text-gray-500">{v.bairro || 'Sem bairro'} — {v.congregacao_nome || 'Geral'}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Section>

            {/* ETAPA 2: CADASTRO NA SECRETARIA & INÍCIO DA JORNADA */}
            <Section title="2. Registro Oficial na Secretaria & Jornada de Discipulado">
              <form onSubmit={handleSalvarJornada} className="p-5 space-y-4">
                <div className="bg-blue-50/80 p-3.5 rounded-xl border border-blue-200 text-xs text-blue-900 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
                    <span>Cadastro Oficial em members (Governança e Anti-Duplicidade)</span>
                  </div>
                  <p className="text-[11px] text-blue-800 leading-relaxed">
                    O CPF é validado matematicamente. Se a pessoa já for cadastrada, o cadastro existente é preservado e <strong>membros/ministros nunca são rebaixados</strong>. Se for inédita, é cadastrada como <strong>Congregado</strong>.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* CPF Obrigatório */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      CPF do Novo Convertido <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={cpfInput}
                      onChange={(e) => setCpfInput(formatCpf(e.target.value))}
                      placeholder="000.000.000-00"
                      className="w-full text-xs p-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 font-mono"
                    />
                  </div>

                  {/* Nome Completo */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Nome Completo <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={nomeInput}
                      onChange={(e) => setNomeInput(e.target.value)}
                      placeholder="Nome do novo convertido"
                      className="w-full text-xs p-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Data de Nascimento */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Data de Nascimento
                    </label>
                    <input
                      type="date"
                      value={nascimentoInput}
                      onChange={(e) => setNascimentoInput(e.target.value)}
                      className="w-full text-xs p-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Sexo */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Sexo
                    </label>
                    <select
                      value={sexoInput}
                      onChange={(e) => setSexoInput(e.target.value as any)}
                      className="w-full text-xs p-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="M">Masculino</option>
                      <option value="F">Feminino</option>
                      <option value="outro">Outro</option>
                    </select>
                  </div>

                  {/* Data da Decisão */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Data da Decisão <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={dataDecisaoInput}
                      onChange={(e) => setDataDecisaoInput(e.target.value)}
                      className="w-full text-xs p-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Bairro</label>
                    <input
                      type="text"
                      value={bairroInput}
                      onChange={(e) => setBairroInput(e.target.value)}
                      placeholder="Bairro"
                      className="w-full text-xs p-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Cidade</label>
                    <input
                      type="text"
                      value={cidadeInput}
                      onChange={(e) => setCidadeInput(e.target.value)}
                      placeholder="Cidade"
                      className="w-full text-xs p-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Observações Pastorais / Necessidades de Oração</label>
                  <textarea
                    rows={3}
                    value={observacoesInput}
                    onChange={(e) => setObservacoesInput(e.target.value)}
                    placeholder="Anotações pastorais sobre a decisão, histórico familiar, pedidos de oração..."
                    className="w-full text-xs p-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={salvando}
                    className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-60"
                  >
                    {salvando ? (
                      <>
                        <Loader2 size={15} className="animate-spin" />
                        <span>Processando conversão...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={15} />
                        <span>Confirmar & Iniciar Discipulado</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </Section>
          </div>
        )}
      </div>

      <NotificationModal
        isOpen={modalNotify.isOpen}
        title={modalNotify.title}
        message={modalNotify.message}
        type={modalNotify.type}
        onClose={() => setModalNotify({ ...modalNotify, isOpen: false })}
      />
    </PageLayout>
  );
}
