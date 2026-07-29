import { NextRequest, NextResponse } from 'next/server';
import { resolveTenantAuth } from '@/lib/tenant-auth';

export const dynamic = 'force-dynamic';

// CONFIGURAÇÃO PADRÃO
const CONFIGURACAO_PADRAO = {
  nome: 'Igreja/Ministério',
  endereco: 'Endereço não configurado',
  cnpj: '',
  telefone: '',
  email: '',
  website: '',
  descricao: '',
  responsavel: '',
  dataCadastro: '',
  logo: '',
};

// ─── GET /api/v1/configuracoes/perfil ─────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const ctx = await resolveTenantAuth(request);

    if (!ctx.ministryId) {
      return NextResponse.json({ error: 'Ministério não encontrado.', code: 'NO_MINISTRY' }, { status: 403 });
    }

    // Busca dados em ministries usando service_role (ctx.admin) — sem RLS
    const { data: ministryData, error: ministryErr } = await ctx.admin
      .from('ministries')
      .select('name, email_admin, cnpj_cpf, phone, website, description, logo_url, created_at')
      .eq('id', ctx.ministryId)
      .maybeSingle();

    // Busca dados em configurations usando service_role (ctx.admin) — sem RLS
    const { data: configRow } = await ctx.admin
      .from('configurations')
      .select('church_profile')
      .eq('ministry_id', ctx.ministryId)
      .maybeSingle();

    if (ministryErr) {
      console.error('[API /api/v1/configuracoes/perfil] Erro ao buscar ministério:', ministryErr);
      return NextResponse.json({ error: 'Erro ao buscar dados do ministério.', detail: ministryErr.message }, { status: 500 });
    }

    const churchProfile = (configRow as any)?.church_profile || {};

    const responseData = {
      nome: ministryData?.name || CONFIGURACAO_PADRAO.nome,
      endereco: churchProfile.endereco || CONFIGURACAO_PADRAO.endereco,
      cnpj: ministryData?.cnpj_cpf || '',
      telefone: ministryData?.phone || '',
      email: ministryData?.email_admin || '',
      website: ministryData?.website || '',
      descricao: ministryData?.description || '',
      responsavel: churchProfile.responsavel || CONFIGURACAO_PADRAO.responsavel || '',
      dataCadastro: ministryData?.created_at ? new Date(ministryData.created_at).toISOString().split('T')[0] : '',
      logo: ministryData?.logo_url || '',
    };

    return NextResponse.json({ data: responseData });
  } catch (err: any) {
    console.error('[API /api/v1/configuracoes/perfil] Exceção:', err);
    if (err?.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    return NextResponse.json({ error: err?.message || 'Erro interno no servidor.' }, { status: 500 });
  }
}

// ─── PUT /api/v1/configuracoes/perfil ─────────────────────────────────────────
export async function PUT(request: NextRequest) {
  try {
    const ctx = await resolveTenantAuth(request);

    if (!ctx.ministryId) {
      return NextResponse.json({ error: 'Ministério não encontrado.', code: 'NO_MINISTRY' }, { status: 403 });
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Body JSON inválido.' }, { status: 400 });
    }

    const { nome, email, cnpj, telefone, website, descricao, logo, endereco, responsavel } = body || {};

    // 1. Atualizar tabela ministries com service_role (ctx.admin)
    const updateMinistry: Record<string, any> = {};
    if (typeof nome === 'string') updateMinistry.name = nome;
    if (typeof email === 'string') updateMinistry.email_admin = email;
    if (typeof cnpj === 'string') updateMinistry.cnpj_cpf = cnpj;
    if (typeof telefone === 'string') updateMinistry.phone = telefone;
    if (typeof website === 'string') updateMinistry.website = website;
    if (typeof descricao === 'string') updateMinistry.description = descricao;
    if (typeof logo === 'string') updateMinistry.logo_url = logo;

    if (Object.keys(updateMinistry).length > 0) {
      const { error: minErr } = await ctx.admin
        .from('ministries')
        .update(updateMinistry)
        .eq('id', ctx.ministryId);

      if (minErr) {
        console.error('[API /api/v1/configuracoes/perfil] Erro ao atualizar ministries:', minErr);
        return NextResponse.json({ error: 'Erro ao atualizar dados do ministério.', detail: minErr.message }, { status: 500 });
      }
    }

    // 2. Atualizar tabela configurations com service_role (ctx.admin)
    if (typeof endereco === 'string' || typeof responsavel === 'string') {
      const { data: configRow } = await ctx.admin
        .from('configurations')
        .select('church_profile')
        .eq('ministry_id', ctx.ministryId)
        .maybeSingle();

      const existingProfile = (configRow as any)?.church_profile || {};
      const nextProfile = {
        ...existingProfile,
        ...(typeof endereco === 'string' ? { endereco } : {}),
        ...(typeof responsavel === 'string' ? { responsavel } : {}),
      };

      const { error: upsertErr } = await ctx.admin
        .from('configurations')
        .upsert(
          {
            ministry_id: ctx.ministryId,
            church_profile: nextProfile,
            updated_at: new Date().toISOString(),
          } as any,
          { onConflict: 'ministry_id' }
        );

      if (upsertErr) {
        console.error('[API /api/v1/configuracoes/perfil] Erro no upsert de configurations:', upsertErr);
        return NextResponse.json({ error: 'Erro ao atualizar configurações adicionais.', detail: upsertErr.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, message: 'Configurações atualizadas com sucesso.' });
  } catch (err: any) {
    console.error('[API /api/v1/configuracoes/perfil] Exceção em PUT:', err);
    if (err?.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    return NextResponse.json({ error: err?.message || 'Erro interno no servidor.' }, { status: 500 });
  }
}
