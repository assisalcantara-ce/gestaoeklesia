'use client'

import { useState, useEffect } from 'react'
import { useAdminAuth } from '@/providers/AdminAuthProvider'
import { ShieldAlert, Clock, UserCheck, Building2, Eye, Wrench, Power } from 'lucide-react'

export default function ImpersonationBanner() {
  const { isImpersonating, originalAdmin, targetTenant, readOnly, impersonationSessionId } = useAdminAuth()
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null)
  const [isEnding, setIsEnding] = useState(false)

  useEffect(() => {
    if (!isImpersonating) {
      setRemainingSeconds(null)
      return
    }

    // Função para buscar status atualizado e segundos restantes
    const checkStatus = async () => {
      try {
        const token = sessionStorage.getItem('eklesia_impersonation_token') || localStorage.getItem('eklesia_impersonation_token')
        if (!token) {
          handleEndSession(false)
          return
        }

        const res = await fetch(`/api/v1/admin/impersonate/status?token=${encodeURIComponent(token)}`)
        if (!res.ok) {
          handleEndSession(false, 'A sessão de impersonação foi encerrada ou expirou.')
          return
        }

        const data = await res.json()
        if (!data.valid || data.status !== 'active') {
          handleEndSession(false, 'A sessão de impersonação foi encerrada por expiração do tempo.')
          return
        }

        if (data.expiresAt) {
          const expiresTime = new Date(data.expiresAt).getTime()
          const nowTime = Date.now()
          const diff = Math.max(0, Math.floor((expiresTime - nowTime) / 1000))
          setRemainingSeconds(diff)
        }
      } catch (e) {
        console.warn('Erro ao atualizar timer da impersonação:', e)
      }
    }

    checkStatus()

    // Timer regressivo a cada 1 segundo
    const interval = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev === null) return null
        if (prev <= 1) {
          clearInterval(interval)
          handleEndSession(false, 'A sessão de impersonação foi encerrada por expiração do tempo.')
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [isImpersonating])

  const handleEndSession = async (userConfirmed = true, customMessage?: string) => {
    if (userConfirmed) {
      const confirm = window.confirm('Deseja realmente encerrar a sessão de impersonação e retornar ao painel da Plataforma?')
      if (!confirm) return
    }

    setIsEnding(true)
    try {
      if (impersonationSessionId) {
        await fetch('/api/v1/admin/impersonate/end', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: impersonationSessionId }),
        })
      }
    } catch (e) {
      console.warn('Erro ao chamar endpoint de end impersonation:', e)
    } finally {
      sessionStorage.removeItem('eklesia_impersonation_token')
      localStorage.removeItem('eklesia_impersonation_token')
      
      if (customMessage) {
        alert(customMessage)
      }

      if (window.opener || window.history.length === 1) {
        window.close()
      } else {
        window.location.href = '/admin/ministerios'
      }
    }
  }

  if (!isImpersonating) return null

  // Formatador de tempo HH:MM:SS
  const formatTime = (totalSeconds: number | null) => {
    if (totalSeconds === null) return '--:--:--'
    const h = Math.floor(totalSeconds / 3600)
    const m = Math.floor((totalSeconds % 3600) / 60)
    const s = totalSeconds % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  // Dinâmica de Cores conforme tempo restante
  // > 10 min: Vermelho/Escuro elegante (bg-rose-950/90 border-rose-800)
  // <= 10 min: Amarelo/Laranja (bg-amber-950/95 border-amber-600)
  // <= 2 min: Vermelho Intenso Pulsante (bg-red-900 border-red-500 animate-pulse)
  let bannerColorClass = 'bg-rose-950/95 border-rose-800/80 text-rose-100 shadow-rose-950/50'
  let timerBadgeClass = 'bg-rose-900/80 text-rose-200 border-rose-700/50'

  if (remainingSeconds !== null) {
    if (remainingSeconds <= 120) {
      bannerColorClass = 'bg-red-900 border-red-500 text-white animate-pulse shadow-red-900/60'
      timerBadgeClass = 'bg-red-950 text-red-200 border-red-400 font-black'
    } else if (remainingSeconds <= 600) {
      bannerColorClass = 'bg-amber-950/95 border-amber-600/90 text-amber-100 shadow-amber-950/50'
      timerBadgeClass = 'bg-amber-900/90 text-amber-200 border-amber-500/60 font-bold'
    }
  }

  return (
    <div className="sticky top-0 z-50 w-full transition-all duration-300">
      <div className={`w-full border-b py-2.5 px-4 sm:px-6 shadow-xl backdrop-blur-md flex flex-wrap items-center justify-between gap-3 text-xs ${bannerColorClass}`}>
        {/* Lado Esquerdo: Tag MODO IMPERSONAÇÃO + Cliente + Operador */}
        <div className="flex items-center flex-wrap gap-2.5 sm:gap-4">
          <div className="inline-flex items-center gap-1.5 bg-red-600 text-white font-extrabold px-2.5 py-1 rounded-md tracking-wider uppercase text-[11px] shadow-sm animate-pulse">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Modo Impersonação</span>
          </div>

          <div className="flex items-center gap-1.5 font-medium">
            <Building2 className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span className="opacity-80">Cliente:</span>
            <strong className="font-bold text-white uppercase">{targetTenant?.name || 'Ministério Alvo'}</strong>
          </div>

          <span className="hidden sm:inline opacity-40">|</span>

          <div className="flex items-center gap-1.5 font-medium">
            <UserCheck className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span className="opacity-80">Operador:</span>
            <strong className="font-semibold text-white">{originalAdmin?.email || originalAdmin?.nome || 'Super Admin'}</strong>
          </div>

          <span className="hidden md:inline opacity-40">|</span>

          <div className="flex items-center gap-1.5 font-medium">
            {readOnly ? (
              <span className="inline-flex items-center gap-1 bg-blue-900/60 text-blue-200 border border-blue-700/50 px-2 py-0.5 rounded text-[11px]">
                <Eye className="w-3 h-3" /> Somente Visualização
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 bg-amber-900/60 text-amber-200 border border-amber-700/50 px-2 py-0.5 rounded text-[11px]">
                <Wrench className="w-3 h-3" /> Administrador
              </span>
            )}
          </div>
        </div>

        {/* Lado Direito: Timer Regressivo + Botão Encerrar Sessão */}
        <div className="flex items-center gap-3 ml-auto sm:ml-0">
          <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border font-mono text-xs shadow-xs ${timerBadgeClass}`}>
            <Clock className="w-3.5 h-3.5 shrink-0" />
            <span>Expira em: <strong>{formatTime(remainingSeconds)}</strong></span>
          </div>

          <button
            onClick={() => handleEndSession(true)}
            disabled={isEnding}
            className="inline-flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition cursor-pointer shadow-sm disabled:opacity-50"
            title="Encerrar a sessão de impersonação e retornar ao painel da Plataforma"
          >
            <Power className="w-3.5 h-3.5" />
            <span>{isEnding ? 'Encerrando...' : 'Encerrar Sessão'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
