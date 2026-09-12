/**
 * API ROUTE: Consulta Paginada de Cartas Ministeriais para a Central de Relatórios
 * GET /api/v1/secretaria/relatorios/letters
 */

import { NextRequest, NextResponse } from 'next/server';
import { resolveTenantAuth } from '@/lib/tenant-auth';
import { isLocalNivel } from '@/lib/access-control';

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

  const { admin, ministryId, nivel, congregacaoId: userCongregacaoId } = context;

  const { searchParams } = new URL(request.url);
  const tipoConsulta = searchParams.get('tipoConsulta') || 'pedidos'; // 'pedidos' ou 'emitidas'
  const status = searchParams.get('status');
  const tipoCarta = searchParams.get('tipoCarta');
  const requestedCongregacaoId = searchParams.get('congregacao_id');
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '25', 10);
  const offset = (page - 1) * limit;

  let effectiveCongregacaoId: string | null = null;
  if (isLocalNivel(nivel)) {
    effectiveCongregacaoId = userCongregacaoId;
  } else if (requestedCongregacaoId && requestedCongregacaoId !== 'todas') {
    effectiveCongregacaoId = requestedCongregacaoId;
  }

  try {
    if (tipoConsulta === 'emitidas') {
      let query = admin
        .from('cartas_registros')
        .select('id, template_title, template_key, status, issued_at, created_at, member_id, members(name, congregacoes(nome))', { count: 'exact' })
        .eq('ministry_id', ministryId);

      if (status && status !== 'todos') {
        query = query.eq('status', status);
      }

      const { data, count, error } = await query
        .order('issued_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      const items = (data || []).map((r: any) => ({
        id: r.id,
        template_title: r.template_title || 'Carta Ministerial',
        template_key: r.template_key,
        status: r.status,
        issued_at: r.issued_at || r.created_at,
        membro_nome: r.members?.name || 'Não identificado',
        congregacao_nome: r.members?.congregacoes?.nome || null,
      }));

      const total = count || 0;
      return NextResponse.json({
        success: true,
        data: items,
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      });
    } else {
      // Pedidos de Cartas
      let query = admin
        .from('carta_pedidos')
        .select('id, solicitante_nome, membro_nome, membro_cargo, tipo_carta, destino, observacoes, status, autorizador_nome, data_autorizacao, motivo_rejeicao, created_at, congregacoes(nome)', { count: 'exact' })
        .eq('ministry_id', ministryId);

      if (effectiveCongregacaoId) {
        query = query.eq('congregacao_id', effectiveCongregacaoId);
      }
      if (status && status !== 'todos') {
        query = query.eq('status', status);
      }
      if (tipoCarta && tipoCarta !== 'todos') {
        query = query.eq('tipo_carta', tipoCarta);
      }

      const { data, count, error } = await query
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      const items = (data || []).map((p: any) => ({
        id: p.id,
        solicitante_nome: p.solicitante_nome,
        membro_nome: p.membro_nome,
        membro_cargo: p.membro_cargo,
        tipo_carta: p.tipo_carta,
        destino: p.destino,
        status: p.status,
        data_autorizacao: p.data_autorizacao,
        created_at: p.created_at,
        congregacao_nome: p.congregacoes?.nome || null,
      }));

      const total = count || 0;
      return NextResponse.json({
        success: true,
        data: items,
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      });
    }
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Erro ao consultar cartas ministeriais.' },
      { status: 500 }
    );
  }
}
