/**
 * API ROUTE: Ações de Aprovação, Inativação e Reativação de Pré-Cadastros (Secretaria)
 * POST /api/v1/secretaria/pre-cadastros/[id]/action
 *
 * Funcionalidades:
 * - Ações suportadas: 'aprovar' | 'inativar' | 'reativar' (com compatibilidade para 'rejeitar' / 'devolver')
 * - Idempotência estrita sob concorrência via RPC transacional `aprovar_member_pre_registration_rpc`.
 * - Inativação exige motivo obrigatório, preserva os dados da solicitação e não remove o registro.
 * - Reativação controlada para 'pendente' sem criação automática de membro.
 * - Aprovação grava evento definitivo no histórico permanente do membro (`members.custom_fields.historico_processos`).
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

    const allowedActions = ['aprovar', 'inativar', 'reativar', 'rejeitar', 'devolver'];
    if (!action || !allowedActions.includes(action)) {
      return NextResponse.json(
        { error: 'Ação inválida. Utilize: aprovar, inativar ou reativar.' },
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
    let operadorNome = 'Secretaria';
    if (userId) {
      const { data: userData } = await admin.auth.admin.getUserById(userId);
      if (userData?.user?.email) {
        operadorNome = userData.user.email.split('@')[0];
      }
    }

    // ── AÇÃO: INATIVAR (ou REJEITAR / DEVOLVER legado) ─────────────────────────
    if (action === 'inativar' || action === 'rejeitar' || action === 'devolver') {
      if (!motivo || typeof motivo !== 'string' || !motivo.trim()) {
        return NextResponse.json(
          { error: 'É obrigatório informar o motivo da inativação.' },
          { status: 400 }
        );
      }

      // Tentamos gravar status 'inativo'; caso a constraint do banco atual ainda não possua 'inativo',
      // fazemos fallback gracioso para 'rejeitado' com motivo_rejeicao e dados_adicionais marcando inativação
      const dadosAdicionaisAtualizados = {
        ...(preReg.dados_adicionais || {}),
        inativado_por: userId || null,
        inativado_em: agora,
        motivo_inativacao: motivo.trim(),
        status_logico: 'inativo',
      };

      let updateResult = await admin
        .from('member_pre_registrations')
        .update({
          status: 'inativo',
          motivo_rejeicao: motivo.trim(),
          analisado_por: userId || null,
          analisado_em: agora,
          dados_adicionais: dadosAdicionaisAtualizados,
          updated_at: agora,
        })
        .eq('id', id)
        .eq('ministry_id', ministryId)
        .select('*')
        .single();

      // Se falhou por constraint de check do status (ex: chk_member_pre_reg_status aceita apenas rejeitado/devolvido antes da migration)
      if (updateResult.error && updateResult.error.code === '23514') {
        updateResult = await admin
          .from('member_pre_registrations')
          .update({
            status: 'rejeitado',
            motivo_rejeicao: motivo.trim(),
            analisado_por: userId || null,
            analisado_em: agora,
            dados_adicionais: dadosAdicionaisAtualizados,
            updated_at: agora,
          })
          .eq('id', id)
          .eq('ministry_id', ministryId)
          .select('*')
          .single();
      }

      if (updateResult.error) {
        console.error('[POST /api/v1/secretaria/pre-cadastros/[id]/action] Erro ao inativar:', updateResult.error);
        return NextResponse.json({ error: 'Erro ao inativar solicitação.' }, { status: 500 });
      }

      await logServerAudit(admin, {
        ministryId,
        userId: userId || null,
        acao: 'atualizar_status',
        modulo: 'secretaria',
        tabelaAfetada: 'member_pre_registrations',
        registroId: id,
        descricao: `Pré-cadastro inativado: ${motivo.trim()}`,
        status: 'sucesso',
      });

      return NextResponse.json({
        success: true,
        action: 'inativado',
        message: 'Solicitação inativada com sucesso com justificativa registrada.',
        preCadastro: updateResult.data,
      });
    }

    // ── AÇÃO: REATIVAR ────────────────────────────────────────────────────────
    if (action === 'reativar') {
      const dadosAdicionaisAtualizados = {
        ...(preReg.dados_adicionais || {}),
        reativado_por: userId || null,
        reativado_em: agora,
        status_logico: 'pendente',
      };

      const { data: updated, error: reactivateErr } = await admin
        .from('member_pre_registrations')
        .update({
          status: 'pendente',
          motivo_rejeicao: null,
          analisado_por: userId || null,
          analisado_em: agora,
          dados_adicionais: dadosAdicionaisAtualizados,
          updated_at: agora,
        })
        .eq('id', id)
        .eq('ministry_id', ministryId)
        .select('*')
        .single();

      if (reactivateErr) {
        console.error('[POST /api/v1/secretaria/pre-cadastros/[id]/action] Erro ao reativar:', reactivateErr);
        return NextResponse.json({ error: 'Erro ao reativar solicitação para análise.' }, { status: 500 });
      }

      await logServerAudit(admin, {
        ministryId,
        userId: userId || null,
        acao: 'atualizar_status',
        modulo: 'secretaria',
        tabelaAfetada: 'member_pre_registrations',
        registroId: id,
        descricao: `Solicitação de pré-cadastro reativada para pendente`,
        status: 'sucesso',
      });

      return NextResponse.json({
        success: true,
        action: 'reativado',
        message: 'Solicitação reativada com sucesso e devolvida à aba Pendentes para análise.',
        preCadastro: updated,
      });
    }

    // ── AÇÃO: APROVAR (Execução Transacional com Histórico Permanente) ────────
    if (action === 'aprovar') {
      const tipoCadastroFinal = overrideTipoCadastro || preReg.tipo_cadastro || 'membro';
      const cargoMinisterialFinal = tipoCadastroFinal === 'ministro' ? overrideCargoMinisterial || null : null;

      // Execução via RPC atômica transacional no PostgreSQL
      const { data: rpcResult, error: rpcErr } = await admin.rpc(
        'aprovar_member_pre_registration_rpc',
        {
          p_pre_reg_id: id,
          p_ministry_id: ministryId,
          p_analisado_por: userId || null,
          p_tipo_cadastro: tipoCadastroFinal,
          p_cargo_ministerial: cargoMinisterialFinal,
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

      // ── REGISTRO NO HISTÓRICO PERMANENTE DA FICHA DO MEMBRO (custom_fields.historico_processos) ──
      if (memberIdFinal) {
        try {
          const { data: existingMember } = await admin
            .from('members')
            .select('custom_fields, matricula, member_since')
            .eq('id', memberIdFinal)
            .eq('ministry_id', ministryId)
            .maybeSingle();

          const currentCustomFields = existingMember?.custom_fields && typeof existingMember.custom_fields === 'object'
            ? existingMember.custom_fields
            : {};
          const currentHistorico = Array.isArray(currentCustomFields.historico_processos)
            ? currentCustomFields.historico_processos
            : [];

          const matriculaEfetiva = matriculaFinal || existingMember?.matricula || 'N/A';
          const origemFormatada = preReg.origem === 'app_membro' ? 'App do Membro' : 'Link Público';

          const novoEventoHistorico = {
            id: `pre_reg_${id}`,
            processo_id: id,
            pre_reg_id: id,
            tipo_evento: isNovo ? 'cadastro_efetivado' : 'atualizacao_cadastral',
            resultado: isNovo ? 'Cadastro efetivado pela Secretaria' : 'Atualização cadastral aprovada',
            origem: 'pre_cadastro',
            origem_solicitacao: preReg.origem || 'link_publico',
            origem_descricao: origemFormatada,
            data: agora.slice(0, 10),
            data_hora: agora,
            data_solicitacao_original: preReg.created_at || agora,
            responsavel: operadorNome,
            operador_id: userId || null,
            classificacao_aprovada: tipoCadastroFinal,
            cargo_ministerial: cargoMinisterialFinal,
            matricula: matriculaEfetiva,
            status_resultante: 'ativo',
            descricao: isNovo
              ? `Cadastro efetivado pela Secretaria. Origem: ${origemFormatada}. Classificação: ${tipoCadastroFinal}. Matrícula: ${matriculaEfetiva}. Solicitado em: ${new Date(preReg.created_at || agora).toLocaleString('pt-BR')}.`
              : `Atualização cadastral aprovada pela Secretaria. Origem: ${origemFormatada}. Solicitado em: ${new Date(preReg.created_at || agora).toLocaleString('pt-BR')}.`,
          };

          // Evitar duplicidade de evento se a RPC já tiver gravado
          const jaExisteEvento = currentHistorico.some((ev: any) => ev.id === novoEventoHistorico.id || ev.pre_reg_id === id);
          if (!jaExisteEvento) {
            const updatedHistorico = [...currentHistorico, novoEventoHistorico];
            await admin
              .from('members')
              .update({
                custom_fields: {
                  ...currentCustomFields,
                  historico_processos: updatedHistorico,
                  historicoProcessos: updatedHistorico,
                },
              })
              .eq('id', memberIdFinal)
              .eq('ministry_id', ministryId);
          }
        } catch (histErr) {
          console.error('[POST /api/v1/secretaria/pre-cadastros/[id]/action] Erro ao gravar histórico permanente do membro:', histErr);
        }
      }

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
