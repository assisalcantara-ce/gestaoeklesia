import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatarEnderecoCompleto } from '../src/lib/igreja-config-utils';
import { ESTADOS_BRASIL } from '../src/components/configuracoes/EnderecoForm';
import { formatCep, onlyDigits } from '../src/lib/mascaras';

test('formatarEnderecoCompleto sintetiza corretamente todos os campos estruturados', () => {
  const endereco = formatarEnderecoCompleto({
    logradouro: 'Avenida Paulista',
    numero: '1000',
    complemento: 'Conjunto 501',
    bairro: 'Bela Vista',
    cidade: 'São Paulo',
    estado: 'SP',
    cep: '01310-100'
  });

  assert.equal(
    endereco,
    'Avenida Paulista, 1000, Conjunto 501, Bela Vista, São Paulo - SP, CEP: 01310-100'
  );
});

test('formatarEnderecoCompleto lida com campos opcionais ausentes (sem complemento, sem número)', () => {
  const semComplemento = formatarEnderecoCompleto({
    logradouro: 'Rodovia BR-316',
    numero: 'KM 02',
    bairro: 'Levilandia',
    cidade: 'Ananindeua',
    estado: 'PA',
    cep: '67015-000'
  });

  assert.equal(
    semComplemento,
    'Rodovia BR-316, KM 02, Levilandia, Ananindeua - PA, CEP: 67015-000'
  );

  const semNumero = formatarEnderecoCompleto({
    logradouro: 'Estrada Rural',
    bairro: 'Zona Rural',
    cidade: 'Castanhal',
    estado: 'PA',
  });

  assert.equal(
    semNumero,
    'Estrada Rural, Zona Rural, Castanhal - PA'
  );
});

test('ESTADOS_BRASIL contém exatamente as 27 Unidades Federativas do Brasil', () => {
  assert.equal(ESTADOS_BRASIL.length, 27);
  const siglas = ESTADOS_BRASIL.map(e => e.sigla);
  const esperadas = [
    'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
    'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
    'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
  ];

  esperadas.forEach(uf => {
    assert.ok(siglas.includes(uf), `Sigla ${uf} deve estar presente em ESTADOS_BRASIL`);
  });
});

test('formatCep aplica máscara 00000-000 e onlyDigits isola números', () => {
  assert.equal(formatCep('67015000'), '67015-000');
  assert.equal(formatCep('67015-000'), '67015-000');
  assert.equal(formatCep('6701'), '6701');
  assert.equal(onlyDigits('67015-000'), '67015000');
});
