import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { createServerClient, createServerClientFromRequest } from '@/lib/supabase-server'

const BUCKET = 'congregacoes-fotos'
const MAX_BYTES = 600 * 1024 // 600KB (pós compressão)

async function resolveMinistryId(supabase: any, userId: string): Promise<string | null> {
  const { data: mu, error: muErr } = await supabase
    .from('ministry_users')
    .select('ministry_id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle()

  if (!muErr && mu?.ministry_id) return String(mu.ministry_id)

  const { data: m, error: mErr } = await supabase
    .from('ministries')
    .select('id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle()

  if (!mErr && m?.id) return String(m.id)

  return null
}

async function ensureBucket(supabaseAdmin: any) {
  try {
    const { data, error } = await supabaseAdmin.storage.listBuckets()
    if (error) return
    const exists = Array.isArray(data) && data.some((b: any) => b?.name === BUCKET)
    if (exists) return
    await supabaseAdmin.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: String(MAX_BYTES),
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    })
  } catch {
    // best-effort
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabaseUser = createServerClientFromRequest(request)

    const {
      data: { user },
    } = await supabaseUser.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const ministryId = await resolveMinistryId(supabaseUser, user.id)
    if (!ministryId) {
      return NextResponse.json({ error: 'Usuário sem ministério associado', code: 'NO_MINISTRY' }, { status: 403 })
    }

    const form = await request.formData()
    const file = form.get('file')
    const congregacaoId = String(form.get('congregacaoId') || '').trim()

    if (!congregacaoId) {
      return NextResponse.json({ error: 'congregacaoId é obrigatório' }, { status: 400 })
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Arquivo não enviado' }, { status: 400 })
    }

    if (!file.type || !file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Tipo de arquivo inválido' }, { status: 400 })
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: `Arquivo muito grande. Máximo ${Math.round(MAX_BYTES / 1024)}KB` },
        { status: 400 }
      )
    }

    const supabaseAdmin = createServerClient()
    await ensureBucket(supabaseAdmin)

    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
    const path = `igrejas/${ministryId}/${congregacaoId}/${Date.now()}-${randomUUID()}.${ext}`

    const buffer = Buffer.from(await file.arrayBuffer())

    const { error: uploadError } = await supabaseAdmin.storage.from(BUCKET).upload(path, buffer, {
      contentType: file.type,
      upsert: true,
    })

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 400 })
    }

    const { data: publicData } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path)

    return NextResponse.json({
      url: publicData?.publicUrl,
      bucket: BUCKET,
      path,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabaseUser = createServerClientFromRequest(request)

    const {
      data: { user },
    } = await supabaseUser.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const ministryId = await resolveMinistryId(supabaseUser, user.id)
    if (!ministryId) {
      return NextResponse.json({ error: 'Usuário sem ministério associado', code: 'NO_MINISTRY' }, { status: 403 })
    }

    const body = await request.json().catch(() => null as any)
    const bucket = String(body?.bucket || '').trim()
    const path = String(body?.path || '').trim()

    if (!bucket || !path) {
      return NextResponse.json({ error: 'bucket e path são obrigatórios' }, { status: 400 })
    }

    // Segurança básica: só permite remover objetos do tenant (ministryId) no padrão de path.
    if (!path.includes(`/${ministryId}/`)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const supabaseAdmin = createServerClient()

    await supabaseAdmin.storage.from(bucket).remove([path])

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    // best-effort: não quebrar o fluxo do usuário
    return NextResponse.json({ ok: false, error: err?.message || 'Internal server error' }, { status: 200 })
  }
}
