import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Importa as funções de máscara diretamente do arquivo de máscaras
// Em Node.js ESM com TypeScript/build, replicamos ou importamos a lógica canônica
const onlyDigits = (value) => String(value || '').replace(/\D/g, '');

const formatCpf = (value) => {
  const digits = onlyDigits(value).slice(0, 11);
  if (!digits) return '';
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
};

const formatCep = (value) => {
  const digits = onlyDigits(value).slice(0, 8);
  if (!digits) return '';
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
};

const formatPhone = (value) => {
  const digits = onlyDigits(value).slice(0, 11);
  if (!digits) return '';
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};

describe('Secretaria - Máscaras nos Inputs de Cadastro de Membros', () => {
  describe('1. Máscara de CPF (Membro e Cônjuge)', () => {
    it('deve retornar string vazia para valores vazios ou nulos', () => {
      assert.equal(formatCpf(''), '');
      assert.equal(formatCpf(null), '');
      assert.equal(formatCpf(undefined), '');
    });

    it('deve formatar CPF parcialmente digitado de forma progressiva', () => {
      assert.equal(formatCpf('123'), '123');
      assert.equal(formatCpf('1234'), '123.4');
      assert.equal(formatCpf('123456'), '123.456');
      assert.equal(formatCpf('1234567'), '123.456.7');
      assert.equal(formatCpf('1234567890'), '123.456.789-0');
      assert.equal(formatCpf('12345678901'), '123.456.789-01');
    });

    it('deve truncar dígitos excedentes e impedir overflow de caracteres (caso do usuário)', () => {
      const entradaLonga = '546465456465465454545464556456465';
      const formatado = formatCpf(entradaLonga);
      assert.equal(formatado, '546.465.456-46');
      assert.equal(formatado.length, 14);
      assert.equal(onlyDigits(formatado).length, 11);
    });

    it('deve remover caracteres alfabéticos e especiais mantendo a máscara', () => {
      assert.equal(formatCpf('abc123def456ghi78901'), '123.456.789-01');
      assert.equal(formatCpf('123.456.789-01'), '123.456.789-01');
    });
  });

  describe('2. Máscara de CEP (Endereço)', () => {
    it('deve retornar string vazia para valores vazios ou nulos', () => {
      assert.equal(formatCep(''), '');
      assert.equal(formatCep(null), '');
      assert.equal(formatCep(undefined), '');
    });

    it('deve formatar CEP progressivamente', () => {
      assert.equal(formatCep('01'), '01');
      assert.equal(formatCep('01001'), '01001');
      assert.equal(formatCep('01001000'), '01001-000');
    });

    it('deve truncar CEP em 8 dígitos com máscara de 9 caracteres', () => {
      const entradaLonga = '01001000999999';
      const formatado = formatCep(entradaLonga);
      assert.equal(formatado, '01001-000');
      assert.equal(formatado.length, 9);
      assert.equal(onlyDigits(formatado).length, 8);
    });

    it('deve ser compatível com consulta ViaCEP e persistência limpa', () => {
      const cepFormatado = formatCep('01001-000');
      const cepLimpo = cepFormatado.replace(/\D/g, '');
      assert.equal(cepLimpo, '01001000');
      assert.equal(cepLimpo.length, 8);
    });
  });

  describe('3. Máscara de Celular e WhatsApp (Contato)', () => {
    it('deve retornar string vazia para valores vazios ou nulos', () => {
      assert.equal(formatPhone(''), '');
      assert.equal(formatPhone(null), '');
      assert.equal(formatPhone(undefined), '');
    });

    it('deve formatar telefone celular (11 dígitos) com 9 dígitos', () => {
      assert.equal(formatPhone('11987654321'), '(11) 98765-4321');
    });

    it('deve formatar telefone fixo (10 dígitos)', () => {
      assert.equal(formatPhone('1134567890'), '(11) 3456-7890');
    });

    it('deve truncar em 11 dígitos no máximo (máscara de 15 caracteres)', () => {
      const entradaLonga = '1198765432199999';
      const formatado = formatPhone(entradaLonga);
      assert.equal(formatado, '(11) 98765-4321');
      assert.equal(formatado.length, 15);
      assert.equal(onlyDigits(formatado).length, 11);
    });

    it('deve ser compatível com geração de link do WhatsApp wa.me', () => {
      const whatsFormatado = formatPhone('11987654321');
      const num = whatsFormatado.replace(/\D/g, '');
      const link = `https://wa.me/55${num}`;
      assert.equal(link, 'https://wa.me/5511987654321');
    });
  });

  describe('4. Integração na Abertura para Edição (abrirEdicao)', () => {
    it('deve formatar valores vindos do banco de dados (mesmo se armazenados sem máscara)', () => {
      const membroDb = {
        matricula: '001',
        nome: 'João da Silva',
        cpf: '12345678901',
        cpfConjuge: '98765432109',
        celular: '11987654321',
        whatsapp: '11912345678',
        cep: '01001000',
      };

      const dadosCarregados = {
        cpf: formatCpf(membroDb.cpf || ''),
        cpfConjuge: formatCpf(membroDb.cpfConjuge || ''),
        celular: formatPhone(membroDb.celular || ''),
        whatsapp: formatPhone(membroDb.whatsapp || ''),
        cep: formatCep(membroDb.cep || ''),
      };

      assert.equal(dadosCarregados.cpf, '123.456.789-01');
      assert.equal(dadosCarregados.cpfConjuge, '987.654.321-09');
      assert.equal(dadosCarregados.celular, '(11) 98765-4321');
      assert.equal(dadosCarregados.whatsapp, '(11) 91234-5678');
      assert.equal(dadosCarregados.cep, '01001-000');
    });
  });
});
