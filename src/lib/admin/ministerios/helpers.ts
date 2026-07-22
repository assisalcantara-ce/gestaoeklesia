'use client'

import { onlyDigits, formatPhone } from '@/lib/mascaras'

/**
 * Mapeia mensagens de erro técnicas do banco de dados/autenticação
 * para mensagens amigáveis para o usuário.
 */
export function friendlyError(msg: string): string {
  if (!msg) return msg
  if (msg.includes('ministries_email_admin_key') || (msg.includes('duplicate key') && msg.includes('email')))
    return 'Este e-mail já está cadastrado em outro ministério. Utilize um e-mail diferente.'
  if (msg.includes('duplicate key') || msg.includes('unique constraint'))
    return 'Já existe um registro com esses dados. Verifique os campos e tente novamente.'
  if (msg.includes('auth/email-already-in-use') || msg.includes('User already registered'))
    return 'Este e-mail já possui uma conta no sistema. Utilize outro e-mail de acesso.'
  return msg
}

/**
 * Retorna as classes CSS e label correspondentes ao status detalhado da assinatura de um ministério.
 */
export function getDetailedStatus(m: {
  is_active?: boolean
  subscription_status?: string | null
  subscription_end_date?: string | null
}) {
  if (!m.is_active || m.subscription_status === 'suspended') {
    return {
      label: 'Suspenso',
      class: 'bg-red-900/60 text-red-200 border border-red-700/50',
      type: 'SUSPENSO'
    }
  }
  if (m.subscription_status === 'cancelled') {
    return {
      label: 'Cancelado',
      class: 'bg-gray-700 text-gray-300 border border-gray-600',
      type: 'CANCELADO'
    }
  }
  if (m.subscription_status === 'trial') {
    const expiresAt = m.subscription_end_date ? new Date(m.subscription_end_date) : null
    const now = new Date()
    if (expiresAt && expiresAt.getTime() <= now.getTime()) {
      return {
        label: 'Teste Expirado',
        class: 'bg-red-950 text-red-400 border border-red-800',
        type: 'TRIAL_EXPIRADO',
        expiresAt
      }
    } else {
      const diffTime = expiresAt ? expiresAt.getTime() - now.getTime() : 0
      const diffDays = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)))
      return {
        label: `Teste — restam ${diffDays} dias`,
        class: 'bg-blue-900/80 text-blue-200 border border-blue-700',
        type: 'TRIAL_ATIVO',
        expiresAt
      }
    }
  }
  if (m.subscription_status === 'active') {
    return {
      label: 'Ativo',
      class: 'bg-green-900/80 text-green-200 border border-green-700',
      type: 'ATIVO'
    }
  }
  return {
    label: m.is_active ? 'Ativo' : 'Inativo',
    class: m.is_active ? 'bg-green-900 text-green-200' : 'bg-gray-700 text-gray-300',
    type: m.is_active ? 'ATIVO' : 'SUSPENSO'
  }
}

/**
 * Formata um número de telefone com máscara legível.
 */
export function formatPhoneDisplay(value: string | null | undefined): string {
  const digits = onlyDigits(value || '')
  if (!digits) return '-'
  return formatPhone(digits)
}

/**
 * Mapeia o preço padrão de cada plano comercial por slug.
 */
export function getPlanPrice(slug: string, planos: { slug: string; price_monthly: string | number }[] = []): number {
  const p = planos.find((x) => x.slug === slug)
  return p ? Number(p.price_monthly) : 99
}
