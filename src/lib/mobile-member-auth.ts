/**
 * Helpers de autenticação para as rotas mobile do GestãoEklesia.
 *
 * Uso: importar `resolveMobileMember` + `mobileMemberErrorResponse`
 * nas API routes do prefixo /api/v1/mobile/*
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient as createSsrClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createServerClient, createServerClientFromRequest } from '@/lib/supabase-server';

export interface MobileMemberContext {
  userId: string;
  memberId: string;
  ministryId: string;
}

/**
 * Resolve o membro autenticado a partir do header Authorization Bearer ou Cookies de Sessão HTTP.
 *
 * 1. Verifica o JWT via Supabase Auth (Bearer Token ou Cookies SSR) → obtém userId
 * 2. Busca o registro em `members` WHERE auth_user_id = userId
 *
 * @throws Error('UNAUTHORIZED')      — token/sessão inválida ou ausente
 * @throws Error('MEMBER_NOT_LINKED') — userId não vinculado a nenhum member
 */
export async function resolveMobileMember(
  request: NextRequest,
): Promise<MobileMemberContext> {
  let authenticatedUser = null;

  // 1. Tentar via Authorization Bearer token
  const authHeader = request.headers.get('Authorization') || request.headers.get('authorization');
  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    const rlsClient = createServerClientFromRequest(request);
    const { data: { user } } = await rlsClient.auth.getUser();
    if (user) {
      authenticatedUser = user;
    }
  }

  // 2. Se não obtiver por Bearer token, tentar via cookies de sessão SSR
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
      console.error('[resolveMobileMember] Erro ao consultar cookies SSR:', cookieErr);
    }
  }

  if (!authenticatedUser) {
    throw new Error('UNAUTHORIZED');
  }

  const user = authenticatedUser;

  // 3. Buscar member vinculado (service_role para ignorar RLS durante o lookup)
  const admin = createServerClient();
  const { data: member, error: memberError } = await admin
    .from('members')
    .select('id, ministry_id')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (memberError || !member) {
    throw new Error('MEMBER_NOT_LINKED');
  }

  return {
    userId: user.id,
    memberId: member.id as string,
    ministryId: member.ministry_id as string,
  };
}

/**
 * Converte erros de autenticação mobile em respostas HTTP padronizadas.
 * Retorna `null` se o erro não for um erro de auth conhecido.
 */
export function mobileMemberErrorResponse(error: unknown): NextResponse | null {
  const msg = error instanceof Error ? error.message : String(error ?? '');

  if (msg === 'UNAUTHORIZED') {
    return NextResponse.json(
      { error: 'Não autenticado.', code: 'UNAUTHORIZED' },
      { status: 401 },
    );
  }

  if (msg === 'MEMBER_NOT_LINKED') {
    return NextResponse.json(
      { error: 'Conta não vinculada a um membro.', code: 'MEMBER_NOT_LINKED' },
      { status: 403 },
    );
  }

  return null;
}

/**
 * Mascara CPF: expõe apenas o grupo do meio.
 * Ex: "12345678901" → "***.456.789-**"
 */
export function maskCpf(cpf: string | null | undefined): string {
  if (!cpf) return '';
  const d = cpf.replace(/\D/g, '');
  if (d.length !== 11) return '***.***.***-**';
  return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`;
}
