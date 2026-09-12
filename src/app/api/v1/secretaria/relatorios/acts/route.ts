/**
 * API ROUTE: Consulta Paginada de Batismos e Atos Eclesiásticos para a Central de Relatórios
 * GET /api/v1/secretaria/relatorios/acts
 */

import { NextRequest, NextResponse } from 'next/server';
import { resolveTenantAuth } from '@/lib/tenant-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  let context: Awaited<ReturnType<typeof resolveTenantAuth>>;
  try {
    context = await resolveTenantAuth(request);
  } catch (err: any) {
    const isUnauth = err?.message === 'UNAUTHORIZED';
    return NextResponse.json(
      { error: isUnauth ? 'Não autenticado.' : 'Acesso negado: sem ministério associado.' },
      { status: isUnauth ? 401 : 403 }
    );
  }

  const { admin, ministryId } = context;

  const { searchParams } = new URL(request.url);
  const tipoAto = searchParams.get('tipoAto') || 'batismos'; // 'batismos' | 'apresentacoes' | 'casamentos' | 'consagracoes'
  const year = searchParams.get('year');
  const status = searchParams.get('status');
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '25', 10);
  const offset = (page - 1) * limit;

  try {
    if (tipoAto === 'batismos') {
      let query = admin
        .from('batismo_aguas_registros')
        .select('id, candidato_nome, data_batismo, local_batismo, pastor_nome, status, certificado_emitido_em, created_at', { count: 'exact' })
        .eq('ministry_id', ministryId);

      if (year && year !== 'todos') {
        query = query.gte('data_batismo', `${year}-01-01`).lte('data_batismo', `${year}-12-31`);
      }
      if (status && status !== 'todos') {
        query = query.eq('status', status);
      }

      const { data, count, error } = await query
        .order('data_batismo', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      return NextResponse.json({
        success: true,
        data: data || [],
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit) || 1,
      });
    }

    if (tipoAto === 'apresentacoes') {
      let query = admin
        .from('apresentacao_criancas_registros')
        .select('id, crianca_nome, crianca_data_nascimento, pai_nome, mae_nome, responsavel_nome, responsavel_telefone, data_apresentacao, local_apresentacao, status, certificado_emitido_em, created_at', { count: 'exact' })
        .eq('ministry_id', ministryId);

      if (year && year !== 'todos') {
        query = query.gte('data_apresentacao', `${year}-01-01`).lte('data_apresentacao', `${year}-12-31`);
      }
      if (status && status !== 'todos') {
        query = query.eq('status', status);
      }

      const { data, count, error } = await query
        .order('data_apresentacao', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      return NextResponse.json({
        success: true,
        data: data || [],
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit) || 1,
      });
    }

    if (tipoAto === 'casamentos') {
      let query = admin
        .from('casamento_registros')
        .select('id, conjuge1_nome, conjuge2_nome, data_casamento, local_casamento, pastor_nome, tipo_casamento, status, certificado_emitido_em, created_at', { count: 'exact' })
        .eq('ministry_id', ministryId);

      if (year && year !== 'todos') {
        query = query.gte('data_casamento', `${year}-01-01`).lte('data_casamento', `${year}-12-31`);
      }
      if (status && status !== 'todos') {
        query = query.eq('status', status);
      }

      const { data, count, error } = await query
        .order('data_casamento', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      return NextResponse.json({
        success: true,
        data: data || [],
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit) || 1,
      });
    }

    if (tipoAto === 'consagracoes') {
      let query = admin
        .from('consagracao_registros')
        .select('id, nome, cpf, cargo_ocupa, cargo_pretendido, data_processo, data_autorizacao, status_processo, created_at', { count: 'exact' })
        .eq('ministry_id', ministryId);

      if (year && year !== 'todos') {
        query = query.gte('data_processo', `${year}-01-01`).lte('data_processo', `${year}-12-31`);
      }
      if (status && status !== 'todos') {
        query = query.eq('status_processo', status);
      }

      const { data, count, error } = await query
        .order('data_processo', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      return NextResponse.json({
        success: true,
        data: data || [],
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit) || 1,
      });
    }

    return NextResponse.json({ success: false, error: 'Tipo de ato eclesiástico inválido.' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Erro ao consultar atos eclesiásticos.' },
      { status: 500 }
    );
  }
}
