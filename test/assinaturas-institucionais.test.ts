import test from 'node:test';
import assert from 'node:assert/strict';
import { AssinaturasInstitucionaisService } from '../src/services/assinaturas-institucionais-service';

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
