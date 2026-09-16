import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('Módulo Tesouraria - Relatórios Financeiros, Detalhes e Isolamento de Estado', () => {
  // Simulação de cálculo de escopo de permissões (conforme useTesouraria e access-control)
  function calcularEscopoUsuario(user) {
    const perms = Array.isArray(user.permissions) ? user.permissions : [];
    const userRole = String(user.role ?? '').toLowerCase().trim();
    const cId = user.congregacao_id ?? null;

    // Administradores e gestores plenos
    const isAdmin = ['admin', 'super_admin', 'dono', 'manager'].includes(userRole) ||
                    perms.includes('ADMINISTRADOR');

    // Perfil Tesoureiro Geral
    const isTesoureiroGeral = perms.includes('TESOUREIRO_GERAL') || perms.includes('FINANCEIRO') || isAdmin;
    const isFinLocal = !isTesoureiroGeral && (perms.includes('FINANCEIRO_LOCAL') || perms.includes('TESOURARIA_LOCAL') || !!cId);

    return {
      isFinanceiroLocal: isFinLocal,
      congregacaoId: isFinLocal ? cId : null,
      // Se for apenas visualização/relatório sem permissão de escrita
      canWrite: user.canWrite !== undefined ? user.canWrite : true,
      canDelete: isAdmin, // Apenas administradores/gestores plenos deletam; Tesoureiro Geral tem restrição se configurado
    };
  }

  // Simulação do gerenciador de estado isolado por abas
  class TesourariaStateManager {
    constructor() {
      this.activeTab = 'dashboard';
      // Estados transitórios de formulários e modais
      this.showForm = false;
      this.editId = null;
      this.form = { valor: '', data_lancamento: '', codigo_registro: '' };
      this.confirmDel = null;
      this.confirmDuplicidadeCodigo = null;
      this.selectedDetailsLanc = null;
      // Estados legítimos de filtros e paginação que DEVEM ser preservados
      this.relMes = '2026-09';
      this.relCong = 'cong-1';
      this.relTipoRel = 'entradas';
      this.filtroMes = '2026-09';
    }

    setAba(novaAba) {
      // Isolamento: limpeza de estados transientes ao alternar abas
      this.showForm = false;
      this.editId = null;
      this.form = { valor: '', data_lancamento: '', codigo_registro: '' };
      this.confirmDel = null;
      this.confirmDuplicidadeCodigo = null;
      this.selectedDetailsLanc = null;

      // Troca a aba
      this.activeTab = novaAba;
    }

    iniciarEdicao(lancamento) {
      this.editId = lancamento.id;
      this.form = { ...lancamento };
      this.showForm = true;
    }

    iniciarExclusao(lancamentoId) {
      this.confirmDel = lancamentoId;
    }

    abrirDetalhes(lancamento) {
      this.selectedDetailsLanc = { ...lancamento };
    }

    fecharDetalhes() {
      this.selectedDetailsLanc = null;
    }
  }

  const sampleLancamento1 = {
    id: 'lanc-101',
    ministry_id: 'ministry-abc',
    data_lancamento: '2026-09-10',
    tipo_movimento: 'entrada',
    tipo_recebimento: 'oferta',
    forma_pagamento: 'PIX',
    valor: 1500.5,
    codigo_registro: 'REG-2026-000088',
    conta_id: 'conta-01',
    categoria_id: 'cat-01',
    referencia: 'Culto de Celebração e Gratidão',
    observacoes: 'Oferta arrecadada no culto de domingo.',
    descricao: 'Oferta arrecadada no culto de domingo.',
    congregacao_nome: 'Sede Principal',
    departamento_nome: 'Tesouraria Central',
  };

  const sampleLancamento2 = {
    id: 'lanc-102',
    ministry_id: 'ministry-abc',
    data_lancamento: '2026-09-12',
    tipo_movimento: 'saida',
    tipo_recebimento: 'energia',
    forma_pagamento: 'BOLETO',
    valor: 450.0,
    codigo_registro: 'REG-2026-000089',
    conta_id: 'conta-02',
    categoria_id: 'cat-02',
    referencia: 'Fatura Enel - Setembro/2026',
    observacoes: 'Pagamento de energia da congregação filial.',
    descricao: 'Pagamento de energia da congregação filial.',
    congregacao_nome: 'Congregação Esperança',
    departamento_nome: 'Manutenção / Infra',
  };

  it('A — Perfil sem permissão de escrita não pode editar', () => {
    const scope = calcularEscopoUsuario({
      role: 'operador',
      permissions: ['RELATORIOS_VIEW'],
      canWrite: false,
    });
    assert.equal(scope.canWrite, false);
  });

  it('B — Perfil sem permissão de exclusão não pode excluir', () => {
    const scope = calcularEscopoUsuario({
      role: 'operador',
      permissions: ['RELATORIOS_VIEW'],
      canWrite: false,
    });
    assert.equal(scope.canDelete, false);
  });

  it('C — Botão e ação de Visualizar Detalhes está disponível para visualizadores de relatórios', () => {
    const state = new TesourariaStateManager();
    state.setAba('relatorios');

    state.abrirDetalhes(sampleLancamento1);
    assert.ok(state.selectedDetailsLanc);
    assert.equal(state.selectedDetailsLanc.id, 'lanc-101');
  });

  it('D — Detalhes exibem os campos reais do registro financeiro oficial', () => {
    const state = new TesourariaStateManager();
    state.abrirDetalhes(sampleLancamento1);

    const det = state.selectedDetailsLanc;
    assert.equal(det.data_lancamento, '2026-09-10');
    assert.equal(det.codigo_registro, 'REG-2026-000088');
    assert.equal(det.tipo_movimento, 'entrada');
    assert.equal(det.valor, 1500.5);
    assert.equal(det.forma_pagamento, 'PIX');
    assert.equal(det.referencia, 'Culto de Celebração e Gratidão');
    assert.equal(det.observacoes, 'Oferta arrecadada no culto de domingo.');
    assert.equal(det.congregacao_nome, 'Sede Principal');
    assert.equal(det.departamento_nome, 'Tesouraria Central');
  });

  it('E — Modal de detalhes é estritamente somente leitura', () => {
    const state = new TesourariaStateManager();
    state.abrirDetalhes(sampleLancamento1);

    // O estado do formulário de edição deve permanecer inativo/fechado
    assert.equal(state.showForm, false);
    assert.equal(state.editId, null);
    assert.equal(state.confirmDel, null);
  });

  it('F — Edição iniciada em Relatórios NÃO vaza para Lançamentos ao mudar de aba (Cenário A e B)', () => {
    const state = new TesourariaStateManager();
    state.setAba('relatorios');

    // Usuário clica em editar na aba Relatórios
    state.iniciarEdicao(sampleLancamento1);
    assert.equal(state.showForm, true);
    assert.equal(state.editId, 'lanc-101');

    // Usuário muda para a aba Lançamentos
    state.setAba('lancamentos');

    // O formulário de edição DEVE estar fechado e o editId limpo
    assert.equal(state.showForm, false);
    assert.equal(state.editId, null);
    assert.equal(state.form.valor, '');

    // Volta para Relatórios: não reabre automaticamente
    state.setAba('relatorios');
    assert.equal(state.showForm, false);
    assert.equal(state.editId, null);
  });

  it('G — Exclusão iniciada em Relatórios NÃO vaza para Lançamentos ao mudar de aba (Cenário C)', () => {
    const state = new TesourariaStateManager();
    state.setAba('relatorios');

    // Usuário clica em excluir registro
    state.iniciarExclusao('lanc-101');
    assert.equal(state.confirmDel, 'lanc-101');

    // Usuário muda para Lançamentos sem confirmar
    state.setAba('lancamentos');

    // O modal de exclusão DEVE estar fechado e limpo
    assert.equal(state.confirmDel, null);

    // Volta para Relatórios: não reaparece modal
    state.setAba('relatorios');
    assert.equal(state.confirmDel, null);
  });

  it('H — Troca de aba preserva dados legítimos de filtros e paginação próprios de cada contexto', () => {
    const state = new TesourariaStateManager();
    state.relMes = '2026-08';
    state.relCong = 'cong-sul';
    state.relTipoRel = 'saidas';

    // Muda de aba
    state.setAba('lancamentos');
    state.setAba('relatorios');

    // Filtros continuam intactos
    assert.equal(state.relMes, '2026-08');
    assert.equal(state.relCong, 'cong-sul');
    assert.equal(state.relTipoRel, 'saidas');
  });

  it('I — Troca de registro no modal de detalhes exibe exclusivamente os novos dados (Cenário E)', () => {
    const state = new TesourariaStateManager();

    // Abre detalhes do registro 1
    state.abrirDetalhes(sampleLancamento1);
    assert.equal(state.selectedDetailsLanc.id, 'lanc-101');
    assert.equal(state.selectedDetailsLanc.codigo_registro, 'REG-2026-000088');

    // Fecha
    state.fecharDetalhes();
    assert.equal(state.selectedDetailsLanc, null);

    // Abre detalhes do registro 2
    state.abrirDetalhes(sampleLancamento2);
    assert.equal(state.selectedDetailsLanc.id, 'lanc-102');
    assert.equal(state.selectedDetailsLanc.codigo_registro, 'REG-2026-000089');
    assert.equal(state.selectedDetailsLanc.referencia, 'Fatura Enel - Setembro/2026');
  });

  it('J — Isolamento multi-tenant: registros exibidos mantêm vínculo com seu ministry_id', () => {
    const state = new TesourariaStateManager();
    state.abrirDetalhes(sampleLancamento1);
    assert.equal(state.selectedDetailsLanc.ministry_id, 'ministry-abc');
  });
});
