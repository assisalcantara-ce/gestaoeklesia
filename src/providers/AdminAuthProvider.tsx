'use client'

import { createContext, useContext, useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase-client'
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js'

interface AdminUser {
  id: string
  email: string
  nome: string
  role: string
  status: string
}

interface AdminAuthContextType {
  adminUser: AdminUser | null
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  isAdmin: boolean
  // Novos estados de Impersonação (Admin Impersonation 2.0B - Sem interface visual)
  isImpersonating: boolean
  originalAdmin: { id: string; email: string; role: string; nome?: string } | null
  targetTenant: { id: string; name: string } | null
  readOnly: boolean
  impersonationSessionId: string | null
  logout: () => Promise<void>
}

const AdminAuthContext = createContext<AdminAuthContextType>({
  adminUser: null,
  user: null,
  isLoading: true,
  isAuthenticated: false,
  isAdmin: false,
  isImpersonating: false,
  originalAdmin: null,
  targetTenant: null,
  readOnly: false,
  impersonationSessionId: null,
  logout: async () => {},
})

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)

  // Estados de Impersonação (Sem elementos visuais)
  const [isImpersonating, setIsImpersonating] = useState(false)
  const [originalAdmin, setOriginalAdmin] = useState<{ id: string; email: string; role: string; nome?: string } | null>(null)
  const [targetTenant, setTargetTenant] = useState<{ id: string; name: string } | null>(null)
  const [readOnly, setReadOnly] = useState(false)
  const [impersonationSessionId, setImpersonationSessionId] = useState<string | null>(null)

  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null)

  useEffect(() => {
    // Inicializar Supabase apenas aqui, dentro do useEffect
    if (!supabaseRef.current) {
      supabaseRef.current = createClient()
    }
    
    const supabase = supabaseRef.current
    
    const checkAdminSession = async () => {
      try {
        // Impersonation 2.0B: Verificar se há token de impersonação ativo no navegador
        if (typeof window !== 'undefined') {
          const impToken = sessionStorage.getItem('eklesia_impersonation_token') || localStorage.getItem('eklesia_impersonation_token')
          if (impToken) {
            try {
              const statusRes = await fetch(`/api/v1/admin/impersonate/status?token=${encodeURIComponent(impToken)}`)
              if (statusRes.ok) {
                const statusData = await statusRes.json()
                if (statusData.valid && statusData.status === 'active') {
                  setIsImpersonating(true)
                  setOriginalAdmin(statusData.session?.adminId ? {
                    id: statusData.session.adminId,
                    email: statusData.session.adminEmail || '',
                    role: 'super_admin'
                  } : null)
                  setTargetTenant(statusData.tenant)
                  setReadOnly(!!statusData.readOnly)
                  setImpersonationSessionId(statusData.session?.id || null)
                } else {
                  // Token expirado ou revogado
                  sessionStorage.removeItem('eklesia_impersonation_token')
                  localStorage.removeItem('eklesia_impersonation_token')
                  setIsImpersonating(false)
                  setOriginalAdmin(null)
                  setTargetTenant(null)
                  setReadOnly(false)
                  setImpersonationSessionId(null)
                }
              }
            } catch (e) {
              console.warn('[AdminAuthProvider] Falha ao verificar status da impersonação:', e)
            }
          }
        }

        // Primeiro, verificar se há sessão Supabase
        const {
          data: { user: sessionUser },
        } = await supabase.auth.getUser()

        if (!sessionUser) {
          setUser(null)
          setAdminUser(null)
          setIsAuthenticated(false)
          setIsAdmin(false)
          setIsLoading(false)
          return
        }

        setUser(sessionUser)

        // Depois, verificar se o usuário é admin via API server-side
        const { data: sessionData } = await supabase.auth.getSession()
        const accessToken = sessionData.session?.access_token

        if (!accessToken) {
          setAdminUser(null)
          setIsAdmin(false)
          setIsAuthenticated(false)
          return
        }

        const verifyUrl = '/api/v1/admin/verify'
        const verifyInit: RequestInit = {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          credentials: 'same-origin',
        }

        let response: Response
        try {
          response = await fetch(verifyUrl, verifyInit)
        } catch {
          response = await fetch(`${window.location.origin}${verifyUrl}`, verifyInit)
        }

        if (!response.ok) {
          setAdminUser(null)
          setIsAdmin(false)
          setIsAuthenticated(false)
          return
        }

        const admin = (await response.json()) as AdminUser
        setAdminUser(admin)
        setIsAdmin(true)
        setIsAuthenticated(true)
      } catch (error) {
        console.error('Erro de rede ao verificar sessão de admin:', error)
        setUser(null)
        setAdminUser(null)
        setIsAuthenticated(false)
        setIsAdmin(false)
      } finally {
        setIsLoading(false)
      }
    }

    checkAdminSession()

    // Ouvir mudanças de autenticação
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      if (!session?.user || event === 'SIGNED_OUT') {
        // Token expirado/revogado ou logout explícito
        setUser(null)
        setAdminUser(null)
        setIsAuthenticated(false)
        setIsAdmin(false)
        setIsLoading(false)
        setIsImpersonating(false)
        setOriginalAdmin(null)
        setTargetTenant(null)
        setReadOnly(false)
        setImpersonationSessionId(null)
      } else if (event === 'SIGNED_IN') {
        // Só re-verifica admin no login, não em cada TOKEN_REFRESHED
        setUser(session.user)
        checkAdminSession()
      } else {
        // TOKEN_REFRESHED, INITIAL_SESSION etc — apenas atualiza o user
        setUser(session.user)
      }
    })

    return () => {
      subscription?.unsubscribe()
    }
  }, [])

  const logout = async () => {
    try {
      // Limpar dados locais primeiro
      setUser(null)
      setAdminUser(null)
      setIsAuthenticated(false)
      setIsAdmin(false)
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('eklesia_impersonation_token')
        localStorage.removeItem('eklesia_impersonation_token')
      }
      setIsImpersonating(false)
      setOriginalAdmin(null)
      setTargetTenant(null)
      setReadOnly(false)
      setImpersonationSessionId(null)

      // Depois fazer logout no Supabase
      if (supabaseRef.current) {
        await supabaseRef.current.auth.signOut()
      }
    } catch (error) {
      console.error('Erro ao fazer logout:', error)
    }
  }

  return (
    <AdminAuthContext.Provider
      value={{
        adminUser,
        user,
        isLoading,
        isAuthenticated,
        isAdmin,
        isImpersonating,
        originalAdmin,
        targetTenant,
        readOnly,
        impersonationSessionId,
        logout,
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  )
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext)
  if (!context) {
    throw new Error('useAdminAuth deve ser usado dentro de AdminAuthProvider')
  }
  return context
}
