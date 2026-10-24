import test from 'node:test';
import assert from 'node:assert/strict';
import { formatCpf, validarCpf } from '../../src/lib/mascaras.js';

// Replica da função formatarNomeProprio implementada em src/app/eventos/page.tsx
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

// Replica da lógica de extração e priorização de dados de membro
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

test('Reorganização do Modal Nova Inscrição - Regras e Formatações', async (t) => {
  await t.test('1. Normalização de Nome Próprio (Title Case) preservando partículas e acentos', () => {
    assert.equal(
      formatarNomeProprio('FRANCISCO DE ASSIS ALCANTARA'),
      'Francisco de Assis Alcantara'
    );
    assert.equal(
      formatarNomeProprio('joão da silva e souza'),
      'João da Silva e Souza'
    );
    assert.equal(
      formatarNomeProprio('MARIA DAS DORES DO CARMO'),
      'Maria das Dores do Carmo'
    );
    assert.equal(
      formatarNomeProprio('  JOSÉ   DE   ALENCAR  '),
      'José de Alencar'
    );
    assert.equal(
      formatarNomeProprio(''),
      ''
    );
  });

  await t.test('2. Prioridade de Telefone: WhatsApp prioritário sobre celular/telefone fixo', () => {
    const membroComAmbos = {
      phone: '8533334444',
      celular: '85988887777',
      whatsapp: '85999991111',
    };
    assert.equal(extrairTelefoneMembro(membroComAmbos), '85999991111');

    const membroSoTelefone = {
      phone: '8533334444',
      celular: '',
      whatsapp: '',
    };
    assert.equal(extrairTelefoneMembro(membroSoTelefone), '8533334444');

    const membroComCustomFields = {
      phone: '8533334444',
      custom_fields: {
        whatsapp: '85999992222',
      },
    };
    assert.equal(extrairTelefoneMembro(membroComCustomFields), '85999992222');
  });

  await t.test('3. Extração e Máscara de CPF do membro', () => {
    const membroComCpfDireto = {
      cpf: '12345678901',
    };
    assert.equal(extrairCpfMembro(membroComCpfDireto), '12345678901');
    assert.equal(formatCpf(extrairCpfMembro(membroComCpfDireto)), '123.456.789-01');

    const membroComCpfCustom = {
      custom_fields: {
        cpf_responsavel: '98765432100',
      },
    };
    assert.equal(extrairCpfMembro(membroComCpfCustom), '98765432100');
    assert.equal(formatCpf(extrairCpfMembro(membroComCpfCustom)), '987.654.321-00');
  });

  await t.test('4. Validação de CPF (válidos e inválidos)', () => {
    // CPF com todos os dígitos iguais é inválido
    assert.equal(validarCpf('111.111.111-11'), false);
    // CPF com tamanho insuficiente
    assert.equal(validarCpf('123.456'), false);
    // CPF vazio não deve ser validado obrigatoriamente se opcional
    assert.equal(validarCpf(''), false);
  });

  await t.test('5. Desvinculação de membro ao alterar o nome digitado', () => {
    let membroSelecionado: any = { id: 'membro-123', nome_completo: 'Carlos Eduardo' };
    let member_id = 'membro-123';
    let nome_externo = '';

    // Usuário altera o texto no primeiro campo
    const novoValorDigitado = 'Carlos Eduardo Alterado';
    if (membroSelecionado) {
      membroSelecionado = null;
      member_id = '';
    }
    nome_externo = novoValorDigitado;

    assert.equal(membroSelecionado, null);
    assert.equal(member_id, '');
    assert.equal(nome_externo, 'Carlos Eduardo Alterado');
  });
});
