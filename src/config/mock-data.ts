import { Ministry } from '@/types/ministry';

// Dados simulados de ministérios/empresas clientes
export const ministeriiosSimulados: Ministry[] = [
  {
    id: 'min001',
    nome: 'Igreja Central de São Paulo',
    email_admin: 'admin@igrejacentralsp.com.br',
    senha_hash: 'hashed_password_001', // Em produção, seria hash real
    cnpj_cpf: '12.345.678/0001-90',
    telefone: '(11) 3456-7890',
    endereco: 'Avenida Paulista, 1000',
    cidade: 'São Paulo',
    estado: 'SP',
    site: 'www.igrejacentralsp.com.br',
    logo: '/logos/igreja-central-sp.png',
    data_cadastro: '2025-01-15',
    data_ultima_atualizacao: '2025-11-25',
    status: 'ativo',
    subscription: {
      id: 'sub001',
      ministry_id: 'min001',
      plan_id: 'professional',
      status: 'ativo',
      data_inicio: '2025-01-15',
      data_vencimento: '2026-01-15',
      tipo_pagamento: 'anual',
      valor_pago: 1999.00,
      renovacao_automatica: true
    },
    usuarios_count: 28,
    ultimo_acesso: '2025-11-29T14:30:00'
  },
  {
    id: 'min002',
    nome: 'Ministério das Assembleias - Rio de Janeiro',
    email_admin: 'admin@assembleias-rj.com.br',
    senha_hash: 'hashed_password_002',
    cnpj_cpf: '12.345.678/0002-70',
    telefone: '(21) 2345-6789',
    endereco: 'Rua das Flores, 500',
    cidade: 'Rio de Janeiro',
    estado: 'RJ',
    site: 'www.assembleias-rj.com.br',
    data_cadastro: '2025-02-20',
    data_ultima_atualizacao: '2025-11-28',
    status: 'ativo',
    subscription: {
      id: 'sub002',
      ministry_id: 'min002',
      plan_id: 'starter',
      status: 'ativo',
      data_inicio: '2025-02-20',
      data_vencimento: '2025-12-20',
      tipo_pagamento: 'mensal',
      valor_pago: 99.90,
      renovacao_automatica: true
    },
    usuarios_count: 8,
    ultimo_acesso: '2025-11-29T10:15:00'
  },
  {
    id: 'min003',
    nome: 'Rede Nacional de Igrejas Evangélicas',
    email_admin: 'admin@rnie.com.br',
    senha_hash: 'hashed_password_003',
    cnpj_cpf: '12.345.678/0003-50',
    telefone: '(31) 3456-7890',
    endereco: 'Avenida Brasil, 2000',
    cidade: 'Belo Horizonte',
    estado: 'MG',
    site: 'www.rnie.com.br',
    data_cadastro: '2024-06-10',
    data_ultima_atualizacao: '2025-11-26',
    status: 'ativo',
    subscription: {
      id: 'sub003',
      ministry_id: 'min003',
      plan_id: 'enterprise',
      status: 'ativo',
      data_inicio: '2024-06-10',
      data_vencimento: '2026-06-10',
      tipo_pagamento: 'anual',
      valor_pago: 4999.00,
      renovacao_automatica: true
    },
    usuarios_count: 145,
    ultimo_acesso: '2025-11-29T16:45:00'
  },
  {
    id: 'min004',
    nome: 'Comunidade de Fé Brasília',
    email_admin: 'admin@comunidadefedf.com.br',
    senha_hash: 'hashed_password_004',
    cnpj_cpf: '12.345.678/0004-30',
    telefone: '(61) 3456-7890',
    endereco: 'Setor Sul, Bloco A',
    cidade: 'Brasília',
    estado: 'DF',
    data_cadastro: '2025-09-05',
    data_ultima_atualizacao: '2025-11-29',
    status: 'ativo',
    subscription: {
      id: 'sub004',
      ministry_id: 'min004',
      plan_id: 'professional',
      status: 'pendente',
      data_inicio: '2025-09-05',
      data_vencimento: '2026-09-05',
      tipo_pagamento: 'anual',
      valor_pago: 1999.00,
      renovacao_automatica: false
    },
    usuarios_count: 35,
    ultimo_acesso: '2025-11-28T09:20:00'
  },
  {
    id: 'min005',
    nome: 'Igreja Vida Nova - Salvador',
    email_admin: 'admin@viidanova-salvador.com.br',
    senha_hash: 'hashed_password_005',
    cnpj_cpf: '12.345.678/0005-10',
    telefone: '(71) 3456-7890',
    endereco: 'Avenida Oceânica, 300',
    cidade: 'Salvador',
    estado: 'BA',
    data_cadastro: '2025-11-15',
    data_ultima_atualizacao: '2025-11-29',
    status: 'inativo',
    subscription: {
      id: 'sub005',
      ministry_id: 'min005',
      plan_id: 'starter',
      status: 'expirado',
      data_inicio: '2025-11-15',
      data_vencimento: '2025-11-20',
      tipo_pagamento: 'mensal',
      valor_pago: 99.90,
      renovacao_automatica: false
    },
    usuarios_count: 5,
    ultimo_acesso: '2025-11-20T11:30:00'
  }
];

// Dados de admin simulados
export const adminsSimulados = [
  {
    id: 'admin001',
    email: 'super@gestaoeclesial.com.br',
    senha_hash: 'hashed_super_admin_password',
    nome: 'Super Administrador',
    role: 'super_admin' as const,
    data_cadastro: '2024-12-01',
    ultimo_acesso: '2025-11-29T18:00:00',
    ativo: true
  },
  {
    id: 'admin002',
    email: 'suporte@gestaoeclesial.com.br',
    senha_hash: 'hashed_suporte_password',
    nome: 'Suporte Gestão Eclesial',
    role: 'suporte' as const,
    data_cadastro: '2025-01-10',
    ultimo_acesso: '2025-11-29T17:30:00',
    ativo: true
  }
];
