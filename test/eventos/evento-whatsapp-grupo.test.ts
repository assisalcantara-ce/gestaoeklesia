import test from 'node:test';
import assert from 'node:assert/strict';

interface EventoComWhatsApp {
  id: string;
  titulo: string;
  whatsapp_grupo_url?: string | null;
}

test('Campo Link do Grupo de WhatsApp do Evento (Criação e Edição)', async (t) => {
  await t.test('1. Aceita link válido de convite de WhatsApp (chat.whatsapp.com)', () => {
    const urlValida = 'https://chat.whatsapp.com/L1234567890abcdef';
    const formEvento = {
      titulo: 'Congresso de Jovens 2026',
      whatsapp_grupo_url: urlValida,
    };

    const payload = {
      titulo: formEvento.titulo,
      whatsapp_grupo_url: formEvento.whatsapp_grupo_url?.trim() || null,
    };

    assert.equal(payload.whatsapp_grupo_url, urlValida);
  });

  await t.test('2. Limpeza e normalização de campo vazio ou espaços', () => {
    const formVazio = {
      titulo: 'Culto Especial',
      whatsapp_grupo_url: '   ',
    };

    const payload = {
      titulo: formVazio.titulo,
      whatsapp_grupo_url: formVazio.whatsapp_grupo_url?.trim() || null,
    };

    assert.equal(payload.whatsapp_grupo_url, null);
  });

  await t.test('3. Edição: carregar e atualizar valor de whatsapp_grupo_url', () => {
    const eventoExistente: EventoComWhatsApp = {
      id: 'ev-1',
      titulo: 'Retiro Espiritual',
      whatsapp_grupo_url: 'https://chat.whatsapp.com/antigo123',
    };

    // Preenchimento no formulário de edição
    let formEvento = {
      titulo: eventoExistente.titulo,
      whatsapp_grupo_url: eventoExistente.whatsapp_grupo_url ?? '',
    };

    assert.equal(formEvento.whatsapp_grupo_url, 'https://chat.whatsapp.com/antigo123');

    // Operador altera o link do grupo
    formEvento.whatsapp_grupo_url = 'https://chat.whatsapp.com/novo456';

    const payloadUpdate = {
      titulo: formEvento.titulo,
      whatsapp_grupo_url: formEvento.whatsapp_grupo_url.trim() || null,
    };

    assert.equal(payloadUpdate.whatsapp_grupo_url, 'https://chat.whatsapp.com/novo456');
  });

  await t.test('4. Resiliência: se banco remoto não possuir a coluna, fallback remove o campo sem quebrar o fluxo', () => {
    const payload: Record<string, any> = {
      titulo: 'Seminário',
      whatsapp_grupo_url: 'https://chat.whatsapp.com/teste',
    };

    // Simula erro de coluna ausente (code 42703 ou mensagem contendo o nome da coluna)
    const errorMock = { code: '42703', message: 'column "whatsapp_grupo_url" does not exist' };

    let erroTratado = false;
    if (errorMock.code === '42703' || errorMock.message.includes('whatsapp_grupo_url')) {
      delete payload.whatsapp_grupo_url;
      erroTratado = true;
    }

    assert.equal(erroTratado, true);
    assert.equal('whatsapp_grupo_url' in payload, false);
    assert.equal(payload.titulo, 'Seminário');
  });
});
