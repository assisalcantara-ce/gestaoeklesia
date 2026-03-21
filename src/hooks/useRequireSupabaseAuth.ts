'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase-client'

export function useRequireSupabaseAuth(options?: { redirectTo?: string }) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const redirectTo = options?.redirectTo || '/'

    const run = async () => {
      try {
        const { data } = await supabase.auth.getUser()
        if (!data.user) {
          router.push(redirectTo)
          return
        }
        setUser(data.user)
      } finally {
        setLoading(false)
      }
    }

    run()
  }, [router, supabase, options?.redirectTo])

  return { user, loading }
}
