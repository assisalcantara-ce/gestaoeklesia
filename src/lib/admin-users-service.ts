import 'server-only'

import bcrypt from 'bcrypt'
import { createServerClient } from '@/lib/supabase-server'

export interface AdminUser {
  id: string
  email: string
  role: 'admin' | 'financeiro' | 'suporte'
  nome: string
  cpf?: string
  rg?: string
  data_nascimento?: string
  data_admissao: string
  status: 'ATIVO' | 'INATIVO'
  telefone?: string
  whatsapp?: string
  cep?: string
  endereco?: string
  cidade?: string
  bairro?: string
  uf?: string
  banco?: string
  agencia?: string
  conta_corrente?: string
  pix?: string
  obs?: string
  funcao?: string
  grupo?: string
  criado_em: string
  atualizado_em: string
}

export interface AdminUserForm extends Omit<AdminUser, 'id' | 'criado_em' | 'atualizado_em'> {
  password?: string
}

/**
 * Lista todos os usuários administrativos
 */
export async function getAllAdminUsers(): Promise<AdminUser[]> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('admin_users')
    .select('*')
    .eq('status', 'ATIVO')
    .order('criado_em', { ascending: false })

  if (error) {
    console.error('Erro ao listar usuários:', error)
    throw new Error(error.message)
  }

  return data || []
}

/**
 * Obtém um usuário administrativo por ID
 */
export async function getAdminUserById(id: string): Promise<AdminUser | null> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('admin_users')
    .select('*')
    .eq('id', id)
    .single()

  if (error && error.code !== 'PGRST116') {
    console.error('Erro ao buscar usuário:', error)
    throw new Error(error.message)
  }

  return data || null
}

/**
 * Obtém um usuário administrativo por email
 */
export async function getAdminUserByEmail(email: string): Promise<AdminUser | null> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('admin_users')
    .select('*')
    .eq('email', email)
    .single()

  if (error && error.code !== 'PGRST116') {
    console.error('Erro ao buscar usuário por email:', error)
    throw new Error(error.message)
  }

  return data || null
}

/**
 * Cria um novo usuário administrativo
 */
export async function createAdminUser(userData: AdminUserForm): Promise<AdminUser> {
  // Validações básicas
  if (!userData.email || !userData.password) {
    throw new Error('Email e senha são obrigatórios')
  }

  if (!userData.nome) {
    throw new Error('Nome é obrigatório')
  }

  // Verifica se email já existe
  const existing = await getAdminUserByEmail(userData.email)
  if (existing) {
    throw new Error('Este email já está cadastrado')
  }

  const supabase = createServerClient()

  // Cria usuário no Supabase Auth (necessário para login)
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: userData.email,
    password: userData.password,
    email_confirm: true,
  })

  if (authError || !authData.user) {
    throw new Error(authError?.message || 'Erro ao criar usuário no sistema de autenticação')
  }

  // Cria registro em admin_users vinculado ao auth user
  const { data, error } = await supabase
    .from('admin_users')
    .insert([
      {
        user_id: authData.user.id,
        email: userData.email,
        password_hash: await bcrypt.hash(userData.password, 10),
        role: userData.role,
        can_manage_ministries: ['admin', 'super_admin'].includes(userData.role) || false,
        can_manage_payments: ['admin', 'super_admin', 'financeiro'].includes(userData.role) || false,
        can_manage_plans: ['admin', 'super_admin'].includes(userData.role) || false,
        can_manage_support: ['admin', 'super_admin', 'suporte'].includes(userData.role) || false,
        nome: userData.nome,
        cpf: userData.cpf,
        rg: userData.rg,
        data_nascimento: userData.data_nascimento,
        data_admissao: userData.data_admissao || new Date().toISOString().split('T')[0],
        status: userData.status || 'ATIVO',
        telefone: userData.telefone,
        whatsapp: userData.whatsapp,
        cep: userData.cep,
        endereco: userData.endereco,
        cidade: userData.cidade,
        bairro: userData.bairro,
        uf: userData.uf,
        banco: userData.banco,
        agencia: userData.agencia,
        conta_corrente: userData.conta_corrente,
        pix: userData.pix,
        obs: userData.obs,
        funcao: userData.funcao,
        grupo: userData.grupo,
      },
    ])
    .select()
    .single()

  if (error) {
    // Rollback: remove o auth user criado para não deixar órfão
    await supabase.auth.admin.deleteUser(authData.user.id)
    console.error('Erro ao criar usuário:', error)
    throw new Error(error.message)
  }

  return data
}

/**
 * Atualiza um usuário administrativo
 */
export async function updateAdminUser(id: string, userData: Partial<AdminUserForm>): Promise<AdminUser> {
  const supabase = createServerClient()
  const { password, ...updateData } = userData

  const { data, error } = await supabase
    .from('admin_users')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Erro ao atualizar usuário:', error)
    throw new Error(error.message)
  }

  return data
}

/**
 * Deleta um usuário administrativo
 */
export async function deleteAdminUser(id: string): Promise<void> {
  const supabase = createServerClient()
  // Verifica se é o último admin
  const { count, error: countError } = await supabase
    .from('admin_users')
    .select('*', { count: 'exact', head: true })
    .eq('role', 'admin')
    .eq('status', 'ATIVO')

  if (countError) {
    throw new Error(countError.message)
  }

  if (count === 1) {
    const user = await getAdminUserById(id)
    if (user && user.role === 'admin') {
      throw new Error('Não é possível deletar o último usuário administrador')
    }
  }

  // Soft delete - marca como inativo
  const { error } = await supabase
    .from('admin_users')
    .update({ status: 'INATIVO' })
    .eq('id', id)

  if (error) {
    console.error('Erro ao deletar usuário:', error)
    throw new Error(error.message)
  }
}

/**
 * Valida CPF (formato básico)
 */
export function validateCPF(cpf: string): boolean {
  const cleaned = cpf.replace(/\D/g, '')
  return cleaned.length === 11
}

/**
 * Formata CPF
 */
export function formatCPF(cpf: string): string {
  const cleaned = cpf.replace(/\D/g, '')
  return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
}

/**
 * Valida telefone
 */
export function validatePhone(phone: string): boolean {
  const cleaned = phone.replace(/\D/g, '')
  return cleaned.length >= 10 && cleaned.length <= 11
}

/**
 * Formata telefone
 */
export function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.length === 11) {
    return cleaned.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
  }
  return cleaned.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3')
}

/**
 * Formata CEP
 */
export function formatCEP(cep: string): string {
  const cleaned = cep.replace(/\D/g, '')
  return cleaned.replace(/(\d{5})(\d{3})/, '$1-$2')
}
