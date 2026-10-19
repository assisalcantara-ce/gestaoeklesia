import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { isFeatureAllowedForTenant } from '@/lib/plan-permissions';
import { avaliarStatusInscricao } from '@/lib/evento-status-utils';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  if (!slug || typeof slug !== 'string') {
    return NextResponse.json({ error: 'Slug inválido.' }, { status: 400 });
  }

  const admin = createServerClient();

  // Buscar evento público pelo slug
  const { data: evento, error } = await admin
    .from('eventos')
    .select('id, titulo, descricao, tipo, data_inicio, data_fim, local_nome, local_endereco, capacidade, status, is_publico, aceita_inscricao, valor_inscricao, inclui_brinde, brinde_habilitado, brinde_distribuicao, brinde_quantidade, inclui_certificado, certificado_habilitado, inclui_alimentacao, inclui_hospedagem, vagas_hospedagem, descricao_hospedagem, slug, ministry_id')
    .eq('slug', slug)
    .eq('is_publico', true)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: 'Erro ao buscar evento.' }, { status: 500 });
  }

  if (!evento) {
    return NextResponse.json({ error: 'Evento não encontrado.' }, { status: 404 });
  }

  // Validação da Feature Flag do Módulo de Eventos para o Tenant
  const isAllowed = await isFeatureAllowedForTenant(admin, evento.ministry_id, 'events_module');
  if (!isAllowed) {
    return NextResponse.json({ error: 'Módulo de Eventos indisponível neste ministério.' }, { status: 403 });
  }

  // Contar inscrições confirmadas e aguardando pagamento para controle de ocupação
  const { count: inscritosConfirmados } = await admin
    .from('eventos_inscricoes')
    .select('id', { count: 'exact', head: true })
    .eq('evento_id', evento.id)
    .eq('status', 'confirmado');

  const { count: inscritosAguardando } = await admin
    .from('eventos_inscricoes')
    .select('id', { count: 'exact', head: true })
    .eq('evento_id', evento.id)
    .eq('status', 'aguardando_pagamento');

  const { count: listaEspera } = await admin
    .from('eventos_inscricoes')
    .select('id', { count: 'exact', head: true })
    .eq('evento_id', evento.id)
    .eq('status', 'lista_espera');

  const confirmados = inscritosConfirmados ?? 0;
  const aguardando = inscritosAguardando ?? 0;
  const espera = listaEspera ?? 0;
  const ocupacaoTotal = confirmados + aguardando;

  const vagas_restantes = evento.capacidade != null
    ? Math.max(0, evento.capacidade - ocupacaoTotal)
    : null;

  // Avaliação determinística do status de inscrição no fuso de Brasília
  const statusInfo = avaliarStatusInscricao({
    status: evento.status,
    aceita_inscricao: evento.aceita_inscricao,
    data_inicio: evento.data_inicio,
    data_fim: evento.data_fim,
    capacidade: evento.capacidade,
    inscritos_confirmados: confirmados,
    aguardando_pagamento: aguardando,
  });

  return NextResponse.json({
    id: evento.id,
    slug: evento.slug,
    titulo: evento.titulo,
    descricao: evento.descricao,
    tipo: evento.tipo,
    data_inicio: evento.data_inicio,
    data_fim: evento.data_fim,
    local_nome: evento.local_nome,
    local_endereco: evento.local_endereco,
    capacidade: evento.capacidade,
    status: evento.status,
    is_publico: evento.is_publico,
    aceita_inscricao: evento.aceita_inscricao,
    status_inscricao: statusInfo.status_inscricao,
    permite_inscricao: statusInfo.permite_inscricao,
    is_lista_espera: statusInfo.is_lista_espera,
    motivo_bloqueio: statusInfo.motivo_bloqueio,
    descricao_status: statusInfo.descricao_status,
    valor_inscricao: evento.valor_inscricao,
    inclui_brinde: Boolean(evento.inclui_brinde ?? evento.brinde_habilitado),
    brinde_distribuicao: evento.brinde_distribuicao ?? 'todos',
    brinde_quantidade: evento.brinde_quantidade,
    inclui_certificado: Boolean(evento.inclui_certificado ?? evento.certificado_habilitado),
    inclui_alimentacao: Boolean(evento.inclui_alimentacao),
    inclui_hospedagem: Boolean(evento.inclui_hospedagem),
    inscritos_confirmados: confirmados,
    inscritos_aguardando: aguardando,
    lista_espera: espera,
    vagas_restantes,
    lotado: statusInfo.status_inscricao === 'lotado',
  });
}

