/**
 * POST /api/v1/mobile/auth/link-member
 *
 * Vincula o auth.uid() atual a um registro de membro usando CPF + data_nascimento.
 *
 * Segurança:
 * - Autenticação dupla: suporta Bearer token E cookies de sessão HTTP (@supabase/ssr)
 * - Nunca aceita member_id no body
 * - Busca por CPF (normalizado) + data_nascimento (data civil determinística) + status=active
 * - Suporta múltiplos registros multi-tenant selecionando o registro elegível (unlinked)
 * - Bloqueia se já vinculado a outro auth_user_id
 * - Não loga CPF completo ou tokens nos erros
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient as createSsrClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createServerClient as createAdminClient, createServerClientFromRequest } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

const CPF_DIGITS_RE = /^\d{11}$/;
const DATE_ISO_RE = /^\d{4}-\d{2}-\d{2}$/;
const DATE_BR_RE = /^\d{2}\/\d{2}\/\d{4}$/;

export async function POST(request: NextRequest) {
  // ── 1. Verificar autenticação (Bearer Token ou Cookies SSR) ─────────
  let authenticatedUser = null;

  // 1.1 Tentar obter usuário via Bearer token
  const authHeader = request.headers.get('Authorization') || request.headers.get('authorization');
  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    const rlsClient = createServerClientFromRequest(request);
    const { data: { user } } = await rlsClient.auth.getUser();
    if (user) {
      authenticatedUser = user;
    }
  }

  // 1.2 Se não obtiver por Bearer token, tentar via cookies SSR
  if (!authenticatedUser) {
    try {
      const cookieStore = await cookies();
      const ssrClient = createSsrClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || '',
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
        {
          cookies: {
            getAll() {
              return cookieStore.getAll();
            },
            setAll() {},
          },
        }
      );
      const { data: { user } } = await ssrClient.auth.getUser();
      if (user) {
        authenticatedUser = user;
      }
    } catch (cookieErr) {
      console.error('[link-member] Erro ao consultar cookies SSR:', cookieErr);
    }
  }

  if (!authenticatedUser) {
    return NextResponse.json(
      { error: 'Sessão expirada ou não autenticado. Faça login novamente.', code: 'UNAUTHORIZED' },
      { status: 401 },
    );
  }

  const user = authenticatedUser;

  // ── 2. Parse e normalização do body ────────────────────────────────
  let rawCpf: string;
  let normalizedDate: string;

  try {
    const body = await request.json();
    rawCpf = String(body.cpf ?? '').replace(/\D/g, '');
    const rawDate = String(body.data_nascimento ?? '').trim();

    // Normalização de data civil (YYYY-MM-DD ou DD/MM/YYYY) sem timezone shift
    if (DATE_ISO_RE.test(rawDate)) {
      normalizedDate = rawDate;
    } else if (DATE_BR_RE.test(rawDate)) {
      const [dia, mes, ano] = rawDate.split('/');
      normalizedDate = `${ano}-${mes}-${dia}`;
    } else {
      normalizedDate = rawDate;
    }
  } catch {
    return NextResponse.json({ error: 'Body inválido.', code: 'INVALID_BODY' }, { status: 400 });
  }

  if (!CPF_DIGITS_RE.test(rawCpf)) {
    return NextResponse.json({ error: 'CPF inválido.', code: 'INVALID_CPF' }, { status: 400 });
  }

  if (!DATE_ISO_RE.test(normalizedDate)) {
    return NextResponse.json(
      { error: 'Data de nascimento inválida. Use o formato DD/MM/AAAA.', code: 'INVALID_DATE' },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  // ── 3. Verificar se este usuário já está vinculado ─────────────────
  const { data: alreadyLinked } = await admin
    .from('members')
    .select('id, name, ministry_id')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (alreadyLinked) {
    return NextResponse.json(
      {
        error: 'Esta conta já está vinculada a um membro.',
        code: 'ALREADY_LINKED',
        member_id: alreadyLinked.id,
        ministry_id: alreadyLinked.ministry_id,
      },
      { status: 409 },
    );
  }

  // ── 4. Buscar membros pelo CPF (normalizado) + data_nascimento ──────
  const cpfFormatted = `${rawCpf.slice(0, 3)}.${rawCpf.slice(3, 6)}.${rawCpf.slice(6, 9)}-${rawCpf.slice(9, 11)}`;

  const { data: candidates, error: searchError } = await admin
    .from('members')
    .select('id, ministry_id, name, auth_user_id, status, congregacao_id')
    .or(`cpf.eq.${rawCpf},cpf.eq.${cpfFormatted}`)
    .eq('data_nascimento', normalizedDate)
    .eq('status', 'active');

  if (searchError) {
    console.error('[link-member] search error code:', searchError.code);
    return NextResponse.json({ error: 'Erro ao buscar membro.', code: 'DB_ERROR' }, { status: 500 });
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

  // Se algum dos candidatos já pertencer a este user.id
  const existingSelfLink = candidates.find((c) => c.auth_user_id === user.id);
  if (existingSelfLink) {
    return NextResponse.json({
      success: true,
      member_id: existingSelfLink.id,
      name: existingSelfLink.name,
      ministry_id: existingSelfLink.ministry_id,
      already_linked: true,
    });
  }

  // Priorizar candidato elegível que ainda não possua auth_user_id
  const unlinkedMember = candidates.find((c) => !c.auth_user_id);

  if (!unlinkedMember) {
    return NextResponse.json(
      {
        error: 'Este membro já está vinculado a outra conta.',
        code: 'ALREADY_LINKED_OTHER',
      },
      { status: 409 },
    );
  }

  // ── 5. Vincular auth_user_id ao membro elegível ────────────────────
  const { error: updateError } = await admin
    .from('members')
    .update({
      auth_user_id: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', unlinkedMember.id);

  if (updateError) {
    console.error('[link-member] update error code:', updateError.code);
    return NextResponse.json({ error: 'Erro ao vincular membro.', code: 'UPDATE_ERROR' }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    member_id: unlinkedMember.id,
    name: unlinkedMember.name,
    ministry_id: unlinkedMember.ministry_id,
  });
}
