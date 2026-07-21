import { LifecycleResult } from '../lifecycle/types';

export interface ComercialViewModel {
  id: string;
  origem: 'pre_registrations' | 'ministries' | 'oportunidades_comerciais';
  nome: string;
  responsavel: string;
  email: string;
  telefone: string;
  lifecycle: LifecycleResult;
  plano: string;
  statusFinanceiro: 'pending' | 'paid' | 'overdue' | 'cancelled' | 'none';
  ultimaInteracao: string | null;
  proximaAcao: string | null;
  daysRemaining?: number;
  reason: string;
  
  // -- Propriedades Legadas de Retrocompatibilidade para a Interface --
  ministry_name: string;
  plano_solicitado: string;
  observacao: string | null;
  observacao_interna: string | null;
  created_at: string;
  status: string;
  historico: Array<{
    id: string;
    status_anterior: string;
    status_novo: string;
    usuario: string;
    observacao: string;
    created_at: string;
  }>;
}

