import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateSecureEbdToken,
  hashEbdToken,
  calculateExpirationDate,
  formatWhatsappChamadaMessage,
} from '../../src/lib/ebd-chamada-token.ts';

describe('EBD — Link Temporário de Chamada (Segurança & Utilitários)', () => {
  it('1. Deve gerar token seguro único com formato URL-safe e prefixo ebd_', () => {
    const token1 = generateSecureEbdToken();
    const token2 = generateSecureEbdToken();

    assert.ok(token1.startsWith('ebd_'));
    assert.ok(token2.startsWith('ebd_'));
    assert.notEqual(token1, token2);
    assert.ok(token1.length >= 40);
  });

  it('2. Deve computar hash SHA-256 determinístico para o token', () => {
    const rawToken = 'ebd_test_secret_token_12345';
    const hash1 = hashEbdToken(rawToken);
    const hash2 = hashEbdToken(rawToken);

    assert.equal(hash1, hash2);
    assert.equal(hash1.length, 64); // SHA-256 hex é de 64 chars
    assert.notEqual(hash1, rawToken);
  });

  it('3. Deve calcular data de expiração no futuro (mínimo 48h)', () => {
    const dataAula = '2026-10-04';
    const expStr = calculateExpirationDate(dataAula);
    const expDate = new Date(expStr);

    assert.ok(!isNaN(expDate.getTime()));
    assert.ok(expDate.getTime() > Date.now());
  });

  it('4. Deve formatar mensagem amigável para o WhatsApp', () => {
    const msg = formatWhatsappChamadaMessage({
      professorNome: 'Pr. Lucas',
      turmaNome: 'Jovens',
      classeNome: 'Geração Eleita',
      dataAula: '2026-10-04',
      url: 'https://gestaoeklesia.com/ebd/chamada-rapida/ebd_xyz',
    });

    assert.ok(msg.includes('Paz do Senhor, Pr. Lucas!'));
    assert.ok(msg.includes('*Jovens*'));
    assert.ok(msg.includes('04/10/2026'));
    assert.ok(msg.includes('https://gestaoeklesia.com/ebd/chamada-rapida/ebd_xyz'));
  });
});
