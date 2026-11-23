'use client';

import { useEffect, useState, useMemo } from 'react';
import { 
  Plus, Search, Home, Calendar, MapPin, 
  Settings, Network, ChevronRight, CheckCircle2, AlertCircle, RefreshCw, X,
  Users, Link as LinkIcon, Check, Clock, UserCheck, ShieldAlert,
  Copy, CalendarDays, FileText, BookOpen, ClipboardCheck, GitFork, MessageSquare
} from 'lucide-react';
import { 
  CelulaItem, CelulaRede, CelulaConfiguracao, SalvarCelulaInput,
  CelulaReuniaoItem, CelulaParticipanteItem, SalvarReuniaoInput, CelulaReuniaoStatus, CelulaParticipanteTipo,
  CelulaEstudoItem
} from '@/types/celulas';
import { authenticatedFetch } from '@/lib/api-client';
import { TabParticipantes } from '@/components/celulas/TabParticipantes';
import { TabEstudos } from '@/components/celulas/TabEstudos';
import { TabSupervisao } from '@/components/celulas/TabSupervisao';
import TabMultiplicacao from '@/components/celulas/TabMultiplicacao';
import { TabComunicacao } from '@/components/celulas/TabComunicacao';

const DIAS_SEMANA = [
  'Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira',
  'Quinta-feira', 'Sexta-feira', 'Sábado'
];

interface FormReuniaoState {
  id?: string;
  celula_id: string;
  congregacao_id?: string;
  data_reuniao: string;
  horario_inicio: string;
  horario_termino: string;
  modalidade: 'presencial' | 'online' | 'hibrida';
  status: CelulaReuniaoStatus;
  tema_estudo: string;
  observacoes: string;
  presentes_membros: number;
  presentes_visitantes: number;
  presentes_criancas: number;
  conversoes_decisoes: number;
  reconciliacoes: number;
  testemunhos: number;
  pedidos_oracao: number;
  valor_oferta: number;
  justificativa_edicao: string;
}

interface ItemFrequenciaForm {
  participante_id: string;
  member_id?: string | null;
  nome_participante: string;
  tipo_participante: CelulaParticipanteTipo;
  presente: boolean;
  justificativa_ausencia: string;
}

export default function CelulasPage() {
  const [abaAtiva, setAbaAtiva] = useState<'celulas' | 'reunioes' | 'participantes' | 'estudos' | 'supervisao' | 'multiplicacao' | 'comunicacao' | 'redes' | 'configuracoes'>('celulas');
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null);

  // Dados Gerais
  const [celulas, setCelulas] = useState<CelulaItem[]>([]);
  const [redes, setRedes] = useState<CelulaRede[]>([]);
  const [config, setConfig] = useState<CelulaConfiguracao | null>(null);
  const [congregacoes, setCongregacoes] = useState<{ id: string; nome: string }[]>([]);

  // Filtros Células
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [filtroRede, setFiltroRede] = useState('todas');
  const [filtroCongregacao, setFiltroCongregacao] = useState('todas');

  // Modal Célula
  const [modalCelulaAberto, setModalCelulaAberto] = useState(false);
  const [editandoCelulaId, setEditandoCelulaId] = useState<string | null>(null);
  const [formCelula, setFormCelula] = useState<SalvarCelulaInput>({
    nome: '',
    codigo: '',
    dia_semana: 3,
    horario: '20:00',
    modalidade: 'presencial',
    status: 'ativa',
    congregacao_id: '',
    rede_id: '',
    bairro: '',
    cidade: '',
    logradouro: '',
    numero: '',
    descricao: '',
  });

  // Modal Rede
  const [modalRedeAberto, setModalRedeAberto] = useState(false);
  const [formRede, setFormRede] = useState({ nome: '', descricao: '', cor: '#123b63' });

  // --------------------------------------------------------------------------
  // Estados para Reuniões & Frequência (Lote 2)
  // --------------------------------------------------------------------------
  const [reunioes, setReunioes] = useState<CelulaReuniaoItem[]>([]);
  const [loadingReunioes, setLoadingReunioes] = useState(false);
  const [filtroReuniaoCelula, setFiltroReuniaoCelula] = useState<string>('todas');
  const [filtroReuniaoStatus, setFiltroReuniaoStatus] = useState<string>('todos');
  const [filtroReuniaoDataInicio, setFiltroReuniaoDataInicio] = useState<string>('');
  const [filtroReuniaoDataFim, setFiltroReuniaoDataFim] = useState<string>('');

  // Modal Reunião (Criar / Editar)
  const [modalReuniaoAberto, setModalReuniaoAberto] = useState(false);
  const [reuniaoSendoEditada, setReuniaoSendoEditada] = useState<CelulaReuniaoItem | null>(null);
  const [estudosPublicados, setEstudosPublicados] = useState<CelulaEstudoItem[]>([]);
  const [formReuniao, setFormReuniao] = useState<FormReuniaoState>({
    celula_id: '',
    congregacao_id: '',
    data_reuniao: new Date().toISOString().slice(0, 10),
    horario_inicio: '20:00',
    horario_termino: '',
    modalidade: 'presencial',
    status: 'planejada',
    tema_estudo: '',
    observacoes: '',
    presentes_membros: 0,
    presentes_visitantes: 0,
    presentes_criancas: 0,
    conversoes_decisoes: 0,
    reconciliacoes: 0,
    testemunhos: 0,
    pedidos_oracao: 0,
    valor_oferta: 0,
    justificativa_edicao: '',
  });

  // Modal Lançamento de Frequência (Nominal / Numérica)
  const [modalFrequenciaAberto, setModalFrequenciaAberto] = useState(false);
  const [reuniaoFrequencia, setReuniaoFrequencia] = useState<CelulaReuniaoItem | null>(null);
  const [loadingParticipantes, setLoadingParticipantes] = useState(false);
  const [listaFrequenciaNominal, setListaFrequenciaNominal] = useState<ItemFrequenciaForm[]>([]);
  const [frequenciaMembros, setFrequenciaMembros] = useState<number>(0);
  const [frequenciaVisitantes, setFrequenciaVisitantes] = useState<number>(0);
  const [frequenciaCriancas, setFrequenciaCriancas] = useState<number>(0);
  const [frequenciaConversoes, setFrequenciaConversoes] = useState<number>(0);
  const [frequenciaReconciliacoes, setFrequenciaReconciliacoes] = useState<number>(0);
  const [frequenciaTestemunhos, setFrequenciaTestemunhos] = useState<number>(0);
  const [frequenciaPedidosOracao, setFrequenciaPedidosOracao] = useState<number>(0);
  const [frequenciaOferta, setFrequenciaOferta] = useState<number>(0);
  const [frequenciaJustificativa, setFrequenciaJustificativa] = useState<string>('');

  // Modal Token de Chamada Rápida
  const [modalTokenAberto, setModalTokenAberto] = useState(false);
  const [reuniaoToken, setReuniaoToken] = useState<CelulaReuniaoItem | null>(null);
  const [gerandoToken, setGerandoToken] = useState(false);
  const [tokenGerado, setTokenGerado] = useState<{ rawToken: string; link: string; expiresAt: string } | null>(null);
  const [linkCopiado, setLinkCopiado] = useState(false);

  // Carregar Dados Iniciais
  const carregarDados = async () => {
    try {
      setLoading(true);
      const [resCel, resRedes, resCfg, resCong, resEstudos] = await Promise.all([
        authenticatedFetch('/api/v1/celulas'),
        authenticatedFetch('/api/v1/celulas/redes'),
        authenticatedFetch('/api/v1/celulas/configuracoes'),
        authenticatedFetch('/api/v1/congregacoes'),
        authenticatedFetch('/api/v1/celulas/estudos?status=publicado'),
      ]);

      if (resCel.ok) {
        const jsonCel = await resCel.json();
        setCelulas(jsonCel.data || []);
      }
      if (resRedes.ok) {
        const jsonRedes = await resRedes.json();
        setRedes(jsonRedes.data || []);
      }
      if (resCfg.ok) {
        const jsonCfg = await resCfg.json();
        setConfig(jsonCfg.data || null);
      }
      if (resCong.ok) {
        const jsonCong = await resCong.json();
        setCongregacoes(jsonCong.data || []);
      }
      if (resEstudos.ok) {
        const jsonEst = await resEstudos.json();
        setEstudosPublicados(jsonEst.data || []);
      }
    } catch (err: any) {
      setMensagem({ tipo: 'erro', texto: 'Falha ao carregar dados do módulo Células.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, []);

  // Carregar Reuniões
  const carregarReunioes = async () => {
    try {
      setLoadingReunioes(true);
      const params = new URLSearchParams();
      if (filtroReuniaoCelula && filtroReuniaoCelula !== 'todas') {
        params.append('celula_id', filtroReuniaoCelula);
      }
      if (filtroReuniaoStatus && filtroReuniaoStatus !== 'todos') {
        params.append('status', filtroReuniaoStatus);
      }
      if (filtroReuniaoDataInicio) {
        params.append('data_inicio', filtroReuniaoDataInicio);
      }
      if (filtroReuniaoDataFim) {
        params.append('data_fim', filtroReuniaoDataFim);
      }

      const queryString = params.toString() ? `?${params.toString()}` : '';
      const res = await authenticatedFetch(`/api/v1/celulas/reunioes${queryString}`);

      if (res.ok) {
        const json = await res.json();
        setReunioes(json.data || []);
      } else {
        const json = await res.json();
        setMensagem({ tipo: 'erro', texto: json.error || 'Erro ao carregar reuniões.' });
      }
    } catch (err: any) {
      setMensagem({ tipo: 'erro', texto: 'Falha ao carregar lista de reuniões.' });
    } finally {
      setLoadingReunioes(false);
    }
  };

  useEffect(() => {
    if (abaAtiva === 'reunioes') {
      carregarReunioes();
    }
  }, [abaAtiva, filtroReuniaoCelula, filtroReuniaoStatus, filtroReuniaoDataInicio, filtroReuniaoDataFim]);

  // Filtragem Células
  const celulasFiltradas = useMemo(() => {
    return celulas.filter((c) => {
      const matchBusca = !busca || 
        c.nome.toLowerCase().includes(busca.toLowerCase()) || 
        (c.codigo && c.codigo.toLowerCase().includes(busca.toLowerCase())) ||
        (c.bairro && c.bairro.toLowerCase().includes(busca.toLowerCase()));

      const matchStatus = filtroStatus === 'todos' || c.status === filtroStatus;
      const matchRede = filtroRede === 'todas' || c.rede_id === filtroRede;
      const matchCong = filtroCongregacao === 'todas' || c.congregacao_id === filtroCongregacao;

      return matchBusca && matchStatus && matchRede && matchCong;
    });
  }, [celulas, busca, filtroStatus, filtroRede, filtroCongregacao]);

  // Ações de Salvar Célula
  const handleSalvarCelula = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCelula.nome.trim()) {
      setMensagem({ tipo: 'erro', texto: 'Informe o nome da célula.' });
      return;
    }

    try {
      setSalvando(true);
      setMensagem(null);
      const url = editandoCelulaId ? `/api/v1/celulas/${editandoCelulaId}` : '/api/v1/celulas';
      const method = editandoCelulaId ? 'PUT' : 'POST';

      const res = await authenticatedFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formCelula,
          congregacao_id: formCelula.congregacao_id || null,
          rede_id: formCelula.rede_id || null,
        }),
      });

      const resJson = await res.json();
      if (!res.ok) {
        throw new Error(resJson.error || 'Erro ao salvar célula.');
      }

      setMensagem({ 
        tipo: 'sucesso', 
        texto: editandoCelulaId ? 'Célula atualizada com sucesso!' : 'Célula cadastrada com sucesso!' 
      });
      setModalCelulaAberto(false);
      setEditandoCelulaId(null);
      carregarDados();
    } catch (err: any) {
      setMensagem({ tipo: 'erro', texto: err.message });
    } finally {
      setSalvando(false);
    }
  };

  const handleSalvarRede = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formRede.nome.trim()) {
      setMensagem({ tipo: 'erro', texto: 'Informe o nome da rede.' });
      return;
    }

    try {
      setSalvando(true);
      setMensagem(null);
      const res = await authenticatedFetch('/api/v1/celulas/redes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formRede),
      });

      const resJson = await res.json();
      if (!res.ok) throw new Error(resJson.error || 'Erro ao criar rede.');

      setMensagem({ tipo: 'sucesso', texto: 'Rede ministerial criada com sucesso!' });
      setModalRedeAberto(false);
      setFormRede({ nome: '', descricao: '', cor: '#123b63' });
      carregarDados();
    } catch (err: any) {
      setMensagem({ tipo: 'erro', texto: err.message });
    } finally {
      setSalvando(false);
    }
  };

  const abrirEdicaoCelula = (c: CelulaItem) => {
    setEditandoCelulaId(c.id);
    setFormCelula({
      nome: c.nome,
      codigo: c.codigo || '',
      dia_semana: c.dia_semana,
      horario: c.horario ? c.horario.slice(0, 5) : '20:00',
      modalidade: c.modalidade,
      status: c.status,
      congregacao_id: c.congregacao_id || '',
      rede_id: c.rede_id || '',
      bairro: c.bairro || '',
      cidade: c.cidade || '',
      logradouro: c.logradouro || '',
      numero: c.numero || '',
      descricao: c.descricao || '',
    });
    setModalCelulaAberto(true);
  };

  // --------------------------------------------------------------------------
  // Ações de Reuniões & Frequência (Lote 2)
  // --------------------------------------------------------------------------
  const abrirNovaReuniao = () => {
    setReuniaoSendoEditada(null);
    const primeiraCelulaId = celulas.length > 0 ? (filtroReuniaoCelula !== 'todas' ? filtroReuniaoCelula : celulas[0].id) : '';
    const celulaPadrao = celulas.find(c => c.id === primeiraCelulaId);

    setFormReuniao({
      celula_id: primeiraCelulaId,
      congregacao_id: celulaPadrao?.congregacao_id || '',
      data_reuniao: new Date().toISOString().slice(0, 10),
      horario_inicio: celulaPadrao?.horario ? celulaPadrao.horario.slice(0, 5) : '20:00',
      horario_termino: '',
      modalidade: celulaPadrao?.modalidade || 'presencial',
      status: 'planejada',
      tema_estudo: '',
      observacoes: '',
      presentes_membros: 0,
      presentes_visitantes: 0,
      presentes_criancas: 0,
      conversoes_decisoes: 0,
      reconciliacoes: 0,
      testemunhos: 0,
      pedidos_oracao: 0,
      valor_oferta: 0,
      justificativa_edicao: '',
    });
    setModalReuniaoAberto(true);
  };

  const abrirEdicaoReuniao = (r: CelulaReuniaoItem) => {
    setReuniaoSendoEditada(r);
    setFormReuniao({
      id: r.id,
      celula_id: r.celula_id,
      congregacao_id: r.congregacao_id || '',
      data_reuniao: r.data_reuniao,
      horario_inicio: r.horario_inicio ? r.horario_inicio.slice(0, 5) : '20:00',
      horario_termino: r.horario_termino ? r.horario_termino.slice(0, 5) : '',
      modalidade: r.modalidade || 'presencial',
      status: r.status,
      tema_estudo: r.tema_estudo || '',
      observacoes: r.observacoes || '',
      presentes_membros: r.presentes_membros || 0,
      presentes_visitantes: r.presentes_visitantes || 0,
      presentes_criancas: r.presentes_criancas || 0,
      conversoes_decisoes: r.conversoes_decisoes || 0,
      reconciliacoes: r.reconciliacoes || 0,
      testemunhos: r.testemunhos || 0,
      pedidos_oracao: r.pedidos_oracao || 0,
      valor_oferta: r.valor_oferta || 0,
      justificativa_edicao: r.justificativa_edicao || '',
    });
    setModalReuniaoAberto(true);
  };

  const handleSalvarReuniao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formReuniao.celula_id) {
      setMensagem({ tipo: 'erro', texto: 'Selecione a célula para a reunião.' });
      return;
    }
    if (!formReuniao.data_reuniao) {
      setMensagem({ tipo: 'erro', texto: 'Informe a data da reunião.' });
      return;
    }
    if (reuniaoSendoEditada?.status === 'finalizada' && !formReuniao.justificativa_edicao.trim()) {
      setMensagem({ tipo: 'erro', texto: 'Reuniões finalizadas exigem justificativa de governança para qualquer edição.' });
      return;
    }

    try {
      setSalvando(true);
      setMensagem(null);

      const payload: SalvarReuniaoInput = {
        ...(reuniaoSendoEditada?.id ? { id: reuniaoSendoEditada.id } : {}),
        celula_id: formReuniao.celula_id,
        congregacao_id: formReuniao.congregacao_id || null,
        data_reuniao: formReuniao.data_reuniao,
        horario_inicio: formReuniao.horario_inicio || '20:00',
        horario_termino: formReuniao.horario_termino || null,
        modalidade: formReuniao.modalidade,
        status: formReuniao.status,
        tema_estudo: formReuniao.tema_estudo || null,
        observacoes: formReuniao.observacoes || null,
        presentes_membros: Number(formReuniao.presentes_membros || 0),
        presentes_visitantes: Number(formReuniao.presentes_visitantes || 0),
        presentes_criancas: Number(formReuniao.presentes_criancas || 0),
        conversoes_decisoes: Number(formReuniao.conversoes_decisoes || 0),
        reconciliacoes: Number(formReuniao.reconciliacoes || 0),
        testemunhos: Number(formReuniao.testemunhos || 0),
        pedidos_oracao: Number(formReuniao.pedidos_oracao || 0),
        valor_oferta: Number(formReuniao.valor_oferta || 0),
        justificativa_edicao: formReuniao.justificativa_edicao.trim() || null,
      };

      const res = await authenticatedFetch('/api/v1/celulas/reunioes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const resJson = await res.json();
      if (!res.ok) {
        throw new Error(resJson.error || 'Erro ao registrar reunião.');
      }

      setMensagem({
        tipo: 'sucesso',
        texto: reuniaoSendoEditada ? 'Reunião atualizada com sucesso!' : 'Reunião agendada com sucesso!'
      });
      setModalReuniaoAberto(false);
      setReuniaoSendoEditada(null);
      carregarReunioes();
    } catch (err: any) {
      setMensagem({ tipo: 'erro', texto: err.message });
    } finally {
      setSalvando(false);
    }
  };

  // Abrir Modal de Frequência
  const abrirModalFrequencia = async (r: CelulaReuniaoItem) => {
    setReuniaoFrequencia(r);
    setFrequenciaMembros(r.presentes_membros || 0);
    setFrequenciaVisitantes(r.presentes_visitantes || 0);
    setFrequenciaCriancas(r.presentes_criancas || 0);
    setFrequenciaConversoes(r.conversoes_decisoes || 0);
    setFrequenciaReconciliacoes(r.reconciliacoes || 0);
    setFrequenciaTestemunhos(r.testemunhos || 0);
    setFrequenciaPedidosOracao(r.pedidos_oracao || 0);
    setFrequenciaOferta(r.valor_oferta || 0);
    setFrequenciaJustificativa(r.justificativa_edicao || '');

    // Carregar participantes ativos da célula para chamada nominal
    try {
      setLoadingParticipantes(true);
      const resPart = await authenticatedFetch(`/api/v1/celulas/participantes?celula_id=${r.celula_id}&status=ativo`);
      if (resPart.ok) {
        const jsonPart = await resPart.json();
        const parts: CelulaParticipanteItem[] = jsonPart.data || [];
        setListaFrequenciaNominal(parts.map(p => {
          let tipo: CelulaParticipanteTipo = 'membro';
          if (p.papel === 'crianca') tipo = 'crianca';
          else if (p.papel === 'visitante_regular') tipo = 'visitante';
          else if (p.papel === 'congregante') tipo = 'congregante';
          else tipo = 'membro';

          return {
            participante_id: p.id,
            member_id: p.member_id || null,
            nome_participante: p.nome_completo,
            tipo_participante: tipo,
            presente: true,
            justificativa_ausencia: '',
          };
        }));
      } else {
        setListaFrequenciaNominal([]);
      }
    } catch (err) {
      setListaFrequenciaNominal([]);
    } finally {
      setLoadingParticipantes(false);
    }

    setModalFrequenciaAberto(true);
  };

  const handleSalvarFrequencia = async (finalizarCiclo: boolean = false) => {
    if (!reuniaoFrequencia) return;

    if (reuniaoFrequencia.status === 'finalizada' && !frequenciaJustificativa.trim()) {
      setMensagem({ tipo: 'erro', texto: 'Informe a justificativa de edição para reunião já finalizada.' });
      return;
    }

    try {
      setSalvando(true);
      setMensagem(null);

      // Se houver lista de chamada nominal, sincroniza a contagem de membros presentes
      const totalNominalPresentes = listaFrequenciaNominal.filter(p => p.presente).length;
      const membrosPresentes = listaFrequenciaNominal.length > 0 ? totalNominalPresentes : frequenciaMembros;

      const payload: SalvarReuniaoInput = {
        id: reuniaoFrequencia.id,
        celula_id: reuniaoFrequencia.celula_id,
        congregacao_id: reuniaoFrequencia.congregacao_id || null,
        data_reuniao: reuniaoFrequencia.data_reuniao,
        horario_inicio: reuniaoFrequencia.horario_inicio,
        modalidade: reuniaoFrequencia.modalidade,
        status: (finalizarCiclo ? 'finalizada' : 'em_andamento') as CelulaReuniaoStatus,
        tema_estudo: reuniaoFrequencia.tema_estudo,
        observacoes: reuniaoFrequencia.observacoes,
        presentes_membros: Number(membrosPresentes),
        presentes_visitantes: Number(frequenciaVisitantes),
        presentes_criancas: Number(frequenciaCriancas),
        conversoes_decisoes: Number(frequenciaConversoes),
        reconciliacoes: Number(frequenciaReconciliacoes),
        testemunhos: Number(frequenciaTestemunhos),
        pedidos_oracao: Number(frequenciaPedidosOracao),
        valor_oferta: Number(frequenciaOferta),
        justificativa_edicao: frequenciaJustificativa.trim() || null,
        frequencias: listaFrequenciaNominal.length > 0 ? listaFrequenciaNominal.map(item => ({
          member_id: item.member_id || null,
          nome_participante: item.nome_participante,
          tipo_participante: item.tipo_participante,
          presente: item.presente,
          justificativa_ausencia: item.justificativa_ausencia || null,
        })) : undefined,
      };

      const res = await authenticatedFetch('/api/v1/celulas/reunioes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const resJson = await res.json();
      if (!res.ok) {
        throw new Error(resJson.error || 'Erro ao registrar frequência da reunião.');
      }

      setMensagem({
        tipo: 'sucesso',
        texto: finalizarCiclo ? 'Reunião finalizada com sucesso e frequência consolidada!' : 'Frequência da reunião salva com sucesso!'
      });
      setModalFrequenciaAberto(false);
      setReuniaoFrequencia(null);
      carregarReunioes();
    } catch (err: any) {
      setMensagem({ tipo: 'erro', texto: err.message });
    } finally {
      setSalvando(false);
    }
  };

  // Gerar Link de Chamada Rápida
  const abrirModalToken = async (r: CelulaReuniaoItem) => {
    setReuniaoToken(r);
    setTokenGerado(null);
    setLinkCopiado(false);
    setModalTokenAberto(true);

    try {
      setGerandoToken(true);
      const res = await authenticatedFetch('/api/v1/celulas/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          celula_id: r.celula_id,
          reuniao_id: r.id,
          tipo_acesso: 'frequencia_reuniao',
          duracao_horas: 24,
        }),
      });

      const resJson = await res.json();
      if (res.ok && resJson.data) {
        const raw = resJson.data.rawToken;
        const host = typeof window !== 'undefined' ? window.location.origin : '';
        const link = `${host}/celulas/chamada-rapida/${raw}`;
        setTokenGerado({
          rawToken: raw,
          link,
          expiresAt: resJson.data.tokenItem?.expires_at || '',
        });
      } else {
        setMensagem({ tipo: 'erro', texto: resJson.error || 'Não foi possível gerar o link de chamada rápida.' });
      }
    } catch (err: any) {
      setMensagem({ tipo: 'erro', texto: 'Erro de conexão ao gerar link temporário.' });
    } finally {
      setGerandoToken(false);
    }
  };

  const copiarLinkToken = () => {
    if (tokenGerado?.link) {
      navigator.clipboard.writeText(tokenGerado.link);
      setLinkCopiado(true);
      setTimeout(() => setLinkCopiado(false), 2500);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden bg-[#f4f7fa] min-h-screen">
      <div className="p-4 sm:p-6 lg:p-8 max-w-[96rem] mx-auto w-full space-y-6">
        {/* Cabeçalho da Página */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-teal-700 text-white flex items-center justify-center border border-teal-800 shadow-sm flex-shrink-0">
              <Network className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                Gestão de {config?.termo_celula || 'Células'}
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 font-medium mt-0.5">
                Organização, reuniões semanais, frequência pastoral e pequenos grupos.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {abaAtiva === 'celulas' && (
              <button
                type="button"
                onClick={() => {
                  setEditandoCelulaId(null);
                  setFormCelula({
                    nome: '',
                    codigo: '',
                    dia_semana: config?.dia_padrao_reuniao ?? 3,
                    horario: config?.horario_padrao_reuniao ? config.horario_padrao_reuniao.slice(0, 5) : '20:00',
                    modalidade: 'presencial',
                    status: 'ativa',
                    congregacao_id: '',
                    rede_id: '',
                    bairro: '',
                    cidade: '',
                    logradouro: '',
                    numero: '',
                    descricao: '',
                  });
                  setModalCelulaAberto(true);
                }}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-700 rounded-xl transition text-xs sm:text-sm font-bold flex items-center gap-2 shadow-sm cursor-pointer"
              >
                <Plus size={16} className="text-white" />
                <span>+ Nova {config?.termo_celula || 'Célula'}</span>
              </button>
            )}

            {abaAtiva === 'reunioes' && (
              <button
                type="button"
                onClick={abrirNovaReuniao}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-700 rounded-xl transition text-xs sm:text-sm font-bold flex items-center gap-2 shadow-sm cursor-pointer"
              >
                <Plus size={16} className="text-white" />
                <span>+ Nova Reunião</span>
              </button>
            )}

            {abaAtiva === 'redes' && (
              <button
                type="button"
                onClick={() => setModalRedeAberto(true)}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-700 rounded-xl transition text-xs sm:text-sm font-bold flex items-center gap-2 shadow-sm cursor-pointer"
              >
                <Plus size={16} className="text-white" />
                <span>+ Nova Rede</span>
              </button>
            )}
          </div>
        </div>

        {/* Feedback de Mensagem */}
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

        {/* Navegação entre Abas Centralizadas (Padrão Discipulado) */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-1.5 shadow-2xs flex flex-wrap gap-1">
          <button
            type="button"
            onClick={() => setAbaAtiva('celulas')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
              abaAtiva === 'celulas'
                ? 'bg-teal-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
            }`}
          >
            <Home className="w-4 h-4" />
            <span>{config?.termo_celula ? `${config.termo_celula}s` : 'Células'} ({celulas.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setAbaAtiva('reunioes')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
              abaAtiva === 'reunioes'
                ? 'bg-teal-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
            }`}
          >
            <CalendarDays className="w-4 h-4" />
            <span>Reuniões & Frequência ({reunioes.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setAbaAtiva('participantes')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
              abaAtiva === 'participantes'
                ? 'bg-teal-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Participantes & Vínculos</span>
          </button>

          <button
            type="button"
            onClick={() => setAbaAtiva('estudos')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
              abaAtiva === 'estudos'
                ? 'bg-teal-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Estudos & Conteúdo</span>
          </button>

          <button
            type="button"
            onClick={() => setAbaAtiva('supervisao')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
              abaAtiva === 'supervisao'
                ? 'bg-teal-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
            }`}
          >
            <ClipboardCheck className="w-4 h-4" />
            <span>Supervisão Pastoral</span>
          </button>

          <button
            type="button"
            onClick={() => setAbaAtiva('multiplicacao')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
              abaAtiva === 'multiplicacao'
                ? 'bg-teal-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
            }`}
          >
            <GitFork className="w-4 h-4" />
            <span>Multiplicação Assistida</span>
          </button>

          <button
            type="button"
            onClick={() => setAbaAtiva('comunicacao')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
              abaAtiva === 'comunicacao'
                ? 'bg-teal-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Comunicação & Notificações</span>
          </button>

          <button
            type="button"
            onClick={() => setAbaAtiva('redes')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
              abaAtiva === 'redes'
                ? 'bg-teal-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
            }`}
          >
            <Network className="w-4 h-4" />
            <span>Redes Ministeriais ({redes.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setAbaAtiva('configuracoes')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
              abaAtiva === 'configuracoes'
                ? 'bg-teal-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Configurações & Metodologia</span>
          </button>
        </div>

        {/* Conteúdo Aba Células */}
        {abaAtiva === 'celulas' && (
          <div className="space-y-6">
            {/* Barra de Filtros (Padrão Membros / Discipulado) */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 sm:p-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3.5 items-end">
                {/* Buscar por texto */}
                <div className="sm:col-span-2 lg:col-span-5">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Buscar {config?.termo_celula || 'Célula'}
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Search className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      value={busca}
                      onChange={(e) => setBusca(e.target.value)}
                      placeholder="Buscar por nome, código ou bairro..."
                      className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50/70 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition shadow-2xs"
                    />
                  </div>
                </div>

                {/* Filtro Status */}
                <div className="lg:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Status
                  </label>
                  <select
                    value={filtroStatus}
                    onChange={(e) => setFiltroStatus(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50/70 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition shadow-2xs cursor-pointer"
                  >
                    <option value="todos">Todos os Status</option>
                    <option value="ativa">Ativa</option>
                    <option value="em_formacao">Em Formação</option>
                    <option value="suspensa">Suspensa</option>
                    <option value="encerrada">Encerrada</option>
                  </select>
                </div>

                {/* Filtro Rede */}
                <div className="lg:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Rede
                  </label>
                  <select
                    value={filtroRede}
                    onChange={(e) => setFiltroRede(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50/70 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition shadow-2xs cursor-pointer"
                  >
                    <option value="todas">Todas as Redes</option>
                    {redes.map((r) => (
                      <option key={r.id} value={r.id}>{r.nome}</option>
                    ))}
                  </select>
                </div>

                {/* Filtro Congregação */}
                <div className="lg:col-span-3">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Congregação
                  </label>
                  <select
                    value={filtroCongregacao}
                    onChange={(e) => setFiltroCongregacao(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50/70 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition shadow-2xs cursor-pointer"
                  >
                    <option value="todas">Todas as Congregações</option>
                    {congregacoes.map((c) => (
                      <option key={c.id} value={c.id}>{c.nome}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Container da Listagem com cabeçalho interno padronizado */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 border-b border-slate-200/80 bg-white">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-700 border border-teal-200 flex items-center justify-center font-bold">
                    <Home className="w-5 h-5 text-teal-700" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">
                      Painel de {config?.termo_celula ? `${config.termo_celula}s` : 'Células'}
                    </h2>
                    <p className="text-xs text-slate-500">
                      Acompanhamento contínuo dos pequenos grupos e reuniões semanais
                    </p>
                  </div>
                  <span className="ml-2 px-3 py-1 bg-teal-50 text-teal-800 border border-teal-200/90 rounded-full text-xs font-bold">
                    {celulasFiltradas.length} {celulasFiltradas.length === 1 ? (config?.termo_celula?.toLowerCase() || 'célula') : (`${config?.termo_celula?.toLowerCase() || 'célula'}s`)}
                    {celulasFiltradas.length !== celulas.length && (
                      <span className="ml-1 text-[11px] text-teal-700 font-medium">de {celulas.length}</span>
                    )}
                  </span>
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={carregarDados}
                    disabled={loading}
                    className="px-3.5 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-2xs disabled:opacity-60"
                    title="Atualizar listagem"
                  >
                    <RefreshCw size={13} className={loading ? 'animate-spin text-teal-600' : 'text-slate-600'} />
                    <span>Atualizar</span>
                  </button>
                </div>
              </div>

              {/* Listagem */}
              {loading ? (
                <div className="py-20 text-center">
                  <RefreshCw className="w-8 h-8 animate-spin text-teal-600 mx-auto mb-3" />
                  <p className="text-xs text-slate-500 font-semibold">Carregando {config?.termo_celula?.toLowerCase() || 'célula'}s...</p>
                </div>
              ) : celulasFiltradas.length === 0 ? (
                <div className="py-20 text-center space-y-3 p-6">
                  <div className="w-14 h-14 rounded-2xl bg-slate-100 border border-slate-200 text-slate-400 flex items-center justify-center mx-auto">
                    <Home className="w-7 h-7 text-slate-400" />
                  </div>
                  <h3 className="text-base font-bold text-slate-800">Nenhuma {config?.termo_celula?.toLowerCase() || 'célula'} encontrada</h3>
                  <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                    Não há {config?.termo_celula?.toLowerCase() || 'célula'}s cadastradas com os filtros aplicados. Clique no botão destacado <strong>&quot;+ Nova {config?.termo_celula || 'Célula'}&quot;</strong> acima para cadastrar a primeira.
                  </p>
                </div>
              ) : (
                <div className="p-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {celulasFiltradas.map((c) => (
                      <div
                        key={c.id}
                        onClick={() => abrirEdicaoCelula(c)}
                        className="bg-white p-5 rounded-2xl border border-slate-200/90 hover:border-teal-600 hover:shadow-md transition cursor-pointer flex flex-col justify-between group shadow-2xs"
                      >
                        <div className="space-y-3">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                              {c.codigo || 'S/ CÓDIGO'}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full capitalize border ${
                                c.status === 'ativa'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : c.status === 'em_formacao'
                                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                                  : 'bg-slate-100 text-slate-600 border-slate-200'
                              }`}
                            >
                              {c.status.replace('_', ' ')}
                            </span>
                          </div>

                          <div>
                            <h3 className="text-base font-bold text-slate-900 leading-snug group-hover:text-teal-800 transition-colors">
                              {c.nome}
                            </h3>
                            {c.rede && (
                              <span className="text-xs font-semibold text-teal-700 block mt-0.5">
                                {c.rede.nome}
                              </span>
                            )}
                          </div>

                          <div className="text-xs text-slate-600 space-y-1.5 pt-2 border-t border-slate-100">
                            <div className="flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-slate-400" />
                              <span className="font-medium text-slate-700">
                                {DIAS_SEMANA[c.dia_semana]}, às {c.horario ? c.horario.slice(0, 5) : '20:00'}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <MapPin className="w-3.5 h-3.5 text-slate-400" />
                              <span className="truncate">
                                {c.bairro ? `${c.bairro}${c.cidade ? `, ${c.cidade}` : ''}` : c.congregacao?.nome || 'Local não informado'}
                              </span>
                            </div>
                            {c.lider && (
                              <div className="flex items-center gap-1.5 pt-0.5">
                                <span className="text-[11px] font-bold text-slate-700">
                                  Líder: <span className="font-normal text-slate-600">{c.lider.name}</span>
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-teal-700 font-bold group-hover:text-teal-800">
                          <span>Editar detalhes</span>
                          <ChevronRight className="w-4 h-4 text-teal-600 group-hover:translate-x-0.5 transition-transform" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* Conteúdo Aba Reuniões & Frequência (Lote 2) */}
        {/* ------------------------------------------------------------------ */}
        {abaAtiva === 'reunioes' && (
          <div className="space-y-6">
            {/* Barra de Filtros de Reuniões */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 sm:p-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3.5 items-end">
                {/* Selecionar Célula */}
                <div className="sm:col-span-2 lg:col-span-4">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    {config?.termo_celula || 'Célula'}
                  </label>
                  <select
                    value={filtroReuniaoCelula}
                    onChange={(e) => setFiltroReuniaoCelula(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50/70 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition shadow-2xs cursor-pointer"
                  >
                    <option value="todas">Todas as {config?.termo_celula ? `${config.termo_celula}s` : 'Células'}</option>
                    {celulas.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome} {c.codigo ? `(${c.codigo})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Filtro Status da Reunião */}
                <div className="lg:col-span-3">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Status da Reunião
                  </label>
                  <select
                    value={filtroReuniaoStatus}
                    onChange={(e) => setFiltroReuniaoStatus(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50/70 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition shadow-2xs cursor-pointer"
                  >
                    <option value="todos">Todos os Status</option>
                    <option value="planejada">Planejada / Agendada</option>
                    <option value="em_andamento">Em Andamento</option>
                    <option value="finalizada">Finalizada (Homologada)</option>
                    <option value="cancelada">Cancelada</option>
                    <option value="nao_realizada">Não Realizada</option>
                  </select>
                </div>

                {/* Filtro Data Início */}
                <div className="lg:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Data Início
                  </label>
                  <input
                    type="date"
                    value={filtroReuniaoDataInicio}
                    onChange={(e) => setFiltroReuniaoDataInicio(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50/70 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition shadow-2xs"
                  />
                </div>

                {/* Filtro Data Fim */}
                <div className="lg:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Data Fim
                  </label>
                  <input
                    type="date"
                    value={filtroReuniaoDataFim}
                    onChange={(e) => setFiltroReuniaoDataFim(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50/70 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition shadow-2xs"
                  />
                </div>

                {/* Botão Limpar Filtros */}
                <div className="lg:col-span-1">
                  <button
                    type="button"
                    onClick={() => {
                      setFiltroReuniaoCelula('todas');
                      setFiltroReuniaoStatus('todos');
                      setFiltroReuniaoDataInicio('');
                      setFiltroReuniaoDataFim('');
                    }}
                    className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl text-xs transition border border-slate-200 cursor-pointer text-center"
                    title="Limpar filtros"
                  >
                    Limpar
                  </button>
                </div>
              </div>
            </div>

            {/* Container da Listagem de Reuniões */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 border-b border-slate-200/80 bg-white">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-700 border border-teal-200 flex items-center justify-center font-bold">
                    <CalendarDays className="w-5 h-5 text-teal-700" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">
                      Histórico de Reuniões & Presença
                    </h2>
                    <p className="text-xs text-slate-500">
                      Controle semanal de frequência individual, visitantes e consolidação pastoral
                    </p>
                  </div>
                  <span className="ml-2 px-3 py-1 bg-teal-50 text-teal-800 border border-teal-200/90 rounded-full text-xs font-bold">
                    {reunioes.length} {reunioes.length === 1 ? 'reunião' : 'reuniões'}
                  </span>
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={carregarReunioes}
                    disabled={loadingReunioes}
                    className="px-3.5 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-2xs disabled:opacity-60"
                  >
                    <RefreshCw size={13} className={loadingReunioes ? 'animate-spin text-teal-600' : 'text-slate-600'} />
                    <span>Atualizar</span>
                  </button>
                </div>
              </div>

              {loadingReunioes ? (
                <div className="py-20 text-center">
                  <RefreshCw className="w-8 h-8 animate-spin text-teal-600 mx-auto mb-3" />
                  <p className="text-xs text-slate-500 font-semibold">Carregando histórico de reuniões...</p>
                </div>
              ) : reunioes.length === 0 ? (
                <div className="py-20 text-center space-y-3 p-6">
                  <div className="w-14 h-14 rounded-2xl bg-slate-100 border border-slate-200 text-slate-400 flex items-center justify-center mx-auto">
                    <CalendarDays className="w-7 h-7 text-slate-400" />
                  </div>
                  <h3 className="text-base font-bold text-slate-800">Nenhuma reunião encontrada</h3>
                  <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                    Não constam reuniões cadastradas para o filtro selecionado. Clique no botão <strong>&quot;+ Nova Reunião&quot;</strong> acima para registrar a frequência do pequeno grupo.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {reunioes.map((r) => {
                    const statusBadgeClass = 
                      r.status === 'finalizada'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : r.status === 'em_andamento'
                        ? 'bg-teal-50 text-teal-700 border-teal-200'
                        : r.status === 'planejada'
                        ? 'bg-sky-50 text-sky-700 border-sky-200'
                        : 'bg-rose-50 text-rose-700 border-rose-200';

                    const statusTexto = 
                      r.status === 'finalizada'
                        ? 'Finalizada'
                        : r.status === 'em_andamento'
                        ? 'Em Andamento'
                        : r.status === 'planejada'
                        ? 'Agendada'
                        : r.status === 'nao_realizada'
                        ? 'Não Realizada'
                        : 'Cancelada';

                    const celulaNome = (r as any).celula?.nome || 'Célula não identificada';
                    const dataFormatada = new Date(`${r.data_reuniao}T12:00:00`).toLocaleDateString('pt-BR', {
                      weekday: 'short',
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric'
                    });

                    return (
                      <div
                        key={r.id}
                        className="p-5 hover:bg-slate-50/80 transition flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                      >
                        <div className="space-y-2 min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-black text-slate-900">
                              {celulaNome}
                            </span>
                            <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full capitalize border ${statusBadgeClass}`}>
                              {statusTexto}
                            </span>
                            {r.editada_pos_fechamento && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1" title={r.justificativa_edicao || 'Auditada pos fechamento'}>
                                <ShieldAlert size={12} className="text-amber-600" />
                                Editada pós-fechamento
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                            <span className="flex items-center gap-1.5 font-medium text-slate-800">
                              <Calendar className="w-3.5 h-3.5 text-slate-400" />
                              {dataFormatada} às {r.horario_inicio ? r.horario_inicio.slice(0, 5) : '20:00'}
                            </span>
                            <span className="capitalize text-slate-500">
                              Modalidade: <strong>{r.modalidade || 'Presencial'}</strong>
                            </span>
                            {r.tema_estudo && (
                              <span className="text-slate-700 truncate max-w-sm">
                                Tema: <em>&ldquo;{r.tema_estudo}&rdquo;</em>
                              </span>
                            )}
                          </div>

                          {/* Métricas da Reunião */}
                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-teal-50 border border-teal-200/80 text-teal-800 text-[11px] font-bold">
                              <UserCheck size={13} className="text-teal-700" />
                              Total: {r.total_presentes || (r.presentes_membros + r.presentes_visitantes)} presentes
                            </span>
                            <span className="text-[11px] text-slate-500 font-medium">
                              ({r.presentes_membros} membros + {r.presentes_visitantes} visitantes)
                            </span>
                            {r.conversoes_decisoes > 0 && (
                              <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                                {r.conversoes_decisoes} {r.conversoes_decisoes === 1 ? 'decisão' : 'decisões'}
                              </span>
                            )}
                            {r.valor_oferta > 0 && (
                              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-bold">
                                R$ {r.valor_oferta.toFixed(2)}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Botões de Ação */}
                        <div className="flex flex-wrap items-center gap-2 pt-2 lg:pt-0">
                          {/* Lançar Frequência */}
                          <button
                            type="button"
                            onClick={() => abrirModalFrequencia(r)}
                            className="px-3.5 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
                            title="Lançar frequência nominal e dados da reunião"
                          >
                            <Users size={14} />
                            <span>{r.status === 'finalizada' ? 'Ver Frequência' : 'Frequência'}</span>
                          </button>

                          {/* Link de Chamada Rápida */}
                          <button
                            type="button"
                            onClick={() => abrirModalToken(r)}
                            className="px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
                            title="Gerar link temporário para chamada rápida via WhatsApp"
                          >
                            <LinkIcon size={14} className="text-slate-600" />
                            <span>Link Rápido</span>
                          </button>

                          {/* Editar Reunião */}
                          <button
                            type="button"
                            onClick={() => abrirEdicaoReuniao(r)}
                            className="px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
                            title="Editar parâmetros da reunião"
                          >
                            <FileText size={14} className="text-slate-600" />
                            <span>Editar</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Conteúdo Aba Participantes (Lote 3) */}
        {abaAtiva === 'participantes' && (
          <TabParticipantes
            celulas={celulas}
            congregacoes={congregacoes}
            termoCelula={config?.termo_celula || 'Célula'}
          />
        )}

        {/* Conteúdo Aba Estudos & Conteúdo (Lote 4) */}
        {abaAtiva === 'estudos' && (
          <TabEstudos
            redes={redes}
            congregacoes={congregacoes}
            termoCelula={config?.termo_celula || 'Célula'}
          />
        )}

        {/* Conteúdo Aba Supervisão Pastoral (Lote 4) */}
        {abaAtiva === 'supervisao' && (
          <TabSupervisao
            celulas={celulas}
            congregacoes={congregacoes}
            termoCelula={config?.termo_celula || 'Célula'}
          />
        )}

        {/* Conteúdo Aba Multiplicação Assistida (Lote 5) */}
        {abaAtiva === 'multiplicacao' && (
          <TabMultiplicacao
            celulas={celulas}
            redes={redes}
            congregacoes={congregacoes}
            termoCelula={config?.termo_celula || 'Célula'}
          />
        )}

        {/* Conteúdo Aba Comunicação & Notificações (Lote 6) */}
        {abaAtiva === 'comunicacao' && (
          <TabComunicacao
            celulas={celulas}
            redes={redes}
            congregacoes={congregacoes}
            termoCelula={config?.termo_celula || 'Célula'}
          />
        )}

        {/* Conteúdo Aba Redes */}
        {abaAtiva === 'redes' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5">
              <div className="flex items-center justify-between border-b border-slate-200/80 pb-4 mb-5">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Redes Ministeriais</h2>
                  <p className="text-xs text-slate-500">Agrupamento estratégico de células por faixas, bairros ou ministérios</p>
                </div>
                <span className="px-3 py-1 bg-teal-50 text-teal-800 border border-teal-200/90 rounded-full text-xs font-bold">
                  {redes.length} {redes.length === 1 ? 'rede' : 'redes'}
                </span>
              </div>

              {redes.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-sm">
                  Nenhuma rede cadastrada. Clique em &quot;+ Nova Rede&quot; acima para registrar.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {redes.map((r) => (
                    <div key={r.id} className="bg-slate-50/70 p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold shadow-xs flex-shrink-0"
                          style={{ backgroundColor: r.cor || '#0f766e' }}
                        >
                          <Network className="w-5 h-5 text-white" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-base font-bold text-slate-900 truncate">{r.nome}</h3>
                          <p className="text-xs text-slate-500 truncate">{r.descricao || 'Rede ministerial ativa'}</p>
                        </div>
                      </div>
                      {r.coordenador && (
                        <p className="text-xs text-slate-600 border-t border-slate-200/80 pt-2.5">
                          Coordenador: <span className="font-semibold text-slate-800">{r.coordenador.name}</span>
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Conteúdo Aba Configurações */}
        {abaAtiva === 'configuracoes' && (
          <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200/90 shadow-sm max-w-2xl space-y-5">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Parâmetros Ministeriais</h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Ajuste a terminologia e metodologia de frequência utilizadas de acordo com o modelo de sua igreja.
              </p>
            </div>

            <div className="space-y-4 pt-2">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Termo para Célula
                </label>
                <input
                  type="text"
                  disabled
                  value={config?.termo_celula || 'Célula'}
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl bg-slate-50 text-slate-700 font-medium cursor-not-allowed shadow-2xs"
                />
                <span className="text-[11px] text-slate-500 mt-1 block font-medium">Ex: Célula, Pequeno Grupo, Grupo Familiar.</span>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Metodologia Adotada
                </label>
                <input
                  type="text"
                  disabled
                  value={config?.metodologia || 'Livre'}
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl bg-slate-50 text-slate-700 font-medium capitalize cursor-not-allowed shadow-2xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Modelo de Frequência Configurado
                </label>
                <input
                  type="text"
                  disabled
                  value={config?.frequencia_obrigatoria === 'individual' ? 'Frequência Nominal (Chamada Individual)' : config?.frequencia_obrigatoria === 'numerica' ? 'Frequência Numérica (Contagem Geral)' : 'Híbrida (Flexível: Nominal + Numérica)'}
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl bg-slate-50 text-slate-700 font-medium cursor-not-allowed shadow-2xs"
                />
                <span className="text-[11px] text-slate-500 mt-1 block font-medium">
                  Suporta registro com validação individual de membros e contagem rápida de visitantes.
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal Nova / Editar Célula */}
      {modalCelulaAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200/90 w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-slate-200 bg-slate-50/50">
              <h3 className="text-lg font-bold text-slate-900">
                {editandoCelulaId ? 'Editar Célula' : 'Cadastrar Nova Célula'}
              </h3>
              <button
                type="button"
                onClick={() => setModalCelulaAberto(false)}
                className="text-slate-400 hover:text-slate-600 transition p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSalvarCelula} className="p-6 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Nome da Célula *
                  </label>
                  <input
                    type="text"
                    required
                    value={formCelula.nome}
                    onChange={(e) => setFormCelula({ ...formCelula, nome: e.target.value })}
                    placeholder="Ex: Célula Betel, Ágape, Manancial..."
                    className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 shadow-2xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Código / Identificador
                  </label>
                  <input
                    type="text"
                    value={formCelula.codigo || ''}
                    onChange={(e) => setFormCelula({ ...formCelula, codigo: e.target.value })}
                    placeholder="Ex: CEL-001"
                    className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 shadow-2xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Status
                  </label>
                  <select
                    value={formCelula.status}
                    onChange={(e) => setFormCelula({ ...formCelula, status: e.target.value as any })}
                    className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 shadow-2xs cursor-pointer"
                  >
                    <option value="ativa">Ativa</option>
                    <option value="em_formacao">Em Formação</option>
                    <option value="suspensa">Suspensa</option>
                    <option value="encerrada">Encerrada</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Rede Ministerial
                  </label>
                  <select
                    value={formCelula.rede_id || ''}
                    onChange={(e) => setFormCelula({ ...formCelula, rede_id: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 shadow-2xs cursor-pointer"
                  >
                    <option value="">Nenhuma / Geral</option>
                    {redes.map((r) => (
                      <option key={r.id} value={r.id}>{r.nome}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Congregação Vinculada
                  </label>
                  <select
                    value={formCelula.congregacao_id || ''}
                    onChange={(e) => setFormCelula({ ...formCelula, congregacao_id: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 shadow-2xs cursor-pointer"
                  >
                    <option value="">Sede / Sem Vínculo Específico</option>
                    {congregacoes.map((c) => (
                      <option key={c.id} value={c.id}>{c.nome}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Dia da Reunião
                  </label>
                  <select
                    value={formCelula.dia_semana}
                    onChange={(e) => setFormCelula({ ...formCelula, dia_semana: Number(e.target.value) })}
                    className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 shadow-2xs cursor-pointer"
                  >
                    {DIAS_SEMANA.map((dia, idx) => (
                      <option key={idx} value={idx}>{dia}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Horário
                  </label>
                  <input
                    type="time"
                    required
                    value={formCelula.horario}
                    onChange={(e) => setFormCelula({ ...formCelula, horario: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 shadow-2xs"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Bairro / Localização
                  </label>
                  <input
                    type="text"
                    value={formCelula.bairro || ''}
                    onChange={(e) => setFormCelula({ ...formCelula, bairro: e.target.value })}
                    placeholder="Bairro ou ponto de referência"
                    className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 shadow-2xs"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setModalCelulaAberto(false)}
                  className="px-4 py-2.5 text-xs sm:text-sm font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvando}
                  className="px-4 py-2.5 text-xs sm:text-sm font-bold rounded-xl bg-teal-700 text-white hover:bg-teal-800 transition shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {salvando ? 'Salvando...' : 'Salvar Célula'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Nova / Editar Reunião (Lote 2) */}
      {modalReuniaoAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200/90 w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-slate-200 bg-slate-50/50">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {reuniaoSendoEditada ? 'Editar Reunião' : 'Agendar / Nova Reunião'}
                </h3>
                <p className="text-xs text-slate-500">
                  {reuniaoSendoEditada ? 'Atualizar detalhes da reunião e pauta' : 'Criar nova data no ciclo semanal do pequeno grupo'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalReuniaoAberto(false)}
                className="text-slate-400 hover:text-slate-600 transition p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSalvarReuniao} className="p-6 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    {config?.termo_celula || 'Célula'} *
                  </label>
                  <select
                    required
                    value={formReuniao.celula_id}
                    onChange={(e) => {
                      const cId = e.target.value;
                      const cel = celulas.find(c => c.id === cId);
                      setFormReuniao({
                        ...formReuniao,
                        celula_id: cId,
                        congregacao_id: cel?.congregacao_id || '',
                        horario_inicio: cel?.horario ? cel.horario.slice(0, 5) : formReuniao.horario_inicio,
                        modalidade: cel?.modalidade || formReuniao.modalidade,
                      });
                    }}
                    className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 shadow-2xs cursor-pointer"
                  >
                    <option value="">Selecione uma Célula</option>
                    {celulas.map((c) => (
                      <option key={c.id} value={c.id}>{c.nome} {c.codigo ? `(${c.codigo})` : ''}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Data da Reunião *
                  </label>
                  <input
                    type="date"
                    required
                    value={formReuniao.data_reuniao}
                    onChange={(e) => setFormReuniao({ ...formReuniao, data_reuniao: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 shadow-2xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Horário Início *
                  </label>
                  <input
                    type="time"
                    required
                    value={formReuniao.horario_inicio}
                    onChange={(e) => setFormReuniao({ ...formReuniao, horario_inicio: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 shadow-2xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Modalidade
                  </label>
                  <select
                    value={formReuniao.modalidade}
                    onChange={(e) => setFormReuniao({ ...formReuniao, modalidade: e.target.value as any })}
                    className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 shadow-2xs cursor-pointer"
                  >
                    <option value="presencial">Presencial</option>
                    <option value="online">Online</option>
                    <option value="hibrida">Híbrida</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Status
                  </label>
                  <select
                    value={formReuniao.status}
                    onChange={(e) => setFormReuniao({ ...formReuniao, status: e.target.value as any })}
                    className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 shadow-2xs cursor-pointer"
                  >
                    <option value="planejada">Planejada / Agendada</option>
                    <option value="em_andamento">Em Andamento</option>
                    <option value="finalizada">Finalizada (Homologada)</option>
                    <option value="nao_realizada">Não Realizada</option>
                    <option value="cancelada">Cancelada</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                      Tema do Estudo / Ministração
                    </label>
                    {estudosPublicados.length > 0 && (
                      <span className="text-[11px] text-teal-700 font-semibold">
                        Ou selecione da biblioteca de estudos abaixo
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    value={formReuniao.tema_estudo}
                    onChange={(e) => setFormReuniao({ ...formReuniao, tema_estudo: e.target.value })}
                    placeholder="Ex: Fruto do Espírito, Vivendo em Comunhão..."
                    className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 shadow-2xs"
                  />
                  {estudosPublicados.length > 0 && (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Sugeridos:</span>
                      {estudosPublicados.slice(0, 4).map(est => (
                        <button
                          key={est.id}
                          type="button"
                          onClick={() => setFormReuniao({ ...formReuniao, tema_estudo: est.titulo })}
                          className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border transition cursor-pointer ${
                            formReuniao.tema_estudo === est.titulo
                              ? 'bg-teal-700 text-white border-teal-700'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                          title={est.referencias_biblicas ? `${est.titulo} (${est.referencias_biblicas})` : est.titulo}
                        >
                          {est.titulo}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Observações Pastorais
                  </label>
                  <textarea
                    value={formReuniao.observacoes}
                    onChange={(e) => setFormReuniao({ ...formReuniao, observacoes: e.target.value })}
                    placeholder="Anotações gerais sobre o andamento da reunião"
                    className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 shadow-2xs h-20 resize-none"
                  />
                </div>

                {/* Justificativa Condicional de Edição Governança */}
                {reuniaoSendoEditada?.status === 'finalizada' && (
                  <div className="sm:col-span-2 bg-amber-50/70 p-3.5 rounded-xl border border-amber-200">
                    <label className="block text-[11px] font-bold text-amber-900 uppercase tracking-wider mb-1">
                      Justificativa de Edição (Obrigatória pós-fechamento) *
                    </label>
                    <input
                      type="text"
                      required
                      value={formReuniao.justificativa_edicao}
                      onChange={(e) => setFormReuniao({ ...formReuniao, justificativa_edicao: e.target.value })}
                      placeholder="Ex: Correção de contagem de visitantes autorizada pela liderança"
                      className="w-full px-3 py-2 text-xs sm:text-sm border border-amber-300 bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600"
                    />
                    <span className="text-[10px] text-amber-700 mt-1 block">
                      Esta justificativa é auditável e constará no registro ministerial da reunião.
                    </span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setModalReuniaoAberto(false)}
                  className="px-4 py-2.5 text-xs sm:text-sm font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvando}
                  className="px-4 py-2.5 text-xs sm:text-sm font-bold rounded-xl bg-teal-700 text-white hover:bg-teal-800 transition shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {salvando ? 'Salvando...' : 'Salvar Reunião'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Frequência Nominal & Numérica (Lote 2) */}
      {modalFrequenciaAberto && reuniaoFrequencia && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200/90 w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-slate-200 bg-slate-50/50">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-slate-900">
                    Lançamento de Frequência & Métricas
                  </h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-100 text-teal-800">
                    {(reuniaoFrequencia as any).celula?.nome}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Data: {new Date(`${reuniaoFrequencia.data_reuniao}T12:00:00`).toLocaleDateString('pt-BR')} às {reuniaoFrequencia.horario_inicio?.slice(0, 5)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalFrequenciaAberto(false)}
                className="text-slate-400 hover:text-slate-600 transition p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto flex-1">
              {/* Chamada Nominal por Participante */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4 text-teal-700" />
                    Chamada Nominal (Membros da Célula)
                  </h4>
                  {listaFrequenciaNominal.length > 0 && (
                    <span className="text-xs font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200">
                      {listaFrequenciaNominal.filter(p => p.presente).length} de {listaFrequenciaNominal.length} presentes
                    </span>
                  )}
                </div>

                {loadingParticipantes ? (
                  <div className="py-6 text-center text-xs text-slate-500">
                    Carregando participantes da célula...
                  </div>
                ) : listaFrequenciaNominal.length === 0 ? (
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs text-slate-600">
                    <p className="font-semibold text-slate-700 mb-1">Nenhum participante nominal vinculado a esta célula.</p>
                    <p>Você pode lançar a frequência utilizando os campos de contagem numérica abaixo.</p>
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-56 overflow-y-auto">
                    {listaFrequenciaNominal.map((p, idx) => (
                      <div
                        key={p.participante_id || idx}
                        onClick={() => {
                          const nova = [...listaFrequenciaNominal];
                          nova[idx].presente = !nova[idx].presente;
                          setListaFrequenciaNominal(nova);
                        }}
                        className={`flex items-center justify-between p-3 text-xs cursor-pointer transition select-none ${
                          p.presente ? 'bg-teal-50/40 hover:bg-teal-50/70' : 'bg-white hover:bg-slate-50 opacity-60'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className={`w-5 h-5 rounded-md flex items-center justify-center border transition ${
                            p.presente ? 'bg-teal-700 border-teal-800 text-white' : 'border-slate-300 bg-white'
                          }`}>
                            {p.presente && <Check size={13} strokeWidth={3} />}
                          </div>
                          <span className={`font-medium ${p.presente ? 'text-slate-900 font-bold' : 'text-slate-500 line-through'}`}>
                            {p.nome_participante}
                          </span>
                        </div>
                        <span className="text-[10px] uppercase font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          {p.tipo_participante || 'membro'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Contadores Numéricos (Membros / Visitantes / Crianças / Decisões) */}
              <div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2.5">
                  Contagem de Presença & Indicadores Pastorais
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {listaFrequenciaNominal.length === 0 && (
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Membros Presentes</label>
                      <input
                        type="number"
                        min="0"
                        value={frequenciaMembros}
                        onChange={(e) => setFrequenciaMembros(Number(e.target.value))}
                        className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Visitantes</label>
                    <input
                      type="number"
                      min="0"
                      value={frequenciaVisitantes}
                      onChange={(e) => setFrequenciaVisitantes(Number(e.target.value))}
                      className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Crianças</label>
                    <input
                      type="number"
                      min="0"
                      value={frequenciaCriancas}
                      onChange={(e) => setFrequenciaCriancas(Number(e.target.value))}
                      className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Conversões / Decisões</label>
                    <input
                      type="number"
                      min="0"
                      value={frequenciaConversoes}
                      onChange={(e) => setFrequenciaConversoes(Number(e.target.value))}
                      className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Oferta (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={frequenciaOferta}
                      onChange={(e) => setFrequenciaOferta(Number(e.target.value))}
                      className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600"
                    />
                  </div>
                </div>
              </div>

              {/* Justificativa Condicional se Finalizada */}
              {reuniaoFrequencia.status === 'finalizada' && (
                <div className="bg-amber-50 p-3.5 rounded-xl border border-amber-200">
                  <label className="block text-[11px] font-bold text-amber-900 uppercase tracking-wider mb-1">
                    Justificativa de Governança (Obrigatória para reunião finalizada) *
                  </label>
                  <input
                    type="text"
                    required
                    value={frequenciaJustificativa}
                    onChange={(e) => setFrequenciaJustificativa(e.target.value)}
                    placeholder="Motivo da retificação de chamada"
                    className="w-full px-3 py-2 text-xs sm:text-sm border border-amber-300 bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600"
                  />
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-5 border-t border-slate-200 bg-slate-50/50">
              <span className="text-xs text-slate-500 font-medium">
                Total Previsto:{' '}
                <strong className="text-slate-800">
                  {(listaFrequenciaNominal.length > 0 ? listaFrequenciaNominal.filter(p => p.presente).length : frequenciaMembros) + frequenciaVisitantes} pessoas
                </strong>
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setModalFrequenciaAberto(false)}
                  className="px-4 py-2.5 text-xs sm:text-sm font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={salvando}
                  onClick={() => handleSalvarFrequencia(false)}
                  className="px-4 py-2.5 text-xs sm:text-sm font-bold rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 transition cursor-pointer disabled:opacity-50"
                >
                  Salvar Rascunho
                </button>
                <button
                  type="button"
                  disabled={salvando}
                  onClick={() => handleSalvarFrequencia(true)}
                  className="px-4 py-2.5 text-xs sm:text-sm font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {salvando ? 'Salvando...' : 'Finalizar Reunião'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Link de Chamada Rápida (Lote 2) */}
      {modalTokenAberto && reuniaoToken && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200/90 w-full max-w-md overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-slate-200 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700">
                  <LinkIcon size={16} />
                </div>
                <h3 className="text-base font-bold text-slate-900">Link de Chamada Rápida</h3>
              </div>
              <button
                type="button"
                onClick={() => setModalTokenAberto(false)}
                className="text-slate-400 hover:text-slate-600 transition p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                Envie este link seguro para o líder ou anfitrião no WhatsApp. Ele permite marcar presenças diretamente do celular sem necessidade de login.
              </p>

              {gerandoToken ? (
                <div className="py-8 text-center text-xs text-slate-500 font-semibold flex items-center justify-center gap-2">
                  <RefreshCw size={14} className="animate-spin text-teal-600" />
                  Gerando token criptográfico seguro...
                </div>
              ) : tokenGerado ? (
                <div className="space-y-3">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-800 break-all font-mono select-all">
                    {tokenGerado.link}
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
                    <span className="flex items-center gap-1">
                      <Clock size={12} className="text-slate-400" />
                      Válido por 24 horas
                    </span>
                    <span className="text-emerald-700 font-bold">Token Ativo</span>
                  </div>

                  <button
                    type="button"
                    onClick={copiarLinkToken}
                    className="w-full py-2.5 px-4 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition shadow-xs cursor-pointer"
                  >
                    {linkCopiado ? (
                      <>
                        <Check size={16} className="text-emerald-300" />
                        <span>Link Copiado com Sucesso!</span>
                      </>
                    ) : (
                      <>
                        <Copy size={16} />
                        <span>Copiar Link para o WhatsApp</span>
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div className="text-center py-4 text-xs text-rose-600 font-semibold">
                  Falha ao gerar link temporário. Tente novamente.
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50/50 flex justify-end">
              <button
                type="button"
                onClick={() => setModalTokenAberto(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 rounded-xl transition"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Nova Rede */}
      {modalRedeAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200/90 w-full max-w-md overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-slate-200 bg-slate-50/50">
              <h3 className="text-lg font-bold text-slate-900">Nova Rede Ministerial</h3>
              <button
                type="button"
                onClick={() => setModalRedeAberto(false)}
                className="text-slate-400 hover:text-slate-600 transition p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSalvarRede} className="p-6 space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Nome da Rede *
                </label>
                <input
                  type="text"
                  required
                  value={formRede.nome}
                  onChange={(e) => setFormRede({ ...formRede, nome: e.target.value })}
                  placeholder="Ex: Rede de Jovens, Rede de Mulheres..."
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 shadow-2xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Descrição
                </label>
                <textarea
                  value={formRede.descricao}
                  onChange={(e) => setFormRede({ ...formRede, descricao: e.target.value })}
                  placeholder="Breve resumo do público ou propósito da rede"
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 shadow-2xs h-20 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setModalRedeAberto(false)}
                  className="px-4 py-2.5 text-xs sm:text-sm font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvando}
                  className="px-4 py-2.5 text-xs sm:text-sm font-bold rounded-xl bg-teal-700 text-white hover:bg-teal-800 transition shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {salvando ? 'Salvando...' : 'Criar Rede'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
