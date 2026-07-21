import { LifecycleResult } from '../lifecycle/types'

export interface OportunidadeComercial {
  id: string
  ministry_id: string
  ministry_name: string
  responsavel: string
  email: string
  telefone: string
  plano_solicitado: string
  observacao: string | null
  observacao_interna: string | null
  status: string
  created_at: string
  updated_at?: string
  updated_by?: string | null
}

export interface HistoricoComercial {
  id: string
  oportunidade_id: string
  status_anterior: string
  status_novo: string
  usuario: string
  observacao: string
  created_at: string
}

export interface CrmActivity {
  id: string;
  oportunidadeId: string;
  ministryId: string | null;
  nome: string;
  responsavel: string;
  status: string;
  prioridade: string;
  dataCriacao: string;
  ultimaAtualizacao: string;
  tipo?: string;
  descricao?: string;
  dataExecucao?: string;
  usuarioResponsavel?: string;
}


export interface CrmTimelineItem {
  id: string;
  data: string;
  evento: string;
  usuario: string;
  descricao: string;
}

export interface CrmNextAction {
  id: string;
  oportunidadeId: string;
  ministryId: string | null;
  nome: string;
  acao: string;
  prioridade: 'baixa' | 'media' | 'alta' | string;
  vencimento: string;
  lifecycle: LifecycleResult;
  descricao?: string;
  dataPrevista?: string;
}


export interface CrmSummary {
  totalLeads: number;
  totalTrials: number;
  totalClientesAtivos: number;
  totalRenovacoes: number;
  totalCobrancasPendentes: number;
  totalNegociacoes: number;
  totalCancelados: number;
}


