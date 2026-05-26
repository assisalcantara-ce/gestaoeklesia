/**
 * Helpers de autenticação para as rotas mobile do GestãoEklesia.
 *
 * Uso: importar `resolveMobileMember` + `mobileMemberErrorResponse`
 * nas API routes do prefixo /api/v1/mobile/*
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, createServerClientFromRequest } from '@/lib/supabase-server';

export interface MobileMemberContext {
  userId: string;
  memberId: string;
  ministryId: string;
}

/**
 * Resolve o membro autenticado a partir do header Authorization Bearer.
 *
 * 1. Verifica o JWT via Supabase Auth → obtém userId
 * 2. Busca o registro em `members` WHERE auth_user_id = userId
 *
 * @throws Error('UNAUTHORIZED')      — token inválido ou ausente
 * @throws Error('MEMBER_NOT_LINKED') — userId não vinculado a nenhum member
 */
export async function resolveMobileMember(
  request: NextRequest,
): Promise<MobileMemberContext> {
  // 1. Verificar JWT via anon key + Bearer token
  const rlsClient = createServerClientFromRequest(request);
  const {
    data: { user },
    error: authError,
  } = await rlsClient.auth.getUser();

  if (authError || !user) {
    throw new Error('UNAUTHORIZED');
  }

  // 2. Buscar member vinculado (service_role para ignorar RLS durante o lookup)
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
