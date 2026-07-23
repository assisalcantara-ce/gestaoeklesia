import { NextRequest, NextResponse } from 'next/server';
import { ImpersonationService } from '@/lib/security/ImpersonationService';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { sessionId } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'O parâmetro sessionId é obrigatório para encerrar a impersonação.' },
        { status: 400 }
      );
    }

    const result = await ImpersonationService.endImpersonation(sessionId, 'user_action');

    return NextResponse.json({
      success: true,
      message: 'Sessão de impersonação encerrada com sucesso.',
      session: result.session,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erro ao encerrar sessão de impersonação.' },
      { status: 500 }
    );
  }
}
