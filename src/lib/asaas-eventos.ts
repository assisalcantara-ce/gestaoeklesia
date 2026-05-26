/**
 * asaas-eventos.ts
 *
 * Funções SERVER-SIDE para integração ASAAS no fluxo de Eventos Pagos.
 *
 * ⚠️  NUNCA importe em componentes 'use client'.
 * ⚠️  NUNCA logue a apiKey.
 * ⚠️  A apiKey é obtida das credenciais criptografadas do ministério,
 *     descriptografadas em memória por chamada.
 */

export interface AsaasEventoCustomer {
  id: string;
}

export interface AsaasEventoCharge {
  id: string;                  // charge ID no ASAAS
  status: string;
  value: number;
  dueDate: string;
  invoiceUrl: string | null;
  pix?: {
    payload: string | null;    // EMV copia-e-cola
    encodedImage: string | null; // base64 da imagem do QR Code
    expirationDate: string | null;
  };
}

// ─── Helpers internos ─────────────────────────────────────────────────────────

async function asaasRequest<T>(
  apiKey: string,
  path: string,
  init: RequestInit
): Promise<T> {
  const baseUrl = process.env.ASAAS_API_URL || 'https://api.asaas.com/v3';
  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      access_token: apiKey,
      ...(init.headers ?? {}),
    },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail =
      (data as any)?.errors?.[0]?.description ||
      (data as any)?.errors?.[0]?.detail ||
      (data as any)?.message ||
      'Erro ASAAS';
    throw new Error(detail);
  }
  return data as T;
}

// ─── Customer ─────────────────────────────────────────────────────────────────

/**
 * Encontra ou cria um customer ASAAS pelo e-mail.
 * Retorna o customer ID (string "cus_XXXXX").
 */
export async function getOrCreateAsaasCustomer(
  apiKey: string,
  nome: string,
  email: string,
  cpfCnpj?: string | null
): Promise<string> {
  // Busca por e-mail primeiro
  const search = await asaasRequest<{ data: Array<{ id: string; cpfCnpj?: string | null }> }>(
    apiKey,
    `/customers?email=${encodeURIComponent(email)}&limit=1`,
    { method: 'GET' }
  );
  if (search.data?.[0]?.id) {
    const existing = search.data[0];
    // Se temos CPF e o customer não tem, atualiza
    if (cpfCnpj && !existing.cpfCnpj) {
      const clean = cpfCnpj.replace(/\D/g, '');
      if (clean.length >= 11) {
        await asaasRequest(apiKey, `/customers/${existing.id}`, {
          method: 'PUT',
          body: JSON.stringify({ cpfCnpj: clean }),
        }).catch(() => { /* ignora erro de atualização — tenta mesmo assim */ });
      }
    }
    return existing.id;
  }

  // Se tem CPF/CNPJ, tenta por documento
  if (cpfCnpj) {
    const clean = cpfCnpj.replace(/\D/g, '');
    if (clean.length >= 11) {
      const byCpf = await asaasRequest<{ data: Array<{ id: string }> }>(
        apiKey,
        `/customers?cpfCnpj=${clean}&limit=1`,
        { method: 'GET' }
      ).catch(() => ({ data: [] as Array<{ id: string }> }));
      if (byCpf.data?.[0]?.id) return byCpf.data[0].id;
    }
  }

  // Cria novo customer
  const created = await asaasRequest<{ id: string }>(apiKey, '/customers', {
    method: 'POST',
    body: JSON.stringify({
      name: nome.slice(0, 150),
      email: email.toLowerCase(),
      ...(cpfCnpj ? { cpfCnpj: cpfCnpj.replace(/\D/g, '') } : {}),
    }),
  });
  return created.id;
}

// ─── Cobrança PIX ─────────────────────────────────────────────────────────────

/**
 * Cria uma cobrança PIX no ASAAS e busca o QR Code/payload.
 */
export async function createAsaasPixCharge(
  apiKey: string,
  customerId: string,
  valor: number,
  descricao: string,
  externalRef: string,
  dueDate: string // 'YYYY-MM-DD'
): Promise<AsaasEventoCharge> {
  const charge = await asaasRequest<{
    id: string;
    status: string;
    value: number;
    dueDate: string;
    invoiceUrl: string | null;
  }>(apiKey, '/payments', {
    method: 'POST',
    body: JSON.stringify({
      customer: customerId,
      billingType: 'PIX',
      value: valor,
      dueDate,
      description: descricao.slice(0, 500),
      externalReference: externalRef,
    }),
  });

  // Busca o QR Code imediatamente
  const pixData = await asaasRequest<{
    payload: string | null;
    encodedImage: string | null;
    expirationDate: string | null;
  }>(apiKey, `/payments/${charge.id}/pixQrCode`, { method: 'GET' }).catch(
    () => ({ payload: null, encodedImage: null, expirationDate: null })
  );

  return {
    id: charge.id,
    status: charge.status,
    value: charge.value,
    dueDate: charge.dueDate,
    invoiceUrl: charge.invoiceUrl ?? null,
    pix: {
      payload: pixData.payload ?? null,
      encodedImage: pixData.encodedImage ?? null,
      expirationDate: pixData.expirationDate ?? null,
    },
  };
}

// ─── Consulta de status ───────────────────────────────────────────────────────

export async function getAsaasChargeStatus(
  apiKey: string,
  chargeId: string
): Promise<{ status: string; paymentDate: string | null }> {
  const data = await asaasRequest<{ status: string; paymentDate: string | null }>(
    apiKey,
    `/payments/${chargeId}`,
    { method: 'GET' }
  );
  return { status: data.status, paymentDate: data.paymentDate ?? null };
}

// ─── Cancelamento ─────────────────────────────────────────────────────────────

export async function cancelAsaasCharge(
  apiKey: string,
  chargeId: string
): Promise<void> {
  await asaasRequest(apiKey, `/payments/${chargeId}`, { method: 'DELETE' }).catch(
    () => { /* ignora se já cancelado */ }
  );
}

// ─── Helpers de data ──────────────────────────────────────────────────────────

/** Retorna 'YYYY-MM-DD' adicionando `days` dias à data atual. */
export function futureDateStr(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
