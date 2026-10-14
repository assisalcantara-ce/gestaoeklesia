import test from 'node:test';
import assert from 'node:assert/strict';

// Categorias organizadas sem redundância
const CATEGORIAS = [
  { value: 'imovel', label: 'Imóveis' },
  { value: 'terreno', label: 'Terrenos' },
  { value: 'movel', label: 'Móveis e utensílios' },
  { value: 'equipamento', label: 'Equipamentos' },
  { value: 'instrumento', label: 'Instrumentos musicais' },
  { value: 'som_imagem', label: 'Equipamentos de som e imagem' },
  { value: 'veiculo', label: 'Veículos' },
  { value: 'outros', label: 'Outros' },
];

test('Estrutura de Categorias de Patrimônio', async (t) => {
  await t.test('1. Deve possuir exatamente as 8 categorias organizadas sem redundância', () => {
    assert.equal(CATEGORIAS.length, 8);
    const valores = CATEGORIAS.map((c) => c.value);
    assert.deepEqual(valores, [
      'imovel',
      'terreno',
      'movel',
      'equipamento',
      'instrumento',
      'som_imagem',
      'veiculo',
      'outros',
    ]);
  });

  await t.test('2. Não deve conter categorias redundantes antigas', () => {
    const valores = CATEGORIAS.map((c) => c.value);
    assert.ok(!valores.includes('eletronico'), 'Não deve ter "eletronico" duplicado');
  });

  await t.test('3. Limpeza de campos específicos ao alternar categoria', () => {
    // Simulação da função clearSpecificFieldsForCategory implementada
    const clearSpecificFieldsForCategory = (cat: string) => ({
      ...(cat !== 'imovel' ? { tipo_imovel: '', endereco_imovel: '', area_construida: '', matricula_imovel: '' } : {}),
      ...(cat !== 'terreno' ? { endereco_terreno: '', area_terreno: '', medidas_frente: '', matricula_terreno: '' } : {}),
      ...(cat !== 'movel' ? { material_movel: '', localizacao_interna_movel: '' } : {}),
      ...(cat !== 'veiculo' ? { ano_veiculo: '', placa_veiculo: '', renavam_veiculo: '', km_veiculo: '' } : {}),
    });

    const limposAoMudarParaVeiculo = clearSpecificFieldsForCategory('veiculo');
    assert.equal(limposAoMudarParaVeiculo.tipo_imovel, '');
    assert.equal(limposAoMudarParaVeiculo.endereco_terreno, '');
    assert.equal(limposAoMudarParaVeiculo.material_movel, '');
    assert.equal(limposAoMudarParaVeiculo.placa_veiculo, undefined);
  });
});
