import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { signMemberPrefillToken, verifyMemberPrefillToken } from '../../src/lib/evento-membro-token';

describe('Evento Membro Token - Assinatura e Validação HMAC', () => {
  it('1. Deve assinar e validar um token legítimo com sucesso', () => {
    const payload = {
      memberId: 'membro-uuid-1234',
      eventoId: 'evento-uuid-5678',
      ministryId: 'ministry-uuid-9999',
    };

    const token = signMemberPrefillToken(payload);
    assert.ok(typeof token === 'string' && token.length > 20);

    const resultado = verifyMemberPrefillToken(token);
    assert.equal(resultado.valido, true);
    assert.equal(resultado.memberId, payload.memberId);
    assert.equal(resultado.eventoId, payload.eventoId);
    assert.equal(resultado.ministryId, payload.ministryId);
  });

  it('2. Deve rejeitar token adulterado ou com assinatura inválida', () => {
    const payload = {
      memberId: 'membro-uuid-1234',
      eventoId: 'evento-uuid-5678',
      ministryId: 'ministry-uuid-9999',
    };

    const token = signMemberPrefillToken(payload);
    const raw = Buffer.from(token, 'base64url').toString('utf-8');
    const parsed = JSON.parse(raw);

    // Adulterar memberId
    parsed.memberId = 'membro-hacker-666';
    const fakeToken = Buffer.from(JSON.stringify(parsed)).toString('base64url');

    const resultado = verifyMemberPrefillToken(fakeToken);
    assert.equal(resultado.valido, false);
    assert.equal(resultado.motivo, 'Assinatura inválida.');
  });

  it('3. Deve rejeitar token expirado', () => {
    const payload = {
      memberId: 'membro-uuid-1234',
      eventoId: 'evento-uuid-5678',
      ministryId: 'ministry-uuid-9999',
      expiraEmMs: Date.now() - 1000, // Expirado há 1s
    };

    const token = signMemberPrefillToken(payload);
    const resultado = verifyMemberPrefillToken(token);
    assert.equal(resultado.valido, false);
    assert.match(resultado.motivo || '', /expirado/i);
  });

  it('4. Deve rejeitar strings vazias ou tokens malformados', () => {
    assert.equal(verifyMemberPrefillToken('').valido, false);
    assert.equal(verifyMemberPrefillToken('token-invalido-abc').valido, false);
  });
});
