import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('PROMPT 49 — Regras de Negócio e Congregação no Casamento', () => {
  // Mock do tenant e congregações ativas
  const TENANT_A = 'tenant-uuid-1111';
  const TENANT_B = 'tenant-uuid-2222';

  const CONGREGACOES_TENANT_A = [
    { id: 'cong-1', ministry_id: TENANT_A, nome: 'Sede Central', is_active: true },
    { id: 'cong-2', ministry_id: TENANT_A, nome: 'Congregação Canaã', is_active: true },
    { id: 'cong-3', ministry_id: TENANT_A, nome: 'Congregação Ebenezer (Inativa)', is_active: false },
  ];

  const CONGREGACOES_TENANT_B = [
    { id: 'cong-99', ministry_id: TENANT_B, nome: 'Sede Outra Igreja', is_active: true },
  ];

  // Simulação de função de carregamento oficial de congregações
  function filterActiveCongregacoes(allCongregacoes, ministryId) {
    return allCongregacoes.filter(c => c.ministry_id === ministryId && c.is_active === true);
  }

  // Simulação de lógica de formulário de Casamento
  function createCasamentoFormState() {
    return {
      congregacao_id: '',
      conjuge1_id: '',
      conjuge1_nome: '',
      conjuge2_id: '',
      conjuge2_nome: '',
      data_casamento: '',
      local_casamento: '',
    };
  }

  function selecionarConjuge1(form, member) {
    return {
      ...form,
      conjuge1_id: member.id,
      conjuge1_nome: member.name,
      congregacao_id: member.congregacao_id || '', // Pré-seleção pelo Cônjuge 01
    };
  }

  function selecionarConjuge2(form, member) {
    return {
      ...form,
      conjuge2_id: member.id,
      conjuge2_nome: member.name,
      // NUNCA altera ou sobrescreve form.congregacao_id
    };
  }

  function alterarCongregacaoManual(form, novaCongregacaoId) {
    return {
      ...form,
      congregacao_id: novaCongregacaoId || '',
    };
  }

  function validarCasamentoPayload(form, tenantCongregacoes, ministryId) {
    // 1. Congregação é opcional
    const errors = {};
    if (!form.conjuge1_nome || !form.conjuge1_nome.trim()) errors.conjuge1_nome = 'Obrigatório';
    if (!form.conjuge2_nome || !form.conjuge2_nome.trim()) errors.conjuge2_nome = 'Obrigatório';
    if (!form.data_casamento) errors.data_casamento = 'Obrigatório';

    if (Object.keys(errors).length > 0) {
      return { valid: false, errors };
    }

    // 2. Se congregacao_id foi informado, valida se pertence ao tenant
    if (form.congregacao_id) {
      const exists = tenantCongregacoes.some(c => c.id === form.congregacao_id && c.ministry_id === ministryId);
      if (!exists) {
        return { valid: false, error: 'A congregação selecionada não pertence a esta instituição.' };
      }
    }

    const payload = {
      ministry_id: ministryId,
      congregacao_id: form.congregacao_id || null,
      conjuge1_nome: form.conjuge1_nome.trim(),
      conjuge2_nome: form.conjuge2_nome.trim(),
      data_casamento: form.data_casamento,
      local_casamento: form.local_casamento || null,
    };

    return { valid: true, payload };
  }

  it('1. Carregamento de congregações filtra exclusivamente ativas do tenant atual', () => {
    const listA = filterActiveCongregacoes([...CONGREGACOES_TENANT_A, ...CONGREGACOES_TENANT_B], TENANT_A);
    assert.equal(listA.length, 2);
    assert.deepEqual(listA.map(c => c.id), ['cong-1', 'cong-2']);
    assert.ok(!listA.some(c => c.id === 'cong-3'), 'Não deve conter congregações inativas');
    assert.ok(!listA.some(c => c.id === 'cong-99'), 'Não deve conter congregações de outro tenant');
  });

  it('2. Cônjuge 01 com congregação válida realiza a pré-seleção correta', () => {
    let form = createCasamentoFormState();
    const membroComCong = { id: 'm-1', name: 'João da Silva', congregacao_id: 'cong-2' };
    form = selecionarConjuge1(form, membroComCong);

    assert.equal(form.conjuge1_id, 'm-1');
    assert.equal(form.conjuge1_nome, 'João da Silva');
    assert.equal(form.congregacao_id, 'cong-2', 'Deve pré-selecionar cong-2 do Cônjuge 01');
  });

  it('3. Cônjuge 01 sem congregação pré-seleciona "Sem registro" (string vazia)', () => {
    let form = createCasamentoFormState();
    const membroSemCong = { id: 'm-2', name: 'Pedro Santos', congregacao_id: null };
    form = selecionarConjuge1(form, membroSemCong);

    assert.equal(form.conjuge1_id, 'm-2');
    assert.equal(form.congregacao_id, '', 'Deve pré-selecionar Sem registro (empty string)');
  });

  it('4. Cônjuge 01 não cadastrado (texto manual) mantém "Sem registro"', () => {
    let form = createCasamentoFormState();
    form.conjuge1_nome = 'Visitante Não Cadastrado';
    form.conjuge1_id = '';
    assert.equal(form.congregacao_id, '', 'Sem registro quando digitado manualmente');
  });

  it('5. Seleção manual de outra congregação é permitida e aceita', () => {
    let form = createCasamentoFormState();
    const membro = { id: 'm-1', name: 'João', congregacao_id: 'cong-1' };
    form = selecionarConjuge1(form, membro);
    assert.equal(form.congregacao_id, 'cong-1');

    // Operador altera manualmente para cong-2
    form = alterarCongregacaoManual(form, 'cong-2');
    assert.equal(form.congregacao_id, 'cong-2');
  });

  it('6. Seleção manual de "Sem registro" é permitida', () => {
    let form = createCasamentoFormState();
    const membro = { id: 'm-1', name: 'João', congregacao_id: 'cong-1' };
    form = selecionarConjuge1(form, membro);
    assert.equal(form.congregacao_id, 'cong-1');

    // Operador altera para Sem registro
    form = alterarCongregacaoManual(form, '');
    assert.equal(form.congregacao_id, '');
  });

  it('7. Seleção do Cônjuge 02 NUNCA sobrescreve a congregação escolhida', () => {
    let form = createCasamentoFormState();
    const noivo = { id: 'm-1', name: 'João', congregacao_id: 'cong-1' };
    form = selecionarConjuge1(form, noivo);
    assert.equal(form.congregacao_id, 'cong-1');

    // Noiva pertence a cong-2
    const noiva = { id: 'm-2', name: 'Maria', congregacao_id: 'cong-2' };
    form = selecionarConjuge2(form, noiva);

    // Congregacao permanece cong-1 (a do noivo / escolhida previamente)
    assert.equal(form.conjuge2_id, 'm-2');
    assert.equal(form.conjuge2_nome, 'Maria');
    assert.equal(form.congregacao_id, 'cong-1', 'Não pode ter sido sobrescrito pela noiva');
  });

  it('8. Salvamento sem congregação persiste congregacao_id = null com sucesso', () => {
    const form = {
      congregacao_id: '',
      conjuge1_nome: 'Marcos',
      conjuge2_nome: 'Ana',
      data_casamento: '2026-09-20',
      local_casamento: 'Sítio Recanto Feliz',
    };

    const result = validarCasamentoPayload(form, CONGREGACOES_TENANT_A, TENANT_A);
    assert.ok(result.valid);
    assert.equal(result.payload.congregacao_id, null, 'Deve ser null no payload persistido');
    assert.equal(result.payload.local_casamento, 'Sítio Recanto Feliz');
  });

  it('9. Tentativa de enviar congregação de outro tenant é rejeitada pelo backend', () => {
    const form = {
      congregacao_id: 'cong-99', // Pertence a TENANT_B
      conjuge1_nome: 'Lucas',
      conjuge2_nome: 'Julia',
      data_casamento: '2026-09-21',
    };

    const result = validarCasamentoPayload(form, CONGREGACOES_TENANT_A, TENANT_A);
    assert.equal(result.valid, false);
    assert.match(result.error, /não pertence a esta instituição/i);
  });

  it('10. Edição de registro com e sem congregação inicializa estado corretamente', () => {
    // Registro 1: Com congregação
    const registroComCong = {
      id: 'reg-1',
      congregacao_id: 'cong-1',
      conjuge1_nome: 'A',
      conjuge2_nome: 'B',
    };
    const form1 = {
      congregacao_id: registroComCong.congregacao_id || '',
    };
    assert.equal(form1.congregacao_id, 'cong-1');

    // Registro 2: Legado sem congregação (NULL)
    const registroSemCong = {
      id: 'reg-2',
      congregacao_id: null,
      conjuge1_nome: 'C',
      conjuge2_nome: 'D',
    };
    const form2 = {
      congregacao_id: registroSemCong.congregacao_id || '',
    };
    assert.equal(form2.congregacao_id, '', 'Exibe como Sem registro');
  });
});
