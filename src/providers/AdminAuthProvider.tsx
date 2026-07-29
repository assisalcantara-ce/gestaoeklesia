'use client'

import { createContext, useContext, useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase-client'
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js'

import { temPermissaoAdmin, type AdminPermission } from '@/lib/access-control'

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
  hasPermission: (permission: AdminPermission) => boolean
  logout: () => Promise<void>
}

const AdminAuthContext = createContext<AdminAuthContextType>({
  adminUser: null,
  user: null,
  isLoading: true,
  isAuthenticated: false,
  isAdmin: false,
  hasPermission: () => false,
  logout: async () => {},
})

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)

  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null)

  useEffect(() => {
    if (!supabaseRef.current) {
      supabaseRef.current = createClient()
    }
    
    const supabase = supabaseRef.current
    
    const checkAdminSession = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        
        if (sessionError || !session) {
          clearAdminState()
          setIsLoading(false)
          return
        }

        setUser(session.user)

        // Validar permissão administrativa chamando o endpoint oficial POST /api/v1/admin/verify
        const response = await fetch('/api/v1/admin/verify', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ email: session.user.email }),
        })

        if (response.ok) {
          const adminData = await response.json()
          setAdminUser(adminData)
          setIsAuthenticated(true)
          setIsAdmin(adminData.role === 'admin' || adminData.role === 'super_admin')
        } else if (response.status === 401 || response.status === 403) {
          // 401/403: Autenticação inválida ou acesso revogado
          console.warn('[AdminAuthProvider] Acesso negado para o usuário admin (Status:', response.status, ')')
          clearAdminState()
        } else {
          // 404 / 500: Erro de infraestrutura/servidor - não desloga o estado imediatamente
          console.error('[AdminAuthProvider] Erro no servidor de autenticação admin (Status:', response.status, ')')
        }
      } catch (error) {
        console.error('[AdminAuthProvider] Exceção ao verificar sessão administrativa:', error)
      } finally {
        setIsLoading(false)
      }
    }

    const clearAdminState = () => {
      setUser(null)
      setAdminUser(null)
      setIsAuthenticated(false)
      setIsAdmin(false)
    }

    checkAdminSession()

    // Escutar mudanças de autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, session: Session | null) => {
        if (event === 'SIGNED_OUT' || !session) {
          clearAdminState()
          setIsLoading(false)
        } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          checkAdminSession()
        }
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const logout = async () => {
    if (!supabaseRef.current) return
    setIsLoading(true)
    try {
      await supabaseRef.current.auth.signOut()
    } catch (error) {
      console.error('Erro no logout administrativo:', error)
    } finally {
      setUser(null)
      setAdminUser(null)
      setIsAuthenticated(false)
      setIsAdmin(false)
      setIsLoading(false)
    }
  }

  const hasPermission = (permission: AdminPermission): boolean => {
    if (!adminUser) return false
    return temPermissaoAdmin(adminUser.role, permission)
  }

  return (
    <AdminAuthContext.Provider
      value={{
        adminUser,
        user,
        isLoading,
        isAuthenticated,
        isAdmin,
        hasPermission,
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
    throw new Error('useAdminAuth deve ser usado dentro de um AdminAuthProvider')
  }
  return context
}
