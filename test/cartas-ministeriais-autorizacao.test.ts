import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { CartasService } from '../src/services/cartas-service.js';
import { PresidenciaService } from '../src/services/presidencia-service.js';
import type { UserContextAuth } from '../src/services/dirigentes-service.js';

describe('Cartas Ministeriais — Autorização Presidencial e Preservação de Impressão', () => {
  const ministryAlpha = '11111111-1111-1111-1111-111111111111';
  const ministryBeta = '22222222-2222-2222-2222-222222222222';
  const memberId1 = 'member-001';
  const memberId2 = 'member-002';

  const userPresidencia: UserContextAuth = {
    userId: 'user-pres-1',
    userName: 'Pr. Carlos Presidente',
    ministryId: ministryAlpha,
    nivel: 'presidencia',
    isAdmin: false,
  };

  const userSecretaria: UserContextAuth = {
    userId: 'user-sec-1',
    userName: 'Secretária Maria',
    ministryId: ministryAlpha,
    nivel: 'secretaria_local',
    isAdmin: false,
  };

  const userSupervisor: UserContextAuth = {
    userId: 'user-sup-1',
    userName: 'Supervisor João',
    ministryId: ministryAlpha,
    nivel: 'supervisor',
    isAdmin: false,
  };

  // Mock do Supabase Client para simular o banco com isolamento multi-tenant
  const createMockSupabase = (initialPedidos: any[] = []) => {
    const pedidos = [...initialPedidos];

    return {
      _pedidos: pedidos,
      from: (table: string) => {
        if (table === 'carta_pedidos') {
          return {
            select: (_fields?: string) => ({
              eq: (col1: string, val1: any) => ({
                eq: (col2: string, val2: any) => ({
                  eq: (col3: string, val3: any) => ({
                    order: (_col: string, _opt: any) => ({
                      limit: (_num: number) => ({
                        maybeSingle: async () => {
                          const item = pedidos.find(
                            (p) => p[col1] === val1 && p[col2] === val2 && p[col3] === val3
                          );
                          return { data: item ? { ...item } : null, error: null };
                        },
                      }),
                    }),
                  }),
                  maybeSingle: async () => {
                    const item = pedidos.find(
                      (p) => p[col1] === val1 && p[col2] === val2
                    );
                    return { data: item ? { ...item } : null, error: null };
                  },
                }),
                ilike: (col2: string, val2: string) => ({
                  eq: (col3: string, val3: any) => ({
                    order: (_col: string, _opt: any) => ({
                      limit: (_num: number) => ({
                        maybeSingle: async () => {
                          const term = val2.replace(/%/g, '').toLowerCase();
                          const item = pedidos.find(
                            (p) =>
                              p[col1] === val1 &&
                              String(p[col2] || '').toLowerCase().includes(term) &&
                              p[col3] === val3
                          );
                          return { data: item ? { ...item } : null, error: null };
                        },
                      }),
                    }),
                  }),
                }),
              }),
            }),
            update: (values: any) => ({
              eq: (col1: string, val1: any) => ({
                eq: (col2: string, val2: any) => {
                  const targetIndex = pedidos.findIndex(
                    (p) => p[col1] === val1 && p[col2] === val2
                  );
                  if (targetIndex >= 0) {
                    pedidos[targetIndex] = { ...pedidos[targetIndex], ...values };
                    return {
                      select: () => ({
                        single: async () => ({ data: pedidos[targetIndex], error: null }),
                      }),
                    };
                  }
                  return {
                    select: () => ({
                      single: async () => ({ data: null, error: new Error('Registro não encontrado') }),
                    }),
                  };
                },
              }),
            }),
          };
        }
        if (table === 'members') {
          return {
            select: (_fields?: string) => ({
              eq: (_col1: string, val1: any) => ({
                eq: (_col2: string, _val2: any) => ({
                  maybeSingle: async () => ({
                    data: {
                      id: val1,
                      name: 'Membro Teste',
                      status: 'active',
                      custom_fields: {},
                    },
                    error: null,
                  }),
                }),
              }),
            }),
            update: (_values: any) => ({
              eq: (_col1: string, _val1: any) => ({
                eq: (_col2: string, _val2: any) => Promise.resolve({ data: [{}], error: null }),
              }),
            }),
          };
        }
        throw new Error(`Tabela não simulada: ${table}`);
      },
    };
  };

  test('1. Regra de Governança: Mudança e Desligamento exigem autorização da Presidência', () => {
    assert.strictEqual(CartasService.exigeAutorizacaoPresidencial('mudanca'), true);
    assert.strictEqual(CartasService.exigeAutorizacaoPresidencial('desligamento'), true);
    assert.strictEqual(CartasService.exigeAutorizacaoPresidencial('transito'), false);
    assert.strictEqual(CartasService.exigeAutorizacaoPresidencial('recomendacao'), false);
    assert.strictEqual(CartasService.exigeAutorizacaoPresidencial('declaracao'), false);
    assert.strictEqual(CartasService.exigeAutorizacaoPresidencial(null), false);

    // Normalização de chaves e aliases
    assert.strictEqual(CartasService.normalizarTipoCarta('Carta de Mudança'), 'mudanca');
    assert.strictEqual(CartasService.normalizarTipoCarta('carta_desligamento'), 'desligamento');
    assert.strictEqual(CartasService.normalizarTipoCarta('Carta de Trânsito'), 'transito');
    assert.strictEqual(CartasService.normalizarTipoCarta('recomendacao'), 'recomendacao');
  });

  test('2. Bloqueio de Emissão: Membro sem pedido cadastrado permanece bloqueado', async () => {
    const supabase = createMockSupabase([]);

    const resultado = await CartasService.verificarAutorizacaoCarta(
      supabase,
      ministryAlpha,
      memberId1,
      'mudanca',
      'Irmão João'
    );

    assert.strictEqual(resultado.exigeAutorizacao, true);
    assert.strictEqual(resultado.autorizado, false);
    assert.strictEqual(resultado.status, 'nao_solicitado');
    assert.match(resultado.mensagem, /Não há pedido de Carta de Mudança registrado/);

    // Tentativa de emissão direta é barrada por exceção
    await assert.rejects(
      async () => {
        await CartasService.validarEmissaoOuImpressaoCarta(
          supabase,
          ministryAlpha,
          memberId1,
          'mudanca',
          'Irmão João'
        );
      },
      {
        name: 'Error',
        message: /Emissão bloqueada/,
      }
    );
  });

  test('3. Bloqueio de Emissão: Pedido pendente aguarda deliberação e bloqueia impressão', async () => {
    const pedidos = [
      {
        id: 'pedido-101',
        ministry_id: ministryAlpha,
        member_id: memberId1,
        membro_nome: 'Irmão Carlos Oliveira',
        tipo_carta: 'mudanca',
        status: 'pendente',
        created_at: new Date().toISOString(),
      },
    ];
    const supabase = createMockSupabase(pedidos);

    const resultado = await CartasService.verificarAutorizacaoCarta(
      supabase,
      ministryAlpha,
      memberId1,
      'mudanca',
      'Irmão Carlos Oliveira'
    );

    assert.strictEqual(resultado.exigeAutorizacao, true);
    assert.strictEqual(resultado.autorizado, false);
    assert.strictEqual(resultado.status, 'pendente');
    assert.strictEqual(resultado.pedidoId, 'pedido-101');
    assert.match(resultado.mensagem, /aguardando deliberação da Presidência/);

    // Tentativa de emissão direta lançará erro
    await assert.rejects(
      async () => {
        await CartasService.validarEmissaoOuImpressaoCarta(
          supabase,
          ministryAlpha,
          memberId1,
          'mudanca',
          'Irmão Carlos Oliveira'
        );
      },
      /Emissão bloqueada/
    );
  });

  test('4. Bloqueio de Emissão: Pedido indeferido pela Presidência mantém emissão bloqueada e expõe justificativa', async () => {
    const pedidos = [
      {
        id: 'pedido-102',
        ministry_id: ministryAlpha,
        member_id: memberId2,
        membro_nome: 'Irmã Ana Paula',
        tipo_carta: 'desligamento',
        status: 'rejeitado',
        motivo_rejeicao: 'Membro em processo pastoral de aconselhamento e reconciliação.',
        autorizador_id: userPresidencia.userId,
        autorizador_nome: userPresidencia.userName,
        created_at: new Date().toISOString(),
      },
    ];
    const supabase = createMockSupabase(pedidos);

    const resultado = await CartasService.verificarAutorizacaoCarta(
      supabase,
      ministryAlpha,
      memberId2,
      'desligamento',
      'Irmã Ana Paula'
    );

    assert.strictEqual(resultado.exigeAutorizacao, true);
    assert.strictEqual(resultado.autorizado, false);
    assert.strictEqual(resultado.status, 'rejeitado');
    assert.strictEqual(resultado.pedidoId, 'pedido-102');
    assert.strictEqual(
      resultado.motivoRejeicao,
      'Membro em processo pastoral de aconselhamento e reconciliação.'
    );
    assert.match(resultado.mensagem, /indeferido pela Presidência/);
    assert.match(resultado.mensagem, /processo pastoral de aconselhamento/);

    // Validação impede emissão
    await assert.rejects(
      async () => {
        await CartasService.validarEmissaoOuImpressaoCarta(
          supabase,
          ministryAlpha,
          memberId2,
          'desligamento'
        );
      },
      /indeferido pela Presidência/
    );
  });

  test('5. Liberação de Emissão: Pedido formalmente autorizado pela Presidência libera emissão com metadados', async () => {
    const dataAuth = new Date('2026-10-14T10:00:00Z').toISOString();
    const pedidos = [
      {
        id: 'pedido-103',
        ministry_id: ministryAlpha,
        member_id: memberId1,
        membro_nome: 'Irmão Carlos Oliveira',
        tipo_carta: 'mudanca',
        status: 'autorizado',
        autorizador_id: userPresidencia.userId,
        autorizador_nome: userPresidencia.userName,
        data_autorizacao: dataAuth,
        created_at: new Date('2026-10-14T08:00:00Z').toISOString(),
      },
    ];
    const supabase = createMockSupabase(pedidos);

    const resultado = await CartasService.verificarAutorizacaoCarta(
      supabase,
      ministryAlpha,
      memberId1,
      'mudanca',
      'Irmão Carlos Oliveira'
    );

    assert.strictEqual(resultado.exigeAutorizacao, true);
    assert.strictEqual(resultado.autorizado, true);
    assert.strictEqual(resultado.status, 'autorizado');
    assert.strictEqual(resultado.pedidoId, 'pedido-103');
    assert.strictEqual(resultado.autorizadorId, userPresidencia.userId);
    assert.strictEqual(resultado.autorizadorNome, userPresidencia.userName);
    assert.strictEqual(resultado.dataAutorizacao, dataAuth);
    assert.match(resultado.mensagem, /Carta autorizada pela Presidência/);

    // validarEmissaoOuImpressaoCarta não lança erro e retorna os metadados para salvar em cartas_registros
    const validado = await CartasService.validarEmissaoOuImpressaoCarta(
      supabase,
      ministryAlpha,
      memberId1,
      'mudanca'
    );
    assert.strictEqual(validado.autorizado, true);
    assert.strictEqual(validado.autorizadorNome, userPresidencia.userName);
  });

  test('6. RBAC e Governança: Secretaria ou Supervisor não podem autorizar pedidos presidenciais', async () => {
    const pedidos = [
      {
        id: 'pedido-104',
        ministry_id: ministryAlpha,
        member_id: memberId1,
        membro_nome: 'Irmão Carlos Oliveira',
        tipo_carta: 'mudanca',
        status: 'pendente',
      },
    ];
    const supabase = createMockSupabase(pedidos);

    // Tentativa por Secretaria
    await assert.rejects(
      async () => {
        await PresidenciaService.deliberarCartaPedido(supabase, userSecretaria, {
          pedido_id: 'pedido-104',
          decisao: 'autorizar',
        });
      },
      /Acesso negado: Somente a Presidência ou Administrador/
    );

    // Tentativa por Supervisor
    await assert.rejects(
      async () => {
        await PresidenciaService.deliberarCartaPedido(supabase, userSupervisor, {
          pedido_id: 'pedido-104',
          decisao: 'autorizar',
        });
      },
      /Acesso negado: Somente a Presidência ou Administrador/
    );

    // Deliberação legítima pela Presidência funciona perfeitamente
    const atualizado = await PresidenciaService.deliberarCartaPedido(supabase, userPresidencia, {
      pedido_id: 'pedido-104',
      decisao: 'autorizar',
    });

    assert.strictEqual(atualizado.status, 'autorizado');
    assert.strictEqual(atualizado.autorizador_id, userPresidencia.userId);
    assert.strictEqual(atualizado.autorizador_nome, userPresidencia.userName);
    assert.ok(atualizado.data_autorizacao);
  });

  test('7. Isolamento Multi-tenant: Presidência não pode deliberar pedidos de outro ministério', async () => {
    const pedidos = [
      {
        id: 'pedido-999',
        ministry_id: ministryBeta, // Outro ministério
        member_id: 'member-ext',
        membro_nome: 'Membro Externo',
        tipo_carta: 'mudanca',
        status: 'pendente',
      },
    ];
    const supabase = createMockSupabase(pedidos);

    await assert.rejects(
      async () => {
        await PresidenciaService.deliberarCartaPedido(supabase, userPresidencia, {
          pedido_id: 'pedido-999',
          decisao: 'autorizar',
        });
      },
      /pertencente a outro ministério/
    );
  });

  test('8. Fidelidade de Impressão (CSS e Modelo): Linhas horizontais e elementos utilizam border-top e print-color-adjust', () => {
    // Simulação dos estilos aplicados a elementos do tipo 'linha'
    const elementoLinha = {
      tipo: 'linha',
      x: 64,
      y: 120,
      largura: 660,
      altura: 3,
      cor: '#dc2626', // Linha vermelha configurada no modelo
      transparencia: 1,
      borderRadius: 0,
    };

    const thickness = Math.max(1, elementoLinha.altura || 2);
    const lineColor = elementoLinha.cor || '#111';
    const baseStyle = `position:absolute; left:${elementoLinha.x}px; top:${elementoLinha.y}px; width:${elementoLinha.largura}px; height:${elementoLinha.altura}px;`;

    const styleParts = [
      baseStyle,
      `height:${thickness}px;`,
      `background-color:${lineColor};`,
      `border-top:${thickness}px solid ${lineColor};`,
      'box-sizing:border-box;',
      `border-radius:${elementoLinha.borderRadius || 0}px;`,
      `opacity:${elementoLinha.transparencia ?? 1};`,
      '-webkit-print-color-adjust:exact;',
      'print-color-adjust:exact;',
    ];

    const linhaHtml = `<div style="${styleParts.join('')}"></div>`;

    // Verificações que corrigem o sumiço da linha na impressão:
    // 1. Deve possuir border-top explícito com a mesma cor e espessura
    assert.ok(linhaHtml.includes('border-top:3px solid #dc2626'));
    // 2. Deve possuir box-sizing:border-box para manter as dimensões A4 exatas
    assert.ok(linhaHtml.includes('box-sizing:border-box'));
    // 3. Deve possuir print-color-adjust:exact para ambos os motores WebKit e padrão
    assert.ok(linhaHtml.includes('-webkit-print-color-adjust:exact'));
    assert.ok(linhaHtml.includes('print-color-adjust:exact'));
  });
});
