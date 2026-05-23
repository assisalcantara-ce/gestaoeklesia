import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

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
    .select('id, titulo, descricao, tipo, data_inicio, data_fim, local_nome, local_endereco, capacidade, status, is_publico, aceita_inscricao, valor_inscricao, slug')
    .eq('slug', slug)
    .eq('is_publico', true)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: 'Erro ao buscar evento.' }, { status: 500 });
  }

  if (!evento) {
    return NextResponse.json({ error: 'Evento não encontrado.' }, { status: 404 });
  }

  // Contar inscrições confirmadas
  const { count: inscritosConfirmados } = await admin
    .from('eventos_inscricoes')
    .select('id', { count: 'exact', head: true })
    .eq('evento_id', evento.id)
    .eq('status', 'confirmado');

  const { count: listaEspera } = await admin
    .from('eventos_inscricoes')
    .select('id', { count: 'exact', head: true })
    .eq('evento_id', evento.id)
    .eq('status', 'lista_espera');

  const confirmados = inscritosConfirmados ?? 0;
  const espera = listaEspera ?? 0;
  const vagas_restantes = evento.capacidade != null
    ? Math.max(0, evento.capacidade - confirmados)
    : null;
  const lotado = evento.capacidade != null && confirmados >= evento.capacidade;

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
    valor_inscricao: evento.valor_inscricao,
    inscritos_confirmados: confirmados,
    lista_espera: espera,
    vagas_restantes,
    lotado,
  });
}
