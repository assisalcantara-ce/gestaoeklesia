import test from 'node:test';
import assert from 'node:assert/strict';
import { safeResponseJson } from '../../src/lib/api-client.ts';

test('safeResponseJson - Proteção contra quebras de resposta não-JSON', async (t) => {
  await t.test('deve tratar resposta HTML de erro (ex: 500 do Vercel/Next com "An error occurred...") sem estourar JSON.parse', async () => {
    const mockHtmlResponse = new Response('<html><body><h1>An error occurred on the server</h1></body></html>', {
      status: 500,
      statusText: 'Internal Server Error',
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });

    const result = await safeResponseJson(mockHtmlResponse, 'Falha ao salvar lançamento.');
    assert.equal(result.ok, false);
    assert.equal(result.status, 500);
    assert.match(result.error || '', /An error occurred on the server/);
  });

  await t.test('deve tratar texto simples de erro sem formatação JSON', async () => {
    const mockTextResponse = new Response('An error occurred while executing transaction', {
      status: 502,
      statusText: 'Bad Gateway',
      headers: { 'Content-Type': 'text/plain' },
    });

    const result = await safeResponseJson(mockTextResponse, 'Falha ao processar.');
    assert.equal(result.ok, false);
    assert.equal(result.status, 502);
    assert.equal(result.error, 'An error occurred while executing transaction');
  });

  await t.test('deve parsear JSON válido normalmente em caso de sucesso', async () => {
    const mockSuccessResponse = new Response(JSON.stringify({ success: true, data: { id: 'lanc-123', valor: 150 } }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });

    const result = await safeResponseJson(mockSuccessResponse);
    assert.equal(result.ok, true);
    assert.equal(result.status, 201);
    assert.equal(result.success, true);
    assert.equal(result.data.id, 'lanc-123');
    assert.equal(result.data.valor, 150);
  });

  await t.test('deve parsear JSON estruturado em caso de erro 400/409', async () => {
    const mockErrorResponse = new Response(JSON.stringify({ error: 'DUPLICATE_CODIGO_REGISTRO', requires_confirmation: true }), {
      status: 409,
      headers: { 'Content-Type': 'application/json' },
    });

    const result = await safeResponseJson(mockErrorResponse);
    assert.equal(result.ok, false);
    assert.equal(result.status, 409);
    assert.equal(result.error, 'DUPLICATE_CODIGO_REGISTRO');
    assert.equal(result.requires_confirmation, true);
  });

  await t.test('deve lidar com corpo vazio sem estourar exceção', async () => {
    const mockEmptyResponse = new Response(null, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });

    const result = await safeResponseJson(mockEmptyResponse);
    assert.equal(result.ok, true);
    assert.equal(result.status, 200);
  });
});
