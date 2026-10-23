/**
 * API ROUTE PÚBLICA: Confirmação de Identidade e Preenchimento Seguro de Membro
 * POST /api/v1/eventos/publico/[slug]/membros/confirmar
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { isFeatureAllowedForTenant } from '@/lib/plan-permissions';
import { signMemberPrefillToken } from '@/lib/evento-membro-token';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await props.params;

    if (!slug || typeof slug !== 'string') {
      return NextResponse.json({ error: 'Slug do evento inválido.' }, { status: 400 });
    }

    // Rate Limiting rigoroso: max 5 tentativas de confirmação por minuto por IP
    const clientIp = getClientIp(request);
    const rlKey = `evento_confirma_membro:${clientIp}:${slug}`;
    const rlResult = checkRateLimit(rlKey, 5, 60 * 1000);

    if (!rlResult.allowed) {
      return NextResponse.json(
        {
          error: 'Muitas tentativas de confirmação. Aguarde alguns instantes por segurança.',
          retryAfterSeconds: rlResult.retryAfterSeconds,
        },
        {
          status: 429,
          headers: { 'Retry-After': String(rlResult.retryAfterSeconds) },
        }
      );
    }

    let body: Record<string, any>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 });
    }

    const { member_id, data_nascimento, digitos_cpf, telefone_confirmacao } = body;

    if (!member_id || typeof member_id !== 'string') {
      return NextResponse.json({ error: 'Identificador do membro é obrigatório.' }, { status: 400 });
    }

    const admin = createServerClient();

    // 1. Validar evento público e tenant
    const { data: evento, error: evErr } = await admin
      .from('eventos')
      .select('id, ministry_id, is_publico, aceita_inscricao, status')
      .eq('slug', slug)
      .eq('is_publico', true)
      .maybeSingle();

    if (evErr || !evento) {
      return NextResponse.json({ error: 'Evento não encontrado.' }, { status: 404 });
    }

    // 2. Feature flag
    const isAllowed = await isFeatureAllowedForTenant(admin, evento.ministry_id, 'events_module');
    if (!isAllowed) {
      return NextResponse.json({ error: 'Módulo de Eventos indisponível.' }, { status: 403 });
    }

    // 3. Buscar cadastro do membro no tenant do evento
    const { data: member, error: memErr } = await admin
      .from('members')
      .select('id, name, email, phone, celular, whatsapp, cpf, data_nascimento, congregacao_id, congregacoes(id, nome)')
      .eq('id', member_id)
      .eq('ministry_id', evento.ministry_id)
      .maybeSingle();

    if (memErr || !member) {
      return NextResponse.json({ error: 'Membro não encontrado neste ministério.' }, { status: 404 });
    }

    // 4. Mecanismo de Confirmação Segura de Identidade
    // Aceita data de nascimento (DD/MM/AAAA ou YYYY-MM-DD), os primeiros 3 ou últimos 2 dígitos do CPF, ou os 4 últimos dígitos do telefone
    let confirmado = false;

    // A) Verificação por Data de Nascimento
    if (data_nascimento && typeof data_nascimento === 'string') {
      const inputLimpo = data_nascimento.replace(/\D/g, '');
      const dbDataRaw = member.data_nascimento ? String(member.data_nascimento) : '';
      const dbDataLimpo = dbDataRaw.replace(/\D/g, ''); // YYYYMMDD ou DDMMYYYY

      if (dbDataLimpo) {
        // Testar DDMMYYYY vs YYYYMMDD
        if (inputLimpo.length === 8) {
          if (dbDataLimpo.length >= 8) {
            // Se db for YYYY-MM-DD
            if (dbDataRaw.includes('-')) {
              const [y, m, d] = dbDataRaw.split('T')[0].split('-');
              const formatBR = `${d}${m}${y}`;
              const formatISO = `${y}${m}${d}`;
              if (inputLimpo === formatBR || inputLimpo === formatISO) {
                confirmado = true;
              }
            } else if (dbDataLimpo === inputLimpo) {
              confirmado = true;
            }
          }
        }
      }
    }

    // B) Verificação por dígitos do CPF (ex: 3 primeiros dígitos ou últimos 2 dígitos)
    if (!confirmado && digitos_cpf && typeof digitos_cpf === 'string') {
      const cpfDigits = digitos_cpf.replace(/\D/g, '');
      const dbCpfDigits = member.cpf ? String(member.cpf).replace(/\D/g, '') : '';
      if (dbCpfDigits.length === 11) {
        if (cpfDigits.length === 3 && dbCpfDigits.startsWith(cpfDigits)) {
          confirmado = true;
        } else if (cpfDigits.length === 2 && dbCpfDigits.endsWith(cpfDigits)) {
          confirmado = true;
        } else if (cpfDigits.length === 11 && dbCpfDigits === cpfDigits) {
          confirmado = true;
        }
      }
    }

    // C) Verificação pelos 4 últimos dígitos do telefone/celular/whatsapp
    if (!confirmado && telefone_confirmacao && typeof telefone_confirmacao === 'string') {
      const telDigits = telefone_confirmacao.replace(/\D/g, '');
      const phones = [member.phone, member.celular, member.whatsapp].filter(Boolean) as string[];
      for (const p of phones) {
        const cleanP = String(p).replace(/\D/g, '');
        if (cleanP.length >= 8 && telDigits.length >= 4 && cleanP.endsWith(telDigits)) {
          confirmado = true;
          break;
        }
      }
    }

    if (!confirmado) {
      return NextResponse.json(
        {
          error: 'Os dados informados não coincidem com o cadastro do membro. Por favor, verifique ou continue o preenchimento manual.',
          confirmado: false,
        },
        { status: 401 }
      );
    }

    // 5. Gerar token seguro HMAC para autorizar a posterior gravação com member_id
    const tokenAutorizacao = signMemberPrefillToken({
      memberId: member.id,
      eventoId: evento.id,
      ministryId: evento.ministry_id,
    });

    const telefoneOficial = member.celular || member.whatsapp || member.phone || '';
    const congregacaoNome = (member.congregacoes as any)?.nome || '';

    return NextResponse.json({
      confirmado: true,
      token: tokenAutorizacao,
      dados: {
        member_id: member.id,
        nome: member.name,
        email: member.email || '',
        telefone: telefoneOficial,
        congregacao: congregacaoNome,
        cpf: member.cpf || '',
      },
    });
  } catch (err: any) {
    console.error('[POST /api/v1/eventos/publico/[slug]/membros/confirmar] Exceção:', err);
    return NextResponse.json({ error: 'Erro interno ao validar dados do membro.' }, { status: 500 });
  }
}
