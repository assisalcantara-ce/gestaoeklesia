/**
 * API ROUTE PÚBLICA: Upload de Foto de Membro para o Cadastro Público
 * POST /api/v1/public/members/upload-photo
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { createServerClient } from '@/lib/supabase-server';
import { checkRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const BUCKET = 'member-photos';
const MAX_BYTES = 5 * 1024 * 1024; // 5MB

async function ensureBucket(admin: any) {
  try {
    const { data: buckets } = await admin.storage.listBuckets();
    const exists = Array.isArray(buckets) && buckets.some((b: any) => b?.name === BUCKET);
    if (!exists) {
      await admin.storage.createBucket(BUCKET, {
        public: true,
        fileSizeLimit: String(MAX_BYTES),
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
      });
    }
  } catch {
    // Best-effort
  }
}

export async function POST(request: NextRequest) {
  // Rate limiting (máximo 10 uploads de foto por minuto por IP)
  const rateLimit = checkRateLimit(request, 10, 60 * 1000);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Muitas fotos enviadas. Aguarde um momento e tente novamente.' },
      { status: 429 }
    );
  }

  try {
    const form = await request.formData();
    const file = form.get('file');
    const institution = form.get('institution');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Nenhuma foto foi enviada.' }, { status: 400 });
    }

    if (!institution || typeof institution !== 'string' || !institution.trim()) {
      return NextResponse.json({ error: 'Instituição não informada.' }, { status: 400 });
    }

    if (!file.type || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      return NextResponse.json(
        { error: 'Formato de imagem inválido. Use JPG, PNG ou WEBP.' },
        { status: 400 }
      );
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: 'A foto excede o tamanho máximo permitido de 5MB.' },
        { status: 400 }
      );
    }

    const admin = createServerClient();

    // Resolver instituição para garantir validade e obter o ID/slug
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(institution.trim());
    let ministryQuery = admin.from('ministries').select('id, is_active');
    if (isUuid) {
      ministryQuery = ministryQuery.eq('id', institution.trim());
    } else {
      ministryQuery = ministryQuery.eq('slug', institution.trim().toLowerCase());
    }

    const { data: ministry, error: minErr } = await ministryQuery.maybeSingle();

    if (minErr || !ministry || !ministry.is_active) {
      return NextResponse.json(
        { error: 'Instituição inválida ou inativa.' },
        { status: 400 }
      );
    }

    await ensureBucket(admin);

    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    const filePath = `public_cadastros/${ministry.id}/${Date.now()}-${randomUUID()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await admin.storage.from(BUCKET).upload(filePath, buffer, {
      contentType: file.type,
      upsert: true,
    });

    if (uploadError) {
      console.error('[POST /api/v1/public/members/upload-photo] Storage upload error:', uploadError);
      return NextResponse.json(
        { error: 'Falha ao salvar a imagem no servidor.' },
        { status: 500 }
      );
    }

    const { data: publicUrlData } = admin.storage.from(BUCKET).getPublicUrl(filePath);

    return NextResponse.json({
      success: true,
      url: publicUrlData.publicUrl,
    });
  } catch (err: any) {
    console.error('[POST /api/v1/public/members/upload-photo] Exception:', err);
    return NextResponse.json(
      { error: 'Erro interno ao processar upload da foto.' },
      { status: 500 }
    );
  }
}
