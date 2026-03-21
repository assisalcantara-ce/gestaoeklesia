import { NextRequest, NextResponse } from 'next/server';

interface SubstituicaoRequest {
  texto: string;
  membro: {
    id?: string;
    uniqueId?: string;
    matricula?: string;
    nome?: string;
    cpf?: string;
    cargo?: string;
    dataNascimento?: string;
    email?: string;
    celular?: string;
    whatsapp?: string;
    logradouro?: string;
    numero?: string;
    bairro?: string;
    cidade?: string;
    [key: string]: any;
  };
}

const PLACEHOLDERS = [
  { campo: 'nome', placeholder: '{nome}' },
  { campo: 'matricula', placeholder: '{matricula}' },
  { campo: 'cpf', placeholder: '{cpf}' },
  { campo: 'cargo', placeholder: '{cargo}' },
  { campo: 'congregacao', placeholder: '{divisao3_valor}' },
  { campo: 'dataNascimento', placeholder: '{dataNascimento}' },
  { campo: 'email', placeholder: '{email}' },
  { campo: 'celular', placeholder: '{celular}' },
  { campo: 'whatsapp', placeholder: '{whatsapp}' },
  { campo: 'endereco', placeholder: '{endereco}' },
  { campo: 'uniqueId', placeholder: '{uniqueId}' }
];

function substituirPlaceholders(texto: string, membro: any, nomenclaturas?: any): string {
  if (!texto || !membro) return texto;
  
  let resultado = texto;
  
  // MIGRAÇÃO: Converter estrutura antiga (simples) para nova (com opcao1)
  if (nomenclaturas && typeof nomenclaturas.divisaoPrincipal === 'string') {
    console.log('🔄 Migrando nomenclaturas de estrutura antiga para nova (API)');
    nomenclaturas = {
      divisaoPrincipal: { opcao1: nomenclaturas.divisaoPrincipal },
      divisaoSecundaria: { opcao1: nomenclaturas.divisaoSecundaria },
      divisaoTerciaria: { opcao1: nomenclaturas.divisaoTerciaria }
    };
  }
  
  // ============================================================
  // SUBSTITUIÇÕES DE DIVISÕES (Ordem crítica: valor ANTES de rótulo)
  // ============================================================

  // DIVISÃO 1 (Supervisão/Principal)
  const divisao1Label = nomenclaturas?.divisaoPrincipal?.opcao1 || 'SUPERVISÃO';
  const valorSupervisao = membro.supervisao || '';
  
  // Primeiro: substituir valor {divisao1_valor}
  resultado = resultado.replace(/\{divisao1_valor\}/g, valorSupervisao);
  
  // Depois: substituir rótulo {divisao1}
  resultado = resultado.replace(/\{divisao1\}(?!_)/g, divisao1Label);
  
  // Padrão dinâmico {NOME DA [rótulo]}
  const nomeComDivisao1 = `{NOME DA ${divisao1Label}}`;
  resultado = resultado.replace(new RegExp(nomeComDivisao1.replace(/[{}]/g, '\\$&'), 'g'), valorSupervisao);

  // DIVISÃO 2 (Região/Campo/Secundária)
  const divisao2Label = nomenclaturas?.divisaoSecundaria?.opcao1 || 'REGIÃO';
  const valorRegiao = membro.campo || '';
  
  // Primeiro: substituir valor {divisao2_valor}
  resultado = resultado.replace(/\{divisao2_valor\}/g, valorRegiao);
  
  // Depois: substituir rótulo {divisao2}
  resultado = resultado.replace(/\{divisao2\}(?!_)/g, divisao2Label);
  
  // Padrão dinâmico {NOME DA [rótulo]}
  const nomeComDivisao2 = `{NOME DA ${divisao2Label}}`;
  resultado = resultado.replace(new RegExp(nomeComDivisao2.replace(/[{}]/g, '\\$&'), 'g'), valorRegiao);

  // DIVISÃO 3 (Congregação/Terciária)
  const divisao3Label = nomenclaturas?.divisaoTerciaria?.opcao1 || 'CONGREGAÇÃO';
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

  PLACEHOLDERS.forEach(ph => {
    const regex = new RegExp(ph.placeholder.replace(/[{}]/g, '\\$&'), 'g');
    let valor = membro[ph.campo] || '';
    
    // Para endereço completo, monta a string
    if (ph.campo === 'endereco') {
      valor = [membro.logradouro, membro.numero, membro.bairro, membro.cidade]
        .filter((v: string) => v)
        .join(', ');
    }
    
    resultado = resultado.replace(regex, valor);
  });
  
  return resultado;
}

export async function POST(request: NextRequest) {
  try {
    const body: SubstituicaoRequest = await request.json();
    
    if (!body.texto || !body.membro) {
      return NextResponse.json(
        { error: 'texto e membro são obrigatórios' },
        { status: 400 }
      );
    }
    
    // Carregar nomenclaturas do localStorage (simulado via headers ou body)
    // Na API, não temos acesso direto ao localStorage, então seria preciso passar via request
    // Por enquanto, deixaremos undefined e a função usará o padrão
    const nomenclaturas = undefined;
    
    const textoSubstituido = substituirPlaceholders(body.texto, body.membro, nomenclaturas);
    
    return NextResponse.json({
      sucesso: true,
      textoOriginal: body.texto,
      textoSubstituido,
      membro: body.membro
    });
  } catch (error) {
    console.error('Erro ao substituir placeholders:', error);
    return NextResponse.json(
      { error: 'Erro ao processar requisição' },
      { status: 500 }
    );
  }
}
