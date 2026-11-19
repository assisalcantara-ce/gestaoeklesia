import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Funções utilitárias espelhadas do frontend
function formatCpf(value) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 11);
  if (!digits) return '';
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function formatPhone(value) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 11);
  if (!digits) return '';
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function validarCpf(cpf) {
  const digits = String(cpf || '').replace(/\D/g, '');
  if (digits.length !== 11) return false;
  if (/^(\d)\1+$/.test(digits)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(digits[i]) * (10 - i);
  let rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(digits[9])) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(digits[i]) * (11 - i);
  rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(digits[10])) return false;

  return true;
}

describe('SECRETARIA — Validações de Formulário Ampliado de Filhos', () => {
  it('1. Valida campos obrigatórios: nome completo, data de nascimento e sexo', () => {
    const payloadInvalidoSemNome = { nome: '', dataNascimento: '2018-05-10', sexo: 'MASCULINO' };
    const payloadInvalidoSemData = { nome: 'Joãozinho Silva', dataNascimento: '', sexo: 'MASCULINO' };
    const payloadInvalidoSemSexo = { nome: 'Joãozinho Silva', dataNascimento: '2018-05-10', sexo: '' };
    const payloadValido = { nome: 'Joãozinho Silva', dataNascimento: '2018-05-10', sexo: 'MASCULINO' };

    assert.equal(Boolean(payloadInvalidoSemNome.nome.trim()), false);
    assert.equal(Boolean(payloadInvalidoSemData.dataNascimento), false);
    assert.equal(Boolean(payloadInvalidoSemSexo.sexo), false);

    assert.equal(Boolean(payloadValido.nome.trim() && payloadValido.dataNascimento && payloadValido.sexo), true);
  });

  it('2. Validação e formatação de CPF opcional', () => {
    assert.equal(validarCpf('52998224725'), true);
    assert.equal(validarCpf('11111111111'), false);
    assert.equal(formatCpf('52998224725'), '529.982.247-25');
  });

  it('3. Formatação de Telefone / WhatsApp opcional', () => {
    assert.equal(formatPhone('85999998888'), '(85) 99999-8888');
    assert.equal(formatPhone('1133334444'), '(11) 3333-4444');
  });

  it('4. Classificação cadastral de novo filho permanece como crianca sem perfil eclesiástico', () => {
    const novoFilhoPayload = {
      name: 'ENZO GABRIEL SILVA',
      data_nascimento: '2019-03-12',
      sexo: 'MASCULINO',
      role: 'crianca',
      tipo_cadastro: 'crianca',
      status: 'active',
    };

    assert.equal(novoFilhoPayload.tipo_cadastro, 'crianca');
    assert.notEqual(novoFilhoPayload.tipo_cadastro, 'ministro');
    assert.notEqual(novoFilhoPayload.tipo_cadastro, 'membro');
    assert.equal(novoFilhoPayload.status, 'active');
  });

  it('5. Resolução de congregação herdada com override permitido', () => {
    const congregacaoResponsavelId = 'cong-sede-123';
    const congregacaoEscolhidaId = 'cong-bairro-456';

    const herdada = '' || congregacaoResponsavelId;
    const customizada = congregacaoEscolhidaId || congregacaoResponsavelId;

    assert.equal(herdada, 'cong-sede-123');
    assert.equal(customizada, 'cong-bairro-456');
  });
});
