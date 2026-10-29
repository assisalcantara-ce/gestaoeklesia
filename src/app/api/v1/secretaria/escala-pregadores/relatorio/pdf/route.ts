import { NextRequest, NextResponse } from 'next/server';
import { resolveTenantAuth } from '@/lib/tenant-auth';
import { isFeatureAllowedForTenant } from '@/lib/plan-permissions';
import { EscalaPregadoresService } from '@/services/escala-pregadores-service';
import {
  gerarPdfEscalaPregadores,
  DadosRelatorioEscala,
  ItemRelatorioEscala,
} from '@/lib/escala-pregadores-pdf';
import { formatHoraLocal, getLocalDateStr } from '@/lib/timezone-utils';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const ctx = await resolveTenantAuth(request);
    if (!ctx.ministryId) {
      return NextResponse.json(
        { error: 'Usuário sem ministério associado.', code: 'NO_MINISTRY' },
        { status: 403 }
      );
    }

    const isAllowed = await isFeatureAllowedForTenant(ctx.admin, ctx.ministryId, 'agenda_module');
    if (!isAllowed) {
      return NextResponse.json(
        { error: 'Módulo de Escala de Pregadores indisponível para o plano atual.', code: 'PLAN_RESTRICTED' },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const anoMes = searchParams.get('ano_mes') || undefined;
    const dataInicioIso = searchParams.get('data_inicio') || undefined;
    const dataFimIso = searchParams.get('data_fim') || undefined;
    let churchId = searchParams.get('church_id') || undefined;
    const situacaoFiltroParam = searchParams.get('situacao') || 'todos'; // 'todos' | 'confirmados' | 'escalados' | 'sem_pregador'

    // Restrição para Secretário Local
    const isLocalSecretary = ['secretaria_local', 'admin_local', 'operador'].includes(ctx.nivel);
    if (isLocalSecretary) {
      if (!ctx.congregacaoId) {
        return NextResponse.json(
          { error: 'Secretário local sem congregação vinculada.', code: 'LOCAL_NO_CHURCH' },
          { status: 403 }
        );
      }
      churchId = ctx.congregacaoId;
    }

    // 1. Carregar Dados Institucionais do Tenant
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

    const churchProfile = (configRow as any)?.church_profile || {};
    const nomeMinisterio = churchProfile.church_name || ministry?.name || 'Gestão Eklésia';
    const subtituloMinisterio = churchProfile.church_subtitle || 'Secretaria Geral • Escala Ministerial';
    const cnpjMinisterio = churchProfile.cnpj || ministry?.cnpj_cpf || null;
    const cidadeUf = churchProfile.city && churchProfile.state ? `${churchProfile.city}/${churchProfile.state}` : null;
    const logoUrl = churchProfile.logo_url || ministry?.logo_url || null;

    // 2. Buscar eventos da Agenda Oficial com escalas ativas
    const eventos = await EscalaPregadoresService.listarEventosComEscala(ctx.supabase, {
      ministryId: ctx.ministryId,
      anoMes,
      dataInicioIso,
      dataFimIso,
      churchId,
      apenasSemPregador: situacaoFiltroParam === 'sem_pregador',
    });

    // 3. Filtrar por situação se especificado
    const eventosFiltrados = (eventos as any[]).filter((ev) => {
      const escala = ev.escala;
      const temEscala = Boolean(escala && escala.member);

      if (situacaoFiltroParam === 'confirmados') {
        return temEscala && escala?.status === 'confirmado';
      }
      if (situacaoFiltroParam === 'escalados') {
        return temEscala && escala?.status === 'escalado';
      }
      if (situacaoFiltroParam === 'sem_pregador') {
        return !temEscala;
      }
      return true;
    });

    // 4. Mapear itens para o relatório PDF
    const itens: ItemRelatorioEscala[] = eventosFiltrados.map((ev, index) => {
      const dataStr = getLocalDateStr(ev.data_inicio);
      const horaStr = formatHoraLocal(ev.data_inicio);
      const horaFimStr = formatHoraLocal(ev.data_fim);

      let diaSemana = '';
      if (dataStr) {
        const [ano, mes, dia] = dataStr.split('-');
        const d = new Date(Number(ano), Number(mes) - 1, Number(dia));
        diaSemana = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' }).format(d);
      }

      const escala = ev.escala;
      let situacaoEscala: 'confirmado' | 'escalado' | 'sem_pregador' | 'cancelado' = 'sem_pregador';
      if (ev.status === 'cancelado') {
        situacaoEscala = 'cancelado';
      } else if (escala) {
        situacaoEscala = escala.status;
      }

      const tipoNome = Array.isArray(ev.agenda_tipos)
        ? ev.agenda_tipos[0]?.nome
        : ev.agenda_tipos?.nome || null;

      const congregacaoObj = Array.isArray(ev.congregacoes)
        ? ev.congregacoes[0]
        : ev.congregacoes;

      const congregacaoNome = congregacaoObj?.nome || 'Campo Geral';
      const isSede = Boolean(congregacaoObj?.is_sede);

      return {
        numero: index + 1,
        data: dataStr.split('-').reverse().join('/'),
        horario: horaFimStr ? `${horaStr} às ${horaFimStr}` : horaStr,
        diaSemana: diaSemana.toUpperCase(),
        cultoTitulo: ev.titulo,
        tipoCulto: tipoNome,
        congregacaoNome,
        isSede,
        local: ev.local,
        pregadorNome: escala?.member?.name || '',
        cargoMinisterial: escala?.member?.cargo_ministerial || '',
        situacaoEscala,
        temaMensagem: escala?.tema_mensagem || null,
        textoBiblico: escala?.texto_biblico || null,
      };
    });

    // 5. Determinar nome da congregação no filtro
    let congregacaoFiltroNome = 'Todas as Congregações (Campo Geral)';
    if (churchId) {
      const { data: cong } = await ctx.admin
        .from('congregacoes')
        .select('nome, is_sede')
        .eq('id', churchId)
        .maybeSingle();
      if (cong) {
        congregacaoFiltroNome = `${cong.nome}${cong.is_sede ? ' (Sede)' : ''}`;
      }
    }

    // 6. Texto do Período
    let periodoRef = 'Mês Completo';
    if (anoMes) {
      const [ano, mes] = anoMes.split('-');
      const dataRef = new Date(Number(ano), Number(mes) - 1, 1);
      periodoRef = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(dataRef);
      periodoRef = periodoRef.charAt(0).toUpperCase() + periodoRef.slice(1);
    } else if (dataInicioIso && dataFimIso) {
      periodoRef = `${getLocalDateStr(dataInicioIso).split('-').reverse().join('/')} até ${getLocalDateStr(dataFimIso).split('-').reverse().join('/')}`;
    }

    // Estatísticas consolidadas
    const totalEventos = itens.length;
    const totalConfirmados = itens.filter((i) => i.situacaoEscala === 'confirmado').length;
    const totalEscalados = itens.filter((i) => i.situacaoEscala === 'escalado').length;
    const totalSemPregador = itens.filter((i) => i.situacaoEscala === 'sem_pregador').length;

    const dadosRelatorio: DadosRelatorioEscala = {
      nomeMinisterio,
      subtituloMinisterio,
      cnpjMinisterio,
      cidadeUf,
      logoMinisterioUrl: logoUrl,
      periodoReferencia: periodoRef,
      tipoEscala: dataInicioIso && dataFimIso ? 'Semanal' : 'Mensal',
      congregacaoFiltro: congregacaoFiltroNome,
      situacaoFiltro:
        situacaoFiltroParam === 'confirmados'
          ? 'Apenas Confirmados'
          : situacaoFiltroParam === 'escalados'
          ? 'Apenas Escalados'
          : situacaoFiltroParam === 'sem_pregador'
          ? 'Apenas Sem Pregador'
          : 'Todos os Cultos da Agenda',
      dataEmissao: new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Belem',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date()),
      totalEventos,
      totalEscalados,
      totalConfirmados,
      totalSemPregador,
      itens,
    };

    // 7. Gerar PDF via jsPDF
    const doc = await gerarPdfEscalaPregadores(dadosRelatorio);
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));

    const filename = `escala-pregadores-${anoMes || 'periodo'}.pdf`;

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (err: any) {
    console.error('Erro na geração do PDF da Escala de Pregadores:', err);
    return NextResponse.json(
      { error: err?.message || 'Falha ao processar o relatório PDF da escala de pregadores.' },
      { status: 500 }
    );
  }
}
