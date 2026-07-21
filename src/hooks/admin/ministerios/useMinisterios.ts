'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { authenticatedFetch } from '@/lib/api-client'
import type { Ministry as SupabaseMinistry } from '@/types/supabase'

interface UseMinisteriosOptions {
  currentPage: number
  itemsPerPage: number
  isAuthenticated: boolean
  adminUser: any
  setError: (msg: string) => void
}

export function useMinisterios({
  currentPage,
  itemsPerPage,
  isAuthenticated,
  adminUser,
  setError,
}: UseMinisteriosOptions) {
  const [ministerios, setMinisterios] = useState<SupabaseMinistry[]>([])
  const [loading, setLoading] = useState(true)
  const [totalItems, setTotalItems] = useState(0)
  const router = useRouter()

  const fetchMinisterios = async () => {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)
    try {
      setLoading(true)
      const response = await authenticatedFetch(`/api/v1/admin/ministries?page=${currentPage}&limit=${itemsPerPage}`, {
        signal: controller.signal,
      })
      if (!response.ok) {
        if (response.status === 401) {
          router.push('/admin/login')
          return
        }
        if (response.status === 403) {
          setError('Acesso negado para este recurso.')
          return
        }
        throw new Error('Erro ao carregar ministérios')
      }

      const data = await response.json()
      setMinisterios(data.data || [])
      setTotalItems(data.count || 0)
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        setError('Tempo limite ao carregar ministérios. Tente novamente.')
      } else {
        setError(err.message)
      }
    } finally {
      clearTimeout(timeoutId)
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isAuthenticated && adminUser) {
      fetchMinisterios()
    }
  }, [isAuthenticated, adminUser, currentPage])

  return {
    ministerios,
    setMinisterios,
    loading,
    totalItems,
    fetchMinisterios,
  }
}
