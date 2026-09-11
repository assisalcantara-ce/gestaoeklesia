import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-guard';
import { AceitesRepository } from '@/repositories/AceitesRepository';
import type { TenantAceite } from '@/types/juridico';

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const supabaseAdmin = auth.ctx.supabaseAdmin;
    const { searchParams } = new URL(request.url);
    const ministryIdFiltro = searchParams.get('ministry_id');
    const documentoIdFiltro = searchParams.get('documento_id');
    const search = searchParams.get('search')?.toLowerCase().trim();

    // 1. Consultar aceites utilizando o AceitesRepository
    const aceitesRepo = new AceitesRepository(supabaseAdmin);
    let aceites: TenantAceite[] = await aceitesRepo.findAll((builder: any) => {
      let q = builder.order('aceito_em', { ascending: false });
      if (ministryIdFiltro) {
        q = q.eq('ministry_id', ministryIdFiltro);
      }
      if (documentoIdFiltro) {
        q = q.eq('documento_id', documentoIdFiltro);
      }
      return q;
    });

    if (!aceites || aceites.length === 0) {
      return NextResponse.json({ success: true, total: 0, data: [] });
    }

    // 2. Coletar IDs em lote para evitar N+1 queries
    const ministryIds = Array.from(new Set(aceites.map((a) => a.ministry_id).filter(Boolean)));
    const userIds = Array.from(new Set(aceites.map((a) => a.user_id).filter(Boolean)));
    const docIds = Array.from(new Set(aceites.map((a) => a.documento_id).filter(Boolean)));

    // 3. Buscar ministérios em lote
    const mapaMinistries = new Map<string, { id: string; name: string; cnpj?: string | null }>();
    if (ministryIds.length > 0) {
      const { data: minData } = await supabaseAdmin
        .from('ministries')
        .select('id, name, cnpj, documento')
        .in('id', ministryIds);

      (minData || []).forEach((m: any) => {
        mapaMinistries.set(m.id, {
          id: m.id,
          name: m.name || 'Ministério',
          cnpj: m.cnpj || m.documento || null,
        });
      });
    }

    // 4. Buscar perfis de usuários em lote
    const mapaUsuarios = new Map<string, { id: string; name: string; email: string | null }>();
    if (userIds.length > 0) {
      const { data: profData } = await supabaseAdmin
        .from('profiles')
        .select('id, email, full_name, nome')
        .in('id', userIds);

      (profData || []).forEach((p: any) => {
        mapaUsuarios.set(p.id, {
          id: p.id,
          name: p.full_name || p.nome || p.email || 'Usuário',
          email: p.email || null,
        });
      });
    }

    // 5. Buscar documentos em lote
    const mapaDocs = new Map<string, { id: string; titulo: string; tipo: string; versao: string; escopo?: string }>();
    if (docIds.length > 0) {
      const { data: docsData } = await supabaseAdmin
        .from('documentos_juridicos')
        .select('id, titulo, tipo, versao, escopo')
        .in('id', docIds);

      (docsData || []).forEach((d: any) => {
        mapaDocs.set(d.id, {
          id: d.id,
          titulo: d.titulo,
          tipo: d.tipo,
          versao: d.versao,
          escopo: d.escopo,
        });
      });
    }

    // 6. Formatar resposta resolvida
    let resultado = aceites.map((a) => {
      const min = mapaMinistries.get(a.ministry_id);
      const usr = mapaUsuarios.get(a.user_id);
      const doc = mapaDocs.get(a.documento_id);

      return {
        id: a.id,
        ministry_id: a.ministry_id,
        nome_tenant: min?.name || 'Ministério Não Identificado',
        ministry_name: min?.name || 'Ministério Não Identificado',
        user_id: a.user_id,
        nome_usuario: usr?.name || 'Usuário Não Identificado',
        user_name: usr?.name || 'Usuário Não Identificado',
        user_email: usr?.email || null,
        documento_id: a.documento_id,
        documento_titulo: doc?.titulo || 'Documento Jurídico',
        documento_tipo: doc?.tipo || 'OUTRO',
        documento_escopo: doc?.escopo || 'INDIVIDUAL',
        versao_aceita: a.versao_aceita,
        hash_documento: a.hash_documento,
        ip_address: a.ip_address || null,
        user_agent: a.user_agent || null,
        payload_aceite: a.payload_aceite || {},
        aceito_em: a.aceito_em,
        created_at: a.created_at,
      };
    });

    if (search) {
      resultado = resultado.filter(
        (item) =>
          item.nome_tenant.toLowerCase().includes(search) ||
          item.nome_usuario.toLowerCase().includes(search) ||
          (item.user_email && item.user_email.toLowerCase().includes(search)) ||
          item.documento_titulo.toLowerCase().includes(search) ||
          item.versao_aceita.toLowerCase().includes(search)
      );
    }

    return NextResponse.json({
      success: true,
      total: resultado.length,
      data: resultado,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Erro ao listar aceites de documentos.' },
      { status: 400 }
    );
  }
}
