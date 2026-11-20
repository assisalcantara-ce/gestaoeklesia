/**
 * API ROUTE: Central de Pré-Cadastros de Membros (Secretaria)
 * GET /api/v1/secretaria/pre-cadastros
 *
 * Funcionalidades:
 * - Autenticação estrita do tenant via `resolveTenantAuth`.
 * - Autorização para perfis com permissão em 'secretaria'.
 * - Listagem paginada das solicitações de `member_pre_registrations` do `ministry_id`.
 * - Filtros: `status`, `origem`, `congregacao_id`, `campo_id`, `search` (nome/CPF), `tipo_solicitacao`.
 * - Resumo contadores para os cards (pendentes, aprovados, rejeitados, devolvidos).
 */

import { NextRequest, NextResponse } from 'next/server';
import { resolveTenantAuth } from '@/lib/tenant-auth';
import { temAcesso } from '@/lib/access-control';
import { authTenantErrorResponse } from '@/lib/api-errors';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const context = await resolveTenantAuth(request);
    const { ministryId, admin, nivel } = context;

    if (!ministryId) {
      return NextResponse.json(
        { error: 'Usuário sem ministério associado', code: 'NO_MINISTRY' },
        { status: 403 }
      );
    }

    if (!temAcesso(nivel as any, 'secretaria')) {
      return NextResponse.json(
        { error: 'Acesso não autorizado ao módulo da secretaria.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') || '20', 10)));
    const offset = (page - 1) * limit;

    const statusParam = searchParams.get('status')?.trim() || '';
    const origemParam = searchParams.get('origem')?.trim() || '';
    const congregacaoParam = searchParams.get('congregacao_id')?.trim() || '';
    const campoParam = searchParams.get('campo_id')?.trim() || '';
    const tipoSolicitacaoParam = searchParams.get('tipo_solicitacao')?.trim() || '';
    const searchParam = searchParams.get('search')?.trim() || '';

    // Contadores gerais para os 4 cards informativos e para as 2 abas:
    // 1. Pendentes totais
    // 2. Novos Cadastros (pendentes com tipo_solicitacao = 'novo_cadastro')
    // 3. Atualizações (pendentes com tipo_solicitacao = 'atualizacao')
    // 4. Inativos totais (inativo, rejeitado, devolvido)
    const [
      { count: countPendentes },
      { count: countNovosCadastros },
      { count: countAtualizacoes },
      { count: countInativosEfetivos },
      { count: countRejeitados },
      { count: countDevolvidos },
    ] = await Promise.all([
      admin
        .from('member_pre_registrations')
        .select('id', { count: 'exact', head: true })
        .eq('ministry_id', ministryId)
        .eq('status', 'pendente'),
      admin
        .from('member_pre_registrations')
        .select('id', { count: 'exact', head: true })
        .eq('ministry_id', ministryId)
        .eq('status', 'pendente')
        .eq('tipo_solicitacao', 'novo_cadastro'),
      admin
        .from('member_pre_registrations')
        .select('id', { count: 'exact', head: true })
        .eq('ministry_id', ministryId)
        .eq('status', 'pendente')
        .eq('tipo_solicitacao', 'atualizacao'),
      admin
        .from('member_pre_registrations')
        .select('id', { count: 'exact', head: true })
        .eq('ministry_id', ministryId)
        .eq('status', 'inativo'),
      admin
        .from('member_pre_registrations')
        .select('id', { count: 'exact', head: true })
        .eq('ministry_id', ministryId)
        .eq('status', 'rejeitado'),
      admin
        .from('member_pre_registrations')
        .select('id', { count: 'exact', head: true })
        .eq('ministry_id', ministryId)
        .eq('status', 'devolvido'),
    ]);

    const totalInativos = (countInativosEfetivos || 0) + (countRejeitados || 0) + (countDevolvidos || 0);

    // Query principal
    let query = admin
      .from('member_pre_registrations')
      .select('*, congregacoes(id, nome), campos(id, nome)', { count: 'exact' })
      .eq('ministry_id', ministryId);

    if (statusParam && statusParam !== 'todos') {
      if (statusParam === 'inativo') {
        // Aba Inativos consolida status inativo, rejeitado e devolvido
        query = query.in('status', ['inativo', 'rejeitado', 'devolvido']);
      } else {
        query = query.eq('status', statusParam);
      }
    }
    if (origemParam && origemParam !== 'todos') {
      query = query.eq('origem', origemParam);
    }
    if (congregacaoParam && congregacaoParam !== 'todas') {
      query = query.eq('congregacao_id', congregacaoParam);
    }
    if (campoParam && campoParam !== 'todos') {
      query = query.eq('campo_id', campoParam);
    }
    if (tipoSolicitacaoParam && tipoSolicitacaoParam !== 'todos') {
      query = query.eq('tipo_solicitacao', tipoSolicitacaoParam);
    }
    if (searchParam) {
      const cleanDigits = searchParam.replace(/\D/g, '');
      if (cleanDigits.length >= 3) {
        query = query.or(`name.ilike.%${searchParam}%,cpf.ilike.%${cleanDigits}%`);
      } else {
        query = query.ilike('name', `%${searchParam}%`);
      }
    }

    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: records, error: listErr, count } = await query;

    if (listErr) {
      console.error('[GET /api/v1/secretaria/pre-cadastros] Erro ao listar:', listErr);
      return NextResponse.json(
        { error: 'Falha ao buscar solicitações de pré-cadastro.' },
        { status: 500 }
      );
    }

    // Buscar possíveis CPFs duplicados na tabela oficial `members` para cada registro
    const preCadastros = records || [];
    const cpfsList = preCadastros.map((r: any) => r.cpf).filter(Boolean);

    let membersExistentesPorCpf: Record<string, any> = {};
    if (cpfsList.length > 0) {
      const { data: foundMembers } = await admin
        .from('members')
        .select('id, name, cpf, matricula, status, tipo_cadastro, congregacao_id')
        .eq('ministry_id', ministryId)
        .in('cpf', cpfsList);

      if (foundMembers) {
        for (const m of foundMembers) {
          membersExistentesPorCpf[m.cpf] = m;
        }
      }
    }

    const items = preCadastros.map((item: any) => {
      const existingMember = membersExistentesPorCpf[item.cpf] || null;
      return {
        ...item,
        existingMemberMatch: existingMember,
        isDuplicidadeDetectada: Boolean(existingMember && item.tipo_solicitacao === 'novo_cadastro'),
      };
    });

    const total = count || 0;
    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
      stats: {
        pendentes: countPendentes || 0,
        novosCadastros: countNovosCadastros || 0,
        atualizacoes: countAtualizacoes || 0,
        inativos: totalInativos,
        // Mantidos para compatibilidade caso algum cliente consuma
        rejeitados: countRejeitados || 0,
        devolvidos: countDevolvidos || 0,
        totalGeral: (countPendentes || 0) + totalInativos,
      },
    });
  } catch (err: any) {
    const authResp = authTenantErrorResponse(err);
    if (authResp) return authResp;
    console.error('[GET /api/v1/secretaria/pre-cadastros] Exceção:', err);
    return NextResponse.json(
      { error: 'Erro ao buscar solicitações de pré-cadastro.' },
      { status: 500 }
    );
  }
}
