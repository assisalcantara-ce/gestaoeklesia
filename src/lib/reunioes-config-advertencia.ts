/**
 * Tipos e utilitários para as configurações institucionais da Carta de Advertência Ministerial.
 * Módulo: Reuniões Ministeriais - Gestão Eklésia
 */

export interface ConfigAdvertenciaMinisterial {
  texto_abertura: string;
  fundamentacao_estatutaria: string;
  texto_complementar: string;
  texto_encerramento: string;
  updated_at?: string | null;
  updated_by?: string | null;
}

export interface VariaveisAdvertencia {
  nome_ministro?: string | null;
  cargo?: string | null;
  matricula?: string | null;
  ministerio?: string | null;
  data_reuniao?: string | null;
  data_falta?: string | null;
  protocolo?: string | null;
  responsavel?: string | null;
}

/**
 * Fallback genérico seguro: NÃO faz afirmações falsas sobre artigos estatutários/regimentais.
 * A fundamentação estatutária padrão é mantida vazia para que cada denominação informe seus artigos próprios.
 */
export const CONFIG_ADVERTENCIA_PADRAO: ConfigAdvertenciaMinisterial = {
  texto_abertura:
    'Servimo-nos da presente para NOTIFICAR formalmente Vossa Senhoria acerca do registro de ausência na convocação ministerial supracitada, promovida pela Diretoria e Liderança Geral desta instituição.',
  fundamentacao_estatutaria: '',
  texto_complementar:
    'Faculta-se a apresentação de justificativa formal por escrito perante a liderança responsável, no prazo regulamentar, acompanhada da devida comprovação, para a devida apreciação.',
  texto_encerramento:
    'Em anexo, segue o espaço reservado para manifestação de próprio punho e formalização de ciência.',
  updated_at: null,
  updated_by: null,
};

export const CHIPS_VARIAVEIS_DISPONIVEIS: Array<{ tag: string; label: string; descricao: string }> = [
  { tag: '{{nome_ministro}}', label: 'Nome do Ministro', descricao: 'Nome completo do obreiro notificado' },
  { tag: '{{cargo}}', label: 'Cargo / Função', descricao: 'Cargo ministerial do obreiro no momento da falta' },
  { tag: '{{matricula}}', label: 'Matrícula', descricao: 'Número de matrícula ou cadastro do membro' },
  { tag: '{{ministerio}}', label: 'Nome da Igreja', descricao: 'Razão social ou nome fantasia do ministério' },
  { tag: '{{data_reuniao}}', label: 'Data da Reunião', descricao: 'Data em que a reunião convocada ocorreu' },
  { tag: '{{data_falta}}', label: 'Data da Falta', descricao: 'Data de registro do lançamento da falta' },
  { tag: '{{protocolo}}', label: 'Nº do Protocolo', descricao: 'Identificador único de autenticidade da carta' },
  { tag: '{{responsavel}}', label: 'Pastor / Responsável', descricao: 'Nome do Pastor Presidente ou Secretário Geral' },
];

/**
 * Normaliza e mescla o objeto vindo do banco com os valores padrão seguros.
 */
export function normalizarConfigAdvertencia(raw?: any): ConfigAdvertenciaMinisterial {
  if (!raw || typeof raw !== 'object') {
    return { ...CONFIG_ADVERTENCIA_PADRAO };
  }

  return {
    texto_abertura:
      typeof raw.texto_abertura === 'string' && raw.texto_abertura.trim().length > 0
        ? raw.texto_abertura.trim()
        : CONFIG_ADVERTENCIA_PADRAO.texto_abertura,
    fundamentacao_estatutaria:
      typeof raw.fundamentacao_estatutaria === 'string'
        ? raw.fundamentacao_estatutaria.trim()
        : CONFIG_ADVERTENCIA_PADRAO.fundamentacao_estatutaria,
    texto_complementar:
      typeof raw.texto_complementar === 'string' && raw.texto_complementar.trim().length > 0
        ? raw.texto_complementar.trim()
        : CONFIG_ADVERTENCIA_PADRAO.texto_complementar,
    texto_encerramento:
      typeof raw.texto_encerramento === 'string' && raw.texto_encerramento.trim().length > 0
        ? raw.texto_encerramento.trim()
        : CONFIG_ADVERTENCIA_PADRAO.texto_encerramento,
    updated_at: raw.updated_at || null,
    updated_by: raw.updated_by || null,
  };
}

/**
 * Substitui as variáveis dinâmicas no texto sanitizando caracteres de escape para renderização.
 * Não quebra em caso de tags desconhecidas.
 */
export function interpolarVariaveisAdvertencia(
  template: string,
  variaveis: VariaveisAdvertencia
): string {
  if (!template || typeof template !== 'string') return '';

  const mapa: Record<string, string> = {
    nome_ministro: (variaveis.nome_ministro || '').trim(),
    cargo: (variaveis.cargo || '').trim(),
    matricula: (variaveis.matricula || '—').trim(),
    ministerio: (variaveis.ministerio || 'Gestão Eklésia').trim(),
    data_reuniao: (variaveis.data_reuniao || '—').trim(),
    data_falta: (variaveis.data_falta || variaveis.data_reuniao || '—').trim(),
    protocolo: (variaveis.protocolo || '—').trim(),
    responsavel: (variaveis.responsavel || 'Diretoria Executiva / Secretaria Geral').trim(),
  };

  // Substitui {{tag}} de forma case-insensitive
  return template.replace(/\{\{\s*([a-zA-Z0-9_-]+)\s*\}\}/g, (match, tag) => {
    const key = tag.toLowerCase();
    if (Object.prototype.hasOwnProperty.call(mapa, key)) {
      return mapa[key] || '';
    }
    // Tag desconhecida: mantém sem quebrar
    return match;
  });
}
