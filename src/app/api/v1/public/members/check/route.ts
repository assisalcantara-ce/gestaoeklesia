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
    .select('*')
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

  function toDateInputString(val: any): string {
    if (!val) return '';
    const str = String(val).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
      return str.slice(0, 10);
    }
    if (/^\d{2}\/\d{2}\/\d{4}/.test(str)) {
      const [d, m, y] = str.split('/');
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    return '';
  }

  // ── 6. Retorno dos dados permitidos para auto-preenchimento do formulário ──
  if (member) {
    const cf = (member.custom_fields && typeof member.custom_fields === 'object') ? member.custom_fields : {};

    let tipoCadastro = member.tipo_cadastro || member.role || cf.tipoCadastro || 'membro';
    const tipoLower = String(tipoCadastro).toLowerCase().trim();
    if (tipoLower === 'obreiro' || tipoLower === 'ministro') {
      tipoCadastro = 'ministro';
    } else {
      tipoCadastro = 'membro';
    }

    const memberData = {
      tipo_cadastro: tipoCadastro,
      cargo_ministerial: member.cargo_ministerial || cf.cargoMinisterial || cf.cargo_ministerial || '',
      name: member.name || cf.nome || '',
      nome_pai: member.nome_pai || cf.nomePai || cf.nome_pai || '',
      nome_mae: member.nome_mae || cf.nomeMae || cf.nome_mae || '',
      rg: member.rg || cf.rg || '',
      data_batismo_aguas: toDateInputString(member.data_batismo_aguas || cf.dataBatismoAguas || cf.data_batismo_aguas || cf.dataBatismo),
      email: member.email || cf.email || '',
      phone: member.phone || cf.phone || '',
      celular: member.celular || cf.celular || member.phone || '',
      whatsapp: member.whatsapp || cf.whatsapp || member.celular || member.phone || '',
      data_nascimento: toDateInputString(member.data_nascimento || cf.dataNascimento || cf.data_nascimento),
      sexo: (member.sexo || cf.sexo || '').toUpperCase(),
      estado_civil: (member.estado_civil || cf.estadoCivil || cf.estado_civil || '').toUpperCase(),
      nome_conjuge: member.nome_conjuge || cf.nomeConjuge || cf.nome_conjuge || '',
      cpf_conjuge: member.cpf_conjuge || cf.cpfConjuge || cf.cpf_conjuge || '',
      data_nascimento_conjuge: toDateInputString(member.data_nascimento_conjuge || cf.dataNascimentoConjuge || cf.data_nascimento_conjuge),
      profissao: member.profissao || cf.profissao || '',
      cep: member.cep || cf.cep || '',
      logradouro: member.logradouro || cf.logradouro || '',
      numero: member.numero || cf.numero || '',
      bairro: member.bairro || cf.bairro || '',
      complemento: member.complemento || cf.complemento || '',
      cidade: member.cidade || cf.cidade || '',
      estado: member.estado || cf.uf || cf.estado || '',
      escolaridade: member.escolaridade || cf.escolaridade || '',
      nacionalidade: member.nacionalidade || cf.nacionalidade || 'BRASILEIRA',
      naturalidade: member.naturalidade || cf.naturalidade || '',
      uf_naturalidade: member.uf_naturalidade || cf.ufNaturalidade || cf.uf_naturalidade || '',
      foto_url: member.foto_url || cf.fotoUrl || '',
    };

    return NextResponse.json({
      exists: true,
      institution_name: ministry.name,
      data: memberData,
    });
  }

  return NextResponse.json({
    exists: false,
    institution_name: ministry.name,
  });
}
