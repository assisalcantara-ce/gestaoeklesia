/**
 * EFI Pay (Gerencianet) — Cliente PIX por ministério
 *
 * Autenticação: OAuth2 com mTLS opcional (certificado p12 em base64)
 * Base URL: pix.api.efipay.com.br (prod) / pix-h.api.efipay.com.br (sandbox)
 *
 * Este módulo segue a mesma arquitetura de asaas-eventos.ts:
 *   - Credenciais recebidas por parâmetro (descriptografadas em memória)
 *   - Sem estado global por ministério
 *   - Funções exportadas puras e testáveis
 */

import https from 'https';
import { Buffer } from 'buffer';

// ─── URLs por ambiente ─────────────────────────────────────────────────────────

const EFI_BASE: Record<string, string> = {
  production: 'https://pix.api.efipay.com.br',
  sandbox:    'https://pix-h.api.efipay.com.br',
};

// ─── Tipos exportados ──────────────────────────────────────────────────────────

export interface EfiPixCharge {
  /** txid da cobrança no EFI */
  id: string;
  /** status normalizado: 'ATIVA' | 'CONCLUIDA' | 'REMOVIDA_PELO_USUARIO_RECEBEDOR' | 'REMOVIDA_PELO_PSP' */
  status: string;
  valor: number;
  dueDate: string;
  invoiceUrl: string | null;
  pix: {
    /** Copia e Cola PIX (payload bruto) */
    payload: string | null;
    /** QR Code em base64 (PNG) */
    encodedImage: string | null;
    expirationDate: string | null;
  };
}

export interface EfiChargeStatusResult {
  /** status normalizado para o domínio interno */
  status: 'pendente' | 'pago' | 'cancelado' | 'expirado';
  paymentDate: string | null;
}

// ─── Cache de token OAuth2 (in-memory, por client_id + environment) ───────────

interface _TokenEntry {
  token: string;
  expiresAt: number; // ms epoch
}
const _tokenCache = new Map<string, _TokenEntry>();

// ─── Primitivo HTTPS com suporte a mTLS ───────────────────────────────────────

async function _httpsRequest(
  url: string,
  method: string,
  headers: Record<string, string>,
  body?: string,
  pfx?: Buffer,
  passphrase?: string
): Promise<{ status: number; text: string }> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);

    const agentOpts: https.AgentOptions = {
      rejectUnauthorized: true,
    };
    if (pfx) {
      agentOpts.pfx = pfx;
      agentOpts.passphrase = passphrase ?? '';
    }

    const reqOpts: https.RequestOptions = {
      hostname: u.hostname,
      port:     u.port ? parseInt(u.port, 10) : 443,
      path:     u.pathname + u.search,
      method,
      headers,
      agent: new https.Agent(agentOpts),
    };

    const req = https.request(reqOpts, (res) => {
      let data = '';
      res.on('data', (chunk: string) => (data += chunk));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, text: data }));
    });

    req.on('error', reject);
    req.setTimeout(15_000, () => req.destroy(new Error('EFI request timeout')));

    if (body) req.write(body);
    req.end();
  });
}

// ─── OAuth2: obter access_token ───────────────────────────────────────────────

async function _getAccessToken(
  clientId: string,
  clientSecret: string,
  environment: string,
  pfx?: Buffer,
  passphrase?: string
): Promise<string> {
  const cacheKey = `${environment}:${clientId}`;
  const cached = _tokenCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.token;
  }

  const base = EFI_BASE[environment] ?? EFI_BASE.sandbox;
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const res = await _httpsRequest(
    `${base}/oauth/token`,
    'POST',
    {
      'Authorization': `Basic ${basicAuth}`,
      'Content-Type':  'application/json',
    },
    JSON.stringify({ grant_type: 'client_credentials' }),
    pfx,
    passphrase
  );

  if (res.status !== 200) {
    throw new Error(`EFI OAuth2 falhou HTTP ${res.status}: ${res.text.slice(0, 300)}`);
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(res.text);
  } catch {
    throw new Error(`EFI OAuth2 retornou JSON inválido: ${res.text.slice(0, 200)}`);
  }

  const token     = String(parsed.access_token ?? '');
  const expiresIn = Number(parsed.expires_in ?? 3600);

  if (!token) {
    throw new Error('EFI OAuth2: access_token ausente na resposta.');
  }

  // Cache com 60s de margem de segurança antes do vencimento
  _tokenCache.set(cacheKey, {
    token,
    expiresAt: Date.now() + (expiresIn - 60) * 1_000,
  });

  return token;
}

// ─── Wrapper autenticado ───────────────────────────────────────────────────────

async function _efiRequest(
  credentials: Record<string, string>,
  environment: string,
  method: string,
  path: string,
  body?: Record<string, unknown>
): Promise<{ status: number; data: Record<string, unknown> }> {
  const { client_id, client_secret, certificate, passphrase } = credentials;

  if (!client_id || !client_secret) {
    throw new Error('EFI: client_id e client_secret são obrigatórios.');
  }

  let pfx: Buffer | undefined;
  if (certificate) {
    try {
      pfx = Buffer.from(certificate, 'base64');
    } catch {
      throw new Error('EFI: certificado em base64 inválido.');
    }
  }

  const token = await _getAccessToken(client_id, client_secret, environment, pfx, passphrase);

  const base = EFI_BASE[environment] ?? EFI_BASE.sandbox;
  const url  = `${base}${path}`;

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${token}`,
    'Content-Type':  'application/json',
  };

  const res = await _httpsRequest(
    url,
    method,
    headers,
    body ? JSON.stringify(body) : undefined,
    pfx,
    passphrase
  );

  let data: Record<string, unknown> = {};
  try {
    if (res.text) data = JSON.parse(res.text);
  } catch {
    data = { _raw: res.text };
  }

  return { status: res.status, data };
}

// ─── Funções públicas ──────────────────────────────────────────────────────────

/**
 * Cria (ou localiza) um "cliente" no EFI.
 * No EFI/PIX, clientes não são pré-cadastrados — o pagador é identificado no
 * momento da cobrança. Esta função retorna o CPF/CNPJ como identificador, ou
 * um pseudo-id baseado no email, para manter compatibilidade com a interface
 * do módulo de Eventos.
 */
export async function getOrCreateEfiCustomer(
  _credentials: Record<string, string>,
  _environment: string,
  _nome: string,
  email: string,
  cpfCnpj?: string
): Promise<string> {
  // EFI não tem API de clientes separada — usamos CPF/e-mail como pseudo-id
  return cpfCnpj ? cpfCnpj.replace(/\D/g, '') : email;
}

/**
 * Cria uma cobrança PIX (cob) no EFI.
 * Retorna txid, copia-e-cola e QR-code.
 */
export async function createEfiPixCharge(
  credentials: Record<string, string>,
  environment: string,
  payerId: string,   // CPF/CNPJ ou e-mail (usado como devedor)
  valor: number,
  descricao: string,
  externalRef: string,
  dueDate?: string  // 'YYYY-MM-DD'; se omitido, usa 1 hora
): Promise<EfiPixCharge> {
  const pixKey = credentials.pix_key;
  if (!pixKey) {
    throw new Error('EFI: credentials.pix_key (chave PIX do ministério) é obrigatório.');
  }

  // txid: alfanumérico, 26-35 chars, sem hífens — derivado do externalRef
  const txid = externalRef
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 35)
    .padEnd(26, '0');

  // Cálculo de expiração (segundos)
  let expiracaoSeg = 3600;
  if (dueDate) {
    const dueDt = new Date(`${dueDate}T23:59:59Z`);
    const diffSeg = Math.floor((dueDt.getTime() - Date.now()) / 1_000);
    expiracaoSeg = diffSeg > 60 ? diffSeg : 3600;
  }

  const valorStr = valor.toFixed(2);

  // Monta devedor — se for CPF (11 dígitos), usa campo cpf; senão omite
  const devedorDigits = payerId.replace(/\D/g, '');
  const devedor =
    devedorDigits.length === 11
      ? { cpf: devedorDigits, nome: descricao.slice(0, 200) }
      : devedorDigits.length === 14
        ? { cnpj: devedorDigits, nome: descricao.slice(0, 200) }
        : undefined;

  const cobBody: Record<string, unknown> = {
    calendario:           { expiracao: expiracaoSeg },
    valor:                { original: valorStr },
    chave:                pixKey,
    solicitacaoPagador:   descricao.slice(0, 140),
    infoAdicionais: [
      { nome: 'Ref', valor: externalRef.slice(0, 50) },
    ],
  };
  if (devedor) cobBody.devedor = devedor;

  // PUT /v2/cob/{txid} (cria com txid determinístico)
  const { status, data } = await _efiRequest(
    credentials,
    environment,
    'PUT',
    `/v2/cob/${txid}`,
    cobBody
  );

  if (status !== 201 && status !== 200) {
    throw new Error(
      `EFI createPixCharge falhou HTTP ${status}: ${JSON.stringify(data).slice(0, 300)}`
    );
  }

  const createdTxid = String(data.txid ?? txid);
  const pixCopiaECola = (data.pixCopiaECola as string) ?? null;
  const locId = (data.loc as Record<string, unknown>)?.id;

  // Tenta buscar QR code (não-bloqueante)
  let encodedImage: string | null = null;
  if (locId) {
    try {
      const qrRes = await _efiRequest(credentials, environment, 'GET', `/v2/loc/${locId}/qrcode`);
      if (qrRes.status === 200 && qrRes.data.imagemQrcode) {
        encodedImage = String(qrRes.data.imagemQrcode);
      }
    } catch {
      // QR code é secundário — ignora falha
    }
  }

  const expiracao = Number((data.calendario as Record<string, unknown>)?.expiracao ?? expiracaoSeg);
  const criacaoStr = String((data.calendario as Record<string, unknown>)?.criacao ?? new Date().toISOString());
  const expirationDate = new Date(
    new Date(criacaoStr).getTime() + expiracao * 1_000
  ).toISOString();

  return {
    id:          createdTxid,
    status:      String(data.status ?? 'ATIVA'),
    valor,
    dueDate:     dueDate ?? expirationDate.slice(0, 10),
    invoiceUrl:  String(data.location ?? '').replace(/^pix/, 'https://pix') || null,
    pix: {
      payload:        pixCopiaECola,
      encodedImage,
      expirationDate,
    },
  };
}

/**
 * Consulta o status de uma cobrança EFI e normaliza para o domínio interno.
 */
export async function getEfiChargeStatus(
  credentials: Record<string, string>,
  environment: string,
  txid: string
): Promise<EfiChargeStatusResult> {
  const { status, data } = await _efiRequest(
    credentials,
    environment,
    'GET',
    `/v2/cob/${txid}`
  );

  if (status !== 200) {
    throw new Error(`EFI getChargeStatus falhou HTTP ${status}: ${JSON.stringify(data).slice(0, 200)}`);
  }

  const efiStatus = String(data.status ?? '');
  const pixArr = Array.isArray(data.pix) ? (data.pix as Record<string, unknown>[]) : [];
  const paymentDate = pixArr.length > 0 ? String(pixArr[0]?.horario ?? '') || null : null;

  let normalized: EfiChargeStatusResult['status'] = 'pendente';
  if (efiStatus === 'CONCLUIDA')                          normalized = 'pago';
  else if (efiStatus === 'REMOVIDA_PELO_USUARIO_RECEBEDOR') normalized = 'cancelado';
  else if (efiStatus === 'REMOVIDA_PELO_PSP')              normalized = 'expirado';

  return { status: normalized, paymentDate };
}

/**
 * Cancela uma cobrança EFI (marca como REMOVIDA_PELO_USUARIO_RECEBEDOR).
 */
export async function cancelEfiCharge(
  credentials: Record<string, string>,
  environment: string,
  txid: string
): Promise<void> {
  const { status, data } = await _efiRequest(
    credentials,
    environment,
    'PATCH',
    `/v2/cob/${txid}`,
    { status: 'REMOVIDA_PELO_USUARIO_RECEBEDOR' }
  );

  if (status !== 200 && status !== 204) {
    throw new Error(
      `EFI cancelCharge falhou HTTP ${status}: ${JSON.stringify(data).slice(0, 200)}`
    );
  }
}

/**
 * Testa a conexão com a API EFI usando as credenciais fornecidas.
 * Obtém um token OAuth2 — operação de leitura sem efeito colateral.
 */
export async function testEfiConnection(
  credentials: Record<string, string>,
  environment: string
): Promise<{ ok: boolean; error?: string }> {
  const { client_id, client_secret, certificate, passphrase } = credentials;

  if (!client_id || !client_secret) {
    return { ok: false, error: 'client_id e client_secret são obrigatórios.' };
  }

  let pfx: Buffer | undefined;
  if (certificate) {
    try {
      pfx = Buffer.from(certificate, 'base64');
    } catch {
      return { ok: false, error: 'Certificado em base64 inválido.' };
    }
  }

  try {
    await _getAccessToken(client_id, client_secret, environment, pfx, passphrase);
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('401') || msg.includes('403')) {
      return { ok: false, error: 'Credenciais inválidas. Verifique client_id e client_secret no painel EFI.' };
    }
    if (msg.includes('timeout')) {
      return { ok: false, error: 'Timeout ao conectar ao EFI. Verifique sua conexão.' };
    }
    return { ok: false, error: msg.slice(0, 300) };
  }
}

/**
 * Registra (ou atualiza) o webhook PIX no EFI para uma chave PIX específica.
 * EFI: PUT /v2/webhook/pix/{chave}
 */
export async function registerEfiWebhook(
  credentials: Record<string, string>,
  environment: string,
  webhookUrl: string
): Promise<{ ok: boolean; error?: string }> {
  const pixKey = credentials.pix_key;
  if (!pixKey) {
    return { ok: false, error: 'credentials.pix_key necessário para registrar webhook EFI.' };
  }

  try {
    const { status, data } = await _efiRequest(
      credentials,
      environment,
      'PUT',
      `/v2/webhook/pix/${encodeURIComponent(pixKey)}`,
      { webhookUrl }
    );

    if (status === 200 || status === 201 || status === 204) {
      return { ok: true };
    }

    return {
      ok:    false,
      error: `EFI webhook PUT retornou HTTP ${status}: ${JSON.stringify(data).slice(0, 200)}`,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg.slice(0, 300) };
  }
}
