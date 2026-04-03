import { Plan } from '@/types/ministry';

export const PLANOS_DISPONIBLES: { [key: string]: Plan } = {
  starter: {
    id: 'starter',
    nome: 'Starter',
    preco_mensal: 149.99,
    preco_anual: 1499.99,
    descricao: 'Ideal para instituicoes pequenas iniciando na plataforma',
    usuarios_max: 3,
    armazenamento_gb: 0,
    recursos: [
      'Ate 5 Campos',
      'Ate 50 Igrejas',
      'Ate 500 Membros',
      'Ate 3 Usuarios Administrativos'
    ],
    cor: 'bg-blue-50 border-blue-200'
  },
  intermediario: {
    id: 'intermediario',
    nome: 'Intermediario',
    preco_mensal: 299.99,
    preco_anual: 2999.99,
    descricao: 'Solucao completa para instituicoes de grande porte e em crescimento.',
    usuarios_max: 10,
    armazenamento_gb: 0,
    recursos: [
      'Ate 20 Campos',
      'Ate 250 Igrejas',
      'Ate 3.000 Membros',
      'Ate 10 Usuarios Administrativos'
    ],
    cor: 'bg-sky-50 border-sky-200'
  },
  profissional: {
    id: 'profissional',
    nome: 'Profissional',
    preco_mensal: 499.99,
    preco_anual: 4999.99,
    descricao: 'Solucao completa para instituicoes em fase de expansao acelerada',
    usuarios_max: 25,
    armazenamento_gb: 0,
    recursos: [
      'Ate 50 Campos',
      'Ate 600 Igrejas',
      'Ate 7.000 Membros',
      'Ate 25 Usuarios Administrativos'
    ],
    cor: 'bg-indigo-50 border-indigo-200'
  },
  expert: {
    id: 'expert',
    nome: 'Expert',
    preco_mensal: 999.0,
    preco_anual: 9999.99,
    descricao: 'Personalizado para grandes instituicoes com alto fluxo de atividades.',
    usuarios_max: 999,
    armazenamento_gb: 0,
    recursos: [
      'Ate 999 Campos',
      'Ate 999 Igrejas',
      'Ate 99.999 Membros',
      'Ate 999 Usuarios Administrativos'
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
