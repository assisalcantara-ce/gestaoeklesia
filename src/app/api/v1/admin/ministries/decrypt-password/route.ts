import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-guard'
import { decryptTenantPassword } from '@/lib/tenant-password'

export async function POST(request: NextRequest) {
  try {
    const result = await requireAdmin(request, { requiredCapability: 'can_manage_ministries' })
    if (!result.ok) return result.response
    const { supabaseAdmin: supabase } = result.ctx

    const body = await request.json()
    const id = body?.id

    if (!id) {
      return NextResponse.json({ error: 'ID do ministério é obrigatório' }, { status: 400 })
    }

    const { data: ministry, error } = await supabase
      .from('ministries')
      .select('access_password_encrypted, name')
      .eq('id', id)
      .single()

    if (error || !ministry) {
      return NextResponse.json({ error: 'Ministério não encontrado' }, { status: 404 })
    }

    const encrypted = ministry.access_password_encrypted
    if (!encrypted) {
      return NextResponse.json({ password: null, message: 'Senha não disponível' })
    }

    try {
      const decrypted = decryptTenantPassword(encrypted)
      return NextResponse.json({ password: decrypted })
    } catch (decryptionError: any) {
      return NextResponse.json({ error: 'Erro ao descriptografar a senha: ' + decryptionError.message }, { status: 500 })
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
