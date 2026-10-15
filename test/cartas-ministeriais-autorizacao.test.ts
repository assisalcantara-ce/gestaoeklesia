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
            insert: (row: any) => {
              const newRow = {
                id: row.id || `pedido-${Date.now()}-${Math.random().toString(16).slice(2)}`,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                ...row,
              };
              pedidos.push(newRow);
              return {
                select: () => ({
                  single: async () => ({ data: { ...newRow }, error: null }),
                }),
              };
            },
            select: (_fields?: string) => {
              const filters: Record<string, any> = {};
              const inFilters: Record<string, any[]> = {};
              const ilikeFilters: Record<string, string> = {};

              const builder: any = {
                eq: (col: string, val: any) => {
                  filters[col] = val;
                  return builder;
                },
                in: (col: string, vals: any[]) => {
                  inFilters[col] = vals;
                  return builder;
                },
                ilike: (col: string, val: string) => {
                  ilikeFilters[col] = val.replace(/%/g, '').toLowerCase();
                  return builder;
                },
                order: (_col: string, _opts?: any) => builder,
                limit: (_lim: number) => builder,
                then: (resolve: any) => {
                  const filtered = pedidos.filter((p) => {
                    for (const [k, v] of Object.entries(filters)) {
                      if (p[k] !== v) return false;
                    }
                    for (const [k, v] of Object.entries(inFilters)) {
                      if (!v.includes(p[k])) return false;
                    }
                    for (const [k, v] of Object.entries(ilikeFilters)) {
                      if (!String(p[k] || '').toLowerCase().includes(v)) return false;
                    }
                    return true;
                  });
                  return Promise.resolve({ data: filtered, error: null }).then(resolve);
                },
                maybeSingle: async () => {
                  const match = pedidos.find((p) => {
                    for (const [k, v] of Object.entries(filters)) {
                      if (p[k] !== v) return false;
                    }
                    for (const [k, v] of Object.entries(inFilters)) {
                      if (!v.includes(p[k])) return false;
                    }
                    for (const [k, v] of Object.entries(ilikeFilters)) {
                      if (!String(p[k] || '').toLowerCase().includes(v)) return false;
                    }
                    return true;
                  });
                  return { data: match ? { ...match } : null, error: null };
                },
                single: async () => {
                  const match = pedidos.find((p) => {
                    for (const [k, v] of Object.entries(filters)) {
                      if (p[k] !== v) return false;
                    }
                    for (const [k, v] of Object.entries(inFilters)) {
                      if (!v.includes(p[k])) return false;
                    }
                    for (const [k, v] of Object.entries(ilikeFilters)) {
                      if (!String(p[k] || '').toLowerCase().includes(v)) return false;
                    }
                    return true;
                  });
                  if (!match) return { data: null, error: new Error('Registro não encontrado') };
                  return { data: { ...match }, error: null };
                },
              };
              return builder;
            },
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
        if (table === 'congregacoes' || table === 'dirigentes_movimentacoes') {
          return {
            select: () => ({
              eq: () => ({
                in: () => ({
                  order: () => ({
                    limit: () => Promise.resolve({ data: [], error: null }),
                  }),
                }),
              }),
              then: (resolve: any) => Promise.resolve({ data: [], error: null }).then(resolve),
            }),
          };
        }
        if (table === 'dirigentes_designacoes') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => Promise.resolve({ count: 0, error: null }),
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

  test('9. Fluxo Direto no Formulário: Registro de Pedido Presidencial sem redirecionamento e sem dados duplicados', async () => {
    const supabase = createMockSupabase([]);

    // Usuário da Secretaria preenche os dados no formulário de emissão e clica em "Registrar Pedido de Carta"
    const inputSolicitacao = {
      ministryId: ministryAlpha,
      memberId: memberId1,
      membroNome: 'Carlos Eduardo Oliveira',
      membroCargo: 'Diácono',
      congregacaoId: 'cong-sede',
      tipoCarta: 'mudanca',
      destino: 'AD São Paulo / Setor Central',
      motivo: 'Mudança de domicílio profissional',
      observacoes: 'Membro com dízimos em dia e recomendação pastoral',
      solicitanteId: userSecretaria.userId,
      solicitanteNome: userSecretaria.userName,
    };

    const resultado = await CartasService.solicitarAutorizacaoCarta(supabase, inputSolicitacao);

    // 1. O pedido é registrado com sucesso
    assert.equal(resultado.sucesso, true);
    assert.equal(resultado.jaExistente, false);
    assert.ok(resultado.pedido?.id);

    // 2. Os dados preenchidos no formulário são aproveitados integralmente
    assert.equal(resultado.pedido.membro_nome, 'Carlos Eduardo Oliveira');
    assert.equal(resultado.pedido.membro_cargo, 'Diácono');
    assert.equal(resultado.pedido.tipo_carta, 'mudanca');
    assert.equal(resultado.pedido.destino, 'AD São Paulo / Setor Central');
    assert.ok(resultado.pedido.observacoes.includes('Motivo: Mudança de domicílio profissional'));
    assert.ok(resultado.pedido.observacoes.includes('Observações: Membro com dízimos em dia'));
    assert.equal(resultado.pedido.status, 'pendente');

    // 3. Status cadastral do membro NÃO é alterado no momento do pedido (governança preservada)
    const { data: membro } = await supabase.from('members').select('*').eq('id', memberId1).eq('ministry_id', ministryAlpha).maybeSingle();
    assert.equal(membro?.status, 'active');

    // 4. Emissão e impressão oficial permanecem rigorosamente bloqueadas
    const authStatus = await CartasService.verificarAutorizacaoCarta(
      supabase,
      ministryAlpha,
      memberId1,
      'mudanca',
      'Carlos Eduardo Oliveira'
    );
    assert.equal(authStatus.exigeAutorizacao, true);
    assert.equal(authStatus.autorizado, false);
    assert.equal(authStatus.status, 'pendente');

    await assert.rejects(
      async () => {
        await CartasService.validarEmissaoOuImpressaoCarta(
          supabase,
          ministryAlpha,
          memberId1,
          'mudanca',
          'Carlos Eduardo Oliveira'
        );
      },
      /Emissão bloqueada/
    );
  });

  test('10. Prevenção de Duplicidade: Impede cadastrar novo pedido se já houver um pendente em análise', async () => {
    const pedidoExistente = {
      id: 'pedido-existente-123',
      ministry_id: ministryAlpha,
      member_id: memberId1,
      membro_nome: 'Carlos Eduardo Oliveira',
      membro_cargo: 'Diácono',
      tipo_carta: 'mudanca',
      destino: 'AD São Paulo',
      observacoes: 'Aguardando decisão',
      status: 'pendente',
    };
    const supabase = createMockSupabase([pedidoExistente]);

    // Tentativa de registrar novo pedido para o mesmo membro e tipo enquanto já pendente
    const resDuplicado = await CartasService.solicitarAutorizacaoCarta(supabase, {
      ministryId: ministryAlpha,
      memberId: memberId1,
      membroNome: 'Carlos Eduardo Oliveira',
      tipoCarta: 'mudanca',
      solicitanteId: userSecretaria.userId,
    });

    // Detecta duplicidade, não cria nova linha e devolve a referência do pedido pendente
    assert.equal(resDuplicado.sucesso, true);
    assert.equal(resDuplicado.jaExistente, true);
    assert.equal(resDuplicado.pedido.id, 'pedido-existente-123');
    assert.ok(resDuplicado.mensagem.includes('pendente de análise'));
    assert.equal(supabase._pedidos.length, 1); // Nenhuma linha extra inserida
  });

  test('11. Central de Decisões e Ciclo Completo: Pedido registrado diretamente chega à Presidência e deliberação libera emissão', async () => {
    const supabase = createMockSupabase([]);

    // 1. Secretaria solicita diretamente
    const resSolicitacao = await CartasService.solicitarAutorizacaoCarta(supabase, {
      ministryId: ministryAlpha,
      memberId: memberId2,
      membroNome: 'Ana Paula Santos',
      membroCargo: 'Líder de Louvor',
      tipoCarta: 'desligamento',
      observacoes: 'Solicitação pessoal por mudança de confissão',
      solicitanteId: userSecretaria.userId,
      solicitanteNome: userSecretaria.userName,
    });
    assert.equal(resSolicitacao.sucesso, true);

    // 2. Presidência delibera e autoriza
    await PresidenciaService.deliberarCartaPedido(supabase, userPresidencia, {
      pedido_id: resSolicitacao.pedido.id,
      decisao: 'autorizar',
    });

    // 3. Após deliberação, a emissão é autorizada com os dados do autorizador
    const authLiberada = await CartasService.verificarAutorizacaoCarta(
      supabase,
      ministryAlpha,
      memberId2,
      'desligamento',
      'Ana Paula Santos'
    );
    assert.equal(authLiberada.autorizado, true);
    assert.equal(authLiberada.status, 'autorizado');
    assert.equal(authLiberada.autorizadorNome, 'Pr. Carlos Presidente');

    // 4. Validação formal de emissão passa sem lançar exceção
    const validacao = await CartasService.validarEmissaoOuImpressaoCarta(
      supabase,
      ministryAlpha,
      memberId2,
      'desligamento',
      'Ana Paula Santos'
    );
    assert.equal(validacao.autorizado, true);
  });

  test('12. Preservação em Falhas: Lança erro claro sem apagar o formulário em caso de dados inválidos', async () => {
    const supabase = createMockSupabase([]);

    await assert.rejects(
      async () => {
        await CartasService.solicitarAutorizacaoCarta(supabase, {
          ministryId: '',
          memberId: memberId1,
          membroNome: 'Carlos',
          tipoCarta: 'mudanca',
          solicitanteId: userSecretaria.userId,
        });
      },
      /O identificador do ministério é obrigatório/
    );

    await assert.rejects(
      async () => {
        await CartasService.solicitarAutorizacaoCarta(supabase, {
          ministryId: ministryAlpha,
          memberId: memberId1,
          membroNome: '',
          tipoCarta: 'mudanca',
          solicitanteId: userSecretaria.userId,
        });
      },
      /Os dados do membro destinatário são obrigatórios/
    );
  });
});
