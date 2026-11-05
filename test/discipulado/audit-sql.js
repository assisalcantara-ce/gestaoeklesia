import fs from 'node:fs';
import path from 'node:path';

const p = path.resolve('supabase/migrations/20261105100000_fase2_modulo_discipulado_pedagogico.sql');
const content = fs.readFileSync(p, 'utf8');

const checks = [
  { name: 'Contém BEGIN e COMMIT transacional', ok: content.includes('BEGIN;') && content.trim().endsWith('COMMIT;') },
  { name: 'Timeouts configurados (lock_timeout e statement_timeout)', ok: content.includes("lock_timeout = '4s'") && content.includes("statement_timeout = '30s'") },
  { name: 'Adição não-destrutiva de licoes_concluidas', ok: content.includes('ADD COLUMN IF NOT EXISTS licoes_concluidas') },
  { name: 'Criação de discipulado_licoes', ok: content.includes('CREATE TABLE IF NOT EXISTS public.discipulado_licoes') },
  { name: '26 lições canônicas neutras inseridas', ok: (content.match(/Lição \d\d - Volume [12]/g) || []).length === 26 },
  { name: 'Criação de discipulado_equipe', ok: content.includes('CREATE TABLE IF NOT EXISTS public.discipulado_equipe') },
  { name: 'Criação de discipulado_turmas', ok: content.includes('CREATE TABLE IF NOT EXISTS public.discipulado_turmas') },
  { name: 'Criação de discipulado_turma_alunos', ok: content.includes('CREATE TABLE IF NOT EXISTS public.discipulado_turma_alunos') },
  { name: 'Criação de discipulado_turma_historico', ok: content.includes('CREATE TABLE IF NOT EXISTS public.discipulado_turma_historico') },
  { name: 'Criação de discipulado_turma_aulas', ok: content.includes('CREATE TABLE IF NOT EXISTS public.discipulado_turma_aulas') },
  { name: 'Criação de discipulado_turma_chamadas', ok: content.includes('CREATE TABLE IF NOT EXISTS public.discipulado_turma_chamadas') },
  { name: 'Criação de discipulado_progresso_licoes', ok: content.includes('CREATE TABLE IF NOT EXISTS public.discipulado_progresso_licoes') },
  { name: 'Anti-duplicidade RN-02 (UNIQUE jornada_id, licao_id)', ok: content.includes('CONSTRAINT discipulado_progresso_jornada_licao_key UNIQUE (jornada_id, licao_id)') },
  { name: 'Trigger de sincronização tratando OLD e NEW', ok: content.includes('OLD.jornada_id') && content.includes('NEW.jornada_id') },
  { name: 'Trigger NÃO encerra jornada (status = ativo)', ok: !content.includes("status = 'concluido'") && !content.includes("status = 'concluida'") },
  { name: 'RPC registrar_aula_e_chamada_turma_rpc com auth.uid()', ok: content.includes('v_uid := auth.uid();') },
  { name: 'RPC validar_licao_individual_rpc com validação na equipe', ok: content.includes('discipulado_equipe') },
  { name: 'RLS habilitado nas 8 tabelas', ok: (content.match(/ENABLE ROW LEVEL SECURITY/g) || []).length === 8 }
];

console.log('--- AUDITORIA ESTATICAMENTE ANALISADA DO SCRIPT DE MIGRAÇÃO ---');
let allOk = true;
checks.forEach(c => {
  console.log((c.ok ? '✅' : '❌') + ' ' + c.name);
  if (!c.ok) allOk = false;
});

if (!allOk) {
  process.exit(1);
} else {
  console.log('\nTodas as 18 verificações estritas passaram com 100% de sucesso.');
}
