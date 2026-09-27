import { NextRequest, NextResponse } from 'next/server';
import { resolveTenantAuth } from '@/lib/tenant-auth';
import { isFeatureAllowedForTenant } from '@/lib/plan-permissions';
import {
  generateSecureEbdToken,
  hashEbdToken,
  calculateExpirationDate,
  formatWhatsappChamadaMessage,
} from '@/lib/ebd-chamada-token';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const ctx = await resolveTenantAuth(request);

    if (!ctx.ministryId) {
      return NextResponse.json(
        { error: 'Usuário sem ministério associado.', code: 'NO_MINISTRY' },
        { status: 403 }
      );
    }

    // Validação da Feature Flag do Módulo EBD
    const isAllowed = await isFeatureAllowedForTenant(ctx.admin, ctx.ministryId, 'ebd_module');
    if (!isAllowed) {
      return NextResponse.json(
        {
          error: 'A Escola Bíblica Dominical está disponível a partir do Plano Starter.',
          code: 'PLAN_RESTRICTED',
        },
        { status: 403 }
      );
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Body JSON inválido.' }, { status: 400 });
    }

    const { turma_id, data_aula, professor_id } = body || {};

    if (!turma_id || typeof turma_id !== 'string') {
      return NextResponse.json({ error: 'turma_id é obrigatório.' }, { status: 400 });
    }

    if (!data_aula || typeof data_aula !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data_aula)) {
      return NextResponse.json(
        { error: 'data_aula é obrigatória e deve estar no formato AAAA-MM-DD.' },
        { status: 400 }
      );
    }

    // 1. Validar que a turma pertence ao tenant e congregação do usuário
    let turmaQuery = ctx.admin
      .from('ebd_turmas')
      .select(`
        id,
        nome,
        church_id,
        ministry_id,
        professor_titular_id,
        ebd_classes ( id, nome ),
        ebd_professores ( id, nome, telefone )
      `)
      .eq('id', turma_id)
      .eq('ministry_id', ctx.ministryId);

    if (ctx.congregacaoId) {
      turmaQuery = turmaQuery.eq('church_id', ctx.congregacaoId);
    }

    const { data: turma, error: turmaErr } = await turmaQuery.maybeSingle();

    if (turmaErr || !turma) {
      return NextResponse.json(
        { error: 'Turma não encontrada ou sem permissão de acesso.' },
        { status: 404 }
      );
    }

    // 2. Validar professor, se informado
    let profSelecionado: { id: string; nome: string; telefone: string | null } | null = null;
    const targetProfId = professor_id || turma.professor_titular_id;

    if (targetProfId) {
      const { data: prof } = await ctx.admin
        .from('ebd_professores')
        .select('id, nome, telefone')
        .eq('id', targetProfId)
        .eq('ministry_id', ctx.ministryId)
        .maybeSingle();

      if (prof) {
        profSelecionado = prof;
      }
    }

    // 3. Revogar token anterior da mesma turma e data, se existir
    await ctx.admin
      .from('ebd_chamada_tokens')
      .update({ status: 'revogado' })
      .eq('turma_id', turma.id)
      .eq('data_aula', data_aula)
      .eq('status', 'ativo');

    // 4. Gerar novo token seguro e hash SHA-256
    const rawToken = generateSecureEbdToken();
    const tokenHash = hashEbdToken(rawToken);
    const expiresAt = calculateExpirationDate(data_aula);

    // 5. Inserir registro na tabela ebd_chamada_tokens (upsert por turma_id, data_aula)
    const { error: insertErr } = await ctx.admin
      .from('ebd_chamada_tokens')
      .upsert(
        {
          ministry_id: ctx.ministryId,
          church_id: turma.church_id,
          turma_id: turma.id,
          professor_id: profSelecionado?.id || null,
          data_aula,
          token_hash: tokenHash,
          status: 'ativo',
          expires_at: expiresAt,
          finalizado_em: null,
          created_by: ctx.userId,
        },
        { onConflict: 'turma_id,data_aula' }
      );

    if (insertErr) {
      return NextResponse.json(
        { error: 'Erro ao gerar link de chamada.', detail: insertErr.message },
        { status: 500 }
      );
    }

    // 6. Montar URL pública e mensagem de WhatsApp
    const origin =
      request.nextUrl.origin ||
      process.env.NEXT_PUBLIC_APP_URL ||
      'https://gestaoeklesia.com';
    const publicUrl = `${origin}/ebd/chamada-rapida/${rawToken}`;

    const classeNome = (turma.ebd_classes as any)?.nome || null;
    const whatsappMessage = formatWhatsappChamadaMessage({
      professorNome: profSelecionado?.nome || null,
      turmaNome: turma.nome,
      classeNome,
      dataAula: data_aula,
      url: publicUrl,
    });

    const phoneRaw = profSelecionado?.telefone?.replace(/\D/g, '') || '';
    const whatsappUrl = phoneRaw
      ? `https://wa.me/55${phoneRaw}?text=${encodeURIComponent(whatsappMessage)}`
      : null;

    return NextResponse.json({
      success: true,
      token: rawToken,
      url: publicUrl,
      expires_at: expiresAt,
      turma: {
        id: turma.id,
        nome: turma.nome,
        classe: classeNome,
      },
      professor: profSelecionado
        ? { id: profSelecionado.id, nome: profSelecionado.nome, telefone: profSelecionado.telefone }
        : null,
      whatsapp_message: whatsappMessage,
      whatsapp_url: whatsappUrl,
    });
  } catch (err: any) {
    if (err?.message === 'UNAUTHORIZED') {
      return NextResponse.json(
        { error: 'Não autorizado. Faça login novamente.', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }
    if (err?.message === 'NO_MINISTRY') {
      return NextResponse.json(
        { error: 'Usuário sem ministério associado.', code: 'NO_MINISTRY' },
        { status: 403 }
      );
    }
    return NextResponse.json(
      { error: err?.message || 'Erro interno no servidor.' },
      { status: 500 }
    );
  }
}
