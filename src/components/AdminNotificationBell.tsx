'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase-client'
import { Bell, X, CheckCircle, AlertCircle } from 'lucide-react'

interface AdminNotification {
  id: string
  type: string
  title: string
  message: string
  data?: any
  is_read: boolean
  created_at: string
}

export default function AdminNotificationBell() {
  const [notifications, setNotifications] = useState<AdminNotification[]>([])
  const [showPanel, setShowPanel] = useState(false)
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null)

  useEffect(() => {
    if (!supabaseRef.current) {
      supabaseRef.current = createClient()
    }
    
    const supabase = supabaseRef.current
    
    const fetchNotifications = async () => {
      try {
        const { data, error } = await supabase
          .from('admin_notifications')
          .select('*')
          .eq('is_read', false)
          .order('created_at', { ascending: false })
          .limit(10)

        if (!error && data) {
          setNotifications(data)
        }
      } catch (error) {
        console.error('Erro ao buscar notificações:', error)
      }
    }
    
    fetchNotifications()

    // Atualizar a cada 10 segundos
    const interval = setInterval(fetchNotifications, 10000)
    return () => clearInterval(interval)
  }, [])

  const markAsRead = async (id: string) => {
    if (!supabaseRef.current) return;
    
    try {
      await supabaseRef.current
        .from('admin_notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', id)

      setNotifications(prev => prev.filter(n => n.id !== id))
    } catch (error) {
      console.error('Erro ao marcar como lido:', error)
    }
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'new_trial_signup':
        return <AlertCircle className="w-5 h-5 text-blue-600" />
      case 'trial_expiring':
        return <AlertCircle className="w-5 h-5 text-yellow-600" />
      case 'trial_expired':
        return <AlertCircle className="w-5 h-5 text-red-600" />
      default:
        return <Bell className="w-5 h-5 text-gray-600" />
    }
  }

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'new_trial_signup':
        return 'bg-blue-50 border-blue-200'
      case 'trial_expiring':
        return 'bg-yellow-50 border-yellow-200'
      case 'trial_expired':
        return 'bg-red-50 border-red-200'
      default:
        return 'bg-gray-50 border-gray-200'
    }
  }

  return (
    <div className="relative">
      {/* Botão da Campainha */}
      <button
        onClick={() => setShowPanel(!showPanel)}
        className="relative p-2 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition"
      >
        <Bell className="w-6 h-6" />
        {notifications.length > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full">
            {notifications.length}
          </span>
        )}
      </button>

      {/* Painel de Notificações */}
      {showPanel && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl z-50 border border-gray-200">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
            <h3 className="font-semibold text-gray-800">Notificações</h3>
            <button
              onClick={() => setShowPanel(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Conteúdo */}
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-500">
                <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-600" />
                <p>Nenhuma notificação não lida</p>
              </div>
            ) : (
              <div className="divide-y">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-4 border-l-4 cursor-pointer hover:bg-gray-50 transition ${getNotificationColor(
                      notification.type
                    )}`}
                  >
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 mt-1">
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-sm text-gray-900">
                          {notification.title}
                        </p>
                        <p className="text-xs text-gray-600 mt-1">
                          {notification.message}
                        </p>
                        <p className="text-xs text-gray-500 mt-2">
                          {new Date(notification.created_at).toLocaleString(
                            'pt-BR'
                          )}
                        </p>
                      </div>
                      <button
                        onClick={() => markAsRead(notification.id)}
                        className="text-gray-400 hover:text-gray-600 ml-2"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
            <button className="w-full text-center text-sm text-blue-600 hover:text-blue-800 font-medium">
              Ver todas as notificações
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
