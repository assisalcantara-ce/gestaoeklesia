import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-guard';
import { ContratosRepository } from '@/repositories/ContratosRepository';
import type { TenantContrato } from '@/types/juridico';

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const supabaseAdmin = auth.ctx.supabaseAdmin;
    const { searchParams } = new URL(request.url);
    const statusFiltro = searchParams.get('status');
    const search = searchParams.get('search')?.toLowerCase().trim();

    // 1. Buscar contratos existentes em tenant_contratos usando o ContratosRepository
    const contratosRepo = new ContratosRepository(supabaseAdmin);
    let contratos: TenantContrato[] = await contratosRepo.findAll((builder: any) => {
      let q = builder.order('created_at', { ascending: false });
      if (statusFiltro && statusFiltro !== 'TODOS') {
        q = q.eq('status', statusFiltro);
      }
      return q;
    });

    if (!contratos || contratos.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    // 2. Coletar IDs únicos de ministérios e documentos para resolução eficiente em lote
    const ministryIds = Array.from(new Set(contratos.map((c) => c.ministry_id).filter(Boolean)));
    const docIds = Array.from(new Set(contratos.map((c) => c.documento_base_id).filter(Boolean))) as string[];

    // 3. Buscar ministérios em lote
    const mapaMinistries = new Map<string, { id: string; name: string; cnpj?: string | null; plan?: string | null }>();
    if (ministryIds.length > 0) {
      const { data: ministriesData } = await supabaseAdmin
        .from('ministries')
        .select('id, name, cnpj_cpf, plan')
        .in('id', ministryIds);

      (ministriesData || []).forEach((m: any) => {
        mapaMinistries.set(m.id, {
          id: m.id,
          name: m.name || 'Ministério',
          cnpj: m.cnpj_cpf || null,
          plan: m.plan || null,
        });
      });
    }

    // 4. Buscar documentos base em lote
    const mapaDocs = new Map<string, { id: string; titulo: string; tipo: string; versao: string }>();
    if (docIds.length > 0) {
      const { data: docsData } = await supabaseAdmin
        .from('documentos_juridicos')
        .select('id, titulo, tipo, versao')
        .in('id', docIds);

      (docsData || []).forEach((d: any) => {
        mapaDocs.set(d.id, {
          id: d.id,
          titulo: d.titulo,
          tipo: d.tipo,
          versao: d.versao,
        });
      });
    }

    // 5. Buscar últimos aceites dos ministérios em lote
    const mapaUltimoAceite = new Map<string, {
      id: string;
      versao_aceita: string;
      aceito_em: string;
      user_id: string;
      hash_documento: string;
    }>();

    if (ministryIds.length > 0) {
      const { data: aceitesData } = await supabaseAdmin
        .from('tenant_aceites')
        .select('id, ministry_id, documento_id, versao_aceita, aceito_em, user_id, hash_documento')
        .in('ministry_id', ministryIds)
        .order('aceito_em', { ascending: false });

      (aceitesData || []).forEach((a: any) => {
        if (!mapaUltimoAceite.has(a.ministry_id)) {
          mapaUltimoAceite.set(a.ministry_id, {
            id: a.id,
            versao_aceita: a.versao_aceita,
            aceito_em: a.aceito_em,
            user_id: a.user_id,
            hash_documento: a.hash_documento,
          });
        }
      });
    }

    // 6. Montar estrutura combinada com todos os atributos requeridos
    let resultado = contratos.map((c) => {
      const min = mapaMinistries.get(c.ministry_id);
      const doc = c.documento_base_id ? mapaDocs.get(c.documento_base_id) : null;
      const ultimoAceite = mapaUltimoAceite.get(c.ministry_id) || null;

      return {
        contrato_id: c.id,
        id: c.id,
        ministry_id: c.ministry_id,
        nome_ministrio: min?.name || 'Ministério Não Identificado',
        ministry_name: min?.name || 'Ministério Não Identificado',
        cnpj: min?.cnpj || null,
        plano_contratado: c.plano_contratado || min?.plan || 'Starter',
        valor_mensal: c.valor_mensal !== undefined ? c.valor_mensal : null,
        documento_base_id: c.documento_base_id || null,
        documento_base_titulo: doc?.titulo || 'Contrato de Prestação de Serviços',
        documento_base_tipo: doc?.tipo || 'CONTRATO_SERVICO',
        versao_documento: c.versao_documento || doc?.versao || '1.0',
        status: c.status,
        origem_snapshot: c.origem_snapshot || 'CELEBRACAO_ORIGINAL',
        snapshot_status: c.snapshot_status || 'INTEGRO_IMUTAVEL',
        integridade_verificada: c.integridade_verificada !== undefined ? c.integridade_verificada : true,
        numero_contrato: c.numero_contrato || null,
        data_inicio: c.data_inicio,
        data_fim: c.data_fim || null,
        assinado_em: c.assinado_em || (ultimoAceite ? ultimoAceite.aceito_em : null),
        assinado_por: (c.assinado_em ? c.assinado_por : null) || (ultimoAceite ? ultimoAceite.user_id : null),
        created_at: c.created_at,
        updated_at: c.updated_at,
        ultimo_aceite: ultimoAceite,
      };
    });

    if (search) {
      resultado = resultado.filter(
        (item) =>
          item.nome_ministrio.toLowerCase().includes(search) ||
          (item.cnpj && item.cnpj.includes(search)) ||
          (item.numero_contrato && item.numero_contrato.toLowerCase().includes(search)) ||
          (item.plano_contratado && item.plano_contratado.toLowerCase().includes(search))
      );
    }

    return NextResponse.json({
      success: true,
      total: resultado.length,
      data: resultado,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Erro ao listar contratos de clientes.' },
      { status: 400 }
    );
  }
}
