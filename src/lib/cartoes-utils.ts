/**
 * Utilidades para tratamento de placeholders em cartões
 */

export const PLACEHOLDERS_CONFIG = [
  { campo: 'nome', placeholder: '{nome}', label: 'Nome' },
  { campo: 'matricula', placeholder: '{matricula}', label: 'Matrícula' },
  { campo: 'cpf', placeholder: '{cpf}', label: 'CPF' },
  { campo: 'rg', placeholder: '{rg}', label: 'RG' },
  { campo: 'cargoMinisterial', placeholder: '{cargo_ministerial}', label: 'Cargo Ministerial' },
  { campo: 'filiacao', placeholder: '{filiacao}', label: 'Filiação' },
  { campo: 'nomePai', placeholder: '{nomePai}', label: 'Pai' },
  { campo: 'nomeMae', placeholder: '{nomeMae}', label: 'Mãe' },
  { campo: 'dataBatismo', placeholder: '{dataBatismo}', label: 'Data de Batismo' },
  { campo: 'dataConsagracao', placeholder: '{dataConsagracao}', label: 'Data de Consagração' },
  { campo: 'dataEmissao', placeholder: '{dataEmissao}', label: 'Data de Emissão' },
  { campo: 'validadeCredencial', placeholder: '{validadeCredencial}', label: 'Validade (Credencial)' },
  { campo: 'dataBatismoAguas', placeholder: '{dataBatismoAguas}', label: 'Batismo nas Águas' },
  { campo: 'dataBatismoEspiritoSanto', placeholder: '{dataBatismoEspiritoSanto}', label: 'Batismo no Espírito Santo' },
  { campo: 'validade', placeholder: '{validade}', label: 'Validade' },
  { campo: 'naturalidade', placeholder: '{naturalidade}', label: 'Naturalidade' },
  { campo: 'nacionalidade', placeholder: '{nacionalidade}', label: 'Nacionalidade' },
  { campo: 'estadoCivil', placeholder: '{estadoCivil}', label: 'Estado Civil' },
  { campo: 'tipoSanguineo', placeholder: '{tipoSanguineo}', label: 'Tipo Sanguíneo' },
  { campo: 'dataNascimento', placeholder: '{dataNascimento}', label: 'Data de Nascimento' },
  { campo: 'email', placeholder: '{email}', label: 'Email' },
  { campo: 'celular', placeholder: '{celular}', label: 'Celular' },
  { campo: 'whatsapp', placeholder: '{whatsapp}', label: 'WhatsApp' },
  { campo: 'endereco', placeholder: '{endereco}', label: 'Endereço Completo' },
  { campo: 'uniqueId', placeholder: '{uniqueId}', label: 'ID Único (QR Code)' },
  { campo: 'congregacao', placeholder: '{congregacao}', label: 'Congregação (Nome da Igreja Local)' }
  // Nota: Placeholders de divisões ({divisao1}, {divisao1_valor}, etc.) são tratados separadamente
  // com lógica dinâmica baseada em nomenclaturas
];

function parseDateFromInput(valor?: string): Date | null {
  if (!valor) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    const [ano, mes, dia] = valor.split('-').map(Number);
    const parsed = new Date(ano, mes - 1, dia);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(valor)) {
    const [dia, mes, ano] = valor.split('/').map(Number);
    const parsed = new Date(ano, mes - 1, dia);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const parsed = new Date(valor);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeNomenclaturasForCartoes(raw: any): any {
  if (!raw) return null;

  // Estrutura antiga: strings simples
  if (typeof raw.divisaoPrincipal === 'string') {
    return {
      divisaoPrincipal: { opcao1: raw.divisaoPrincipal },
      divisaoSecundaria: { opcao1: raw.divisaoSecundaria },
      divisaoTerciaria: { opcao1: raw.divisaoTerciaria },
    };
  }

  return raw;
}

import { formatCpf } from '@/lib/mascaras';

export function substituirPlaceholders(texto: string, membro: any, nomenclaturasInput?: any): string {
  if (!texto || !membro) return texto;

  let resultado = texto;

  const nomenclaturas: any = normalizeNomenclaturasForCartoes(nomenclaturasInput);

  // ============================================================
  // SUBSTITUIÇÕES DE DIVISÕES (Ordem crítica: valor ANTES de rótulo)
  // ============================================================

  // DIVISÃO 1 (Supervisão/Principal)
  const divisao1Label = nomenclaturas?.divisaoPrincipal?.opcao1 || 'IGREJA';
  const valorSupervisao = membro.supervisao || membro.supervisao_nome || '';
  
  // Primeiro: substituir valor {divisao1_valor}
  resultado = resultado.replace(/\{divisao1_valor\}/gi, valorSupervisao);
  
  // Depois: substituir rótulo {divisao1}
  resultado = resultado.replace(/\{divisao1\}(?!_)/gi, divisao1Label);
  
  // Padrão dinâmico {NOME DA [rótulo]}
  const nomeComDivisao1 = `{NOME DA ${divisao1Label}}`;
  resultado = resultado.replace(new RegExp(nomeComDivisao1.replace(/[{}]/g, '\\$&'), 'gi'), valorSupervisao);

  // DIVISÃO 2 (Região/Campo/Secundária)
  const divisao2Label = nomenclaturas?.divisaoSecundaria?.opcao1 || 'CAMPO';
  const valorRegiao = membro.campo || membro.campo_nome || '';
  
  // Primeiro: substituir valor {divisao2_valor}
  resultado = resultado.replace(/\{divisao2_valor\}/gi, valorRegiao);
  
  // Depois: substituir rótulo {divisao2}
  resultado = resultado.replace(/\{divisao2\}(?!_)/gi, divisao2Label);
  
  // Padrão dinâmico {NOME DA [rótulo]}
  const nomeComDivisao2 = `{NOME DA ${divisao2Label}}`;
  resultado = resultado.replace(new RegExp(nomeComDivisao2.replace(/[{}]/g, '\\$&'), 'gi'), valorRegiao);

  // DIVISÃO 3 (Congregação/Terciária)
  const divisao3Label = nomenclaturas?.divisaoTerciaria?.opcao1 || 'NENHUMA';
  const valorCongregacao = membro.congregacao || membro.congregacao_nome || '';
  
  // Primeiro: substituir valor {divisao3_valor}
  resultado = resultado.replace(/\{divisao3_valor\}/gi, valorCongregacao);
  
  // Depois: substituir rótulo {divisao3}
  resultado = resultado.replace(/\{divisao3\}(?!_)/gi, divisao3Label);
  
  // Padrão dinâmico {NOME DA [rótulo]}
  const nomeComDivisao3 = `{NOME DA ${divisao3Label}}`;
  resultado = resultado.replace(new RegExp(nomeComDivisao3.replace(/[{}]/g, '\\$&'), 'gi'), valorCongregacao);

  // ============================================================
  // SUBSTITUIÇÕES PADRÃO DE CAMPOS DO MEMBRO
  // ============================================================

  PLACEHOLDERS_CONFIG.forEach(ph => {
    const regex = new RegExp(ph.placeholder.replace(/[{}]/g, '\\$&'), 'gi');
    let valor = membro[ph.campo] ?? '';

    // Tratamentos especiais e fallbacks robustos

    if (ph.campo === 'cpf') {
      const rawCpf =
        membro.cpf ??
        membro.CPF ??
        membro.cpf_cnpj ??
        membro.cpf_formatado ??
        membro.custom_fields?.cpf ??
        membro.custom_fields?.CPF ??
        membro.customFields?.cpf ??
        '';
      valor = rawCpf ? formatCpf(String(rawCpf)) : '';
    }

    if (ph.campo === 'rg') {
      valor =
        membro.rg ??
        membro.RG ??
        membro.custom_fields?.rg ??
        membro.custom_fields?.RG ??
        membro.customFields?.rg ??
        valor ??
        '';
    }

    if (ph.campo === 'nome') {
      valor =
        membro.nome ??
        membro.name ??
        membro.custom_fields?.nome ??
        membro.custom_fields?.name ??
        valor ??
        '';
    }

    if (ph.campo === 'matricula') {
      valor =
        membro.matricula ??
        membro.custom_fields?.matricula ??
        valor ??
        '';
    }

    if (ph.campo === 'cargoMinisterial') {
      valor =
        membro.cargoMinisterial ||
        membro.cargo_ministerial ||
        membro.custom_fields?.cargoMinisterial ||
        membro.custom_fields?.cargo_ministerial ||
        membro.cargo ||
        '';
    }

    if (ph.campo === 'nomePai') {
      valor =
        membro.nomePai ||
        membro.nome_pai ||
        membro.custom_fields?.nomePai ||
        membro.custom_fields?.nome_pai ||
        '';
    }

    if (ph.campo === 'nomeMae') {
      valor =
        membro.nomeMae ||
        membro.nome_mae ||
        membro.custom_fields?.nomeMae ||
        membro.custom_fields?.nome_mae ||
        '';
    }

    if (ph.campo === 'filiacao') {
      const pai =
        membro.nomePai ||
        membro.nome_pai ||
        membro.custom_fields?.nomePai ||
        membro.custom_fields?.nome_pai ||
        '';
      const mae =
        membro.nomeMae ||
        membro.nome_mae ||
        membro.custom_fields?.nomeMae ||
        membro.custom_fields?.nome_mae ||
        '';
      valor = [pai, mae].filter(v => v).join(' e ');
    }

    if (ph.campo === 'naturalidade') {
      valor =
        membro.naturalidade ||
        membro.custom_fields?.naturalidade ||
        '';
    }

    if (ph.campo === 'nacionalidade') {
      valor =
        membro.nacionalidade ||
        membro.custom_fields?.nacionalidade ||
        'BRASILEIRA';
    }

    if (ph.campo === 'dataConsagracao') {
      valor =
        membro.dataConsagracao ||
        membro.data_consagracao ||
        membro.dataConsagracaoRecebimento ||
        membro.custom_fields?.dataConsagracao ||
        '';
    }

    if (ph.campo === 'dataEmissao') {
      valor =
        membro.dataEmissao ||
        membro.data_emissao ||
        membro.custom_fields?.dataEmissao ||
        '';
      if (!valor) {
        const hoje = new Date();
        const dia = String(hoje.getDate()).padStart(2, '0');
        const mes = String(hoje.getMonth() + 1).padStart(2, '0');
        const ano = hoje.getFullYear();
        valor = `${dia}/${mes}/${ano}`;
      }
    }

    if (ph.campo === 'dataBatismo' && !valor) {
      valor =
        membro.dataBatismo ||
        membro.data_batismo ||
        membro.dataBatismoAguas ||
        membro.data_batismo_aguas ||
        membro.custom_fields?.dataBatismo ||
        membro.custom_fields?.data_batismo ||
        membro.custom_fields?.dataBatismoAguas ||
        '';
    }

    // Tratamento dinâmico de Validade
    if (ph.campo === 'validade') {
      const anos = membro.validadeAnos || 1;
      const dataBase = new Date();
      dataBase.setFullYear(dataBase.getFullYear() + anos);

      const dia = String(dataBase.getDate()).padStart(2, '0');
      const mes = String(dataBase.getMonth() + 1).padStart(2, '0');
      const ano = dataBase.getFullYear();
      valor = `${dia}/${mes}/${ano}`;
    }

    if (ph.campo === 'validadeCredencial') {
      valor = membro.dataValidadeCredencial || membro.data_validade_credencial || membro.custom_fields?.dataValidadeCredencial || '';
      if (!valor) {
        const anos = membro.validadeAnos || 1;
        const dataEmissaoRaw = membro.dataEmissao || membro.data_emissao;
        const dataBase = parseDateFromInput(dataEmissaoRaw) || new Date();
        dataBase.setFullYear(dataBase.getFullYear() + anos);
        const dia = String(dataBase.getDate()).padStart(2, '0');
        const mes = String(dataBase.getMonth() + 1).padStart(2, '0');
        const ano = dataBase.getFullYear();
        valor = `${dia}/${mes}/${ano}`;
      }
    }

    // Tratamento de Estado Civil conforme sexo
    if (ph.campo === 'estadoCivil') {
      const sexo = String(membro.sexo || membro.custom_fields?.sexo || '').toUpperCase();
      const isFeminino = sexo === 'FEMININO' || sexo === 'F';
      const raw = String(membro.estadoCivil || membro.estado_civil || membro.custom_fields?.estadoCivil || membro.custom_fields?.estado_civil || '').toLowerCase().trim();
      // Normaliza variantes femininas/masculinas para a raiz neutra
      const normalizado = raw
        .replace(/^casada$/, 'casado')
        .replace(/^solteira$/, 'solteiro')
        .replace(/^viúva$/, 'viuvo')
        .replace(/^viuva$/, 'viuvo')
        .replace(/^divorciada$/, 'divorciado');
      if (normalizado === 'casado') valor = isFeminino ? 'Casada' : 'Casado';
      else if (normalizado === 'solteiro') valor = isFeminino ? 'Solteira' : 'Solteiro';
      else if (normalizado === 'viuvo') valor = isFeminino ? 'Viúva' : 'Viúvo';
      else if (normalizado === 'divorciado') valor = isFeminino ? 'Divorciada' : 'Divorciado';
      else if (normalizado === 'uniao_estavel' || normalizado === 'uniao estavel') valor = 'União Estável';
      else if (normalizado === 'outros' || normalizado === 'outro') valor = 'Outros';
      else valor = membro.estadoCivil || membro.estado_civil || membro.custom_fields?.estadoCivil || '';
    }

    // Formatação de data (se for do tipo YYYY-MM-DD)
    if (typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor)) {
      const [ano, mes, dia] = valor.split('-');
      valor = `${dia}/${mes}/${ano}`;
    }

    // Para endereço completo, monta a string
    if (ph.campo === 'endereco') {
      valor = [membro.logradouro, membro.numero, membro.bairro, membro.cidade]
        .filter((v: string) => v)
        .join(', ');
    }

    resultado = resultado.replace(regex, String(valor));
  });

  return resultado;
}

export function obterPreviewTexto(texto: string, nomenclaturasInput?: any): string {
  if (!texto) return 'Texto';

  let preview = texto;

  const nomenclaturas: any = normalizeNomenclaturasForCartoes(nomenclaturasInput);

  // Tratamento ESPECIAL para {divisao3} - mostra rótulo real ao invés do label genérico
  // Importante: usar regex que não capture {divisao3_valor} - deve ser exatamente {divisao3}
  if (nomenclaturas) {
    const divisao3Label = nomenclaturas.divisaoTerciaria?.opcao1 || 'NENHUMA';
    const regex3 = new RegExp('\\{divisao3\\}(?!_)', 'g'); // Negative lookahead para não pegar {divisao3_valor}
    preview = preview.replace(regex3, divisao3Label);

    // Atualizar {divisao3_valor} no preview para mostrar "NOME DA CONGREGAÇÃO"
    // Precisa funcionar com ou sem tags HTML
    const regexDivisao3Valor = /\{divisao3_valor\}/g;
    preview = preview.replace(regexDivisao3Valor, `NOME DA ${divisao3Label}`);
  }

  PLACEHOLDERS_CONFIG.forEach(ph => {
    // Pular {divisao3} e {divisao3_valor} já que foram processados acima
    if (ph.placeholder === '{divisao3}' || ph.placeholder === '{divisao3_valor}') {
      return;
    }
    const regex = new RegExp(ph.placeholder.replace(/[{}]/g, '\\$&'), 'g');
    preview = preview.replace(regex, `[${ph.label}]`);
  });

  return preview;
}

/**
 * Obter mensagem de erro quando não há template ativo
 */
export function getMensagemSemTemplate(tipoCadastro: string): string {
  const tipoFormatado = tipoCadastro.charAt(0).toUpperCase() + tipoCadastro.slice(1);
  return `Não há template ativo para ${tipoFormatado}. Configure um template em Configurações → Cartões.`;
}
