import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { resolveTenantAuth } from '@/lib/tenant-auth';
import { isFeatureAllowedForTenant } from '@/lib/plan-permissions';
import { createServerClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

const BUCKET = 'suporte-anexos';
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

const ALLOWED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'application/pdf',
];

const ALLOWED_EXTENSIONS = ['png', 'jpg', 'jpeg', 'pdf'];

const REUNIOES_RESTRICTED_RESPONSE = {
  error: 'O Módulo de Reuniões está disponível a partir do Plano Intermediário.',
  code: 'PLAN_RESTRICTED',
  required_plan: 'intermediate',
} as const;

async function ensureBucket(supabaseAdmin: any) {
  try {
    const { data, error } = await supabaseAdmin.storage.listBuckets();
    if (error) return;
    const exists = Array.isArray(data) && data.some((bucket: any) => bucket?.name === BUCKET);
    if (exists) return;
    await supabaseAdmin.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: String(10 * 1024 * 1024),
    });
  } catch {
    // Best-effort bucket check
  }
}

/**
 * POST /api/v1/reunioes/faltas/anexo
 * Realiza o upload de comprovante/anexo para justificativa de falta ministerial.
 */
export async function POST(request: NextRequest) {
  try {
    const ctx = await resolveTenantAuth(request);

    if (!ctx.ministryId) {
      return NextResponse.json(
        { error: 'Usuário sem ministério associado.', code: 'NO_MINISTRY' },
        { status: 403 }
      );
    }

    const isAllowed = await isFeatureAllowedForTenant(ctx.admin, ctx.ministryId, 'meetings_module');
    if (!isAllowed) {
      return NextResponse.json(REUNIOES_RESTRICTED_RESPONSE, { status: 403 });
    }

    const form = await request.formData();
    const file = form.get('file');
    const faltaId = form.get('falta_id');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado.' }, { status: 400 });
    }

    // Validação de tamanho (5 MB)
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: 'O arquivo não pode exceder 5 MB.' },
        { status: 400 }
      );
    }

    // Validação de tipo / extensão
    const filenameOriginal = file.name || 'documento';
    const ext = filenameOriginal.includes('.') ? filenameOriginal.split('.').pop()?.toLowerCase() || '' : '';

    const mimeType = (file.type || '').toLowerCase();
    const mimeValido = ALLOWED_MIME_TYPES.includes(mimeType);
    const extValida = ALLOWED_EXTENSIONS.includes(ext);

    if (!mimeValido && !extValida) {
      return NextResponse.json(
        { error: 'Formato de arquivo inválido. Formatos aceitos: PDF, JPG, JPEG ou PNG.' },
        { status: 400 }
      );
    }

    const supabaseAdmin = createServerClient();
    await ensureBucket(supabaseAdmin);

    const safeExt = ext || (mimeType.includes('pdf') ? 'pdf' : mimeType.includes('png') ? 'png' : 'jpg');
    const folderFalta = typeof faltaId === 'string' && faltaId.trim() ? `${faltaId.trim()}/` : '';
    const path = `reunioes-justificativas/${ctx.ministryId}/${folderFalta}${Date.now()}-${randomUUID()}.${safeExt}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabaseAdmin.storage.from(BUCKET).upload(path, buffer, {
      contentType: file.type || 'application/octet-stream',
      upsert: true,
    });

    if (uploadError) {
      return NextResponse.json(
        { error: `Erro no armazenamento do anexo: ${uploadError.message}` },
        { status: 500 }
      );
    }

    const { data: publicData } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);

    return NextResponse.json({
      success: true,
      url: publicData?.publicUrl || '',
      path,
      name: filenameOriginal,
      size: file.size,
      type: file.type,
    });
  } catch (err: any) {
    if (err?.message === 'UNAUTHORIZED') {
      return NextResponse.json(
        { error: 'Não autorizado. Faça login novamente.', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }
    if (err?.message === 'NO_MINISTRY') {
      return NextResponse.json(
        { error: 'Usuário sem ministério associado.', code: 'NO_MINISTRY' },
        { status: 403 }
      );
    }
    return NextResponse.json(
      { error: 'Erro interno ao processar upload do anexo.', detail: err?.message },
      { status: 500 }
    );
  }
}
