import { NextRequest, NextResponse } from 'next/server';
import { resolveTenantAuth } from '@/lib/tenant-auth';

export const dynamic = 'force-dynamic';

const BUCKET = 'member-photos';



export async function POST(request: NextRequest) {
  try {
    const auth = await resolveTenantAuth(request);
    const { admin, ministryId } = auth;

    // 1. Garantir que o bucket existe
    const { data: buckets, error: bucketError } = await admin.storage.listBuckets();
    if (bucketError) {
      return NextResponse.json({ error: `Erro ao verificar buckets: ${bucketError.message}` }, { status: 500 });
    }
    const bucketExists = Array.isArray(buckets) && buckets.some((b: any) => b?.name === BUCKET);
    if (!bucketExists) {
      return NextResponse.json({ error: "Bucket member-photos não encontrado." }, { status: 400 });
    }

    // 2. Buscar membros pendentes de migração de foto
    // Filtro: custom_fields->>'foto_origem_bubble' preenchido, e foto_url nula
    const { data: pendingMembers, error: fetchError } = await admin
      .from('members')
      .select('id, custom_fields, foto_url')
      .eq('ministry_id', ministryId)
      .is('foto_url', null)
      .not('custom_fields->>foto_origem_bubble', 'is', null)
      .neq('custom_fields->>foto_origem_bubble', '')
      .limit(10); // Processar em lotes pequenos de 10 por vez

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 400 });
    }

    // Filtrar candidatos reais (que possuem foto_origem_bubble não vazia)
    const candidates = (pendingMembers || []).filter(m => {
      const bubbleUrl = (m.custom_fields as any)?.foto_origem_bubble;
      return typeof bubbleUrl === 'string' && bubbleUrl.trim() !== '';
    });

    let migradas = 0;
    let ignoradas = 0;
    let erro = 0;

    for (const member of candidates) {
      // Regra: não sobrescrever foto_url existente
      if (member.foto_url) {
        ignoradas++;
        continue;
      }

      const bubbleUrlRaw = (member.custom_fields as any).foto_origem_bubble;
      const imageUrl = bubbleUrlRaw.startsWith('//') ? 'https:' + bubbleUrlRaw : bubbleUrlRaw;

      try {
        // Baixar imagem no backend
        const downloadRes = await fetch(imageUrl, { signal: AbortSignal.timeout(10000) });
        if (!downloadRes.ok) {
          throw new Error(`Falha no download da URL Bubble (HTTP ${downloadRes.status})`);
        }

        const arrayBuffer = await downloadRes.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const contentType = downloadRes.headers.get('content-type') || 'image/jpeg';

        // Determinar extensão
        let ext = 'jpg';
        if (contentType === 'image/png') ext = 'png';
        else if (contentType === 'image/webp') ext = 'webp';

        const path = `${ministryId}/membros/${member.id}.${ext}`;

        // Enviar para o Supabase Storage
        const { error: uploadError } = await admin.storage
          .from(BUCKET)
          .upload(path, buffer, {
            contentType,
            upsert: true,
          });

        if (uploadError) {
          throw new Error(`Falha no upload para o Storage: ${uploadError.message}`);
        }

        // Obter URL pública
        const { data: publicData } = admin.storage.from(BUCKET).getPublicUrl(path);
        const publicUrl = publicData.publicUrl;

        // Salvar foto_url na tabela members (preservando custom_fields original)
        const { error: updateError } = await admin
          .from('members')
          .update({
            foto_url: publicUrl,
          })
          .eq('id', member.id);

        if (updateError) {
          throw new Error(`Falha ao salvar URL no membro: ${updateError.message}`);
        }

        migradas++;
      } catch (err) {
        erro++;
        // Se falhar, registrar erro e continuar conforme regra
        console.error(`Erro ao migrar foto do membro ${member.id}:`, err);
      }
    }

    // Calcular quantos membros ainda faltam migrar
    const { count: remainingCount } = await admin
      .from('members')
      .select('*', { count: 'exact', head: true })
      .eq('ministry_id', ministryId)
      .is('foto_url', null)
      .not('custom_fields->>foto_origem_bubble', 'is', null)
      .neq('custom_fields->>foto_origem_bubble', '');

    return NextResponse.json({
      migradas,
      ignoradas,
      erro,
      remaining: remainingCount || 0,
    });
  } catch (err: any) {
    const message = err instanceof Error ? err.message : '';
    if (message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }
    if (message === 'NO_MINISTRY') {
      return NextResponse.json({ error: 'Usuário sem ministério associado' }, { status: 403 });
    }
    return NextResponse.json({ error: err.message || 'Erro interno do servidor' }, { status: 500 });
  }
}
