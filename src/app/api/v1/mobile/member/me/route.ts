/**
 * GET  /api/v1/mobile/member/me   — dados do membro autenticado
 * PUT  /api/v1/mobile/member/me   — atualização de campos permitidos
 *
 * Segurança:
 * - Requer Bearer token de membro vinculado
 * - CPF é retornado mascarado
 * - PUT aceita somente campos da whitelist (nunca cpf, status, cargo, etc.)
 * - Nunca aceita member_id do body
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import {
  resolveMobileMember,
  mobileMemberErrorResponse,
  maskCpf,
} from '@/lib/mobile-member-auth';

export const dynamic = 'force-dynamic';

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const ctx = await resolveMobileMember(request);
    const admin = createServerClient();

    const { data: member, error } = await admin
      .from('members')
      .select(
        `id, name, email, phone, celular, whatsapp, cpf,
         foto_url, matricula, unique_id, status, tipo_cadastro,
         cargo_ministerial, congregacao_id, ministry_id,
         cep, logradouro, numero, bairro, complemento, cidade, estado`,
      )
      .eq('id', ctx.memberId)
      .maybeSingle();

    if (error || !member) {
      return NextResponse.json({ error: 'Membro não encontrado.' }, { status: 404 });
    }

    // Join congregação
    let congregacao_nome: string | null = null;
    if (member.congregacao_id) {
      const { data: cong } = await admin
        .from('congregacoes')
        .select('nome')
        .eq('id', member.congregacao_id as string)
        .maybeSingle();
      congregacao_nome = (cong as any)?.nome ?? null;
    }

    // Join ministério
    const { data: ministerio } = await admin
      .from('ministries')
      .select('name, logo_url')
      .eq('id', member.ministry_id as string)
      .maybeSingle();

    return NextResponse.json({
      id: member.id,
      name: member.name,
      email: member.email,
      phone: member.phone,
      celular: member.celular,
      whatsapp: member.whatsapp,
      cpf: maskCpf(member.cpf as string | null),
      foto_url: member.foto_url,
      matricula: member.matricula,
      unique_id: member.unique_id,
      status: member.status,
      tipo_cadastro: member.tipo_cadastro,
      cargo_ministerial: member.cargo_ministerial,
      congregacao_nome,
      ministerio_nome: (ministerio as any)?.name ?? null,
      ministerio_logo: (ministerio as any)?.logo_url ?? null,
      endereco: {
        cep: member.cep,
        logradouro: member.logradouro,
        numero: member.numero,
        bairro: member.bairro,
        complemento: member.complemento,
        cidade: member.cidade,
        estado: member.estado,
      },
    });
  } catch (err) {
    const errRes = mobileMemberErrorResponse(err);
    if (errRes) return errRes;
    console.error('[mobile/member/me GET]', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}

// ─── PUT ─────────────────────────────────────────────────────────────────────

/**
 * Campos que o membro pode atualizar via mobile.
 * Nunca incluir: cpf, data_nascimento, matricula, status, cargo_ministerial,
 * tipo_cadastro, congregacao_id, ministry_id, auth_user_id.
 */
const ALLOWED_UPDATE_FIELDS = new Set([
  'email',
  'phone',
  'celular',
  'whatsapp',
  'foto_url',
  'cep',
  'logradouro',
  'numero',
  'bairro',
  'complemento',
  'cidade',
  'estado',
]);

export async function PUT(request: NextRequest) {
  try {
    const ctx = await resolveMobileMember(request);

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Body inválido.' }, { status: 400 });
    }

    // Filtrar somente campos permitidos
    const patch: Record<string, unknown> = {};
    for (const key of ALLOWED_UPDATE_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(body, key)) {
        const val = body[key];
        patch[key] = typeof val === 'string' ? val.trim() || null : val ?? null;
      }
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json(
        { error: 'Nenhum campo permitido para atualização foi fornecido.' },
        { status: 400 },
      );
    }

    // Email sempre em lowercase
    if (patch.email && typeof patch.email === 'string') {
      patch.email = patch.email.toLowerCase();
    }

    patch.updated_at = new Date().toISOString();

    const admin = createServerClient();
    const { error } = await admin
      .from('members')
      .update(patch)
      .eq('id', ctx.memberId);

    if (error) {
      console.error('[mobile/member/me PUT]', error.code);
      return NextResponse.json({ error: 'Erro ao atualizar dados.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const errRes = mobileMemberErrorResponse(err);
    if (errRes) return errRes;
    console.error('[mobile/member/me PUT]', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
