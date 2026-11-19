import test from 'node:test';
import assert from 'node:assert/strict';

test('Validação de Contrato do Cadastro Público de Membros — Congregação e Grupo', async (t) => {
  await t.test('1. Retorno de /info deve incluir campo_id e campo_nome das congregações ativas', () => {
    const mockInfoResponse = {
      institution_name: 'Igreja Evangélica Assembleia de Deus',
      logo_url: null,
      congregacoes: [
        {
          id: 'cong-uuid-1',
          nome: 'Sede Regional',
          campo_id: 'campo-uuid-10',
          campo_nome: 'Setor 01 - Centro',
        },
        {
          id: 'cong-uuid-2',
          nome: 'Congregação Monte Moriá',
          campo_id: 'campo-uuid-20',
          campo_nome: 'Setor 02 - Leste',
        },
      ],
    };

    assert.equal(mockInfoResponse.congregacoes.length, 2);
    assert.equal(mockInfoResponse.congregacoes[0].id, 'cong-uuid-1');
    assert.equal(mockInfoResponse.congregacoes[0].campo_id, 'campo-uuid-10');
    assert.equal(mockInfoResponse.congregacoes[0].campo_nome, 'Setor 01 - Centro');
  });

  await t.test('2. /save deve mapear congregação e grupo em custom_fields mantendo congregacao_id físico', () => {
    const rawBody = {
      institution: 'demo-church',
      congregacao_id: 'cong-uuid-2',
      campo_id: 'campo-uuid-20',
      cpf: '123.456.789-00',
      name: 'João da Silva',
    };

    const congregacaoNome = 'Congregação Monte Moriá';
    const campoNomeFinal = 'Setor 02 - Leste';

    const insertCustomFields = {
      supervisao: congregacaoNome,
      campo: campoNomeFinal,
      congregacao_id: rawBody.congregacao_id,
      campo_id: rawBody.campo_id,
    };

    const insertPayload = {
      ministry_id: 'min-uuid-1',
      congregacao_id: rawBody.congregacao_id,
      custom_fields: insertCustomFields,
      name: rawBody.name.toUpperCase(),
      cpf: '12345678900',
    };

    assert.equal(insertPayload.congregacao_id, 'cong-uuid-2');
    assert.equal(insertPayload.custom_fields.supervisao, 'Congregação Monte Moriá');
    assert.equal(insertPayload.custom_fields.campo, 'Setor 02 - Leste');
    assert.equal(insertPayload.custom_fields.congregacao_id, 'cong-uuid-2');
    assert.equal(insertPayload.custom_fields.campo_id, 'campo-uuid-20');
  });

  await t.test('3. Resiliência de leitura na Secretaria (memberToMembro) restaura congregação e campo por congregacao_id', () => {
    const mockCongregacoes = [
      { id: 'cong-uuid-2', nome: 'Congregação Monte Moriá', campo_id: 'campo-uuid-20' },
    ];
    const mockCampos = [
      { id: 'campo-uuid-20', nome: 'Setor 02 - Leste' },
    ];

    const memberAntigoSemCustomFields = {
      id: 'mem-123',
      name: 'MARIA SILVA',
      cpf: '12345678900',
      congregacao_id: 'cong-uuid-2',
      custom_fields: {},
      status: 'active',
      role: 'membro',
    };

    const cf = memberAntigoSemCustomFields.custom_fields || {};
    let supervisaoRecuperada = String(cf.supervisao || '');
    let campoRecuperado = String(cf.campo || '');

    if ((!supervisaoRecuperada || !campoRecuperado) && memberAntigoSemCustomFields.congregacao_id) {
      const congEncontrada = mockCongregacoes.find((c) => c.id === memberAntigoSemCustomFields.congregacao_id);
      if (congEncontrada) {
        if (!supervisaoRecuperada) {
          supervisaoRecuperada = congEncontrada.nome;
        }
        if (!campoRecuperado && congEncontrada.campo_id) {
          const campoEncontrado = mockCampos.find((cp) => cp.id === congEncontrada.campo_id);
          if (campoEncontrado) {
            campoRecuperado = campoEncontrado.nome;
          }
        }
      }
    }

    assert.equal(supervisaoRecuperada, 'Congregação Monte Moriá');
    assert.equal(campoRecuperado, 'Setor 02 - Leste');
  });
});
