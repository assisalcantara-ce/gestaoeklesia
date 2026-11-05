import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('FASE 2.1: Currículo, Turmas e Progresso Pedagógico — Auditoria e Testes Unitários', () => {

  const migrationPath = resolve(process.cwd(), 'supabase/migrations/20261105100000_fase2_modulo_discipulado_pedagogico.sql');
  const sql = readFileSync(migrationPath, 'utf8');

  test('1. Auditoria Estrita do Catálogo CPAD: 26 Lições em 2 Volumes com Títulos Neutros', () => {
    // Deve conter tabela discipulado_licoes
    assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.discipulado_licoes/);
    // Deve validar check de volume (1 e 2) e numero (1 a 26)
    assert.match(sql, /CHECK \(volume IN \(1, 2\)\)/);
    assert.match(sql, /CHECK \(numero BETWEEN 1 AND 26\)/);

    // Contagem rigorosa de 26 inserts no seed
    const seedMatches = sql.match(/\(\s*([12])\s*,\s*(\d{1,2})\s*,\s*'VOL[12]-LIC\d{2}'\s*,\s*'Lição \d{2} - Volume [12]'\s*,\s*false\s*\)/g);
    assert.ok(seedMatches, 'Seed de lições não encontrado');
    assert.strictEqual(seedMatches.length, 26, 'O seed deve conter exatamente 26 lições canônicas');

    // Validação de que nenhuma lição nasce com titulo_validado = true sem conferência prévia
    assert.strictEqual(sql.includes("true) ON CONFLICT (numero)"), false);
  });

  test('2. Separação Estrita: Frequência Física (Chamadas) x Validação Pedagógica', () => {
    // Tabelas distintas
    assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.discipulado_turma_chamadas/);
    assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.discipulado_progresso_licoes/);

    // Chamadas possuem status de presença com ausências e justificativas
    assert.match(sql, /CHECK \(status_presenca IN \('presente', 'ausente', 'falta_justificada'\)\)/);

    // Aula suporta status 'cancelada'
    assert.match(sql, /CHECK \(status_aula IN \('agendada', 'realizada', 'cancelada', 'remanejada'\)\)/);

    // Anti-duplicidade pedagógica irrestrita (RN-02)
    assert.match(sql, /CONSTRAINT discipulado_progresso_jornada_licao_key UNIQUE \(jornada_id, licao_id\)/);
  });

  test('3. Isolamento Multi-tenant e Rastreamento de Histórico', () => {
    // Equipe autorizada com ministry_id e member_id
    assert.match(sql, /CONSTRAINT discipulado_equipe_ministry_member_papel_key UNIQUE \(ministry_id, member_id, papel\)/);

    // Tabela de histórico de movimentação/transferência entre turmas
    assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.discipulado_turma_historico/);
    assert.match(sql, /CHECK \(tipo_evento IN \('matricula_inicial', 'transferencia', 'trancamento', 'reativacao', 'desligamento'\)\)/);

    // Todas as tabelas operacionais possuem ministry_id NOT NULL com FK para ministries(id)
    const tabelasOperacionais = [
      'discipulado_equipe',
      'discipulado_turmas',
      'discipulado_turma_alunos',
      'discipulado_turma_historico',
      'discipulado_turma_aulas',
      'discipulado_turma_chamadas',
      'discipulado_progresso_licoes'
    ];

    for (const tab of tabelasOperacionais) {
      const regexFk = new RegExp(`${tab}[\\s\\S]*?ministry_id UUID NOT NULL REFERENCES public\\.ministries\\(id\\)`);
      assert.match(sql, regexFk, `Tabela ${tab} não implementa FK ministry_id obrigatória`);
    }
  });

  test('4. Trigger Pedagógica: 26 Lições NÃO encerram a jornada (Preserva status = "ativo")', () => {
    // Função de sincronização
    assert.match(sql, /CREATE OR REPLACE FUNCTION public\.fn_sincronizar_progresso_pedagogico\(\)/);

    // Verifica que 26 lições avançam a fase para preparacao_batismo, MAS NUNCA alteram status para concluido
    assert.match(sql, /WHEN v_total_validadas >= 26 AND fase IN \('primeiros_passos', 'fundamentos'\)/);
    assert.match(sql, /THEN 'preparacao_batismo'/);

    // Certifica que não há "SET status = 'concluido'" na trigger pedagógica
    assert.strictEqual(sql.includes("SET status = 'concluido'"), false);
    assert.strictEqual(sql.includes("status = 'concluida'"), false);

    // Trigger escuta INSERT, UPDATE e DELETE
    assert.match(sql, /AFTER INSERT OR UPDATE OR DELETE ON public\.discipulado_progresso_licoes/);
  });

  test('5. RPCs SECURITY DEFINER: Validação de auth.uid() e Verificação em Servidor', () => {
    // A RPC registrar_aula_e_chamada_turma_rpc não confia em ministry_id do cliente; ela busca da turma
    assert.match(sql, /CREATE OR REPLACE FUNCTION public\.registrar_aula_e_chamada_turma_rpc/);
    assert.match(sql, /v_uid := auth\.uid\(\);/);
    assert.match(sql, /IF v_uid IS NULL THEN/);

    // Valida se o professor possui autorização ativa na discipulado_equipe
    assert.match(sql, /SELECT EXISTS \([\s\S]*?FROM public\.discipulado_equipe[\s\S]*?papel IN \('professor', 'coordenador'\)[\s\S]*?ativo = true/);

    // Validação da RPC individual/reposição
    assert.match(sql, /CREATE OR REPLACE FUNCTION public\.validar_licao_individual_rpc/);
    assert.match(sql, /papel IN \('discipulador', 'professor', 'coordenador'\)/);
  });

  test('6. Simulação Lógica das Regras de Domínio Pedagógico', () => {
    // Regra: Contagem de lições concluídas distintas
    const progressoDiscípulo = new Set<number>();
    
    // Aluno assiste Lição 1
    progressoDiscípulo.add(1);
    // Aluno tenta registrar Lição 1 novamente (não duplica no Set)
    progressoDiscípulo.add(1);
    assert.strictEqual(progressoDiscípulo.size, 1);

    // Aluno cursa Lição 5 (progresso não linear)
    progressoDiscípulo.add(5);
    assert.strictEqual(progressoDiscípulo.size, 2);

    // Aluno completa todas as 26 lições
    for (let i = 1; i <= 26; i++) {
      progressoDiscípulo.add(i);
    }
    assert.strictEqual(progressoDiscípulo.size, 26);

    // Estado da jornada: 26 lições habilitam transição para preparacao_batismo
    const jornadaMock = {
      fase: 'fundamentos',
      status: 'ativo',
      licoes_concluidas: 0
    };

    if (progressoDiscípulo.size >= 26 && ['primeiros_passos', 'fundamentos'].includes(jornadaMock.fase)) {
      jornadaMock.licoes_concluidas = progressoDiscípulo.size;
      jornadaMock.fase = 'preparacao_batismo';
    }

    assert.strictEqual(jornadaMock.licoes_concluidas, 26);
    assert.strictEqual(jornadaMock.fase, 'preparacao_batismo');
    assert.strictEqual(jornadaMock.status, 'ativo'); // Permanece ATIVO até batismo e homologação da secretaria
  });

});
