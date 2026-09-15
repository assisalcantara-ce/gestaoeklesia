import { NextRequest, NextResponse } from 'next/server';
import { resolveMobileMember, mobileMemberErrorResponse } from '@/lib/mobile-member-auth';
import { createServerClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/mobile/midia/albuns/[id]
 *
 * Retorna os detalhes de um álbum com todas as suas fotos ordenadas:
 * - Validação rigorosa de tenant (ministry_id)
 * - Validação de escopo congregacional (geral ou congregação do membro)
 * - Validação de status ativo e data de publicação
 * - Retorna somente fotos pertencentes ao álbum e ministério
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const ctx = await resolveMobileMember(request);
    const admin = createServerClient();
    const resolvedParams = await Promise.resolve(params);
    const albumId = resolvedParams.id;

    if (!albumId) {
      return NextResponse.json(
        { error: 'ID do álbum é obrigatório.', code: 'MISSING_ID' },
        { status: 400 }
      );
    }

    // 1. Obter congregação oficial do membro
    const { data: member, error: memberErr } = await admin
      .from('members')
      .select('id, congregacao_id')
      .eq('id', ctx.memberId)
      .eq('ministry_id', ctx.ministryId)
      .maybeSingle();

    if (memberErr || !member) {
      return NextResponse.json(
        { error: 'Membro não encontrado.', code: 'MEMBER_NOT_FOUND' },
        { status: 404 }
      );
    }

    const memberCongregacaoId = member.congregacao_id;
    const agora = new Date().toISOString();

    // 2. Buscar Álbum com validação multi-tenant
    const { data: album, error: albumErr } = await admin
      .from('midia_albuns')
      .select(
        `
        id,
        titulo,
        descricao,
        capa_url,
        data_evento,
        publicado_em,
        ativo,
        congregacao_id,
        congregacoes (
          id,
          nome
        ),
        created_at
      `
      )
      .eq('id', albumId)
      .eq('ministry_id', ctx.ministryId)
      .maybeSingle();

    if (albumErr || !album) {
      return NextResponse.json(
        { error: 'Álbum não encontrado.', code: 'ALBUM_NOT_FOUND' },
        { status: 404 }
      );
    }

    // 3. Validação de visibilidade pública (ativo e publicado)
    if (!album.ativo || !album.publicado_em || new Date(album.publicado_em) > new Date(agora)) {
      return NextResponse.json(
        { error: 'Álbum não disponível.', code: 'ALBUM_NOT_AVAILABLE' },
        { status: 404 }
      );
    }

    // 4. Validação de congregação (geral ou da congregação do membro)
    if (album.congregacao_id && album.congregacao_id !== memberCongregacaoId) {
      return NextResponse.json(
        { error: 'Acesso não autorizado a este álbum.', code: 'FORBIDDEN_CONGREGATION' },
        { status: 403 }
      );
    }

    // 5. Buscar Fotos do Álbum
    const { data: fotosRaw, error: fotosErr } = await admin
      .from('midia_fotos')
      .select('id, foto_url, legenda, ordem, created_at')
      .eq('album_id', albumId)
      .eq('ministry_id', ctx.ministryId)
      .order('ordem', { ascending: true })
      .order('created_at', { ascending: true });

    if (fotosErr) {
      return NextResponse.json(
        { error: 'Erro ao carregar fotos do álbum.' },
        { status: 500 }
      );
    }

    const fotos = (fotosRaw || []).map((f: any) => ({
      id: f.id,
      foto_url: f.foto_url,
      legenda: f.legenda || null,
      ordem: f.ordem || 0,
    }));

    return NextResponse.json({
      album: {
        id: album.id,
        titulo: album.titulo,
        descricao: album.descricao || null,
        capa_url: album.capa_url || (fotos.length > 0 ? fotos[0].foto_url : null),
        data_evento: album.data_evento || null,
        publicado_em: album.publicado_em,
        escopo: album.congregacao_id ? 'congregacao' : 'geral',
        congregacao_nome: (album.congregacoes as any)?.nome || null,
        total_fotos: fotos.length,
        fotos,
      },
    });
  } catch (error) {
    const authResp = mobileMemberErrorResponse(error);
    if (authResp) return authResp;
    return NextResponse.json(
      { error: 'Erro interno ao consultar detalhes do álbum.' },
      { status: 500 }
    );
  }
}
