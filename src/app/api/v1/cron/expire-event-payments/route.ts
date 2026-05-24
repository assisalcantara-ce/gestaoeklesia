/**
 * GET /api/v1/cron/expire-event-payments
 *
 * Expira pagamentos de eventos pendentes cujo prazo (expires_at) já venceu.
 * Deve ser chamado por um job Vercel Cron a cada hora (ex: "0 * * * *").
 *
 * SEGURANÇA: protegido por CRON_SECRET no header Authorization.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET não configurado.' }, { status: 500 });
  }

  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createServerClient();
  const now = new Date().toISOString();

  // Buscar pagamentos pendentes vencidos
  const { data: vencidos, error } = await admin
    .from('eventos_pagamentos')
    .select('id, inscricao_id')
    .eq('status', 'pendente')
    .lt('expires_at', now);

  if (error) {
    console.error('[cron/expire-event-payments] Erro ao buscar vencidos:', error.message);
    return NextResponse.json({ error: 'Erro ao consultar banco.' }, { status: 500 });
  }

  if (!vencidos || vencidos.length === 0) {
    return NextResponse.json({ expired: 0 });
  }

  const ids = vencidos.map((p) => p.id);
  const inscricaoIds = vencidos.map((p) => p.inscricao_id).filter(Boolean);

  // Expirar pagamentos
  await admin
    .from('eventos_pagamentos')
    .update({ status: 'expirado', updated_at: now })
    .in('id', ids);

  // Expirar inscrições correspondentes (apenas as que ainda estão aguardando)
  if (inscricaoIds.length > 0) {
    await admin
      .from('eventos_inscricoes')
      .update({ status: 'expirado', updated_at: now })
      .in('id', inscricaoIds)
      .eq('status', 'aguardando_pagamento');
  }

  console.log(`[cron/expire-event-payments] ${ids.length} pagamentos expirados.`);
  return NextResponse.json({ expired: ids.length });
}
