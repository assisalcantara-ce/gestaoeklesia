import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { hashEbdToken } from '@/lib/ebd-chamada-token';
import { checkRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // 1. Rate Limiting de segurança (60 requisições/min por IP)
    const rateCheck = checkRateLimit(request, 60, 60 * 1000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Muitas requisições. Tente novamente em alguns instantes.', code: 'RATE_LIMITED' },
        { status: 429, headers: { 'Retry-After': String(rateCheck.retryAfterSeconds) } }
      );
    }

    const token = request.nextUrl.searchParams.get('token');
    if (!token || typeof token !== 'string' || token.trim().length < 10) {
      return NextResponse.json({ error: 'Token de chamada não informado ou inválido.', code: 'INVALID_TOKEN' }, { status: 400 });
    }

    const admin = createServerClient();
    const tokenHash = hashEbdToken(token);

    // 2. Localizar registro do token pelo hash SHA-256
    const { data: tokenRow, error: tokenErr } = await admin
      .from('ebd_chamada_tokens')
      .select('id, ministry_id, church_id, turma_id, professor_id, data_aula, status, expires_at, finalizado_em')
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
        { error: 'Este link de chamada foi revogado pela secretaria. Solicite um novo link.', code: 'REVOKED' },
        { status: 410 }
      );
    }

    const now = new Date();
    const isExpired = new Date(tokenRow.expires_at) < now;
    if (isExpired && tokenRow.status !== 'finalizado') {
      return NextResponse.json(
        { error: 'Este link de chamada expirou. Solicite um novo link à secretaria.', code: 'EXPIRED' },
        { status: 410 }
      );
    }

    // 3. Buscar dados da turma
    const { data: turma } = await admin
      .from('ebd_turmas')
      .select(`
        id,
        nome,
        sala,
        ebd_classes ( id, nome, cor ),
        congregacoes ( id, nome )
      `)
      .eq('id', tokenRow.turma_id)
      .eq('ministry_id', tokenRow.ministry_id)
      .maybeSingle();

    const turmaNome = turma?.nome || 'Turma EBD';
    const classeNome = (turma?.ebd_classes as any)?.nome || null;
    const classeCor = (turma?.ebd_classes as any)?.cor || '#3b82f6';
    const igrejaNome = (turma?.congregacoes as any)?.nome || null;

    // Buscar dados do professor titular / designado
    let professorNome: string | null = null;
    if (tokenRow.professor_id) {
      const { data: prof } = await admin
        .from('ebd_professores')
        .select('nome')
        .eq('id', tokenRow.professor_id)
        .eq('ministry_id', tokenRow.ministry_id)
        .maybeSingle();
      if (prof) professorNome = prof.nome;
    }

    // 4. Buscar aula correspondente caso já exista no banco
    const { data: aulaExistente } = await admin
      .from('ebd_aulas')
      .select('id, licao_numero, tema, observacoes, total_presentes, total_visitantes, status')
      .eq('turma_id', tokenRow.turma_id)
      .eq('data_aula', tokenRow.data_aula)
      .eq('ministry_id', tokenRow.ministry_id)
      .maybeSingle();

    // 5. Se já foi finalizado pelo professor, retornar visão em modo de leitura/comprovante
    if (tokenRow.status === 'finalizado') {
      return NextResponse.json({
        finalizado: true,
        finalizado_em: tokenRow.finalizado_em,
        data_aula: tokenRow.data_aula,
        turma: {
          nome: turmaNome,
          classe: classeNome,
          cor: classeCor,
          sala: turma?.sala || null,
          igreja: igrejaNome,
        },
        professor_nome: professorNome,
        resumo: {
          total_presentes: aulaExistente?.total_presentes ?? 0,
          total_visitantes: aulaExistente?.total_visitantes ?? 0,
          tema: aulaExistente?.tema || null,
          licao_numero: aulaExistente?.licao_numero || null,
        },
      });
    }

    // 6. Buscar alunos matriculados ativos da turma
    const { data: matriculas } = await admin
      .from('ebd_matriculas')
      .select(`
        id,
        aluno_id,
        ebd_alunos ( id, nome )
      `)
      .eq('turma_id', tokenRow.turma_id)
      .eq('ministry_id', tokenRow.ministry_id)
      .is('data_fim', null);

    // Mapear presenças já registradas, se houver
    let frequenciasMap = new Map<string, boolean>();
    let visitantesList: Array<{ id: string; nome: string; telefone: string | null }> = [];
    let valorOferta: number = 0;

    if (aulaExistente?.id) {
      const [freqsR, visitR, ofertaR] = await Promise.all([
        admin.from('ebd_frequencias').select('aluno_id, presente').eq('aula_id', aulaExistente.id),
        admin.from('ebd_visitantes_aula').select('id, nome, telefone').eq('aula_id', aulaExistente.id),
        admin.from('ebd_ofertas').select('valor').eq('aula_id', aulaExistente.id).maybeSingle(),
      ]);

      if (freqsR.data) {
        freqsR.data.forEach((f) => frequenciasMap.set(f.aluno_id, !!f.presente));
      }
      if (visitR.data) {
        visitantesList = visitR.data.map((v) => ({ id: v.id, nome: v.nome, telefone: v.telefone }));
      }
      if (ofertaR.data?.valor) {
        valorOferta = Number(ofertaR.data.valor);
      }
    }

    const alunosSanitizados = (matriculas || [])
      .filter((m) => m.ebd_alunos != null)
      .map((m) => {
        const aluno = m.ebd_alunos as any;
        return {
          id: aluno.id,
          nome: aluno.nome,
          presente: frequenciasMap.has(aluno.id) ? !!frequenciasMap.get(aluno.id) : false,
        };
      })
      .sort((a, b) => a.nome.localeCompare(b.nome));

    return NextResponse.json({
      finalizado: false,
      data_aula: tokenRow.data_aula,
      expires_at: tokenRow.expires_at,
      turma: {
        nome: turmaNome,
        classe: classeNome,
        cor: classeCor,
        sala: turma?.sala || null,
        igreja: igrejaNome,
      },
      professor_nome: professorNome,
      licao: {
        licao_numero: aulaExistente?.licao_numero || null,
        tema: aulaExistente?.tema || '',
        observacoes: aulaExistente?.observacoes || '',
      },
      alunos: alunosSanitizados,
      visitantes: visitantesList,
      valor_oferta: valorOferta,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Erro interno no servidor ao carregar chamada.' },
      { status: 500 }
    );
  }
}
