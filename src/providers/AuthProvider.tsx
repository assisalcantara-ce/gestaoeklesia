'use client'

import { createContext, useContext, useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase-client'
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js'

interface AuthContextType {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  isAuthenticated: false,
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null)

  useEffect(() => {
    // Inicializar Supabase apenas aqui, dentro do useEffect
    if (!supabaseRef.current) {
      supabaseRef.current = createClient()
    }
    
    const supabase = supabaseRef.current
    // Verificar sessão ao montar
    const checkSession = async () => {
      try {
        const getUserPromise = supabase.auth.getUser()
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('AUTH_TIMEOUT')), 8000)
        })

        const { data: { user: sessionUser } } = await Promise.race([getUserPromise, timeoutPromise])
        setUser(sessionUser)
      } catch (error) {
        console.error('Erro ao verificar sessão:', error)
        setUser(null)
      } finally {
        setIsLoading(false)
      }
    }

    checkSession()

    // Ouvir mudanças de autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      setUser(session?.user || null)
    })

    return () => {
      subscription?.unsubscribe()
    }
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider')
  }
  return context
}
