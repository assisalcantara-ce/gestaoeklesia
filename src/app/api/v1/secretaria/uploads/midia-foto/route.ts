import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { createServerClient } from '@/lib/supabase-server';
import { resolveTenantAuth } from '@/lib/tenant-auth';
import { authTenantErrorResponse, forbiddenResponse } from '@/lib/api-errors';

const BUCKET = 'midia-fotos';
const MAX_BYTES = 5 * 1024 * 1024; // 5MB

async function ensureBucket(supabaseAdmin: any) {
  try {
    const { data, error } = await supabaseAdmin.storage.listBuckets();
    if (error) return;
    const exists = Array.isArray(data) && data.some((bucket: any) => bucket?.name === BUCKET);
    if (exists) return;
    await supabaseAdmin.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: String(MAX_BYTES),
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    });
  } catch {
    // best-effort
  }
}

function tenantAuthError(error: unknown, okOnDelete = false) {
  if (!okOnDelete) {
    return authTenantErrorResponse(error);
  }

  const message = error instanceof Error ? error.message : '';
  if (message === 'UNAUTHORIZED') {
    return NextResponse.json(
      okOnDelete ? { ok: false, error: 'Unauthorized' } : { error: 'Unauthorized' },
      { status: 401 }
    );
  }
  if (message === 'NO_MINISTRY') {
    return NextResponse.json(
      okOnDelete
        ? { ok: false, error: 'Usuario sem ministerio associado', code: 'NO_MINISTRY' }
        : { error: 'Usuario sem ministerio associado', code: 'NO_MINISTRY' },
      { status: 403 }
    );
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const context = await resolveTenantAuth(request);
    const { ministryId } = context;

    const form = await request.formData();
    const file = form.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Arquivo não enviado.' }, { status: 400 });
    }

    // Bloqueia expressamente qualquer tentativa de upload de vídeo ou binário pesado
    if (
      !file.type ||
      !['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type.toLowerCase())
    ) {
      return NextResponse.json(
        {
          error:
            'Tipo de arquivo inválido. Permitido apenas imagens (JPEG, PNG, WebP, GIF). Vídeos devem ser links externos.',
        },
        { status: 400 }
      );
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: `Arquivo muito grande. Tamanho máximo: ${Math.round(MAX_BYTES / (1024 * 1024))}MB` },
        { status: 400 }
      );
    }

    const supabaseAdmin = createServerClient();
    await ensureBucket(supabaseAdmin);

    const ext =
      file.type === 'image/png'
        ? 'png'
        : file.type === 'image/webp'
        ? 'webp'
        : file.type === 'image/gif'
        ? 'gif'
        : 'jpg';

    const path = `albuns/${ministryId}/${Date.now()}-${randomUUID()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabaseAdmin.storage.from(BUCKET).upload(path, buffer, {
      contentType: file.type,
      upsert: true,
    });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 400 });
    }

    const { data: publicData } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);

    return NextResponse.json({
      url: publicData?.publicUrl,
      bucket: BUCKET,
      path,
    });
  } catch (error: any) {
    const authResponse = tenantAuthError(error);
    if (authResponse) return authResponse;
    return NextResponse.json({ error: error?.message || 'Erro interno no servidor' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const context = await resolveTenantAuth(request);
    const { ministryId } = context;
    const body = await request.json().catch(() => null as any);
    const bucket = String(body?.bucket || '').trim();
    const path = String(body?.path || '').trim();

    if (!bucket || !path) {
      return NextResponse.json({ error: 'Bucket e path são obrigatórios.' }, { status: 400 });
    }

    if (bucket !== BUCKET || !path.startsWith(`albuns/${ministryId}/`)) {
      return forbiddenResponse();
    }

    const supabaseAdmin = createServerClient();
    await supabaseAdmin.storage.from(bucket).remove([path]);

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    const authResponse = tenantAuthError(error, true);
    if (authResponse) return authResponse;
    return NextResponse.json({ ok: false, error: error?.message || 'Erro interno' }, { status: 200 });
  }
}
