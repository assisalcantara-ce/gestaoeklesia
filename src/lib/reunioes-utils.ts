import crypto from 'crypto';

/**
 * Utilitários para o Módulo de Reuniões Ministeriais
 *
 * Cálculo determinístico de fuso horário brasileiro (UTC-3)
 * e formatação de timestamps absolutos para corte de check-in.
 */

/**
 * Converte data (AAAA-MM-DD) e horário (HH:MM ou HH:MM:SS) em TIMESTAMPTZ ISO String
 * no fuso horário de Brasília (UTC-3).
 *
 * Ex: '2026-05-10', '09:00' -> '2026-05-10T09:00:00-03:00'
 */
export function calcularLimiteCheckinTimestamp(dataStr: string, horarioStr: string): string {
  const cleanData = dataStr.trim();
  let cleanHora = horarioStr.trim();

  // Adicionar segundos se não fornecidos
  if (/^\d{2}:\d{2}$/.test(cleanHora)) {
    cleanHora = `${cleanHora}:00`;
  }

  // Montar string no padrão ISO com offset -03:00 (Brasília)
  const isoLocal = `${cleanData}T${cleanHora}-03:00`;
  const dateObj = new Date(isoLocal);

  if (isNaN(dateObj.getTime())) {
    throw new Error(`Data ou horário inválido para cálculo de limite: ${dataStr} ${horarioStr}`);
  }

  return dateObj.toISOString();
}

/**
 * Valida se horário de limite é igual ou posterior ao horário de início
 */
export function validarHorariosReuniao(horarioInicio: string, horarioLimite: string): boolean {
  const normInicio = horarioInicio.trim().slice(0, 5);
  const normLimite = horarioLimite.trim().slice(0, 5);
  return normLimite >= normInicio;
}

/**
 * Extrai o identificador (unique_id ou id) a partir de uma leitura de QR Code.
 * Suporta:
 * 1. URL canônica completa (ex: 'https://.../validar/credencial/MIN-12345' ou '.../validar/credencial/uuid')
 * 2. unique_id puro (ex: 'MIN-12345', 'ALC-9988')
 * 3. UUID puro do membro
 */
export function extrairIdentificadorMinistroQrCode(rawQrInput: string): string {
  if (!rawQrInput || typeof rawQrInput !== 'string') return '';
  const trimmed = rawQrInput.trim();

  // Caso 1: URL com caminho /validar/credencial/
  const matchUrl = trimmed.match(/\/validar\/credencial\/([^/?#]+)/i);
  if (matchUrl && matchUrl[1]) {
    return decodeURIComponent(matchUrl[1]).trim();
  }

  // Caso 2: URL terminando com parâmetro
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const parsed = new URL(trimmed);
      const segments = parsed.pathname.split('/').filter(Boolean);
      const last = segments[segments.length - 1];
      if (last) return decodeURIComponent(last).trim();
    } catch {
      // continua para fallback
    }
  }

  // Caso 3: String direta (unique_id ou id)
  return trimmed;
}

/**
 * Gera um token criptograficamente seguro e aleatório para acesso ao painel informativo.
 * Retorna string hexadecimal de 32 bytes (64 caracteres).
 */
export function gerarTokenPainel(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Gera o hash SHA-256 de um token para persistência e busca segura no banco de dados.
 */
export function hashTokenPainel(token: string): string {
  return crypto.createHash('sha256').update(token.trim()).digest('hex');
}

export type StatusReuniaoEfetivo = 'agendada' | 'em_andamento' | 'encerrada' | 'cancelada';

/**
 * Calcula o status efetivo/operacional da reunião de forma consistente.
 * Regras:
 * 1. Se o status persistido for 'encerrada' ou 'cancelada', preserva o status persistido.
 * 2. Se a data/hora de início da reunião já chegou (ou passou) e a reunião não está encerrada,
 *    o status operacional é 'em_andamento'.
 * 3. Se a data/hora de início ainda é futura, o status é 'agendada'.
 * 4. Nenhuma reunião cuja data/hora já passou permanece como 'agendada'.
 */
export function calcularStatusEfetivoReuniao(reuniao: {
  data_reuniao?: string | null;
  horario_inicio?: string | null;
  status?: string | null;
}): StatusReuniaoEfetivo {
  if (reuniao.status === 'encerrada') return 'encerrada';
  if (reuniao.status === 'cancelada') return 'cancelada';

  if (!reuniao.data_reuniao) {
    return (reuniao.status as StatusReuniaoEfetivo) || 'agendada';
  }

  try {
    const horaInicio = (reuniao.horario_inicio || '00:00').trim().slice(0, 5);
    const isoInicio = `${reuniao.data_reuniao.trim()}T${horaInicio.length === 5 ? horaInicio + ':00' : '00:00:00'}-03:00`;
    const inicioDate = new Date(isoInicio);

    if (isNaN(inicioDate.getTime())) {
      return (reuniao.status as StatusReuniaoEfetivo) || 'agendada';
    }

    const agora = new Date();
    // Se a data/hora de início já chegou ou passou
    if (agora >= inicioDate) {
      return 'em_andamento';
    }

    return 'agendada';
  } catch {
    return (reuniao.status as StatusReuniaoEfetivo) || 'agendada';
  }
}

/**
 * Calcula a expiração dos links públicos (Check-in e Painel TV) da reunião.
 * Regra de negócio: expiram estritamente às 23:59:59 da data da reunião no fuso de Brasília (UTC-3).
 * Exemplo: reunião em 2026-11-14 -> '2026-11-14T23:59:59-03:00' -> convertido para ISO UTC.
 */
export function calcularExpiracaoFimDoDiaReuniao(dataReuniaoStr: string): string {
  const cleanData = (dataReuniaoStr || '').trim().split('T')[0];
  if (!cleanData || !/^\d{4}-\d{2}-\d{2}$/.test(cleanData)) {
    // Fallback: 24h a partir de agora se data for inválida
    return new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  }

  // 23:59:59 no fuso de Brasília (-03:00)
  const isoLocal = `${cleanData}T23:59:59-03:00`;
  const dateObj = new Date(isoLocal);

  if (isNaN(dateObj.getTime())) {
    return new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  }

  return dateObj.toISOString();
}

/**
 * Ordena reuniões ministeriais respeitando a prioridade de exibição:
 * 1. Reuniões agendadas ou em andamento primeiro, ordenadas cronologicamente crescente (mais próxima no topo).
 * 2. Reuniões encerradas e canceladas depois, ordenadas cronologicamente decrescente (mais recente no topo).
 */
export function ordenarReunioesMinisteriais<T extends { data_reuniao: string; horario_inicio?: string | null; status: string; status_efetivo?: string }>(
  lista: T[]
): T[] {
  return [...lista].sort((a, b) => {
    const stA = a.status_efetivo || a.status;
    const stB = b.status_efetivo || b.status;

    const isEncerradaOuCanceladaA = stA === 'encerrada' || stA === 'cancelada';
    const isEncerradaOuCanceladaB = stB === 'encerrada' || stB === 'cancelada';

    // Se uma é futura/em andamento e a outra é encerrada/cancelada, a futura fica no topo
    if (!isEncerradaOuCanceladaA && isEncerradaOuCanceladaB) return -1;
    if (isEncerradaOuCanceladaA && !isEncerradaOuCanceladaB) return 1;

    // Se ambas são futuras / ativas: ordem cronológica crescente (mais próxima no topo)
    // Ex: 14/11/2026 antes de 12/12/2026
    if (!isEncerradaOuCanceladaA && !isEncerradaOuCanceladaB) {
      const dataHoraA = `${a.data_reuniao} ${(a.horario_inicio || '00:00').slice(0, 5)}`;
      const dataHoraB = `${b.data_reuniao} ${(b.horario_inicio || '00:00').slice(0, 5)}`;
      return dataHoraA.localeCompare(dataHoraB);
    }

    // Se ambas são encerradas / canceladas: ordem cronológica decrescente (encerrada mais recente primeiro)
    const dataHoraA = `${a.data_reuniao} ${(a.horario_inicio || '00:00').slice(0, 5)}`;
    const dataHoraB = `${b.data_reuniao} ${(b.horario_inicio || '00:00').slice(0, 5)}`;
    return dataHoraB.localeCompare(dataHoraA);
  });
}

/**
 * Retorna os limites (data de início e fim no formato YYYY-MM-DD) do mês corrente
 * ou de uma referência de data no fuso de Brasília.
 */
export function getLimitesMesCorrente(referencia?: Date): {
  mesAnoStr: string; // Ex: '2026-11'
  dataInicioMes: string; // Ex: '2026-11-01'
  dataFimMes: string; // Ex: '2026-11-30'
  nomeMesAno: string; // Ex: 'Novembro de 2026'
} {
  const agora = referencia || new Date();
  const ano = agora.getFullYear();
  const mesIndex = agora.getMonth(); // 0 a 11
  const mesNum = mesIndex + 1;
  const mesPadded = String(mesNum).padStart(2, '0');

  const mesAnoStr = `${ano}-${mesPadded}`;
  const dataInicioMes = `${mesAnoStr}-01`;

  // Último dia do mês: dia 0 do mês seguinte
  const ultimoDia = new Date(ano, mesNum, 0).getDate();
  const dataFimMes = `${mesAnoStr}-${String(ultimoDia).padStart(2, '0')}`;

  const nomesMeses = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  const nomeMesAno = `${nomesMeses[mesIndex]} de ${ano}`;

  return {
    mesAnoStr,
    dataInicioMes,
    dataFimMes,
    nomeMesAno,
  };
}

/**
 * Identifica se um evento da Agenda Oficial é estruturalmente classificado como Reunião Ministerial.
 * Regras estritas baseadas em dados estruturados do banco (agenda_tipos e agenda_eventos):
 * 1. Código de tipo cadastrado em agenda_tipos:
 *    - 'reuniao_ministerial' (Reunião Ministerial)
 *    - 'reuniao_obreiros' (Reunião de Obreiros)
 *    - 'reuniao_diretoria' (Reunião de Diretoria)
 *    - 'assembleia_geral' (Assembleia Geral)
 * 2. Categoria estruturada 'reuniao' com tipo raiz 'reuniao'
 * Não utiliza buscas heurísticas livres em títulos arbitrários.
 */
export function isEventoReuniaoMinisterial(evento: {
  tipo?: string | null;
  agenda_tipos?: {
    codigo?: string | null;
    categoria?: string | null;
  } | null;
}): boolean {
  if (!evento) return false;

  const tipo = (evento.tipo || '').toLowerCase().trim();
  const tipoCodigo = (evento.agenda_tipos?.codigo || '').toLowerCase().trim();
  const tipoCategoria = (evento.agenda_tipos?.categoria || '').toLowerCase().trim();

  // 1. Códigos estruturados oficiais do seed/cadastro da agenda
  const codigosOficiaisMinisteriais = [
    'reuniao_ministerial',
    'reuniao_obreiros',
    'reuniao_diretoria',
    'assembleia_geral',
  ];

  if (tipoCodigo && codigosOficiaisMinisteriais.includes(tipoCodigo)) {
    return true;
  }

  // 2. Classificação combinada por categoria estruturada 'reuniao' e tipo 'reuniao'
  if (tipo === 'reuniao' && tipoCategoria === 'reuniao') {
    return true;
  }

  return false;
}



