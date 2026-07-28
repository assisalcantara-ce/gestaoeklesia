import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { createServerClient } from '@/lib/supabase-server';
import { resolveTenantAuth } from '@/lib/tenant-auth';
import { authTenantErrorResponse } from '@/lib/api-errors';

const BUCKET = 'suporte-anexos';
const MAX_BYTES = 10 * 1024 * 1024; // 10MB

const ALLOWED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
];

async function ensureBucket(supabaseAdmin: any) {
  try {
    const { data, error } = await supabaseAdmin.storage.listBuckets();
    if (error) return;
    const exists = Array.isArray(data) && data.some((bucket: any) => bucket?.name === BUCKET);
    if (exists) return;
    await supabaseAdmin.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: String(MAX_BYTES),
      allowedMimeTypes: ALLOWED_MIME_TYPES,
    });
  } catch {
    // Best-effort bucket creation
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await resolveTenantAuth(request);
    const { ministryId, userId } = context;

    const form = await request.formData();
    const file = form.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado.' }, { status: 400 });
    }

    if (!file.type || !ALLOWED_MIME_TYPES.includes(file.type.toLowerCase())) {
      return NextResponse.json(
        { error: 'Tipo de arquivo não permitido. Envie imagens (PNG, JPG, WEBP) ou documentos (PDF, DOC, XLS, TXT, CSV).' },
        { status: 400 }
      );
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: `Tamanho do arquivo excede o limite máximo de ${Math.round(MAX_BYTES / (1024 * 1024))}MB.` },
        { status: 400 }
      );
    }

    const supabaseAdmin = createServerClient();
    await ensureBucket(supabaseAdmin);

    const filenameOriginal = file.name || 'anexo';
    const ext = filenameOriginal.includes('.') ? filenameOriginal.split('.').pop() : 'bin';
    const path = `${ministryId}/${userId}/${Date.now()}-${randomUUID()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabaseAdmin.storage.from(BUCKET).upload(path, buffer, {
      contentType: file.type,
      upsert: true,
    });

    if (uploadError) {
      return NextResponse.json({ error: `Erro no armazenamento: ${uploadError.message}` }, { status: 400 });
    }

    const { data: publicData } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);

    return NextResponse.json({
      name: filenameOriginal,
      size: file.size,
      type: file.type,
      url: publicData?.publicUrl || '',
      path,
      bucket: BUCKET,
    });
  } catch (error) {
    const authResponse = authTenantErrorResponse(error);
    if (authResponse) return authResponse;
    console.error('POST /api/v1/suporte/uploads error:', error);
    return NextResponse.json({ error: 'Erro interno do servidor ao processar anexo.' }, { status: 500 });
  }
}
