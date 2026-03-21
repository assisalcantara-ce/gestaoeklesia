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
  logout: () => Promise<void>
}

const AdminAuthContext = createContext<AdminAuthContextType>({
  adminUser: null,
  user: null,
  isLoading: true,
  isAuthenticated: false,
  isAdmin: false,
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

        const response = await fetch('/api/v1/admin/verify', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
        })

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
        console.error('Erro ao verificar sessão de admin:', error)
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
    } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      if (!session?.user) {
        setUser(null)
        setAdminUser(null)
        setIsAuthenticated(false)
        setIsAdmin(false)
      } else {
        setUser(session.user)
        // Re-verificar status de admin
        checkAdminSession()
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
