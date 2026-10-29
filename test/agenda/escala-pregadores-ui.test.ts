import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { NAVIGATION_STRUCTURE } from '../../src/config/navigation.js';

describe('Escala de Pregadores - Interface e Navegação', () => {
  it('deve possuir o item de menu "Escala de Pregadores" sob o grupo SECRETARIA', () => {
    const secretariaGroup = NAVIGATION_STRUCTURE.find((g) => g.groupName === 'SECRETARIA');
    assert.ok(secretariaGroup, 'Grupo SECRETARIA deve existir');

    const escalaItem = secretariaGroup?.items.find((item) => item.id === 'escala-pregadores');
    assert.ok(escalaItem, 'Item escala-pregadores deve existir');
    assert.equal(escalaItem?.path, '/secretaria/escala-pregadores');
    assert.equal(escalaItem?.label, 'Escala de Pregadores');
  });

  it('deve ter o módulo secretaria_local configurado para controle de acesso', () => {
    const secretariaGroup = NAVIGATION_STRUCTURE.find((g) => g.groupName === 'SECRETARIA');
    const escalaItem = secretariaGroup?.items.find((item) => item.id === 'escala-pregadores');
    assert.equal(escalaItem?.modulo, 'secretaria_local');
  });
});
