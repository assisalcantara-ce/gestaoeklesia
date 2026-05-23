import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { createServerClient } from '@/lib/supabase-server'
import { resolveTenantAuth } from '@/lib/tenant-auth'
import { authTenantErrorResponse } from '@/lib/api-errors'

const BUCKET = 'cartas-templates'
const MAX_BYTES = 2 * 1024 * 1024

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

export async function POST(request: NextRequest) {
  try {
    const context = await resolveTenantAuth(request)
    const { ministryId } = context

    const form = await request.formData()
    const file = form.get('file')

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
    await ensureBucket(supabaseAdmin)

    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
    const path = `cartas/${ministryId}/${Date.now()}-${randomUUID()}.${ext}`
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
    const authResponse = authTenantErrorResponse(error)
    if (authResponse) return authResponse
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 })
  }
}
