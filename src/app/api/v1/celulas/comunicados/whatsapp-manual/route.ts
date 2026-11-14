import { NextRequest, NextResponse } from 'next/server';
import { resolveTenantAuth } from '@/lib/tenant-auth';
import { temAcessoEscrita } from '@/lib/access-control';
import { CelulasService } from '@/services/celulas-service';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  let ctx: Awaited<ReturnType<typeof resolveTenantAuth>>;
  try {
    ctx = await resolveTenantAuth(request);
  } catch (err: any) {
    const isUnauth = err?.message === 'UNAUTHORIZED';
    return NextResponse.json(
      { error: isUnauth ? 'Não autenticado.' : 'Acesso negado: sem ministério associado.' },
      { status: isUnauth ? 401 : 403 }
    );
  }

  const { admin, ministryId, nivel, userId, congregacaoId } = ctx;

  if (!temAcessoEscrita(nivel, 'celulas') && !temAcessoEscrita(nivel, 'secretaria') && !temAcessoEscrita(nivel, 'secretaria_local')) {
    return NextResponse.json({ error: 'Permissão negada para preparar mensagens de WhatsApp.' }, { status: 403 });
  }

  try {
    const body = await request.json();

    // Se o usuário possui restrição de congregação local, garantir que a célula alvo pertence à sua congregação
    if (congregacaoId && body.celula_id) {
      const { data: celulaAlvo } = await admin
        .from('celulas')
        .select('congregacao_id')
        .eq('id', body.celula_id)
        .eq('ministry_id', ministryId)
        .single();

      if (celulaAlvo && celulaAlvo.congregacao_id && celulaAlvo.congregacao_id !== congregacaoId) {
        return NextResponse.json({ error: 'Acesso negado: a célula informada pertence a outra congregação.' }, { status: 403 });
      }
    }

    const service = new CelulasService(admin);
    const preparada = await service.prepararMensagemWhatsAppManual(ministryId, body, userId);

    return NextResponse.json({ data: preparada });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Erro ao preparar mensagem WhatsApp' }, { status: 400 });
  }
}
