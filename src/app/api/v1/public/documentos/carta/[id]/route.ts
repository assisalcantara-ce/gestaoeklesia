import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cleanId = decodeURIComponent(id || '').trim();

    if (!cleanId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Identificador do documento não fornecido.',
          status_validacao: 'nao_encontrado',
        },
        { status: 400 }
      );
    }

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(cleanId);
    if (!isUuid) {
      return NextResponse.json(
        {
          success: false,
          error: 'Identificador do documento inválido.',
          status_validacao: 'nao_encontrado',
        },
        { status: 404 }
      );
    }

    const admin = createServerClient();

    // 1. Buscar a carta pelo ID
    const { data: carta, error: cartaError } = await admin
      .from('cartas_registros')
      .select(`
        id,
        ministry_id,
        member_id,
        template_title,
        categoria,
        status,
        payload_snapshot,
        issued_at,
        created_at
      `)
      .eq('id', cleanId)
      .maybeSingle();

    if (cartaError || !carta) {
      return NextResponse.json(
        {
          success: false,
          error: 'Documento não localizado na base de registros.',
          status_validacao: 'nao_encontrado',
        },
        { status: 404 }
      );
    }

    // 2. Buscar dados da instituição/igreja emissora
    let instituicaoNome = 'Gestão Eklésia';
    let instituicaoLogo: string | null = null;

    if (carta.ministry_id) {
      const { data: ministry } = await admin
        .from('ministries')
        .select('name, logo_url')
        .eq('id', carta.ministry_id)
        .maybeSingle();

      if (ministry) {
        instituicaoNome = ministry.name || instituicaoNome;
        instituicaoLogo = ministry.logo_url || null;
      }
    }

    // 3. Extrair dados públicos e seguros do snapshot / membro
    const snapshot = (carta.payload_snapshot && typeof carta.payload_snapshot === 'object')
      ? (carta.payload_snapshot as Record<string, any>)
      : {};

    let nomeMembro = snapshot['membro.nome'] || snapshot['membro.nome_completo'] || null;

    if (!nomeMembro && carta.member_id) {
      const { data: member } = await admin
        .from('members')
        .select('name')
        .eq('id', carta.member_id)
        .maybeSingle();

      if (member) {
        nomeMembro = member.name;
      }
    }

    const destino = snapshot['carta.destino'] || snapshot['destino'] || null;
    const pastorResponsavel = snapshot['pastor.responsavel'] || snapshot['pastor_responsavel'] || null;
    const finalidade = snapshot['carta.finalidade'] || snapshot['finalidade'] || null;

    // 4. Determinar status de validação
    const isCancelada = carta.status === 'cancelada' || carta.status === 'inativa' || carta.status === 'revogada';
    const statusValidacao = isCancelada ? 'cancelado' : 'autentico';

    return NextResponse.json({
      success: true,
      status_validacao: statusValidacao,
      documento: {
        id: carta.id,
        codigo_autenticidade: carta.id,
        titulo: carta.template_title || 'Carta Ministerial',
        categoria: carta.categoria || 'carta',
        status: carta.status || 'emitida',
        data_emissao: carta.issued_at || carta.created_at,
        destinatario: nomeMembro || 'Destinatário Oficial',
        destino: destino,
        finalidade: finalidade,
        pastor_responsavel: pastorResponsavel,
      },
      instituicao: {
        nome: instituicaoNome,
        logo_url: instituicaoLogo,
      },
    });
  } catch (error: any) {
    console.error('Erro ao consultar autenticidade da carta:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Erro interno ao consultar documento.',
        status_validacao: 'erro',
      },
      { status: 500 }
    );
  }
}
