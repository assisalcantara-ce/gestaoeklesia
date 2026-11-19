/**
 * API ROUTE PÚBLICA: Obter Informações Institucionais do Cadastro Público
 * GET /api/v1/public/members/info?institution={slug-ou-id}
 *
 * Retorna estritamente:
 * - institution_name
 * - logo_url (ou null)
 * - congregacoes: [{ id, nome }] (somente ativas pertencentes ao tenant)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const institution = searchParams.get('institution');

    if (!institution || typeof institution !== 'string' || !institution.trim()) {
      return NextResponse.json(
        { error: 'Identificador da instituição não informado.' },
        { status: 400 }
      );
    }

    const admin = createServerClient();
    const instClean = institution.trim();
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(instClean);

    let ministryQuery = admin
      .from('ministries')
      .select('id, name, logo_url, is_active');

    if (isUuid) {
      ministryQuery = ministryQuery.eq('id', instClean);
    } else {
      ministryQuery = ministryQuery.eq('slug', instClean.toLowerCase());
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

    // Buscar congregações ativas pertencentes ao tenant com vínculo ao campo (grupo)
    let congregacoes: Array<{ id: string; nome: string; campo_id?: string | null; campo_nome?: string | null }> = [];

    const { data: congData, error: congErr } = await admin
      .from('congregacoes')
      .select('id, nome, campo_id, is_active')
      .eq('ministry_id', ministryId)
      .or('is_active.eq.true,is_active.is.null')
      .order('nome', { ascending: true });

    // Buscar campos (grupos/setores) ativos para mapear nomes
    const { data: camposData } = await admin
      .from('campos')
      .select('id, nome, is_active')
      .eq('ministry_id', ministryId)
      .or('is_active.eq.true,is_active.is.null');

    const camposMap = new Map<string, string>();
    if (camposData && Array.isArray(camposData)) {
      camposData.forEach((cp: any) => {
        if (cp.id && cp.nome) camposMap.set(cp.id, cp.nome.trim());
      });
    }

    if (!congErr && congData && congData.length > 0) {
      congregacoes = congData.map((c: any) => ({
        id: c.id,
        nome: c.nome,
        campo_id: c.campo_id || null,
        campo_nome: c.campo_id ? camposMap.get(c.campo_id) || null : null,
      }));
    } else {
      // Fallback: se o tenant utiliza a 1ª divisão em supervisoes
      const { data: supData } = await admin
        .from('supervisoes')
        .select('id, nome, is_active')
        .eq('ministry_id', ministryId)
        .or('is_active.eq.true,is_active.is.null')
        .order('nome', { ascending: true });

      if (supData && supData.length > 0) {
        congregacoes = supData.map((s: any) => ({
          id: s.id,
          nome: s.nome,
          campo_id: null,
          campo_nome: null,
        }));
      }
    }

    return NextResponse.json({
      institution_name: ministry.name,
      logo_url: ministry.logo_url || null,
      congregacoes,
    });
  } catch (err: any) {
    console.error('[GET /api/v1/public/members/info] Erro interno:', err);
    return NextResponse.json(
      { error: 'Erro interno ao consultar informações da instituição.' },
      { status: 500 }
    );
  }
}
