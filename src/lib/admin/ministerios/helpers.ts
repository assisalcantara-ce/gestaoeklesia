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

import { getDetailedStatus } from './status'
export { getDetailedStatus }

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
