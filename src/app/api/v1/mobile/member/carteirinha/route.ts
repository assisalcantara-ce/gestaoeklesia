/**
 * GET /api/v1/mobile/member/carteirinha
 *
 * Retorna os dados da carteirinha digital do membro autenticado,
 * incluindo um QR payload para verificação futura.
 *
 * QR payload: JSON base64 com { mid, uid, min, ts }
 * - mid: member_id
 * - uid: unique_id
 * - min: ministry_id
 * - ts:  timestamp UNIX (seconds) para verificação de antiguidade
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import {
  resolveMobileMember,
  mobileMemberErrorResponse,
} from '@/lib/mobile-member-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const ctx = await resolveMobileMember(request);
    const admin = createServerClient();

    const { data: member, error } = await admin
      .from('members')
      .select(
        `id, unique_id, name, matricula, foto_url,
         cargo_ministerial, tipo_cadastro, status,
         data_batismo_aguas, data_validade_credencial,
         congregacao_id, ministry_id`,
      )
      .eq('id', ctx.memberId)
      .maybeSingle();

    if (error || !member) {
      return NextResponse.json({ error: 'Membro não encontrado.' }, { status: 404 });
    }

    // Join congregação
    let congregacao_nome: string | null = null;
    if (member.congregacao_id) {
      const { data: cong } = await admin
        .from('congregacoes')
        .select('nome')
        .eq('id', member.congregacao_id as string)
        .maybeSingle();
      congregacao_nome = (cong as any)?.nome ?? null;
    }

    // Join ministério
    const { data: ministerio } = await admin
      .from('ministries')
      .select('name, logo_url')
      .eq('id', member.ministry_id as string)
      .maybeSingle();

    // QR payload: base64 JSON — para verificação futura
    const qrPayload = Buffer.from(
      JSON.stringify({
        mid: member.id,
        uid: member.unique_id,
        min: member.ministry_id,
        ts: Math.floor(Date.now() / 1000),
      }),
    ).toString('base64');

    return NextResponse.json({
      nome: member.name,
      matricula: member.matricula,
      unique_id: member.unique_id,
      foto_url: member.foto_url,
      cargo_ministerial: member.cargo_ministerial,
      tipo_cadastro: member.tipo_cadastro,
      status: member.status,
      data_batismo_aguas: member.data_batismo_aguas,
      data_validade_credencial: member.data_validade_credencial,
      congregacao: congregacao_nome,
      ministerio: (ministerio as any)?.name ?? null,
      ministerio_logo: (ministerio as any)?.logo_url ?? null,
      qr_payload: qrPayload,
    });
  } catch (err) {
    const errRes = mobileMemberErrorResponse(err);
    if (errRes) return errRes;
    console.error('[mobile/member/carteirinha GET]', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
