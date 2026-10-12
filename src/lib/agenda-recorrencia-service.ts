/**
 * agenda-recorrencia-service.ts
 *
 * Motor de Cálculo, Validação e Geração de Eventos Recorrentes para a Agenda Oficial.
 * Suporta:
 *   - Eventos Únicos ('nenhuma')
 *   - Semanais (ex: toda quarta-feira, todo domingo às 8h)
 *   - Mensais por Dia Fixo (ex: todo dia 10 do mês)
 *   - Mensais por Ordinal (ex: 1º sábado do mês, 2º sábado, último domingo)
 *   - Anual por Data
 *
 * Trata:
 *   - Período/ano limite
 *   - Anos bissextos (29 de fevereiro)
 *   - Exceções (datas canceladas ou ignoradas)
 *   - Idempotência e Prevenção de duplicidades
 *   - Preservação de fuso e horário local
 */

export const TIPOS_VALIDOS_AGENDA_EVENTOS = ['culto', 'reuniao', 'aula', 'evento', 'tarefa', 'outro'] as const;
export type TipoAgendaEventoValido = typeof TIPOS_VALIDOS_AGENDA_EVENTOS[number];

/**
 * Normaliza qualquer valor bruto de tipo/categoria (inclusive os de agenda_tipos como 'departamento', 'missoes', 'administrativo', 'ebd')
 * para um dos valores estritamente aceitos pela constraint "agenda_eventos_tipo" do banco de dados:
 * ('culto', 'reuniao', 'aula', 'evento', 'tarefa', 'outro').
 */
export function normalizarTipoAgendaEvento(
  rawTipo?: string | null,
  rawCategoria?: string | null,
  nomeOuCodigo?: string | null
): TipoAgendaEventoValido {
  const t = (rawTipo || '').toLowerCase().trim();
  const c = (rawCategoria || '').toLowerCase().trim();
  const n = (nomeOuCodigo || '').toLowerCase().trim();

  // Se já for um tipo canônico válido
  if (TIPOS_VALIDOS_AGENDA_EVENTOS.includes(t as TipoAgendaEventoValido)) {
    return t as TipoAgendaEventoValido;
  }
  if (TIPOS_VALIDOS_AGENDA_EVENTOS.includes(c as TipoAgendaEventoValido)) {
    return c as TipoAgendaEventoValido;
  }

  // Mapeamentos específicos por categoria ou semântica
  if (c === 'departamento' || t === 'departamento') {
    // EBD, Escola Bíblica, discipulado ou ensino -> 'aula'
    if (n.includes('ebd') || n.includes('escola') || n.includes('ensino') || n.includes('biblic')) {
      return 'aula';
    }
    // Reuniões departamentais ou ensaios -> 'reuniao'
    return 'reuniao';
  }

  if (c === 'missoes' || t === 'missoes') {
    return 'evento';
  }

  if (c === 'administrativo' || t === 'administrativo') {
    if (n.includes('atendimento') || n.includes('visita')) {
      return 'tarefa';
    }
    return 'reuniao';
  }

  if (t === 'ebd' || c === 'ebd' || n.includes('ebd')) {
    return 'aula';
  }

  return 'outro';
}

export type RecorrenciaFrequencia = 'nenhuma' | 'semanal' | 'mensal_ordinal' | 'mensal_dia' | 'anual';

export type OrdinalSemana = 'primeiro' | 'segundo' | 'terceiro' | 'quarto' | 'ultimo';

export interface RecorrenciaConfig {
  frequencia: RecorrenciaFrequencia;
  // Para semanal: 0 = Domingo, 1 = Segunda, ..., 6 = Sábado. Suporta múltiplos dias (ex: [0, 3] = Domingo e Quarta)
  diasSemana?: number[];
  // Para mensal ordinal: 'primeiro' | 'segundo' | 'terceiro' | 'quarto' | 'ultimo'
  ordinal?: OrdinalSemana;
  // Dia da semana para o ordinal (0 = Domingo ... 6 = Sábado)
  diaSemanaOrdinal?: number;
  // Para mensal por dia: dia do mês (1 a 31)
  diaDoMes?: number;
  // Ano de referência da série (ex: 2026). Quando fornecido, gera todas as ocorrências do ano escolhido (jan a dez).
  anoReferencia?: number;
  // Limite da recorrência (YYYY-MM-DD)
  dataFimRecorrencia?: string;
  // Ou limite por ano
  anoLimite?: number;
  // Máximo de ocorrências de segurança
  maxOcorrencias?: number;
}

export interface GerarOcorrenciasParams {
  dataInicio: string; // ISO ou "YYYY-MM-DDTHH:mm"
  dataFim?: string | null; // ISO ou "YYYY-MM-DDTHH:mm"
  config: RecorrenciaConfig;
  excecoes?: string[]; // Datas no formato "YYYY-MM-DD" que devem ser excluídas
  limiteMaximo?: number; // Default 100
}

export interface OcorrenciaGerada {
  dataInicio: string; // ISO string
  dataFim: string | null; // ISO string
  numeroOcorrencia: number;
  dataBaseStr: string; // "YYYY-MM-DD"
}

export class AgendaRecorrenciaService {
  /**
   * Identifica se um ano é bissexto
   */
  public static isAnoBissexto(ano: number): boolean {
    return (ano % 4 === 0 && ano % 100 !== 0) || (ano % 400 === 0);
  }

  /**
   * Retorna a quantidade de dias em um determinado mês/ano
   */
  public static getDiasNoMes(ano: number, mesZeroIndexed: number): number {
    return new Date(ano, mesZeroIndexed + 1, 0).getDate();
  }

  /**
   * Encontra a data de uma ocorrência ordinal no mês (ex: 1º Sábado, 2º Sábado, Último Domingo)
   * mes: 0-indexed (0 = Jan, 11 = Dez)
   * diaSemana: 0 = Domingo, ..., 6 = Sábado
   */
  public static calcularDataOrdinalNoMes(
    ano: number,
    mes: number,
    ordinal: OrdinalSemana,
    diaSemana: number
  ): Date | null {
    const totalDias = this.getDiasNoMes(ano, mes);
    const matches: number[] = [];

    for (let d = 1; d <= totalDias; d++) {
      const data = new Date(ano, mes, d);
      if (data.getDay() === diaSemana) {
        matches.push(d);
      }
    }

    if (matches.length === 0) return null;

    let diaEscolhido: number | null = null;
    switch (ordinal) {
      case 'primeiro':
        diaEscolhido = matches[0];
        break;
      case 'segundo':
        diaEscolhido = matches.length >= 2 ? matches[1] : null;
        break;
      case 'terceiro':
        diaEscolhido = matches.length >= 3 ? matches[2] : null;
        break;
      case 'quarto':
        diaEscolhido = matches.length >= 4 ? matches[3] : null;
        break;
      case 'ultimo':
        diaEscolhido = matches[matches.length - 1];
        break;
      default:
        diaEscolhido = matches[0];
    }

    if (!diaEscolhido) return null;
    return new Date(ano, mes, diaEscolhido);
  }

  /**
   * Calcula automaticamente a primeira data real de ocorrência no ano/regra especificada.
   * Não depende da data atual nem exige preenchimento manual da data de início.
   */
  public static calcularPrimeiraOcorrencia(params: {
    ano: number;
    config: RecorrenciaConfig;
    hora: number;
    minuto: number;
  }): Date | null {
    const { ano, config, hora, minuto } = params;

    if (config.frequencia === 'semanal') {
      const dias = config.diasSemana && config.diasSemana.length > 0 ? config.diasSemana : [0];
      const cursor = new Date(ano, 0, 1, hora, minuto, 0, 0);
      while (cursor.getFullYear() === ano) {
        if (dias.includes(cursor.getDay())) {
          return new Date(cursor);
        }
        cursor.setDate(cursor.getDate() + 1);
      }
    } else if (config.frequencia === 'mensal_ordinal') {
      const ordinal = config.ordinal || 'primeiro';
      const diaSemana = config.diaSemanaOrdinal !== undefined ? config.diaSemanaOrdinal : 6;
      for (let mes = 0; mes < 12; mes++) {
        const dt = this.calcularDataOrdinalNoMes(ano, mes, ordinal, diaSemana);
        if (dt) {
          dt.setHours(hora, minuto, 0, 0);
          return dt;
        }
      }
    } else if (config.frequencia === 'mensal_dia') {
      const dia = config.diaDoMes || 1;
      const dt = new Date(ano, 0, dia, hora, minuto, 0, 0);
      return dt;
    } else if (config.frequencia === 'anual') {
      return new Date(ano, 0, 1, hora, minuto, 0, 0);
    }

    return null;
  }

  /**
   * Gera as datas reais de ocorrências no calendário a partir da configuração de recorrência
   */
  public static gerarOcorrencias(params: GerarOcorrenciasParams): OcorrenciaGerada[] {
    const { dataInicio, dataFim, config, excecoes = [], limiteMaximo = 120 } = params;

    const dataInicialObj = new Date(dataInicio);
    if (isNaN(dataInicialObj.getTime())) {
      throw new Error('Data de início inválida.');
    }

    // Duração do evento em milissegundos
    let duracaoMs = 0;
    if (dataFim) {
      const dataFimObj = new Date(dataFim);
      if (!isNaN(dataFimObj.getTime()) && dataFimObj.getTime() > dataInicialObj.getTime()) {
        duracaoMs = dataFimObj.getTime() - dataInicialObj.getTime();
      }
    }

    const horaInicial = dataInicialObj.getHours();
    const minutoInicial = dataInicialObj.getMinutes();
    const segundoInicial = dataInicialObj.getSeconds();

    // Se a frequência for 'nenhuma', retorna apenas a ocorrência base
    if (!config || config.frequencia === 'nenhuma') {
      const y = dataInicialObj.getFullYear();
      const m = String(dataInicialObj.getMonth() + 1).padStart(2, '0');
      const d = String(dataInicialObj.getDate()).padStart(2, '0');
      const dataBaseStr = `${y}-${m}-${d}`;

      return [
        {
          dataInicio: dataInicialObj.toISOString(),
          dataFim: duracaoMs > 0 ? new Date(dataInicialObj.getTime() + duracaoMs).toISOString() : null,
          numeroOcorrencia: 1,
          dataBaseStr,
        },
      ];
    }

    // Determina o ano base e limite final da geração
    const anoBase = config.anoReferencia || dataInicialObj.getFullYear();

    let dataLimiteFinal: Date;
    if (config.dataFimRecorrencia) {
      const p = config.dataFimRecorrencia.split('-');
      dataLimiteFinal = new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10), 23, 59, 59);
    } else if (config.anoLimite) {
      dataLimiteFinal = new Date(config.anoLimite, 11, 31, 23, 59, 59);
    } else {
      // Default: até 31 de dezembro do ano de referência
      dataLimiteFinal = new Date(anoBase, 11, 31, 23, 59, 59);
    }

    const excecoesSet = new Set(excecoes);
    const ocorrencias: OcorrenciaGerada[] = [];
    const maxItems = Math.min(config.maxOcorrencias || limiteMaximo, limiteMaximo);

    const formatarDataStr = (dt: Date): string => {
      const y = dt.getFullYear();
      const m = String(dt.getMonth() + 1).padStart(2, '0');
      const d = String(dt.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    };

    // Ponto de início: se anoReferencia for definido, inicia desde 01 de janeiro do ano escolhido
    // Caso contrário, respeita a data inicial fornecida
    const dataPontoDePartida = config.anoReferencia
      ? new Date(config.anoReferencia, 0, 1, horaInicial, minutoInicial, segundoInicial)
      : dataInicialObj;

    // 1. RECORRÊNCIA SEMANAL
    if (config.frequencia === 'semanal') {
      const diasSemanaAlvo = config.diasSemana && config.diasSemana.length > 0
        ? config.diasSemana
        : [dataInicialObj.getDay()];

      let cursor = new Date(dataPontoDePartida.getFullYear(), dataPontoDePartida.getMonth(), dataPontoDePartida.getDate());

      while (cursor.getTime() <= dataLimiteFinal.getTime() && ocorrencias.length < maxItems) {
        if (diasSemanaAlvo.includes(cursor.getDay())) {
          const dataStr = formatarDataStr(cursor);
          if (!excecoesSet.has(dataStr)) {
            const dataOcorr = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate(), horaInicial, minutoInicial, segundoInicial);
            ocorrencias.push({
              dataInicio: dataOcorr.toISOString(),
              dataFim: duracaoMs > 0 ? new Date(dataOcorr.getTime() + duracaoMs).toISOString() : null,
              numeroOcorrencia: ocorrencias.length + 1,
              dataBaseStr: dataStr,
            });
          }
        }
        // Avança 1 dia
        cursor.setDate(cursor.getDate() + 1);
      }
    }

    // 2. RECORRÊNCIA MENSAL POR ORDINAL (ex: 1º sábado, 2º sábado do mês)
    else if (config.frequencia === 'mensal_ordinal') {
      const ordinal = config.ordinal || 'primeiro';
      const diaSemana = config.diaSemanaOrdinal !== undefined ? config.diaSemanaOrdinal : dataInicialObj.getDay();

      let anoCursor = dataPontoDePartida.getFullYear();
      let mesCursor = dataPontoDePartida.getMonth();

      while (ocorrencias.length < maxItems) {
        const dataOrdinal = this.calcularDataOrdinalNoMes(anoCursor, mesCursor, ordinal, diaSemana);
        if (dataOrdinal) {
          dataOrdinal.setHours(horaInicial, minutoInicial, segundoInicial, 0);

          if (dataOrdinal.getTime() >= dataPontoDePartida.getTime()) {
            if (dataOrdinal.getTime() > dataLimiteFinal.getTime()) {
              break;
            }

            const dataStr = formatarDataStr(dataOrdinal);
            if (!excecoesSet.has(dataStr)) {
              ocorrencias.push({
                dataInicio: dataOrdinal.toISOString(),
                dataFim: duracaoMs > 0 ? new Date(dataOrdinal.getTime() + duracaoMs).toISOString() : null,
                numeroOcorrencia: ocorrencias.length + 1,
                dataBaseStr: dataStr,
              });
            }
          }
        }

        // Avança para o próximo mês
        mesCursor++;
        if (mesCursor > 11) {
          mesCursor = 0;
          anoCursor++;
        }

        // Condição de parada se ultrapassar o ano limite
        if (new Date(anoCursor, mesCursor, 1).getTime() > dataLimiteFinal.getTime()) {
          break;
        }
      }
    }

    // 3. RECORRÊNCIA MENSAL POR DIA FIXO (ex: todo dia 15)
    else if (config.frequencia === 'mensal_dia') {
      const diaAlvo = config.diaDoMes || dataInicialObj.getDate();

      let anoCursor = dataInicialObj.getFullYear();
      let mesCursor = dataInicialObj.getMonth();

      while (ocorrencias.length < maxItems) {
        const maxDiasMes = this.getDiasNoMes(anoCursor, mesCursor);
        // Trata meses mais curtos (ex: fevereiro, ou meses de 30 dias se diaAlvo for 31)
        const diaEfetivo = Math.min(diaAlvo, maxDiasMes);

        const dataMensal = new Date(anoCursor, mesCursor, diaEfetivo, horaInicial, minutoInicial, segundoInicial, 0);

        if (dataMensal.getTime() >= dataInicialObj.getTime()) {
          if (dataMensal.getTime() > dataLimiteFinal.getTime()) {
            break;
          }

          const dataStr = formatarDataStr(dataMensal);
          if (!excecoesSet.has(dataStr)) {
            ocorrencias.push({
              dataInicio: dataMensal.toISOString(),
              dataFim: duracaoMs > 0 ? new Date(dataMensal.getTime() + duracaoMs).toISOString() : null,
              numeroOcorrencia: ocorrencias.length + 1,
              dataBaseStr: dataStr,
            });
          }
        }

        mesCursor++;
        if (mesCursor > 11) {
          mesCursor = 0;
          anoCursor++;
        }

        if (new Date(anoCursor, mesCursor, 1).getTime() > dataLimiteFinal.getTime()) {
          break;
        }
      }
    }

    // 4. RECORRÊNCIA ANUAL (ex: 29 de fevereiro trata anos bissextos)
    else if (config.frequencia === 'anual') {
      const mesAlvo = dataInicialObj.getMonth();
      const diaAlvo = dataInicialObj.getDate();
      let anoCursor = dataInicialObj.getFullYear();

      while (ocorrencias.length < maxItems) {
        const maxDias = this.getDiasNoMes(anoCursor, mesAlvo);
        const diaEfetivo = Math.min(diaAlvo, maxDias);

        const dataAnual = new Date(anoCursor, mesAlvo, diaEfetivo, horaInicial, minutoInicial, segundoInicial, 0);
        if (dataAnual.getTime() >= dataInicialObj.getTime()) {
          if (dataAnual.getTime() > dataLimiteFinal.getTime()) {
            break;
          }

          const dataStr = formatarDataStr(dataAnual);
          if (!excecoesSet.has(dataStr)) {
            ocorrencias.push({
              dataInicio: dataAnual.toISOString(),
              dataFim: duracaoMs > 0 ? new Date(dataAnual.getTime() + duracaoMs).toISOString() : null,
              numeroOcorrencia: ocorrencias.length + 1,
              dataBaseStr: dataStr,
            });
          }
        }

        anoCursor++;
        if (new Date(anoCursor, 0, 1).getTime() > dataLimiteFinal.getTime()) {
          break;
        }
      }
    }

    return ocorrencias;
  }

  /**
   * Converte uma regra amigável de posicionamento ('primeiro_domingo', etc.) para RecorrenciaConfig
   */
  public static converterRegraPosicionamentoParaConfig(regra: string): RecorrenciaConfig | null {
    if (!regra) return null;

    const mapa: Record<string, { ordinal: OrdinalSemana; dia: number }> = {
      primeiro_domingo: { ordinal: 'primeiro', dia: 0 },
      segundo_domingo: { ordinal: 'segundo', dia: 0 },
      terceiro_domingo: { ordinal: 'terceiro', dia: 0 },
      quarto_domingo: { ordinal: 'quarto', dia: 0 },
      ultimo_domingo: { ordinal: 'ultimo', dia: 0 },
      primeiro_sabado: { ordinal: 'primeiro', dia: 6 },
      segundo_sabado: { ordinal: 'segundo', dia: 6 },
      terceiro_sabado: { ordinal: 'terceiro', dia: 6 },
      quarto_sabado: { ordinal: 'quarto', dia: 6 },
      ultimo_sabado: { ordinal: 'ultimo', dia: 6 },
      primeira_quarta: { ordinal: 'primeiro', dia: 3 },
      segunda_quarta: { ordinal: 'segundo', dia: 3 },
    };

    if (mapa[regra]) {
      return {
        frequencia: 'mensal_ordinal',
        ordinal: mapa[regra].ordinal,
        diaSemanaOrdinal: mapa[regra].dia,
      };
    }

    return null;
  }
}
