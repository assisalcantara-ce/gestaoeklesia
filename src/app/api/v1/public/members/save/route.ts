/**
 * API ROUTE PÚBLICA: Solicitação de Cadastro / Atualização de Membro no Link Público
 * POST /api/v1/public/members/save
 *
 * Funcionalidade Segura (Lote 2 - Fundação de Pré-cadastro):
 * - Recebe `institution` (id ou slug do ministério), `congregacao_id` e o `cpf`.
 * - Valida a existência e o status da instituição.
 * - Valida e limpa o CPF (deve possuir 11 dígitos numéricos).
 * - Valida campos obrigatórios (`name`, `nome_pai`, `nome_mae`).
 * - Valida e resolve `congregacao_id` e `campo_id` no servidor garantindo pertencimento ao mesmo ministério.
 * - Proteção de Integridade:
 *     - NUNCA grava diretamente na tabela `members`.
 *     - NUNCA aloca matrícula oficial de membro antecipadamente.
 *     - NUNCA ativa carteirinha de membro de forma automática.
 * - Se o CPF NÃO EXISTIR no ministério:
 *     - Grava solicitação em `member_pre_registrations` com `tipo_solicitacao = 'novo_cadastro'` e `status = 'pendente'`.
 *     - Se já houver um pré-cadastro 'pendente' com este CPF, atualiza a solicitação pendente existente.
 * - Se o CPF JÁ PERTENCER a um membro oficial da instituição:
 *     - NUNCA sobrescreve a ficha oficial em `members`.
 *     - Grava solicitação em `member_pre_registrations` com `tipo_solicitacao = 'atualizacao'`, `existing_member_id` vinculado e `status = 'pendente'`.
 * - Aplica a normalização de textos em caixa alta (uppercase-normalizer).
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

  // ── 4. Validar e resolver Congregação e Grupo/Campo pertencentes ao tenant no servidor ──
  let congregacaoNome: string = '';
  let campoIdFinal: string | null = null;
  let campoNomeFinal: string | null = null;

  const { data: validCong } = await admin
    .from('congregacoes')
    .select('id, nome, campo_id')
    .eq('id', congregacao_id.trim())
    .eq('ministry_id', ministryId)
    .maybeSingle();

  if (validCong) {
    congregacaoNome = validCong.nome ? validCong.nome.trim() : '';
    campoIdFinal = validCong.campo_id || null;
  } else {
    const { data: validSup } = await admin
      .from('supervisoes')
      .select('id, nome')
      .eq('id', congregacao_id.trim())
      .eq('ministry_id', ministryId)
      .maybeSingle();

    if (!validSup) {
      return NextResponse.json(
        { error: 'Congregação inválida para esta instituição.' },
        { status: 400 }
      );
    }
    congregacaoNome = validSup.nome ? validSup.nome.trim() : '';
  }

  // Se a requisição enviou campo_id explícito compatível com o tenant, validar no servidor
  if (body.campo_id && typeof body.campo_id === 'string' && body.campo_id.trim()) {
    const { data: validCampo } = await admin
      .from('campos')
      .select('id, nome')
      .eq('id', body.campo_id.trim())
      .eq('ministry_id', ministryId)
      .maybeSingle();

    if (validCampo) {
      campoIdFinal = validCampo.id;
      campoNomeFinal = validCampo.nome ? validCampo.nome.trim() : null;
    }
  }

  // Se campo_id foi resolvido via congregação mas ainda não temos o nome do campo
  if (campoIdFinal && !campoNomeFinal) {
    const { data: campoRow } = await admin
      .from('campos')
      .select('id, nome')
      .eq('id', campoIdFinal)
      .eq('ministry_id', ministryId)
      .maybeSingle();

    if (campoRow && campoRow.nome) {
      campoNomeFinal = campoRow.nome.trim();
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

  // Helper para sanitizar valores: converte string vazia em null
  const cleanVal = (val: any) => {
    if (val === undefined || val === null) return null;
    if (typeof val === 'string' && val.trim() === '') return null;
    return val;
  };

  // ── 7. Determinar se já é membro oficial ou se é novo solicitante ────────
  const formattedCpf = `${cleanCpf.slice(0, 3)}.${cleanCpf.slice(3, 6)}.${cleanCpf.slice(6, 9)}-${cleanCpf.slice(9)}`;

  const { data: existingMember } = await admin
    .from('members')
    .select('id, name, cpf, status, matricula')
    .eq('ministry_id', ministryId)
    .or(`cpf.eq.${cleanCpf},cpf.eq.${formattedCpf}`)
    .maybeSingle();

  // Determinar classificação e cargo sugeridos
  const rawTipo = typeof body.tipo_cadastro === 'string' ? body.tipo_cadastro.toLowerCase().trim() : 'membro';
  const tipoCadastro = rawTipo === 'ministro' ? 'ministro' : 'membro';
  const cargoMinisterial = tipoCadastro === 'ministro' && typeof body.cargo_ministerial === 'string' && body.cargo_ministerial.trim()
    ? body.cargo_ministerial.toUpperCase().trim()
    : null;

  // Metadados adicionais para auditoria da secretaria
  const dadosAdicionais = {
    congregacao_nome: congregacaoNome || null,
    campo_nome: campoNomeFinal || null,
    raw_submissao: {
      origem_ip: request.headers.get('x-forwarded-for') || null,
      submitted_at: new Date().toISOString(),
    },
  };

  // Objeto base dos dados do pré-cadastro
  const basePreRegData: Record<string, any> = {
    ministry_id: ministryId,
    name: normalizedBody.name.trim(),
    cpf: cleanCpf,
    rg: cleanVal(normalizedBody.rg),
    orgao_emissor: cleanVal(normalizedBody.orgao_emissor),
    data_nascimento: cleanVal(normalizedBody.data_nascimento),
    sexo: cleanVal(normalizedBody.sexo),
    tipo_sanguineo: cleanVal(normalizedBody.tipo_sanguineo),
    escolaridade: cleanVal(normalizedBody.escolaridade),
    estado_civil: cleanVal(normalizedBody.estado_civil),
    nome_pai: normalizedBody.nome_pai.trim(),
    nome_mae: normalizedBody.nome_mae.trim(),
    nome_conjuge: cleanVal(normalizedBody.nome_conjuge),
    cpf_conjuge: cleanVal(normalizedBody.cpf_conjuge),
    data_nascimento_conjuge: cleanVal(normalizedBody.data_nascimento_conjuge),
    nacionalidade: cleanVal(normalizedBody.nacionalidade),
    naturalidade: cleanVal(normalizedBody.naturalidade),
    uf_naturalidade: cleanVal(normalizedBody.uf_naturalidade),
    tipo_cadastro: tipoCadastro,
    cargo_ministerial: cargoMinisterial,
    data_batismo_aguas: cleanVal(normalizedBody.data_batismo_aguas),
    congregacao_id: congregacao_id.trim(),
    campo_id: campoIdFinal,
    cep: cleanVal(normalizedBody.cep),
    logradouro: cleanVal(normalizedBody.logradouro),
    numero: cleanVal(normalizedBody.numero),
    bairro: cleanVal(normalizedBody.bairro),
    complemento: cleanVal(normalizedBody.complemento),
    cidade: cleanVal(normalizedBody.cidade),
    estado: cleanVal(normalizedBody.estado),
    email: typeof normalizedBody.email === 'string' && normalizedBody.email.trim() ? normalizedBody.email.toLowerCase().trim() : null,
    phone: cleanVal(normalizedBody.phone),
    celular: cleanVal(normalizedBody.celular),
    whatsapp: cleanVal(normalizedBody.whatsapp),
    profissao: cleanVal(normalizedBody.profissao),
    foto_url: cleanVal(normalizedBody.foto_url),
    origem: 'link_publico',
    status: 'pendente',
    dados_adicionais: dadosAdicionais,
    updated_at: new Date().toISOString(),
  };

  // ── 8. CASO 1: O CPF já pertence a um membro oficial existente ───────────
  if (existingMember) {
    // Verificar se já existe uma solicitação pendente de atualização para este membro
    const { data: pendingReview } = await admin
      .from('member_pre_registrations')
      .select('id')
      .eq('ministry_id', ministryId)
      .eq('existing_member_id', existingMember.id)
      .eq('status', 'pendente')
      .maybeSingle();

    if (pendingReview) {
      const { error: updErr } = await admin
        .from('member_pre_registrations')
        .update({
          ...basePreRegData,
          tipo_solicitacao: 'atualizacao',
          existing_member_id: existingMember.id,
        })
        .eq('id', pendingReview.id);

      if (updErr) {
        console.error('[POST /api/v1/public/members/save] Update pending review error:', updErr);
        return NextResponse.json(
          { error: 'Erro ao atualizar solicitação de revisão cadastral.' },
          { status: 500 }
        );
      }
    } else {
      const { error: insErr } = await admin
        .from('member_pre_registrations')
        .insert([{
          ...basePreRegData,
          tipo_solicitacao: 'atualizacao',
          existing_member_id: existingMember.id,
        }]);

      if (insErr) {
        console.error('[POST /api/v1/public/members/save] Insert review request error:', insErr);
        return NextResponse.json(
          { error: 'Erro ao registrar solicitação de atualização cadastral.' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      action: 'updated',
      message: 'Solicitação de atualização enviada para análise da secretaria.',
    });
  }

  // ── 9. CASO 2: Novo membro (Pré-cadastro) ─────────────────────────────────
  // Verificar se já existe pré-cadastro pendente para este CPF
  const { data: pendingPreReg } = await admin
    .from('member_pre_registrations')
    .select('id')
    .eq('ministry_id', ministryId)
    .eq('cpf', cleanCpf)
    .eq('status', 'pendente')
    .maybeSingle();

  if (pendingPreReg) {
    const { error: updPendingErr } = await admin
      .from('member_pre_registrations')
      .update({
        ...basePreRegData,
        tipo_solicitacao: 'novo_cadastro',
        existing_member_id: null,
      })
      .eq('id', pendingPreReg.id);

    if (updPendingErr) {
      console.error('[POST /api/v1/public/members/save] Update pending pre-reg error:', updPendingErr);
      return NextResponse.json(
        { error: 'Erro ao atualizar solicitação de pré-cadastro.' },
        { status: 500 }
      );
    }
  } else {
    const { error: insPreRegErr } = await admin
      .from('member_pre_registrations')
      .insert([{
        ...basePreRegData,
        tipo_solicitacao: 'novo_cadastro',
        existing_member_id: null,
      }]);

    if (insPreRegErr) {
      console.error('[POST /api/v1/public/members/save] Insert pre-registration error:', insPreRegErr);
      return NextResponse.json(
        { error: 'Erro ao registrar pré-cadastro de membro.' },
        { status: 500 }
      );
    }
  }

  return NextResponse.json(
    {
      success: true,
      action: 'created',
      message: 'Pré-cadastro realizado com sucesso! Aguarde a homologação da secretaria.',
    },
    { status: 201 }
  );
}
