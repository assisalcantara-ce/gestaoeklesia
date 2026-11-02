import test, { describe } from 'node:test';
import assert from 'node:assert/strict';

// Helper de validação e sanitização idêntico ao implementado na rota PATCH /api/v1/members/:id
function sanitizeAndValidateContacts(body) {
  const updates = {};
  const errors = [];

  // WhatsApp
  if ('whatsapp' in body || 'phone' in body || 'celular' in body) {
    const rawWhatsapp = body.whatsapp !== undefined ? body.whatsapp : (body.celular !== undefined ? body.celular : body.phone);
    if (rawWhatsapp === null || rawWhatsapp === '') {
      updates.whatsapp = null;
      updates.phone = null;
      updates.celular = null;
    } else if (typeof rawWhatsapp === 'string') {
      const digits = rawWhatsapp.replace(/\D/g, '');
      if (digits.length > 0 && (digits.length < 10 || digits.length > 11)) {
        errors.push('WhatsApp inválido. Informe um número com DDD (10 ou 11 dígitos).');
      } else {
        updates.whatsapp = digits || null;
        updates.phone = digits || null;
        updates.celular = digits || null;
      }
    }
  }

  // E-mail
  if ('email' in body) {
    const rawEmail = body.email;
    if (rawEmail === null || rawEmail === '') {
      updates.email = null;
    } else if (typeof rawEmail === 'string') {
      const cleanEmail = rawEmail.trim().toLowerCase();
      if (cleanEmail.length > 0 && !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(cleanEmail)) {
        errors.push('E-mail inválido. Informe um endereço válido (exemplo@dominio.com).');
      } else {
        updates.email = cleanEmail || null;
      }
    }
  }

  return { updates, errors };
}

describe('Edição Rápida de Contatos dos Aniversariantes', () => {
  test('1. Deve validar número de WhatsApp com 10 ou 11 dígitos válidos', () => {
    const res1 = sanitizeAndValidateContacts({ whatsapp: '(91) 98249-9130' });
    assert.strictEqual(res1.errors.length, 0);
    assert.strictEqual(res1.updates.whatsapp, '91982499130');
    assert.strictEqual(res1.updates.phone, '91982499130');
    assert.strictEqual(res1.updates.celular, '91982499130');

    const res2 = sanitizeAndValidateContacts({ whatsapp: '(91) 3222-1234' });
    assert.strictEqual(res2.errors.length, 0);
    assert.strictEqual(res2.updates.whatsapp, '9132221234');

    const resInvalido = sanitizeAndValidateContacts({ whatsapp: '123' });
    assert.strictEqual(resInvalido.errors.length, 1);
    assert.match(resInvalido.errors[0], /WhatsApp inválido/);
  });

  test('2. Deve permitir limpar o WhatsApp atribuindo null', () => {
    const res = sanitizeAndValidateContacts({ whatsapp: '' });
    assert.strictEqual(res.errors.length, 0);
    assert.strictEqual(res.updates.whatsapp, null);
    assert.strictEqual(res.updates.phone, null);
    assert.strictEqual(res.updates.celular, null);
  });

  test('3. Deve validar formato de e-mail e normalizar para minúsculas', () => {
    const resValido = sanitizeAndValidateContacts({ email: '  AlexFerreira89@Gmail.COM  ' });
    assert.strictEqual(resValido.errors.length, 0);
    assert.strictEqual(resValido.updates.email, 'alexferreira89@gmail.com');

    const resInvalido = sanitizeAndValidateContacts({ email: 'email_sem_arroba' });
    assert.strictEqual(resInvalido.errors.length, 1);
    assert.match(resInvalido.errors[0], /E-mail inválido/);
  });

  test('4. Deve permitir limpar o e-mail atribuindo null', () => {
    const res = sanitizeAndValidateContacts({ email: '' });
    assert.strictEqual(res.errors.length, 0);
    assert.strictEqual(res.updates.email, null);
  });

  test('5. Deve permitir atualizar ambos os campos simultaneamente', () => {
    const res = sanitizeAndValidateContacts({
      whatsapp: '(91) 98111-2233',
      email: 'membro@igreja.com.br',
    });
    assert.strictEqual(res.errors.length, 0);
    assert.strictEqual(res.updates.whatsapp, '91981112233');
    assert.strictEqual(res.updates.email, 'membro@igreja.com.br');
  });
});
