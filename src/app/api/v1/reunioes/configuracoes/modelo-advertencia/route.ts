import { NextRequest, NextResponse } from 'next/server';
import { resolveTenantAuth } from '@/lib/tenant-auth';
import { isFeatureAllowedForTenant } from '@/lib/plan-permissions';
import { authTenantErrorResponse } from '@/lib/api-errors';

export const dynamic = 'force-dynamic';

const BUCKET = 'cartas-templates';
const MAX_BYTES = 10 * 1024 * 1024; // 10MB

async function ensureBucket(supabaseAdmin: any) {
  try {
    const { data, error } = await supabaseAdmin.storage.listBuckets();
    if (error) return;
    const exists = Array.isArray(data) && data.some((bucket: any) => bucket?.name === BUCKET);
    if (exists) {
      await supabaseAdmin.storage.updateBucket(BUCKET, {
        fileSizeLimit: String(MAX_BYTES),
        allowedMimeTypes: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
      });
      return;
    }
    await supabaseAdmin.storage.createBucket(BUCKET, {
      public: false,
      fileSizeLimit: String(MAX_BYTES),
      allowedMimeTypes: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
    });
  } catch {
    // Best-effort
  }
}

/**
 * GET /api/v1/reunioes/configuracoes/modelo-advertencia
 * Retorna os metadados do modelo oficial de carta de advertência do tenant.
 */
export async function GET(request: NextRequest) {
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
      return NextResponse.json(
        { error: 'Módulo de Reuniões restrito para o plano atual.', code: 'PLAN_RESTRICTED' },
        { status: 403 }
      );
    }

    const { data: modelo, error: queryErr } = await ctx.admin
      .from('reunioes_modelos_advertencia')
      .select('id, ministry_id, nome_arquivo_original, storage_bucket, storage_path, tamanho_bytes, mime_type, ativo, updated_at')
      .eq('ministry_id', ctx.ministryId)
      .eq('ativo', true)
      .maybeSingle();

    if (queryErr) {
      return NextResponse.json(
        { error: 'Erro ao consultar modelo de advertência.', detail: queryErr.message },
        { status: 500 }
      );
    }

    if (!modelo) {
      return NextResponse.json({
        configurado: false,
        modelo: null,
      });
    }

    // Gerar Signed URL para download seguro com expiração de 1 hora
    let downloadUrl: string | null = null;
    try {
      const { data: signedData } = await ctx.admin.storage
        .from(modelo.storage_bucket || BUCKET)
        .createSignedUrl(modelo.storage_path, 3600);
      downloadUrl = signedData?.signedUrl || null;
    } catch {
      // url fallback
    }

    return NextResponse.json({
      configurado: true,
      modelo: {
        id: modelo.id,
        nome_arquivo: modelo.nome_arquivo_original,
        tamanho_bytes: modelo.tamanho_bytes,
        atualizado_em: modelo.updated_at,
        url_download: downloadUrl,
      },
    });
  } catch (err: any) {
    const authResp = authTenantErrorResponse(err);
    if (authResp) return authResp;
    return NextResponse.json(
      { error: err?.message || 'Erro interno ao consultar configuração de advertência.' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/reunioes/configuracoes/modelo-advertencia
 * Faz o upload e substituição do modelo oficial em PDF de Carta de Advertência do tenant.
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
      return NextResponse.json(
        { error: 'Módulo de Reuniões restrito para o plano atual.', code: 'PLAN_RESTRICTED' },
        { status: 403 }
      );
    }

    const form = await request.formData();
    const file = form.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: 'Nenhum arquivo enviado. Selecione um arquivo PDF oficial.' },
        { status: 400 }
      );
    }

    // Validar se é PDF
    const isPdfType = file.type === 'application/pdf';
    const isPdfName = file.name.toLowerCase().endsWith('.pdf');
    if (!isPdfType && !isPdfName) {
      return NextResponse.json(
        { error: 'Formato inválido. O arquivo do modelo oficial deve ser estritamente em formato PDF.' },
        { status: 400 }
      );
    }

    // Validar tamanho
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: `Tamanho de arquivo excedido. O limite máximo é de ${Math.round(MAX_BYTES / (1024 * 1024))}MB.` },
        { status: 400 }
      );
    }

    await ensureBucket(ctx.admin);

    // Buscar modelo anterior para possível limpeza
    const { data: modeloAntigo } = await ctx.admin
      .from('reunioes_modelos_advertencia')
      .select('id, storage_bucket, storage_path')
      .eq('ministry_id', ctx.ministryId)
      .maybeSingle();

    const timestamp = Date.now();
    const storagePath = `advertencias/${ctx.ministryId}/modelo_oficial_${timestamp}.pdf`;
    const buffer = Buffer.from(await file.arrayBuffer());

    // Fazer upload para o Storage
    const { error: uploadError } = await ctx.admin.storage
      .from(BUCKET)
      .upload(storagePath, buffer, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadError) {
      return NextResponse.json(
        { error: `Falha no armazenamento do PDF: ${uploadError.message}` },
        { status: 500 }
      );
    }

    // Upsert no banco de dados
    const { data: savedModelo, error: dbError } = await ctx.admin
      .from('reunioes_modelos_advertencia')
      .upsert(
        {
          ministry_id: ctx.ministryId,
          nome_arquivo_original: file.name,
          storage_bucket: BUCKET,
          storage_path: storagePath,
          tamanho_bytes: file.size,
          mime_type: 'application/pdf',
          ativo: true,
          uploaded_by: ctx.userId || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'ministry_id' }
      )
      .select()
      .single();

    if (dbError) {
      return NextResponse.json(
        { error: `Falha ao salvar metadados do modelo: ${dbError.message}` },
        { status: 500 }
      );
    }

    // Limpeza best-effort do arquivo anterior se existia
    if (modeloAntigo?.storage_path && modeloAntigo.storage_path !== storagePath) {
      try {
        await ctx.admin.storage.from(modeloAntigo.storage_bucket || BUCKET).remove([modeloAntigo.storage_path]);
      } catch {
        // Ignora erro de limpeza
      }
    }

    // Gerar Signed URL
    let downloadUrl: string | null = null;
    try {
      const { data: signedData } = await ctx.admin.storage
        .from(BUCKET)
        .createSignedUrl(storagePath, 3600);
      downloadUrl = signedData?.signedUrl || null;
    } catch {
      // Ignora erro de signed url
    }

    return NextResponse.json({
      sucesso: true,
      mensagem: 'Modelo oficial de Carta de Advertência cadastrado com sucesso.',
      modelo: {
        id: savedModelo.id,
        nome_arquivo: savedModelo.nome_arquivo_original,
        tamanho_bytes: savedModelo.tamanho_bytes,
        atualizado_em: savedModelo.updated_at,
        url_download: downloadUrl,
      },
    });
  } catch (err: any) {
    const authResp = authTenantErrorResponse(err);
    if (authResp) return authResp;
    return NextResponse.json(
      { error: err?.message || 'Erro interno ao processar upload do modelo oficial.' },
      { status: 500 }
    );
  }
}
