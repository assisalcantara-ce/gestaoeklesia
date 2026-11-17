import { createClient } from '@/lib/supabase-client';
import { consacracaoService } from '@/services/consagracao-service';

export type CategoriaHistoricoMinisterial =
  | 'todos'
  | 'consagracao'
  | 'frequencia'
  | 'credencial'
  | 'lideranca'
  | 'documental'
  | 'espiritual';

export interface EventoHistoricoMinisterial {
  id: string;
  origem: 'consagracao' | 'reuniao' | 'credencial' | 'lideranca' | 'documento' | 'espiritual' | 'cadastro';
  categoria: CategoriaHistoricoMinisterial;
  tipo_evento: string;
  data: string; // Formato ISO YYYY-MM-DD ou data/hora
  data_formatada?: string;
  titulo: string;
  subtitulo?: string | null;
  descricao: string;
  badge: {
    label: string;
    bg: string;
    dot: string;
    icon: string;
  };
  numero_processo?: string | null;
  cargo_anterior?: string | null;
  cargo_pretendido?: string | null;
  cargo_resultante?: string | null;
  cargo?: string | null;
  comissao_nome?: string | null;
  pastor_solicitante?: string | null;
  local?: string | null;
  local_origem?: string | null;
  responsavel?: string | null;
  parecer?: string | null;
  decisao?: string | null;
  // Campos operacionais adicionais
  reuniao_titulo?: string | null;
  status_presenca?: string | null;
  situacao_falta?: string | null;
  metodo_leitura?: string | null;
  motivo_justificativa?: string | null;
  tipo_justificativa?: string | null;
  motivo_abono?: string | null;
  advertencia_protocolo?: string | null;
  tipo_designacao?: string | null;
  criado_em?: string;
}

export interface HistoricoMinisterialCompleto {
  ministro: {
    id: string;
    nome: string;
    matricula: string;
    cpf: string;
    cargo_atual: string;
    data_consagracao_atual: string | null;
    foto_url: string | null;
    congregacao_nome?: string | null;
    data_emissao_credencial?: string | null;
    data_validade_credencial?: string | null;
    status_cadastro?: string | null;
  };
  eventos: EventoHistoricoMinisterial[];
  contadores: {
    todos: number;
    consagracao: number;
    frequencia: number;
    credencial: number;
    lideranca: number;
    documental: number;
    espiritual: number;
  };
}

export class HistoricoMinisterialService {
  /**
   * Normaliza uma string de data para o formato comparável 'YYYY-MM-DD'.
   */
  private extrairDataIso(dataStr?: string | null): string {
    if (!dataStr) return new Date().toISOString().slice(0, 10);
    const clean = String(dataStr).trim();
    if (clean.length >= 10 && clean[4] === '-' && clean[7] === '-') {
      return clean.slice(0, 10);
    }
    // Formato brasileiro DD/MM/YYYY
    if (clean.length >= 10 && clean[2] === '/' && clean[5] === '/') {
      const parts = clean.slice(0, 10).split('/');
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return clean.slice(0, 10);
  }

  /**
   * Agrega de forma unificada e cronológica o histórico ministerial de todas as tabelas operacionais.
   */
  async obterHistoricoCompleto(
    memberId: string,
    ministryId: string,
    customClient?: any
  ): Promise<HistoricoMinisterialCompleto> {
    const supabase = customClient || createClient();

    // 1. Buscar cadastro base do ministro em members
    const { data: member, error: memErr } = await supabase
      .from('members')
      .select(`
        id,
        name,
        matricula,
        cpf,
        cargo_ministerial,
        data_consagracao,
        data_batismo_aguas,
        data_batismo_espirito_santo,
        data_emissao,
        data_validade_credencial,
        member_since,
        status,
        foto_url,
        congregacao_id,
        dados_cargos,
        custom_fields,
        created_at,
        congregacoes:congregacao_id (
          id,
          nome
        )
      `)
      .eq('id', memberId)
      .eq('ministry_id', ministryId)
      .maybeSingle();

    if (memErr || !member) {
      throw new Error('Ministro não localizado ou não pertence ao ministério atual.');
    }

    const ministroInfo = {
      id: member.id,
      nome: member.name || 'Ministro',
      matricula: member.matricula || '-',
      cpf: member.cpf || '-',
      cargo_atual: member.cargo_ministerial || 'Não informado',
      data_consagracao_atual: member.data_consagracao || null,
      foto_url: member.foto_url || null,
      congregacao_nome: (member.congregacoes as any)?.nome || null,
      data_emissao_credencial: member.data_emissao || null,
      data_validade_credencial: member.data_validade_credencial || null,
      status_cadastro: member.status || 'active',
    };

    // 2. Consultas paralelas somente de leitura às tabelas operacionais existentes
    const [
      consagracaoDataResult,
      cartoesResult,
      reunioesParticipantesResult,
      reunioesCheckinsResult,
      reunioesFaltasResult,
      reunioesAdvertenciasResult,
      dirigentesResult,
      cartasResult,
    ] = await Promise.allSettled([
      // 2.1. Consagração e homologações (reutilizando a lógica consolidada do consagracaoService)
      consacracaoService.obterHistoricoCompletoMinistro(memberId, ministryId, supabase),

      // 2.2. Credenciais e cartões gerados
      supabase
        .from('cartoes_gerados')
        .select('id, created_at, printed_count, pdf_url, qr_code_data')
        .eq('member_id', memberId)
        .eq('ministry_id', ministryId)
        .order('created_at', { ascending: true }),

      // 2.3. Participações e convocações em Reuniões Ministeriais
      supabase
        .from('reunioes_participantes')
        .select(`
          id,
          reuniao_id,
          status_presenca,
          cargo_snapshot,
          nome_congregacao_snapshot,
          created_at,
          reuniao:reuniao_id (
            id,
            titulo,
            data_reuniao,
            horario_inicio,
            status
          )
        `)
        .eq('member_id', memberId)
        .eq('ministry_id', ministryId),

      // 2.4. Check-ins de presença confirmada em reuniões
      supabase
        .from('reunioes_checkins')
        .select(`
          id,
          reuniao_id,
          data_hora_checkin,
          metodo_leitura,
          reuniao:reuniao_id (
            id,
            titulo,
            data_reuniao
          )
        `)
        .eq('member_id', memberId)
        .eq('ministry_id', ministryId),

      // 2.5. Faltas registradas em reuniões (com situação, abonos e justificativas)
      supabase
        .from('reunioes_faltas')
        .select(`
          id,
          reuniao_id,
          data_geracao_falta,
          situacao,
          motivo_abono,
          abonada_em,
          reuniao:reuniao_id (
            id,
            titulo,
            data_reuniao
          ),
          justificativa:reunioes_justificativas (
            id,
            tipo_justificativa,
            motivo,
            anexo_documento_url,
            registrado_em
          )
        `)
        .eq('member_id', memberId)
        .eq('ministry_id', ministryId),

      // 2.6. Advertências formais geradas em Reuniões
      supabase
        .from('reunioes_advertencias')
        .select(`
          id,
          falta_id,
          reuniao_id,
          numero_protocolo,
          status_envio,
          pdf_url,
          created_at,
          reuniao:reuniao_id (
            id,
            titulo,
            data_reuniao
          )
        `)
        .eq('member_id', memberId)
        .eq('ministry_id', ministryId),

      // 2.7. Designações e mandatos de liderança de congregações
      supabase
        .from('dirigentes_designacoes')
        .select(`
          id,
          tipo_designacao,
          status,
          data_posse,
          data_termino,
          motivo_saida,
          created_at,
          congregacao:congregacao_id (
            id,
            nome
          )
        `)
        .eq('member_id', memberId)
        .eq('ministry_id', ministryId),

      // 2.8. Cartas e deliberações ministeriais
      supabase
        .from('cartas_registros')
        .select('id, template_key, template_title, status, created_at')
        .eq('member_id', memberId)
        .eq('ministry_id', ministryId),
    ]);

    const mapaEventos = new Map<string, EventoHistoricoMinisterial>();

    // ───────────────────────────────────────────────────────────────────────────
    // 3. Normalização: Marcos Espirituais e Cadastrais de members
    // ───────────────────────────────────────────────────────────────────────────
    // 3.1. Admissão no Ministério
    const dataAdmissao = member.member_since || member.created_at;
    if (dataAdmissao) {
      const dataIso = this.extrairDataIso(dataAdmissao);
      const idAdmissao = `marco_admissao_${member.id}`;
      mapaEventos.set(idAdmissao, {
        id: idAdmissao,
        origem: 'espiritual',
        categoria: 'espiritual',
        tipo_evento: 'admissao_membro',
        data: dataIso,
        titulo: 'Admissão no Ministério',
        subtitulo: ministroInfo.congregacao_nome ? `Congregação: ${ministroInfo.congregacao_nome}` : null,
        descricao: `Membro admitido oficialmente no cadastro ministerial da igreja.`,
        badge: {
          label: 'Admissão',
          bg: 'bg-blue-100 text-blue-800 border-blue-300',
          dot: 'bg-blue-600',
          icon: '🌱',
        },
        criado_em: dataAdmissao,
      });
    }

    // 3.2. Batismo nas Águas
    if (member.data_batismo_aguas) {
      const dataIso = this.extrairDataIso(member.data_batismo_aguas);
      const idBatismo = `marco_batismo_aguas_${member.id}`;
      mapaEventos.set(idBatismo, {
        id: idBatismo,
        origem: 'espiritual',
        categoria: 'espiritual',
        tipo_evento: 'batismo_aguas',
        data: dataIso,
        titulo: 'Batismo nas Águas',
        descricao: `Assentamento do Batismo nas Águas no histórico espiritual.`,
        badge: {
          label: 'Batismo nas Águas',
          bg: 'bg-cyan-100 text-cyan-800 border-cyan-300',
          dot: 'bg-cyan-600',
          icon: '💧',
        },
        criado_em: member.data_batismo_aguas,
      });
    }

    // 3.3. Batismo no Espírito Santo
    if (member.data_batismo_espirito_santo) {
      const dataIso = this.extrairDataIso(member.data_batismo_espirito_santo);
      const idBatismoEsp = `marco_batismo_es_${member.id}`;
      mapaEventos.set(idBatismoEsp, {
        id: idBatismoEsp,
        origem: 'espiritual',
        categoria: 'espiritual',
        tipo_evento: 'batismo_espirito_santo',
        data: dataIso,
        titulo: 'Batismo no Espírito Santo',
        descricao: `Registro oficial do Batismo com o Espírito Santo.`,
        badge: {
          label: 'Batismo no Espírito Santo',
          bg: 'bg-amber-100 text-amber-800 border-amber-300',
          dot: 'bg-amber-600',
          icon: '🕊️',
        },
        criado_em: member.data_batismo_espirito_santo,
      });
    }

    // ───────────────────────────────────────────────────────────────────────────
    // 4. Normalização: Consagração & Homologações (preservação estrita)
    // ───────────────────────────────────────────────────────────────────────────
    if (consagracaoDataResult.status === 'fulfilled' && consagracaoDataResult.value?.eventos) {
      consagracaoDataResult.value.eventos.forEach((ev: any, idx: number) => {
        const idEv = ev.id || `consagracao_ev_${idx}_${ev.tipo_evento}_${ev.data}`;
        const dataIso = this.extrairDataIso(ev.data);

        // Mapear badges preservando as cores e rótulos já aprovados
        let label = 'Consagração';
        let bg = 'bg-teal-100 text-teal-800 border-teal-300';
        let dot = 'bg-teal-600';
        let icon = '📜';

        if (ev.tipo_evento === 'homologacao') {
          label = 'Homologação';
          bg = 'bg-purple-100 text-purple-800 border-purple-300';
          dot = 'bg-purple-600';
          icon = '📜';
        } else if (ev.tipo_evento === 'decisao_comissao') {
          if (ev.decisao === 'indeferir') {
            label = 'Parecer Indeferido';
            bg = 'bg-red-100 text-red-800 border-red-300';
            dot = 'bg-red-600';
            icon = '❌';
          } else {
            label = 'Parecer Deferido';
            bg = 'bg-green-100 text-green-800 border-green-300';
            dot = 'bg-green-600';
            icon = '✅';
          }
        } else if (ev.tipo_evento === 'inicio_processo') {
          label = 'Início de Processo';
          bg = 'bg-teal-100 text-teal-800 border-teal-300';
          dot = 'bg-teal-600';
          icon = '📝';
        } else if (ev.tipo_evento === 'marco_ministerial' || ev.tipo_evento === 'mudanca_cargo') {
          label = 'Ordenação / Recebimento';
          bg = 'bg-blue-100 text-blue-800 border-blue-300';
          dot = 'bg-blue-600';
          icon = '🎖️';
        }

        mapaEventos.set(idEv, {
          id: idEv,
          origem: 'consagracao',
          categoria: 'consagracao',
          tipo_evento: ev.tipo_evento,
          data: dataIso,
          titulo: ev.tipo_evento === 'homologacao' ? 'Homologação de Consagração' : ev.tipo_evento === 'decisao_comissao' ? 'Deliberação da Comissão' : ev.descricao?.slice(0, 40) || 'Registro de Consagração',
          subtitulo: ev.numero_processo ? `Processo nº ${ev.numero_processo}` : null,
          descricao: ev.descricao || '-',
          badge: { label, bg, dot, icon },
          numero_processo: ev.numero_processo || null,
          cargo_anterior: ev.cargo_anterior || null,
          cargo_pretendido: ev.cargo_pretendido || null,
          cargo_resultante: ev.cargo_resultante || null,
          comissao_nome: ev.comissao_nome || null,
          pastor_solicitante: ev.pastor_solicitante || null,
          local: ev.local || null,
          local_origem: ev.local_origem || null,
          responsavel: ev.responsavel || null,
          parecer: ev.parecer || null,
          decisao: ev.decisao || null,
          criado_em: ev.criado_em || dataIso,
        });
      });
    }

    // ───────────────────────────────────────────────────────────────────────────
    // 5. Normalização: Credenciais e Cartões Gerados
    // ───────────────────────────────────────────────────────────────────────────
    let temEmissaoRegistrada = false;

    if (cartoesResult.status === 'fulfilled' && cartoesResult.value?.data && cartoesResult.value.data.length > 0) {
      cartoesResult.value.data.forEach((cartao: any, index: number) => {
        temEmissaoRegistrada = true;
        const dataIso = this.extrairDataIso(cartao.created_at);
        const isPrimeiraVia = index === 0;
        const idCredencial = `credencial_cartao_${cartao.id}`;

        const titulo = isPrimeiraVia ? 'Emissão de Credencial Ministerial' : 'Emissão de 2ª Via da Credencial';
        const label = isPrimeiraVia ? '1ª Via Credencial' : '2ª Via Credencial';

        mapaEventos.set(idCredencial, {
          id: idCredencial,
          origem: 'credencial',
          categoria: 'credencial',
          tipo_evento: isPrimeiraVia ? 'emissao_credencial' : 'segunda_via_credencial',
          data: dataIso,
          titulo,
          subtitulo: ministroInfo.matricula !== '-' ? `Carteirinha nº ${ministroInfo.matricula}` : null,
          descricao: `Credencial ministerial expedida com QR Code de validação institucional${cartao.printed_count > 1 ? ` (${cartao.printed_count} impressões efetuadas)` : ''}.`,
          badge: {
            label,
            bg: isPrimeiraVia ? 'bg-indigo-100 text-indigo-800 border-indigo-300' : 'bg-violet-100 text-violet-800 border-violet-300',
            dot: isPrimeiraVia ? 'bg-indigo-600' : 'bg-violet-600',
            icon: '🪪',
          },
          criado_em: cartao.created_at,
        });
      });
    }

    // Fallback: se houver data de emissão ou validade no cadastro do ministro e nenhum cartão físico em cartoes_gerados
    if (!temEmissaoRegistrada && (member.data_emissao || member.data_validade_credencial)) {
      const dataEmissao = member.data_emissao || member.created_at;
      const dataIso = this.extrairDataIso(dataEmissao);
      const idCredencialFallback = `credencial_cadastro_${member.id}`;

      mapaEventos.set(idCredencialFallback, {
        id: idCredencialFallback,
        origem: 'credencial',
        categoria: 'credencial',
        tipo_evento: 'emissao_credencial',
        data: dataIso,
        titulo: 'Credencial Ministerial Emitida',
        subtitulo: member.matricula ? `Carteirinha nº ${member.matricula}` : null,
        descricao: `Credencial registrada no cadastro ministerial.${member.data_validade_credencial ? ` Validade oficial: ${this.extrairDataIso(member.data_validade_credencial)}.` : ''}`,
        badge: {
          label: 'Credencial Emitida',
          bg: 'bg-indigo-100 text-indigo-800 border-indigo-300',
          dot: 'bg-indigo-600',
          icon: '🪪',
        },
        criado_em: dataEmissao,
      });
    }

    // ───────────────────────────────────────────────────────────────────────────
    // 6. Normalização: Reuniões Ministeriais (Presenças, Faltas, Justificativas, Abonos, Advertências, Convocações)
    // ───────────────────────────────────────────────────────────────────────────
    // 6.1. Advertências Formais por Falta
    const advertenciasPorFaltaId = new Map<string, any>();
    if (reunioesAdvertenciasResult.status === 'fulfilled' && reunioesAdvertenciasResult.value?.data) {
      reunioesAdvertenciasResult.value.data.forEach((adv: any) => {
        if (adv.falta_id) {
          advertenciasPorFaltaId.set(adv.falta_id, adv);
        }
      });
    }

    // 6.2. Convocações Oficiais Únicas por Combinação (member_id + reuniao_id)
    // Regra: Uma convocação oficial por reunião onde o ministro foi escalado/convocado.
    const reunioesConvocadasMap = new Map<string, any>();
    if (reunioesParticipantesResult.status === 'fulfilled' && reunioesParticipantesResult.value?.data) {
      reunioesParticipantesResult.value.data.forEach((p: any) => {
        const reuniaoId = p.reuniao_id || p.reuniao?.id;
        if (!reuniaoId || !p.reuniao) return;

        // Se já existe registro para esta mesma reunião, preserva o primeiro ou o com data de convocação válida
        if (!reunioesConvocadasMap.has(reuniaoId)) {
          reunioesConvocadasMap.set(reuniaoId, p);
        }
      });
    }

    // Emitir os eventos de Convocação Oficial para cada reunião distinta
    for (const [reuniaoId, p] of reunioesConvocadasMap.entries()) {
      const reuniao = p.reuniao;
      const dataIso = this.extrairDataIso(reuniao.data_reuniao || p.created_at);
      const idConvocacao = `reuniao_convocacao_${reuniaoId}_${memberId}`;

      mapaEventos.set(idConvocacao, {
        id: idConvocacao,
        origem: 'reuniao',
        categoria: 'frequencia',
        tipo_evento: 'convocacao_reuniao',
        data: dataIso,
        titulo: 'Convocação para Reunião Ministerial',
        subtitulo: reuniao.titulo,
        descricao: `Convocado oficialmente para a ${reuniao.titulo} agendada para ${dataIso}${reuniao.horario_inicio ? ` às ${reuniao.horario_inicio}` : ''}.`,
        badge: {
          label: 'Convocado',
          bg: 'bg-slate-100 text-slate-700 border-slate-300',
          dot: 'bg-slate-500',
          icon: '📅',
        },
        reuniao_titulo: reuniao.titulo,
        status_presenca: p.status_presenca || 'pendente',
        criado_em: p.created_at || reuniao.created_at || dataIso,
      });
    }

    // 6.3. Check-in Confirmado de Presença (data, hora e método)
    if (reunioesCheckinsResult.status === 'fulfilled' && reunioesCheckinsResult.value?.data) {
      reunioesCheckinsResult.value.data.forEach((ck: any) => {
        const reuniaoTitulo = ck.reuniao?.titulo || 'Reunião Ministerial';
        const dataCheckin = ck.data_hora_checkin || ck.reuniao?.data_reuniao;
        const dataIso = this.extrairDataIso(dataCheckin);
        const idCheckin = `reuniao_checkin_${ck.id}`;

        const hora = ck.data_hora_checkin
          ? new Date(ck.data_hora_checkin).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
          : null;

        const metodoLabel =
          ck.metodo_leitura === 'qrcode_carteirinha'
            ? 'Leitor QR Code'
            : ck.metodo_leitura === 'busca_nome'
            ? 'Busca Nominal'
            : ck.metodo_leitura === 'manual_secretaria'
            ? 'Manual Secretaria'
            : 'Recepção';

        mapaEventos.set(idCheckin, {
          id: idCheckin,
          origem: 'reuniao',
          categoria: 'frequencia',
          tipo_evento: 'presenca_reuniao',
          data: dataIso,
          titulo: 'Presença Confirmada em Reunião',
          subtitulo: reuniaoTitulo,
          descricao: `Presença confirmada na ${reuniaoTitulo}${hora ? ` às ${hora}` : ''} (${metodoLabel}).`,
          badge: {
            label: 'Check-in Confirmado',
            bg: 'bg-emerald-100 text-emerald-800 border-emerald-300',
            dot: 'bg-emerald-600',
            icon: '✔️',
          },
          reuniao_titulo: reuniaoTitulo,
          status_presenca: 'presente',
          metodo_leitura: ck.metodo_leitura,
          criado_em: ck.data_hora_checkin || dataIso,
        });
      });
    }

    // 6.4. Faltas Registradas, Justificativas Apresentadas e Abonos Concedidos
    if (reunioesFaltasResult.status === 'fulfilled' && reunioesFaltasResult.value?.data) {
      reunioesFaltasResult.value.data.forEach((falta: any) => {
        const reuniaoTitulo = falta.reuniao?.titulo || 'Reunião Ministerial';
        const dataFalta = falta.data_geracao_falta || falta.reuniao?.data_reuniao;
        const dataIsoFalta = this.extrairDataIso(dataFalta);
        const idFalta = `reuniao_falta_${falta.id}`;

        const horaFalta = falta.data_geracao_falta
          ? new Date(falta.data_geracao_falta).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
          : null;

        const adv = advertenciasPorFaltaId.get(falta.id);

        // Subtítulo e status atual da falta
        const situacaoLabel =
          falta.situacao === 'abonada'
            ? 'Falta Registrada (Posteriormente Abonada)'
            : falta.situacao === 'justificada'
            ? 'Falta Registrada (Posteriormente Justificada)'
            : 'Falta Registrada';

        // Evento 1: A falta oficial registrada
        mapaEventos.set(idFalta, {
          id: idFalta,
          origem: 'reuniao',
          categoria: 'frequencia',
          tipo_evento: 'falta_registrada',
          data: dataIsoFalta,
          titulo: 'Falta Registrada em Reunião',
          subtitulo: reuniaoTitulo,
          descricao: `Ausência constatada e falta registrada oficialmente na ${reuniaoTitulo}${horaFalta ? ` às ${horaFalta}` : ''}. Situação atual: ${falta.situacao.toUpperCase()}.`,
          badge: {
            label: situacaoLabel,
            bg: falta.situacao === 'abonada'
              ? 'bg-blue-100 text-blue-800 border-blue-300'
              : falta.situacao === 'justificada'
              ? 'bg-teal-100 text-teal-800 border-teal-300'
              : 'bg-rose-100 text-rose-800 border-rose-300',
            dot: falta.situacao === 'abonada' ? 'bg-blue-600' : falta.situacao === 'justificada' ? 'bg-teal-600' : 'bg-rose-600',
            icon: falta.situacao === 'abonada' ? '🤝' : falta.situacao === 'justificada' ? '📋' : '⚠️',
          },
          reuniao_titulo: reuniaoTitulo,
          situacao_falta: falta.situacao,
          criado_em: falta.data_geracao_falta || dataIsoFalta,
        });

        // Evento 2: Justificativa apresentada (se existir)
        const just = Array.isArray(falta.justificativa)
          ? falta.justificativa[0]
          : falta.justificativa;

        if (just) {
          const dataJustIso = this.extrairDataIso(just.registrado_em || falta.data_geracao_falta);
          const idJust = `reuniao_justificativa_${just.id || falta.id}`;

          const tipoDesc =
            just.tipo_justificativa === 'atestado_medico'
              ? 'Atestado Médico'
              : just.tipo_justificativa === 'trabalho'
              ? 'Compromisso de Trabalho'
              : just.tipo_justificativa === 'viagem'
              ? 'Viagem Ministerial/Pessoal'
              : just.tipo_justificativa === 'antecipada'
              ? 'Justificativa Antecipada'
              : 'Justificativa Formal';

          mapaEventos.set(idJust, {
            id: idJust,
            origem: 'reuniao',
            categoria: 'frequencia',
            tipo_evento: 'justificativa_apresentada',
            data: dataJustIso,
            titulo: 'Justificativa de Ausência Apresentada',
            subtitulo: reuniaoTitulo,
            descricao: `Justificativa protocolada (${tipoDesc}) referente à ausência na ${reuniaoTitulo}.${just.motivo ? ` Motivo: "${just.motivo}".` : ''} Situação: ${falta.situacao === 'justificada' ? 'Aprovada / Deferida' : falta.situacao === 'abonada' ? 'Abonada' : 'Em análise'}.`,
            badge: {
              label: falta.situacao === 'justificada' ? 'Justificativa Deferida' : 'Justificativa Apresentada',
              bg: 'bg-teal-100 text-teal-800 border-teal-300',
              dot: 'bg-teal-600',
              icon: '📋',
            },
            reuniao_titulo: reuniaoTitulo,
            situacao_falta: falta.situacao,
            motivo_justificativa: just.motivo,
            tipo_justificativa: just.tipo_justificativa,
            criado_em: just.registrado_em || falta.data_geracao_falta,
          });
        }

        // Evento 3: Abono ou anulação administrativa (se falta foi abonada)
        if (falta.situacao === 'abonada') {
          const dataAbonoIso = this.extrairDataIso(falta.abonada_em || falta.updated_at || falta.data_geracao_falta);
          const idAbono = `reuniao_abono_${falta.id}`;

          mapaEventos.set(idAbono, {
            id: idAbono,
            origem: 'reuniao',
            categoria: 'frequencia',
            tipo_evento: 'abono_falta',
            data: dataAbonoIso,
            titulo: 'Abono / Anulação de Falta pela Diretoria',
            subtitulo: reuniaoTitulo,
            descricao: `Falta na ${reuniaoTitulo} abonada formalmente pela Secretaria Geral e Mesa Diretora.${falta.motivo_abono ? ` Motivo do abono: "${falta.motivo_abono}".` : ''}`,
            badge: {
              label: 'Falta Abonada',
              bg: 'bg-blue-100 text-blue-800 border-blue-300',
              dot: 'bg-blue-600',
              icon: '🤝',
            },
            reuniao_titulo: reuniaoTitulo,
            situacao_falta: 'abonada',
            motivo_abono: falta.motivo_abono,
            criado_em: falta.abonada_em || falta.updated_at || falta.data_geracao_falta,
          });
        }

        // Evento 4: Advertência formal expedida (se existir)
        if (adv) {
          const idAdv = `reuniao_advertencia_${adv.id}`;
          const advDataIso = this.extrairDataIso(adv.created_at || dataFalta);
          mapaEventos.set(idAdv, {
            id: idAdv,
            origem: 'reuniao',
            categoria: 'frequencia',
            tipo_evento: 'advertencia_expedida',
            data: advDataIso,
            titulo: 'Advertência Formal Expedida',
            subtitulo: `Protocolo nº ${adv.numero_protocolo}`,
            descricao: `Notificação e advertência formal expedida pela Mesa Diretora referente à ausência na ${reuniaoTitulo} (Status: ${adv.status_envio}).`,
            badge: {
              label: 'Advertência Formal',
              bg: 'bg-red-100 text-red-800 border-red-300',
              dot: 'bg-red-700',
              icon: '📢',
            },
            reuniao_titulo: reuniaoTitulo,
            advertencia_protocolo: adv.numero_protocolo,
            criado_em: adv.created_at || dataFalta,
          });
        }
      });
    }

    // ───────────────────────────────────────────────────────────────────────────
    // 7. Normalização: Liderança & Mandatos de Congregações (dirigentes_designacoes)
    // ───────────────────────────────────────────────────────────────────────────
    if (dirigentesResult.status === 'fulfilled' && dirigentesResult.value?.data) {
      dirigentesResult.value.data.forEach((desig: any) => {
        const congNome = desig.congregacao?.nome || 'Congregação';
        const tipoLabel =
          desig.tipo_designacao === 'co_dirigente'
            ? 'Co-Dirigente'
            : desig.tipo_designacao === 'interino'
            ? 'Dirigente Interino'
            : 'Dirigente Titular';

        // 7.1. Evento de Posse / Nomeação
        const dataPosseIso = this.extrairDataIso(desig.data_posse);
        const idPosse = `dirigente_posse_${desig.id}`;

        mapaEventos.set(idPosse, {
          id: idPosse,
          origem: 'lideranca',
          categoria: 'lideranca',
          tipo_evento: 'posse_dirigente',
          data: dataPosseIso,
          titulo: `Posse na Direção de Congregação`,
          subtitulo: `${tipoLabel} • ${congNome}`,
          descricao: `Designado oficialmente pela Presidência para a liderança da congregação ${congNome} (${tipoLabel}).`,
          badge: {
            label: 'Posse de Dirigente',
            bg: 'bg-emerald-100 text-emerald-800 border-emerald-300',
            dot: 'bg-emerald-600',
            icon: '🏛️',
          },
          local: congNome,
          tipo_designacao: desig.tipo_designacao,
          criado_em: desig.created_at || dataPosseIso,
        });

        // 7.2. Evento de Término de Mandato (se encerrado)
        if (desig.data_termino || desig.status === 'concluido' || desig.status === 'revogado') {
          const dataTerminoIso = this.extrairDataIso(desig.data_termino || desig.created_at);
          const idTermino = `dirigente_termino_${desig.id}`;

          mapaEventos.set(idTermino, {
            id: idTermino,
            origem: 'lideranca',
            categoria: 'lideranca',
            tipo_evento: 'saida_dirigente',
            data: dataTerminoIso,
            titulo: `Término de Mandato Pastoral`,
            subtitulo: `${tipoLabel} • ${congNome}`,
            descricao: `Encerramento do mandato de liderança na congregação ${congNome}${desig.motivo_saida ? `. Motivo: ${desig.motivo_saida}` : ''}.`,
            badge: {
              label: 'Término de Mandato',
              bg: 'bg-amber-100 text-amber-800 border-amber-300',
              dot: 'bg-amber-600',
              icon: '📤',
            },
            local: congNome,
            tipo_designacao: desig.tipo_designacao,
            criado_em: desig.data_termino || desig.created_at,
          });
        }
      });
    }

    // ───────────────────────────────────────────────────────────────────────────
    // 8. Normalização: Cartas e Documentos Ministeriais (cartas_registros)
    // ───────────────────────────────────────────────────────────────────────────
    if (cartasResult.status === 'fulfilled' && cartasResult.value?.data) {
      cartasResult.value.data.forEach((carta: any) => {
        const dataIso = this.extrairDataIso(carta.created_at);
        const idCarta = `documento_carta_${carta.id}`;
        const titulo = carta.template_title || 'Carta Ministerial';

        mapaEventos.set(idCarta, {
          id: idCarta,
          origem: 'documento',
          categoria: 'documental',
          tipo_evento: 'documento_expedido',
          data: dataIso,
          titulo: `Expedição de Documento Ministerial`,
          subtitulo: titulo,
          descricao: `Documento formal expedido pela Secretaria Geral: ${titulo} (Status: ${carta.status || 'emitida'}).`,
          badge: {
            label: 'Documento Expedido',
            bg: 'bg-violet-100 text-violet-800 border-violet-300',
            dot: 'bg-violet-600',
            icon: '📄',
          },
          criado_em: carta.created_at,
        });
      });
    }

    // ───────────────────────────────────────────────────────────────────────────
    // 9. Ordenação Cronológica Estrita (Decrescente) e Contadores
    // ───────────────────────────────────────────────────────────────────────────
    const listaEventos = Array.from(mapaEventos.values()).sort((a, b) => {
      // Compara data ISO decrescente (ex: '2026-11-14' > '2026-10-01')
      const cmp = b.data.localeCompare(a.data);
      if (cmp !== 0) return cmp;
      return (b.criado_em || '').localeCompare(a.criado_em || '');
    });

    const contadores = {
      todos: listaEventos.length,
      consagracao: listaEventos.filter((e) => e.categoria === 'consagracao').length,
      frequencia: listaEventos.filter((e) => e.categoria === 'frequencia').length,
      credencial: listaEventos.filter((e) => e.categoria === 'credencial').length,
      lideranca: listaEventos.filter((e) => e.categoria === 'lideranca').length,
      documental: listaEventos.filter((e) => e.categoria === 'documental').length,
      espiritual: listaEventos.filter((e) => e.categoria === 'espiritual').length,
    };

    return {
      ministro: ministroInfo,
      eventos: listaEventos,
      contadores,
    };
  }
}

export const historicoMinisterialService = new HistoricoMinisterialService();
