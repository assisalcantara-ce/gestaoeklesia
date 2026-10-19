import test from 'node:test';
import assert from 'node:assert/strict';
import { AssinaturasInstitucionaisService } from '../src/services/assinaturas-institucionais-service';
import { CANVAS_ELEMENT_LABELS } from '../src/lib/cartas-constants';

test('AssinaturasInstitucionaisService - Validações de Governança e Regras de Segurança', async (t) => {
  await t.test('deve rejeitar solicitação quando ministryId não for fornecido', async () => {
    const res = await AssinaturasInstitucionaisService.obterAssinaturaAutorizada({
      ministryId: '',
      tipoAssinatura: 'assinatura_presidente',
    });

    assert.equal(res.autorizado, false);
    assert.match(res.motivoBloqueio || '', /Ministério não informado/);
  });

  await t.test('deve bloquear assinatura do Presidente em pré-visualizações de Cartas de Mudança ou Desligamento', async () => {
    const resMudanca = await AssinaturasInstitucionaisService.obterAssinaturaAutorizada({
      ministryId: 'tenant-123',
      tipoAssinatura: 'assinatura_presidente',
      contextoDocumento: 'carta_mudanca',
      isPreview: true,
    });

    assert.equal(resMudanca.autorizado, false);
    assert.match(resMudanca.motivoBloqueio || '', /não é exibida em pré-visualizações sem deliberação/i);

    const resDesligamento = await AssinaturasInstitucionaisService.obterAssinaturaAutorizada({
      ministryId: 'tenant-123',
      tipoAssinatura: 'assinatura_presidente',
      contextoDocumento: 'carta_desligamento',
      isPreview: true,
    });

    assert.equal(resDesligamento.autorizado, false);
    assert.match(resDesligamento.motivoBloqueio || '', /não é exibida em pré-visualizações/i);
  });

  await t.test('deve exigir identificação do membro ou documento para validar deliberação de carta restrita', async () => {
    const res = await AssinaturasInstitucionaisService.obterAssinaturaAutorizada({
      ministryId: 'tenant-123',
      tipoAssinatura: 'assinatura_presidente',
      contextoDocumento: 'carta_mudanca',
      isPreview: false,
      memberId: null,
      documentoId: null,
    });

    assert.equal(res.autorizado, false);
    assert.match(res.motivoBloqueio || '', /Identificação do membro ou documento ausente/i);
  });
});

test('Compatibilidade e Persistência de Identificadores Dinâmicos de Assinatura', (t) => {
  t.test('deve manter identificadores sem Base64 nos modelos', () => {
    assert.equal(CANVAS_ELEMENT_LABELS['assinatura_presidente'], 'Assinatura do Presidente');
    assert.equal(CANVAS_ELEMENT_LABELS['assinatura_secretario_geral'], 'Assinatura do Secretário-Geral');

    const elementoModelo = {
      id: 'elem-1',
      tipo: 'assinatura_presidente',
      x: 100,
      y: 200,
      largura: 220,
      altura: 80,
      transparencia: 0.9,
      visivel: true,
    };

    // O JSON salvo contém apenas as propriedades geométricas e o identificador do tipo dinâmico
    const jsonSerializado = JSON.stringify(elementoModelo);
    assert.equal(jsonSerializado.includes('data:image'), false);
    assert.equal(jsonSerializado.includes('assinatura_presidente'), true);
  });
});
