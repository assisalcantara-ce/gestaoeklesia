'use client'

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import NotificationModal from '@/components/NotificationModal'

export type AppDialogType = 'success' | 'error' | 'warning' | 'info'

type AlertOptions = {
  title?: string
  message: string
  type?: AppDialogType
  buttonText?: string
}

type ConfirmOptions = {
  title?: string
  message: string
  type?: AppDialogType
  confirmText?: string
  cancelText?: string
}

type DialogState =
  | null
  | {
      kind: 'alert'
      options: Required<Pick<AlertOptions, 'message'>> & Omit<AlertOptions, 'message'>
      resolve: () => void
    }
  | {
      kind: 'confirm'
      options: Required<Pick<ConfirmOptions, 'message'>> & Omit<ConfirmOptions, 'message'>
      resolve: (value: boolean) => void
    }

interface AppDialogContextValue {
  alert: (options: AlertOptions) => Promise<void>
  confirm: (options: ConfirmOptions) => Promise<boolean>
}

const AppDialogContext = createContext<AppDialogContextValue | null>(null)

export function AppDialogProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<DialogState>(null)
  const resolveRef = useRef<null | ((value?: any) => void)>(null)

  const close = useCallback(() => {
    setState(null)
  }, [])

  const alertFn = useCallback((options: AlertOptions) => {
    return new Promise<void>((resolve) => {
      resolveRef.current = resolve
      setState({
        kind: 'alert',
        options: {
          title: options.title,
          message: options.message,
          type: options.type,
          buttonText: options.buttonText,
        },
        resolve,
      })
    })
  }, [])

  const confirmFn = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve
      setState({
        kind: 'confirm',
        options: {
          title: options.title,
          message: options.message,
          type: options.type,
          confirmText: options.confirmText,
          cancelText: options.cancelText,
        },
        resolve,
      })
    })
  }, [])

  const value = useMemo<AppDialogContextValue>(() => ({ alert: alertFn, confirm: confirmFn }), [alertFn, confirmFn])

  const handlePrimary = useCallback(() => {
    const current = state
    close()
    if (!current) return
    if (current.kind === 'alert') {
      current.resolve()
      return
    }
    current.resolve(true)
  }, [close, state])

  const handleSecondary = useCallback(() => {
    const current = state
    close()
    if (!current) return
    if (current.kind === 'confirm') {
      current.resolve(false)
    } else {
      current.resolve()
    }
  }, [close, state])

  // Se o usuário clicar fora / fechar, tratamos como cancel no confirm.
  const handleClose = useCallback(() => {
    const current = state
    close()
    if (!current) return
    if (current.kind === 'confirm') {
      current.resolve(false)
    } else {
      current.resolve()
    }
  }, [close, state])

  const modal = (() => {
    if (!state) return null

    const type: AppDialogType = state.options.type ?? (state.kind === 'confirm' ? 'warning' : 'info')
    const title = state.options.title ?? (state.kind === 'confirm' ? 'Confirmar' : 'Aviso')

    if (state.kind === 'alert') {
      return (
        <NotificationModal
          isOpen
          title={title}
          message={state.options.message}
          type={type}
          onClose={handlePrimary}
          showButton
          primaryLabel={state.options.buttonText ?? 'OK'}
        />
      )
    }

    return (
      <NotificationModal
        isOpen
        title={title}
        message={state.options.message}
        type={type}
        onClose={handlePrimary}
        showButton
        primaryLabel={state.options.confirmText ?? 'OK'}
        secondaryLabel={state.options.cancelText ?? 'Cancelar'}
        onSecondary={handleSecondary}
        onRequestClose={handleClose}
      />
    )
  })()

  return (
    <AppDialogContext.Provider value={value}>
      {children}
      {modal}
    </AppDialogContext.Provider>
  )
}

export function useAppDialog() {
  const ctx = useContext(AppDialogContext)
  if (!ctx) {
    throw new Error('useAppDialog deve ser usado dentro de AppDialogProvider')
  }
  return ctx
}
