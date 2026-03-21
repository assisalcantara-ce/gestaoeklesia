/**
 * API ROUTE: Admin Verify & Metrics
 * Verificar se usuário é admin e fornecer métricas do dashboard
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-guard'

export async function POST(request: NextRequest) {
  try {
    // Exige token Bearer e valida admin pelo próprio usuário do token.
    const result = await requireAdmin(request)
    if (!result.ok) return result.response

    const { adminUser } = result.ctx

    // Retornar apenas o necessário
    return NextResponse.json({
      id: adminUser.id,
      email: adminUser.email,
      nome: adminUser.nome,
      role: adminUser.role,
      status: adminUser.status ?? (adminUser.ativo ? 'ATIVO' : 'INATIVO'),
    })
  } catch (err: any) {
    console.log('[VERIFY POST] Exception:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const result = await requireAdmin(request)
    if (!result.ok) return result.response

    const { adminUser } = result.ctx

    return NextResponse.json({
      id: adminUser.id,
      email: adminUser.email,
      nome: adminUser.nome,
      role: adminUser.role,
      status: adminUser.status ?? (adminUser.ativo ? 'ATIVO' : 'INATIVO'),
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
