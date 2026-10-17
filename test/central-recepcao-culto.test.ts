import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  generateCultoRecepcaoToken,
  hashCultoRecepcaoToken,
  calculateCultoExpiration,
  verifyRecepcaoTokenStatus,
} from '../src/lib/culto-recepcao-utils';
import { CultoRecepcaoService } from '../src/lib/culto-recepcao-service';

describe('Central de Recepção dos Cultos - Validação e Regras de Negócio', () => {
  describe('1. Segurança Criptográfica dos Tokens Temporários', () => {
    it('gera tokens criptograficamente seguros de 32 bytes com prefixo crp_', () => {
      const token1 = generateCultoRecepcaoToken();
      const token2 = generateCultoRecepcaoToken();

      assert.ok(token1.startsWith('crp_'));
      assert.ok(token2.startsWith('crp_'));
      assert.notEqual(token1, token2);
      // 'crp_' (4 chars) + 32 bytes hex (64 chars) = 68 chars
      assert.equal(token1.length, 68);
    });

    it('gera hash SHA-256 consistente de 64 caracteres hexadecimais', () => {
      const rawToken = 'crp_abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
      const hash1 = hashCultoRecepcaoToken(rawToken);
      const hash2 = hashCultoRecepcaoToken(rawToken);

      assert.equal(hash1, hash2);
      assert.equal(hash1.length, 64);
      assert.match(hash1, /^[a-f0-9]{64}$/);
    });

    it('rejeita tokens inválidos para cálculo de hash', () => {
      assert.throws(() => hashCultoRecepcaoToken(''), /Token inválido/);
      assert.throws(() => hashCultoRecepcaoToken(null as any), /Token inválido/);
    });
  });

  describe('2. Cálculo Determinístico de Expiração às 23h59 do Dia do Culto', () => {
    it('calcula expiração estritamente às 23:59:59 no fuso de Brasília (UTC-3)', () => {
      const expiraEm = calculateCultoExpiration('2026-10-18');
      const d = new Date(expiraEm);

      // Em UTC-3, 23:59:59 corresponde a 02:59:59 do dia seguinte em UTC
      assert.equal(d.getUTCHours(), 2);
      assert.equal(d.getUTCMinutes(), 59);
      assert.equal(d.getUTCSeconds(), 59);
      assert.equal(d.getUTCDate(), 19);
    });

    it('valida token dentro da janela do culto', () => {
      const expiraEm = calculateCultoExpiration('2026-10-18');
      const nowDuranteCulto = new Date('2026-10-18T20:30:00-03:00');

      const status = verifyRecepcaoTokenStatus({
        expira_em: expiraEm,
        now: nowDuranteCulto,
      });

      assert.equal(status.valido, true);
      assert.equal(status.motivo, undefined);
    });

    it('bloqueia token após 23h59:59 do dia do culto com TOKEN_EXPIRADO', () => {
      const expiraEm = calculateCultoExpiration('2026-10-18');
      // 00:00:01 do dia seguinte
      const nowAposMeiaNoite = new Date('2026-10-19T00:00:01-03:00');

      const status = verifyRecepcaoTokenStatus({
        expira_em: expiraEm,
        now: nowAposMeiaNoite,
      });

      assert.equal(status.valido, false);
      assert.equal(status.motivo, 'TOKEN_EXPIRADO');
    });

    it('bloqueia imediatamente links revogados com TOKEN_REVOGADO', () => {
      const expiraEm = calculateCultoExpiration('2026-10-18');
      const now = new Date('2026-10-18T19:00:00-03:00');

      const status = verifyRecepcaoTokenStatus({
        expira_em: expiraEm,
        revogado_em: '2026-10-18T18:00:00-03:00',
        now,
      });

      assert.equal(status.valido, false);
      assert.equal(status.motivo, 'TOKEN_REVOGADO');
    });

    it('bloqueia links de cultos cancelados com CULTO_CANCELADO', () => {
      const expiraEm = calculateCultoExpiration('2026-10-18');
      const now = new Date('2026-10-18T19:00:00-03:00');

      const status = verifyRecepcaoTokenStatus({
        expira_em: expiraEm,
        status_culto: 'Cancelado',
        now,
      });

      assert.equal(status.valido, false);
      assert.equal(status.motivo, 'CULTO_CANCELADO');
    });
  });

  describe('3. Central de Recepção - 6 Áreas Operacionais e Anti-Duplicação', () => {
    const fakeAdmin: any = {
      from: (table: string) => {
        if (table === 'culto_visitantes') {
          return {
            select: () => ({
              eq: () => ({
                order: () => Promise.resolve({ data: [], error: null }),
                in: () => ({ limit: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }),
                ilike: () => ({ limit: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }),
              }),
            }),
            insert: (payload: any) => ({
              select: () => ({
                single: () => Promise.resolve({ data: { id: 'vis_mock_1', ...payload }, error: null }),
              }),
            }),
          };
        }
        return {
          select: () => ({
            eq: () => ({
              order: () => Promise.resolve({ data: null, error: { code: 'PGRST205' } }),
              maybeSingle: () => Promise.resolve({ data: null, error: { code: 'PGRST205' } }),
            }),
          }),
          insert: () => ({
            select: () => ({
              single: () => Promise.resolve({ data: null, error: { code: 'PGRST205' } }),
            }),
          }),
          update: () => ({
            eq: () => ({
              eq: () => Promise.resolve({ error: { code: 'PGRST205' } }),
            }),
          }),
          upsert: () => ({
            select: () => ({
              single: () => Promise.resolve({ data: null, error: { code: 'PGRST205' } }),
            }),
          }),
        };
      },
    };

    const service = new CultoRecepcaoService(fakeAdmin);

    it('salva e recupera token no fallback seguro sem erro de schema', async () => {
      const rawToken = generateCultoRecepcaoToken();
      const tokenHash = hashCultoRecepcaoToken(rawToken);
      const expiraEm = calculateCultoExpiration('2026-10-18');

      const salvo = await service.salvarToken({
        ministry_id: 'min_test_1',
        congregacao_id: 'cong_test_1',
        culto_id: 'culto_test_1',
        token_hash: tokenHash,
        expira_em: expiraEm,
      });

      assert.ok(salvo.id);
      assert.equal(salvo.token_hash, tokenHash);

      const recuperado = await service.buscarTokenPorHash(tokenHash);
      assert.ok(recuperado);
      assert.equal(recuperado?.culto_id, 'culto_test_1');
    });

    it('permite registrar autoridades, orações, avisos e famílias nas 6 seções', async () => {
      const testCultoId = `culto_test_sec_${Date.now()}`;

      // 1. Autoridade
      const autoridade = await service.salvarAutoridade({
        culto_id: testCultoId,
        ministry_id: 'min_test_1',
        congregacao_id: 'cong_test_1',
        nome: 'Pr. Manoel Santos',
        cargo_funcao: 'Pastor Presidente',
        instituicao: 'AD Missões',
        observacoes: 'Acompanhado da diretoria',
      });
      assert.ok(autoridade.id);
      assert.equal(autoridade.nome, 'Pr. Manoel Santos');

      // 2. Oração
      const oracao = await service.salvarOracao({
        culto_id: testCultoId,
        ministry_id: 'min_test_1',
        congregacao_id: 'cong_test_1',
        nome: 'Irmã Ana Paula',
        tipo: 'pedido',
        categoria: 'Saúde / Enfermidade',
        motivo: 'Oração pela cirurgia de seu filho',
        is_privado: true,
      });
      assert.ok(oracao.id);
      assert.equal(oracao.is_privado, true);

      // 3. Aviso
      const aviso = await service.salvarAviso({
        culto_id: testCultoId,
        ministry_id: 'min_test_1',
        congregacao_id: 'cong_test_1',
        titulo: 'Vigília de Oração',
        conteudo: 'Sexta-feira às 22h no templo central.',
        ordem: 1,
      });
      assert.ok(aviso.id);
      assert.equal(aviso.ordem, 1);

      // 4. Família
      const familia = await service.salvarFamilia({
        culto_id: testCultoId,
        ministry_id: 'min_test_1',
        congregacao_id: 'cong_test_1',
        responsavel: 'Família Oliveira (Carlos Oliveira)',
        membros_familia: 'Esposa e 2 filhos',
        total_membros: 4,
        origem: 'Bairro Novo',
        intencao_congregar: true,
      });
      assert.ok(familia.id);
      assert.equal(familia.total_membros, 4);
      assert.equal(familia.intencao_congregar, true);

      // 5. Resumo da Recepção consolidado
      const dados = await service.listarDadosRecepcao(testCultoId);
      assert.equal(dados.autoridades.length, 1);
      assert.equal(dados.oracoes.length, 1);
      assert.equal(dados.avisos.length, 1);
      assert.equal(dados.familias.length, 1);

      // Métricas do Resumo
      assert.equal(dados.resumo.totais.autoridades, 1);
      assert.equal(dados.resumo.totais.pedidos_oracao, 1);
      assert.equal(dados.resumo.totais.oracoes_privadas, 1);
      assert.equal(dados.resumo.totais.familias, 1);
      assert.equal(dados.resumo.totais.total_pessoas_familias, 4);
      assert.equal(dados.resumo.totais.intencoes_congregar, 1);
    });

    it('permite exclusão lógica de registros preservando histórico', async () => {
      const aviso = await service.salvarAviso({
        culto_id: 'culto_test_del',
        ministry_id: 'min_test_1',
        congregacao_id: 'cong_test_1',
        titulo: 'Aviso Temporário',
        conteudo: 'Conteúdo teste',
      });

      const removido = await service.removerItem('avisos', aviso.id, 'culto_test_del');
      assert.equal(removido, true);

      const dados = await service.listarDadosRecepcao('culto_test_del');
      assert.equal(dados.avisos.length, 0);
    });

    it('compartilha dados persistentes entre diferentes instâncias de serviço (simulando rotas admin e pública)', async () => {
      const serviceAdmin = new CultoRecepcaoService(fakeAdmin);
      const servicePublico = new CultoRecepcaoService(fakeAdmin);

      const tokenRaw = generateCultoRecepcaoToken();
      const tokenHash = hashCultoRecepcaoToken(tokenRaw);
      const expiraEm = calculateCultoExpiration('2026-10-25');

      await serviceAdmin.salvarToken({
        ministry_id: 'min_multi_1',
        congregacao_id: 'cong_multi_1',
        culto_id: 'culto_cross_instance',
        token_hash: tokenHash,
        expira_em: expiraEm,
      });

      // A rota pública consulta apenas pelo hash
      const recuperado = await servicePublico.buscarTokenPorHash(tokenHash);
      assert.ok(recuperado, 'Token deve ser encontrado pela rota pública');
      assert.equal(recuperado?.culto_id, 'culto_cross_instance');
      assert.equal(recuperado?.expira_em, expiraEm);
    });

    it('estende validade para fim do dia atual quando o culto aberto possui data anterior (allowCurrentDayIfPast)', () => {
      // Simula culto registrado ontem (2026-10-10) sendo gerado hoje (2026-10-11)
      const fakeToday = new Date('2026-10-11T14:00:00-03:00');
      const expiraEm = calculateCultoExpiration('2026-10-10', {
        allowCurrentDayIfPast: true,
        now: fakeToday,
      });

      const d = new Date(expiraEm);
      // Deve expirar no dia de hoje (2026-10-11 às 23:59:59-03:00, que é 02:59:59 do dia 12 em UTC)
      assert.equal(d.getUTCDate(), 12);
      assert.equal(d.getUTCHours(), 2);
      assert.equal(d.getUTCMinutes(), 59);

      // Verificação de status não deve expirar no momento de geração
      const status = verifyRecepcaoTokenStatus({
        expira_em: expiraEm,
        now: fakeToday,
      });
      assert.equal(status.valido, true);
    });
  });
});
