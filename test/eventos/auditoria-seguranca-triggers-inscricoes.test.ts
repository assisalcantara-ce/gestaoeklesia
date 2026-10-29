import test from 'node:test';
import assert from 'node:assert/strict';

// Helper de verificação oficial se evento é pago
function isEventoPago(ev?: { evento_pago?: boolean | null; valor_inscricao?: number | string | null } | null): boolean {
  if (!ev) return false;
  const valor = typeof ev.valor_inscricao === 'number' ? ev.valor_inscricao : Number(ev.valor_inscricao) || 0;
  return Boolean(ev.evento_pago || valor > 0);
}

// Modelagem e simulação do motor de validação da migration
interface MockEvento {
  id: string;
  ministry_id: string;
  titulo: string;
  evento_pago: boolean;
  valor_inscricao: number;
}

interface MockInscricao {
  id: string;
  ministry_id: string;
  evento_id: string;
  member_id?: string | null;
  cpf_normalizado?: string | null;
  status: 'confirmado' | 'aguardando_pagamento' | 'lista_espera' | 'cancelado' | 'expirado';
  observacoes?: string | null;
  origem_balcao?: boolean;
}

interface MockPagamento {
  id: string;
  ministry_id: string;
  evento_id: string;
  inscricao_id: string;
  status: 'pendente' | 'pago' | 'cancelado' | 'expirado';
  valor: number;
}

class EventosSecurityEngine {
  private eventos: Map<string, MockEvento> = new Map();
  private inscricoes: Map<string, MockInscricao> = new Map();
  private pagamentos: Map<string, MockPagamento> = new Map();

  adicionarEvento(e: MockEvento) {
    this.eventos.set(e.id, e);
  }

  // Trigger BEFORE INSERT em eventos_inscricoes
  insertInscricao(
    inscricao: Omit<MockInscricao, 'id'> & { id?: string },
    options?: { isServiceRole?: boolean; userRole?: string; userNivel?: string }
  ): MockInscricao {
    const id = inscricao.id || `insc-${Math.random().toString(36).substring(2, 9)}`;
    const ev = this.eventos.get(inscricao.evento_id);

    if (!ev || ev.ministry_id !== inscricao.ministry_id) {
      throw new Error('P0002: Evento não encontrado para o ministério informado.');
    }

    const isPago = isEventoPago(ev);

    if (isPago) {
      const isPublicoOuMobile = ['aguardando_pagamento', 'lista_espera'].includes(inscricao.status);
      const isBalcaoAutorizado = Boolean(
        options?.isServiceRole ||
        inscricao.origem_balcao ||
        ['administrador', 'secretario_geral'].includes(options?.userNivel || '')
      );

      // REGRA DE SEGURANÇA 1: Falsificação de string textual NÃO autoriza status 'confirmado'
      if (inscricao.status === 'confirmado') {
        if (!isBalcaoAutorizado) {
          throw new Error('P0001: BLOQUEIO_FLUXO_PAGO_BALCAO_OBRIGATORIO: Usuário não autorizado para inscrição direta em evento pago.');
        }

        // Se tenta registrar como confirmado via balcão sem ser pelo canal autorizado
        if (!inscricao.origem_balcao && !options?.isServiceRole) {
          throw new Error('P0001: BLOQUEIO_FLUXO_PAGO_BALCAO_OBRIGATORIO: Inscrições em eventos pagos exigem o fluxo oficial do Balcão.');
        }
      } else if (!isPublicoOuMobile) {
        throw new Error('P0001: STATUS_INVALIDO_EVENTO_PAGO');
      }
    }

    const nova: MockInscricao = { ...inscricao, id };
    this.inscricoes.set(id, nova);
    return nova;
  }

  // Trigger BEFORE UPDATE OF status em eventos_inscricoes
  updateInscricaoStatus(
    inscricaoId: string,
    novoStatus: MockInscricao['status'],
    novoObservacoes?: string,
    options?: { isWebhookOrServiceRole?: boolean }
  ): MockInscricao {
    const insc = this.inscricoes.get(inscricaoId);
    if (!insc) throw new Error('Inscrição não encontrada');

    const ev = this.eventos.get(insc.evento_id);
    if (!ev) throw new Error('Evento não encontrado');

    const isPago = isEventoPago(ev);

    // Se está tentando confirmar uma inscrição em evento pago
    if (isPago && insc.status !== 'confirmado' && novoStatus === 'confirmado') {
      // 1. Webhook oficial (Asaas/Efí) ou ServiceRole: verifica se pagamento foi marcado como 'pago'
      const pagamento = Array.from(this.pagamentos.values()).find(
        p => p.inscricao_id === inscricaoId && p.ministry_id === insc.ministry_id && p.status === 'pago'
      );

      const isCortesiaAuditada = Boolean(
        (novoObservacoes || insc.observacoes)?.includes('[CORTESIA]') ||
        (novoObservacoes || insc.observacoes)?.includes('Cortesia Autorizada')
      );

      if (!pagamento && !isCortesiaAuditada && !options?.isWebhookOrServiceRole) {
        throw new Error('P0001: CONFIRMACAO_FINANCEIRA_EXIGIDA: Não é permitido confirmar inscrição em evento pago sem quitação financeira ou cortesia.');
      }
    }

    insc.status = novoStatus;
    if (novoObservacoes !== undefined) insc.observacoes = novoObservacoes;
    this.inscricoes.set(inscricaoId, insc);
    return insc;
  }

  // Gravação de pagamento (Webhook ou Balcão)
  insertOuUpdatePagamento(pag: MockPagamento) {
    this.pagamentos.set(pag.id, pag);
  }
}

test('AUDITORIA DE SEGURANÇA — Triggers de Inscrições Pagas', async (t) => {
  const ministryAlpha = 'tenant-alpha-uuid';
  const ministryBeta = 'tenant-beta-uuid';

  const engine = new EventosSecurityEngine();

  // Evento pago no Ministério Alpha
  engine.adicionarEvento({
    id: 'evento-pago-alpha',
    ministry_id: ministryAlpha,
    titulo: 'Conferência Geral Alpha',
    evento_pago: true,
    valor_inscricao: 80,
  });

  // Evento gratuito no Ministério Alpha
  engine.adicionarEvento({
    id: 'evento-gratis-alpha',
    ministry_id: ministryAlpha,
    titulo: 'Culto de Oração',
    evento_pago: false,
    valor_inscricao: 0,
  });

  await t.test('1. Falsificação de texto: INSERT com observação forjada "[Atendimento Balcão]" NÃO deve burlar a validação', () => {
    // Atacante comum ou script direto tentando fazer INSERT forjando o texto de observação
    assert.throws(
      () => {
        engine.insertInscricao(
          {
            ministry_id: ministryAlpha,
            evento_id: 'evento-pago-alpha',
            status: 'confirmado',
            observacoes: '[Atendimento Balcão] | Forma de Pagamento: Dinheiro (FORJADO)',
            origem_balcao: false, // Inserção comum, não passou pelo canal autorizado
          },
          { userNivel: 'membro', isServiceRole: false }
        );
      },
      /BLOQUEIO_FLUXO_PAGO_BALCAO_OBRIGATORIO/
    );
  });

  await t.test('2. UPDATE fraudulento: tentar mudar status de "aguardando_pagamento" para "confirmado" sem quitação é bloqueado', () => {
    // 2.a Inscrição legítima criada inicialmente como pública (aguardando_pagamento)
    const insc = engine.insertInscricao(
      {
        ministry_id: ministryAlpha,
        evento_id: 'evento-pago-alpha',
        status: 'aguardando_pagamento',
        observacoes: 'Inscrição feita pelo site',
      },
      { isServiceRole: true }
    );
    assert.strictEqual(insc.status, 'aguardando_pagamento');

    // 2.b Usuário tenta fazer UPDATE direto alterando para status 'confirmado' sem pagamento quitado
    assert.throws(
      () => {
        engine.updateInscricaoStatus(insc.id, 'confirmado', 'Tentativa de confirmação sem pagar');
      },
      /CONFIRMACAO_FINANCEIRA_EXIGIDA/
    );
  });

  await t.test('3. Confirmação legítima por Webhook Asaas/Efí: pagamento registrado permite confirmação', () => {
    // Cria inscrição aguardando pagamento
    const insc = engine.insertInscricao(
      {
        ministry_id: ministryAlpha,
        evento_id: 'evento-pago-alpha',
        status: 'aguardando_pagamento',
        observacoes: 'Inscrição aguardando PIX',
      },
      { isServiceRole: true }
    );

    // Webhook processa e quita pagamento em eventos_pagamentos
    engine.insertOuUpdatePagamento({
      id: 'pag-pix-1',
      ministry_id: ministryAlpha,
      evento_id: 'evento-pago-alpha',
      inscricao_id: insc.id,
      status: 'pago',
      valor: 80,
    });

    // Webhook confirma inscrição
    const confirmada = engine.updateInscricaoStatus(insc.id, 'confirmado', 'PIX confirmado pelo Asaas', {
      isWebhookOrServiceRole: true,
    });
    assert.strictEqual(confirmada.status, 'confirmado');
  });

  await t.test('4. Atendimento legítimo de Balcão: registro autorizado de inscrição e pagamento imediato', () => {
    const inscBalcao = engine.insertInscricao(
      {
        ministry_id: ministryAlpha,
        evento_id: 'evento-pago-alpha',
        status: 'confirmado',
        observacoes: '[Atendimento Balcão] | Dinheiro',
        origem_balcao: true,
      },
      { userNivel: 'secretario_geral', isServiceRole: false }
    );
    assert.strictEqual(inscBalcao.status, 'confirmado');
  });

  await t.test('5. Eventos gratuitos: inscrição convencional e direta permanece 100% permitida', () => {
    const inscGratis = engine.insertInscricao(
      {
        ministry_id: ministryAlpha,
        evento_id: 'evento-gratis-alpha',
        status: 'confirmado',
        observacoes: 'Inscrição gratuita convencional',
      },
      { userNivel: 'secretario_geral' }
    );
    assert.strictEqual(inscGratis.status, 'confirmado');
  });

  await t.test('6. Isolamento Multi-tenant: não é permitido cruzar inscrição de um ministério em evento de outro', () => {
    assert.throws(
      () => {
        engine.insertInscricao(
          {
            ministry_id: ministryBeta, // Tenant Beta tentando se inscrever no evento do Tenant Alpha
            evento_id: 'evento-pago-alpha',
            status: 'aguardando_pagamento',
          },
          { isServiceRole: true }
        );
      },
      /P0002: Evento não encontrado para o ministério informado/
    );
  });
});
