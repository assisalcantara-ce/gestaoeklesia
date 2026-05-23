import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

function sanitize(v: unknown): string {
  return typeof v === 'string' ? v.trim().slice(0, 500) : '';
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 });
  }

  const slug = sanitize(body.slug);
  const nome = sanitize(body.nome);
  const email = sanitize(body.email).toLowerCase();
  const telefone = sanitize(body.telefone);
  const igreja = sanitize(body.igreja);
  const cidade = sanitize(body.cidade);

  // Validações básicas
  if (!slug) return NextResponse.json({ error: 'Slug do evento é obrigatório.' }, { status: 400 });
  if (!nome) return NextResponse.json({ error: 'Nome é obrigatório.' }, { status: 400 });
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'E-mail inválido.' }, { status: 400 });
  }
  if (!telefone) return NextResponse.json({ error: 'Telefone é obrigatório.' }, { status: 400 });

  const admin = createServerClient();

  // Buscar evento público
  const { data: evento, error: evErr } = await admin
    .from('eventos')
    .select('id, titulo, ministry_id, status, is_publico, aceita_inscricao, capacidade, data_inicio')
    .eq('slug', slug)
    .maybeSingle();

  if (evErr || !evento) {
    return NextResponse.json({ error: 'Evento não encontrado.' }, { status: 404 });
  }

  // Validações de negócio
  if (!evento.is_publico) {
    // Retorna 404 (não 403) para não revelar que o slug existe mas é privado
    return NextResponse.json({ error: 'Evento não encontrado.' }, { status: 404 });
  }
  if (!evento.aceita_inscricao) {
    return NextResponse.json({ error: 'Este evento não está aceitando inscrições no momento.' }, { status: 409 });
  }
  if (evento.status === 'cancelado') {
    return NextResponse.json({ error: 'Este evento foi cancelado.' }, { status: 409 });
  }
  if (evento.status === 'realizado') {
    return NextResponse.json({ error: 'Este evento já foi realizado. Não é possível realizar novas inscrições.' }, { status: 409 });
  }

  // Verificar duplicidade por email
  const { data: jaInscrito } = await admin
    .from('eventos_inscricoes')
    .select('id, status')
    .eq('evento_id', evento.id)
    .eq('email_externo', email)
    .maybeSingle();

  if (jaInscrito) {
    return NextResponse.json({
      error: 'Este e-mail já possui uma inscrição neste evento.',
      inscricao_id: jaInscrito.id,
      status: jaInscrito.status,
    }, { status: 409 });
  }

  // Determinar status da inscrição: confirmado ou lista_espera
  let statusInscricao: 'confirmado' | 'lista_espera' = 'confirmado';
  if (evento.capacidade != null) {
    const { count } = await admin
      .from('eventos_inscricoes')
      .select('id', { count: 'exact', head: true })
      .eq('evento_id', evento.id)
      .eq('status', 'confirmado');

    if ((count ?? 0) >= evento.capacidade) {
      statusInscricao = 'lista_espera';
    }
  }

  // Observações com dados extras (igreja/cidade)
  const obsPartes: string[] = [];
  if (igreja) obsPartes.push(`Igreja: ${igreja}`);
  if (cidade) obsPartes.push(`Cidade: ${cidade}`);
  const observacoes = obsPartes.length > 0 ? obsPartes.join(' | ') : null;

  // Inserir inscrição
  const { data: inscricao, error: insErr } = await admin
    .from('eventos_inscricoes')
    .insert({
      evento_id: evento.id,
      ministry_id: evento.ministry_id,
      member_id: null,
      nome_externo: nome,
      email_externo: email,
      telefone,
      status: statusInscricao,
      observacoes,
      presente: false,
    })
    .select('id, status')
    .single();

  if (insErr || !inscricao) {
    // Conflito de índice único (race condition)
    if (insErr?.code === '23505') {
      return NextResponse.json({ error: 'Este e-mail já possui uma inscrição neste evento.' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Erro ao registrar inscrição. Tente novamente.' }, { status: 500 });
  }

  return NextResponse.json({
    inscricao_id: inscricao.id,
    status: inscricao.status,
    nome,
    evento_titulo: evento.titulo,
    data_inicio: evento.data_inicio,
  }, { status: 201 });
}
