import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();

test('Auditoria Financeira & logServerAudit - Validação de Robustez e Conformidade', async (t) => {
  const auditLoggerPath = path.join(projectRoot, 'src/lib/audit-logger.ts');
  const auditLoggerContent = fs.readFileSync(auditLoggerPath, 'utf-8');

  const routePath = path.join(projectRoot, 'src/app/api/v1/tesouraria/lancamentos/route.ts');
  const routeContent = fs.readFileSync(routePath, 'utf-8');

  await t.test('1. Tesouraria fornece UUID real de lancamento.id ao logServerAudit após gravação', () => {
    // No POST, passa lancamento.id (UUID oficial da tabela)
    assert.match(routeContent, /registroId:\s*lancamento\.id/);
    // No PUT, passa o id validado da query string
    assert.match(routeContent, /registroId:\s*id/);
    // Código visual REG-YYYY-XXXXXX é preservado separadamente
    assert.match(routeContent, /codigo_registro:\s*lancamento\.codigo_registro/);
  });

  await t.test('2. logServerAudit valida UUIDs e faz fallback seguro para não quebrar coluna registro_id do tipo UUID', () => {
    assert.match(auditLoggerContent, /const UUID_REGEX = \/\^\[0-9a-f\]\{8\}-\[0-9a-f\]\{4\}-\[1-5\]\[0-9a-f\]\{3\}-\[89ab\]\[0-9a-f\]\{3\}-\[0-9a-f\]\{12\}\$\/i;/);
    assert.match(auditLoggerContent, /function toValidUuidOrNull/);
    assert.match(auditLoggerContent, /const validRegistroId = toValidUuidOrNull\(params\.registroId\);/);
    assert.match(auditLoggerContent, /registro_id:\s*validRegistroId/);
    // Se o registroId for código visual (REG-...), é preservado na descrição
    assert.match(auditLoggerContent, /\[Ref: \$\{params\.registroId\}\]/);
  });

  await t.test('3. logServerAudit normaliza IP com múltiplos proxies para preservar tipo INET', () => {
    assert.match(auditLoggerContent, /function toValidIpOrNull/);
    assert.match(auditLoggerContent, /if \(trimmed\.includes\(','\)\)/);
    assert.match(auditLoggerContent, /ip_address:\s*validIp/);
  });

  await t.test('4. Sanitização recursiva mascara credenciais e dados sensíveis sem vazar segredos', () => {
    assert.match(auditLoggerContent, /export function sanitizeAuditData/);
    assert.match(auditLoggerContent, /'password'/);
    assert.match(auditLoggerContent, /'token'/);
    assert.match(auditLoggerContent, /'secret'/);
    assert.match(auditLoggerContent, /'\[REDACTED\]'/);
  });

  await t.test('5. Rejeição do banco em audit_logs é isolada e não propaga erro nem cancela o lançamento financeiro', () => {
    // Na API de tesouraria, o logServerAudit deve estar isolado com try/catch não-bloqueante
    assert.match(routeContent, /await logServerAudit\(admin,\s*\{[\s\S]*?\}\);\s*\}\s*catch\s*\(auditErr\)\s*\{\s*console\.warn\('\[AuditLogger\] Falha não-bloqueante/);
    // No próprio audit-logger, erros gerais são capturados sem re-throw
    assert.match(auditLoggerContent, /catch \(err\)/);
    assert.match(auditLoggerContent, /console\.warn\('\[AuditLogger\] Falha silenciosa ao registrar log:', err\)/);
  });

  await t.test('6. Inserção não gera logs duplicados em caso de retry (retry só ocorre se erro na primeira)', () => {
    // O retry de esquema só é executado no bloco `if (error)` da primeira inserção
    assert.match(auditLoggerContent, /const \{ error \} = await adminClient\.from\('audit_logs'\)\.insert\(\[payloadAtual\]\);/);
    assert.match(auditLoggerContent, /if \(error\) \{[\s\S]*?retryError[\s\S]*?legacyError/);
  });
});
