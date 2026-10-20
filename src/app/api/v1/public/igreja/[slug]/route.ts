import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/public/igreja/[slug]
 * 
 * Retorna dados públicos consolidados do ministério/igreja para o App do Membro Simplificado:
 * - Informações da instituição (nome, slug, logo, telefone, email, endereço, website, descrição)
 * - Próximos cultos da semana/mês
 * - Eventos públicos abertos
 * - Comunicados e avisos públicos vigentes
 * - Canais de mídia configurados (ao vivo, rádio gospel)
 * - Congregações ativas para filtro e localização
 * 
 * SEGURANÇA:
 * - Apenas dados com visibilidade pública.
 * - Zero dados pessoais de membros, finanças ou documentos internos.
 * - Isolamento estrito por tenant via slug único.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    if (!slug || typeof slug !== 'string' || !slug.trim()) {
      return NextResponse.json({ error: 'Slug da igreja não fornecido.' }, { status: 400 });
    }

    const cleanSlug = slug.trim().toLowerCase();
    const admin = createServerClient();

    // 1. Resolver o ministério pelo slug único
    const { data: ministry, error: ministryErr } = await admin
      .from('ministries')
      .select('id, name, slug, description, logo_url, website, phone, email_admin, is_active')
      .eq('slug', cleanSlug)
      .maybeSingle();

    if (ministryErr || !ministry || ministry.is_active === false) {
      return NextResponse.json(
        { error: 'Igreja não encontrada ou link inativo.', code: 'CHURCH_NOT_FOUND' },
        { status: 404 }
      );
    }

    const ministryId = ministry.id;

    // 2. Buscar perfil complementar da igreja em configurations (dados institucionais públicos)
    const { data: configRow } = await admin
      .from('configurations')
      .select('church_profile')
      .eq('ministry_id', ministryId)
      .maybeSingle();

    const churchProfile = (configRow?.church_profile as Record<string, any>) || {};

    const info = {
      id: ministry.id,
      slug: ministry.slug,
      nome: churchProfile.nome || ministry.name || 'Igreja',
      descricao: churchProfile.descricao || ministry.description || '',
      logo: churchProfile.logo || ministry.logo_url || null,
      telefone: churchProfile.telefone || ministry.phone || '',
      email: churchProfile.email || ministry.email_admin || '',
      website: churchProfile.website || ministry.website || '',
      endereco: churchProfile.endereco || '',
      cidade: churchProfile.cidade || '',
      estado: churchProfile.estado || '',
      cep: churchProfile.cep || '',
      responsavel: churchProfile.responsavel || '',
    };

    // 3. Buscar Congregações ativas do ministério
    const { data: congregacoesRows } = await admin
      .from('congregacoes')
      .select('id, nome, endereco, cidade, uf, cep, telefone, email')
      .eq('ministry_id', ministryId)
      .eq('ativo', true)
      .order('nome');

    // 4. Buscar Próximos Cultos e Atividades Públicas (agenda_eventos)
    const agora = new Date();
    agora.setHours(0, 0, 0, 0);
    const dataLimiteInferior = agora.toISOString();

    const { data: cultosRows } = await admin
      .from('agenda_eventos')
      .select(`
        id,
        titulo,
        descricao,
        tipo,
        data_inicio,
        data_fim,
        local,
        recorrente,
        status,
        visibilidade,
        agenda_tipos ( id, nome, categoria, cor, icone ),
        congregacoes ( id, nome )
      `)
      .eq('ministry_id', ministryId)
      .in('visibilidade', ['publico', 'igreja', 'ministerio'])
      .neq('status', 'cancelado')
      .gte('data_inicio', dataLimiteInferior)
      .order('data_inicio', { ascending: true })
      .limit(10);

    // 5. Buscar Eventos Públicos Abertos (eventos)
    const { data: eventosRows } = await admin
      .from('eventos')
      .select(`
        id,
        titulo,
        descricao,
        tipo,
        data_inicio,
        data_fim,
        local_nome,
        local_endereco,
        capacidade,
        valor_inscricao,
        aceita_inscricao,
        slug
      `)
      .eq('ministry_id', ministryId)
      .eq('is_publico', true)
      .in('status', ['programado', 'em_andamento', 'aberto'])
      .gte('data_fim', dataLimiteInferior)
      .order('data_inicio', { ascending: true })
      .limit(6);

    // 6. Buscar Comunicados e Avisos Públicos Vigentes
    const agoraIso = new Date().toISOString();
    const { data: comunicadosRows } = await admin
      .from('secretaria_comunicados')
      .select(`
        id,
        titulo,
        conteudo,
        categoria,
        imagem_url,
        fixado,
        publicado_em,
        departamentos ( id, nome, sigla )
      `)
      .eq('ministry_id', ministryId)
      .eq('ativo', true)
      .lte('publicado_em', agoraIso)
      .or(`expira_em.is.null,expira_em.gte.${agoraIso}`)
      .order('fixado', { ascending: false })
      .order('publicado_em', { ascending: false })
      .limit(6);

    // 7. Buscar Configurações de Mídia (ao vivo / rádio)
    const { data: midiaConfig } = await admin
      .from('midia_configuracoes')
      .select('aovivo_habilitado, aovivo_url, aovivo_plataforma, aovivo_titulo, radio_habilitada, radio_stream_url, radio_nome')
      .eq('ministry_id', ministryId)
      .maybeSingle();

    return NextResponse.json({
      igreja: info,
      congregacoes: congregacoesRows || [],
      cultos: cultosRows || [],
      eventos: eventosRows || [],
      comunicados: comunicadosRows || [],
      midia: midiaConfig || null,
    });
  } catch (error) {
    console.error('Erro em GET /api/v1/public/igreja/[slug]:', error);
    return NextResponse.json(
      { error: 'Erro interno ao processar dados da igreja.' },
      { status: 500 }
    );
  }
}
