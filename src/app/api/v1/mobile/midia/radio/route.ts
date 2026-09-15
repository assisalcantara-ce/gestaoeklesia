import { NextRequest, NextResponse } from 'next/server';
import { resolveMobileMember, mobileMemberErrorResponse } from '@/lib/mobile-member-auth';
import { createServerClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/mobile/midia/radio
 *
 * Retorna as informações de reprodução da Web Rádio para o membro:
 * - Se radio_ativa = true e radio_stream_url preenchida: retorna dados públicos de reprodução
 * - Se inativa ou sem stream: retorna estado indisponível de forma segura
 * - Nunca expõe chaves ou configurações administrativas internas
 */
export async function GET(request: NextRequest) {
  try {
    const ctx = await resolveMobileMember(request);
    const admin = createServerClient();

    const { data: cfg, error } = await admin
      .from('midia_configuracoes')
      .select('radio_nome, radio_stream_url, radio_ativa')
      .eq('ministry_id', ctx.ministryId)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { error: 'Erro ao consultar status da Web Rádio.' },
        { status: 500 }
      );
    }

    if (!cfg || !cfg.radio_ativa || !cfg.radio_stream_url) {
      return NextResponse.json({
        disponivel: false,
        radio_nome: null,
        radio_stream_url: null,
        mensagem: 'Web Rádio não está disponível no momento.',
      });
    }

    return NextResponse.json({
      disponivel: true,
      radio_nome: cfg.radio_nome || 'Web Rádio Oficial',
      radio_stream_url: cfg.radio_stream_url,
    });
  } catch (error) {
    const authResp = mobileMemberErrorResponse(error);
    if (authResp) return authResp;
    return NextResponse.json(
      { error: 'Erro interno ao consultar Web Rádio.' },
      { status: 500 }
    );
  }
}
