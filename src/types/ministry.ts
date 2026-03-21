// Tipos para Ministérios/Empresas Clientes

export type PlanType = 'starter' | 'professional' | 'enterprise';
export type SubscriptionStatus = 'ativo' | 'pendente' | 'cancelado' | 'expirado';

export interface Plan {
  id: PlanType;
  nome: string;
  preco_mensal: number;
  preco_anual: number;
  descricao: string;
  usuarios_max: number;
  armazenamento_gb: number;
  recursos: string[];
  cor: string;
}

export interface Subscription {
  id: string;
  ministry_id: string;
  plan_id: PlanType;
  status: SubscriptionStatus;
  data_inicio: string;
  data_vencimento: string;
  tipo_pagamento: 'mensal' | 'anual';
  valor_pago: number;
  renovacao_automatica: boolean;
}

export interface Ministry {
  id: string;
  nome: string;
  email_admin: string;
  senha_hash: string; // Senha mestra do ministério
  cnpj_cpf?: string;
  telefone?: string;
  endereco?: string;
  cidade?: string;
  estado?: string;
  site?: string;
  logo?: string;
  data_cadastro: string;
  data_ultima_atualizacao: string;
  status: 'ativo' | 'inativo' | 'bloqueado';
  subscription: Subscription;
  usuarios_count: number;
  ultimo_acesso?: string;
}

export interface AdminUser {
  id: string;
  email: string;
  senha_hash: string;
  nome: string;
  role: 'super_admin' | 'admin' | 'suporte';
  data_cadastro: string;
  ultimo_acesso?: string;
  ativo: boolean;
}
