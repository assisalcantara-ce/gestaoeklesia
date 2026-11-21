import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { getClientIp } from '@/lib/rate-limit';
import { consumeRateLimit } from '@/lib/rate-limit-db';
import { CelulasService } from '@/services/celulas-service';
import { CelulaParticipanteTipo } from '@/types/celulas';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // 1. Rate Limiting distribuído no banco (30 req/min por IP) com FAIL-CLOSED no POST público
    const ip = getClientIp(request);
    const rateCheck = await consumeRateLimit({
      bucketKey: `celulas_chamada_post:${ip}`,
      limit: 30,
      windowMs: 60 * 1000,
      failClosedOnDbError: true, // Garante que falhas no banco não abram brechas de flooding
    });
    if (!rateCheck.allowed) {
      const retryAfter = 'retryAfterSeconds' in rateCheck ? rateCheck.retryAfterSeconds : 60;
      return NextResponse.json(
        { error: 'Serviço temporariamente indisponível ou limite de requisições excedido. Tente novamente em alguns instantes.', code: 'RATE_LIMITED' },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      );
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Payload JSON inválido.', code: 'INVALID_JSON' }, { status: 400 });
    }

    const {
      token,
      tema_estudo,
      observacoes,
      presentes_visitantes,
      presentes_criancas,
      conversoes_decisoes,
      reconciliacoes,
      testemunhos,
      pedidos_oracao,
      valor_oferta,
      frequencias,
      finalizar,
    } = body || {};

    if (!token || typeof token !== 'string' || token.trim().length < 32) {
      return NextResponse.json(
        { error: 'Token de acesso não fornecido ou inválido.', code: 'INVALID_TOKEN' },
        { status: 400 }
      );
    }

    const admin = createServerClient();
    const service = new CelulasService(admin);

    // Mapeamento e sanitização das frequências nominais
    let frequenciasSanitizadas: Array<{
      member_id?: string | null;
      nome_participante: string;
      tipo_participante?: CelulaParticipanteTipo;
      presente: boolean;
      justificativa_ausencia?: string | null;
    }> | undefined = undefined;

    let totalMembrosPresentes = 0;

    if (Array.isArray(frequencias) && frequencias.length > 0) {
      frequenciasSanitizadas = frequencias.map((f: any) => {
        const pres = Boolean(f.presente);
        if (pres) totalMembrosPresentes++;
        return {
          member_id: f.member_id || null,
          nome_participante: String(f.nome_participante || '').trim() || 'Participante',
          tipo_participante: (f.tipo_participante as CelulaParticipanteTipo) || 'membro',
          presente: pres,
          justificativa_ausencia: f.justificativa_ausencia?.trim() || null,
        };
      });
    } else {
      totalMembrosPresentes = Number(body.presentes_membros || 0);
    }

    // 2. Executar via RPC transacional atômica com bloqueio pessimista (FOR UPDATE)
    const resultado = await service.registrarChamadaRapidaTransacional(token, {
      tema_estudo: tema_estudo?.trim() || null,
      observacoes: observacoes?.trim() || null,
      presentes_membros: totalMembrosPresentes,
      presentes_visitantes: Number(presentes_visitantes || 0),
      presentes_criancas: Number(presentes_criancas || 0),
      conversoes_decisoes: Number(conversoes_decisoes || 0),
      reconciliacoes: Number(reconciliacoes || 0),
      testemunhos: Number(testemunhos || 0),
      pedidos_oracao: Number(pedidos_oracao || 0),
      valor_oferta: Number(valor_oferta || 0),
      frequencias: frequenciasSanitizadas,
      finalizar: Boolean(finalizar),
    });

    return NextResponse.json({
      success: true,
      data: resultado,
    });
  } catch (err: any) {
    const isConflict = err.message?.includes('finalizada') || err.message?.includes('revogado') || err.message?.includes('expirou');
    return NextResponse.json(
      { error: err.message || 'Erro ao registrar frequência da chamada rápida.', code: isConflict ? 'CONFLICT' : 'SERVER_ERROR' },
      { status: isConflict ? 409 : 500 }
    );
  }
}
