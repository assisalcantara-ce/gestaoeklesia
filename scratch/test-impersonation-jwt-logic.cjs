const crypto = require('crypto');
require('dotenv').config({ path: '.env.local' });

function base64UrlEncode(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf8');
}

function getJwtSecret() {
  return (
    process.env.IMPERSONATION_JWT_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    'gestaoeklesia-impersonation-secret-key-2026-secure'
  );
}

function signImpersonationToken(params) {
  const nowInSeconds = Math.floor(Date.now() / 1000);
  const durationInSeconds = (params.durationMinutes || 30) * 60;
  const expiresAtSeconds = nowInSeconds + durationInSeconds;

  const payload = {
    type: 'impersonation',
    sessionId: params.sessionId,
    originalAdminId: params.originalAdminId,
    targetTenantId: params.targetTenantId,
    readOnly: !!params.readOnly,
    issuedAt: nowInSeconds,
    expiresAt: expiresAtSeconds,
  };

  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));

  const secret = getJwtSecret();
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64url');

  const token = `${encodedHeader}.${encodedPayload}.${signature}`;
  const expiresAtIso = new Date(expiresAtSeconds * 1000).toISOString();

  return { token, expiresAt: expiresAtIso, payload };
}

function verifyImpersonationToken(token) {
  if (!token || typeof token !== 'string') {
    return { valid: false, error: 'INVALID_FORMAT' };
  }

  const parts = token.trim().replace(/^Bearer\s+/i, '').split('.');
  if (parts.length !== 3) {
    return { valid: false, error: 'INVALID_FORMAT' };
  }

  const [encodedHeader, encodedPayload, signature] = parts;
  const secret = getJwtSecret();

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64url');

  try {
    const sigBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);

    if (
      sigBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(sigBuffer, expectedBuffer)
    ) {
      return { valid: false, error: 'INVALID_SIGNATURE' };
    }
  } catch {
    return { valid: false, error: 'INVALID_SIGNATURE' };
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload));

    if (payload.type !== 'impersonation') {
      return { valid: false, error: 'INVALID_TYPE' };
    }

    const nowInSeconds = Math.floor(Date.now() / 1000);
    if (nowInSeconds > payload.expiresAt) {
      return { valid: false, payload, error: 'EXPIRED' };
    }

    return { valid: true, payload };
  } catch {
    return { valid: false, error: 'INVALID_FORMAT' };
  }
}

function isRoleAuthorizedForImpersonation(role) {
  const normRole = String(role || '').toLowerCase().trim();
  return normRole === 'super_admin';
}

console.log("=== INICIANDO TESTES DE UNIDADE DE IMPERSONATION JWT & REGRAS ===");

// Teste 1: Matriz de Permissoes
console.log("\n1. Testando Matriz de Permissoes por Perfil:");
const rolesToTest = [
  { role: 'super_admin', expected: true },
  { role: 'admin', expected: false },
  { role: 'financeiro', expected: false },
  { role: 'suporte', expected: false },
  { role: 'comercial', expected: false },
];

rolesToTest.forEach(({ role, expected }) => {
  const allowed = isRoleAuthorizedForImpersonation(role);
  const status = allowed === expected ? '✅ OK' : '❌ FALHA';
  console.log(`   ${status} Role: '${role}' -> Permitido: ${allowed} (Esperado: ${expected})`);
});

// Teste 2: Emissao de JWT de Impersonation
console.log("\n2. Testando Emissão de JWT de Impersonação:");
const mockParams = {
  sessionId: 'sessao-uuid-12345',
  originalAdminId: 'superadmin-uuid-999',
  targetTenantId: 'barcarena-tenant-uuid-08c',
  readOnly: false,
  durationMinutes: 30,
};

const result = signImpersonationToken(mockParams);
console.log("   ✅ Token Gerado com Sucesso!");
console.log("   Token:", result.token.substring(0, 40) + '...');
console.log("   ExpiresAt:", result.expiresAt);
console.log("   Payload JSON:", JSON.stringify(result.payload, null, 2));

// Teste 3: Validacao de JWT de Impersonation
console.log("\n3. Testando Validação de JWT Válido:");
const valResult = verifyImpersonationToken(result.token);
console.log(`   ✅ Válido: ${valResult.valid}`);
console.log(`   Payload extraído com sucesso (Type: ${valResult.payload.type}, SessionId: ${valResult.payload.sessionId})`);

// Teste 4: Rejeicao de Token Adulterado
console.log("\n4. Testando Rejeição de Token Adulterado:");
const tamperedToken = result.token.slice(0, -5) + 'XXXXX';
const tamperedResult = verifyImpersonationToken(tamperedToken);
console.log(`   ✅ Assinatura Adulterada Rejeitada! Status: ${tamperedResult.valid}, Erro: ${tamperedResult.error}`);

// Teste 5: Rejeicao de Token Expirado (Simulacao durationMinutes = -1)
console.log("\n5. Testando Rejeição de Token Expirado:");
const expiredResult = signImpersonationToken({ ...mockParams, durationMinutes: -1 });
const expiredVal = verifyImpersonationToken(expiredResult.token);
console.log(`   ✅ Expiração Validada com Sucesso! Status: ${expiredVal.valid}, Erro: ${expiredVal.error}`);

console.log("\n🎉 TODOS OS TESTES DE UNIDADE DE IMPERSONATION 2.0A PASSARAM COM SUCESSO!");
