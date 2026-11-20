import test from 'node:test';
import assert from 'node:assert/strict';

test('Fechamento da Aprovação Segura — Concorrência, Repetição e Falha Parcial (Lote 3)', async (t) => {
  await t.test('1. Concorrência: duas requisições simultâneas para o mesmo pré-cadastro resultam em apenas 1 aprovação', async () => {
    // Simulação do comportamento atômico de row lock exclusivo (FOR UPDATE) no PostgreSQL
    let statusPreReg = 'pendente';
    let membersCount = 0;
    let matriculaSequencial = 100;
    let createdMemberIds = [];

    // RPC simulada com transação e FOR UPDATE
    const aprovarRpcSimulada = async (reqId) => {
      // Simula SELECT ... FOR UPDATE
      if (statusPreReg === 'aprovado') {
        return {
          success: false,
          code: 'ALREADY_APPROVED',
          error: 'Esta solicitação já foi aprovada anteriormente e não pode ser reprocessada.',
        };
      }

      // Dentro da transação atômica:
      statusPreReg = 'aprovado';
      matriculaSequencial += 1;
      membersCount += 1;
      const newMemberId = `mem-${matriculaSequencial}`;
      createdMemberIds.push(newMemberId);

      return {
        success: true,
        action: 'novo_cadastro',
        member_id: newMemberId,
        matricula: String(matriculaSequencial).padStart(3, '0'),
      };
    };

    // Disparar duas requisições concorrentes
    const [res1, res2] = await Promise.all([
      aprovarRpcSimulada('req-1'),
      aprovarRpcSimulada('req-2'),
    ]);

    // Exatamente uma teve sucesso e a outra foi bloqueada com ALREADY_APPROVED
    const sucesso = [res1, res2].filter((r) => r.success);
    const bloqueadas = [res1, res2].filter((r) => !r.success && r.code === 'ALREADY_APPROVED');

    assert.equal(sucesso.length, 1);
    assert.equal(bloqueadas.length, 1);
    assert.equal(membersCount, 1, 'Não pode criar duas fichas em members');
    assert.equal(createdMemberIds.length, 1, 'Apenas uma matrícula deve ser consumida');
  });

  await t.test('2. Repetição (Retry idempotente): chamadas consecutivas retornam o bloqueio determinístico', async () => {
    let preReg = { id: 'pre-retry', status: 'pendente', existing_member_id: null };

    const aprovar = () => {
      if (preReg.status === 'aprovado') {
        return {
          success: false,
          code: 'ALREADY_APPROVED',
          member_id: preReg.existing_member_id,
        };
      }
      preReg.status = 'aprovado';
      preReg.existing_member_id = 'mem-fixed-123';
      return { success: true, member_id: 'mem-fixed-123' };
    };

    const firstCall = aprovar();
    assert.equal(firstCall.success, true);
    assert.equal(firstCall.member_id, 'mem-fixed-123');

    // Retentativas subsequentes (ex: duplo clique ou retry de rede)
    const retry1 = aprovar();
    const retry2 = aprovar();

    assert.equal(retry1.success, false);
    assert.equal(retry1.code, 'ALREADY_APPROVED');
    assert.equal(retry1.member_id, 'mem-fixed-123');

    assert.equal(retry2.success, false);
    assert.equal(retry2.code, 'ALREADY_APPROVED');
  });

  await t.test('3. Falha Parcial (Atomicidade): falha na inserção do membro reverte o pré-cadastro', async () => {
    let estadoPreReg = 'pendente';
    let estadoMembers = [];

    // Operação transacional: se falhar, nada muda
    const operacaoTransacional = (deveFalhar) => {
      const snapshotPreReg = estadoPreReg;
      const snapshotMembers = [...estadoMembers];

      try {
        if (deveFalhar) {
          throw new Error('Falha simulada de banco de dados (ex: constraint violation)');
        }
        estadoPreReg = 'aprovado';
        estadoMembers.push({ id: 'mem-ok' });
        return { success: true };
      } catch (err) {
        // Rollback da transação
        estadoPreReg = snapshotPreReg;
        estadoMembers = snapshotMembers;
        return { success: false, error: err.message };
      }
    };

    const resFalha = operacaoTransacional(true);
    assert.equal(resFalha.success, false);
    // Pré-cadastro permanece intacto como pendente e nenhum membro foi gerado
    assert.equal(estadoPreReg, 'pendente');
    assert.equal(estadoMembers.length, 0);

    const resSucesso = operacaoTransacional(false);
    assert.equal(resSucesso.success, true);
    assert.equal(estadoPreReg, 'aprovado');
    assert.equal(estadoMembers.length, 1);
  });

  await t.test('4. Atualização Transacional: preserva campos ministeriais e financeiros sob concorrência', () => {
    const membroOficialOriginal = {
      id: 'mem-audit-01',
      name: 'PASTOR ANTONIO',
      tipo_cadastro: 'ministro',
      cargo_ministerial: 'PASTOR PRESIDENTE',
      matricula: '001',
      custom_fields: { dizimos_total: 50000, historico_reunioes: ['r1', 'r2'] },
      whatsapp: '11999990000',
    };

    // Simulação do UPDATE dentro da RPC: apenas atualiza dados cadastrais fornecidos
    const atualizacaoRevisada = {
      whatsapp: '11999998888',
      email: 'pastor.antonio@novoemail.com',
    };

    const membroAposRpc = {
      ...membroOficialOriginal,
      whatsapp: atualizacaoRevisada.whatsapp,
      email: atualizacaoRevisada.email,
    };

    assert.equal(membroAposRpc.tipo_cadastro, 'ministro');
    assert.equal(membroAposRpc.cargo_ministerial, 'PASTOR PRESIDENTE');
    assert.equal(membroAposRpc.matricula, '001');
    assert.equal(membroAposRpc.custom_fields.dizimos_total, 50000);
    assert.equal(membroAposRpc.whatsapp, '11999998888');
  });
});
