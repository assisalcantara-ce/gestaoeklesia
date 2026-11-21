import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { getClientIp } from '@/lib/rate-limit';
import { consumeRateLimit } from '@/lib/rate-limit-db';
import { CelulasService } from '@/services/celulas-service';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // 1. Rate Limiting distribuído no banco com fallback em memória (60 req/min por IP)
    const ip = getClientIp(request);
    const rateCheck = await consumeRateLimit({
      bucketKey: `celulas_chamada_get:${ip}`,
      limit: 60,
      windowMs: 60 * 1000,
    });
    if (!rateCheck.allowed) {
      const retryAfter = 'retryAfterSeconds' in rateCheck ? rateCheck.retryAfterSeconds : 60;
      return NextResponse.json(
        { error: 'Muitas requisições. Tente novamente em alguns instantes.', code: 'RATE_LIMITED' },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      );
    }

    const token = request.nextUrl.searchParams.get('token');
    if (!token || typeof token !== 'string' || token.trim().length < 32) {
      return NextResponse.json(
        { error: 'Token de chamada não informado ou inválido.', code: 'INVALID_TOKEN' },
        { status: 400 }
      );
    }

    const admin = createServerClient();
    const service = new CelulasService(admin);

    // 2. Validar token criptográfico (SHA-256), expiração e integridade
    const validacao = await service.validarTokenChamadaRapida(token);

    if (!validacao.valido) {
      const isExpired = validacao.motivo?.toLowerCase().includes('expirou');
      const isRevoked = validacao.motivo?.toLowerCase().includes('revogado');
      return NextResponse.json(
        {
          error: validacao.motivo || 'Link de chamada inválido ou expirado.',
          code: isExpired ? 'EXPIRED' : isRevoked ? 'REVOKED' : 'INVALID_TOKEN',
        },
        { status: isExpired || isRevoked ? 410 : 404 }
      );
    }

    const { tokenItem, celula, reuniao } = validacao;

    if (!celula || !tokenItem) {
      return NextResponse.json(
        { error: 'Dados da célula não localizados para este link.', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    // 3. Obter participantes da célula para chamada nominal
    const participantes = await service.listarParticipantes(tokenItem.ministry_id, {
      celula_id: tokenItem.celula_id,
      status: 'ativo',
    });

    // Sanitizar dados expostos publicamente (LGPD / Segurança)
    const participantesSanitizados = participantes.map((p) => ({
      id: p.id,
      member_id: p.member_id,
      nome_completo: p.nome_completo,
      papel: p.papel,
    }));

    // 4. Se houver reunião vinculada e ela já estiver finalizada
    const isFinalizada = reuniao?.status === 'finalizada';

    // 5. Configuração do ministério para terminologia e modelo de frequência
    const config = await service.obterConfiguracao(tokenItem.ministry_id);

    return NextResponse.json({
      data: {
        token: {
          id: tokenItem.id,
          tipo_acesso: tokenItem.tipo_acesso,
          expires_at: tokenItem.expires_at,
          status: tokenItem.status,
        },
        celula: {
          id: celula.id,
          nome: celula.nome,
          codigo: celula.codigo,
          dia_semana: celula.dia_semana,
          horario: celula.horario,
          modalidade: celula.modalidade,
          bairro: celula.bairro,
          cidade: celula.cidade,
        },
        reuniao: reuniao ? {
          id: reuniao.id,
          data_reuniao: reuniao.data_reuniao,
          horario_inicio: reuniao.horario_inicio,
          modalidade: reuniao.modalidade,
          status: reuniao.status,
          tema_estudo: reuniao.tema_estudo,
          observacoes: reuniao.observacoes,
          presentes_membros: reuniao.presentes_membros,
          presentes_visitantes: reuniao.presentes_visitantes,
          presentes_criancas: reuniao.presentes_criancas,
          conversoes_decisoes: reuniao.conversoes_decisoes,
          valor_oferta: reuniao.valor_oferta,
        } : null,
        is_finalizada: isFinalizada,
        config: {
          termo_celula: config.termo_celula || 'Célula',
          frequencia_obrigatoria: config.frequencia_obrigatoria || 'flexivel',
        },
        participantes: participantesSanitizados,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Erro ao carregar dados da chamada rápida.', code: 'SERVER_ERROR' },
      { status: 500 }
    );
  }
}
