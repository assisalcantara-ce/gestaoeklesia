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

  const { institution, congregacao_id, cpf } = body;

  if (!institution || typeof institution !== 'string' || !institution.trim()) {
    return NextResponse.json(
      { error: 'Identificador da instituição é obrigatório.' },
      { status: 400 }
    );
  }

  if (!congregacao_id || typeof congregacao_id !== 'string' || !congregacao_id.trim()) {
    return NextResponse.json(
      { error: 'A seleção da congregação é obrigatória.' },
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

  if (ministry.is_active === false) {
    return NextResponse.json(
      { error: 'Cadastro público suspenso para esta instituição.' },
      { status: 403 }
    );
  }

  const ministryId = ministry.id;

  // ── 4. Validar se a congregação pertence estritamente ao tenant no servidor ──
  const { data: validCong } = await admin
    .from('congregacoes')
    .select('id')
    .eq('id', congregacao_id.trim())
    .eq('ministry_id', ministryId)
    .maybeSingle();

  if (!validCong) {
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

  // ── 5. Normalizar os textos da requisição (preservando emails, datas e foto_url) ──────
  const normalizedBody = normalizePayloadToUppercase(body, {
    preserveKeys: [
      'email',
      'data_nascimento',
      'data_nascimento_conjuge',
      'data_batismo_aguas',
      'foto_url',
    ],
  }) as Record<string, any>;

  // ── 6. Validação dos Campos Obrigatórios ──────────────────────────────────
  if (!normalizedBody.name || typeof normalizedBody.name !== 'string' || !normalizedBody.name.trim()) {
    return NextResponse.json(
      { error: 'Nome completo é obrigatório.' },
      { status: 400 }
    );
  }

  if (!normalizedBody.nome_pai || typeof normalizedBody.nome_pai !== 'string' || !normalizedBody.nome_pai.trim()) {
    return NextResponse.json(
      { error: 'Nome do Pai é obrigatório.' },
      { status: 400 }
    );
  }

  if (!normalizedBody.nome_mae || typeof normalizedBody.nome_mae !== 'string' || !normalizedBody.nome_mae.trim()) {
    return NextResponse.json(
      { error: 'Nome da Mãe é obrigatório.' },
      { status: 400 }
    );
  }

  if (!normalizedBody.data_batismo_aguas || typeof normalizedBody.data_batismo_aguas !== 'string' || !normalizedBody.data_batismo_aguas.trim()) {
    return NextResponse.json(
      { error: 'Data de Batismo é obrigatória.' },
      { status: 400 }
    );
  }

  // ── 7. Buscar se o membro já existe no ministério ──────────────────────────
  const formattedCpf = `${cleanCpf.slice(0, 3)}.${cleanCpf.slice(3, 6)}.${cleanCpf.slice(6, 9)}-${cleanCpf.slice(9)}`;

  const { data: existingMember } = await admin
    .from('members')
    .select('id, name, cpf')
    .eq('ministry_id', ministryId)
    .or(`cpf.eq.${cleanCpf},cpf.eq.${formattedCpf}`)
    .maybeSingle();

  // Helper para sanitizar valores: converte string vazia em null
  const cleanVal = (val: any) => {
    if (val === undefined || val === null) return null;
    if (typeof val === 'string' && val.trim() === '') return null;
    return val;
  };

  // ── 8. LÓGICA DE UPDATE (Membro já existente) ──────────────────────────────
  if (existingMember) {
    const updatePayload: Record<string, any> = {
      congregacao_id: congregacao_id.trim(),
      nome_pai: normalizedBody.nome_pai.trim(),
      nome_mae: normalizedBody.nome_mae.trim(),
      rg: cleanVal(normalizedBody.rg),
      data_batismo_aguas: cleanVal(normalizedBody.data_batismo_aguas),
      email: typeof normalizedBody.email === 'string' && normalizedBody.email.trim() ? normalizedBody.email.toLowerCase().trim() : null,
      phone: cleanVal(normalizedBody.phone),
      celular: cleanVal(normalizedBody.celular),
      whatsapp: cleanVal(normalizedBody.whatsapp),
      data_nascimento: cleanVal(normalizedBody.data_nascimento),
      sexo: cleanVal(normalizedBody.sexo),
      estado_civil: cleanVal(normalizedBody.estado_civil),
      nome_conjuge: cleanVal(normalizedBody.nome_conjuge),
      cpf_conjuge: cleanVal(normalizedBody.cpf_conjuge),
      data_nascimento_conjuge: cleanVal(normalizedBody.data_nascimento_conjuge),
      profissao: cleanVal(normalizedBody.profissao),
      cep: cleanVal(normalizedBody.cep),
      logradouro: cleanVal(normalizedBody.logradouro),
      numero: cleanVal(normalizedBody.numero),
      bairro: cleanVal(normalizedBody.bairro),
      complemento: cleanVal(normalizedBody.complemento),
      cidade: cleanVal(normalizedBody.cidade),
      estado: cleanVal(normalizedBody.estado),
      escolaridade: cleanVal(normalizedBody.escolaridade),
      nacionalidade: cleanVal(normalizedBody.nacionalidade),
      naturalidade: cleanVal(normalizedBody.naturalidade),
      uf_naturalidade: cleanVal(normalizedBody.uf_naturalidade),
      ...(normalizedBody.foto_url ? { foto_url: cleanVal(normalizedBody.foto_url) } : {}),
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
        { error: updateErr.message || 'Erro ao atualizar dados cadastrais do membro.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      action: 'updated',
      message: 'Cadastro atualizado com sucesso.',
    });
  }

  // ── 9. LÓGICA DE INSERT (Novo membro) ──────────────────────────────────────
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

  const insertPayload: Record<string, any> = {
    ministry_id: ministryId,
    congregacao_id: congregacao_id.trim(),
    name: normalizedBody.name.trim(),
    cpf: cleanCpf,
    nome_pai: normalizedBody.nome_pai.trim(),
    nome_mae: normalizedBody.nome_mae.trim(),
    rg: cleanVal(normalizedBody.rg),
    data_batismo_aguas: cleanVal(normalizedBody.data_batismo_aguas),
    email: typeof normalizedBody.email === 'string' && normalizedBody.email.trim() ? normalizedBody.email.toLowerCase().trim() : null,
    phone: cleanVal(normalizedBody.phone),
    celular: cleanVal(normalizedBody.celular),
    whatsapp: cleanVal(normalizedBody.whatsapp),
    data_nascimento: cleanVal(normalizedBody.data_nascimento),
    sexo: cleanVal(normalizedBody.sexo),
    estado_civil: cleanVal(normalizedBody.estado_civil),
    nome_conjuge: cleanVal(normalizedBody.nome_conjuge),
    cpf_conjuge: cleanVal(normalizedBody.cpf_conjuge),
    data_nascimento_conjuge: cleanVal(normalizedBody.data_nascimento_conjuge),
    profissao: cleanVal(normalizedBody.profissao),
    cep: cleanVal(normalizedBody.cep),
    logradouro: cleanVal(normalizedBody.logradouro),
    numero: cleanVal(normalizedBody.numero),
    bairro: cleanVal(normalizedBody.bairro),
    complemento: cleanVal(normalizedBody.complemento),
    cidade: cleanVal(normalizedBody.cidade),
    estado: cleanVal(normalizedBody.estado),
    escolaridade: cleanVal(normalizedBody.escolaridade),
    nacionalidade: cleanVal(normalizedBody.nacionalidade),
    naturalidade: cleanVal(normalizedBody.naturalidade),
    uf_naturalidade: cleanVal(normalizedBody.uf_naturalidade),
    foto_url: cleanVal(normalizedBody.foto_url),
    tipo_cadastro: 'membro',
    status: 'active',
    member_since: new Date().toISOString().split('T')[0],
  };

  const { error: insertErr } = await admin
    .from('members')
    .insert([insertPayload]);

  if (insertErr) {
    console.error('[POST /api/v1/public/members/save] Insert error:', insertErr);
    if (insertErr.code === '23505' || insertErr.message.includes('unique')) {
      return NextResponse.json(
        { error: 'Este CPF já foi cadastrado nesta instituição.' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: insertErr.message || 'Erro ao registrar novo membro.' },
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
