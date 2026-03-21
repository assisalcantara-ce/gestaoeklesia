/**
 * HOOKS REACT para usar API de Membros
 * Arquivo: src/hooks/useMembers.ts
 * 
 * Exemplos de uso:
 * const { members, loading, error, createMember, updateMember, deleteMember } = useMembers()
 */

'use client'

import { useCallback, useState } from 'react'
import type { Member, CreateMemberRequest, UpdateMemberRequest } from '@/types/supabase'
import { createClient } from '@/lib/supabase-client'

async function getAccessTokenOrThrow() {
  const supabase = createClient()
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Não autenticado')
  return token
}

export function useMembers() {
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Listar membros
  const fetchMembers = useCallback(
    async (page = 1, limit = 20, filters?: { status?: string; search?: string; tipoCadastro?: string }) => {
      try {
        setLoading(true)
        setError(null)

        const params = new URLSearchParams({
          page: page.toString(),
          limit: limit.toString(),
          ...(filters?.status && { status: filters.status }),
          ...(filters?.search && { search: filters.search }),
          ...(filters?.tipoCadastro && { tipoCadastro: filters.tipoCadastro }),
        })

        const accessToken = await getAccessTokenOrThrow()

        const response = await fetch(`/api/v1/members?${params}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
        })

        if (!response.ok) {
          const errorData = await response
            .json()
            .catch(() => ({} as any))

          const message =
            (errorData && typeof errorData.error === 'string' && errorData.error) ||
            'Erro ao carregar membros'

          // Caso comum em ambiente de trial/onboarding: usuário autenticado, mas ainda sem vínculo em ministry_users
          if (response.status === 403 && errorData?.code === 'NO_MINISTRY') {
            setMembers([])
            setError(message)
            return {
              data: [],
              pagination: {
                page,
                limit,
                total: 0,
                total_pages: 0,
              },
            }
          }

          throw new Error(message)
        }

        const data = await response.json()
        setMembers(data.data)

        return data
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro desconhecido'
        setError(message)
        throw err
      } finally {
        setLoading(false)
      }
    },
    []
  )

  // Obter um membro
  const getMember = useCallback(async (id: string) => {
    try {
      const accessToken = await getAccessTokenOrThrow()
      const response = await fetch(`/api/v1/members/${id}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      if (!response.ok) {
        throw new Error('Membro não encontrado')
      }

      return await response.json()
    } catch (err) {
      throw err
    }
  }, [])

  // Criar membro
  const createMember = useCallback(
    async (data: CreateMemberRequest) => {
      try {
        setLoading(true)
        setError(null)

        const accessToken = await getAccessTokenOrThrow()

        const response = await fetch('/api/v1/members', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(data),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Erro ao criar membro')
        }

        const newMember = await response.json()
        setMembers((prev) => [...prev, newMember])

        return newMember
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro desconhecido'
        setError(message)
        throw err
      } finally {
        setLoading(false)
      }
    },
    []
  )

  // Atualizar membro
  const updateMember = useCallback(
    async (id: string, data: UpdateMemberRequest) => {
      try {
        setLoading(true)
        setError(null)

        const accessToken = await getAccessTokenOrThrow()

        const response = await fetch(`/api/v1/members/${id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(data),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Erro ao atualizar membro')
        }

        const updated = await response.json()
        setMembers((prev) =>
          prev.map((member) => (member.id === id ? updated : member))
        )

        return updated
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro desconhecido'
        setError(message)
        throw err
      } finally {
        setLoading(false)
      }
    },
    []
  )

  // Deletar membro
  const deleteMember = useCallback(
    async (id: string) => {
      try {
        setLoading(true)
        setError(null)

        const accessToken = await getAccessTokenOrThrow()

        const response = await fetch(`/api/v1/members/${id}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Erro ao deletar membro')
        }

        setMembers((prev) => prev.filter((member) => member.id !== id))

        return true
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro desconhecido'
        setError(message)
        throw err
      } finally {
        setLoading(false)
      }
    },
    []
  )

  // Limpar erro
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  return {
    members,
    loading,
    error,
    clearError,
    fetchMembers,
    getMember,
    createMember,
    updateMember,
    deleteMember,
  }
}
