/**
 * API ROUTE: Ações de Aprovação, Devolução e Rejeição de Pré-Cadastros (Secretaria)
 * POST /api/v1/secretaria/pre-cadastros/[id]/action
 *
 * Funcionalidades:
 * - Ações suportadas: 'aprovar' | 'devolver' | 'rejeitar'
 * - Idempotência estrita sob concorrência via RPC transacional `aprovar_member_pre_registration_rpc`.
 * - Bloqueio exclusivo em linha (SELECT ... FOR UPDATE) no PostgreSQL.
 * - Registro de operador (`analisado_por`), timestamp (`analisado_em`) e motivo (`motivo_rejeicao`).
 * - Transação atômica única: se qualquer inserção ou alocação falhar, nenhuma alteração em `members`
 *   ou em `member_pre_registrations` persiste.
 */

import { NextRequest, NextResponse } from 'next/server';
import { resolveTenantAuth } from '@/lib/tenant-auth';
import { temAcessoEscrita } from '@/lib/access-control';
import { authTenantErrorResponse } from '@/lib/api-errors';
import { logServerAudit } from '@/lib/audit-logger';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const context = await resolveTenantAuth(request);
    const { ministryId, admin, userId, nivel } = context;

    if (!ministryId) {
      return NextResponse.json({ error: 'Usuário sem ministério associado' }, { status: 403 });
    }

    if (!temAcessoEscrita(nivel as any, 'secretaria')) {
      return NextResponse.json({ error: 'Permissão de escrita necessária.' }, { status: 403 });
    }

    let body: Record<string, any>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
    }

    const { action, motivo, overrideTipoCadastro, overrideCargoMinisterial, matriculaSugerida } = body;

    if (!action || !['aprovar', 'devolver', 'rejeitar'].includes(action)) {
      return NextResponse.json(
        { error: 'Ação inválida. Utilize: aprovar, devolver ou rejeitar.' },
        { status: 400 }
      );
    }

    // 1. Buscar a solicitação no banco garantindo tenant
    const { data: preReg, error: fetchErr } = await admin
      .from('member_pre_registrations')
      .select('*, congregacoes(id, nome), campos(id, nome)')
      .eq('id', id)
      .eq('ministry_id', ministryId)
      .maybeSingle();

    if (fetchErr || !preReg) {
      return NextResponse.json({ error: 'Solicitação de pré-cadastro não encontrada.' }, { status: 404 });
    }

    // 2. Garantia preliminar de Idempotência
    if (preReg.status === 'aprovado') {
      return NextResponse.json(
        {
          error: 'Esta solicitação já foi aprovada anteriormente e não pode ser reprocessada.',
          code: 'ALREADY_APPROVED',
          preCadastro: preReg,
        },
        { status: 409 }
      );
    }

    const agora = new Date().toISOString();

    // ── AÇÃO: REJEITAR ────────────────────────────────────────────────────────
    if (action === 'rejeitar') {
      if (!motivo || typeof motivo !== 'string' || !motivo.trim()) {
        return NextResponse.json(
          { error: 'É obrigatório informar o motivo da rejeição.' },
          { status: 400 }
        );
      }

      const { data: updated, error: rejErr } = await admin
        .from('member_pre_registrations')
        .update({
          status: 'rejeitado',
          motivo_rejeicao: motivo.trim(),
          analisado_por: userId || null,
          analisado_em: agora,
          updated_at: agora,
        })
        .eq('id', id)
        .eq('ministry_id', ministryId)
        .eq('status', preReg.status) // Proteção atômica condicional
        .select('*')
        .single();

      if (rejErr) {
        return NextResponse.json({ error: 'Erro ao rejeitar solicitação.' }, { status: 500 });
      }

      await logServerAudit(admin, {
        ministryId,
        userId: userId || null,
        acao: 'atualizar_status',
        modulo: 'secretaria',
        tabelaAfetada: 'member_pre_registrations',
        registroId: id,
        descricao: `Pré-cadastro rejeitado: ${motivo.trim()}`,
        status: 'sucesso',
      });

      return NextResponse.json({
        success: true,
        action: 'rejeitado',
        message: 'Solicitação de pré-cadastro rejeitada com sucesso.',
        preCadastro: updated,
      });
    }

    // ── AÇÃO: DEVOLVER PARA CORREÇÃO ──────────────────────────────────────────
    if (action === 'devolver') {
      if (!motivo || typeof motivo !== 'string' || !motivo.trim()) {
        return NextResponse.json(
          { error: 'É obrigatório informar o motivo da devolução para correção.' },
          { status: 400 }
        );
      }

      const { data: updated, error: devErr } = await admin
        .from('member_pre_registrations')
        .update({
          status: 'devolvido',
          motivo_rejeicao: motivo.trim(),
          analisado_por: userId || null,
          analisado_em: agora,
          updated_at: agora,
        })
        .eq('id', id)
        .eq('ministry_id', ministryId)
        .eq('status', preReg.status) // Proteção atômica condicional
        .select('*')
        .single();

      if (devErr) {
        return NextResponse.json({ error: 'Erro ao devolver solicitação.' }, { status: 500 });
      }

      await logServerAudit(admin, {
        ministryId,
        userId: userId || null,
        acao: 'atualizar_status',
        modulo: 'secretaria',
        tabelaAfetada: 'member_pre_registrations',
        registroId: id,
        descricao: `Pré-cadastro devolvido para correção: ${motivo.trim()}`,
        status: 'sucesso',
      });

      return NextResponse.json({
        success: true,
        action: 'devolvido',
        message: 'Solicitação devolvida para correção com sucesso.',
        preCadastro: updated,
      });
    }

    // ── AÇÃO: APROVAR (Execução Transacional com Row Lock via RPC) ────────────
    if (action === 'aprovar') {
      // Tentar aprovação via RPC atômica transacional no PostgreSQL
      const { data: rpcResult, error: rpcErr } = await admin.rpc(
        'aprovar_member_pre_registration_rpc',
        {
          p_pre_reg_id: id,
          p_ministry_id: ministryId,
          p_analisado_por: userId || null,
          p_tipo_cadastro: overrideTipoCadastro || preReg.tipo_cadastro || 'membro',
          p_cargo_ministerial: overrideTipoCadastro === 'ministro' ? overrideCargoMinisterial || null : null,
          p_matricula_sugerida: matriculaSugerida ? String(matriculaSugerida).trim() : null,
        }
      );

      if (rpcErr) {
        console.error('[POST /api/v1/secretaria/pre-cadastros/[id]/action] Erro na RPC de aprovação:', rpcErr);
        return NextResponse.json(
          { error: rpcErr.message || 'Erro ao processar aprovação transacional.' },
          { status: 500 }
        );
      }

      if (rpcResult && rpcResult.success === false) {
        const statusCode = rpcResult.code === 'ALREADY_APPROVED' ? 409 : rpcResult.code === 'PLAN_LIMIT_REACHED' ? 403 : 400;
        return NextResponse.json(
          {
            error: rpcResult.error || 'Aprovação recusada.',
            code: rpcResult.code,
            memberId: rpcResult.member_id || null,
          },
          { status: statusCode }
        );
      }

      const memberIdFinal = rpcResult?.member_id || null;
      const matriculaFinal = rpcResult?.matricula || null;
      const isNovo = rpcResult?.action === 'novo_cadastro';

      await logServerAudit(admin, {
        ministryId,
        userId: userId || null,
        acao: isNovo ? 'criar' : 'editar',
        modulo: 'secretaria',
        tabelaAfetada: 'members',
        registroId: memberIdFinal,
        descricao: isNovo
          ? `Novo membro aprovado via pré-cadastro id ${id} com matrícula ${matriculaFinal}`
          : `Atualização cadastral aprovada via pré-cadastro id ${id}`,
        status: 'sucesso',
      });

      return NextResponse.json({
        success: true,
        action: 'aprovado',
        memberId: memberIdFinal,
        matricula: matriculaFinal,
        message: isNovo
          ? `Novo membro aprovado com sucesso! Matrícula oficial gerada: ${matriculaFinal}.`
          : 'Atualização cadastral homologada e aplicada com sucesso!',
      });
    }

    return NextResponse.json({ error: 'Ação não processada.' }, { status: 400 });
  } catch (err: any) {
    const authResp = authTenantErrorResponse(err);
    if (authResp) return authResp;
    console.error('[POST /api/v1/secretaria/pre-cadastros/[id]/action] Exceção:', err);
    return NextResponse.json({ error: 'Erro interno ao processar ação.' }, { status: 500 });
  }
}
