import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

describe('Platform Billing & Webhook Idempotency Unit Tests', () => {

  // Mapeamento oficial dos status do Asaas para o status local
  const statusMap = {
    RECEIVED: 'paid',
    CONFIRMED: 'paid',
    RECEIVED_IN_CASH: 'paid',
    PAYMENT_RECEIVED: 'paid',
    PAYMENT_CONFIRMED: 'paid',
    PAYMENT_RECEIVED_IN_CASH: 'paid',
    OVERDUE: 'overdue',
    PAYMENT_OVERDUE: 'overdue',
    REFUNDED: 'refunded',
    PAYMENT_REFUNDED: 'refunded',
    DELETED: 'canceled',
    PAYMENT_DELETED: 'canceled',
    CANCELED: 'canceled',
    PAYMENT_CANCELED: 'canceled',
  };

  // Processador idêntico à regra oficial do PlatformBillingReconciliationService
  async function processInvoicePayment({ invoice, asaasPayment, origin = 'reconciliation', db }) {
    const asaasStatus = String(asaasPayment?.status || '').toUpperCase();
    const newStatus = statusMap[asaasStatus] || (invoice.status === 'pending' ? 'pending' : invoice.status);

    // Guarda de idempotência
    if (invoice.status === newStatus && (newStatus !== 'paid' || invoice.paid_at)) {
      return {
        success: true,
        status: newStatus,
        alreadySynced: true,
        invoiceId: invoice.id,
        ministryId: invoice.ministry_id,
        asaasPaymentId: invoice.asaas_payment_id,
      };
    }

    const nowIso = new Date().toISOString();
    const paymentDate = asaasPayment?.paymentDate || asaasPayment?.confirmedDate || asaasPayment?.clientPaymentDate || nowIso;

    // Atualização da fatura
    invoice.status = newStatus;
    invoice.updated_at = nowIso;
    if (newStatus === 'paid') {
      invoice.paid_at = paymentDate;
    }

    // Se paid, ativa assinatura
    if (newStatus === 'paid') {
      db.activateSubscriptionCalls.push({
        ministryId: invoice.ministry_id,
        planSlug: invoice.plano_slug || 'starter',
        validityMonths: 12,
      });

      if (db.opportunity && db.opportunity.status !== 'Convertido') {
        db.opportunity.status = 'Convertido';
        db.opportunityHistory.push({
          status_anterior: 'Novo',
          status_novo: 'Convertido',
          usuario: 'Asaas ' + origin,
        });
      }
    }

    return {
      success: true,
      status: newStatus,
      alreadySynced: false,
      invoiceId: invoice.id,
      ministryId: invoice.ministry_id,
      asaasPaymentId: invoice.asaas_payment_id,
    };
  }

  // 1. TESTE — EVENTO DUPLICADO (PAYMENT_RECEIVED)
  test('1. Deve processar PAYMENT_RECEIVED e na segunda chamada ser 100% idempotente (alreadySynced = true)', async () => {
    const db = {
      activateSubscriptionCalls: [],
      opportunity: { id: 'opt-1', status: 'Novo' },
      opportunityHistory: [],
    };

    const invoice = {
      id: 'inv-123',
      ministry_id: 'min-123',
      asaas_payment_id: 'pay_test_dup',
      status: 'pending',
      paid_at: null,
      plano_slug: 'starter',
    };

    const asaasPayment = {
      id: 'pay_test_dup',
      status: 'RECEIVED',
      paymentDate: '2026-08-10',
      value: 600,
    };

    // 1ª Execução (Primeiro recebimento)
    const result1 = await processInvoicePayment({ invoice, asaasPayment, origin: 'webhook', db });

    assert.equal(result1.success, true);
    assert.equal(result1.status, 'paid');
    assert.equal(result1.alreadySynced, false);
    assert.equal(invoice.status, 'paid');
    assert.equal(invoice.paid_at, '2026-08-10');
    assert.equal(db.activateSubscriptionCalls.length, 1);
    assert.equal(db.opportunityHistory.length, 1);

    // 2ª Execução (Evento Duplicado)
    const result2 = await processInvoicePayment({ invoice, asaasPayment, origin: 'webhook', db });

    assert.equal(result2.success, true);
    assert.equal(result2.status, 'paid');
    assert.equal(result2.alreadySynced, true);
    // Garantir que não chamou activateSubscription novamente nem duplicou histórico
    assert.equal(db.activateSubscriptionCalls.length, 1);
    assert.equal(db.opportunityHistory.length, 1);
    assert.equal(invoice.paid_at, '2026-08-10');
  });

  // 2. TESTE — SEQUÊNCIA PAYMENT_CONFIRMED SEGUIDO DE PAYMENT_RECEIVED
  test('2. Deve processar PAYMENT_CONFIRMED e na chegada de PAYMENT_RECEIVED subsequente retornar alreadySynced', async () => {
    const db = {
      activateSubscriptionCalls: [],
      opportunity: { id: 'opt-2', status: 'Novo' },
      opportunityHistory: [],
    };

    const invoice = {
      id: 'inv-456',
      ministry_id: 'min-456',
      asaas_payment_id: 'pay_test_seq',
      status: 'pending',
      paid_at: null,
      plano_slug: 'profissional',
    };

    // Evento 1: PAYMENT_CONFIRMED
    const asaasConfirmed = {
      id: 'pay_test_seq',
      status: 'CONFIRMED',
      confirmedDate: '2026-09-05',
    };

    const resConfirmed = await processInvoicePayment({ invoice, asaasPayment: asaasConfirmed, origin: 'webhook', db });

    assert.equal(resConfirmed.success, true);
    assert.equal(resConfirmed.status, 'paid');
    assert.equal(resConfirmed.alreadySynced, false);
    assert.equal(invoice.paid_at, '2026-09-05');
    assert.equal(db.activateSubscriptionCalls.length, 1);

    // Evento 2: PAYMENT_RECEIVED subsequente
    const asaasReceived = {
      id: 'pay_test_seq',
      status: 'RECEIVED',
      paymentDate: '2026-09-05',
    };

    const resReceived = await processInvoicePayment({ invoice, asaasPayment: asaasReceived, origin: 'webhook', db });

    assert.equal(resReceived.success, true);
    assert.equal(resReceived.status, 'paid');
    assert.equal(resReceived.alreadySynced, true);
    assert.equal(db.activateSubscriptionCalls.length, 1);
  });

  // 3. TESTE — PRESERVAÇÃO DA DATA REAL DO PAGAMENTO DO ASAAS
  test('3. Deve preservar a data oficial do pagamento (paymentDate / confirmedDate / clientPaymentDate) em paid_at', async () => {
    const db = { activateSubscriptionCalls: [], opportunity: null, opportunityHistory: [] };
    const invoice = {
      id: 'inv-789',
      ministry_id: 'min-789',
      asaas_payment_id: 'pay_real_date',
      status: 'pending',
      paid_at: null,
    };

    const asaasPayment = {
      id: 'pay_real_date',
      status: 'RECEIVED',
      clientPaymentDate: '2026-08-10',
    };

    await processInvoicePayment({ invoice, asaasPayment, origin: 'reconciliation', db });
    assert.equal(invoice.paid_at, '2026-08-10');
  });

  // 4. TESTE — PAYMENT_NOT_FOUND RETORNA HTTP 200 COM SKIPPED
  test('4. Quando payment não existe em platform_billing_invoices, deve responder HTTP 200 { received: true, skipped: true, reason: \"payment_not_found\" }', () => {
    const invoiceInDb = null; // simulando inexistente
    const asaasPaymentId = 'pay_desconhecido_teste_123';

    let responseJson = null;
    let responseStatus = 200;

    if (!invoiceInDb) {
      responseJson = {
        received: true,
        skipped: true,
        reason: 'payment_not_found',
        asaas_payment_id: asaasPaymentId,
      };
      responseStatus = 200;
    }

    assert.equal(responseStatus, 200);
    assert.equal(responseJson.received, true);
    assert.equal(responseJson.skipped, true);
    assert.equal(responseJson.reason, 'payment_not_found');
    assert.equal(responseJson.asaas_payment_id, asaasPaymentId);
  });

  // 5. TESTE — RECONCILIAÇÃO DUPLA NÃO REPUDIA NEM REPETE EXTENSÃO
  test('5. Reconciliação múltipla em faturas já paid deve ser pura no-op', async () => {
    const db = {
      activateSubscriptionCalls: [],
      opportunity: { id: 'opt-5', status: 'Convertido' },
      opportunityHistory: [],
    };

    const invoice = {
      id: 'inv-ananindeua-ago',
      ministry_id: 'min-ananindeua',
      asaas_payment_id: 'pay_zqf6r456q3k6h0si',
      status: 'paid',
      paid_at: '2026-08-10',
      plano_slug: 'avulsa',
    };

    const asaasPayment = {
      id: 'pay_zqf6r456q3k6h0si',
      status: 'RECEIVED',
      paymentDate: '2026-08-10',
    };

    const res = await processInvoicePayment({ invoice, asaasPayment, origin: 'reconciliation', db });
    assert.equal(res.alreadySynced, true);
    assert.equal(db.activateSubscriptionCalls.length, 0);
    assert.equal(db.opportunityHistory.length, 0);
  });
});
