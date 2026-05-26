/**
 * EFI Webhook Manager
 *
 * Garante que o webhook PIX do EFI esteja registrado e atualizado para
 * cada ministério. Segue o mesmo padrão de asaas-webhook-manager.ts:
 *   - Idempotente: pode ser chamado múltiplas vezes sem side effects negativos
 *   - Não-bloqueante: nunca lança exceção para o chamador
 *   - Resultado tipado
 */

import { registerEfiWebhook } from './efi-pay';

export interface EnsureEfiWebhookParams {
  /** Credenciais descriptografadas do ministério (client_id, client_secret, pix_key, etc.) */
  credentials: Record<string, string>;
  /** 'sandbox' | 'production' */
  environment: string;
  /** UUID único do ministério (webhook_token de ministry_payment_gateways) */
  webhookToken: string;
  /** Nome do ministério para logs */
  ministryName: string;
}

export interface EnsureEfiWebhookResult {
  success: boolean;
  error: string | null;
}

/**
 * Garante que o webhook EFI esteja registrado para a chave PIX do ministério.
 *
 * URL registrada: {NEXT_PUBLIC_APP_URL}/api/v1/ministry-webhook/efi/{webhookToken}
 *
 * Esta função NUNCA lança exceção — erros são retornados em { success: false, error }.
 */
export async function ensureEfiWebhook(
  params: EnsureEfiWebhookParams
): Promise<EnsureEfiWebhookResult> {
  const { credentials, environment, webhookToken, ministryName } = params;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) {
    const msg = 'NEXT_PUBLIC_APP_URL não configurado — webhook EFI não registrado.';
    console.warn(`[efi-webhook] ${ministryName}: ${msg}`);
    return { success: false, error: msg };
  }

  if (!credentials.pix_key) {
    const msg = 'pix_key ausente nas credenciais — webhook EFI não pode ser registrado sem chave PIX.';
    console.warn(`[efi-webhook] ${ministryName}: ${msg}`);
    return { success: false, error: msg };
  }

  const webhookUrl = `${appUrl}/api/v1/ministry-webhook/efi/${webhookToken}`;

  try {
    const result = await registerEfiWebhook(credentials, environment, webhookUrl);

    if (result.ok) {
      console.log(`[efi-webhook] ${ministryName}: webhook registrado → ${webhookUrl}`);
      return { success: true, error: null };
    }

    console.warn(`[efi-webhook] ${ministryName}: falha ao registrar webhook — ${result.error}`);
    return { success: false, error: result.error ?? 'Erro desconhecido.' };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[efi-webhook] ${ministryName}: exceção inesperada — ${msg}`);
    return { success: false, error: msg.slice(0, 300) };
  }
}
