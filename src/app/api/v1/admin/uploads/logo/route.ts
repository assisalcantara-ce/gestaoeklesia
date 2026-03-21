import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-guard'
import { randomUUID } from 'node:crypto'

const BUCKET = 'ministry-logos'
const MAX_BYTES = 600 * 1024 // 600KB (pós compressão)

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
    const guard = await requireAdmin(request, { requiredCapability: 'can_manage_ministries' })
    if (!guard.ok) return guard.response

    const form = await request.formData()
    const file = form.get('file')

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

    const supabaseAdmin = guard.ctx.supabaseAdmin
    await ensureBucket(supabaseAdmin)

    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
    const path = `logos/${Date.now()}-${randomUUID()}.${ext}`

    const buffer = Buffer.from(await file.arrayBuffer())

    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, buffer, {
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
