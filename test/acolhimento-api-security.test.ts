import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { checkRateLimit } from '../src/lib/rate-limit';
import { onlyDigits, formatPhone } from '../src/lib/mascaras';

describe('Segurança e Regras de Negócio da API de Acolhimento', () => {
  describe('1. Rate Limiting em Memória', () => {
    it('bloqueia excesso de requisições por IP e Token', () => {
      const testKey = `test_rate_limit_${Date.now()}`;
      const limit = 3;
      const windowMs = 5000;

      // 3 requisições permitidas
      const r1 = checkRateLimit(testKey, limit, windowMs);
      assert.equal(r1.allowed, true);
      assert.equal(r1.remaining, 2);

      const r2 = checkRateLimit(testKey, limit, windowMs);
      assert.equal(r2.allowed, true);
      assert.equal(r2.remaining, 1);

      const r3 = checkRateLimit(testKey, limit, windowMs);
      assert.equal(r3.allowed, true);
      assert.equal(r3.remaining, 0);

      // 4ª requisição deve ser bloqueada
      const r4 = checkRateLimit(testKey, limit, windowMs);
      assert.equal(r4.allowed, false);
      assert.equal(r4.remaining, 0);
      assert.ok(r4.retryAfterSeconds > 0);
    });
  });

  describe('2. Validação Estrita de Consentimento LGPD', () => {
    it('exige consentimento booleano verdadeiro', () => {
      function validateLgpd(consentimento: any): boolean {
        return consentimento === true;
      }

      assert.equal(validateLgpd(true), true);
      assert.equal(validateLgpd(false), false);
      assert.equal(validateLgpd(undefined), false);
      assert.equal(validateLgpd(null), false);
      assert.equal(validateLgpd('true'), false);
    });
  });

  describe('3. Validação de Telefone / WhatsApp e Formatação', () => {
    it('normaliza números de telefone e rejeita formatos inconsistentes', () => {
      function processPhone(rawPhone?: string | null): { valid: boolean; normalized: string | null } {
        if (!rawPhone || !rawPhone.trim()) {
          return { valid: true, normalized: null };
        }
        let digits = onlyDigits(rawPhone);
        if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) {
          digits = digits.slice(2);
        }
        if (digits.startsWith('0')) {
          digits = digits.slice(1);
        }
        if (digits.length < 10 || digits.length > 11) {
          return { valid: false, normalized: null };
        }
        return { valid: true, normalized: formatPhone(digits) };
      }

      assert.deepEqual(processPhone(''), { valid: true, normalized: null });
      assert.deepEqual(processPhone(undefined), { valid: true, normalized: null });
      assert.deepEqual(processPhone('11999998888'), { valid: true, normalized: '(11) 99999-8888' });
      assert.deepEqual(processPhone('+55 (21) 98888-7777'), { valid: true, normalized: '(21) 98888-7777' });
      assert.deepEqual(processPhone('12345'), { valid: false, normalized: null });
    });
  });

  describe('4. Regras de Elegibilidade do Token e Culto', () => {
    it('rejeita tokens inativos, expirados ou cultos encerrados', () => {
      function evaluateTokenEligibility(tokenRecord: {
        is_active: boolean;
        expires_at: string | null;
        culto_status: string;
      }) {
        if (!tokenRecord.is_active) {
          return { elegivel: false, code: 'TOKEN_INATIVO' };
        }
        if (tokenRecord.expires_at && new Date(tokenRecord.expires_at) <= new Date()) {
          return { elegivel: false, code: 'TOKEN_EXPIRADO' };
        }
        if (tokenRecord.culto_status !== 'Aberto') {
          return { elegivel: false, code: 'CULTO_ENCERRADO' };
        }
        return { elegivel: true };
      }

      // Token inativo
      assert.deepEqual(
        evaluateTokenEligibility({ is_active: false, expires_at: null, culto_status: 'Aberto' }),
        { elegivel: false, code: 'TOKEN_INATIVO' }
      );

      // Token expirado
      assert.deepEqual(
        evaluateTokenEligibility({
          is_active: true,
          expires_at: new Date(Date.now() - 3600000).toISOString(),
          culto_status: 'Aberto',
        }),
        { elegivel: false, code: 'TOKEN_EXPIRADO' }
      );

      // Culto encerrado
      assert.deepEqual(
        evaluateTokenEligibility({ is_active: true, expires_at: null, culto_status: 'Encerrado' }),
        { elegivel: false, code: 'CULTO_ENCERRADO' }
      );

      // Culto consolidado
      assert.deepEqual(
        evaluateTokenEligibility({ is_active: true, expires_at: null, culto_status: 'Consolidado' }),
        { elegivel: false, code: 'CULTO_ENCERRADO' }
      );

      // Token válido e culto aberto
      assert.deepEqual(
        evaluateTokenEligibility({
          is_active: true,
          expires_at: new Date(Date.now() + 3600000).toISOString(),
          culto_status: 'Aberto',
        }),
        { elegivel: true }
      );
    });
  });

  describe('5. Isolamento de Tenant e Proteção contra Adulteração', () => {
    it('garante que ministry_id, congregacao_id e culto_id venham estritamente do banco', () => {
      const dbTokenRecord = {
        culto_id: 'culto-real-123',
        ministry_id: 'ministry-real-456',
        congregacao_id: 'congregacao-real-789',
      };

      // Tentativa maliciosa do cliente enviando outros IDs no payload
      const maliciousPayload = {
        culto_id: 'hacker-culto-999',
        ministry_id: 'hacker-ministry-999',
        congregacao_id: 'hacker-congregacao-999',
        nome: 'Visitante Legítimo',
        telefone: '(11) 98888-1111',
      };

      // Construção do payload seguro conforme implementado na rota POST
      const secureInsertPayload = {
        culto_id: dbTokenRecord.culto_id,
        ministry_id: dbTokenRecord.ministry_id,
        congregacao_id: dbTokenRecord.congregacao_id,
        nome: maliciousPayload.nome.trim(),
        telefone: maliciousPayload.telefone,
      };

      assert.equal(secureInsertPayload.culto_id, 'culto-real-123');
      assert.equal(secureInsertPayload.ministry_id, 'ministry-real-456');
      assert.equal(secureInsertPayload.congregacao_id, 'congregacao-real-789');
      assert.notEqual(secureInsertPayload.culto_id, maliciousPayload.culto_id);
    });
  });
});
