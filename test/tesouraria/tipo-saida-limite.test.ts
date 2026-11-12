import test from 'node:test';
import assert from 'node:assert/strict';
import { TesourariaService } from '../../src/services/TesourariaService';

test('Módulo Tesouraria - Validação de Limites de Tipo/Categoria de Saída (varchar 30)', async (t) => {
  const fakeRepo = {
    criarLancamento: async (payload: any) => ({ id: 'lanc-uuid-1', ...payload }),
    verificarCodigoExiste: async () => false,
    alocarProximoCodigoRegistro: async () => 'REG-2026-000001',
    obterLancamentoPorId: async () => null,
  };

  const service = new TesourariaService(null, fakeRepo as any);
  const ministryId = '00000000-0000-0000-0000-000000000001';

  await t.test('1. Permite criar saída com categoria válida de até 30 caracteres', async () => {
    const lancamento = await service.criarLancamento(ministryId, {
      data_lancamento: '2026-11-12',
      tipo_movimento: 'saida',
      tipo_recebimento: '2.2', // Código curto da categoria
      valor: 150.0,
      referencia: 'Conta de Energia',
    });

    assert.equal(lancamento.tipo_movimento, 'saida');
    assert.equal(lancamento.tipo_recebimento, '2.2');
    assert.equal(lancamento.valor, 150.0);
  });

  await t.test('2. Permite criar saída com tipo_recebimento textual de exatamente 30 caracteres', async () => {
    const tipo30Chars = 'a'.repeat(30);
    const lancamento = await service.criarLancamento(ministryId, {
      data_lancamento: '2026-11-12',
      tipo_movimento: 'saida',
      tipo_recebimento: tipo30Chars,
      valor: 200.0,
    });

    assert.equal(lancamento.tipo_recebimento, tipo30Chars);
  });

  await t.test('3. Bloqueia com erro claro e amigável tentativa de salvar saída cujo tipo_recebimento exceda 30 caracteres', async () => {
    const tipo31Chars = 'Categoria Extensa Demais Excede'; // 31 caracteres
    assert.equal(tipo31Chars.length, 31);

    await assert.rejects(
      async () => {
        await service.criarLancamento(ministryId, {
          data_lancamento: '2026-11-12',
          tipo_movimento: 'saida',
          tipo_recebimento: tipo31Chars,
          valor: 50.0,
        });
      },
      (err: any) => {
        assert.match(err.message, /tipo_recebimento não pode exceder 30 caracteres/);
        return true;
      }
    );
  });

  await t.test('4. Bloqueia reclassificação / atualização com tipo_recebimento > 30 caracteres', async () => {
    const tipoLongo = 'Esta Categoria Possui Mais de 30 Caracteres e Falharia';

    await assert.rejects(
      async () => {
        await service.atualizarLancamento('lanc-uuid-1', ministryId, {
          tipo_recebimento: tipoLongo,
        });
      },
      (err: any) => {
        assert.match(err.message, /tipo_recebimento não pode exceder 30 caracteres/);
        return true;
      }
    );
  });
});
