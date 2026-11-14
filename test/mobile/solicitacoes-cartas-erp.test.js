import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('Integração de Solicitações de Cartas: App de Membros <-> ERP', () => {
  const solicitacoesPagePath = path.resolve('src/app/app/solicitacoes/page.tsx');
  const apiSolicitacoesPath = path.resolve('src/app/api/v1/mobile/documentos/solicitacoes/route.ts');
  const inicioPagePath = path.resolve('src/app/app/inicio/page.tsx');

  test('1. Card Solicitações está presente na Dashboard do App substituindo Falar com o Pastor', () => {
    assert.ok(fs.existsSync(inicioPagePath), 'inicio/page.tsx deve existir');
    const content = fs.readFileSync(inicioPagePath, 'utf8');

    assert.ok(content.includes("handleCardClick('solicitacoes', '/app/solicitacoes')"), 'Deve apontar para /app/solicitacoes');
    assert.ok(content.includes('>Solicitações<') || content.includes('Solicitações\r\n') || content.includes('Solicitações\n'), 'Deve exibir o rótulo Solicitações');
    assert.ok(!content.includes("handleCardClick('pastor'"), 'Não deve mais conter clique em pastor no card 6');
  });

  test('2. Página /app/solicitacoes utiliza exatamente os 4 tipos de cartas oficiais do ERP', () => {
    assert.ok(fs.existsSync(solicitacoesPagePath), 'app/solicitacoes/page.tsx deve existir');
    const content = fs.readFileSync(solicitacoesPagePath, 'utf8');

    assert.ok(content.includes('recomendacao'), 'Deve conter recomendacao');
    assert.ok(content.includes('transito'), 'Deve conter transito');
    assert.ok(content.includes('mudanca'), 'Deve conter mudanca');
    assert.ok(content.includes('desligamento'), 'Deve conter desligamento');

    assert.ok(content.includes('Carta de Recomendação'), 'Deve exibir label oficial Recomendação');
    assert.ok(content.includes('Carta de Trânsito'), 'Deve exibir label oficial Trânsito');
    assert.ok(content.includes('Carta de Mudança'), 'Deve exibir label oficial Mudança');
    assert.ok(content.includes('Carta de Desligamento'), 'Deve exibir label oficial Desligamento');
  });

  test('3. API deriva os dados institucionais no servidor e previne duplicidade', () => {
    assert.ok(fs.existsSync(apiSolicitacoesPath), 'api/v1/mobile/documentos/solicitacoes/route.ts deve existir');
    const content = fs.readFileSync(apiSolicitacoesPath, 'utf8');

    // Validação de auth
    assert.ok(content.includes('resolveMobileMember(request)'), 'Deve resolver o membro autenticado');
    assert.ok(content.includes("eq('status', 'pendente')"), 'Deve checar duplicidade de pedidos pendentes');
    assert.ok(content.includes('status: 409'), 'Deve retornar HTTP 409 em caso de duplicidade');

    // Não confia em IDs enviados pelo cliente
    assert.ok(content.includes('member_id: ctx.memberId'), 'Deve usar ctx.memberId');
    assert.ok(content.includes('ministry_id: ctx.ministryId'), 'Deve usar ctx.ministryId');
    assert.ok(content.includes('solicitante_id: ctx.userId'), 'Deve usar ctx.userId');
    assert.ok(content.includes("status: 'pendente'"), 'Novos pedidos são criados como pendente');
  });

  test('4. Preservação de autorização presidencial e isolamento de banco', () => {
    const content = fs.readFileSync(solicitacoesPagePath, 'utf8');
    assert.ok(content.includes('exigePresidencia'), 'Deve indicar visualmente quando exige Presidência');
    assert.ok(content.includes('Presidência'), 'Deve citar a Presidência nos tipos institucionais');
  });
});
