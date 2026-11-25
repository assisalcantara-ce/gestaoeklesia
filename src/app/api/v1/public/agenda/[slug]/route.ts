import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { checkRateLimit } from '@/lib/rate-limit';
import {
  filterPublicEventsForEdition,
  getInstitutionalYearMonth,
  DEFAULT_INSTITUTIONAL_TIMEZONE,
  type DepartamentoRevistaPublico,
} from '@/lib/revista-digital-utils';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/public/agenda/[slug]
 *
 * Endpoint público da Revista Digital do Gestão Eklésia.
 * Retorna dados institucionais, tema anual (planejamento publicado),
 * mensagem pastoral ativa e eventos públicos do ministério.
 *
 * Regras de Segurança:
 * - Rate limit preventivo para requisições anônimas.
 * - Resolução segura do ministério via slug único indexado.
 * - Filtro rigoroso por ministry_id em todas as consultas.
 * - Eventos com visibilidade pública ('publico', 'ministerio', 'igreja') e status != 'cancelado' (exclui estritamente 'privado' e 'lideranca').
 * - Sanitização estrita do DTO de resposta: IDs internos de banco (UUIDs de
 *   infraestrutura, ministry_id, created_by, tokens, financeiro, regras de
 *   bloqueio) NUNCA são expostos.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    // 1. Rate Limiting preventivo (60 requisições por minuto por IP)
    const rateLimit = checkRateLimit(request, 60, 60 * 1000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Muitas requisições. Tente novamente mais tarde.' },
        {
          status: 429,
          headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) },
        }
      );
    }

    const { slug } = await context.params;

    if (!slug || typeof slug !== 'string' || !slug.trim()) {
      return NextResponse.json(
        { error: 'Slug do ministério não fornecido.' },
        { status: 400 }
      );
    }

    const cleanSlug = slug.trim().toLowerCase();
    const admin = createServerClient();

    // 2. Resolver o ministério pelo slug único
    const { data: ministry, error: ministryErr } = await admin
      .from('ministries')
      .select('id, name, slug, description, logo_url, website, phone, is_active')
      .eq('slug', cleanSlug)
      .maybeSingle();

    if (ministryErr || !ministry || ministry.is_active === false) {
      return NextResponse.json(
        { error: 'Ministério não encontrado ou indisponível.' },
        { status: 404 }
      );
    }

    const ministryId = ministry.id;

    // 3. Buscar perfil complementar da igreja em configurations (apenas dados públicos de perfil)
    const { data: configRow } = await admin
      .from('configurations')
      .select('church_profile')
      .eq('ministry_id', ministryId)
      .maybeSingle();

    const churchProfile = (configRow?.church_profile as Record<string, any>) || {};

    // 4. Parâmetro opcional de ano (ex: ?ano=2026)
    const searchParams = request.nextUrl.searchParams;
    const anoParam = searchParams.get('ano');
    const anoFiltrado = anoParam && !isNaN(Number(anoParam)) ? parseInt(anoParam, 10) : null;
    const anoAtual = new Date().getFullYear();

    // 5. Buscar planejamento anual publicado (Tema Anual)
    let planningQuery = admin
      .from('agenda_planejamentos')
      .select('ano, nome, descricao, status, published_at')
      .eq('ministry_id', ministryId)
      .eq('status', 'publicado');

    if (anoFiltrado) {
      planningQuery = planningQuery.eq('ano', anoFiltrado);
    } else {
      // Prioriza o ano corrente ou o mais recente publicado
      planningQuery = planningQuery.order('ano', { ascending: false });
    }

    const { data: planejamentos } = await planningQuery.limit(1);
    const planejamentoAtivo = planejamentos && planejamentos.length > 0 ? planejamentos[0] : null;

    // 6. Buscar mensagem pastoral institucional ativa dentro do período de vigência
    const hojeStr = new Date().toISOString().split('T')[0];
    const { data: mensagens } = await admin
      .from('ministerio_mensagens')
      .select('titulo, conteudo_texto, video_url, video_tipo, data_inicio, data_fim, ordem')
      .eq('ministry_id', ministryId)
      .eq('ativo', true)
      .lte('data_inicio', hojeStr)
      .gte('data_fim', hojeStr)
      .order('ordem', { ascending: true })
      .order('created_at', { ascending: false })
      .limit(1);

    const mensagemPastoral = mensagens && mensagens.length > 0
      ? {
          titulo: mensagens[0].titulo,
          conteudo_texto: mensagens[0].conteudo_texto,
          video_url: mensagens[0].video_url,
          video_tipo: mensagens[0].video_tipo,
          data_inicio: mensagens[0].data_inicio,
          data_fim: mensagens[0].data_fim,
        }
      : null;

    // 7. Buscar eventos públicos não cancelados
    let eventosQuery = admin
      .from('agenda_eventos')
      .select(`
        id,
        titulo,
        descricao,
        data_inicio,
        data_fim,
        local,
        status,
        visibilidade,
        calendario_oficial,
        agenda_tipos (
          nome,
          categoria,
          cor,
          icone
        )
      `)
      .eq('ministry_id', ministryId)
      .in('visibilidade', ['publico', 'ministerio', 'igreja'])
      .neq('status', 'cancelado')
      .order('data_inicio', { ascending: true });

    // Filtrar pelo ano correspondente
    const anoParaEventos = anoFiltrado || (planejamentoAtivo ? planejamentoAtivo.ano : anoAtual);
    const dataInicioAno = `${anoParaEventos}-01-01T00:00:00.000Z`;
    const dataFimAno = `${anoParaEventos}-12-31T23:59:59.999Z`;

    eventosQuery = eventosQuery
      .gte('data_inicio', dataInicioAno)
      .lte('data_inicio', dataFimAno);

    const { data: eventos, error: eventosErr } = await eventosQuery;

    if (eventosErr) {
      console.error('[PublicAgendaAPI] Erro ao carregar eventos:', eventosErr);
      return NextResponse.json(
        { error: 'Não foi possível carregar a programação da revista.' },
        { status: 500 }
      );
    }

    // 8. Sanitização do DTO de resposta e ocultação automática de meses encerrados
    const eventosVisiveis = filterPublicEventsForEdition(
      eventos || [],
      anoParaEventos,
      new Date(),
      DEFAULT_INSTITUTIONAL_TIMEZONE
    );

    const eventosSanitizados = eventosVisiveis.map((ev) => {
      const tipoInfo = ev.agenda_tipos as {
        nome?: string;
        categoria?: string;
        cor?: string;
        icone?: string;
      } | null;

      return {
        id: ev.id,
        titulo: ev.titulo,
        descricao: ev.descricao,
        data_inicio: ev.data_inicio,
        data_fim: ev.data_fim,
        local: ev.local,
        status: ev.status,
        calendario_oficial: Boolean(ev.calendario_oficial),
        tipo: tipoInfo
          ? {
              nome: tipoInfo.nome || null,
              categoria: tipoInfo.categoria || null,
              cor: tipoInfo.cor || null,
              icone: tipoInfo.icone || null,
            }
          : null,
      };
    });

    // 8b. Buscar departamentos selecionados (somente se seção pública ativa e edição vigente/futura)
    const depConfig = churchProfile?.revista_edicoes?.[String(anoParaEventos)]?.departamentos;
    const { year: anoInstitucionalAtual } = getInstitutionalYearMonth(new Date(), DEFAULT_INSTITUTIONAL_TIMEZONE);
    let departamentosSecao: {
      titulo: string;
      subtitulo: string;
      departamentos: DepartamentoRevistaPublico[];
    } | null = null;

    if (
      depConfig?.publicada === true &&
      Array.isArray(depConfig?.departamento_ids) &&
      depConfig.departamento_ids.length > 0 &&
      anoParaEventos >= anoInstitucionalAtual
    ) {
      const { data: depsRows } = await admin
        .from('departamentos')
        .select('id, sigla, nome, logo_url, coordenacao')
        .eq('ministry_id', ministryId)
        .eq('ativo', true)
        .in('id', depConfig.departamento_ids);

      const depMap = new Map<string, DepartamentoRevistaPublico>();
      for (const d of depsRows || []) {
        depMap.set(String(d.id), {
          id: String(d.id),
          sigla: String(d.sigla || ''),
          nome: String(d.nome || ''),
          logo_url: d.logo_url ? String(d.logo_url) : null,
          lideranca: Array.isArray(d.coordenacao)
            ? d.coordenacao.map((c: any) => ({
                cargo: String(c?.cargo || ''),
                nome: String(c?.nome || ''),
              }))
            : [],
        });
      }

      const ordenados: DepartamentoRevistaPublico[] = [];
      for (const id of depConfig.departamento_ids) {
        const item = depMap.get(String(id));
        if (item) ordenados.push(item);
      }

      if (ordenados.length > 0) {
        departamentosSecao = {
          titulo: String(depConfig.titulo || 'Nossos Departamentos'),
          subtitulo: String(depConfig.subtitulo || ''),
          departamentos: ordenados,
        };
      }
    }

    // 9. Resposta consolidada com cabeçalho de Cache HTTP padronizado (5 min CDN/Browser + 10 min stale)
    return NextResponse.json(
      {
        instituicao: {
          nome: ministry.name,
          slug: ministry.slug,
          descricao: ministry.description,
          logo_url: ministry.logo_url,
          website: ministry.website,
          telefone: ministry.phone,
          endereco: churchProfile.endereco || null,
          responsavel: churchProfile.responsavel || null,
        },
        tema_anual: planejamentoAtivo
          ? {
              ano: planejamentoAtivo.ano,
              tema: planejamentoAtivo.nome,
              descricao: planejamentoAtivo.descricao,
              publicado_em: planejamentoAtivo.published_at,
            }
          : null,
        palavra_pastor:
          churchProfile?.revista_edicoes?.[String(anoParaEventos)]?.publicada === true
            ? churchProfile.revista_edicoes[String(anoParaEventos)]
            : null,
        departamentos_secao: departamentosSecao,
        mensagem_pastoral: mensagemPastoral,
        ano: anoParaEventos,
        total_eventos: eventosSanitizados.length,
        eventos: eventosSanitizados,
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      }
    );
  } catch (err: any) {
    console.error('[PublicAgendaAPI] Erro inesperado:', err?.message || err);
    return NextResponse.json(
      { error: 'Erro interno ao processar a requisição.' },
      { status: 500 }
    );
  }
}
