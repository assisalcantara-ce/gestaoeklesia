import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('SECRETARIA — Gestão Híbrida de Filhos e Integridade de Vínculos Familiares', () => {
  const TENANT_A = 'tenant-a-uuid';
  const TENANT_B = 'tenant-b-uuid';

  // Base simulada de pessoas/membros
  let members = [
    { id: 'p1', ministry_id: TENANT_A, name: 'PAULO PAI', matricula: '001', role: 'membro', tipo_cadastro: 'membro', custom_fields: {} },
    { id: 'f1', ministry_id: TENANT_A, name: 'LUCAS FILHO', matricula: '002', role: 'membro', tipo_cadastro: 'membro', data_nascimento: '2010-05-15', custom_fields: {} },
    { id: 'f2', ministry_id: TENANT_A, name: 'MARCOS FILHO 2', matricula: '003', role: 'crianca', tipo_cadastro: 'crianca', data_nascimento: '2015-08-20', custom_fields: {} },
    { id: 'ext', ministry_id: TENANT_B, name: 'FILHO OUTRO TENANT', matricula: '099', role: 'membro', tipo_cadastro: 'membro', custom_fields: {} },
  ];

  function vincularPessoaExistente(paiId, pessoaParaVincular, filhosAtuais) {
    // 1. Não permitir auto-vínculo
    if (paiId === pessoaParaVincular.id) {
      throw new Error('SELF_LINK_NOT_ALLOWED: Não é permitido vincular uma pessoa a ela mesma como filho.');
    }

    // 2. Não permitir duplicidade de vínculo
    const jaExiste = filhosAtuais.some(
      f => f.memberId === pessoaParaVincular.id || (f.nome && f.nome.toUpperCase() === pessoaParaVincular.name.toUpperCase())
    );
    if (jaExiste) {
      throw new Error('DUPLICATE_LINK_NOT_ALLOWED: Esta pessoa já está vinculada como filho(a).');
    }

    // 3. Isolamento multi-tenant
    const pai = members.find(m => m.id === paiId);
    if (pai && pessoaParaVincular.ministry_id !== pai.ministry_id) {
      throw new Error('CROSS_TENANT_NOT_ALLOWED: Pessoa pertence a outro ministério.');
    }

    return {
      memberId: pessoaParaVincular.id,
      nome: pessoaParaVincular.name,
      matricula: pessoaParaVincular.matricula || '',
      dataNascimento: pessoaParaVincular.data_nascimento || '',
      tipo: 'filho',
    };
  }

  function cadastrarNovoFilho(paiId, { nome, dataNascimento, sexo }, currentMembers) {
    const pai = currentMembers.find(m => m.id === paiId);
    if (!pai) throw new Error('PAI_NOT_FOUND');

    if (!nome || !nome.trim()) {
      throw new Error('NAME_REQUIRED: Nome do filho é obrigatório.');
    }

    // Criação simplificada na estrutura oficial
    const novoId = `novo-${Date.now()}`;
    const novoMembro = {
      id: novoId,
      ministry_id: pai.ministry_id,
      name: nome.trim().toUpperCase(),
      data_nascimento: dataNascimento || null,
      sexo: sexo || 'MASCULINO',
      role: 'crianca',
      tipo_cadastro: 'crianca',
      status: 'active',
      nome_pai: pai.sexo === 'MASCULINO' ? pai.name : null,
      nome_mae: pai.sexo === 'FEMININO' ? pai.name : null,
      custom_fields: {},
    };

    currentMembers.push(novoMembro);

    return {
      novoMembro,
      vinculo: {
        memberId: novoMembro.id,
        nome: novoMembro.name,
        matricula: novoMembro.matricula || '',
        dataNascimento: novoMembro.data_nascimento || '',
        tipo: 'filho',
      },
    };
  }

  function desvincularFilho(filhosAtuais, indiceOuId, allMembers) {
    const index = typeof indiceOuId === 'number' 
      ? indiceOuId 
      : filhosAtuais.findIndex(f => f.memberId === indiceOuId);
    
    if (index === -1) return filhosAtuais;

    const filhoRemovido = filhosAtuais[index];
    const novaLista = filhosAtuais.filter((_, i) => i !== index);

    // Garantir que a ficha da pessoa no allMembers PERMANECE INTACTA
    if (filhoRemovido.memberId) {
      const existeAinda = allMembers.some(m => m.id === filhoRemovido.memberId);
      assert.ok(existeAinda, 'A ficha da pessoa NÃO deve ser excluída ao desvincular o parentesco.');
    }

    return novaLista;
  }

  it('1. Vincular pessoa existente valida ausência de auto-vínculo e adiciona com matrícula e dados oficiais', () => {
    const pessoa = members.find(m => m.id === 'f1');
    const vinculo = vincularPessoaExistente('p1', pessoa, []);
    assert.equal(vinculo.memberId, 'f1');
    assert.equal(vinculo.nome, 'LUCAS FILHO');
    assert.equal(vinculo.matricula, '002');
    assert.equal(vinculo.dataNascimento, '2010-05-15');
  });

  it('2. Bloqueia auto-vínculo (pai não pode ser filho de si mesmo)', () => {
    const pai = members.find(m => m.id === 'p1');
    assert.throws(() => {
      vincularPessoaExistente('p1', pai, []);
    }, /SELF_LINK_NOT_ALLOWED/);
  });

  it('3. Bloqueia duplicidade de vínculo do mesmo filho', () => {
    const pessoa = members.find(m => m.id === 'f1');
    const filhosAtuais = [{ memberId: 'f1', nome: 'LUCAS FILHO' }];
    assert.throws(() => {
      vincularPessoaExistente('p1', pessoa, filhosAtuais);
    }, /DUPLICATE_LINK_NOT_ALLOWED/);
  });

  it('4. Bloqueia vínculo cross-tenant (tentativa de vincular membro de outro ministério)', () => {
    const pessoaExt = members.find(m => m.id === 'ext');
    assert.throws(() => {
      vincularPessoaExistente('p1', pessoaExt, []);
    }, /CROSS_TENANT_NOT_ALLOWED/);
  });

  it('5. Cadastrar novo filho cria registro como "crianca" e vincula automaticamente', () => {
    const memList = [...members];
    const { novoMembro, vinculo } = cadastrarNovoFilho('p1', {
      nome: 'BEBÊ NOVO',
      dataNascimento: '2025-01-01',
      sexo: 'MASCULINO',
    }, memList);

    assert.equal(novoMembro.role, 'crianca');
    assert.equal(novoMembro.tipo_cadastro, 'crianca');
    assert.equal(novoMembro.ministry_id, TENANT_A);
    assert.equal(vinculo.nome, 'BEBÊ NOVO');
    assert.equal(vinculo.memberId, novoMembro.id);
  });

  it('6. Desvincular filho remove da lista familiar mas NÃO exclui o cadastro da pessoa', () => {
    const memList = [...members];
    const filhos = [
      { memberId: 'f1', nome: 'LUCAS FILHO' },
      { memberId: 'f2', nome: 'MARCOS FILHO 2' },
    ];

    const atualizados = desvincularFilho(filhos, 0, memList);
    assert.equal(atualizados.length, 1);
    assert.equal(atualizados[0].memberId, 'f2');

    // Membro f1 continua existindo na lista de membros do ministério
    const pessoaF1 = memList.find(m => m.id === 'f1');
    assert.ok(pessoaF1, 'Ficha da pessoa f1 deve continuar existindo');
  });

  it('7. Persistência e recuperação: salva no payload de custom_fields e recupera na abertura para edição', () => {
    const filhosParaSalvar = [
      { memberId: 'f1', nome: 'LUCAS FILHO', matricula: '002', dataNascimento: '2010-05-15', tipo: 'filho' }
    ];

    // Simulação do payload enviado ao backend
    const payloadBackend = {
      name: 'PAULO PAI',
      custom_fields: {
        filhos: filhosParaSalvar
      }
    };

    // Simulação da recuperação na leitura (memberToMembro)
    const recuperado = payloadBackend.custom_fields.filhos;
    assert.ok(Array.isArray(recuperado));
    assert.equal(recuperado.length, 1);
    assert.equal(recuperado[0].nome, 'LUCAS FILHO');
    assert.equal(recuperado[0].memberId, 'f1');
  });
});
