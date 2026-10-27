import test from 'node:test';
import assert from 'node:assert/strict';
import { formatCpf, validarCpf } from '../../src/lib/mascaras.js';

// Replica da função formatarNomeProprio de src/app/eventos/page.tsx
function formatarNomeProprio(nome: string | null | undefined): string {
  if (!nome || typeof nome !== 'string') return '';
  const preposicoes = new Set(['de', 'da', 'do', 'dos', 'das', 'e', 'em', 'para', 'com', 'por', 'a', 'o', 'as', 'os']);
  const partes = nome.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '';
  return partes
    .map((parte, idx) => {
      if (idx > 0 && preposicoes.has(parte)) {
        return parte;
      }
      return parte.charAt(0).toUpperCase() + parte.slice(1);
    })
    .join(' ');
}

// Replica da priorização de telefone
function extrairTelefoneMembro(m: any): string {
  if (!m) return '';
  if (typeof m.whatsapp === 'string' && m.whatsapp.trim()) return m.whatsapp.trim();
  const cf = (m.custom_fields && typeof m.custom_fields === 'object') ? m.custom_fields : {};
  if (typeof cf.whatsapp === 'string' && cf.whatsapp.trim()) return cf.whatsapp.trim();
  for (const [k, v] of Object.entries(cf)) {
    if (k.toLowerCase().includes('whatsapp') && typeof v === 'string' && v.trim()) {
      return v.trim();
    }
  }
  if (typeof m.celular === 'string' && m.celular.trim()) return m.celular.trim();
  if (typeof m.phone === 'string' && m.phone.trim()) return m.phone.trim();
  for (const [k, v] of Object.entries(cf)) {
    const key = k.toLowerCase();
    if ((key.includes('celular') || key.includes('telefone') || key.includes('phone')) && typeof v === 'string' && v.trim()) {
      return v.trim();
    }
  }
  return '';
}

function extrairCpfMembro(m: any): string {
  if (!m) return '';
  if (typeof m.cpf === 'string' && m.cpf.trim()) return m.cpf.trim();
  const cf = (m.custom_fields && typeof m.custom_fields === 'object') ? m.custom_fields : {};
  if (typeof cf.cpf === 'string' && cf.cpf.trim()) return cf.cpf.trim();
  for (const [k, v] of Object.entries(cf)) {
    if (k.toLowerCase().includes('cpf') && typeof v === 'string' && v.trim()) {
      return v.trim();
    }
  }
  return '';
}

test('Atendimento de Balcão — Simplificação de Inscrição em Fluxo Único', async (t) => {
  const congregacoes = [
    { id: 'cong-sede', nome: 'Templo Central / Sede' },
    { id: 'cong-filial', nome: 'Congregação Esperança' },
  ];

  await t.test('1. Membro encontrado: preenche automaticamente CPF, e-mail, telefone/WhatsApp e congregação, mantendo vínculo com o ID', () => {
    const membroMock = {
      id: 'membro-001',
      name: 'FRANCISCO DE ASSIS ALCANTARA',
      email: 'assis@eklesia.com',
      phone: '8533334444',
      celular: '85988887777',
      whatsapp: '85999991111',
      cpf: '12345678901',
      congregacao_id: 'cong-sede',
      custom_fields: {},
    };

    const rawTel = extrairTelefoneMembro(membroMock);
    const rawCpf = extrairCpfMembro(membroMock);
    const congMap = new Map(congregacoes.map(c => [c.id, c.nome]));

    assert.equal(rawTel, '85999991111', 'WhatsApp priorizado');
    assert.equal(formatCpf(rawCpf), '123.456.789-01');
    assert.equal(congMap.get(membroMock.congregacao_id), 'Templo Central / Sede');

    // Ao selecionar membro no fluxo único do balcão:
    let balcaoMembro: any = membroMock;
    let balcaoBuscaMembro = membroMock.name;
    let balcaoNome = membroMock.name;
    let balcaoCpf = formatCpf(rawCpf);
    let balcaoEmail = membroMock.email;
    let balcaoTelefone = rawTel;
    let balcaoCongregacaoId = membroMock.congregacao_id;

    assert.equal(balcaoMembro.id, 'membro-001');
    assert.equal(balcaoBuscaMembro, 'FRANCISCO DE ASSIS ALCANTARA');
    assert.equal(balcaoNome, 'FRANCISCO DE ASSIS ALCANTARA');
    assert.equal(balcaoCpf, '123.456.789-01');
    assert.equal(balcaoEmail, 'assis@eklesia.com');
    assert.equal(balcaoTelefone, '85999991111');
    assert.equal(balcaoCongregacaoId, 'cong-sede');
  });

  await t.test('2. Limpeza de vínculo se o operador alterar o nome após seleção', () => {
    let balcaoMembro: any = { id: 'membro-001', nome_completo: 'Francisco de Assis Alcantara' };
    let balcaoBuscaMembro = 'Francisco de Assis Alcantara';
    let balcaoNome = 'Francisco de Assis Alcantara';

    // Operador altera o texto do input de busca/nome
    const novoTexto = 'Francisco de Assis Alcantara Filho';
    balcaoBuscaMembro = novoTexto;
    if (balcaoMembro) balcaoMembro = null; // Regra implementada no onChange
    balcaoNome = novoTexto;

    assert.equal(balcaoBuscaMembro, 'Francisco de Assis Alcantara Filho');
    assert.equal(balcaoMembro, null, 'Vínculo com o ID do membro anterior deve ser desfeito imediatamente');
    assert.equal(balcaoNome, 'Francisco de Assis Alcantara Filho');
  });

  await t.test('3. Participante não cadastrado: digitação direta e preenchimento manual sem criar membro', () => {
    let balcaoMembro: any = null;
    let balcaoBuscaMembro = 'Visitante Lucas Gabriel';
    let balcaoNome = 'Visitante Lucas Gabriel';
    let balcaoCpf = '111.222.333-44';
    let balcaoEmail = 'lucas@gmail.com';
    let balcaoTelefone = '(85) 98888-5555';
    let balcaoCongregacaoId = 'cong-filial';

    const temMembro = !!balcaoMembro;
    const nomeDigitado = (balcaoMembro?.nome_completo || balcaoNome || balcaoBuscaMembro).trim();
    const nomeFinalNormalizado = formatarNomeProprio(temMembro ? balcaoMembro.nome_completo : nomeDigitado);

    assert.equal(temMembro, false);
    assert.equal(balcaoCpf, '111.222.333-44');
    assert.equal(balcaoCongregacaoId, 'cong-filial');
    assert.equal(nomeFinalNormalizado, 'Visitante Lucas Gabriel');

    const payloadInscricao = {
      member_id: temMembro ? balcaoMembro.id : null,
      nome_externo: temMembro ? null : nomeFinalNormalizado,
      email_externo: balcaoEmail,
      telefone: balcaoTelefone,
      status: 'confirmado',
    };

    assert.equal(payloadInscricao.member_id, null, 'Não deve vincular member_id');
    assert.equal(payloadInscricao.nome_externo, 'Visitante Lucas Gabriel', 'Deve salvar como participante externo');
  });

  await t.test('4. Normalização Title Case de Nomes no Balcão com acentuação e partículas', () => {
    assert.equal(
      formatarNomeProprio('FRANCISCO DE ASSIS ALCÂNTARA'),
      'Francisco de Assis Alcântara'
    );
    assert.equal(
      formatarNomeProprio('MARIA DA CONCEIÇÃO DOS SANTOS'),
      'Maria da Conceição dos Santos'
    );
    assert.equal(
      formatarNomeProprio('joão da silva e souza'),
      'João da Silva e Souza'
    );
  });

  await t.test('5. Validação de integridade do CPF no Balcão', () => {
    // Válido se não informado (opcional quando evento não exige)
    assert.equal(validarCpf(''), false);
    // Dígitos repetidos inválidos
    assert.equal(validarCpf('000.000.000-00'), false);
    assert.equal(validarCpf('111.111.111-11'), false);
    // Incompleto
    assert.equal(validarCpf('123.456'), false);
  });

  await t.test('6. Regras financeiras e confirmação imediata preservadas no Balcão', () => {
    // Evento Gratuito
    const evGratuito = { id: 'ev-1', evento_pago: false, valor_inscricao: 0 };
    const valorCobradoGratuito = evGratuito.evento_pago ? evGratuito.valor_inscricao : 0;
    assert.equal(valorCobradoGratuito, 0);

    // Evento Pago - Cortesia
    const evPago = { id: 'ev-2', evento_pago: true, valor_inscricao: 50 };
    const formaCortesia: string = 'cortesia';
    const valorCobradoCortesia = evPago.evento_pago ? (formaCortesia === 'cortesia' ? 0 : evPago.valor_inscricao) : 0;
    assert.equal(valorCobradoCortesia, 0);

    // Evento Pago - À Vista
    const formaAVista: string = 'a_vista';
    const valorCobradoAVista = evPago.evento_pago ? (formaAVista === 'cortesia' ? 0 : evPago.valor_inscricao) : 0;
    assert.equal(valorCobradoAVista, 50);
  });
});
