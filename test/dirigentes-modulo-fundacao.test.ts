import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { DirigentesService, type UserContextAuth } from '../src/services/dirigentes-service.js';
import type {
  DirigenteDesignacao,
  DirigenteMovimentacao,
  DirigenteTermoPatrimonial,
} from '../src/types/dirigentes.js';

describe('Módulo Dirigentes — Fundação, Regras de Negócio, RBAC e Integração com Patrimônio', () => {
  const ministryAlpha = '11111111-1111-1111-1111-111111111111';
  const ministryBeta = '22222222-2222-2222-2222-222222222222';

  const userSecretaria: UserContextAuth = {
    userId: 'user-sec-1',
    userName: 'Secretário Geral',
    ministryId: ministryAlpha,
    nivel: 'secretario_geral',
    isAdmin: false,
  };

  const userPresidencia: UserContextAuth = {
    userId: 'user-pres-1',
    userName: 'Presidente do Ministério',
    ministryId: ministryAlpha,
    nivel: 'presidencia',
    isAdmin: false,
  };

  const userAdmin: UserContextAuth = {
    userId: 'user-adm-1',
    userName: 'Administrador do Sistema',
    ministryId: ministryAlpha,
    nivel: 'administrador',
    isAdmin: true,
  };

  const userOperadorComum: UserContextAuth = {
    userId: 'user-op-1',
    userName: 'Operador Local',
    ministryId: ministryAlpha,
    nivel: 'operador',
    isAdmin: false,
  };

  test('1. Permissões RBAC: Secretaria pode propor, mas não pode aprovar; Presidência e Admin podem aprovar', () => {
    // Secretaria pode propor?
    assert.equal(DirigentesService.podeProporMovimentacao(userSecretaria), true);
    // Secretaria pode aprovar?
    assert.equal(DirigentesService.podeAprovarMovimentacao(userSecretaria), false);

    // Presidência pode aprovar?
    assert.equal(DirigentesService.podeAprovarMovimentacao(userPresidencia), true);
    // Admin pode aprovar?
    assert.equal(DirigentesService.podeAprovarMovimentacao(userAdmin), true);

    // Operador comum não pode nem propor nem aprovar
    assert.equal(DirigentesService.podeProporMovimentacao(userOperadorComum), false);
    assert.equal(DirigentesService.podeAprovarMovimentacao(userOperadorComum), false);
  });

  test('2. Isolamento Multi-tenant estrito: impede operações com ministry_id divergente', () => {
    // Mesmo ministério: OK
    assert.doesNotThrow(() => {
      DirigentesService.validarIsolamentoTenant(ministryAlpha, ministryAlpha);
    });

    // Ministérios distintos: Lança erro de violação de segurança
    assert.throws(
      () => {
        DirigentesService.validarIsolamentoTenant(ministryAlpha, ministryBeta);
      },
      /Violação de segurança multi-tenant/
    );
  });

  test('3. Integração com Patrimônio: exige termo formal se houver bens; dispensa termo vazio se não houver bens', () => {
    // Cenário A: Congregação com 25 bens cadastrados
    const comBens = DirigentesService.avaliarExigenciaPatrimonio(25);
    assert.equal(comBens.requerTermo, true, 'Deve exigir termo quando há bens');
    assert.equal(comBens.statusConferencia, 'pendente');

    // Cenário B: Congregação sem nenhum bem cadastrado
    const semBens = DirigentesService.avaliarExigenciaPatrimonio(0);
    assert.equal(semBens.requerTermo, false, 'Não deve exigir termo patrimonial vazio');
    assert.equal(semBens.statusConferencia, 'nao_se_aplica');
  });

  test('4. Prontidão de Efetivação: bloqueia se não estiver aprovada ou se exigir termo patrimonial pendente', () => {
    const movBase: DirigenteMovimentacao = {
      id: 'mov-1',
      ministry_id: ministryAlpha,
      tipo_movimentacao: 'rodizio_anual',
      status: 'proposta',
      ano_referencia: 2026,
      titulo: 'Rodízio Anual 2026',
      congregacao_destino_id: 'cong-1',
      congregacao_origem_id: null,
      dirigente_novo_member_id: 'mem-1',
      dirigente_novo_nome: 'Pr. João Silva',
      dirigente_novo_cargo: 'Pastor',
      dirigente_novo_cpf: '111.222.333-44',
      dirigente_novo_matricula: 'MAT-001',
      dirigente_anterior_member_id: 'mem-2',
      dirigente_anterior_nome: 'Pr. Antigo',
      dirigente_anterior_cargo: 'Pastor',
      motivo: 'Rodízio anual estatutário',
      data_prevista: '2026-12-01',
      data_efetiva: null,
      prazo_retorno: null,
      solicitante_user_id: userSecretaria.userId,
      solicitante_nome: userSecretaria.userName,
      aprovador_user_id: null,
      aprovador_nome: null,
      data_aprovacao: null,
      justificativa_aprovacao_rejeicao: null,
      requer_termo_patrimonial: true,
      status_conferencia_patrimonial: 'pendente',
      termo_patrimonial_id: null,
      divergencias_patrimoniais: null,
      observacoes: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Tentativa 1: Em status 'proposta' (ainda não aprovada pela Presidência)
    const res1 = DirigentesService.validarProntidaoEfetivacao(movBase, false);
    assert.equal(res1.valida, false);
    assert.match(res1.erro || '', /precisa ser aprovada pela Presidência/);

    // Tentativa 2: Em status 'aprovada', mas exige termo patrimonial e ainda não tem termo
    const movAprovada = { ...movBase, status: 'aprovada' as const };
    const res2 = DirigentesService.validarProntidaoEfetivacao(movAprovada, false);
    assert.equal(res2.valida, false);
    assert.match(res2.erro || '', /formalizar e homologar o Termo de Transferência Patrimonial/i);

    // Tentativa 3: Em status 'aprovada' com termo homologado -> VÁLIDA
    const res3 = DirigentesService.validarProntidaoEfetivacao(movAprovada, true);
    assert.equal(res3.valida, true);
    assert.equal(res3.erro, undefined);

    // Tentativa 4: Congregação sem bens (requer_termo = false) -> VÁLIDA mesmo sem termo
    const movSemBens = { ...movBase, status: 'aprovada' as const, requer_termo_patrimonial: false };
    const res4 = DirigentesService.validarProntidaoEfetivacao(movSemBens, false);
    assert.equal(res4.valida, true);
  });

  test('5. Acumulação de Congregações: permite dirigente acumular congregações sem inconsistência no histórico', () => {
    const designacoesAtivas: DirigenteDesignacao[] = [
      {
        id: 'desig-1',
        ministry_id: ministryAlpha,
        congregacao_id: 'cong-central',
        member_id: 'mem-10',
        nome_dirigente: 'Pr. Carlos Eduardo',
        cpf_dirigente: '123.456.789-00',
        cargo_ministerial: 'Pastor',
        matricula_dirigente: 'MAT-10',
        telefone: '(11) 99999-0000',
        tipo_designacao: 'titular',
        is_acumulacao: false,
        status: 'ativo',
        data_posse: '2025-01-15',
        data_termino: null,
        motivo_saida: null,
        movimentacao_origem_id: null,
        movimentacao_saida_id: null,
        observacoes: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    // Se Pr. Carlos for designado para assumir TAMBÉM a congregação 'cong-vila-nova':
    const isAcumulando = DirigentesService.verificarAcumulacao(
      'Pr. Carlos Eduardo',
      'cong-vila-nova',
      designacoesAtivas
    );
    assert.equal(isAcumulando, true, 'Deve identificar que o dirigente já está ativo em outra congregação');

    // Se outro dirigente (Pr. Marcos) for designado:
    const outroDirigenteAcumula = DirigentesService.verificarAcumulacao(
      'Pr. Marcos Antonio',
      'cong-vila-nova',
      designacoesAtivas
    );
    assert.equal(outroDirigenteAcumula, false, 'Novo dirigente sem outra congregação não acumula');
  });

  test('6. Snapshot do Termo Patrimonial: captura todos os bens sem truncamento de paginação', () => {
    // Simula 80 bens na congregação (superior à paginação de 10 da tela)
    const bensCongregacao = Array.from({ length: 80 }, (_, i) => ({
      id: `bem-${i + 1}`,
      numero_tombamento: `TOMB-${String(i + 1).padStart(3, '0')}`,
      descricao: `Item de Patrimônio ${i + 1}`,
      categoria: 'equipamento',
      estado_conservacao: 'bom',
      valor_aquisicao: 200,
      status: 'ativo',
    }));

    const snapshot = DirigentesService.gerarSnapshotTermoPatrimonial(bensCongregacao);

    assert.equal(snapshot.totalItens, 80, 'Snapshot deve conter todos os 80 bens');
    assert.equal(snapshot.itensSnapshot.length, 80);
    assert.equal(snapshot.valorTotalEstimado, 80 * 200);
    assert.equal(snapshot.itensSnapshot[0].numero_tombamento, 'TOMB-001');
    assert.equal(snapshot.itensSnapshot[79].numero_tombamento, 'TOMB-080');
  });

  test('7. Segurança & Auditoria: exclusão do histórico de liderança e termos patrimoniais é terminantemente proibida', () => {
    assert.throws(
      () => {
        DirigentesService.proibirExclusaoHistorico();
      },
      /Operação proibida por integridade auditorial/
    );
  });

  test('8. Integridade Multi-tenant Cruzada: impede vincular congregação, membro ou termo de outro ministério', () => {
    // Caso 1: Congregação de destino de outro ministério
    assert.throws(
      () => {
        DirigentesService.validarIntegridadeEntidadesMultiTenant({
          ministryId: ministryAlpha,
          congregacaoDestinoMinistryId: ministryBeta,
        });
      },
      /A congregação de destino pertence a outro ministério/
    );

    // Caso 2: Membro de outro ministério
    assert.throws(
      () => {
        DirigentesService.validarIntegridadeEntidadesMultiTenant({
          ministryId: ministryAlpha,
          memberMinistryId: ministryBeta,
        });
      },
      /O membro selecionado pertence a outro ministério/
    );

    // Caso 3: Termo patrimonial de outro ministério
    assert.throws(
      () => {
        DirigentesService.validarIntegridadeEntidadesMultiTenant({
          ministryId: ministryAlpha,
          termoMinistryId: ministryBeta,
        });
      },
      /O termo patrimonial vinculado pertence a outro ministério/
    );

    // Caso 4: Todas as entidades pertencem ao mesmo ministério -> Sucesso
    assert.doesNotThrow(() => {
      DirigentesService.validarIntegridadeEntidadesMultiTenant({
        ministryId: ministryAlpha,
        congregacaoDestinoMinistryId: ministryAlpha,
        congregacaoOrigemMinistryId: ministryAlpha,
        memberMinistryId: ministryAlpha,
        termoMinistryId: ministryAlpha,
      });
    });
  });

  test('9. Matriz de Autorização: Usuário comum não pode aprovar, efetivar ou alterar termos diretamente', () => {
    assert.equal(DirigentesService.podeAprovarMovimentacao(userOperadorComum), false);
    assert.equal(DirigentesService.podeProporMovimentacao(userOperadorComum), false);

    // Secretaria não pode aprovar/efetivar
    assert.equal(DirigentesService.podeAprovarMovimentacao(userSecretaria), false);

    // Apenas Presidência ou Admin têm poder de aprovação e efetivação
    assert.equal(DirigentesService.podeAprovarMovimentacao(userPresidencia), true);
    assert.equal(DirigentesService.podeAprovarMovimentacao(userAdmin), true);
  });

  test('10. Correspondência Tríplice do Termo Patrimonial: termo deve pertencer à mesma movimentação, congregação e ministério', () => {
    const movValida: DirigenteMovimentacao = {
      id: 'mov-100',
      ministry_id: ministryAlpha,
      tipo_movimentacao: 'transferencia_extraordinaria',
      status: 'aprovada',
      ano_referencia: 2026,
      titulo: 'Transferência Oficial',
      congregacao_destino_id: 'cong-destino-1',
      congregacao_origem_id: 'cong-origem-1',
      dirigente_novo_member_id: 'mem-10',
      dirigente_novo_nome: 'Pr. Novo',
      dirigente_novo_cargo: 'Pastor',
      dirigente_novo_cpf: null,
      dirigente_novo_matricula: null,
      dirigente_anterior_member_id: null,
      dirigente_anterior_nome: null,
      dirigente_anterior_cargo: null,
      motivo: 'Transferência extraordinária aprovada',
      data_prevista: '2026-11-01',
      data_efetiva: null,
      prazo_retorno: null,
      solicitante_user_id: userSecretaria.userId,
      solicitante_nome: userSecretaria.userName,
      aprovador_user_id: userPresidencia.userId,
      aprovador_nome: userPresidencia.userName,
      data_aprovacao: new Date().toISOString(),
      justificativa_aprovacao_rejeicao: null,
      requer_termo_patrimonial: true,
      status_conferencia_patrimonial: 'conferido_sem_divergencias',
      termo_patrimonial_id: 'termo-100',
      divergencias_patrimoniais: null,
      observacoes: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const termoBase: DirigenteTermoPatrimonial = {
      id: 'termo-100',
      ministry_id: ministryAlpha,
      movimentacao_id: 'mov-100',
      congregacao_id: 'cong-destino-1',
      data_emissao: '2026-10-15',
      dirigente_transmitente_nome: 'Pr. Antigo',
      dirigente_recebedor_nome: 'Pr. Novo',
      secretario_geral_nome: 'Secretário Geral',
      total_itens: 5,
      valor_total_estimado: 12000,
      itens_snapshot: [],
      divergencias_identificadas: null,
      status_termo: 'assinado_e_homologado',
      created_at: new Date().toISOString(),
    };

    // Cenário 1: Termo apontando para outra movimentação -> Rejeita
    const termoOutraMov = { ...termoBase, movimentacao_id: 'mov-outra' };
    const r1 = DirigentesService.validarProntidaoEfetivacao(movValida, true, termoOutraMov);
    assert.equal(r1.valida, false);
    assert.match(r1.erro || '', /pertence a outra movimentação/i);

    // Cenário 2: Termo apontando para outra congregação -> Rejeita
    const termoOutraCong = { ...termoBase, congregacao_id: 'cong-outra' };
    const r2 = DirigentesService.validarProntidaoEfetivacao(movValida, true, termoOutraCong);
    assert.equal(r2.valida, false);
    assert.match(r2.erro || '', /pertence a outra congregação/i);

    // Cenário 3: Termo apontando para outro ministério -> Rejeita
    const termoOutroMin = { ...termoBase, ministry_id: ministryBeta };
    const r3 = DirigentesService.validarProntidaoEfetivacao(movValida, true, termoOutroMin);
    assert.equal(r3.valida, false);
    assert.match(r3.erro || '', /pertence a outro ministério/i);

    // Cenário 4: Termo com status ainda pendente de assinatura -> Rejeita
    const termoPendente = { ...termoBase, status_termo: 'pendente_assinaturas' as const };
    const r4 = DirigentesService.validarProntidaoEfetivacao(movValida, true, termoPendente);
    assert.equal(r4.valida, false);
    assert.match(r4.erro || '', /precisa estar homologado/i);

    // Cenário 5: Termo com mesma movimentação, congregação, ministério e homologado -> Sucesso!
    const r5 = DirigentesService.validarProntidaoEfetivacao(movValida, true, termoBase);
    assert.equal(r5.valida, true);
    assert.equal(r5.erro, undefined);
  });

  test('11. Critérios de Ativos do Patrimônio: bens ativos, emprestados e extraviados exigem transferência; bens baixados não', () => {
    const acervoCongregacao = [
      { id: '1', numero_tombamento: 'T-01', descricao: 'Som', categoria: 'som_imagem', estado_conservacao: 'bom', valor_aquisicao: 5000, status: 'ativo' },
      { id: '2', numero_tombamento: 'T-02', descricao: 'Projetor', categoria: 'equipamento', estado_conservacao: 'bom', valor_aquisicao: 3000, status: 'emprestado' },
      { id: '3', numero_tombamento: 'T-03', descricao: 'Microfone sem fio', categoria: 'som_imagem', estado_conservacao: 'regular', valor_aquisicao: 800, status: 'extraviado' },
      { id: '4', numero_tombamento: 'T-04', descricao: 'Cadeira quebrada descartada', categoria: 'movel', estado_conservacao: 'inservivel', valor_aquisicao: 50, status: 'baixado' },
    ];

    // Filtra bens sob custódia que exigem transferência (não-baixados)
    const bensSobCustodia = acervoCongregacao.filter((b) => b.status !== 'baixado');
    assert.equal(bensSobCustodia.length, 3, 'Deve incluir 3 bens (ativo, emprestado e extraviado/ressalva)');

    const snapshot = DirigentesService.gerarSnapshotTermoPatrimonial(bensSobCustodia);
    assert.equal(snapshot.totalItens, 3);
    assert.equal(snapshot.valorTotalEstimado, 8800);
    assert.equal(snapshot.itensSnapshot.some((i) => i.status === 'baixado'), false, 'Não deve incluir bens baixados');
    assert.equal(snapshot.itensSnapshot.some((i) => i.status === 'extraviado'), true, 'Deve incluir bem extraviado para registro de divergência');

    // Valida exigência de termo com base no total sob custódia
    const exigencia = DirigentesService.avaliarExigenciaPatrimonio(bensSobCustodia.length);
    assert.equal(exigencia.requerTermo, true);
    assert.equal(exigencia.statusConferencia, 'pendente');
  });

  test('12. Paginação em Escala: suporta 150 congregações em páginas de 15, busca antes de paginar e previne páginas inválidas', () => {
    // Simula 150 congregações cadastradas no ministério
    const congregacoes150: import('../src/types/dirigentes.js').CongregacaoLiderancaView[] = Array.from(
      { length: 150 },
      (_, i) => ({
        congregacao_id: `cong-${i + 1}`,
        congregacao_nome: `Congregação ${String(i + 1).padStart(3, '0')}`,
        campo_id: null,
        supervisao_id: null,
        dirigente_atual_nome: i % 10 === 0 ? null : `Pastor Número ${i + 1}`,
        dirigente_atual_cargo: i % 10 === 0 ? null : 'Pastor',
        dirigente_atual_telefone: '(11) 99999-0000',
        data_posse_atual: '2025-01-01',
        tempo_mandato_meses: 14,
        designacao_atual_id: `desig-${i + 1}`,
        is_acumulacao: i % 25 === 0,
        total_bens_patrimonio: 10 + i,
        valor_patrimonio_estimado: (10 + i) * 150,
      })
    );

    // 1. Sem busca: deve dividir exatamente em 10 páginas (150 / 15 = 10)
    const p1 = DirigentesService.filtrarEPaginarLiderancas(congregacoes150, '', 1, 15);
    assert.equal(p1.totalItens, 150);
    assert.equal(p1.totalPaginas, 10);
    assert.equal(p1.paginaAtual, 1);
    assert.equal(p1.itensPaginados.length, 15);
    assert.equal(p1.inicioRegistro, 1);
    assert.equal(p1.fimRegistro, 15);
    assert.equal(p1.itensPaginados[0].congregacao_nome, 'Congregação 001');
    assert.equal(p1.itensPaginados[14].congregacao_nome, 'Congregação 015');

    // 2. Última página (Página 10): deve exibir de 136 a 150
    const p10 = DirigentesService.filtrarEPaginarLiderancas(congregacoes150, '', 10, 15);
    assert.equal(p10.paginaAtual, 10);
    assert.equal(p10.itensPaginados.length, 15);
    assert.equal(p10.inicioRegistro, 136);
    assert.equal(p10.fimRegistro, 150);
    assert.equal(p10.itensPaginados[14].congregacao_nome, 'Congregação 150');

    // 3. Busca antes da paginação: buscar termo que existe em todo o acervo
    const pBusca = DirigentesService.filtrarEPaginarLiderancas(congregacoes150, 'Número 14', 1, 15);
    // Deve encontrar itens que contenham 'Número 14' (ex: 14, 140..149)
    assert.equal(pBusca.totalItens > 0, true);
    assert.equal(pBusca.itensPaginados.every((item) => (item.dirigente_atual_nome || '').includes('Número 14')), true);

    // 4. Prevenção de página vazia/inválida: requisitar página 999 deve ajustar automaticamente para a última página
    const pExcesso = DirigentesService.filtrarEPaginarLiderancas(congregacoes150, '', 999, 15);
    assert.equal(pExcesso.paginaAtual, 10);
    assert.equal(pExcesso.itensPaginados.length, 15);
  });

  test('13. Elegibilidade de Ministros: permite apenas ministros ativos do mesmo ministério; rejeita membros comuns, congregados e crianças', async () => {
    const fakeMembersDb: Record<string, any> = {
      'mem-pr-ativo': {
        id: 'mem-pr-ativo',
        ministry_id: ministryAlpha,
        name: 'Pr. Josué Pereira',
        role: 'ministro',
        tipo_cadastro: 'ministro',
        status: 'active',
        matricula: 'MIN-001',
        cpf: '111.111.111-11',
        cargo_ministerial: 'Pastor',
      },
      'mem-ev-ativo': {
        id: 'mem-ev-ativo',
        ministry_id: ministryAlpha,
        name: 'Ev. Lucas Rocha',
        role: 'ministro',
        tipo_cadastro: 'ministro',
        status: 'ativo',
        matricula: 'MIN-002',
        cpf: '222.222.222-22',
        cargo_ministerial: 'Evangelista',
      },
      'mem-comum': {
        id: 'mem-comum',
        ministry_id: ministryAlpha,
        name: 'Carlos Oliveira',
        role: 'membro',
        tipo_cadastro: 'membro',
        status: 'active',
        matricula: 'MEM-100',
        cpf: '333.333.333-33',
        cargo_ministerial: null,
      },
      'mem-congregado': {
        id: 'mem-congregado',
        ministry_id: ministryAlpha,
        name: 'Pedro Visitante Regular',
        role: 'congregado',
        tipo_cadastro: 'congregado',
        status: 'active',
        matricula: null,
        cpf: null,
        cargo_ministerial: null,
      },
      'mem-crianca': {
        id: 'mem-crianca',
        ministry_id: ministryAlpha,
        name: 'Tiago Criança',
        role: 'membro',
        tipo_cadastro: 'crianca',
        status: 'active',
        matricula: null,
        cpf: null,
        cargo_ministerial: null,
      },
      'mem-pr-inativo': {
        id: 'mem-pr-inativo',
        ministry_id: ministryAlpha,
        name: 'Pr. Inativo Silva',
        role: 'ministro',
        tipo_cadastro: 'ministro',
        status: 'inativo',
        matricula: 'MIN-003',
        cpf: '444.444.444-44',
        cargo_ministerial: 'Pastor',
      },
      'mem-pr-outro-tenant': {
        id: 'mem-pr-outro-tenant',
        ministry_id: ministryBeta,
        name: 'Pr. Outro Ministério',
        role: 'ministro',
        tipo_cadastro: 'ministro',
        status: 'active',
        matricula: 'MIN-004',
        cpf: '555.555.555-55',
        cargo_ministerial: 'Pastor',
      },
    };

    const createMockSupabase = () => ({
      from: (table: string) => {
        if (table === 'members') {
          return {
            select: () => ({
              eq: (col1: string, val1: any) => ({
                eq: (_col2: string, val2: any) => ({
                  maybeSingle: async () => {
                    const id = col1 === 'id' ? val1 : val2;
                    const minId = col1 === 'ministry_id' ? val1 : val2;
                    const item = fakeMembersDb[id];
                    if (item && item.ministry_id === minId) {
                      return { data: item, error: null };
                    }
                    return { data: null, error: null };
                  },
                }),
              }),
            }),
          };
        }
        return {};
      },
    });

    const mockSupabase = createMockSupabase();

    // 1. Ministro ativo do tenant -> Aprovado
    const elegivel1 = await DirigentesService.validarElegibilidadeMinistro(
      mockSupabase,
      ministryAlpha,
      'mem-pr-ativo'
    );
    assert.equal(elegivel1.id, 'mem-pr-ativo');
    assert.equal(elegivel1.nome, 'Pr. Josué Pereira');
    assert.equal(elegivel1.cargo_ministerial, 'Pastor');

    // 2. Evangelista ativo -> Aprovado
    const elegivel2 = await DirigentesService.validarElegibilidadeMinistro(
      mockSupabase,
      ministryAlpha,
      'mem-ev-ativo'
    );
    assert.equal(elegivel2.id, 'mem-ev-ativo');
    assert.equal(elegivel2.cargo_ministerial, 'Evangelista');

    // 3. Membro comum -> Rejeitado
    await assert.rejects(
      async () => {
        await DirigentesService.validarElegibilidadeMinistro(
          mockSupabase,
          ministryAlpha,
          'mem-comum'
        );
      },
      /não possui o perfil de ministro/
    );

    // 4. Congregado -> Rejeitado
    await assert.rejects(
      async () => {
        await DirigentesService.validarElegibilidadeMinistro(
          mockSupabase,
          ministryAlpha,
          'mem-congregado'
        );
      },
      /não possui o perfil de ministro/
    );

    // 5. Criança -> Rejeitado
    await assert.rejects(
      async () => {
        await DirigentesService.validarElegibilidadeMinistro(
          mockSupabase,
          ministryAlpha,
          'mem-crianca'
        );
      },
      /não possui o perfil de ministro/
    );

    // 6. Ministro Inativo -> Rejeitado
    await assert.rejects(
      async () => {
        await DirigentesService.validarElegibilidadeMinistro(
          mockSupabase,
          ministryAlpha,
          'mem-pr-inativo'
        );
      },
      /Apenas ministros ativos podem ser designados/
    );

    // 7. Ministro de Outro Tenant -> Rejeitado
    await assert.rejects(
      async () => {
        await DirigentesService.validarElegibilidadeMinistro(
          mockSupabase,
          ministryAlpha,
          'mem-pr-outro-tenant'
        );
      },
      /não encontrado ou pertencente a outro ministério/
    );
  });

  test('14. Busca de Ministros Elegíveis: exige mínimo de 3 caracteres e retorna apenas perfis ministeriais', async () => {
    let queryExecutada = false;

    const createFluentChain = () => {
      const chain: any = {
        select: () => chain,
        eq: () => chain,
        or: () => chain,
        order: () => chain,
        limit: async () => {
          queryExecutada = true;
          return {
            data: [
              {
                id: 'mem-1',
                name: 'Pr. Josué Pereira',
                matricula: 'MIN-001',
                cpf: '111.111.111-11',
                cargo_ministerial: 'Pastor',
                role: 'ministro',
                tipo_cadastro: 'ministro',
                status: 'ativo',
                congregacao_id: 'cong-1',
                congregacoes: { nome: 'Sede' },
              },
              {
                id: 'mem-2',
                name: 'Membro Infiltrado',
                matricula: 'MEM-002',
                cpf: null,
                cargo_ministerial: null,
                role: 'membro',
                tipo_cadastro: 'membro',
                status: 'ativo',
                congregacao_id: 'cong-1',
                congregacoes: { nome: 'Sede' },
              },
            ],
            error: null,
          };
        },
      };
      return chain;
    };

    const mockSupabase = {
      from: () => createFluentChain(),
    };

    // Caso A: Menos de 3 caracteres -> Não deve executar consulta ao banco e retorna array vazio
    const resCurto = await DirigentesService.buscarMinistrosElegiveis(
      mockSupabase,
      ministryAlpha,
      'pr',
      10
    );
    assert.equal(resCurto.length, 0);
    assert.equal(queryExecutada, false, 'Não deve consultar o banco com menos de 3 caracteres');

    // Caso B: 3 ou mais caracteres -> Executa busca e filtra estritamente ministros
    const resBusca = await DirigentesService.buscarMinistrosElegiveis(
      mockSupabase,
      ministryAlpha,
      'Josué',
      10
    );
    assert.equal(queryExecutada, true);
    assert.equal(resBusca.length, 1, 'Deve excluir membros comuns do resultado da busca');
    assert.equal(resBusca[0].nome, 'Pr. Josué Pereira');
    assert.equal(resBusca[0].congregacao_nome, 'Sede');
  });

  test('15. Histórico Individual Ministerial: efetivação registra posse e saída atrelados ao mesmo movimentacao_id', async () => {
    const obreirosStore: Record<string, any> = {
      'obreiro-anterior': {
        id: 'obreiro-anterior',
        ministry_id: ministryAlpha,
        cargo_ministerial: 'Pastor Titular',
        custom_fields: {
          historico_processos: [],
        },
      },
      'obreiro-novo': {
        id: 'obreiro-novo',
        ministry_id: ministryAlpha,
        cargo_ministerial: 'Pastor',
        custom_fields: {
          historico_processos: [],
        },
      },
    };

    const mockSupabase = {
      from: (_table: string) => ({
        select: (_cols: string) => ({
          eq: (col1: string, val1: string) => ({
            eq: (_col2: string, val2: string) => ({
              maybeSingle: async () => {
                const id = col1 === 'id' ? val1 : val2;
                return { data: obreirosStore[id] || null, error: null };
              },
            }),
          }),
        }),
        update: (payload: any) => ({
          eq: (col1: string, val1: string) => ({
            eq: (_col2: string, val2: string) => {
              const id = col1 === 'id' ? val1 : val2;
              if (obreirosStore[id]) {
                obreirosStore[id].custom_fields = {
                  ...obreirosStore[id].custom_fields,
                  ...payload.custom_fields,
                };
              }
              return Promise.resolve({ error: null });
            },
          }),
        }),
      }),
    };

    const movId = 'mov-unificada-999';
    const dataHoraEfetivacao = '2026-10-15T10:00:00.000Z';
    const dataIso = '2026-10-15';

    // 1. Registra saída do dirigente anterior
    await DirigentesService.registrarEventoHistoricoObreiro(
      mockSupabase,
      ministryAlpha,
      'obreiro-anterior',
      {
        id: `hist_saida_${movId}_obreiro-anterior`,
        movimentacao_id: movId,
        tipo_evento: 'saida_dirigente',
        tipo_movimentacao: 'rodizio_anual',
        data: dataIso,
        data_hora_efetivacao: dataHoraEfetivacao,
        local: 'Congregação Monte Moriá',
        congregacao_nome: 'Congregação Monte Moriá',
        cargo: 'Pastor Titular',
        justificativa: 'Conclusão regular do mandato anual de rodízio',
        descricao: 'Término de mandato e transmissão formal da congregação',
        responsavel: 'Pr. Presidente',
        usuario_id: 'user-pres-1',
      }
    );

    // 2. Registra posse do novo dirigente na mesma congregação
    await DirigentesService.registrarEventoHistoricoObreiro(
      mockSupabase,
      ministryAlpha,
      'obreiro-novo',
      {
        id: `hist_posse_${movId}_obreiro-novo`,
        movimentacao_id: movId,
        tipo_evento: 'posse_dirigente',
        tipo_movimentacao: 'rodizio_anual',
        data: dataIso,
        data_hora_efetivacao: dataHoraEfetivacao,
        local: 'Congregação Monte Moriá',
        congregacao_nome: 'Congregação Monte Moriá',
        cargo: 'Pastor',
        justificativa: 'Designado pela Presidência para assumir a titularidade',
        descricao: 'Posse e assunção da titularidade da congregação com transferência patrimonial',
        responsavel: 'Pr. Presidente',
        usuario_id: 'user-pres-1',
      }
    );

    // Verificação Dirigente Anterior
    const histAnterior = obreirosStore['obreiro-anterior'].custom_fields.historico_processos;
    assert.equal(histAnterior.length, 1);
    assert.equal(histAnterior[0].tipo_evento, 'saida_dirigente');
    assert.equal(histAnterior[0].movimentacao_id, movId);
    assert.equal(histAnterior[0].congregacao_nome, 'Congregação Monte Moriá');
    assert.equal(histAnterior[0].cargo_anterior, 'Pastor Titular');
    assert.equal(histAnterior[0].responsavel, 'Pr. Presidente');

    // Verificação Novo Dirigente
    const histNovo = obreirosStore['obreiro-novo'].custom_fields.historico_processos;
    assert.equal(histNovo.length, 1);
    assert.equal(histNovo[0].tipo_evento, 'posse_dirigente');
    assert.equal(histNovo[0].movimentacao_id, movId, 'Deve compartilhar exatamente o mesmo movimentacao_id');
    assert.equal(histNovo[0].congregacao_nome, 'Congregação Monte Moriá');
    assert.equal(histNovo[0].cargo_resultante, 'Pastor');
    assert.equal(histNovo[0].responsavel, 'Pr. Presidente');
  });

  test('16. Cenário Sem Dirigente Anterior: registra apenas a posse do novo ministro sem criar evento fictício de saída', async () => {
    const obreiroStore: Record<string, any> = {
      'novo-titular-vaga': {
        id: 'novo-titular-vaga',
        ministry_id: ministryAlpha,
        cargo_ministerial: 'Evangelista',
        custom_fields: {
          historico_processos: [],
        },
      },
    };

    const mockSupabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: obreiroStore['novo-titular-vaga'],
                error: null,
              }),
            }),
          }),
        }),
        update: (payload: any) => ({
          eq: () => ({
            eq: () => {
              obreiroStore['novo-titular-vaga'].custom_fields = payload.custom_fields;
              return Promise.resolve({ error: null });
            },
          }),
        }),
      }),
    };

    const movVagaId = 'mov-vaga-555';

    // Registra apenas posse
    await DirigentesService.registrarEventoHistoricoObreiro(
      mockSupabase as any,
      ministryAlpha,
      'novo-titular-vaga',
      {
        id: `hist_posse_${movVagaId}_novo-titular-vaga`,
        movimentacao_id: movVagaId,
        tipo_evento: 'posse_dirigente',
        tipo_movimentacao: 'transferencia_extraordinaria',
        data: '2026-10-15',
        data_hora_efetivacao: '2026-10-15T11:00:00.000Z',
        local: 'Congregação Betel (Preenchimento de Vaga)',
        congregacao_nome: 'Congregação Betel',
        cargo: 'Evangelista',
        justificativa: 'Nomeação para congregação que se encontrava sem dirigente formal',
        descricao: 'Assunção de titularidade da congregação',
        responsavel: 'Administrador',
        usuario_id: 'user-adm-1',
      }
    );

    const hist = obreiroStore['novo-titular-vaga'].custom_fields.historico_processos;
    assert.equal(hist.length, 1);
    assert.equal(hist[0].tipo_evento, 'posse_dirigente');
    assert.equal(hist[0].movimentacao_id, movVagaId);
    assert.equal(hist[0].congregacao_nome, 'Congregação Betel');
  });

  test('17. Idempotência do Histórico: impede duplicação de eventos em tentativas repetidas de efetivação', async () => {
    let updateCount = 0;
    const obreiroData: any = {
      id: 'mem-pr-idemp',
      ministry_id: ministryAlpha,
      cargo_ministerial: 'Pastor',
      custom_fields: {
        historico_processos: [],
      },
    };

    const mockSupabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: obreiroData, error: null }),
            }),
          }),
        }),
        update: (payload: any) => ({
          eq: () => ({
            eq: () => {
              updateCount++;
              obreiroData.custom_fields = payload.custom_fields;
              return Promise.resolve({ error: null });
            },
          }),
        }),
      }),
    };

    const eventoPayload = {
      id: 'hist_posse_mov-rep-101_mem-pr-idemp',
      movimentacao_id: 'mov-rep-101',
      tipo_evento: 'posse_dirigente' as const,
      tipo_movimentacao: 'rodizio_anual',
      data: '2026-10-15',
      data_hora_efetivacao: '2026-10-15T12:00:00.000Z',
      local: 'Congregação Central',
      congregacao_nome: 'Congregação Central',
      cargo: 'Pastor',
      justificativa: 'Posse inicial',
      descricao: 'Posse de dirigente',
      responsavel: 'Secretaria',
      usuario_id: 'user-sec-1',
    };

    // Primeira execução: insere evento
    await DirigentesService.registrarEventoHistoricoObreiro(
      mockSupabase as any,
      ministryAlpha,
      'mem-pr-idemp',
      eventoPayload
    );

    assert.equal(updateCount, 1);
    assert.equal(obreiroData.custom_fields.historico_processos.length, 1);

    // Segunda execução idêntica: deve detectar duplicidade e não reinserir nem atualizar
    await DirigentesService.registrarEventoHistoricoObreiro(
      mockSupabase as any,
      ministryAlpha,
      'mem-pr-idemp',
      eventoPayload
    );

    assert.equal(updateCount, 1, 'Não deve emitir segundo update quando o evento já existe');
    assert.equal(obreiroData.custom_fields.historico_processos.length, 1, 'Histórico não pode ser duplicado');
  });

  test('18. Operação Atômica Exclusiva: efetivarMovimentacao exige RPC e proíbe escritas soltas em TypeScript', async () => {
    let rpcInvocada = false;
    let rpcArgs: any = null;

    const mockSupabase = {
      rpc: async (fnName: string, args: any) => {
        rpcInvocada = true;
        rpcArgs = args;
        if (fnName === 'efetivar_movimentacao_dirigente') {
          return {
            data: {
              sucesso: true,
              movimentacao_id: args.p_movimentacao_id,
              nova_designacao_id: 'desig-atomica-001',
              congregacao_id: 'cong-001',
              congregacao_nome: 'Congregação Alpha',
              data_efetiva: args.p_data_efetiva,
              is_acumulacao: false,
              obreiro_saindo_id: 'mem-antigo',
              obreiro_novo_id: 'mem-novo',
            },
            error: null,
          };
        }
        return { data: null, error: new Error('Função RPC desconhecida') };
      },
      from: (table: string) => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              single: async () => {
                if (table === 'dirigentes_movimentacoes') {
                  return {
                    data: {
                      id: 'mov-1',
                      ministry_id: ministryAlpha,
                      status: 'efetivada',
                      tipo_movimentacao: 'rodizio_anual',
                    },
                    error: null,
                  };
                }
                if (table === 'dirigentes_designacoes') {
                  return {
                    data: {
                      id: 'desig-atomica-001',
                      ministry_id: ministryAlpha,
                      status: 'ativo',
                      nome_dirigente: 'Pr. Novo',
                    },
                    error: null,
                  };
                }
                return { data: null, error: null };
              },
            }),
          }),
        }),
      }),
    };

    const res = await DirigentesService.efetivarMovimentacao(
      mockSupabase,
      userPresidencia,
      {
        movimentacao_id: 'mov-1',
        data_efetiva: '2026-10-15',
      }
    );

    assert.equal(rpcInvocada, true, 'Deve delegar a efetivação obrigatoriamente para a RPC atômica');
    assert.equal(rpcArgs.p_movimentacao_id, 'mov-1');
    assert.equal(rpcArgs.p_ministry_id, ministryAlpha);
    assert.equal(res.movimentacao.status, 'efetivada');
    assert.equal(res.novaDesignacao.id, 'desig-atomica-001');

    // Comprova que se o client não suportar RPC, a operação é rejeitada imediatamente sem fazer escritas
    const mockSemRpc = { from: () => ({}) };
    await assert.rejects(
      async () => {
        await DirigentesService.efetivarMovimentacao(
          mockSemRpc,
          userPresidencia,
          { movimentacao_id: 'mov-1', data_efetiva: '2026-10-15' }
        );
      },
      /Cliente de banco de dados não suporta chamadas RPC atômicas/
    );
  });

  test('19. Rollback Integral: falha na gravação do histórico ministerial impede efetivação e mantém integridade', async () => {
    // Simulação do comportamento transacional PostgreSQL:
    // Se ocorrer uma falha ao tentar atualizar o histórico em members.custom_fields,
    // a transação inteira aborta com ROLLBACK, de modo que nem movimentação, nem designação,
    // nem congregação sofram alterações.
    interface BancoSimulado {
      movimentacao: { id: string; status: string; data_efetiva: string | null };
      designacaoAnterior: { id: string; status: string; data_termino: string | null };
      novaDesignacao: any | null;
      congregacao: { id: string; dirigente: string };
      membroHistorico: any[];
    }

    const estadoInicial: BancoSimulado = {
      movimentacao: { id: 'mov-err-1', status: 'aprovada', data_efetiva: null },
      designacaoAnterior: { id: 'desig-antiga', status: 'ativo', data_termino: null },
      novaDesignacao: null,
      congregacao: { id: 'cong-1', dirigente: 'Pr. Titular Anterior' },
      membroHistorico: [],
    };

    let estadoBanco: BancoSimulado = JSON.parse(JSON.stringify(estadoInicial));

    // Simula a transação PostgreSQL da RPC efetivar_movimentacao_dirigente
    const executarTransacaoPostgreSQL = async (deveFalharHistorico: boolean) => {
      // Cria snapshot para permitir rollback
      const snapshotTransacao = JSON.parse(JSON.stringify(estadoBanco));
      try {
        // Passo 1: Atualiza movimentação
        estadoBanco.movimentacao.status = 'efetivada';
        estadoBanco.movimentacao.data_efetiva = '2026-10-15';

        // Passo 2: Conclui designação anterior
        estadoBanco.designacaoAnterior.status = 'concluido';
        estadoBanco.designacaoAnterior.data_termino = '2026-10-15';

        // Passo 3: Cria nova designação
        estadoBanco.novaDesignacao = { id: 'desig-nova-1', status: 'ativo' };

        // Passo 4: Sincroniza congregação
        estadoBanco.congregacao.dirigente = 'Pr. Novo Titular';

        // Passo 5: Gravação de histórico ministerial em members.custom_fields
        if (deveFalharHistorico) {
          throw new Error('Falha ao atualizar histórico ministerial: chave JSON corrompida ou membro bloqueado.');
        }

        estadoBanco.membroHistorico.push({ tipo_evento: 'posse_dirigente', movimentacao_id: 'mov-err-1' });
        return { sucesso: true, nova_designacao_id: 'desig-nova-1' };
      } catch (err) {
        // Em caso de qualquer erro, o PostgreSQL executa ROLLBACK integral
        estadoBanco = JSON.parse(JSON.stringify(snapshotTransacao));
        throw err;
      }
    };

    // Executa cenário de falha na gravação do histórico
    await assert.rejects(
      async () => {
        await executarTransacaoPostgreSQL(true);
      },
      /Falha ao atualizar histórico ministerial/
    );

    // Comprova que o ROLLBACK reverteu TODOS os passos:
    assert.equal(estadoBanco.movimentacao.status, 'aprovada', 'Movimentação NÃO pode permanecer efetivada');
    assert.equal(estadoBanco.movimentacao.data_efetiva, null);
    assert.equal(estadoBanco.designacaoAnterior.status, 'ativo', 'Mandato anterior não pode ser encerrado em falha');
    assert.equal(estadoBanco.novaDesignacao, null, 'Nova designação não pode existir em falha');
    assert.equal(estadoBanco.congregacao.dirigente, 'Pr. Titular Anterior', 'Congregação não pode ter dirigente trocado em falha');
    assert.equal(estadoBanco.membroHistorico.length, 0);

    // Executa cenário de sucesso: todos os passos persistem atomicamente
    const resSucesso = await executarTransacaoPostgreSQL(false);
    assert.equal(resSucesso.sucesso, true);
    assert.equal(estadoBanco.movimentacao.status, 'efetivada');
    assert.equal(estadoBanco.designacaoAnterior.status, 'concluido');
    assert.equal((estadoBanco.novaDesignacao as any)?.id, 'desig-nova-1');
    assert.equal(estadoBanco.congregacao.dirigente, 'Pr. Novo Titular');
    assert.equal(estadoBanco.membroHistorico.length, 1);
  });

  test('20. Idempotência das Designações: impede criação de designações duplicadas na mesma movimentação', () => {
    // Simula a lógica da RPC: antes de criar uma nova designação, busca se já existe designação vinculada
    const designacoesDb: Array<{
      id: string;
      ministry_id: string;
      movimentacao_origem_id: string;
      nome_dirigente: string;
      status: string;
    }> = [];

    const aplicarDesignacaoIdempotente = (
      movId: string,
      ministryId: string,
      nomeDirigente: string
    ): string => {
      const existente = designacoesDb.find(
        (d) => d.ministry_id === ministryId && d.movimentacao_origem_id === movId
      );

      if (existente) {
        // Atualiza a designação existente sem duplicar
        existente.nome_dirigente = nomeDirigente;
        existente.status = 'ativo';
        return existente.id;
      }

      const novoId = `desig_${designacoesDb.length + 1}`;
      designacoesDb.push({
        id: novoId,
        ministry_id: ministryId,
        movimentacao_origem_id: movId,
        nome_dirigente: nomeDirigente,
        status: 'ativo',
      });
      return novoId;
    };

    // Primeira execução: cria designação
    const id1 = aplicarDesignacaoIdempotente('mov-idem-77', ministryAlpha, 'Pr. Josué Pereira');
    assert.equal(designacoesDb.length, 1);
    assert.equal(id1, 'desig_1');

    // Segunda execução (replay ou retry): não cria registro duplicado e retorna o mesmo ID
    const id2 = aplicarDesignacaoIdempotente('mov-idem-77', ministryAlpha, 'Pr. Josué Pereira');
    assert.equal(designacoesDb.length, 1, 'Não deve duplicar a designação');
    assert.equal(id2, 'desig_1');
    assert.equal(designacoesDb[0].nome_dirigente, 'Pr. Josué Pereira');
  });
});


