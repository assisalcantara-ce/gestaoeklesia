import { NextRequest, NextResponse } from 'next/server';
import { ImpersonationService } from '@/lib/security/ImpersonationService';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization') || '';
    const queryToken = request.nextUrl.searchParams.get('token') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim() || queryToken.trim();

    if (!token) {
      return NextResponse.json(
        {
          valid: false,
          status: 'invalid',
          error: 'Nenhum token de impersonação foi fornecido no cabeçalho Authorization ou parâmetro token.',
        },
        { status: 400 }
      );
    }

    const validation = await ImpersonationService.validateImpersonation(token);

    if (!validation.valid || !validation.session) {
      return NextResponse.json(
        {
          valid: false,
          status: validation.status,
          error: validation.error || 'Token inválido ou expirado.',
        },
        { status: 401 }
      );
    }

    const session = validation.session;

    return NextResponse.json({
      valid: true,
      status: validation.status,
      tenant: {
        id: session.tenantId,
        name: session.tenantName || 'Ministério Alvo',
      },
      readOnly: session.readOnly,
      expiresAt: new Date(validation.payload!.expiresAt * 1000).toISOString(),
      session,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        valid: false,
        status: 'invalid',
        error: error.message || 'Erro ao consultar status da impersonação.',
      },
      { status: 500 }
    );
  }
}
