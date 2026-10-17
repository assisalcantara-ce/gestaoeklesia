import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();

test('Tesouraria - Validação Mensal e Congregação do Código/ID de Registro', async (t) => {
  await t.test('1. TesourariaRepository filtra duplicidade considerando tenant, congregação e intervalo de datas do mês/ano', () => {
    const repoContent = fs.readFileSync(path.join(projectRoot, 'src/repositories/TesourariaRepository.ts'), 'utf-8');

    assert.match(repoContent, /export interface VerificarCodigoOptions/);
    assert.match(repoContent, /dataLancamento\?: string \| null/);
    assert.match(repoContent, /congregacaoId\?: string \| null/);
    assert.match(repoContent, /query\.gte\('data_lancamento',\s*inicioMes\)\.lte\('data_lancamento',\s*fimMes\)/);
    assert.match(repoContent, /query\.eq\('congregacao_id',\s*congregacaoId\.trim\(\)\)/);
    assert.match(repoContent, /query\.is\('congregacao_id',\s*null\)/);
  });

  await t.test('2. TesourariaService repassa data_lancamento e congregacao_id na criação e edição de lançamentos', () => {
    const serviceContent = fs.readFileSync(path.join(projectRoot, 'src/services/TesourariaService.ts'), 'utf-8');

    assert.match(serviceContent, /dataLancamento:\s*dto\.data_lancamento/);
    assert.match(serviceContent, /congregacaoId:\s*dto\.congregacao_id/);
    assert.match(serviceContent, /dataLancamento:\s*dataRef/);
    assert.match(serviceContent, /congregacaoId:\s*congRef/);
  });

  await t.test('3. API /api/v1/tesouraria/lancamentos suporta parâmetros de mês/ano e congregação na ação verificar_codigo', () => {
    const routeContent = fs.readFileSync(path.join(projectRoot, 'src/app/api/v1/tesouraria/lancamentos/route.ts'), 'utf-8');

    assert.match(routeContent, /searchParams\.get\('data'\)/);
    assert.match(routeContent, /searchParams\.get\('congregacao_id'\)/);
    assert.match(routeContent, /DUPLICATE_CODIGO_REGISTRO/);
    assert.match(routeContent, /no mesmo mês e ano/);
  });

  await t.test('4. Modal ConfirmDuplicidadeCodigoModal exibe mensagem com escopo mensal e botões esperados', () => {
    const modalContent = fs.readFileSync(
      path.join(projectRoot, 'src/components/tesouraria/modals/ConfirmDuplicidadeCodigoModal.tsx'),
      'utf-8'
    );

    assert.match(modalContent, /Código \/ ID de Registro Já Utilizado/);
    assert.match(modalContent, /Cancelar e Alterar Código/);
    assert.match(modalContent, /Adicionar Mesmo Assim/);
    assert.match(modalContent, /no mesmo mês e ano/);
  });

  await t.test('5. Frontend useTesouraria implementa a mesma regra de duplicidade (mesmo código, mesma congregação, mesmo mês/ano)', () => {
    const hookContent = fs.readFileSync(path.join(projectRoot, 'src/hooks/tesouraria/useTesouraria.ts'), 'utf-8');

    assert.match(hookContent, /lAno === anoForm && lMes === mesForm/);
    assert.match(hookContent, /lCongId !== formCongId/);
    assert.match(hookContent, /setConfirmDuplicidadeCodigo/);
  });
});
