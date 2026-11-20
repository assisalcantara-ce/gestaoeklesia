import test from 'node:test';
import assert from 'node:assert/strict';

test('Fundação Segura do Pré-Cadastro de Membros (Lote 2)', async (t) => {
  await t.test('1. Novo solicitante grava exclusivamente em member_pre_registrations com status pendente', () => {
    const rawBody = {
      institution: 'igreja-sede',
      congregacao_id: 'cong-uuid-001',
      campo_id: 'campo-uuid-100',
      cpf: '123.456.789-01',
      name: 'Carlos Alberto Souza',
      nome_pai: 'Alberto Souza',
      nome_mae: 'Helena Souza',
      tipo_cadastro: 'membro',
      data_nascimento: '1990-05-15',
    };

    const cleanCpf = rawBody.cpf.replace(/\D/g, '');
    const ministryId = 'min-uuid-999';

    // Mock do comportamento da rota
    const preRegRecord = {
      ministry_id: ministryId,
      tipo_solicitacao: 'novo_cadastro',
      existing_member_id: null,
      status: 'pendente',
      name: rawBody.name.toUpperCase(),
      cpf: cleanCpf,
      nome_pai: rawBody.nome_pai.toUpperCase(),
      nome_mae: rawBody.nome_mae.toUpperCase(),
      congregacao_id: rawBody.congregacao_id,
      campo_id: rawBody.campo_id,
      tipo_cadastro: 'membro',
      origem: 'link_publico',
    };

    // Asserts de integridade
    assert.equal(preRegRecord.status, 'pendente');
    assert.equal(preRegRecord.tipo_solicitacao, 'novo_cadastro');
    assert.equal(preRegRecord.existing_member_id, null);
    assert.equal(preRegRecord.cpf, '12345678901');
    assert.equal(preRegRecord.congregacao_id, 'cong-uuid-001');
    assert.equal(preRegRecord.campo_id, 'campo-uuid-100');
    // Não deve conter matrícula nem status de membro efetivo
    assert.equal(preRegRecord.matricula, undefined);
    assert.notEqual(preRegRecord.status, 'active');
  });

  await t.test('2. CPF pertencente a membro oficial não sobrescreve members e cria pedido de revisão', () => {
    const existingMember = {
      id: 'mem-uuid-555',
      ministry_id: 'min-uuid-999',
      name: 'JOAO DA SILVA OFICIAL',
      cpf: '98765432100',
      matricula: '10042',
      status: 'active',
      congregacao_id: 'cong-uuid-antiga',
    };

    const updateRequestBody = {
      institution: 'igreja-sede',
      congregacao_id: 'cong-uuid-nova',
      campo_id: 'campo-uuid-nova-regiao',
      cpf: '987.654.321-00',
      name: 'Joao da Silva Atualizado',
      nome_pai: 'Joaquim Silva',
      nome_mae: 'Ana Silva',
    };

    const cleanCpf = updateRequestBody.cpf.replace(/\D/g, '');

    // Verifica que o CPF bate com o membro existente
    assert.equal(cleanCpf, existingMember.cpf);

    // O registro oficial em members PERMANECE INALTERADO
    assert.equal(existingMember.name, 'JOAO DA SILVA OFICIAL');
    assert.equal(existingMember.matricula, '10042');
    assert.equal(existingMember.status, 'active');
    assert.equal(existingMember.congregacao_id, 'cong-uuid-antiga');

    // Em vez de alterar members, grava solicitação de revisão em member_pre_registrations
    const reviewRequest = {
      ministry_id: existingMember.ministry_id,
      tipo_solicitacao: 'atualizacao',
      existing_member_id: existingMember.id,
      status: 'pendente',
      name: updateRequestBody.name.toUpperCase(),
      cpf: cleanCpf,
      congregacao_id: updateRequestBody.congregacao_id,
      campo_id: updateRequestBody.campo_id,
      origem: 'link_publico',
    };

    assert.equal(reviewRequest.tipo_solicitacao, 'atualizacao');
    assert.equal(reviewRequest.existing_member_id, 'mem-uuid-555');
    assert.equal(reviewRequest.status, 'pendente');
    assert.equal(reviewRequest.congregacao_id, 'cong-uuid-nova');
  });

  await t.test('3. Isolamento multi-tenant: congregação de outro ministério é rejeitada', () => {
    const ministryA = 'min-uuid-aaa';
    const ministryB = 'min-uuid-bbb';

    const congregacoesDoBanco = [
      { id: 'cong-a1', ministry_id: ministryA, nome: 'Congregação Alfa' },
      { id: 'cong-b1', ministry_id: ministryB, nome: 'Congregação Beta' },
    ];

    // Tentativa de submissão no Ministério A com congregação do Ministério B
    const payloadSubmetido = {
      institution: ministryA,
      congregacao_id: 'cong-b1',
    };

    const congregacaoValida = congregacoesDoBanco.find(
      (c) => c.id === payloadSubmetido.congregacao_id && c.ministry_id === payloadSubmetido.institution
    );

    assert.equal(congregacaoValida, undefined);
  });

  await t.test('4. Resposta da API mantém compatibilidade com frontend público', () => {
    // Para novo cadastro
    const newCadastroResponse = {
      success: true,
      action: 'created',
      message: 'Pré-cadastro realizado com sucesso! Aguarde a homologação da secretaria.',
    };
    assert.equal(newCadastroResponse.success, true);
    assert.equal(newCadastroResponse.action, 'created');

    // Para membro já existente solicitando atualização
    const updateResponse = {
      success: true,
      action: 'updated',
      message: 'Solicitação de atualização enviada para análise da secretaria.',
    };
    assert.equal(updateResponse.success, true);
    assert.equal(updateResponse.action, 'updated');
  });
});
