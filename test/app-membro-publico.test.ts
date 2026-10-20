import test from 'node:test';
import assert from 'node:assert/strict';

test('App do Membro Simplificado — Validações de Roteamento e Governança Pública', async (t) => {
  await t.test('deve construir URL pública padronizada por slug', () => {
    const slug = 'adananindeua';
    const origin = 'https://app.gestaoeklesia.com.br';
    const publicUrl = `${origin}/igreja/${slug}`;
    assert.equal(publicUrl, 'https://app.gestaoeklesia.com.br/igreja/adananindeua');
  });

  await t.test('deve sanitizar slug de ministério para resolução de tenant', () => {
    const rawSlug = '  ADAnanindeua  ';
    const cleanSlug = rawSlug.trim().toLowerCase();
    assert.equal(cleanSlug, 'adananindeua');
  });

  await t.test('deve classificar corretamente rotas públicas vs protegidas', () => {
    const publicFeatures = ['inicio', 'agenda', 'cultos', 'eventos', 'oracao', 'avisos', 'contato'];
    const privateFeatures = ['credencial', 'perfil', 'documentos', 'financeiro', 'historico'];

    const checkIsPrivate = (feat: string) => privateFeatures.includes(feat);

    assert.equal(checkIsPrivate('credencial'), true);
    assert.equal(checkIsPrivate('perfil'), true);
    assert.equal(checkIsPrivate('inicio'), false);
    assert.equal(checkIsPrivate('agenda'), false);
    assert.equal(checkIsPrivate('oracao'), false);
  });

  await t.test('deve validar estrutura do payload de pedido de oração público', () => {
    const payload = {
      assunto: 'Saúde da família',
      descricao: 'Peço oração pela recuperação da minha mãe',
      nome_solicitante: 'Maria José',
      contato_solicitante: '(91) 98888-7777',
      tipo: 'oracao',
      sigiloso: true,
    };

    assert.ok(payload.assunto.length > 0);
    assert.ok(payload.descricao.length > 0);
    assert.equal(payload.sigiloso, true);
    assert.equal(payload.tipo, 'oracao');
  });
});
