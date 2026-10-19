import { NextRequest, NextResponse } from 'next/server';
import { resolveTenantAuth } from '@/lib/tenant-auth';
import { isFeatureAllowedForTenant } from '@/lib/plan-permissions';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/eventos/[id]/certificado
 * Retorna os dados completos e validados do modelo de certificado associado ao evento.
 */
export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id: eventoId } = await props.params;
    const ctx = await resolveTenantAuth(request);

    if (!ctx.ministryId) {
      return NextResponse.json(
        { error: 'Usuário sem ministério associado.', code: 'NO_MINISTRY' },
        { status: 403 }
      );
    }

    const isAllowed = await isFeatureAllowedForTenant(ctx.admin, ctx.ministryId, 'events_module');
    if (!isAllowed) {
      return NextResponse.json(
        { error: 'Módulo de Eventos indisponível neste ministério.', code: 'FEATURE_DISABLED' },
        { status: 403 }
      );
    }

    if (!eventoId) {
      return NextResponse.json({ error: 'ID do evento é obrigatório.' }, { status: 400 });
    }

    // 1. Buscar evento pertencente ao ministério
    const { data: evento, error: evErr } = await ctx.admin
      .from('eventos')
      .select('id, titulo, data_inicio, data_fim, local_nome, local_endereco, status, includes_certificado:inclui_certificado, certificado_habilitado, certificado_modelo_id, ministry_id')
      .eq('id', eventoId)
      .eq('ministry_id', ctx.ministryId)
      .maybeSingle();

    if (evErr || !evento) {
      return NextResponse.json({ error: 'Evento não encontrado.' }, { status: 404 });
    }

    const certHabilitado = Boolean(evento.certificado_habilitado ?? evento.includes_certificado);
    const modeloId = evento.certificado_modelo_id;

    if (!certHabilitado || !modeloId) {
      return NextResponse.json(
        {
          error: 'Este evento não possui emissão de certificado habilitada ou modelo associado.',
          possui_certificado: false,
          code: 'CERTIFICADO_NAO_CONFIGURADO',
        },
        { status: 404 }
      );
    }

    // 2. Buscar o template correspondente no banco (busca flexível por template_key ou id UUID)
    const { data: certRow, error: certErr } = await ctx.admin
      .from('certificados_templates')
      .select('id, template_key, name, template_data, is_active, created_at, updated_at')
      .eq('ministry_id', ctx.ministryId)
      .or(`template_key.eq.${modeloId},id.eq.${modeloId}`)
      .maybeSingle();

    if (certErr || !certRow) {
      // Fallback: se não achar por or, tentar buscar template_key diretamente
      const { data: fallbackRow } = await ctx.admin
        .from('certificados_templates')
        .select('id, template_key, name, template_data, is_active, created_at, updated_at')
        .eq('ministry_id', ctx.ministryId)
        .eq('template_key', modeloId)
        .maybeSingle();

      if (!fallbackRow) {
        return NextResponse.json(
          {
            error: `O modelo de certificado associado ao evento (ID: "${modeloId}") não foi encontrado no banco de dados deste ministério.`,
            possui_certificado: true,
            modelo_id: modeloId,
            code: 'MODELO_NAO_ENCONTRADO',
          },
          { status: 404 }
        );
      }

      return formatResponse(evento, fallbackRow);
    }

    return formatResponse(evento, certRow);
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Erro interno ao consultar modelo de certificado do evento.', details: err?.message },
      { status: 500 }
    );
  }
}

function formatResponse(evento: any, certRow: any) {
  const td = typeof certRow.template_data === 'string'
    ? (() => { try { return JSON.parse(certRow.template_data); } catch { return {}; } })()
    : (certRow.template_data || {});

  const canonicalKey = certRow.template_key || td.id || certRow.id;
  const nome = td.nome || certRow.name || 'Certificado';
  const categoria = (td.categoria || td.category || 'eventos').toString().toLowerCase();

  return NextResponse.json({
    sucesso: true,
    evento: {
      id: evento.id,
      titulo: evento.titulo,
      data_inicio: evento.data_inicio,
      data_fim: evento.data_fim,
      local_nome: evento.local_nome,
      local_endereco: evento.local_endereco,
      certificado_modelo_id: evento.certificado_modelo_id,
    },
    template: {
      db_id: certRow.id,
      template_key: canonicalKey,
      id: canonicalKey,
      nome,
      categoria,
      orientacao: td.orientacao || 'landscape',
      backgroundUrl: td.backgroundUrl || null,
      elementos: td.elementos || [],
      ativo: certRow.is_active !== false,
      updated_at: certRow.updated_at,
    },
  });
}
