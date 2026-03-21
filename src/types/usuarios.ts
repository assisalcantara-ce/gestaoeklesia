/**
 * Tipos consolidados para o sistema de usuários e permissões
 */

export type NivelAcesso = 'administrador' | 'financeiro' | 'operador' | 'supervisor' | 'superintendente' | 'coordenador';

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  nivel: NivelAcesso;
  congregacao?: string; // Para Operadores
  supervisao?: string; // Para Supervisores
  status: 'ativo' | 'inativo';
  criado_em?: string;
  atualizado_em?: string;
}

export interface Supervisao {
  id: string;
  nome: string;
  descricao?: string;
  cidade?: string;
  endereco?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Congregacao {
  id: string;
  nome: string;
  endereco?: string;
  cidade?: string;
  latitude?: string;
  longitude?: string;
  supervisao_id?: string;
  status: 'ativo' | 'inativo';
  created_at: string;
  updated_at: string;
}

export interface Membro {
  id: string;
  nome: string;
  email?: string;
  celular?: string;
  logradouro?: string;
  numero?: string;
  bairro?: string;
  cidade?: string;
  latitude?: string;
  longitude?: string;
  status: 'ativo' | 'inativo';
  tipoCadastro: 'membro' | 'congregado' | 'ministro' | 'crianca';
  congregacao?: string;
  congregacao_id?: string;
  supervisao?: string;
  fotoUrl?: string;
  created_at: string;
  updated_at: string;
}

export interface NivelAcessoInfo {
  id: NivelAcesso;
  nome: string;
  descricao: string;
  icon: string;
  cor: string;
}
