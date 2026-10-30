'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useUserContext } from '@/hooks/useUserContext';
import { getLocalDateStr } from '@/lib/timezone-utils';

export interface MinistroRodizio {
  id: string;
  name: string;
  matricula?: string | null;
  cargo_ministerial?: string | null;
  foto_url?: string | null;
  congregacao_id?: string | null;
  congregacao_nome?: string;
  is_ativo?: boolean;
  total_escalas: number;
  ultima_escala_em: string | null;
  is_menos_escalado: boolean;
}

export interface AgendaEventoComEscala {
  id: string;
  ministry_id: string;
  church_id: string | null;
  titulo: string;
  descricao?: string | null;
  tipo?: string | null;
  data_inicio: string;
  data_fim: string;
  local?: string | null;
  status: string;
  visibilidade?: string;
  agenda_tipos?: {
    id: string;
    nome: string;
    categoria?: string;
    cor?: string;
  } | null;
  congregacoes?: {
    id: string;
    nome: string;
    is_sede?: boolean;
  } | null;
  escala_ativa?: {
    id: string;
    agenda_evento_id: string;
    member_id: string;
    status: 'escalado' | 'confirmado';
    tema_mensagem?: string | null;
    texto_biblico?: string | null;
    observacoes?: string | null;
    member?: {
      id: string;
      name: string;
      matricula?: string | null;
      cargo_ministerial?: string | null;
      foto_url?: string | null;
      congregacao_id?: string | null;
    } | null;
    created_at?: string;
  } | null;
}

export interface HistoricoEscalaItem {
  id: string;
  agenda_evento_id: string;
  member_id: string;
  status: 'escalado' | 'confirmado' | 'substituido' | 'cancelado';
  motivo_alteracao?: string | null;
  data_alteracao?: string | null;
  tema_mensagem?: string | null;
  texto_biblico?: string | null;
  observacoes?: string | null;
  created_at: string;
  member?: {
    id: string;
    name: string;
    matricula?: string | null;
    cargo_ministerial?: string | null;
    foto_url?: string | null;
  } | null;
  substituido_por_member?: {
    id: string;
    name: string;
    cargo_ministerial?: string | null;
  } | null;
}

export interface FiltrosEscalaState {
  anoMes: string;
  churchId: string;
  filtroTitulo: string;
  apenasSemPregador: boolean;
  semanaInicio?: string;
  semanaFim?: string;
}

export interface PaginacaoEscala {
  pagina: number;
  itensPorPagina: number;
  total: number;
  totalPaginas: number;
}

export function useEscalaPregadores() {
  const { nivel, congregacaoId, isAdmin, isMaster } = useUserContext();

  const isGlobalUser = useMemo(() => {
    if (isAdmin || isMaster) return true;
    return ['administrador', 'secretario_geral', 'presidencia'].includes(nivel || '');
  }, [isAdmin, isMaster, nivel]);

  const defaultAnoMes = useMemo(() => {
    const today = getLocalDateStr(new Date());
    return today.substring(0, 7); // 'YYYY-MM'
  }, []);

  const [filtros, setFiltros] = useState<FiltrosEscalaState>({
    anoMes: defaultAnoMes,
    churchId: '',
    filtroTitulo: '',
    apenasSemPregador: false,
  });

  const [pagina, setPagina] = useState(1);
  const [paginacao, setPaginacao] = useState<PaginacaoEscala>({
    pagina: 1,
    itensPorPagina: 10,
    total: 0,
    totalPaginas: 1,
  });

  const [eventos, setEventos] = useState<AgendaEventoComEscala[]>([]);
  const [loadingEventos, setLoadingEventos] = useState(false);
  const [erroEventos, setErroEventos] = useState<string | null>(null);

  const [ministros, setMinistros] = useState<MinistroRodizio[]>([]);
  const [loadingMinistros, setLoadingMinistros] = useState(false);
  const [buscaMinistro, setBuscaMinistro] = useState('');

  const [congregacoes, setCongregacoes] = useState<{ id: string; nome: string; is_sede?: boolean }[]>([]);

  // Estados de Modais
  const [modalAtribuirAberto, setModalAtribuirAberto] = useState(false);
  const [modalSubstituirAberto, setModalSubstituirAberto] = useState(false);
  const [modalRemanejarAberto, setModalRemanejarAberto] = useState(false);
  const [modalHistoricoAberto, setModalHistoricoAberto] = useState(false);

  const [eventoSelecionado, setEventoSelecionado] = useState<AgendaEventoComEscala | null>(null);
  const [historicoEvento, setHistoricoEvento] = useState<HistoricoEscalaItem[]>([]);
  const [loadingHistorico, setLoadingHistorico] = useState(false);

  // Carregar congregações para os filtros
  useEffect(() => {
    async function carregarCongregacoes() {
      try {
        const res = await fetch('/api/v1/secretaria/escala-pregadores?acao=congregacoes');
        if (res.ok) {
          const json = await res.json();
          if (Array.isArray(json)) setCongregacoes(json);
          else if (Array.isArray(json.data)) setCongregacoes(json.data);
        }
      } catch (err) {
        console.error('Falha ao carregar congregações:', err);
      }
    }
    carregarCongregacoes();
  }, []);

  // Carregar eventos com escalas (paginado no backend com 10 itens por página)
  const carregarEventos = useCallback(async () => {
    setLoadingEventos(true);
    setErroEventos(null);
    try {
      const params = new URLSearchParams();
      params.set('acao', 'eventos');
      params.set('pagina', String(pagina));
      params.set('itens_por_pagina', '10');
      if (filtros.anoMes) params.set('ano_mes', filtros.anoMes);
      if (filtros.semanaInicio) params.set('data_inicio', filtros.semanaInicio);
      if (filtros.semanaFim) params.set('data_fim', filtros.semanaFim);
      if (filtros.churchId) params.set('church_id', filtros.churchId);
      if (filtros.filtroTitulo) params.set('filtro_titulo', filtros.filtroTitulo);
      if (filtros.apenasSemPregador) params.set('apenas_sem_pregador', 'true');

      const res = await fetch(`/api/v1/secretaria/escala-pregadores?${params.toString()}`);
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || 'Erro ao carregar escala de eventos da agenda.');
      }

      setEventos(json.data || []);
      if (json.paginacao) {
        setPaginacao(json.paginacao);
      } else {
        const totalRegistros = (json.data || []).length;
        setPaginacao({
          pagina,
          itensPorPagina: 10,
          total: totalRegistros,
          totalPaginas: Math.max(1, Math.ceil(totalRegistros / 10)),
        });
      }
    } catch (err: any) {
      setErroEventos(err?.message || 'Falha na comunicação com o servidor.');
    } finally {
      setLoadingEventos(false);
    }
  }, [filtros, pagina]);

  useEffect(() => {
    carregarEventos();
  }, [carregarEventos]);

  // Carregar ministros com rodízio e filtro de disponibilidade de horário
  const carregarMinistros = useCallback(async (
    termo = '',
    opcoes?: {
      dataInicio?: string;
      dataFim?: string;
      ignorarEscalaId?: string;
      agendaEventoId?: string;
    }
  ) => {
    setLoadingMinistros(true);
    try {
      const params = new URLSearchParams();
      params.set('acao', 'ministros');
      if (termo) params.set('busca', termo);
      if (opcoes?.dataInicio) params.set('data_inicio', opcoes.dataInicio);
      if (opcoes?.dataFim) params.set('data_fim', opcoes.dataFim);
      if (opcoes?.ignorarEscalaId) params.set('ignorar_escala_id', opcoes.ignorarEscalaId);
      if (opcoes?.agendaEventoId) params.set('agenda_evento_id', opcoes.agendaEventoId);

      const res = await fetch(`/api/v1/secretaria/escala-pregadores?${params.toString()}`);
      const json = await res.json();
      if (res.ok && Array.isArray(json.data)) {
        setMinistros(json.data);
      }
    } catch (err) {
      console.error('Falha ao carregar ministros:', err);
    } finally {
      setLoadingMinistros(false);
    }
  }, []);

  // Carregar histórico de um evento
  const carregarHistorico = useCallback(async (agendaEventoId: string) => {
    setLoadingHistorico(true);
    try {
      const params = new URLSearchParams();
      params.set('acao', 'historico');
      params.set('agenda_evento_id', agendaEventoId);

      const res = await fetch(`/api/v1/secretaria/escala-pregadores?${params.toString()}`);
      const json = await res.json();
      if (res.ok && Array.isArray(json.data)) {
        setHistoricoEvento(json.data);
      } else {
        setHistoricoEvento([]);
      }
    } catch (err) {
      console.error('Falha ao carregar histórico da escala:', err);
      setHistoricoEvento([]);
    } finally {
      setLoadingHistorico(false);
    }
  }, []);

  // Ações de Gestão de Escala
  const atribuirPregador = async (dados: {
    agenda_evento_id: string;
    member_id: string;
    status?: 'escalado' | 'confirmado';
    tema_mensagem?: string;
    texto_biblico?: string;
    observacoes?: string;
  }) => {
    const res = await fetch('/api/v1/secretaria/escala-pregadores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dados),
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error || 'Erro ao atribuir pregador.');
    }
    await carregarEventos();
    return json.data;
  };

  const editarEscala = async (dados: {
    escala_id: string;
    tema_mensagem?: string;
    texto_biblico?: string;
    observacoes?: string;
    status?: 'escalado' | 'confirmado';
  }) => {
    const res = await fetch('/api/v1/secretaria/escala-pregadores', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operacao: 'editar',
        ...dados,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error || 'Erro ao atualizar dados da escala.');
    }
    await carregarEventos();
    return json.data;
  };

  const substituirPregador = async (dados: {
    escala_id: string;
    novo_member_id: string;
    motivo_alteracao: string;
    status?: 'escalado' | 'confirmado';
    tema_mensagem?: string;
    texto_biblico?: string;
    observacoes?: string;
  }) => {
    const res = await fetch('/api/v1/secretaria/escala-pregadores', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operacao: 'editar',
        ...dados,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error || 'Erro ao substituir pregador.');
    }
    await carregarEventos();
    return json.data;
  };

  const remanejarPregador = async (dados: {
    escala_id: string;
    novo_agenda_evento_id: string;
    motivo_alteracao: string;
  }) => {
    const res = await fetch('/api/v1/secretaria/escala-pregadores', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operacao: 'remanejar',
        ...dados,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error || 'Erro ao remanejar pregador.');
    }
    await carregarEventos();
    return json.data;
  };

  const desfazerEscala = async (escalaId: string, motivo: string) => {
    const params = new URLSearchParams();
    params.set('id', escalaId);
    params.set('motivo', motivo);

    const res = await fetch(`/api/v1/secretaria/escala-pregadores?${params.toString()}`, {
      method: 'DELETE',
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error || 'Erro ao desfazer escala do pregador.');
    }
    await carregarEventos();
    return json;
  };

  return {
    // Permissões
    isGlobalUser,
    userCongregacaoId: congregacaoId,

    // Filtros e Dados
    filtros,
    setFiltros,
    pagina,
    setPagina,
    paginacao,
    congregacoes,
    eventos,
    loadingEventos,
    erroEventos,
    carregarEventos,

    // Ministros e Rodízio
    ministros,
    loadingMinistros,
    buscaMinistro,
    setBuscaMinistro,
    carregarMinistros,

    // Modais e Seleção
    eventoSelecionado,
    setEventoSelecionado,
    modalAtribuirAberto,
    setModalAtribuirAberto,
    modalSubstituirAberto,
    setModalSubstituirAberto,
    modalRemanejarAberto,
    setModalRemanejarAberto,
    modalHistoricoAberto,
    setModalHistoricoAberto,

    // Histórico
    historicoEvento,
    loadingHistorico,
    carregarHistorico,

    // Operações
    atribuirPregador,
    editarEscala,
    substituirPregador,
    remanejarPregador,
    desfazerEscala,
  };
}
