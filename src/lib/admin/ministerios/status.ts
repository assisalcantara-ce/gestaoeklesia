/**
 * Módulo Isomórfico (Server/Client) de Regras de Status de Ministérios
 * Arquivo: src/lib/admin/ministerios/status.ts
 * 
 * Regra oficial e única de classificação do status das assinaturas e licenças dos clientes/tenants.
 */

export interface MinistryStatusInput {
  is_active?: boolean
  subscription_status?: string | null
  subscription_end_date?: string | null
}

export interface MinistryStatusOutput {
  label: string
  class: string
  type: 'ATIVO' | 'TRIAL_ATIVO' | 'TRIAL_EXPIRADO' | 'SUSPENSO' | 'CANCELADO'
  expiresAt?: Date | null
}

/**
 * Retorna as classes CSS e label correspondentes ao status detalhado da assinatura de um ministério.
 */
export function getDetailedStatus(m: MinistryStatusInput): MinistryStatusOutput {
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
