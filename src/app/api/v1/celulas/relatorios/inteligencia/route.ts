import { NextRequest, NextResponse } from 'next/server';
import { resolveTenantAuth } from '@/lib/tenant-auth';
import { temAcesso } from '@/lib/access-control';
import { CelulasService } from '@/services/celulas-service';
import { CelulaFiltrosInteligencia } from '@/types/celulas';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
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

  const { admin, ministryId, nivel, congregacaoId } = ctx;

  // Verificação RBAC: Somente perfis autorizados (Pastor, Administrador, Secretaria, Supervisores de Células)
  if (!temAcesso(nivel, 'celulas') && !temAcesso(nivel, 'secretaria') && !temAcesso(nivel, 'secretaria_local')) {
    return NextResponse.json({ error: 'Acesso negado ao painel de inteligência de células.' }, { status: 403 });
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    let filterCongregacaoId = searchParams.get('congregacao_id');

    // Escopo congregacional estrito: usuário restrito a congregação não pode acessar dados globais
    if (congregacaoId) {
      filterCongregacaoId = congregacaoId;
    }

    const filtros: CelulaFiltrosInteligencia = {
      congregacao_id: filterCongregacaoId,
      rede_id: searchParams.get('rede_id'),
      celula_id: searchParams.get('celula_id'),
      supervisor_member_id: searchParams.get('supervisor_member_id'),
      data_inicio: searchParams.get('data_inicio'),
      data_fim: searchParams.get('data_fim'),
    };

    const service = new CelulasService(admin);
    const painel = await service.gerarPainelInteligenciaPastoral(ministryId, filtros);

    return NextResponse.json({ data: painel });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Erro ao gerar painel de inteligência pastoral' },
      { status: 500 }
    );
  }
}
