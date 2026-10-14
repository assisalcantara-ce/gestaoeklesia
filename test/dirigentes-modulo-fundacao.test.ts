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
});
