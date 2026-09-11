import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-guard';

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const supabaseAdmin = auth.ctx.supabaseAdmin;
    const { searchParams } = new URL(request.url);
    const ministryIdFiltro = searchParams.get('ministry_id');
    const acaoFiltro = searchParams.get('acao');
    const search = searchParams.get('search')?.toLowerCase().trim();
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '200', 10), 1), 1000);

    // 1. Consultar a tabela padrão audit_logs com filtro modulo = 'JURIDICO'
    let query = supabaseAdmin
      .from('audit_logs')
      .select('*')
      .eq('modulo', 'JURIDICO')
      .order('data_criacao', { ascending: false })
      .limit(limit);

    if (ministryIdFiltro) {
      query = query.eq('ministry_id', ministryIdFiltro);
    }

    if (acaoFiltro && acaoFiltro !== 'TODOS') {
      query = query.eq('acao', acaoFiltro);
    }

    let { data: logs, error: logsError } = await query;

    // Fallback de compatibilidade caso os logs antigos usem a coluna created_at
    if (logsError) {
      let fallbackQuery = supabaseAdmin
        .from('audit_logs')
        .select('*')
        .eq('modulo', 'JURIDICO')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (ministryIdFiltro) {
        fallbackQuery = fallbackQuery.eq('ministry_id', ministryIdFiltro);
      }

      const fallbackRes = await fallbackQuery;
      logs = fallbackRes.data;
      logsError = fallbackRes.error;
    }

    if (logsError) {
      throw logsError;
    }

    if (!logs || logs.length === 0) {
      return NextResponse.json({ success: true, total: 0, data: [] });
    }

    // 2. Coletar IDs em lote para resolução eficiente de nomes
    const ministryIds = Array.from(
      new Set(logs.map((l: any) => l.ministry_id).filter((id: string) => id && id !== '00000000-0000-0000-0000-000000000000'))
    );
    const userIds = Array.from(
      new Set(logs.map((l: any) => l.usuario_id || l.user_id).filter((id: string) => id && id !== '00000000-0000-0000-0000-000000000000'))
    );

    // 3. Buscar ministérios em lote
    const mapaMinistries = new Map<string, string>();
    if (ministryIds.length > 0) {
      const { data: minData } = await supabaseAdmin
        .from('ministries')
        .select('id, name')
        .in('id', ministryIds);

      (minData || []).forEach((m: any) => {
        mapaMinistries.set(m.id, m.name || 'Ministério');
      });
    }

    // 4. Buscar perfis de usuários em lote
    const mapaUsuarios = new Map<string, { name: string; email: string | null }>();
    if (userIds.length > 0) {
      const { data: profData } = await supabaseAdmin
        .from('profiles')
        .select('id, email, full_name, nome')
        .in('id', userIds);

      (profData || []).forEach((p: any) => {
        mapaUsuarios.set(p.id, {
          name: p.full_name || p.nome || p.email || 'Usuário',
          email: p.email || null,
        });
      });
    }

    // 5. Montar estrutura formatada
    let resultado = logs.map((log: any) => {
      const userId = log.usuario_id || log.user_id;
      const minName = log.ministry_id ? mapaMinistries.get(log.ministry_id) || 'Ministério Geral / Plataforma' : 'Plataforma';
      const usrObj = userId ? mapaUsuarios.get(userId) : null;
      const detalhes = log.detalhes || log.dados_novos || log.descricao || {};

      return {
        id: log.id,
        acao: log.acao || log.action || 'EVENTO_JURIDICO',
        modulo: log.modulo || 'JURIDICO',
        tabela_afetada: log.tabela_afetada || 'documentos_juridicos',
        registro_id: log.registro_id || log.resource_id || null,
        ministry_id: log.ministry_id || null,
        ministry_name: minName,
        usuario_id: userId || null,
        usuario_nome: usrObj?.name || log.usuario_email || 'Sistema / Administrador',
        usuario_email: usrObj?.email || log.usuario_email || null,
        detalhes: detalhes,
        ip_address: log.ip_address || detalhes?.ip_address || null,
        user_agent: log.user_agent || detalhes?.user_agent || null,
        data_criacao: log.data_criacao || log.created_at || new Date().toISOString(),
      };
    });

    if (search) {
      resultado = resultado.filter(
        (item) =>
          item.acao.toLowerCase().includes(search) ||
          item.ministry_name.toLowerCase().includes(search) ||
          item.usuario_nome.toLowerCase().includes(search) ||
          (item.usuario_email && item.usuario_email.toLowerCase().includes(search))
      );
    }

    return NextResponse.json({
      success: true,
      total: resultado.length,
      data: resultado,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Erro ao consultar histórico de auditoria jurídica.' },
      { status: 400 }
    );
  }
}
