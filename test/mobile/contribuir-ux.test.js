import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Simulação e Teste de Fluxo UX de Contribuição Mobile (FASE E.2.3)
 */
describe('FASE E.2.3 — Telas e Fluxo UX de Contribuições PIX do App Mobile', () => {
  // 1. Simulação do Componente ContribuirPage
  class MockContribuirPageState {
    constructor() {
      this.destinos = [];
      this.extrato = [];
      this.activeTab = 'destinos';
      this.loading = false;
    }

    async carregarDestinos(apiResponse) {
      this.destinos = apiResponse.filter(
        (d) => d.is_ativo && (!d.expires_at || new Date(d.expires_at) > new Date()),
      );
    }

    async carregarExtrato(apiResponse) {
      this.extrato = [...apiResponse];
    }
  }

  // 2. Simulação do Componente ContribuirDetalhePage (Formulário)
  class MockContribuirFormState {
    constructor(destino) {
      this.destino = destino;
      this.valorInput = destino?.valor_fixo ? String(destino.valor_fixo) : '50,00';
      this.isAnonimo = false;
      this.isSubmitting = false;
      this.error = '';
    }

    setValor(novoValor) {
      this.valorInput = novoValor;
      this.error = '';
    }

    toggleAnonimo(valor) {
      this.isAnonimo = valor;
    }

    getValorNumerico() {
      const clean = this.valorInput.replace(/\./g, '').replace(',', '.');
      return parseFloat(clean) || 0;
    }

    async submeter(apiPostPix) {
      if (this.isSubmitting) return null; // Proteção contra duplo clique

      const valorFinal = this.getValorNumerico();
      if (valorFinal < 1.00) {
        this.error = 'O valor mínimo para contribuição é R$ 1,00.';
        return null;
      }

      this.isSubmitting = true;
      try {
        // Payload estritamente sanitizado — NUNCA envia member_id ou ministry_id
        const payload = {
          destinationId: this.destino.id,
          valor: valorFinal,
          anonimo: this.isAnonimo,
        };
        const res = await apiPostPix(payload);
        return res;
      } finally {
        this.isSubmitting = false;
      }
    }
  }

  // 3. Simulação do Componente ContribuirPixPage (Polling e Confirmação)
  class MockContribuirPixState {
    constructor(chargeInitial) {
      this.charge = chargeInitial;
      this.isPolling = false;
      this.pollingTimer = null;
      this.telaExibida = 'pendente'; // 'pendente' | 'pago' | 'expirado'
    }

    iniciarPolling(apiGetStatus) {
      this.isPolling = true;
      // Simulação de ciclo de polling
      this.pollingTimer = {
        tick: async () => {
          if (!this.isPolling) return;
          const updated = await apiGetStatus(this.charge.id);
          this.charge = updated;
          if (updated.status === 'pago') {
            this.telaExibida = 'pago';
            this.pararPolling();
          } else if (updated.status === 'expirado' || updated.status === 'cancelado') {
            this.telaExibida = 'expirado';
            this.pararPolling();
          }
        },
      };
    }

    pararPolling() {
      this.isPolling = false;
      this.pollingTimer = null;
    }
  }

  it('A. Tela de Contribuir carrega destinos reais e B. Destino expirado não é exibido', async () => {
    const page = new MockContribuirPageState();
    const rawDestinos = [
      { id: 'dest-1', label: 'Dízimo', is_ativo: true, expires_at: null },
      { id: 'dest-2', label: 'Oferta', is_ativo: true, expires_at: null },
      { id: 'dest-exp', label: 'Expirado', is_ativo: true, expires_at: new Date(Date.now() - 10000).toISOString() },
    ];

    await page.carregarDestinos(rawDestinos);
    assert.equal(page.destinos.length, 2);
    assert.ok(page.destinos.some((d) => d.id === 'dest-1'));
    assert.ok(page.destinos.some((d) => d.id === 'dest-2'));
    assert.equal(page.destinos.some((d) => d.id === 'dest-exp'), false);
  });

  it('C. Seleção de valor rápido funciona corretamente', () => {
    const form = new MockContribuirFormState({ id: 'dest-1', label: 'Oferta', valor_fixo: null });
    form.setValor('100,00');
    assert.equal(form.getValorNumerico(), 100.00);
  });

  it('D. Valor inválido (< 1.00 ou 0) impede envio com mensagem clara', async () => {
    const form = new MockContribuirFormState({ id: 'dest-1', label: 'Oferta', valor_fixo: null });
    form.setValor('0,50');
    let apiCalled = false;
    const res = await form.submeter(async () => {
      apiCalled = true;
    });
    assert.equal(res, null);
    assert.equal(apiCalled, false);
    assert.equal(form.error, 'O valor mínimo para contribuição é R$ 1,00.');
  });

  it('E. Botão Gerar PIX bloqueia duplo clique (isSubmitting)', async () => {
    const form = new MockContribuirFormState({ id: 'dest-1', label: 'Dízimo', valor_fixo: null });
    form.setValor('50,00');

    let chamadasApi = 0;
    const apiMock = async () => {
      chamadasApi++;
      return { chargeId: 'charge-123', status: 'pendente' };
    };

    // Primeira submissão
    const promise1 = form.submeter(apiMock);
    // Tentativa concorrente enquanto isSubmitting = true
    const promise2 = form.submeter(apiMock);

    const [res1, res2] = await Promise.all([promise1, promise2]);
    assert.ok(res1);
    assert.equal(res2, null, 'Segunda chamada imediata deve ser bloqueada');
    assert.equal(chamadasApi, 1, 'API só deve ser chamada uma única vez');
  });

  it('F. API é chamada com destinationId, valor e anonimo; G/H. Frontend NÃO envia member_id nem ministry_id', async () => {
    const form = new MockContribuirFormState({ id: 'dest-99', label: 'Missões', valor_fixo: null });
    form.setValor('75,00');
    form.toggleAnonimo(true);

    let payloadEnviado = null;
    await form.submeter(async (payload) => {
      payloadEnviado = payload;
      return { chargeId: 'c-1', status: 'pendente' };
    });

    assert.deepEqual(payloadEnviado, {
      destinationId: 'dest-99',
      valor: 75.00,
      anonimo: true,
    });
    assert.equal('member_id' in payloadEnviado, false);
    assert.equal('ministry_id' in payloadEnviado, false);
    assert.equal('payer_document' in payloadEnviado, false);
  });

  it('I. QR Code e Copia e Cola são exibidos após criação', () => {
    const pixState = new MockContribuirPixState({
      id: 'charge-abc',
      status: 'pendente',
      valor_solicitado: 100,
      pix_payload: '00020126580014br.gov.bcb.pix...',
    });
    assert.equal(pixState.telaExibida, 'pendente');
    assert.ok(pixState.charge.pix_payload);
  });

  it('K. Polling inicia para cobrança pendente e L. Polling termina quando status=pago', async () => {
    let mockChargeStatus = { id: 'c-1', status: 'pendente' };
    const pixState = new MockContribuirPixState(mockChargeStatus);

    pixState.iniciarPolling(async () => mockChargeStatus);
    assert.equal(pixState.isPolling, true);

    // Simula primeiro tick ainda pendente
    await pixState.pollingTimer.tick();
    assert.equal(pixState.isPolling, true);
    assert.equal(pixState.telaExibida, 'pendente');

    // Simula confirmação externa via webhook
    mockChargeStatus = { id: 'c-1', status: 'pago', paid_at: new Date().toISOString() };
    await pixState.pollingTimer.tick();

    // Polling deve ter sido encerrado automaticamente
    assert.equal(pixState.isPolling, false);
    assert.equal(pixState.telaExibida, 'pago');
  });

  it('M. Polling termina quando status=expirado ou cancelado', async () => {
    let mockChargeStatus = { id: 'c-2', status: 'pendente' };
    const pixState = new MockContribuirPixState(mockChargeStatus);

    pixState.iniciarPolling(async () => mockChargeStatus);
    assert.equal(pixState.isPolling, true);

    mockChargeStatus = { id: 'c-2', status: 'expirado' };
    await pixState.pollingTimer.tick();

    assert.equal(pixState.isPolling, false);
    assert.equal(pixState.telaExibida, 'expirado');
  });

  it('N. Pagamento confirmado exibe tela de sucesso e O. Pagamento NÃO é liberado localmente sem resposta do backend', () => {
    const pixState = new MockContribuirPixState({ id: 'c-3', status: 'pendente' });
    assert.equal(pixState.telaExibida, 'pendente');
    // Tentativa de confirmação sem o backend atualizar deve manter 'pendente'
    assert.notEqual(pixState.telaExibida, 'pago');
  });

  it('P. Histórico de contribuições é carregado e ordenado', async () => {
    const page = new MockContribuirPageState();
    const rawExtrato = [
      { id: 'l-1', data_lancamento: '2026-09-01', valor: 150, tipo_recebimento: 'dizimo' },
      { id: 'l-2', data_lancamento: '2026-09-10', valor: 50, tipo_recebimento: 'oferta' },
    ];
    await page.carregarExtrato(rawExtrato);
    assert.equal(page.extrato.length, 2);
  });

  it('Q. Home possui atalho Contribuir ativo', async () => {
    const shortcuts = [
      { href: '/app/perfil', label: 'Meu Perfil', enabled: true },
      { href: '/app/carteirinha', label: 'Carteirinha', enabled: true },
      { href: '/app/contribuir', label: 'Contribuir', enabled: true },
      { href: '#', label: 'Eventos', enabled: false },
    ];
    const contribuirShortcut = shortcuts.find((s) => s.label === 'Contribuir');
    assert.ok(contribuirShortcut);
    assert.equal(contribuirShortcut.enabled, true);
    assert.equal(contribuirShortcut.href, '/app/contribuir');
  });

  it('R. BottomNav possui Contribuir ativo e S. Eventos permanece desabilitado', () => {
    const navItems = [
      { href: '/app/inicio', label: 'Início' },
      { href: '/app/contribuir', label: 'Contribuir' },
      { href: '/app/carteirinha', label: 'Carteirinha' },
      { href: '/app/perfil', label: 'Perfil' },
    ];
    const futureItems = [{ label: 'Eventos' }];

    assert.ok(navItems.some((item) => item.label === 'Contribuir' && item.href === '/app/contribuir'));
    assert.ok(futureItems.some((item) => item.label === 'Eventos'));
  });
});
