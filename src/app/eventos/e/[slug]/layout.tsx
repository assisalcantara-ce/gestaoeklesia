// Server Component — fornece metadata dinâmica para a página pública do evento
// A página em si é 'use client', então os metadados precisam vir do layout.
import type { Metadata } from 'next';
import { createServerClient } from '@/lib/supabase-server';

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params;
  const admin = createServerClient();

  const { data } = await admin
    .from('eventos')
    .select('titulo, descricao, data_inicio, local_nome')
    .eq('slug', slug)
    .eq('is_publico', true)
    .maybeSingle();

  const titulo = data?.titulo ?? 'Evento';
  const descricao = data?.descricao
    ?? (data?.local_nome ? `${titulo} · ${data.local_nome}` : 'Informações e inscrições para este evento.');

  return {
    title: titulo,
    description: descricao.slice(0, 160),
    openGraph: {
      title: titulo,
      description: descricao.slice(0, 160),
      type: 'website',
    },
    twitter: {
      card: 'summary',
      title: titulo,
      description: descricao.slice(0, 160),
    },
  };
}

export default function EventoPublicoLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
