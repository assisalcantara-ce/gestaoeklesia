import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildEventoPlaceholderMap } from '../src/lib/evento-status-utils';
import { substituirPlaceholdersCertificado } from '../src/lib/certificados-utils';

test('buildEventoPlaceholderMap extrai cidade e estado de configIgreja estruturado', () => {
  const configIgreja = {
    nome: 'Assembleia de Deus Ananindeua',
    cidade: 'Ananindeua',
    estado: 'PA',
    endereco: 'BR 316, KM 03, 230, Castanheira, Ananindeua - PA, CEP: 67015-000'
  };

  const evento = {
    titulo: 'ESCOLA DE OBREIROS 2026',
    local_nome: 'Assembleia de Deus Ananindeua',
    local_endereco: 'BR 316, KM02, 230, ANANINDEUA - PA'
  };

  const insc = {
    id: 'insc-123',
    nome_display: 'Carlos Eduardo Oliveira'
  };

  const map = buildEventoPlaceholderMap(evento, insc, configIgreja);

  assert.equal(map.cidade, 'Ananindeua');
  assert.equal(map.estado, 'PA');
  assert.equal(map.uf, 'PA');

  const texto = 'Local: {{cidade}} / {{estado}}';
  const substituido = substituirPlaceholdersCertificado(texto, map, 'eventos');
  assert.equal(substituido, 'Local: Ananindeua / PA');
});

test('buildEventoPlaceholderMap extrai cidade e estado a partir do endereco se cidade/estado não vierem preenchidos', () => {
  const configIgreja = {
    nome: 'Assembleia de Deus Ananindeua',
    endereco: 'BR 316, KM 03, 230, Castanheira, Ananindeua - PA, CEP: 67015-000'
  };

  const evento = {
    titulo: 'ESCOLA DE OBREIROS 2026'
  };

  const insc = {
    id: 'insc-123',
    nome_display: 'Carlos Eduardo'
  };

  const map = buildEventoPlaceholderMap(evento, insc, configIgreja);
  assert.equal(map.cidade, 'Ananindeua');
  assert.equal(map.estado, 'PA');
});

test('buildEventoPlaceholderMap extrai cidade e estado a partir do endereco legado sem CEP (Cidade - UF)', () => {
  const configIgreja = {
    nome: 'Assembleia de Deus Ananindeua',
    endereco: 'BR 316, KM02, 230, ANANINDEUA - PA'
  };

  const map = buildEventoPlaceholderMap({}, {}, configIgreja);
  assert.equal(map.cidade, 'ANANINDEUA');
  assert.equal(map.estado, 'PA');
});

test('buildEventoPlaceholderMap extrai cidade e estado a partir do local_endereco do evento como fallback', () => {
  const configIgreja = {
    nome: 'Assembleia de Deus'
  };

  const evento = {
    local_endereco: 'BR 316, KM02, 230, ANANINDEUA - PA'
  };

  const map = buildEventoPlaceholderMap(evento, {}, configIgreja);
  assert.equal(map.cidade, 'ANANINDEUA');
  assert.equal(map.estado, 'PA');
});
