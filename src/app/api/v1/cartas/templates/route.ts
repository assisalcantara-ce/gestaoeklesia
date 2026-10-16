import { NextRequest, NextResponse } from 'next/server';
import { resolveTenantAuth, isMasterUsuarioMinisterio } from '@/lib/tenant-auth';
import { authTenantErrorResponse } from '@/lib/api-errors';

export async function GET(request: NextRequest) {
  try {
    const context = await resolveTenantAuth(request);
    const { ministryId, supabase } = context;

    const { data, error } = await supabase
      .from('cartas_templates')
      .select('*')
      .eq('ministry_id', ministryId)
      .order('updated_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: data || [] });
  } catch (error) {
    return authTenantErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await resolveTenantAuth(request);
    const { ministryId, userId, admin, isOwner, supabase } = context;

    const isMaster = isOwner || await isMasterUsuarioMinisterio(admin, userId, ministryId);
    if (!isMaster) {
      return NextResponse.json(
        { error: 'Acesso negado: Somente o perfil MASTER possui permissão para gerenciar ou salvar modelos de cartas.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { id, template_key, title, tipo, categoria, content_json, is_active } = body;

    if (!template_key || !title) {
      return NextResponse.json({ error: 'Chave e título do modelo são obrigatórios' }, { status: 400 });
    }

    const payload = {
      ministry_id: ministryId,
      template_key,
      title,
      tipo: tipo || 'custom',
      categoria: categoria || 'carta',
      scope: 'tenant',
      content_json: content_json || {},
      is_active: is_active ?? true,
      updated_at: new Date().toISOString(),
    };

    let result;
    if (id) {
      result = await supabase
        .from('cartas_templates')
        .update(payload)
        .eq('id', id)
        .select()
        .single();
    } else {
      // Verifica se já existe por chave para este tenant
      const { data: existing } = await supabase
        .from('cartas_templates')
        .select('id')
        .eq('ministry_id', ministryId)
        .eq('template_key', template_key)
        .maybeSingle();

      if (existing?.id) {
        result = await supabase
          .from('cartas_templates')
          .update(payload)
          .eq('id', existing.id)
          .select()
          .single();
      } else {
        result = await supabase
          .from('cartas_templates')
          .insert(payload)
          .select()
          .single();
      }
    }

    if (result.error) {
      return NextResponse.json({ error: result.error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    return authTenantErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const context = await resolveTenantAuth(request);
    const { ministryId, userId, admin, isOwner, supabase } = context;

    const isMaster = isOwner || await isMasterUsuarioMinisterio(admin, userId, ministryId);
    if (!isMaster) {
      return NextResponse.json(
        { error: 'Acesso negado: Somente o perfil MASTER possui permissão para excluir ou restaurar modelos de cartas.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const templateKey = searchParams.get('template_key');

    if (!id && !templateKey) {
      return NextResponse.json({ error: 'ID ou chave do modelo é obrigatório para exclusão' }, { status: 400 });
    }

    let deleteQuery = supabase.from('cartas_templates').delete().eq('ministry_id', ministryId);
    if (id) {
      deleteQuery = deleteQuery.eq('id', id);
    } else if (templateKey) {
      deleteQuery = deleteQuery.eq('template_key', templateKey);
    }

    const { error } = await deleteQuery;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: 'Modelo excluído/restaurado com sucesso' });
  } catch (error) {
    return authTenantErrorResponse(error);
  }
}
