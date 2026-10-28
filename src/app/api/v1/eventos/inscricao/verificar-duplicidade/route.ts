/**
 * API ROUTE: Verificação Imediata de Duplicidade de Inscrição em Eventos
 * POST /api/v1/eventos/inscricao/verificar-duplicidade
 */

import { NextRequest, NextResponse } from 'next/server';
import { resolveTenantAuth } from '@/lib/tenant-auth';
import { normalizarCpfSomenteDigitos, formatarStatusLegivel } from '@/lib/evento-duplicidade-utils';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const ctx = await resolveTenantAuth(request);
    if (!ctx.ministryId) {
      return NextResponse.json({ error: 'Usuário sem ministério associado.', code: 'NO_MINISTRY' }, { status: 403 });
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Body JSON inválido.' }, { status: 400 });
    }

    const { evento_id, member_id, cpf, ignore_inscricao_id } = body || {};

    if (!evento_id || typeof evento_id !== 'string') {
      return NextResponse.json({ error: 'evento_id é obrigatório.' }, { status: 400 });
    }

    const cpfNormalizado = normalizarCpfSomenteDigitos(cpf);
    const hasMember = Boolean(member_id && typeof member_id === 'string' && member_id.trim());
    const hasCpf = Boolean(cpfNormalizado && cpfNormalizado.length === 11);

    if (!hasMember && !hasCpf) {
      return NextResponse.json({ duplicado: false });
    }

    const admin = ctx.admin;
    const statusAtivos = ['confirmado', 'aguardando_pagamento', 'lista_espera'];

    // 1. Verificação por member_id
    if (hasMember) {
      let query = admin
        .from('eventos_inscricoes')
        .select('id, status, created_at, nome_externo, observacoes')
        .eq('ministry_id', ctx.ministryId)
        .eq('evento_id', evento_id)
        .eq('member_id', member_id)
        .in('status', statusAtivos);

      if (ignore_inscricao_id) {
        query = query.neq('id', ignore_inscricao_id);
      }

      const { data: existenteMembro, error: errMem } = await query.maybeSingle();

      if (errMem) {
        console.error('[verificar-duplicidade] Erro busca member_id:', errMem);
      }

      if (existenteMembro) {
        const statusLegivel = formatarStatusLegivel(existenteMembro.status);
        return NextResponse.json({
          duplicado: true,
          motivo: 'member_id',
          inscricao_existente: {
            id: existenteMembro.id,
            status: existenteMembro.status,
            status_legivel: statusLegivel,
            created_at: existenteMembro.created_at,
          },
          mensagem: `Este membro já possui uma inscrição com situação "${statusLegivel}" neste evento.`,
        });
      }
    }

    // 2. Verificação por CPF (aplicável a membros antigos ou participantes externos)
    if (hasCpf) {
      // 2.a. Descobrir se há membro cadastrado no ministério com este CPF
      const { data: membroComCpf } = await admin
        .from('members')
        .select('id, name')
        .eq('ministry_id', ctx.ministryId)
        .eq('cpf', cpfNormalizado)
        .maybeSingle();

      if (membroComCpf) {
        let qMem = admin
          .from('eventos_inscricoes')
          .select('id, status, created_at, nome_externo, observacoes')
          .eq('ministry_id', ctx.ministryId)
          .eq('evento_id', evento_id)
          .eq('member_id', membroComCpf.id)
          .in('status', statusAtivos);

        if (ignore_inscricao_id) {
          qMem = qMem.neq('id', ignore_inscricao_id);
        }

        const { data: existentePorCpfMembro } = await qMem.maybeSingle();

        if (existentePorCpfMembro) {
          const statusLegivel = formatarStatusLegivel(existentePorCpfMembro.status);
          return NextResponse.json({
            duplicado: true,
            motivo: 'cpf',
            inscricao_existente: {
              id: existentePorCpfMembro.id,
              status: existentePorCpfMembro.status,
              status_legivel: statusLegivel,
              created_at: existentePorCpfMembro.created_at,
            },
            mensagem: `Já existe uma inscrição vinculada ao CPF informado (${membroComCpf.name}) com situação "${statusLegivel}" neste evento.`,
          });
        }
      }

      // 2.b. Buscar em inscrições externas (cpf_normalizado ou observacoes "CPF: ...")
      let qCpf = admin
        .from('eventos_inscricoes')
        .select('id, status, created_at, nome_externo, observacoes')
        .eq('ministry_id', ctx.ministryId)
        .eq('evento_id', evento_id)
        .in('status', statusAtivos)
        .or(`observacoes.ilike.%CPF: ${cpfNormalizado}%,observacoes.ilike.%CPF: ${cpf}%`);

      if (ignore_inscricao_id) {
        qCpf = qCpf.neq('id', ignore_inscricao_id);
      }

      const { data: existentesCpf } = await qCpf;

      if (existentesCpf && existentesCpf.length > 0) {
        const existente = existentesCpf[0];
        const statusLegivel = formatarStatusLegivel(existente.status);
        return NextResponse.json({
          duplicado: true,
          motivo: 'cpf',
          inscricao_existente: {
            id: existente.id,
            status: existente.status,
            status_legivel: statusLegivel,
            created_at: existente.created_at,
          },
          mensagem: `Já existe uma inscrição ativa para este CPF no evento (situação: "${statusLegivel}").`,
        });
      }
    }

    return NextResponse.json({ duplicado: false });
  } catch (err: any) {
    console.error('[POST /api/v1/eventos/inscricao/verificar-duplicidade] Erro interno:', err);
    return NextResponse.json({ error: err?.message || 'Erro interno no servidor.' }, { status: 500 });
  }
}
