/**
 * API ROUTE PÚBLICA: Criar / Atualizar Membro no Cadastro Público
 * POST /api/v1/public/members/save
 *
 * Funcionalidade:
 * - Recebe `institution` (id ou slug do ministério) e o `cpf`.
 * - Valida a existência e o status da instituição.
 * - Valida e limpa o CPF (deve possuir 11 dígitos numéricos).
 * - Se o CPF NÃO EXISTIR no ministério:
 *     - Cria um NOVO membro (`insert`).
 *     - Exige o campo `name`.
 *     - Define os campos default seguros: `tipo_cadastro = 'membro'`, `status = 'active'`.
 * - Se o CPF JÁ EXISTIR no ministério:
 *     - Atualiza APENAS os campos públicos permitidos (`update`).
 *     - IGNORA e NUNCA PERMITE alterar: `name`, `cpf`, `ministry_id`, `id`, `tipo_cadastro`, `status`, `role`, dados ministeriais, notas ou cargos.
 * - Aplica a normalização de textos em caixa alta (uppercase-normalizer) em conformidade com o padrão da aplicação.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { normalizePayloadToUppercase } from '@/lib/uppercase-normalizer';
import { checkRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  // ── 1. Rate Limiter por IP (máximo 15 gravações por minuto) ────────────
  const rateLimit = checkRateLimit(request, 15, 60 * 1000);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: 'Muitas requisições enviadas. Aguarde um momento e tente novamente.',
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

  const { institution, cpf } = body;

  if (!institution || typeof institution !== 'string' || !institution.trim()) {
    return NextResponse.json(
      { error: 'Identificador da instituição é obrigatório.' },
      { status: 400 }
    );
  }

  if (!cpf || typeof cpf !== 'string') {
    return NextResponse.json(
      { error: 'CPF é obrigatório.' },
      { status: 400 }
    );
  }

  const cleanCpf = cpf.replace(/\D/g, '');
  if (cleanCpf.length !== 11) {
    return NextResponse.json(
      { error: 'CPF inválido. Informe um CPF válido com 11 dígitos numéricos.' },
      { status: 400 }
    );
  }

  const admin = createServerClient();

  // ── 3. Resolver a Instituição/Ministério no Servidor ─────────────────────
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(institution.trim());

  let ministryQuery = admin.from('ministries').select('id, name, subscription_plan_id, subscription_plans(name, max_members), is_active');
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

  if (!ministry.is_active) {
    return NextResponse.json(
      { error: 'Cadastro público suspenso para esta instituição.' },
      { status: 403 }
    );
  }

  const ministryId = ministry.id;

  // ── 4. Normalizar os textos da requisição (preservando emails e datas) ──────
  const normalizedBody = normalizePayloadToUppercase(body, {
    preserveKeys: [
      'email',
      'data_nascimento',
      'data_nascimento_conjuge',
    ],
  }) as Record<string, any>;

  // ── 5. Buscar se o membro já existe no ministério ──────────────────────────
  const formattedCpf = `${cleanCpf.slice(0, 3)}.${cleanCpf.slice(3, 6)}.${cleanCpf.slice(6, 9)}-${cleanCpf.slice(9)}`;

  const { data: existingMember } = await admin
    .from('members')
    .select('id, name, cpf')
    .eq('ministry_id', ministryId)
    .or(`cpf.eq.${cleanCpf},cpf.eq.${formattedCpf}`)
    .maybeSingle();

  // ── 6. LÓGICA DE UPDATE (Membro já existente) ──────────────────────────────
  if (existingMember) {
    // Para membro existente, montar o payload contendo EXCLUSIVAMENTE os campos públicos permitidos
    const updatePayload: Record<string, any> = {
      email: typeof normalizedBody.email === 'string' ? normalizedBody.email.toLowerCase() : normalizedBody.email ?? null,
      phone: normalizedBody.phone ?? null,
      celular: normalizedBody.celular ?? null,
      whatsapp: normalizedBody.whatsapp ?? null,
      data_nascimento: normalizedBody.data_nascimento ?? null,
      sexo: normalizedBody.sexo ?? null,
      estado_civil: normalizedBody.estado_civil ?? null,
      nome_conjuge: normalizedBody.nome_conjuge ?? null,
      cpf_conjuge: normalizedBody.cpf_conjuge ?? null,
      data_nascimento_conjuge: normalizedBody.data_nascimento_conjuge ?? null,
      profissao: normalizedBody.profissao ?? null,
      cep: normalizedBody.cep ?? null,
      logradouro: normalizedBody.logradouro ?? null,
      numero: normalizedBody.numero ?? null,
      bairro: normalizedBody.bairro ?? null,
      complemento: normalizedBody.complemento ?? null,
      cidade: normalizedBody.cidade ?? null,
      estado: normalizedBody.estado ?? null,
      escolaridade: normalizedBody.escolaridade ?? null,
      nacionalidade: normalizedBody.nacionalidade ?? null,
      naturalidade: normalizedBody.naturalidade ?? null,
      uf_naturalidade: normalizedBody.uf_naturalidade ?? null,
      updated_at: new Date().toISOString(),
    };

    const { error: updateErr } = await admin
      .from('members')
      .update(updatePayload)
      .eq('id', existingMember.id)
      .eq('ministry_id', ministryId);

    if (updateErr) {
      console.error('[POST /api/v1/public/members/save] Update error:', updateErr);
      return NextResponse.json(
        { error: 'Erro ao atualizar dados cadastrais do membro.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      action: 'updated',
      message: 'Cadastro atualizado com sucesso.',
    });
  }

  // ── 7. LÓGICA DE INSERT (Novo membro) ──────────────────────────────────────
  // Verificar limite do plano da instituição antes de cadastrar novo membro
  const planData = (ministry as any)?.subscription_plans;
  const maxMembers: number = planData?.max_members ?? 0;

  if (maxMembers > 0) {
    const { count: totalMembers } = await admin
      .from('members')
      .select('id', { count: 'exact', head: true })
      .eq('ministry_id', ministryId);

    if ((totalMembers ?? 0) >= maxMembers) {
      return NextResponse.json(
        { error: 'O limite de cadastros desta instituição foi atingido. Entre em contato com a secretaria.' },
        { status: 403 }
      );
    }
  }

  // Nome é obrigatório para novo cadastro
  if (!normalizedBody.name || typeof normalizedBody.name !== 'string' || !normalizedBody.name.trim()) {
    return NextResponse.json(
      { error: 'Nome completo é obrigatório para novos cadastros.' },
      { status: 400 }
    );
  }

  const insertPayload: Record<string, any> = {
    ministry_id: ministryId,
    name: normalizedBody.name.trim(),
    cpf: cleanCpf,
    email: typeof normalizedBody.email === 'string' ? normalizedBody.email.toLowerCase() : normalizedBody.email ?? null,
    phone: normalizedBody.phone ?? null,
    celular: normalizedBody.celular ?? null,
    whatsapp: normalizedBody.whatsapp ?? null,
    data_nascimento: normalizedBody.data_nascimento ?? null,
    sexo: normalizedBody.sexo ?? null,
    estado_civil: normalizedBody.estado_civil ?? null,
    nome_conjuge: normalizedBody.nome_conjuge ?? null,
    cpf_conjuge: normalizedBody.cpf_conjuge ?? null,
    data_nascimento_conjuge: normalizedBody.data_nascimento_conjuge ?? null,
    profissao: normalizedBody.profissao ?? null,
    cep: normalizedBody.cep ?? null,
    logradouro: normalizedBody.logradouro ?? null,
    numero: normalizedBody.numero ?? null,
    bairro: normalizedBody.bairro ?? null,
    complemento: normalizedBody.complemento ?? null,
    cidade: normalizedBody.cidade ?? null,
    estado: normalizedBody.estado ?? null,
    escolaridade: normalizedBody.escolaridade ?? null,
    nacionalidade: normalizedBody.nacionalidade ?? null,
    naturalidade: normalizedBody.naturalidade ?? null,
    uf_naturalidade: normalizedBody.uf_naturalidade ?? null,
    tipo_cadastro: 'membro',
    status: 'active',
    member_since: new Date().toISOString(),
  };

  const { error: insertErr } = await admin
    .from('members')
    .insert([insertPayload]);

  if (insertErr) {
    console.error('[POST /api/v1/public/members/save] Insert error:', insertErr);
    // Tratar erro de duplicidade de unicidade (se porventura 2 submits forem concorrentes)
    if (insertErr.code === '23505' || insertErr.message.includes('unique')) {
      return NextResponse.json(
        { error: 'Este CPF já foi cadastrado nesta instituição.' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: 'Erro ao registrar novo membro.' },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      success: true,
      action: 'created',
      message: 'Cadastro realizado com sucesso.',
    },
    { status: 201 }
  );
}
