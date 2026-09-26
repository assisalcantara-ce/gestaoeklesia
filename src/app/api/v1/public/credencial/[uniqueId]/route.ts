/**
 * API PÚBLICA DE VALIDAÇÃO DE CREDENCIAL MINISTERIAL
 * GET /api/v1/public/credencial/[uniqueId]
 *
 * Validação rigorosa de autenticidade ministerial:
 * 1. Obreiro existe no banco?
 * 2. Possui consagração/ordenação ministerial comprovada?
 * 3. Status cadastral está ativo?
 * 4. Validade temporal da credencial está em dia?
 *
 * Retorna SOMENTE dados públicos institucionais autorizados.
 * NÃO EXPÕE: CPF, RG, telefone, email, endereço, dados financeiros ou internos.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ uniqueId: string }> }
) {
  try {
    const { uniqueId } = await context.params;

    if (!uniqueId || typeof uniqueId !== 'string' || !uniqueId.trim()) {
      return NextResponse.json(
        { error: 'Identificador não fornecido.', validade_status: 'nao_encontrada' },
        { status: 400 }
      );
    }

    const cleanId = decodeURIComponent(uniqueId).trim();
    const admin = createServerClient();

    // 1. Buscar membro pelo unique_id (ou id caso seja UUID)
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(cleanId);

    let query = admin
      .from('members')
      .select(
        `id, unique_id, name, matricula, foto_url,
         cargo_ministerial, tipo_cadastro, status,
         data_consagracao, data_validade_credencial,
         congregacao_id, ministry_id, dados_cargos, custom_fields`
      );

    if (isUuid) {
      query = query.or(`unique_id.eq.${cleanId},id.eq.${cleanId}`);
    } else {
      query = query.eq('unique_id', cleanId);
    }

    const { data: member, error: memberErr } = await query.maybeSingle();

    if (memberErr || !member) {
      return NextResponse.json(
        {
          error: 'Credencial não localizada.',
          validade_status: 'nao_encontrada',
        },
        { status: 404 }
      );
    }

    // 2. Verificar processos homologados no tenant para este membro
    let hasProcessoHomologado = false;
    if (member.ministry_id) {
      const { data: procHomologado } = await admin
        .from('consagracao_registros')
        .select('id, status_processo')
        .eq('member_id', member.id)
        .eq('ministry_id', member.ministry_id)
        .eq('status_processo', 'homologar')
        .limit(1)
        .maybeSingle();

      if (procHomologado) {
        hasProcessoHomologado = true;
      }
    }

    // 3. Verificar histórico estruturado em custom_fields
    const cf = member.custom_fields && typeof member.custom_fields === 'object' ? member.custom_fields : {};
    const historicoProc = Array.isArray((cf as any).historico_processos) ? (cf as any).historico_processos : [];
    const hasHistoricoHomologado = historicoProc.some(
      (ev: any) => ev.status_processo === 'homologar' || ev.tipo_evento === 'homologacao'
    );

    // 4. Identificar cargo e evidência ministerial
    const cargo = String(member.cargo_ministerial || (cf as any).cargoMinisterial || '').trim();
    const tipoCad = String(member.tipo_cadastro || '').toLowerCase().trim();
    const dataConsag = member.data_consagracao || (cf as any).dataConsagracao || null;
    const hasDadosCargos = member.dados_cargos && typeof member.dados_cargos === 'object' && Object.keys(member.dados_cargos).length > 0;

    const isMinistroReconhecido =
      hasProcessoHomologado ||
      hasHistoricoHomologado ||
      tipoCad === 'ministro' ||
      (Boolean(cargo) && cargo.toLowerCase() !== 'membro' && cargo.toLowerCase() !== 'congregado' && (Boolean(dataConsag) || hasDadosCargos));

    // 5. Determinar estado de validade em tempo real
    let validadeStatus: 'valida' | 'inativa' | 'expirada' | 'sem_credencial' = 'valida';
    let mensagemStatus = 'Credencial Ministerial Válida';

    if (!isMinistroReconhecido) {
      validadeStatus = 'sem_credencial';
      mensagemStatus = 'Cadastro de Membro sem Credencial Ministerial Homologada';
    } else if (member.status !== 'active') {
      validadeStatus = 'inativa';
      mensagemStatus = member.status === 'suspended' ? 'Credencial Ministerial Suspensa' : 'Credencial Ministerial Inativa';
    } else if (member.data_validade_credencial) {
      const hoje = new Date().toISOString().slice(0, 10);
      if (hoje > member.data_validade_credencial) {
        validadeStatus = 'expirada';
        mensagemStatus = 'Credencial Ministerial com Validade Expirada';
      }
    }

    // 6. Buscar congregação (se houver)
    let congregacaoNome: string | null = null;
    if (member.congregacao_id) {
      const { data: cong } = await admin
        .from('congregacoes')
        .select('nome')
        .eq('id', member.congregacao_id as string)
        .maybeSingle();
      congregacaoNome = (cong as any)?.nome ?? null;
    } else if ((cf as any).congregacao) {
      congregacaoNome = String((cf as any).congregacao);
    }

    // 7. Buscar Ministério/Igreja
    let ministerioNome: string | null = null;
    let ministerioLogo: string | null = null;
    if (member.ministry_id) {
      const { data: min } = await admin
        .from('ministries')
        .select('name, logo_url')
        .eq('id', member.ministry_id as string)
        .maybeSingle();
      ministerioNome = (min as any)?.name ?? null;
      ministerioLogo = (min as any)?.logo_url ?? null;
    }

    // 8. Retornar resposta estritamente pública e higienizada
    return NextResponse.json(
      {
        validade_status: validadeStatus,
        mensagem_status: mensagemStatus,
        is_ministro: isMinistroReconhecido,
        identificador: member.unique_id || member.id,
        nome: member.name,
        foto_url: member.foto_url || null,
        cargo_ministerial: cargo || 'Membro',
        status: member.status,
        matricula: member.matricula || (cf as any).matricula || null,
        data_consagracao: dataConsag,
        data_validade_credencial: member.data_validade_credencial || null,
        congregacao: congregacaoNome,
        ministerio: ministerioNome,
        ministerio_logo: ministerioLogo,
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    );
  } catch (err: any) {
    console.error('[API public/credencial]', err);
    return NextResponse.json(
      { error: 'Erro interno ao consultar credencial.', validade_status: 'nao_encontrada' },
      { status: 500 }
    );
  }
}
