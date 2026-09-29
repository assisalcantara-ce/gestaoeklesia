import { NextRequest, NextResponse } from 'next/server';
import { resolveTenantAuth } from '@/lib/tenant-auth';
import { isFeatureAllowedForTenant } from '@/lib/plan-permissions';
import {
  normalizarConfigAdvertencia,
  ConfigAdvertenciaMinisterial,
} from '@/lib/reunioes-config-advertencia';

export const dynamic = 'force-dynamic';

const REUNIOES_RESTRICTED_RESPONSE = {
  error: 'O Módulo de Reuniões está disponível a partir do Plano Intermediário.',
  code: 'PLAN_RESTRICTED',
  required_plan: 'intermediate',
} as const;

/**
 * GET /api/v1/reunioes/configuracoes/advertencia
 * Retorna as configurações de texto da Carta de Advertência para o ministério autenticado.
 */
export async function GET(request: NextRequest) {
  try {
    const ctx = await resolveTenantAuth(request);

    if (!ctx.ministryId) {
      return NextResponse.json(
        { error: 'Usuário sem ministério associado.', code: 'NO_MINISTRY' },
        { status: 403 }
      );
    }

    const isAllowed = await isFeatureAllowedForTenant(ctx.admin, ctx.ministryId, 'meetings_module');
    if (!isAllowed) {
      return NextResponse.json(REUNIOES_RESTRICTED_RESPONSE, { status: 403 });
    }

    // Busca o registro do ministério na tabela configurations
    const { data: configRow } = await ctx.admin
      .from('configurations')
      .select('reunioes_advertencia, church_profile')
      .eq('ministry_id', ctx.ministryId)
      .maybeSingle();

    const rawData =
      (configRow as any)?.reunioes_advertencia ||
      (configRow as any)?.church_profile?.reunioes_advertencia ||
      null;

    const data = normalizarConfigAdvertencia(rawData);

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (err: any) {
    if (err?.message === 'UNAUTHORIZED') {
      return NextResponse.json(
        { error: 'Não autorizado. Faça login novamente.', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }
    return NextResponse.json(
      { error: 'Erro ao consultar configurações da advertência.', detail: err?.message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/v1/reunioes/configuracoes/advertencia
 * Salva as configurações de texto da Carta de Advertência e registra auditoria.
 * Acesso exclusivo para Administradores do Ministério.
 */
export async function PUT(request: NextRequest) {
  try {
    const ctx = await resolveTenantAuth(request);

    if (!ctx.ministryId) {
      return NextResponse.json(
        { error: 'Usuário sem ministério associado.', code: 'NO_MINISTRY' },
        { status: 403 }
      );
    }

    // Permissão: somente administrador ou proprietário do tenant
    const isAdmin =
      ctx.isOwner ||
      ctx.nivel === 'administrador' ||
      ctx.roles.some((r) => ['ADMINISTRADOR', 'ADMIN'].includes(r.toUpperCase()));

    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Apenas administradores do ministério podem alterar as configurações.', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    const isAllowed = await isFeatureAllowedForTenant(ctx.admin, ctx.ministryId, 'meetings_module');
    if (!isAllowed) {
      return NextResponse.json(REUNIOES_RESTRICTED_RESPONSE, { status: 403 });
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Body JSON inválido.' }, { status: 400 });
    }

    // Sanitização e formatação dos textos
    const textoAbertura = typeof body?.texto_abertura === 'string' ? body.texto_abertura.trim() : '';
    const fundamentacao = typeof body?.fundamentacao_estatutaria === 'string' ? body.fundamentacao_estatutaria.trim() : '';
    const textoComplementar = typeof body?.texto_complementar === 'string' ? body.texto_complementar.trim() : '';
    const textoEncerramento = typeof body?.texto_encerramento === 'string' ? body.texto_encerramento.trim() : '';

    if (!textoAbertura) {
      return NextResponse.json(
        { error: 'O texto de abertura/notificação é obrigatório.' },
        { status: 400 }
      );
    }

    const agora = new Date().toISOString();

    const novoObjetoConfig: ConfigAdvertenciaMinisterial = {
      texto_abertura: textoAbertura,
      fundamentacao_estatutaria: fundamentacao,
      texto_complementar: textoComplementar,
      texto_encerramento: textoEncerramento,
      updated_at: agora,
      updated_by: ctx.userId,
    };

    // 1. Obter dados anteriores para log de auditoria
    const { data: existingConfig } = await ctx.admin
      .from('configurations')
      .select('id, reunioes_advertencia, church_profile')
      .eq('ministry_id', ctx.ministryId)
      .maybeSingle();

    const oldConfig =
      (existingConfig as any)?.reunioes_advertencia ||
      (existingConfig as any)?.church_profile?.reunioes_advertencia ||
      null;

    const churchProfileAtual = (existingConfig as any)?.church_profile || {};
    const updatedChurchProfile = {
      ...churchProfileAtual,
      reunioes_advertencia: novoObjetoConfig,
    };

    // 2. Persistir no banco de dados
    if (existingConfig?.id) {
      // Tenta atualizar reunioes_advertencia e church_profile
      const { error: updateErr } = await ctx.admin
        .from('configurations')
        .update({
          reunioes_advertencia: novoObjetoConfig,
          church_profile: updatedChurchProfile,
          updated_at: agora,
        })
        .eq('ministry_id', ctx.ministryId);

      if (updateErr) {
        // Fallback caso a coluna reunioes_advertencia ainda não tenha sido aplicada no schema
        await ctx.admin
          .from('configurations')
          .update({
            church_profile: updatedChurchProfile,
            updated_at: agora,
          })
          .eq('ministry_id', ctx.ministryId);
      }
    } else {
      // Insere novo registro na configurations caso não exista
      await ctx.admin.from('configurations').insert({
        ministry_id: ctx.ministryId,
        reunioes_advertencia: novoObjetoConfig,
        church_profile: updatedChurchProfile,
        nomenclaturas: {},
      });
    }

    // 3. Registrar auditoria em audit_logs
    try {
      const ip =
        request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        request.headers.get('x-real-ip') ||
        '127.0.0.1';
      const userAgent = request.headers.get('user-agent') || 'desconhecido';

      await ctx.admin.from('audit_logs').insert({
        ministry_id: ctx.ministryId,
        user_id: ctx.userId,
        usuario_id: ctx.userId,
        action: 'UPDATE',
        acao: 'editar',
        resource_type: 'REUNIOES',
        modulo: 'REUNIOES',
        tabela_afetada: 'configurations',
        registro_id: ctx.ministryId,
        descricao: 'Alteração dos textos normativos da Carta de Advertência Ministerial',
        old_data: oldConfig,
        dados_anteriores: oldConfig,
        new_data: novoObjetoConfig,
        dados_novos: novoObjetoConfig,
        status: 'sucesso',
        status_code: 200,
        ip_address: ip,
        user_agent: userAgent,
      });
    } catch (auditErr: any) {
      console.warn('[Audit Log] Falha ao registrar log de auditoria:', auditErr?.message);
    }

    return NextResponse.json({
      success: true,
      message: 'Configurações da carta de advertência salvas com sucesso.',
      data: novoObjetoConfig,
    });
  } catch (err: any) {
    if (err?.message === 'UNAUTHORIZED') {
      return NextResponse.json(
        { error: 'Não autorizado. Faça login novamente.', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }
    return NextResponse.json(
      { error: 'Erro interno ao salvar configurações da advertência.', detail: err?.message },
      { status: 500 }
    );
  }
}
