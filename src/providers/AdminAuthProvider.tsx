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
    // Inicializar Supabase apenas aqui, dentro do useEffect
    if (!supabaseRef.current) {
      supabaseRef.current = createClient()
    }
    
    const supabase = supabaseRef.current
    
    const checkAdminSession = async () => {
      try {
        // Primeiro, verificar se há sessão Supabase
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        
        if (sessionError || !session) {
          clearAdminState()
          setIsLoading(false)
          return
        }

        setUser(session.user)

        // Buscar dados do admin_users no backend
        const response = await fetch('/api/v1/admin/me', {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        })

        if (response.ok) {
          const adminData = await response.json()
          setAdminUser(adminData)
          setIsAuthenticated(true)
          setIsAdmin(adminData.role === 'admin' || adminData.role === 'super_admin')
        } else {
          // Usuário autenticado no Supabase mas não é admin_user válido
          clearAdminState()
        }
      } catch (error) {
        console.error('Erro ao verificar sessão administrativa:', error)
        clearAdminState()
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
