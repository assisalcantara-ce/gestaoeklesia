import { SupabaseClient } from '@supabase/supabase-js';
import { SubscriptionService } from '../subscriptions/service';
import { getAsaasPayment } from '@/lib/asaas';

export interface ProcessPaymentParams {
  supabaseAdmin: SupabaseClient;
  invoice: any;
  asaasPayment?: any;
  eventId?: string | null;
  origin?: 'webhook' | 'reconciliation' | 'manual';
}

export interface ProcessPaymentResult {
  success: boolean;
  status: string;
  alreadySynced?: boolean;
  invoiceId: string;
  ministryId: string;
  asaasPaymentId: string;
  error?: string;
}

export interface ReconcileOptions {
  ministryId?: string;
  limit?: number;
}

export interface ReconcileSummary {
  success: boolean;
  totalChecked: number;
  updated: number;
  alreadySynced: number;
  failed: number;
  details: Array<{
    invoiceId: string;
    ministryId: string;
    asaasPaymentId: string;
    oldStatus: string;
    newStatus: string;
    actionTaken: string;
    error?: string;
  }>;
}

export class PlatformBillingReconciliationService {
  /**
   * Processamento único, padronizado e oficial de faturas da plataforma.
   * Usado tanto pelo Webhook do Asaas quanto pelo serviço de Reconciliação manual/automático.
   */
  static async processInvoicePayment(params: ProcessPaymentParams): Promise<ProcessPaymentResult> {
    const { supabaseAdmin, invoice, asaasPayment, origin = 'reconciliation' } = params;
    const asaasPaymentId = invoice.asaas_payment_id;

    // 1. Determinar o status real a partir do objeto Asaas
    const asaasStatus = String(asaasPayment?.status || '').toUpperCase();

    // Mapeamento oficial dos status do Asaas para o status local
    const statusMap: Record<string, string> = {
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

    const newStatus = statusMap[asaasStatus] || (invoice.status === 'pending' ? 'pending' : invoice.status);

    // Se já estiver no mesmo status final com paid_at preenchido quando pago, não precisa reprocessar
    if (invoice.status === newStatus && (newStatus !== 'paid' || invoice.paid_at)) {
      return {
        success: true,
        status: newStatus,
        alreadySynced: true,
        invoiceId: invoice.id,
        ministryId: invoice.ministry_id,
        asaasPaymentId,
      };
    }

    const nowIso = new Date().toISOString();
    const paymentDate = asaasPayment?.paymentDate || asaasPayment?.confirmedDate || asaasPayment?.clientPaymentDate || nowIso;

    // 2. Atualizar a fatura em platform_billing_invoices
    const updateData: Record<string, any> = {
      status: newStatus,
      updated_at: nowIso,
    };

    if (newStatus === 'paid') {
      updateData.paid_at = paymentDate;
    }

    const { error: updateError } = await supabaseAdmin
      .from('platform_billing_invoices')
      .update(updateData)
      .eq('id', invoice.id)
      .eq('ministry_id', invoice.ministry_id);

    if (updateError) {
      // Fallback sem paid_at se a coluna não existir
      if (updateError.message?.includes('paid_at')) {
        delete updateData.paid_at;
        const { error: fbErr } = await supabaseAdmin
          .from('platform_billing_invoices')
          .update(updateData)
          .eq('id', invoice.id)
          .eq('ministry_id', invoice.ministry_id);
        if (fbErr) {
          throw new Error('Falha ao atualizar fatura: ' + fbErr.message);
        }
      } else {
        throw new Error('Falha ao atualizar fatura: ' + updateError.message);
      }
    }

    // 3. Se o status for 'paid', executar ativação e extensão da assinatura pelo SubscriptionService
    if (newStatus === 'paid') {
      const subscriptionService = new SubscriptionService();
      try {
        await subscriptionService.activateSubscription(
          supabaseAdmin,
          invoice.ministry_id,
          invoice.plano_slug || 'starter',
          12 // Vigência padrão
        );
      } catch (subErr: any) {
        console.warn('[Reconciliation] Aviso ao ativar assinatura do tenant ' + invoice.ministry_id + ':', subErr?.message || subErr);
      }

      // Atualizar oportunidade comercial para 'Convertido' se houver
      try {
        const { data: opt } = await supabaseAdmin
          .from('oportunidades_comerciais')
          .select('id, status')
          .eq('ministry_id', invoice.ministry_id)
          .maybeSingle();

        if (opt && opt.status !== 'Convertido') {
          const statusAnterior = opt.status || 'Novo';
          const obs = 'Conversão comercial concluída automaticamente após confirmação do pagamento ASAAS (' + origin + ').';
          
          await supabaseAdmin
            .from('oportunidades_comerciais')
            .update({
              status: 'Convertido',
              observacao_interna: obs,
              updated_at: nowIso,
              updated_by: 'Asaas ' + origin,
            })
            .eq('id', opt.id);

          await supabaseAdmin
            .from('oportunidades_comerciais_historico')
            .insert([{
              oportunidade_id: opt.id,
              status_anterior: statusAnterior,
              status_novo: 'Convertido',
              usuario: 'Asaas ' + origin,
              observacao: obs,
              created_at: nowIso,
            }]);
        }
      } catch (optErr) {
        console.warn('[Reconciliation] Erro ao atualizar oportunidade comercial:', optErr);
      }
    }

    return {
      success: true,
      status: newStatus,
      alreadySynced: false,
      invoiceId: invoice.id,
      ministryId: invoice.ministry_id,
      asaasPaymentId,
    };
  }

  /**
   * Reconcilia faturas locais pendentes/vencidas consultando a API oficial do Asaas.
   */
  static async reconcileInvoices(
    supabaseAdmin: SupabaseClient,
    options: ReconcileOptions = {}
  ): Promise<ReconcileSummary> {
    const { ministryId, limit = 100 } = options;

    let query = supabaseAdmin
      .from('platform_billing_invoices')
      .select('*')
      .not('asaas_payment_id', 'is', null)
      .in('status', ['pending', 'overdue', 'pendente', 'vencida'])
      .order('due_date', { ascending: true })
      .limit(limit);

    if (ministryId) {
      query = query.eq('ministry_id', ministryId);
    }

    const { data: invoices, error: invErr } = await query;

    if (invErr) {
      throw new Error('Erro ao buscar faturas para reconciliação: ' + invErr.message);
    }

    const summary: ReconcileSummary = {
      success: true,
      totalChecked: invoices?.length || 0,
      updated: 0,
      alreadySynced: 0,
      failed: 0,
      details: [],
    };

    for (const invoice of invoices || []) {
      const asaasPaymentId = invoice.asaas_payment_id;
      if (!asaasPaymentId) continue;

      try {
        // Consultar o pagamento oficial no Asaas
        const asaasPayment = await getAsaasPayment(asaasPaymentId);

        if (!asaasPayment?.id) {
          summary.failed++;
          summary.details.push({
            invoiceId: invoice.id,
            ministryId: invoice.ministry_id,
            asaasPaymentId,
            oldStatus: invoice.status,
            newStatus: invoice.status,
            actionTaken: 'skipped_not_found_in_asaas',
            error: 'Pagamento não retornado pela API Asaas',
          });
          continue;
        }

        const result = await this.processInvoicePayment({
          supabaseAdmin,
          invoice,
          asaasPayment,
          origin: 'reconciliation',
        });

        if (result.alreadySynced) {
          summary.alreadySynced++;
          summary.details.push({
            invoiceId: invoice.id,
            ministryId: invoice.ministry_id,
            asaasPaymentId,
            oldStatus: invoice.status,
            newStatus: result.status,
            actionTaken: 'already_synced',
          });
        } else {
          summary.updated++;
          summary.details.push({
            invoiceId: invoice.id,
            ministryId: invoice.ministry_id,
            asaasPaymentId,
            oldStatus: invoice.status,
            newStatus: result.status,
            actionTaken: 'updated_to_' + result.status,
          });
        }
      } catch (itemErr: any) {
        summary.failed++;
        summary.details.push({
          invoiceId: invoice.id,
          ministryId: invoice.ministry_id,
          asaasPaymentId,
          oldStatus: invoice.status,
          newStatus: invoice.status,
          actionTaken: 'error',
          error: itemErr?.message || String(itemErr),
        });
      }
    }

    return summary;
  }
}
