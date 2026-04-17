-- ============================================================
-- RESET COMPLETO DOS DADOS DO MÓDULO EBD
-- Execute no Supabase SQL Editor
-- ATENÇÃO: operação irreversível — todos os dados EBD serão apagados
-- ============================================================

TRUNCATE TABLE
  public.ebd_frequencias,
  public.ebd_visitantes_aula,
  public.ebd_ofertas,
  public.ebd_aulas,
  public.ebd_pedidos_itens,
  public.ebd_pedidos_revistas,
  public.ebd_revistas,
  public.ebd_matriculas,
  public.ebd_turma_professores,
  public.ebd_alunos,
  public.ebd_professores,
  public.ebd_turmas,
  public.ebd_classes,
  public.ebd_trimestres,
  public.ebd_superintendentes
CASCADE;
