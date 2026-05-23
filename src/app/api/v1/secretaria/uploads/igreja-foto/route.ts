import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { createServerClient } from '@/lib/supabase-server'
import { resolveTenantAuth } from '@/lib/tenant-auth'
import { authTenantErrorResponse, forbiddenResponse } from '@/lib/api-errors'

const BUCKET = 'congregacoes-fotos'
const MAX_BYTES = 600 * 1024

async function ensureBucket(supabaseAdmin: any) {
  try {
    const { data, error } = await supabaseAdmin.storage.listBuckets()
    if (error) return
    const exists = Array.isArray(data) && data.some((bucket: any) => bucket?.name === BUCKET)
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

function tenantAuthError(error: unknown, okOnDelete = false) {
  if (!okOnDelete) {
    return authTenantErrorResponse(error)
  }

  const message = error instanceof Error ? error.message : ''
  if (message === 'UNAUTHORIZED') {
    return NextResponse.json(okOnDelete ? { ok: false, error: 'Unauthorized' } : { error: 'Unauthorized' }, { status: 401 })
  }
  if (message === 'NO_MINISTRY') {
    return NextResponse.json(
      okOnDelete
        ? { ok: false, error: 'Usuario sem ministerio associado', code: 'NO_MINISTRY' }
        : { error: 'Usuario sem ministerio associado', code: 'NO_MINISTRY' },
      { status: 403 }
    )
  }
  return null
}

async function assertCongregacaoBelongsToTenant(admin: any, ministryId: string, congregacaoId: string) {
  const { data, error } = await admin
    .from('congregacoes')
    .select('id')
    .eq('id', congregacaoId)
    .eq('ministry_id', ministryId)
    .maybeSingle()

  if (error || !data?.id) {
    throw new Error('FORBIDDEN_CONGREGACAO')
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await resolveTenantAuth(request)
    const { ministryId } = context

    const form = await request.formData()
    const file = form.get('file')
    const congregacaoId = String(form.get('congregacaoId') || '').trim()

    if (!congregacaoId) {
      return NextResponse.json({ error: 'congregacaoId e obrigatorio' }, { status: 400 })
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Arquivo nao enviado' }, { status: 400 })
    }

    if (!file.type || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      return NextResponse.json({ error: 'Tipo de arquivo invalido' }, { status: 400 })
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: `Arquivo muito grande. Maximo ${Math.round(MAX_BYTES / 1024)}KB` },
        { status: 400 }
      )
    }

    const supabaseAdmin = createServerClient()
    await assertCongregacaoBelongsToTenant(supabaseAdmin, ministryId, congregacaoId)
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
  } catch (error: any) {
    const authResponse = tenantAuthError(error)
    if (authResponse) return authResponse
    if (error?.message === 'FORBIDDEN_CONGREGACAO') {
      return forbiddenResponse()
    }
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const context = await resolveTenantAuth(request)
    const { ministryId } = context
    const body = await request.json().catch(() => null as any)
    const bucket = String(body?.bucket || '').trim()
    const path = String(body?.path || '').trim()

    if (!bucket || !path) {
      return NextResponse.json({ error: 'bucket e path sao obrigatorios' }, { status: 400 })
    }

    if (bucket !== BUCKET || !path.startsWith(`igrejas/${ministryId}/`)) {
      return forbiddenResponse()
    }

    const supabaseAdmin = createServerClient()
    await supabaseAdmin.storage.from(bucket).remove([path])

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    const authResponse = tenantAuthError(error, true)
    if (authResponse) return authResponse
    return NextResponse.json({ ok: false, error: error?.message || 'Internal server error' }, { status: 200 })
  }
}
