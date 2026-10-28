import { NextRequest, NextResponse } from 'next/server';
import { resolveTenantAuth } from '@/lib/tenant-auth';
import { isFeatureAllowedForTenant } from '@/lib/plan-permissions';
import {
  gerarRelatorioGerencialEventoPDF,
  DadosRelatorioEvento,
  ParticipanteRelatorioEvento,
  ConsolidacaoCongregacao,
} from '@/lib/eventos-relatorio-pdf';
import { formatarStatusLegivel } from '@/lib/evento-duplicidade-utils';

export const dynamic = 'force-dynamic';

const EVENTOS_RESTRICTED_RESPONSE = {
  error: 'O Módulo de Eventos está disponível no seu plano.',
  code: 'PLAN_RESTRICTED',
  required_plan: 'starter',
} as const;

function fmtDataBr(dataStr?: string | null): string {
  if (!dataStr) return '—';
  const d = new Date(dataStr);
  if (isNaN(d.getTime())) return dataStr;
  return d.toLocaleDateString('pt-BR');
}

function fmtHoraBr(dataStr?: string | null): string {
  if (!dataStr) return '';
  const d = new Date(dataStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id: eventoId } = await props.params;
    const ctx = await resolveTenantAuth(request);

    if (!ctx.ministryId) {
      return NextResponse.json(
        { error: 'Usuário sem ministério associado.', code: 'NO_MINISTRY' },
        { status: 403 }
      );
    }

    const isAllowed = await isFeatureAllowedForTenant(ctx.admin, ctx.ministryId, 'events_module');
    if (!isAllowed) {
      return NextResponse.json(EVENTOS_RESTRICTED_RESPONSE, { status: 403 });
    }

    if (!eventoId || typeof eventoId !== 'string') {
      return NextResponse.json({ error: 'ID do evento é obrigatório.' }, { status: 400 });
    }

    // ─── 1. Buscar Dados do Evento e Congregação ───────────────────────────────
    const { data: evento, error: evErr } = await ctx.admin
      .from('eventos')
      .select(`
        id,
        titulo,
        tipo,
        status,
        data_inicio,
        data_fim,
        local_nome,
        local_endereco,
        capacidade,
        evento_pago,
        valor_inscricao,
        formas_pagamento,
        inclui_alimentacao,
        inclui_hospedagem,
        descricao_hospedagem,
        inclui_brinde,
        brinde_habilitado,
        brinde_quantidade,
        inclui_certificado,
        certificado_habilitado,
        congregacao_id,
        congregacoes ( id, nome )
      `)
      .eq('id', eventoId)
      .eq('ministry_id', ctx.ministryId)
      .maybeSingle();

    if (evErr || !evento) {
      return NextResponse.json({ error: 'Evento não encontrado neste ministério.' }, { status: 404 });
    }

    // ─── 2. Buscar Dados Institucionais do Tenant ─────────────────────────────
    const { data: ministry } = await ctx.admin
      .from('ministries')
      .select('id, name, cnpj_cpf, address_city, address_state, responsible_name, logo_url')
      .eq('id', ctx.ministryId)
      .maybeSingle();

    const { data: configRow } = await ctx.admin
      .from('configurations')
      .select('church_profile')
      .eq('ministry_id', ctx.ministryId)
      .maybeSingle();

    const churchProfile = (configRow?.church_profile as any) || {};
    const nomeMinisterio = churchProfile.nome_igreja || ministry?.name || 'Gestão Eklésia';
    const subtituloMinisterio = churchProfile.slogan || 'DIRETORIA E SECRETARIA GERAL • PRESTAÇÃO DE CONTAS';
    const cnpjMinisterio = churchProfile.cnpj || ministry?.cnpj_cpf || null;
    const cidadeUf = [churchProfile.cidade || ministry?.address_city, churchProfile.estado || ministry?.address_state]
      .filter(Boolean)
      .join(' - ') || null;
    const logoUrl = churchProfile.logo_url || ministry?.logo_url || null;

    // ─── 3. Buscar TODAS as Inscrições do Evento com Dados de Membro e Congregação ───
    const { data: inscricoesRaw, error: inscErr } = await ctx.admin
      .from('eventos_inscricoes')
      .select(`
        id,
        evento_id,
        member_id,
        nome_externo,
        email_externo,
        telefone,
        status,
        presente,
        checkin_em,
        com_hospedagem,
        status_hospedagem,
        tem_brinde,
        brinde_entregue,
        certificado_emitido,
        observacoes,
        created_at,
        members (
          id,
          name,
          congregacao_id,
          congregacoes ( id, nome )
        )
      `)
      .eq('evento_id', evento.id)
      .eq('ministry_id', ctx.ministryId)
      .order('created_at', { ascending: true });

    if (inscErr) {
      return NextResponse.json({ error: 'Erro ao consultar inscrições do evento.', detail: inscErr.message }, { status: 500 });
    }

    const inscricoes = inscricoesRaw || [];

    // Buscar lista de congregações para desnormalizar nomes nas observações
    const { data: todasCongs } = await ctx.admin
      .from('congregacoes')
      .select('id, nome')
      .eq('ministry_id', ctx.ministryId);

    const congsMap = new Map((todasCongs || []).map((c: any) => [c.id, c.nome]));

    // ─── 4. Processamento dos Indicadores e Participantes ─────────────────────
    let totalConfirmados = 0;
    let totalPresentes = 0;
    let totalCancelados = 0;
    let totalListaEspera = 0;
    let totalAguardandoPagamento = 0;
    let membrosQtd = 0;
    let externosQtd = 0;
    let brindesEntregues = 0;
    let certificadosEmitidos = 0;
    let totalHospedagemSolicitada = 0;
    let totalHospedagemConfirmada = 0;

    const congregacaoStats: Record<string, { total: number; confirmados: number; presentes: number; ausentes: number }> = {};

    const participantesFormatados: ParticipanteRelatorioEvento[] = inscricoes.map((i: any, idx: number) => {
      const isMembro = Boolean(i.member_id);
      if (isMembro) membrosQtd++;
      else externosQtd++;

      const nomeFinal = isMembro
        ? i.members?.name || i.nome_externo || 'Membro da Igreja'
        : i.nome_externo || 'Participante Externo';

      // Extração de Congregação
      let congNome = 'Não informada';
      if (i.observacoes) {
        const match = i.observacoes.match(/Congregação:\s*([^|]+)/i);
        if (match && match[1]) {
          const achada = (todasCongs || []).find((c: any) => c.id === match[1].trim() || c.nome.toLowerCase() === match[1].trim().toLowerCase());
          congNome = achada ? achada.nome : match[1].trim();
        }
      }
      if (congNome === 'Não informada' && i.members?.congregacoes?.nome) {
        congNome = i.members.congregacoes.nome;
      } else if (congNome === 'Não informada' && i.members?.congregacao_id && congsMap.has(i.members.congregacao_id)) {
        congNome = congsMap.get(i.members.congregacao_id)!;
      }

      // Status e contagens
      const st = i.status as string;
      const presente = Boolean(i.presente);

      if (st === 'confirmado') totalConfirmados++;
      else if (st === 'cancelado') totalCancelados++;
      else if (st === 'lista_espera') totalListaEspera++;
      else if (st === 'aguardando_pagamento') totalAguardandoPagamento++;

      if (presente) totalPresentes++;

      if (i.brinde_entregue) brindesEntregues++;
      if (i.certificado_emitido) certificadosEmitidos++;
      if (i.com_hospedagem) {
        totalHospedagemSolicitada++;
        if (i.status_hospedagem === 'confirmada' || presente) totalHospedagemConfirmada++;
      }

      // Consolidação por congregação
      if (!congregacaoStats[congNome]) {
        congregacaoStats[congNome] = { total: 0, confirmados: 0, presentes: 0, ausentes: 0 };
      }
      congregacaoStats[congNome].total++;
      if (st === 'confirmado') {
        congregacaoStats[congNome].confirmados++;
        if (presente) congregacaoStats[congNome].presentes++;
        else congregacaoStats[congNome].ausentes++;
      }

      return {
        numero: idx + 1,
        nome: nomeFinal,
        tipoParticipante: isMembro ? 'Membro' : 'Externo',
        congregacao: congNome,
        situacaoInscricao: formatarStatusLegivel(st),
        presenca: presente ? 'Presente' : 'Ausente',
        horarioCheckin: i.checkin_em ? fmtHoraBr(i.checkin_em) : null,
        comHospedagem: Boolean(i.com_hospedagem),
      };
    });

    const totalInscricoesValidas = totalConfirmados + totalAguardandoPagamento;
    const totalAusentes = Math.max(0, totalConfirmados - totalPresentes);

    const taxaComparecimento = totalConfirmados > 0
      ? `${Math.round((totalPresentes / totalConfirmados) * 100)}%`
      : '0%';

    const totalDemandas = totalInscricoesValidas + totalCancelados;
    const taxaCancelamento = totalDemandas > 0
      ? `${Math.round((totalCancelados / totalDemandas) * 100)}%`
      : '0%';

    // Montar consolidação de congregações
    const consolidacaoCongregacoes: ConsolidacaoCongregacao[] = Object.entries(congregacaoStats).map(([cong, st]) => {
      const taxa = st.confirmados > 0 ? `${Math.round((st.presentes / st.confirmados) * 100)}%` : '—';
      return {
        congregacao: cong,
        totalInscritos: st.total,
        confirmados: st.confirmados,
        presentes: st.presentes,
        ausentes: st.ausentes,
        taxaPresenca: taxa,
      };
    }).sort((a, b) => b.totalInscritos - a.totalInscritos);

    // ─── 5. Conciliação Financeira Real ───────────────────────────────────────
    const isPago = Boolean(evento.evento_pago || (evento.valor_inscricao && Number(evento.valor_inscricao) > 0));
    const valorUnitario = isPago ? Number(evento.valor_inscricao || 0) : 0;

    let totalPrevisto = 0;
    let totalRecebido = 0;
    let totalPendente = 0;
    let totalCanceladoEstornado = 0;
    const formasPagamentoMap: Record<string, { qtd: number; valorTotal: number }> = {};

    if (isPago) {
      // Buscar todos os registros reais em eventos_pagamentos
      const { data: pagamentosRaw } = await ctx.admin
        .from('eventos_pagamentos')
        .select('id, valor, status, payment_method, gateway, paid_at, expires_at')
        .eq('evento_id', evento.id)
        .eq('ministry_id', ctx.ministryId);

      const pagamentos = pagamentosRaw || [];

      // Valor previsto baseado em inscrições válidas
      totalPrevisto = totalInscricoesValidas * valorUnitario;

      for (const p of pagamentos) {
        const v = Number(p.valor || 0);
        const st = String(p.status || '').toLowerCase();
        const forma = (p.payment_method || p.gateway || 'Outro').toUpperCase();

        if (st === 'pago') {
          totalRecebido += v;
          if (!formasPagamentoMap[forma]) formasPagamentoMap[forma] = { qtd: 0, valorTotal: 0 };
          formasPagamentoMap[forma].qtd++;
          formasPagamentoMap[forma].valorTotal += v;
        } else if (st === 'pendente') {
          totalPendente += v;
        } else if (st === 'cancelado' || st === 'expirado' || st === 'estornado') {
          totalCanceladoEstornado += v;
        }
      }
    }

    const formasPagamentoArray = Object.entries(formasPagamentoMap).map(([forma, item]) => ({
      forma,
      qtd: item.qtd,
      valorTotal: item.valorTotal,
    }));

    // ─── 6. Gerar PDF ─────────────────────────────────────────────────────────
    const dadosParaPdf: DadosRelatorioEvento = {
      eventoId: evento.id,
      tituloEvento: evento.titulo || 'Evento Oficial',
      tipoEvento: (evento.tipo || 'Evento').toUpperCase(),
      dataInicio: fmtDataBr(evento.data_inicio),
      dataFim: evento.data_fim ? fmtDataBr(evento.data_fim) : null,
      horarioInicio: fmtHoraBr(evento.data_inicio),
      localNome: evento.local_nome || null,
      localEndereco: evento.local_endereco || null,
      nomeCongregacao: (evento.congregacoes as any)?.nome || 'Templo Central / Sede',
      statusEvento: (evento.status || 'programado').toUpperCase(),
      capacidade: evento.capacidade || null,

      totalInscricoesValidas,
      totalConfirmados,
      totalPresentes,
      totalAusentes,
      totalCancelados,
      totalListaEspera,
      taxaComparecimento,
      taxaCancelamento,
      membrosQtd,
      externosQtd,

      consolidacaoCongregacoes,

      financeiro: {
        eventoPago: isPago,
        valorInscricao: valorUnitario,
        totalInscricoesValidas,
        totalPrevisto,
        totalRecebido,
        totalPendente,
        totalCanceladoEstornado,
        formasPagamento: formasPagamentoArray,
      },

      beneficios: {
        hospedagemHabilitada: Boolean(evento.inclui_hospedagem),
        hospedagemDescricao: evento.descricao_hospedagem || null,
        totalHospedagemSolicitada,
        totalHospedagemConfirmada,
        alimentacaoInclusa: Boolean(evento.inclui_alimentacao),
        brindeHabilitado: Boolean(evento.brinde_habilitado || evento.inclui_brinde),
        brindeQuantidade: evento.brinde_quantidade || null,
        brindesEntregues,
        certificadoHabilitado: Boolean(evento.certificado_habilitado || evento.inclui_certificado),
        certificadosEmitidos,
      },

      nomeMinisterio,
      subtituloMinisterio,
      cnpjMinisterio,
      cidadeUf,
      logoMinisterioUrl: logoUrl,
      dataEmissao: new Date().toLocaleString('pt-BR'),

      participantes: participantesFormatados,
    };

    const pdfBytes = await gerarRelatorioGerencialEventoPDF(dadosParaPdf);
    const idCurto = evento.id.slice(0, 8);
    const dataRef = evento.data_inicio ? evento.data_inicio.slice(0, 10) : 'evento';
    const filename = `Relatorio_Evento_${dataRef}_${idCurto}.pdf`;

    return new NextResponse(pdfBytes as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
      },
    });
  } catch (err: any) {
    console.error('[GET /api/v1/eventos/[id]/relatorio/pdf] Exceção:', err);
    return NextResponse.json(
      { error: 'Erro interno ao gerar relatório gerencial do evento.', detail: err?.message },
      { status: 500 }
    );
  }
}
