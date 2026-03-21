'use client'

export const dynamic = 'force-dynamic'

import { AdminAuthProvider } from '@/providers/AdminAuthProvider'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AdminAuthProvider>
      {children}
    </AdminAuthProvider>
  )
}
