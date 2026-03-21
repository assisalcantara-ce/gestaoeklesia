/**
 * Utilidades para tratamento de placeholders em cartões
 */

export const PLACEHOLDERS_CONFIG = [
  { campo: 'nome', placeholder: '{nome}', label: 'Nome' },
  { campo: 'matricula', placeholder: '{matricula}', label: 'Matrícula' },
  { campo: 'cpf', placeholder: '{cpf}', label: 'CPF' },
  { campo: 'rg', placeholder: '{rg}', label: 'RG' },
  { campo: 'cargo', placeholder: '{cargo}', label: 'Cargo' },
  { campo: 'filiacao', placeholder: '{filiacao}', label: 'Filiação' },
  { campo: 'dataBatismo', placeholder: '{dataBatismo}', label: 'Data de Batismo' },
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

export function substituirPlaceholders(texto: string, membro: any, nomenclaturasInput?: any): string {
  if (!texto || !membro) return texto;

  let resultado = texto;

  const nomenclaturas: any = normalizeNomenclaturasForCartoes(nomenclaturasInput);

  // ============================================================
  // SUBSTITUIÇÕES DE DIVISÕES (Ordem crítica: valor ANTES de rótulo)
  // ============================================================

  // DIVISÃO 1 (Supervisão/Principal)
  const divisao1Label = nomenclaturas?.divisaoPrincipal?.opcao1 || 'IGREJA';
  const valorSupervisao = membro.supervisao || '';
  
  // Primeiro: substituir valor {divisao1_valor}
  resultado = resultado.replace(/\{divisao1_valor\}/g, valorSupervisao);
  
  // Depois: substituir rótulo {divisao1}
  resultado = resultado.replace(/\{divisao1\}(?!_)/g, divisao1Label);
  
  // Padrão dinâmico {NOME DA [rótulo]}
  const nomeComDivisao1 = `{NOME DA ${divisao1Label}}`;
  resultado = resultado.replace(new RegExp(nomeComDivisao1.replace(/[{}]/g, '\\$&'), 'g'), valorSupervisao);

  // DIVISÃO 2 (Região/Campo/Secundária)
  const divisao2Label = nomenclaturas?.divisaoSecundaria?.opcao1 || 'CAMPO';
  const valorRegiao = membro.campo || '';
  
  // Primeiro: substituir valor {divisao2_valor}
  resultado = resultado.replace(/\{divisao2_valor\}/g, valorRegiao);
  
  // Depois: substituir rótulo {divisao2}
  resultado = resultado.replace(/\{divisao2\}(?!_)/g, divisao2Label);
  
  // Padrão dinâmico {NOME DA [rótulo]}
  const nomeComDivisao2 = `{NOME DA ${divisao2Label}}`;
  resultado = resultado.replace(new RegExp(nomeComDivisao2.replace(/[{}]/g, '\\$&'), 'g'), valorRegiao);

  // DIVISÃO 3 (Congregação/Terciária)
  const divisao3Label = nomenclaturas?.divisaoTerciaria?.opcao1 || 'NENHUMA';
  const valorCongregacao = membro.congregacao || '';
  
  // Primeiro: substituir valor {divisao3_valor}
  resultado = resultado.replace(/\{divisao3_valor\}/g, valorCongregacao);
  
  // Depois: substituir rótulo {divisao3}
  resultado = resultado.replace(/\{divisao3\}(?!_)/g, divisao3Label);
  
  // Padrão dinâmico {NOME DA [rótulo]}
  const nomeComDivisao3 = `{NOME DA ${divisao3Label}}`;
  resultado = resultado.replace(new RegExp(nomeComDivisao3.replace(/[{}]/g, '\\$&'), 'g'), valorCongregacao);

  // ============================================================
  // SUBSTITUIÇÕES PADRÃO DE CAMPOS DO MEMBRO
  // ============================================================


  PLACEHOLDERS_CONFIG.forEach(ph => {
    const regex = new RegExp(ph.placeholder.replace(/[{}]/g, '\\$&'), 'g');
    let valor = membro[ph.campo] || '';

    // Tratamentos especiais
    if (ph.campo === 'filiacao') {
      valor = [membro.nomePai, membro.nomeMae]
        .filter(v => v)
        .join(' e ');
    }

    if (ph.campo === 'dataBatismo' && !valor) {
      valor = membro.dataBatismoAguas || '';
    }

    // Tratamento dinâmico de Validade
    if (ph.campo === 'validade') {
      // Se tiver validadeAnos configurado (vem do template em uso)
      const anos = membro.validadeAnos || 1;
      const dataBase = new Date();
      dataBase.setFullYear(dataBase.getFullYear() + anos);

      const dia = String(dataBase.getDate()).padStart(2, '0');
      const mes = String(dataBase.getMonth() + 1).padStart(2, '0');
      const ano = dataBase.getFullYear();
      valor = `${dia}/${mes}/${ano}`;
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
