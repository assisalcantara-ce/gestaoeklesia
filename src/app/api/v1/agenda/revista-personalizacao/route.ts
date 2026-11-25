import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { resolveTenantAuth } from '@/lib/tenant-auth';
import { authTenantErrorResponse, forbiddenResponse } from '@/lib/api-errors';
import { temAcesso, temAcessoEscrita } from '@/lib/access-control';
import type { PalavraPastorEdicao, DepartamentosEdicaoConfig } from '@/lib/revista-digital-utils';

export const dynamic = 'force-dynamic';

const BUCKET = 'congregacoes-fotos';
const MAX_BYTES = 2 * 1024 * 1024; // 2MB

async function ensureBucket(supabaseAdmin: any) {
  try {
    const { data, error } = await supabaseAdmin.storage.listBuckets();
    if (error) return;
    const exists = Array.isArray(data) && data.some((b: any) => b?.name === BUCKET);
    if (exists) return;
    await supabaseAdmin.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: String(MAX_BYTES),
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    });
  } catch {
    // best-effort
  }
}

/**
 * GET /api/v1/agenda/revista-personalizacao?ano=2026
 * Retorna a personalização da Revista Digital (Palavra do Pastor) por edição anual.
 */
export async function GET(request: NextRequest) {
  try {
    const ctx = await resolveTenantAuth(request);
    if (!ctx.ministryId) {
      return NextResponse.json({ error: 'Ministério não associado.' }, { status: 403 });
    }
    if (!ctx.isOwner && !temAcesso(ctx.nivel, 'agenda')) {
      return forbiddenResponse();
    }

    const anoParam = request.nextUrl.searchParams.get('ano');
    const { data: configRow, error } = await ctx.admin
      .from('configurations')
      .select('church_profile')
      .eq('ministry_id', ctx.ministryId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: 'Erro ao carregar personalização.' }, { status: 500 });
    }

    const churchProfile = (configRow?.church_profile as Record<string, any>) || {};
    const edicoes = (churchProfile.revista_edicoes as Record<string, any>) || {};

    // Carregar departamentos ativos da Secretaria (fonte única de verdade)
    const { data: depsData } = await ctx.admin
      .from('departamentos')
      .select('id, sigla, nome, logo_url, coordenacao, ativo, ordem')
      .eq('ministry_id', ctx.ministryId)
      .eq('ativo', true)
      .order('ordem', { ascending: true })
      .order('nome', { ascending: true });

    const departamentos_disponiveis = (depsData || []).map((d: any) => ({
      id: String(d.id),
      sigla: String(d.sigla || ''),
      nome: String(d.nome || ''),
      logo_url: d.logo_url ? String(d.logo_url) : null,
      lideranca: Array.isArray(d.coordenacao)
        ? d.coordenacao.map((c: any) => ({
            cargo: String(c?.cargo || ''),
            nome: String(c?.nome || ''),
          }))
        : [],
    }));

    if (anoParam) {
      const edicaoAno = edicoes[String(anoParam)] || null;
      const departamentos_config = edicaoAno?.departamentos || null;
      return NextResponse.json({
        edicao: edicaoAno,
        edicoes,
        departamentos_config,
        departamentos_disponiveis,
      });
    }

    return NextResponse.json({ edicoes, departamentos_disponiveis });
  } catch (err) {
    return authTenantErrorResponse(err) ?? NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}

/**
 * PUT /api/v1/agenda/revista-personalizacao
 * Salva a personalização da Palavra do Pastor para uma edição anual específica,
 * preservando independentemente as demais edições e configurações do ministério.
 */
export async function PUT(request: NextRequest) {
  try {
    const ctx = await resolveTenantAuth(request);
    if (!ctx.ministryId) {
      return NextResponse.json({ error: 'Ministério não associado.' }, { status: 403 });
    }
    if (!ctx.isOwner && !temAcessoEscrita(ctx.nivel, 'agenda')) {
      return forbiddenResponse();
    }

    const body = await request.json();
    const ano = Number(body?.ano);
    if (!ano || isNaN(ano) || ano < 2020 || ano > 2100) {
      return NextResponse.json({ error: 'Ano da edição inválido.' }, { status: 400 });
    }

    const { data: existingRow } = await ctx.admin
      .from('configurations')
      .select('id, church_profile')
      .eq('ministry_id', ctx.ministryId)
      .maybeSingle();

    const currentProfile = (existingRow?.church_profile as Record<string, any>) || {};
    const currentEdicoes = (currentProfile.revista_edicoes as Record<string, any>) || {};
    const existingYearEntry = currentEdicoes[String(ano)] || {};

    let updatedYearEntry: Record<string, any> = { ...existingYearEntry };

    if (body?.tipo === 'departamentos' && body?.departamentos) {
      const depBody = body.departamentos;
      const departamentosConfig: DepartamentosEdicaoConfig = {
        publicada: Boolean(depBody.publicada),
        titulo: String(depBody.titulo || 'Nossos Departamentos').trim() || 'Nossos Departamentos',
        subtitulo: String(depBody.subtitulo || '').trim(),
        departamento_ids: Array.isArray(depBody.departamento_ids)
          ? depBody.departamento_ids.map((id: any) => String(id))
          : [],
      };
      updatedYearEntry = {
        ...updatedYearEntry,
        ano,
        departamentos: departamentosConfig,
        updated_at: new Date().toISOString(),
      };
    } else {
      const novaEdicao: PalavraPastorEdicao = {
        ano,
        titulo: String(body?.titulo || 'Palavra do Pastor').trim() || 'Palavra do Pastor',
        conteudo_html: String(body?.conteudo_html || ''),
        foto_url: body?.foto_url ? String(body.foto_url) : null,
        nome_pastor: String(body?.nome_pastor || '').trim(),
        nome_esposa: String(body?.nome_esposa || '').trim(),
        assinatura: String(body?.assinatura || '').trim(),
        publicada: Boolean(body?.publicada),
        updated_at: new Date().toISOString(),
      };
      updatedYearEntry = {
        ...updatedYearEntry,
        ...novaEdicao,
      };
    }

    const updatedProfile = {
      ...currentProfile,
      revista_edicoes: {
        ...currentEdicoes,
        [String(ano)]: updatedYearEntry,
      },
    };

    if (existingRow?.id) {
      const { error: updErr } = await ctx.admin
        .from('configurations')
        .update({ church_profile: updatedProfile, updated_at: new Date().toISOString() })
        .eq('id', existingRow.id)
        .eq('ministry_id', ctx.ministryId);

      if (updErr) {
        return NextResponse.json({ error: 'Erro ao salvar personalização.' }, { status: 500 });
      }
    } else {
      const { error: insErr } = await ctx.admin
        .from('configurations')
        .insert({
          ministry_id: ctx.ministryId,
          church_profile: updatedProfile,
        });

      if (insErr) {
        return NextResponse.json({ error: 'Erro ao criar configuração da revista.' }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, edicao: updatedYearEntry });
  } catch (err) {
    return authTenantErrorResponse(err) ?? NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}

/**
 * POST /api/v1/agenda/revista-personalizacao
 * Upload da fotografia oficial do pastor com a esposa para a edição da revista.
 */
export async function POST(request: NextRequest) {
  try {
    const ctx = await resolveTenantAuth(request);
    if (!ctx.ministryId) {
      return NextResponse.json({ error: 'Ministério não associado.' }, { status: 403 });
    }
    if (!ctx.isOwner && !temAcessoEscrita(ctx.nivel, 'agenda')) {
      return forbiddenResponse();
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const ano = String(formData.get('ano') || new Date().getFullYear());

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado.' }, { status: 400 });
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'A imagem deve ter no máximo 2MB.' }, { status: 400 });
    }

    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      return NextResponse.json({ error: 'Formato inválido. Utilize JPG, PNG ou WEBP.' }, { status: 400 });
    }

    await ensureBucket(ctx.admin);

    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    const path = `${ctx.ministryId}/revista/pastor-${ano}-${randomUUID()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadErr } = await ctx.admin.storage
      .from(BUCKET)
      .upload(path, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadErr) {
      return NextResponse.json({ error: 'Falha ao enviar fotografia para o armazenamento.' }, { status: 500 });
    }

    const { data: publicUrlData } = ctx.admin.storage.from(BUCKET).getPublicUrl(path);
    return NextResponse.json({ success: true, url: publicUrlData.publicUrl });
  } catch (err) {
    return authTenantErrorResponse(err) ?? NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
