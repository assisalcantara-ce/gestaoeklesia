/**
 * API ROUTE: Detalhe e Edição de Pré-Cadastro de Membro (Secretaria)
 * GET   /api/v1/secretaria/pre-cadastros/[id]
 * PATCH /api/v1/secretaria/pre-cadastros/[id]
 */

import { NextRequest, NextResponse } from 'next/server';
import { resolveTenantAuth } from '@/lib/tenant-auth';
import { temAcesso, temAcessoEscrita } from '@/lib/access-control';
import { authTenantErrorResponse } from '@/lib/api-errors';
import { normalizePayloadToUppercase } from '@/lib/uppercase-normalizer';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const context = await resolveTenantAuth(request);
    const { ministryId, admin, nivel } = context;

    if (!ministryId) {
      return NextResponse.json({ error: 'Usuário sem ministério associado' }, { status: 403 });
    }

    if (!temAcesso(nivel as any, 'secretaria')) {
      return NextResponse.json({ error: 'Acesso não autorizado.' }, { status: 403 });
    }

    const { data: record, error } = await admin
      .from('member_pre_registrations')
      .select('*, congregacoes(id, nome), campos(id, nome)')
      .eq('id', id)
      .eq('ministry_id', ministryId)
      .maybeSingle();

    if (error || !record) {
      return NextResponse.json({ error: 'Pré-cadastro não encontrado.' }, { status: 404 });
    }

    // Buscar se há membro oficial correspondente por CPF
    const { data: existingMember } = await admin
      .from('members')
      .select('id, name, cpf, matricula, status, tipo_cadastro, congregacao_id, custom_fields')
      .eq('ministry_id', ministryId)
      .eq('cpf', record.cpf)
      .maybeSingle();

    return NextResponse.json({
      preCadastro: {
        ...record,
        existingMemberMatch: existingMember || null,
        isDuplicidadeDetectada: Boolean(existingMember && record.tipo_solicitacao === 'novo_cadastro'),
      },
    });
  } catch (err: any) {
    const authResp = authTenantErrorResponse(err);
    if (authResp) return authResp;
    console.error('[GET /api/v1/secretaria/pre-cadastros/[id]] Exceção:', err);
    return NextResponse.json({ error: 'Erro interno ao obter pré-cadastro.' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const context = await resolveTenantAuth(request);
    const { ministryId, admin, nivel } = context;

    if (!ministryId) {
      return NextResponse.json({ error: 'Usuário sem ministério associado' }, { status: 403 });
    }

    if (!temAcessoEscrita(nivel as any, 'secretaria')) {
      return NextResponse.json({ error: 'Permissão de escrita necessária.' }, { status: 403 });
    }

    // Verificar existência do registro e status
    const { data: current, error: curErr } = await admin
      .from('member_pre_registrations')
      .select('id, status, ministry_id')
      .eq('id', id)
      .eq('ministry_id', ministryId)
      .maybeSingle();

    if (curErr || !current) {
      return NextResponse.json({ error: 'Pré-cadastro não encontrado.' }, { status: 404 });
    }

    if (current.status === 'aprovado') {
      return NextResponse.json(
        { error: 'Não é possível editar uma solicitação que já foi aprovada.' },
        { status: 400 }
      );
    }

    let body: Record<string, any>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
    }

    // Normalizar textos para caixa alta
    const normalized = normalizePayloadToUppercase(body, {
      preserveKeys: ['email', 'data_nascimento', 'data_nascimento_conjuge', 'data_batismo_aguas', 'foto_url'],
    });

    const cleanVal = (val: any) => {
      if (val === undefined) return undefined;
      if (val === null || (typeof val === 'string' && val.trim() === '')) return null;
      return typeof val === 'string' ? val.trim() : val;
    };

    const updateFields: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    // Campos permitidos para edição pela Secretaria antes da aprovação
    if (normalized.name !== undefined) updateFields.name = normalized.name.trim();
    if (normalized.nome_pai !== undefined) updateFields.nome_pai = cleanVal(normalized.nome_pai);
    if (normalized.nome_mae !== undefined) updateFields.nome_mae = cleanVal(normalized.nome_mae);
    if (normalized.rg !== undefined) updateFields.rg = cleanVal(normalized.rg);
    if (normalized.orgao_emissor !== undefined) updateFields.orgao_emissor = cleanVal(normalized.orgao_emissor);
    if (normalized.data_nascimento !== undefined) updateFields.data_nascimento = cleanVal(normalized.data_nascimento);
    if (normalized.sexo !== undefined) updateFields.sexo = cleanVal(normalized.sexo);
    if (normalized.tipo_sanguineo !== undefined) updateFields.tipo_sanguineo = cleanVal(normalized.tipo_sanguineo);
    if (normalized.escolaridade !== undefined) updateFields.escolaridade = cleanVal(normalized.escolaridade);
    if (normalized.estado_civil !== undefined) updateFields.estado_civil = cleanVal(normalized.estado_civil);
    if (normalized.nome_conjuge !== undefined) updateFields.nome_conjuge = cleanVal(normalized.nome_conjuge);
    if (normalized.cpf_conjuge !== undefined) updateFields.cpf_conjuge = cleanVal(normalized.cpf_conjuge);
    if (normalized.data_nascimento_conjuge !== undefined) updateFields.data_nascimento_conjuge = cleanVal(normalized.data_nascimento_conjuge);
    if (normalized.nacionalidade !== undefined) updateFields.nacionalidade = cleanVal(normalized.nacionalidade);
    if (normalized.naturalidade !== undefined) updateFields.naturalidade = cleanVal(normalized.naturalidade);
    if (normalized.uf_naturalidade !== undefined) updateFields.uf_naturalidade = cleanVal(normalized.uf_naturalidade);
    if (normalized.tipo_cadastro !== undefined) updateFields.tipo_cadastro = cleanVal(normalized.tipo_cadastro);
    if (normalized.cargo_ministerial !== undefined) updateFields.cargo_ministerial = cleanVal(normalized.cargo_ministerial);
    if (normalized.data_batismo_aguas !== undefined) updateFields.data_batismo_aguas = cleanVal(normalized.data_batismo_aguas);
    if (normalized.congregacao_id !== undefined) updateFields.congregacao_id = cleanVal(normalized.congregacao_id);
    if (normalized.campo_id !== undefined) updateFields.campo_id = cleanVal(normalized.campo_id);
    if (normalized.cep !== undefined) updateFields.cep = cleanVal(normalized.cep);
    if (normalized.logradouro !== undefined) updateFields.logradouro = cleanVal(normalized.logradouro);
    if (normalized.numero !== undefined) updateFields.numero = cleanVal(normalized.numero);
    if (normalized.bairro !== undefined) updateFields.bairro = cleanVal(normalized.bairro);
    if (normalized.complemento !== undefined) updateFields.complemento = cleanVal(normalized.complemento);
    if (normalized.cidade !== undefined) updateFields.cidade = cleanVal(normalized.cidade);
    if (normalized.estado !== undefined) updateFields.estado = cleanVal(normalized.estado);
    if (normalized.email !== undefined) updateFields.email = normalized.email ? String(normalized.email).toLowerCase().trim() : null;
    if (normalized.phone !== undefined) updateFields.phone = cleanVal(normalized.phone);
    if (normalized.celular !== undefined) updateFields.celular = cleanVal(normalized.celular);
    if (normalized.whatsapp !== undefined) updateFields.whatsapp = cleanVal(normalized.whatsapp);
    if (normalized.profissao !== undefined) updateFields.profissao = cleanVal(normalized.profissao);
    if (normalized.foto_url !== undefined) updateFields.foto_url = cleanVal(normalized.foto_url);

    // Se congregacao_id foi atualizada, validar se pertence ao tenant
    if (updateFields.congregacao_id) {
      const { data: vCong } = await admin
        .from('congregacoes')
        .select('id, campo_id')
        .eq('id', updateFields.congregacao_id)
        .eq('ministry_id', ministryId)
        .maybeSingle();

      if (!vCong) {
        return NextResponse.json({ error: 'Congregação inválida para este ministério.' }, { status: 400 });
      }
      if (!updateFields.campo_id && vCong.campo_id) {
        updateFields.campo_id = vCong.campo_id;
      }
    }

    const { data: updated, error: updErr } = await admin
      .from('member_pre_registrations')
      .update(updateFields)
      .eq('id', id)
      .eq('ministry_id', ministryId)
      .select('*, congregacoes(id, nome), campos(id, nome)')
      .single();

    if (updErr) {
      console.error('[PATCH /api/v1/secretaria/pre-cadastros/[id]] Erro:', updErr);
      return NextResponse.json({ error: 'Erro ao salvar alterações no pré-cadastro.' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      preCadastro: updated,
      message: 'Dados do pré-cadastro atualizados com sucesso.',
    });
  } catch (err: any) {
    const authResp = authTenantErrorResponse(err);
    if (authResp) return authResp;
    console.error('[PATCH /api/v1/secretaria/pre-cadastros/[id]] Exceção:', err);
    return NextResponse.json({ error: 'Erro interno ao atualizar pré-cadastro.' }, { status: 500 });
  }
}
