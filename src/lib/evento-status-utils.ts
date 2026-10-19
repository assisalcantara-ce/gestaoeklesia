/**
 * evento-status-utils.ts
 * Utilitários para resolução determinística do ciclo de vida e status de inscrições de eventos
 * no Gestão Eklésia, com suporte ao fuso horário oficial de Brasília (America/Sao_Paulo / UTC-3).
 */

export type StatusInscricaoEvento =
  | 'aberto'            // Futuro, aceita inscrições e possui vagas disponíveis
  | 'lotado'            // Futuro, aceita inscrições, mas atingiu capacidade máxima (lista de espera)
  | 'encerrado_manual'  // Futuro ou em andamento, mas o administrador desativou aceita_inscricao
  | 'expirado'          // Já ultrapassou a data limite (data_fim || data_inicio) ou status = realizado
  | 'cancelado';        // Evento explicitamente cancelado

export interface InfoStatusInscricao {
  status_inscricao: StatusInscricaoEvento;
  permite_inscricao: boolean;
  is_lista_espera: boolean;
  motivo_bloqueio: string | null;
  descricao_status: string;
}

/**
 * Converte uma data/hora de evento (ISO string, datetime-local ou timestamptz)
 * para um Date interpretado no fuso horário de Brasília (UTC-3).
 */
export function parseDataHoraBrasilia(dataStr: string | null | undefined): Date | null {
  if (!dataStr || typeof dataStr !== 'string') return null;

  const clean = dataStr.trim();
  if (!clean) return null;

  // Se já tiver offset explícito (ex: -03:00 ou +00:00 ou Z)
  // Se contiver 'Z' ou '+00:00', precisamos verificar se foi salvo como UTC puro ou offset
  const match = clean.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!match) {
    const d = new Date(clean);
    return isNaN(d.getTime()) ? null : d;
  }

  const [, y, m, d, hh = '23', mm = '59', ss = '59'] = match;

  // Se o input original não tem fuso, ou foi armazenado do input datetime-local,
  // interpretamos no fuso de Brasília (UTC-3).
  // Se veio do Supabase como "+00:00" mas foi originado de um input datetime-local local (ex: 2026-10-23T19:00:00+00:00),
  // a data nominal (23/10 às 19:00) deve ser preservada no fuso de Brasília (-03:00).
  return new Date(`${y}-${m}-${d}T${hh}:${mm}:${ss}-03:00`);
}

/**
 * Avalia se o evento já encerrou pelo término de seu horário/data no fuso de Brasília.
 * Se data_fim estiver definida, usa data_fim. Se não, usa data_inicio.
 */
export function isEventoExpirado(
  dataFim: string | null | undefined,
  dataInicio: string | null | undefined,
  agora: Date = new Date()
): boolean {
  // Se houver data_fim, o evento termina exatamente ao final de data_fim
  if (dataFim) {
    const fimDate = parseDataHoraBrasilia(dataFim);
    if (fimDate) {
      return agora.getTime() > fimDate.getTime();
    }
  }

  // Se houver apenas data_inicio:
  if (dataInicio) {
    const inicioDate = parseDataHoraBrasilia(dataInicio);
    if (inicioDate) {
      // Quando não há data_fim explícita, o evento aceita inscrições até o final do dia
      // da data de início no fuso de Brasília (23:59:59-03:00)
      const match = dataInicio.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (match) {
        const fimDoDia = new Date(`${match[1]}-${match[2]}-${match[3]}T23:59:59-03:00`);
        return agora.getTime() > fimDoDia.getTime();
      }
      return agora.getTime() > inicioDate.getTime();
    }
  }

  return false;
}

/**
 * Avalia o status completo de inscrições para um evento.
 */
export function avaliarStatusInscricao({
  status,
  aceita_inscricao,
  data_inicio,
  data_fim,
  capacidade,
  inscritos_confirmados = 0,
  aguardando_pagamento = 0,
  agora = new Date(),
}: {
  status: string | null | undefined;
  aceita_inscricao: boolean | null | undefined;
  data_inicio: string | null | undefined;
  data_fim?: string | null | undefined;
  capacidade?: number | null | undefined;
  inscritos_confirmados?: number;
  aguardando_pagamento?: number;
  agora?: Date;
}): InfoStatusInscricao {
  const statusNorm = (status || '').toLowerCase().trim();

  // 1. Evento Cancelado
  if (statusNorm === 'cancelado') {
    return {
      status_inscricao: 'cancelado',
      permite_inscricao: false,
      is_lista_espera: false,
      motivo_bloqueio: 'Este evento foi cancelado.',
      descricao_status: 'Evento Cancelado',
    };
  }

  // 2. Evento Realizado ou Prazo Expirado (fuso Brasília)
  const expiradoPorData = isEventoExpirado(data_fim, data_inicio, agora);
  if (statusNorm === 'realizado' || expiradoPorData) {
    return {
      status_inscricao: 'expirado',
      permite_inscricao: false,
      is_lista_espera: false,
      motivo_bloqueio: 'Este evento já foi realizado ou o prazo de inscrições expirou.',
      descricao_status: 'Evento Realizado / Inscrições Expiradas',
    };
  }

  // 3. Encerramento manual pelo administrador
  if (!aceita_inscricao) {
    return {
      status_inscricao: 'encerrado_manual',
      permite_inscricao: false,
      is_lista_espera: false,
      motivo_bloqueio: 'As inscrições para este evento foram encerradas pela organização.',
      descricao_status: 'Inscrições Encerradas pela Organização',
    };
  }

  // 4. Evento Lotado (vagas esgotadas -> permite lista de espera)
  const ocupacaoTotal = (inscritos_confirmados || 0) + (aguardando_pagamento || 0);
  if (capacidade != null && capacidade > 0 && ocupacaoTotal >= capacidade) {
    return {
      status_inscricao: 'lotado',
      permite_inscricao: true,
      is_lista_espera: true,
      motivo_bloqueio: null,
      descricao_status: 'Vagas Esgotadas (Lista de Espera)',
    };
  }

  // 5. Inscrições Abertas
  return {
    status_inscricao: 'aberto',
    permite_inscricao: true,
    is_lista_espera: false,
    motivo_bloqueio: null,
    descricao_status: 'Inscrições Abertas',
  };
}

/**
 * Formata o endereço completo de uma congregação com fallback seguro.
 */
export function formatarEnderecoCongregacao(cong?: {
  endereco?: string | null;
  cidade?: string | null;
  municipio?: string | null;
  uf?: string | null;
  cep?: string | null;
} | null): string {
  if (!cong) return '';
  const parts: string[] = [];
  const logradouro = (cong.endereco || '').trim();
  if (logradouro) parts.push(logradouro);

  const cidade = (cong.cidade || cong.municipio || '').trim();
  const uf = (cong.uf || '').trim().toUpperCase();
  if (cidade && uf) {
    parts.push(`${cidade} - ${uf}`);
  } else if (cidade) {
    parts.push(cidade);
  } else if (uf) {
    parts.push(uf);
  }

  const cep = (cong.cep || '').trim();
  if (cep) {
    parts.push(cep.toUpperCase().startsWith('CEP') ? cep : `CEP: ${cep}`);
  }

  return parts.join(', ');
}

/**
 * Mapeia placeholders de eventos para emissão de certificados.
 */
export function buildEventoPlaceholderMap(
  evento: {
    titulo?: string;
    local_nome?: string | null;
    local_endereco?: string | null;
    tipo?: any;
    congregacao_nome?: string | null;
    data_inicio?: string;
    data_fim?: string | null;
    descricao?: string | null;
    carga_horaria?: number | string | null;
    [key: string]: any;
  },
  insc: {
    id?: string;
    nome_display?: string;
    nome_externo?: string | null;
    nome?: string | null;
    cpf?: string | null;
    telefone?: string | null;
    email?: string | null;
    data_confirmacao?: string | null;
    data_inscricao?: string | null;
    status?: string | null;
    [key: string]: any;
  },
  configIgreja?: {
    nome?: string;
    endereco?: string;
    cnpj?: string;
    responsavel?: string;
    cidade?: string;
    uf?: string;
    [key: string]: any;
  }
): Record<string, string> {
  const cfg = configIgreja || {};

  // Extração inteligente de Cidade e Estado (UF)
  const extrairCidadeEstadoDeTexto = (texto?: string | null): { cidade: string; estado: string } => {
    if (!texto) return { cidade: '', estado: '' };
    // Remove segmento de CEP se presente (ex: "..., CEP: 67015-000")
    const semCep = texto.replace(/,\s*CEP[:\s].*$/i, '').trim();
    const segmentos = semCep.split(',').map(s => s.trim()).filter(Boolean);

    // Percorre os segmentos de trás para a frente procurando "Cidade - UF" ou "Cidade/UF"
    for (let i = segmentos.length - 1; i >= 0; i--) {
      const seg = segmentos[i];
      const match = seg.match(/^(.+?)\s*[-/]\s*([A-Za-z]{2})$/);
      if (match) {
        return {
          cidade: match[1].trim(),
          estado: match[2].trim().toUpperCase(),
        };
      }
    }

    return { cidade: '', estado: '' };
  };

  const extraidoEndereco = extrairCidadeEstadoDeTexto(cfg.endereco);
  const extraidoLocal = extrairCidadeEstadoDeTexto(evento.local_endereco);

  const cidade = (cfg.cidade || cfg.municipio || extraidoEndereco.cidade || extraidoLocal.cidade || '').trim();
  const estado = (cfg.estado || cfg.uf || extraidoEndereco.estado || extraidoLocal.estado || '').trim().toUpperCase();

  const localResolvido = evento.local_nome && evento.local_endereco
    ? `${evento.local_nome} - ${evento.local_endereco}`
    : (evento.local_nome || evento.local_endereco || 'Templo Sede');

  // Formatação com fuso horário America/Sao_Paulo estrito para evitar divergências de dia
  const formataDataApenas = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(d);
    } catch {
      return '';
    }
  };

  const formataDataHora = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(d);
    } catch {
      return '';
    }
  };

  const dataApenasInicio = evento.data_inicio ? formataDataApenas(evento.data_inicio) : '';
  const dtInicio = evento.data_inicio ? formataDataHora(evento.data_inicio) : '';
  const dtFim = evento.data_fim ? formataDataHora(evento.data_fim) : '';

  const nomeParticipante = insc.nome_display || insc.nome_externo || (insc as unknown as { nome?: string }).nome || '';
  const cargaHorariaStr = evento.carga_horaria ? `${evento.carga_horaria} horas` : '';

  return {
    participante_nome: nomeParticipante,
    nome: nomeParticipante,
    membro_nome: nomeParticipante,
    participante: nomeParticipante,
    '{{NOME}}': nomeParticipante,
    '{{NOME_PARTICIPANTE}}': nomeParticipante,
    '{{CPF}}': insc.cpf || '',
    '{{CPF_PARTICIPANTE}}': insc.cpf || '',
    '{{TELEFONE}}': insc.telefone || '',
    '{{EMAIL}}': (insc as unknown as { email_externo?: string }).email_externo || insc.email || '',
    evento_nome: evento.titulo || '',
    evento_titulo: evento.titulo || '',
    titulo: evento.titulo || '',
    '{{NOME_EVENTO}}': evento.titulo || '',
    '{{TITULO_EVENTO}}': evento.titulo || '',
    evento_tipo: evento.tipo ? String(evento.tipo) : '',
    tipo_evento: evento.tipo ? String(evento.tipo) : '',
    tipo: evento.tipo ? String(evento.tipo) : '',
    evento_data: dataApenasInicio,
    data_evento: dataApenasInicio,
    data: dataApenasInicio,
    evento_data_inicio: dtInicio,
    data_inicio: dtInicio,
    evento_data_fim: dtFim,
    data_fim: dtFim,
    evento_local: localResolvido,
    local_evento: evento.local_nome || localResolvido,
    local: localResolvido,
    local_nome: evento.local_nome || '',
    local_endereco: evento.local_endereco || '',
    '{{LOCAL}}': localResolvido,
    '{{LOCAL_NOME}}': evento.local_nome || localResolvido,
    '{{ENDERECO}}': evento.local_endereco || localResolvido,
    evento_congregacao: evento.congregacao_nome || 'Templo Sede',
    congregacao: evento.congregacao_nome || 'Templo Sede',
    evento_descricao: evento.descricao || '',
    descricao: evento.descricao || '',
    evento_carga_horaria: cargaHorariaStr,
    carga_horaria: cargaHorariaStr,
    '{{CARGA_HORARIA}}': cargaHorariaStr,
    responsavel_evento: cfg.responsavel || '',
    pastor_nome: cfg.responsavel || '',
    responsavel: cfg.responsavel || '',
    ministerio_nome: cfg.nome || 'Igreja',
    nome_igreja: cfg.nome || 'Igreja',
    igreja_nome: cfg.nome || 'Igreja',
    '{{NOME_IGREJA}}': cfg.nome || 'Igreja',
    ministerio_cnpj: cfg.cnpj || '',
    cnpj: cfg.cnpj || '',
    cidade,
    '{{CIDADE_IGREJA}}': cidade,
    estado,
    uf: estado,
    '{{UF_IGREJA}}': estado,
    '{{CIDADE_UF_IGREJA}}': cidade && estado ? `${cidade} - ${estado}` : (cidade || estado),
    evento_protocolo: insc.id ? insc.id.substring(0, 8).toUpperCase() : '',
    protocolo: insc.id ? insc.id.substring(0, 8).toUpperCase() : '',
    data_emissao: new Date().toLocaleDateString('pt-BR'),
  };
}
