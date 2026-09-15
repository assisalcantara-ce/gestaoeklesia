import { NextRequest, NextResponse } from 'next/server';
import { resolveMobileMember, mobileMemberErrorResponse } from '@/lib/mobile-member-auth';
import { createServerClient } from '@/lib/supabase-server';
import { isBirthdayInNextDays } from '@/services/secretary-reports-service';

export const dynamic = 'force-dynamic';

export interface MobileAniversarianteItem {
  id: string;
  nome: string;
  dia: number;
  mes: number;
  isHoje: boolean;
  foto_url: string | null;
  cargo_ministerial: string | null;
  congregacao_nome: string | null;
}

/**
 * GET /api/v1/mobile/aniversariantes
 *
 * Retorna aniversariantes para exibição no App do Membro:
 * - Autenticação obrigatória via resolveMobileMember
 * - Filtros:
 *     - periodo: 'hoje' | 'mes' (default) | 'proximos_30'
 *     - escopo: 'minha_congregacao' (default) | 'todas'
 * - Segurança & Privacidade:
 *     - Retorna apenas: id, nome, dia, mes, isHoje, foto_url, cargo_ministerial, congregacao_nome
 *     - NUNCA expõe data_nascimento completa (ano), idade, CPF, telefone, endereço, etc.
 * - Multi-tenant isolado por ctx.ministryId
 * - Filtra apenas membros ativos (status = 'active') e com data_nascimento preenchida
 */
export async function GET(request: NextRequest) {
  try {
    const ctx = await resolveMobileMember(request);
    const admin = createServerClient();

    // 1. Obter congregação oficial do membro autenticado
    const { data: member, error: memberErr } = await admin
      .from('members')
      .select('id, congregacao_id')
      .eq('id', ctx.memberId)
      .eq('ministry_id', ctx.ministryId)
      .maybeSingle();

    if (memberErr || !member) {
      return NextResponse.json(
        { error: 'Membro não encontrado.', code: 'MEMBER_NOT_FOUND' },
        { status: 404 }
      );
    }

    // 2. Validação e extração dos parâmetros de query
    const searchParams = request.nextUrl.searchParams;
    const periodoParam = (searchParams.get('periodo') || 'mes').toLowerCase();
    const escopoParam = (searchParams.get('escopo') || 'minha_congregacao').toLowerCase();

    const periodosValidos = ['hoje', 'mes', 'proximos_30'];
    if (!periodosValidos.includes(periodoParam)) {
      return NextResponse.json(
        {
          error: 'Parâmetro periodo inválido. Valores aceitos: hoje, mes, proximos_30.',
          code: 'INVALID_PERIODO',
        },
        { status: 400 }
      );
    }

    const escoposValidos = ['minha_congregacao', 'todas'];
    if (!escoposValidos.includes(escopoParam)) {
      return NextResponse.json(
        {
          error: 'Parâmetro escopo inválido. Valores aceitos: minha_congregacao, todas.',
          code: 'INVALID_ESCOPO',
        },
        { status: 400 }
      );
    }

    // 3. Montar query no banco
    let query = admin
      .from('members')
      .select(
        `
        id,
        name,
        data_nascimento,
        foto_url,
        cargo_ministerial,
        congregacao_id,
        congregacoes (
          id,
          nome
        )
      `
      )
      .eq('ministry_id', ctx.ministryId)
      .eq('status', 'active')
      .not('data_nascimento', 'is', null);

    if (escopoParam === 'minha_congregacao') {
      if (member.congregacao_id) {
        query = query.eq('congregacao_id', member.congregacao_id);
      } else {
        query = query.is('congregacao_id', null);
      }
    }

    const { data: members, error: queryErr } = await query;
    if (queryErr) {
      return NextResponse.json(
        { error: 'Erro ao consultar aniversariantes.' },
        { status: 500 }
      );
    }

    const allMembers = members || [];
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentDay = now.getDate();

    const filteredItems: MobileAniversarianteItem[] = [];

    // 4. Filtrar e sanitizar
    for (const m of allMembers) {
      if (!m.data_nascimento) continue;
      const parts = m.data_nascimento.split('T')[0].split('-');
      if (parts.length !== 3) continue;

      const birthMonth = parseInt(parts[1], 10);
      const birthDay = parseInt(parts[2], 10);
      if (isNaN(birthMonth) || isNaN(birthDay)) continue;

      const isHoje = birthMonth === currentMonth && birthDay === currentDay;

      let match = false;
      if (periodoParam === 'hoje') {
        match = isHoje;
      } else if (periodoParam === 'mes') {
        match = birthMonth === currentMonth;
      } else if (periodoParam === 'proximos_30') {
        match = isBirthdayInNextDays(m.data_nascimento, 30, now);
      }

      if (match) {
        filteredItems.push({
          id: m.id,
          nome: m.name || 'Sem Nome',
          dia: birthDay,
          mes: birthMonth,
          isHoje,
          foto_url: m.foto_url || null,
          cargo_ministerial: m.cargo_ministerial || null,
          congregacao_nome: (m.congregacoes as any)?.nome || null,
        });
      }
    }

    // 5. Ordenação
    if (periodoParam === 'proximos_30') {
      filteredItems.sort((a, b) => {
        const getDiffDays = (item: MobileAniversarianteItem) => {
          let bday = new Date(now.getFullYear(), item.mes - 1, item.dia);
          const ref = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          if (bday < ref) bday = new Date(now.getFullYear() + 1, item.mes - 1, item.dia);
          return bday.getTime() - ref.getTime();
        };
        const diff = getDiffDays(a) - getDiffDays(b);
        if (diff !== 0) return diff;
        return a.nome.localeCompare(b.nome);
      });
    } else {
      filteredItems.sort((a, b) => {
        if (a.dia !== b.dia) return a.dia - b.dia;
        return a.nome.localeCompare(b.nome);
      });
    }

    return NextResponse.json({
      aniversariantes: filteredItems,
      total: filteredItems.length,
      periodo: periodoParam,
      escopo: escopoParam,
    });
  } catch (error) {
    const authResp = mobileMemberErrorResponse(error);
    if (authResp) return authResp;
    return NextResponse.json(
      { error: 'Erro interno ao consultar aniversariantes.' },
      { status: 500 }
    );
  }
}
