import { NextRequest, NextResponse } from 'next/server';
import { resolveTenantAuth } from '@/lib/tenant-auth';
import { isArrecadacaoDigitalAllowedForTenant } from '@/lib/plan-permissions';
import { decryptCredentials } from '@/lib/ministry-credentials';
import { deleteAsaasStaticPixQrCode } from '@/lib/asaas-eventos';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

// Função auxiliar para remover QR Code estático do ASAAS antes de desativar
async function removeAsaasStaticQrCodeIfPresent(
  admin: any,
  ministryId: string,
  destinationId: string
): Promise<{ success: boolean; error?: string }> {
  // 1. Busca o destino para verificar se tem pix_qr_code_id
  const { data: dest } = await admin
    .from('fin_payment_destinations')
    .select('id, pix_qr_code_id, gateway_id, is_ativo')
    .eq('id', destinationId)
    .eq('ministry_id', ministryId)
    .maybeSingle();

  if (!dest) {
    return { success: false, error: 'Destino não encontrado.' };
  }

  // Se o destino não possui pix_qr_code_id (legado), não precisa chamar ASAAS
  if (!dest.pix_qr_code_id) {
    return { success: true };
  }

  // 2. Busca o gateway ASAAS do tenant para obter as credenciais
  const { data: gw } = await admin
    .from('ministry_payment_gateways')
    .select('id, encrypted_credentials')
    .eq('id', dest.gateway_id || '')
    .eq('ministry_id', ministryId)
    .eq('gateway', 'asaas')
    .eq('is_active', true)
    .maybeSingle();

  if (!gw?.encrypted_credentials) {
    return {
      success: false,
      error: 'Gateway ASAAS do tenant não encontrado ou inativo. O QR Code não pôde ser desativado.',
    };
  }

  // 3. Descriptografa credenciais e executa o DELETE no ASAAS
  try {
    const creds = decryptCredentials(gw.encrypted_credentials);
    const apiKey = creds.apiKey ?? creds.api_key ?? '';
    if (!apiKey) throw new Error('API Key ausente nas credenciais.');

    await deleteAsaasStaticPixQrCode(apiKey, dest.pix_qr_code_id);
    return { success: true };
  } catch (err: any) {
    return {
      success: false,
      error: `Não foi possível desativar o QR Code no ASAAS: ${err.message || 'Erro de comunicação'}.`,
    };
  }
}

// ─── GET ──────────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest, context: Ctx) {
  const { id } = await context.params;
  const ctx = await resolveTenantAuth(request);

  if (!ctx.ministryId) {
    return NextResponse.json({ error: 'Sem ministério.' }, { status: 403 });
  }

  const allowedPlan = await isArrecadacaoDigitalAllowedForTenant(ctx.admin, ctx.ministryId);
  if (!allowedPlan) {
    return NextResponse.json(
      { error: 'A funcionalidade Arrecadação Digital está disponível a partir do Plano Intermediário.', code: 'PLAN_RESTRICTED', required_plan: 'intermediario' },
      { status: 403 }
    );
  }

  const { data, error } = await ctx.admin
    .from('fin_payment_destinations')
    .select('*, congregacoes(nome)')
    .eq('id', id)
    .eq('ministry_id', ctx.ministryId)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: 'Destino não encontrado.' }, { status: 404 });
  }

  return NextResponse.json({ data });
}

// ─── PUT ──────────────────────────────────────────────────────────────────────
export async function PUT(request: NextRequest, context: Ctx) {
  const { id } = await context.params;
  const ctx = await resolveTenantAuth(request);

  if (!ctx.ministryId) {
    return NextResponse.json({ error: 'Sem ministério.' }, { status: 403 });
  }

  const allowedPlan = await isArrecadacaoDigitalAllowedForTenant(ctx.admin, ctx.ministryId);
  if (!allowedPlan) {
    return NextResponse.json(
      { error: 'A funcionalidade Arrecadação Digital está disponível a partir do Plano Intermediário.', code: 'PLAN_RESTRICTED', required_plan: 'intermediario' },
      { status: 403 }
    );
  }

  const canEdit =
    ctx.isOwner ||
    ctx.nivel === 'administrador' ||
    ctx.nivel === 'financeiro';

  if (!canEdit) {
    return NextResponse.json({ error: 'Sem permissão para editar destinos.' }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 });
  }

  const ALLOWED = [
    'label',
    'descricao',
    'tipo_recebimento',
    'congregacao_id',
    'conta_id',
    'categoria_id',
    'valor_fixo',
    'is_ativo',
    'expires_at',
    'cor',
    'icone',
  ] as const;

  const TIPOS_VALIDOS = ['dizimo', 'oferta', 'missoes', 'doacao', 'campanha_local', 'evento_local'];

  if ('tipo_recebimento' in body && !TIPOS_VALIDOS.includes(String(body.tipo_recebimento))) {
    return NextResponse.json({ error: 'Tipo de recebimento inválido.' }, { status: 400 });
  }

  // Se está solicitando desativação (is_ativo === false), tentar remover o QR Code no ASAAS primeiro
  if ('is_ativo' in body && body.is_ativo === false) {
    const removalResult = await removeAsaasStaticQrCodeIfPresent(ctx.admin, ctx.ministryId, id);
    if (!removalResult.success) {
      return NextResponse.json(
        { error: removalResult.error || 'Falha ao desativar QR Code no ASAAS.' },
        { status: 502 }
      );
    }
  }

  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const field of ALLOWED) {
    if (field in body) {
      payload[field] = body[field] === '' ? null : body[field];
    }
  }

  const { data, error } = await ctx.admin
    .from('fin_payment_destinations')
    .update(payload)
    .eq('id', id)
    .eq('ministry_id', ctx.ministryId)
    .select('*')
    .single();

  if (error) {
    return NextResponse.json({ error: 'Erro ao atualizar destino.', detail: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}

// ─── DELETE — exclusão física de destino inativo ──────────────────────────────
export async function DELETE(request: NextRequest, context: Ctx) {
  const { id } = await context.params;
  const ctx = await resolveTenantAuth(request);

  if (!ctx.ministryId) {
    return NextResponse.json({ error: 'Sem ministério.' }, { status: 403 });
  }

  const allowedPlan = await isArrecadacaoDigitalAllowedForTenant(ctx.admin, ctx.ministryId);
  if (!allowedPlan) {
    return NextResponse.json(
      { error: 'A funcionalidade Arrecadação Digital está disponível a partir do Plano Intermediário.', code: 'PLAN_RESTRICTED', required_plan: 'intermediario' },
      { status: 403 }
    );
  }

  const canDelete = ctx.isOwner || ctx.nivel === 'administrador';
  if (!canDelete) {
    return NextResponse.json(
      { error: 'Somente ADMINISTRADOR pode excluir destinos.' },
      { status: 403 }
    );
  }

  // 1. Busca o destino para verificar status
  const { data: dest } = await ctx.admin
    .from('fin_payment_destinations')
    .select('id, is_ativo, label')
    .eq('id', id)
    .eq('ministry_id', ctx.ministryId)
    .maybeSingle();

  if (!dest) {
    return NextResponse.json({ error: 'Destino não encontrado.' }, { status: 404 });
  }

  // 2. REGRA DE NEGÓCIO: Destino ATIVO não pode ser excluído diretamente
  if (dest.is_ativo) {
    return NextResponse.json(
      { error: 'Destinos ativos não podem ser excluídos diretamente. Desative o destino primeiro.' },
      { status: 400 }
    );
  }

  // 3. VERIFICAÇÃO DE DEPENDÊNCIAS / HISTÓRICO FINANCEIRO
  // a) Verifica se existem cobranças vinculadas (fin_payment_charges)
  const { count: chargesCount } = await ctx.admin
    .from('fin_payment_charges')
    .select('id', { count: 'exact', head: true })
    .eq('destination_id', id);

  if (chargesCount && chargesCount > 0) {
    return NextResponse.json(
      {
        error: `O destino "${dest.label}" possui ${chargesCount} cobrança(s)/doação(ões) no histórico financeiro e não pode ser excluído para preservar os registros contábeis.`,
        code: 'HAS_FINANCIAL_HISTORY',
      },
      { status: 400 }
    );
  }

  // b) Verifica se existem eventos de webhook vinculados (fin_webhook_events)
  const { count: webhooksCount } = await ctx.admin
    .from('fin_webhook_events')
    .select('id', { count: 'exact', head: true })
    .eq('destination_id', id);

  if (webhooksCount && webhooksCount > 0) {
    return NextResponse.json(
      {
        error: `O destino "${dest.label}" possui eventos de webhook associados no histórico e não pode ser excluído.`,
        code: 'HAS_WEBHOOK_HISTORY',
      },
      { status: 400 }
    );
  }

  // 4. Executa a exclusão física do registro
  const { error } = await ctx.admin
    .from('fin_payment_destinations')
    .delete()
    .eq('id', id)
    .eq('ministry_id', ctx.ministryId);

  if (error) {
    return NextResponse.json({ error: 'Erro ao excluir destino.', detail: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
