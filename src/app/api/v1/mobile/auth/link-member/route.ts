/**
 * POST /api/v1/mobile/auth/link-member
 *
 * Vincula o auth.uid() atual a um registro de membro usando CPF + data_nascimento.
 *
 * Segurança:
 * - Requer Bearer token válido
 * - Nunca aceita member_id no body
 * - Busca por CPF (normalizado) + data_nascimento + status=active
 * - Bloqueia se já vinculado a outro auth_user_id
 * - Não loga CPF completo nos erros
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, createServerClientFromRequest } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

const CPF_DIGITS_RE = /^\d{11}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(request: NextRequest) {
  // ── 1. Verificar autenticação ──────────────────────────────────────
  const rlsClient = createServerClientFromRequest(request);
  const {
    data: { user },
    error: authError,
  } = await rlsClient.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: 'Não autenticado.', code: 'UNAUTHORIZED' },
      { status: 401 },
    );
  }

  // ── 2. Parse e validação do body ───────────────────────────────────
  let rawCpf: string;
  let dataNascimento: string;

  try {
    const body = await request.json();
    rawCpf = String(body.cpf ?? '').replace(/\D/g, '');
    dataNascimento = String(body.data_nascimento ?? '').trim();
  } catch {
    return NextResponse.json({ error: 'Body inválido.' }, { status: 400 });
  }

  if (!CPF_DIGITS_RE.test(rawCpf)) {
    return NextResponse.json({ error: 'CPF inválido.' }, { status: 400 });
  }

  if (!DATE_RE.test(dataNascimento)) {
    return NextResponse.json(
      { error: 'Data de nascimento inválida. Use o formato AAAA-MM-DD.' },
      { status: 400 },
    );
  }

  const admin = createServerClient();

  // ── 3. Verificar se este usuário já está vinculado ─────────────────
  const { data: alreadyLinked } = await admin
    .from('members')
    .select('id, name')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (alreadyLinked) {
    return NextResponse.json(
      {
        error: 'Esta conta já está vinculada a um membro.',
        code: 'ALREADY_LINKED',
        member_id: alreadyLinked.id,
      },
      { status: 409 },
    );
  }

  // ── 4. Buscar membro pelo CPF (normalizado) + data_nascimento ──────
  // O banco pode armazenar CPF formatado ("123.456.789-01") ou sem formatação.
  const cpfFormatted = `${rawCpf.slice(0, 3)}.${rawCpf.slice(3, 6)}.${rawCpf.slice(6, 9)}-${rawCpf.slice(9, 11)}`;

  const { data: candidates, error: searchError } = await admin
    .from('members')
    .select('id, ministry_id, name, auth_user_id, status, congregacao_id')
    .or(`cpf.eq.${rawCpf},cpf.eq.${cpfFormatted}`)
    .eq('data_nascimento', dataNascimento)
    .eq('status', 'active')
    .limit(2); // mais de 1 seria anomalia de dados

  if (searchError) {
    // Logar apenas código do erro, nunca CPF
    console.error('[link-member] search error:', searchError.code);
    return NextResponse.json({ error: 'Erro ao buscar membro.' }, { status: 500 });
  }

  if (!candidates || candidates.length === 0) {
    return NextResponse.json(
      {
        error: 'Membro não encontrado. Verifique o CPF e a data de nascimento informados.',
        code: 'MEMBER_NOT_FOUND',
      },
      { status: 404 },
    );
  }

  const member = candidates[0];

  // ── 5. Verificar se já está vinculado a OUTRO usuário ──────────────
  if (member.auth_user_id && member.auth_user_id !== user.id) {
    return NextResponse.json(
      {
        error: 'Este membro já está vinculado a outra conta.',
        code: 'ALREADY_LINKED_OTHER',
      },
      { status: 409 },
    );
  }

  // ── 6. Vincular auth_user_id ───────────────────────────────────────
  const { error: updateError } = await admin
    .from('members')
    .update({
      auth_user_id: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', member.id);

  if (updateError) {
    console.error('[link-member] update error:', updateError.code);
    return NextResponse.json({ error: 'Erro ao vincular membro.' }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    member_id: member.id,
    name: member.name,
    ministry_id: member.ministry_id,
  });
}
