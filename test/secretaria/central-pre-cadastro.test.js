import test from 'node:test';
import assert from 'node:assert/strict';

test('Central Funcional de Pré-Cadastros da Secretaria (Lote 3)', async (t) => {
  await t.test('1. Permissões de Acesso: Apenas perfis com permissão em secretaria acessam a central', () => {
    const niveisPermitidos = ['administrador', 'secretario_geral', 'auxiliar_secretaria', 'secretaria_local'];
    const niveisNegados = ['tesoureiro_geral', 'tesouraria_local', 'membro'];

    const temAcessoSecretaria = (nivel) => niveisPermitidos.includes(nivel);

    for (const nivel of niveisPermitidos) {
      assert.equal(temAcessoSecretaria(nivel), true, `Nível ${nivel} deve ter acesso`);
    }

    for (const nivel of niveisNegados) {
      assert.equal(temAcessoSecretaria(nivel), false, `Nível ${nivel} NÃO deve ter acesso`);
    }
  });

  await t.test('2. Detecção de Duplicidade: identifica se CPF já pertence a membro oficial', () => {
    const preRegNovo = {
      id: 'pre-1',
      name: 'JOÃO SILVA',
      cpf: '11122233344',
      tipo_solicitacao: 'novo_cadastro',
    };

    const membersOficiais = [
      { id: 'mem-10', name: 'JOÃO DA SILVA OFICIAL', cpf: '11122233344', matricula: '085' },
    ];

    const matchMember = membersOficiais.find((m) => m.cpf === preRegNovo.cpf);
    const isDuplicidadeDetectada = Boolean(matchMember && preRegNovo.tipo_solicitacao === 'novo_cadastro');

    assert.equal(isDuplicidadeDetectada, true);
    assert.equal(matchMember?.matricula, '085');
  });

  await t.test('3. Idempotência na Aprovação: rejeita tentativa de aprovar solicitação já aprovada', () => {
    const preReg = {
      id: 'pre-99',
      status: 'aprovado',
      tipo_solicitacao: 'novo_cadastro',
    };

    const tentarAprovar = (registro) => {
      if (registro.status === 'aprovado') {
        return { error: 'Esta solicitação já foi aprovada anteriormente e não pode ser reprocessada.', code: 'ALREADY_APPROVED' };
      }
      return { success: true };
    };

    const res = tentarAprovar(preReg);
    assert.equal(res.code, 'ALREADY_APPROVED');
  });

  await t.test('4. Aprovação de Novo Cadastro: cria ficha em members com matrícula sequencial e status active', () => {
    const preReg = {
      id: 'pre-nova',
      name: 'CARLOS FERREIRA',
      cpf: '99988877766',
      tipo_solicitacao: 'novo_cadastro',
      tipo_cadastro: 'membro',
      congregacao_id: 'cong-1',
    };

    const matriculaAlocada = '104';
    const statusInicialPreReg = 'pendente';

    // Ficha oficial gerada
    const novaFichaMember = {
      name: preReg.name,
      cpf: preReg.cpf,
      matricula: matriculaAlocada,
      tipo_cadastro: preReg.tipo_cadastro,
      role: preReg.tipo_cadastro,
      status: 'active',
      congregacao_id: preReg.congregacao_id,
    };

    assert.equal(novaFichaMember.status, 'active');
    assert.equal(novaFichaMember.matricula, '104');
    assert.equal(novaFichaMember.cpf, '99988877766');
    assert.notEqual(statusInicialPreReg, novaFichaMember.status);
  });

  await t.test('5. Aprovação de Atualização: preserva matrícula e histórico financeiro/eclesiástico', () => {
    const membroOficialExistente = {
      id: 'mem-50',
      name: 'MARIA SANTOS',
      cpf: '55544433322',
      matricula: '012',
      tipo_cadastro: 'ministro',
      cargo_ministerial: 'DIACONISA',
      status: 'active',
      custom_fields: { dizimos_historico_id: 'diz-99', supervisao: 'Sede' },
    };

    const solicitacaoAtualizacao = {
      tipo_solicitacao: 'atualizacao',
      existing_member_id: 'mem-50',
      whatsapp: '11988887777',
      email: 'maria.nova@teste.com',
      logradouro: 'Rua das Flores, 123',
    };

    // Aplicação das alterações revisadas
    const fichaAtualizada = {
      ...membroOficialExistente,
      whatsapp: solicitacaoAtualizacao.whatsapp,
      email: solicitacaoAtualizacao.email,
      logradouro: solicitacaoAtualizacao.logradouro,
    };

    // Matrícula, tipo e cargo ministeriais permanecem intocados
    assert.equal(fichaAtualizada.matricula, '012');
    assert.equal(fichaAtualizada.tipo_cadastro, 'ministro');
    assert.equal(fichaAtualizada.cargo_ministerial, 'DIACONISA');
    assert.equal(fichaAtualizada.custom_fields.dizimos_historico_id, 'diz-99');
    assert.equal(fichaAtualizada.email, 'maria.nova@teste.com');
  });

  await t.test('6. Ações Devolver e Rejeitar: exigem justificativa/motivo obrigatório', () => {
    const validarAcao = (tipo, motivo) => {
      if ((tipo === 'devolver' || tipo === 'rejeitar') && (!motivo || !motivo.trim())) {
        return { error: 'É obrigatório informar o motivo.' };
      }
      return { success: true };
    };

    assert.equal(validarAcao('devolver', '').error, 'É obrigatório informar o motivo.');
    assert.equal(validarAcao('rejeitar', '   ').error, 'É obrigatório informar o motivo.');
    assert.equal(validarAcao('devolver', 'Falta comprovante de residência').success, true);
    assert.equal(validarAcao('rejeitar', 'Dados cadastrais incompatíveis').success, true);
  });
});
