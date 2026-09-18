/**
 * API ROUTE PÚBLICA: Consultar Membro por CPF no Cadastro Público
 * POST /api/v1/public/members/check
 *
 * Funcionalidade:
 * - Recebe o identificador da instituição (`institution` = id ou slug do ministério) e o `cpf`.
 * - Aplica Rate Limit por IP para prevenir ataques de enumeração massiva.
 * - Busca a instituição pelo slug ou id no banco (utilizando client admin/server-side).
 * - Normaliza o CPF e busca um membro existente exclusivamente dentro daquele `ministry_id`.
 * - Retorna apenas:
 *     - { exists: false } se não for encontrado; ou
 *     - { exists: true, data: { ...campos_permitidos... } } se for encontrado.
 * - NUNCA expõe o `ministry_id`, dados ministeriais, notas, cargos ou histórico contábil.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { checkRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  // ── 1. Rate Limiter por IP (máximo 10 verificações por minuto) ─────────────
  const rateLimit = checkRateLimit(request, 10, 60 * 1000);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: 'Muitas tentativas de consulta. Aguarde alguns instantes e tente novamente.',
        retryAfterSeconds: rateLimit.retryAfterSeconds,
      },
      {
        status: 429,
        headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) },
      }
    );
  }

  // ── 2. Leitura do body ───────────────────────────────────────────────────
  let body: Record<string, any>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Body inválido. Envie um JSON bem formado.' },
      { status: 400 }
    );
  }

  const { institution, congregacao_id, cpf } = body;

  if (!institution || typeof institution !== 'string' || !institution.trim()) {
    return NextResponse.json(
      { error: 'Identificador da instituição não informado.' },
      { status: 400 }
    );
  }

  if (!congregacao_id || typeof congregacao_id !== 'string' || !congregacao_id.trim()) {
    return NextResponse.json(
      { error: 'Congregação é obrigatória para verificação.' },
      { status: 400 }
    );
  }

  if (!cpf || typeof cpf !== 'string') {
    return NextResponse.json(
      { error: 'CPF é obrigatório para consulta.' },
      { status: 400 }
    );
  }

  // Normalizar CPF (remover caracteres não numéricos)
  const cleanCpf = cpf.replace(/\D/g, '');
  if (cleanCpf.length !== 11) {
    return NextResponse.json(
      { error: 'CPF inválido. Informe um CPF com 11 dígitos numéricos.' },
      { status: 400 }
    );
  }

  const admin = createServerClient();

  // ── 3. Resolver o Ministério/Instituição (por ID UUID ou por Slug) ─────────
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(institution.trim());

  let ministryQuery = admin.from('ministries').select('id, name, is_active');
  if (isUuid) {
    ministryQuery = ministryQuery.eq('id', institution.trim());
  } else {
    ministryQuery = ministryQuery.eq('slug', institution.trim().toLowerCase());
  }

  const { data: ministry, error: minErr } = await ministryQuery.maybeSingle();

  if (minErr || !ministry) {
    return NextResponse.json(
      { error: 'Instituição não encontrada.' },
      { status: 404 }
    );
  }

  if (ministry.is_active === false) {
    return NextResponse.json(
      { error: 'Cadastro indisponível para esta instituição.' },
      { status: 403 }
    );
  }

  const ministryId = ministry.id;

  // ── 4. Validar se a congregação pertence estritamente ao tenant ────────────
  const { data: validCong } = await admin
    .from('congregacoes')
    .select('id')
    .eq('id', congregacao_id.trim())
    .eq('ministry_id', ministryId)
    .maybeSingle();

  if (!validCong) {
    // Fallback: verificar se é uma supervisão cadastrada como unidade
    const { data: validSup } = await admin
      .from('supervisoes')
      .select('id')
      .eq('id', congregacao_id.trim())
      .eq('ministry_id', ministryId)
      .maybeSingle();

    if (!validSup) {
      return NextResponse.json(
        { error: 'Congregação inválida para esta instituição.' },
        { status: 400 }
      );
    }
  }

  // ── 5. Buscar se membro existe dentro do ministry_id pelo CPF ──────────────
  const formattedCpf = `${cleanCpf.slice(0, 3)}.${cleanCpf.slice(3, 6)}.${cleanCpf.slice(6, 9)}-${cleanCpf.slice(9)}`;

  const { data: member, error: memErr } = await admin
    .from('members')
    .select('id')
    .eq('ministry_id', ministryId)
    .or(`cpf.eq.${cleanCpf},cpf.eq.${formattedCpf}`)
    .maybeSingle();

  if (memErr) {
    console.error('[POST /api/v1/public/members/check] Error fetching member:', memErr);
    return NextResponse.json(
      { error: 'Erro ao consultar o cadastro do membro.' },
      { status: 500 }
    );
  }

  // ── 6. Retorno estrito de segurança (sem expor quaisquer dados cadastrais) ──
  return NextResponse.json({
    exists: !!member,
    institution_name: ministry.name,
  });
}
