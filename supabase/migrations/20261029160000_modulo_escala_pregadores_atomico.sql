-- ==============================================================================
-- GESTÃO EKLÉSIA — PROCEDIMENTOS ATÔMICOS DE ESCALA DE PREGADORES
-- Arquivo: supabase/migrations/20261029160000_modulo_escala_pregadores_atomico.sql
-- Objetivo: Garantir atomicidade nativa em transação única PostgreSQL para
--           operações de Substituição e Remanejamento de Pregadores.
-- NOTA: Preparado para aplicação manual no Supabase SQL Editor.
-- ==============================================================================

BEGIN;

-- 1. Função RPC Atômica para Substituir Pregador
CREATE OR REPLACE FUNCTION public.substituir_escala_pregador_rpc(
  p_escala_id UUID,
  p_ministry_id UUID,
  p_novo_member_id UUID,
  p_motivo_substituicao TEXT,
  p_status TEXT DEFAULT 'escalado',
  p_tema_mensagem TEXT DEFAULT NULL,
  p_texto_biblico TEXT DEFAULT NULL,
  p_observacoes TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_escala_antiga public.agenda_escala_pregadores%ROWTYPE;
  v_nova_escala public.agenda_escala_pregadores%ROWTYPE;
  v_result JSONB;
BEGIN
  IF p_motivo_substituicao IS NULL OR trim(p_motivo_substituicao) = '' THEN
    RAISE EXCEPTION 'É obrigatório informar o motivo da substituição do pregador.';
  END IF;

  -- Validação do status permitido
  IF p_status NOT IN ('escalado', 'confirmado') THEN
    RAISE EXCEPTION 'Status inválido para nova atribuição: %', p_status;
  END IF;

  -- Localiza a escala atual com lock exclusivo para atualização
  SELECT * INTO v_escala_antiga
  FROM public.agenda_escala_pregadores
  WHERE id = p_escala_id
    AND ministry_id = p_ministry_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Escala de pregador não encontrada ou não pertence a este ministério.';
  END IF;

  IF v_escala_antiga.member_id = p_novo_member_id THEN
    RAISE EXCEPTION 'O novo pregador deve ser diferente do pregador atual.';
  END IF;

  -- 1. Atualiza a escala antiga para "substituido"
  UPDATE public.agenda_escala_pregadores
  SET status = 'substituido',
      motivo_alteracao = trim(p_motivo_substituicao),
      substituido_por_member_id = p_novo_member_id,
      data_alteracao = NOW(),
      updated_at = NOW()
  WHERE id = p_escala_id;

  -- 2. Insere a nova escala com o novo ministro (aciona triggers de conflito e validação)
  INSERT INTO public.agenda_escala_pregadores (
    ministry_id,
    agenda_evento_id,
    member_id,
    status,
    tema_mensagem,
    texto_biblico,
    observacoes,
    created_by
  )
  VALUES (
    p_ministry_id,
    v_escala_antiga.agenda_evento_id,
    p_novo_member_id,
    p_status,
    COALESCE(trim(p_tema_mensagem), v_escala_antiga.tema_mensagem),
    COALESCE(trim(p_texto_biblico), v_escala_antiga.texto_biblico),
    COALESCE(trim(p_observacoes), v_escala_antiga.observacoes),
    p_user_id
  )
  RETURNING * INTO v_nova_escala;

  SELECT jsonb_build_object(
    'id', v_nova_escala.id,
    'agenda_evento_id', v_nova_escala.agenda_evento_id,
    'member_id', v_nova_escala.member_id,
    'status', v_nova_escala.status,
    'tema_mensagem', v_nova_escala.tema_mensagem,
    'texto_biblico', v_nova_escala.texto_biblico,
    'observacoes', v_nova_escala.observacoes,
    'created_at', v_nova_escala.created_at
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- 2. Função RPC Atômica para Remanejar Pregador
CREATE OR REPLACE FUNCTION public.remanejar_escala_pregador_rpc(
  p_escala_origem_id UUID,
  p_novo_agenda_evento_id UUID,
  p_ministry_id UUID,
  p_motivo_remanejamento TEXT,
  p_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_origem public.agenda_escala_pregadores%ROWTYPE;
  v_nova public.agenda_escala_pregadores%ROWTYPE;
  v_result JSONB;
BEGIN
  IF p_motivo_remanejamento IS NULL OR trim(p_motivo_remanejamento) = '' THEN
    RAISE EXCEPTION 'Informe o motivo do remanejamento do ministro.';
  END IF;

  -- Lock da escala de origem
  SELECT * INTO v_origem
  FROM public.agenda_escala_pregadores
  WHERE id = p_escala_origem_id
    AND ministry_id = p_ministry_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Escala de origem não encontrada ou não pertence a este ministério.';
  END IF;

  -- 1. Cancela a escala de origem motivadamente
  UPDATE public.agenda_escala_pregadores
  SET status = 'cancelado',
      motivo_alteracao = 'Remanejado: ' || trim(p_motivo_remanejamento),
      data_alteracao = NOW(),
      updated_at = NOW()
  WHERE id = p_escala_origem_id;

  -- 2. Cria a nova escala no evento de destino (aciona triggers de conflito e tenant)
  INSERT INTO public.agenda_escala_pregadores (
    ministry_id,
    agenda_evento_id,
    member_id,
    status,
    tema_mensagem,
    texto_biblico,
    observacoes,
    created_by
  )
  VALUES (
    p_ministry_id,
    p_novo_agenda_evento_id,
    v_origem.member_id,
    'escalado',
    v_origem.tema_mensagem,
    v_origem.texto_biblico,
    v_origem.observacoes,
    p_user_id
  )
  RETURNING * INTO v_nova;

  SELECT jsonb_build_object(
    'id', v_nova.id,
    'agenda_evento_id', v_nova.agenda_evento_id,
    'member_id', v_nova.member_id,
    'status', v_nova.status,
    'tema_mensagem', v_nova.tema_mensagem,
    'texto_biblico', v_nova.texto_biblico,
    'observacoes', v_nova.observacoes,
    'created_at', v_nova.created_at
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- Permissões de execução para usuários autenticados
GRANT EXECUTE ON FUNCTION public.substituir_escala_pregador_rpc TO authenticated;
GRANT EXECUTE ON FUNCTION public.remanejar_escala_pregador_rpc TO authenticated;

COMMIT;
