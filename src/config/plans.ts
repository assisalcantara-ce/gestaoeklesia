import { Plan } from '@/types/ministry';

export const PLANOS_DISPONIBLES: { [key: string]: Plan } = {
  starter: {
    id: 'starter',
    nome: 'Plano Starter',
    preco_mensal: 99.90,
    preco_anual: 999.00,
    descricao: 'Ideal para ministérios pequenos',
    usuarios_max: 10,
    armazenamento_gb: 5,
    recursos: [
      'Até 10 usuários',
      '5 GB de armazenamento',
      'Dashboard básico',
      'Suporte por email',
      'Relatórios simples',
      'Backup semanal'
    ],
    cor: 'bg-blue-50 border-blue-200'
  },
  professional: {
    id: 'professional',
    nome: 'Plano Professional',
    preco_mensal: 199.90,
    preco_anual: 1999.00,
    descricao: 'Ideal para ministérios em crescimento',
    usuarios_max: 50,
    armazenamento_gb: 50,
    recursos: [
      'Até 50 usuários',
      '50 GB de armazenamento',
      'Dashboard avançado',
      'Suporte por email e chat',
      'Relatórios detalhados',
      'Backup diário',
      'Integração com sistemas externos',
      'API própria'
    ],
    cor: 'bg-green-50 border-green-200'
  },
  enterprise: {
    id: 'enterprise',
    nome: 'Plano Enterprise',
    preco_mensal: 499.90,
    preco_anual: 4999.00,
    descricao: 'Ideal para grandes redes de ministérios',
    usuarios_max: 500,
    armazenamento_gb: 500,
    recursos: [
      'Até 500 usuários',
      '500 GB de armazenamento',
      'Dashboard customizável',
      'Suporte 24/7 (phone + email + chat)',
      'Relatórios em tempo real',
      'Backup em tempo real',
      'API ilimitada',
      'Consultoria incluída',
      'Custom branding',
      'SSO (Single Sign-On)',
      'Gestor de conta dedicado'
    ],
    cor: 'bg-purple-50 border-purple-200'
  }
};

export const getPlanoById = (id: string): Plan | undefined => {
  return PLANOS_DISPONIBLES[id];
};

export const formatarPreco = (valor: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(valor);
};
