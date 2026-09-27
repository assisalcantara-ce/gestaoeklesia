import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { hashEbdToken } from '@/lib/ebd-chamada-token';
import { checkRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // 1. Rate Limiting (30 requisições/min por IP)
    const rateCheck = checkRateLimit(request, 30, 60 * 1000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Muitas requisições. Tente novamente em instantes.', code: 'RATE_LIMITED' },
        { status: 429, headers: { 'Retry-After': String(rateCheck.retryAfterSeconds) } }
      );
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Body JSON inválido.' }, { status: 400 });
    }

    const {
      token,
      licao_numero,
      tema,
      observacoes,
      freqs = [],
      visitantes = [],
      valor_oferta,
    } = body || {};

    if (!token || typeof token !== 'string' || token.trim().length < 10) {
      return NextResponse.json(
        { error: 'Token de chamada não informado ou inválido.', code: 'INVALID_TOKEN' },
        { status: 400 }
      );
    }

    const admin = createServerClient();
    const tokenHash = hashEbdToken(token);

    // 2. Validação rigorosa do Token
    const { data: tokenRow, error: tokenErr } = await admin
      .from('ebd_chamada_tokens')
      .select('id, ministry_id, church_id, turma_id, professor_id, data_aula, status, expires_at')
      .eq('token_hash', tokenHash)
      .maybeSingle();

    if (tokenErr || !tokenRow) {
      return NextResponse.json(
        { error: 'Link de chamada não encontrado ou inválido.', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    if (tokenRow.status === 'revogado') {
      return NextResponse.json(
        { error: 'Este link de chamada foi revogado pela secretaria.', code: 'REVOKED' },
        { status: 410 }
      );
    }

    if (tokenRow.status === 'finalizado') {
      return NextResponse.json(
        {
          error: 'Esta chamada já foi finalizada e não pode ser reenviada pelo link.',
          code: 'ALREADY_FINALIZED',
        },
        { status: 409 }
      );
    }

    const now = new Date();
    if (new Date(tokenRow.expires_at) < now) {
      return NextResponse.json(
        { error: 'Este link de chamada expirou.', code: 'EXPIRED' },
        { status: 410 }
      );
    }

    // 3. Validação dos Alunos (Prevenção Anti-Tampering: apenas alunos matriculados na turma do token)
    const { data: matriculasValidas } = await admin
      .from('ebd_matriculas')
      .select('aluno_id')
      .eq('turma_id', tokenRow.turma_id)
      .eq('ministry_id', tokenRow.ministry_id)
      .is('data_fim', null);

    const validAlunoIds = new Set((matriculasValidas || []).map((m) => m.aluno_id));

    const freqsSanitizadas = (Array.isArray(freqs) ? freqs : [])
      .filter((f) => f && typeof f.aluno_id === 'string' && validAlunoIds.has(f.aluno_id))
      .map((f) => ({
        aluno_id: f.aluno_id,
        presente: Boolean(f.presente),
      }));

    // 4. Validação de Visitantes
    const visitantesSanitizados = (Array.isArray(visitantes) ? visitantes : [])
      .filter((v) => v && typeof v.nome === 'string' && v.nome.trim().length >= 2)
      .map((v) => ({
        nome: v.nome.trim().slice(0, 100),
        telefone: v.telefone ? String(v.telefone).trim().slice(0, 20) : null,
      }));

    // 5. Validação de Oferta
    let ofertaNumerica: number | null = null;
    if (valor_oferta !== undefined && valor_oferta !== null && valor_oferta !== '') {
      const parsed = typeof valor_oferta === 'number' ? valor_oferta : parseFloat(String(valor_oferta).replace(',', '.'));
      if (isNaN(parsed) || parsed < 0 || !isFinite(parsed)) {
        return NextResponse.json(
          { error: 'Valor da oferta inválido. Deve ser um número maior ou igual a zero.' },
          { status: 400 }
        );
      }
      ofertaNumerica = parsed;
    }

    // 6. Localizar trimestre letivo vigente
    const { data: trimestres } = await admin
      .from('ebd_trimestres')
      .select('id, numero, ano, data_inicio, data_fim')
      .eq('ministry_id', tokenRow.ministry_id)
      .eq('ativo', true);

    const trimestreVigente = (trimestres || []).find(
      (t) => t.data_inicio <= tokenRow.data_aula && t.data_fim >= tokenRow.data_aula
    );

    const ano = parseInt(tokenRow.data_aula.split('-')[0], 10);
    const numeroTrimestre =
      trimestreVigente?.numero || Math.ceil((new Date(tokenRow.data_aula).getMonth() + 1) / 3);

    const totalPresentes = freqsSanitizadas.filter((f) => f.presente).length;
    const totalVisitantes = visitantesSanitizados.length;

    // 7. Gravação Transacional em ebd_aulas
    const { data: aula, error: aulaErr } = await admin
      .from('ebd_aulas')
      .upsert(
        {
          ministry_id: tokenRow.ministry_id,
          turma_id: tokenRow.turma_id,
          data_aula: tokenRow.data_aula,
          ano,
          trimestre: numeroTrimestre,
          trimestre_id: trimestreVigente?.id || null,
          licao_numero: licao_numero ? parseInt(String(licao_numero), 10) : null,
          tema: tema ? String(tema).trim() : null,
          observacoes: observacoes ? String(observacoes).trim() : null,
          professor_id: tokenRow.professor_id || null,
          status: 'realizada',
          total_presentes: totalPresentes,
          total_visitantes: totalVisitantes,
        },
        { onConflict: 'turma_id,data_aula' }
      )
      .select('id')
      .single();

    if (aulaErr || !aula) {
      return NextResponse.json(
        { error: 'Erro ao registrar dados da aula.', detail: aulaErr?.message },
        { status: 500 }
      );
    }

    // 8. Gravar Frequências (Upsert em batch)
    if (freqsSanitizadas.length > 0) {
      const payloadFreqs = freqsSanitizadas.map((f) => ({
        ministry_id: tokenRow.ministry_id,
        aula_id: aula.id,
        aluno_id: f.aluno_id,
        presente: f.presente,
      }));

      const { error: freqErr } = await admin
        .from('ebd_frequencias')
        .upsert(payloadFreqs, { onConflict: 'aula_id,aluno_id' });

      if (freqErr) {
        return NextResponse.json(
          { error: 'Erro ao registrar frequência dos alunos.', detail: freqErr.message },
          { status: 500 }
        );
      }
    }

    // 9. Gravar Visitantes (limpar e reinserir para idempotência)
    await admin.from('ebd_visitantes_aula').delete().eq('aula_id', aula.id);

    if (visitantesSanitizados.length > 0) {
      const payloadVisitantes = visitantesSanitizados.map((v) => ({
        ministry_id: tokenRow.ministry_id,
        aula_id: aula.id,
        nome: v.nome,
        telefone: v.telefone,
      }));

      const { error: visitErr } = await admin
        .from('ebd_visitantes_aula')
        .insert(payloadVisitantes);

      if (visitErr) {
        return NextResponse.json(
          { error: 'Erro ao registrar visitantes.', detail: visitErr.message },
          { status: 500 }
        );
      }
    }

    // 10. Gravar Oferta da Aula (se informada)
    if (ofertaNumerica != null && ofertaNumerica > 0) {
      const { error: ofErr } = await admin
        .from('ebd_ofertas')
        .upsert(
          {
            ministry_id: tokenRow.ministry_id,
            church_id: tokenRow.church_id,
            aula_id: aula.id,
            data_oferta: tokenRow.data_aula,
            ano,
            trimestre: numeroTrimestre,
            valor: ofertaNumerica,
            forma_pagamento: 'dinheiro',
            destino: 'tesouraria_local',
          },
          { onConflict: 'aula_id' }
        );

      if (ofErr) {
        return NextResponse.json(
          { error: 'Erro ao registrar oferta da turma.', detail: ofErr.message },
          { status: 500 }
        );
      }
    }

    // 11. Marcar Token como FINALIZADO
    const finalizadoEm = new Date().toISOString();
    await admin
      .from('ebd_chamada_tokens')
      .update({
        status: 'finalizado',
        finalizado_em: finalizadoEm,
      })
      .eq('id', tokenRow.id);

    const totalAlunos = validAlunoIds.size;
    const totalAusentes = Math.max(0, totalAlunos - totalPresentes);

    return NextResponse.json({
      success: true,
      message: 'Chamada registrada e finalizada com sucesso!',
      total_alunos: totalAlunos,
      total_presentes: totalPresentes,
      total_ausentes: totalAusentes,
      total_visitantes: totalVisitantes,
      valor_oferta: ofertaNumerica || 0,
      finalizado_em: finalizadoEm,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Erro interno no servidor ao salvar chamada.' },
      { status: 500 }
    );
  }
}
