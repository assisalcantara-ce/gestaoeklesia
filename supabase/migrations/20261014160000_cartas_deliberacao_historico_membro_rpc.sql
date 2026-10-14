-- ==============================================================================
-- Migração: Deliberação Presidencial de Cartas e Histórico Individual de Membros
-- Arquivo: 20261014160000_cartas_deliberacao_historico_membro_rpc.sql
-- NOTA: Preparada para aplicação manual quando apropriado.
-- ==============================================================================

-- 1. Função RPC para registrar evento com garantia atômica e idempotência em custom_fields
CREATE OR REPLACE FUNCTION public.registrar_evento_historico_membro(
  p_ministry_id UUID,
  p_member_id UUID,
  p_tipo_evento TEXT,
  p_tipo_documento TEXT,
  p_evento_id TEXT,
  p_pedido_id UUID DEFAULT NULL,
  p_documento_id TEXT DEFAULT NULL,
  p_numero_documento TEXT DEFAULT NULL,
  p_novo_status_membro TEXT DEFAULT NULL,
  p_motivo TEXT DEFAULT NULL,
  p_destino TEXT DEFAULT NULL,
  p_observacoes TEXT DEFAULT NULL,
  p_responsavel TEXT DEFAULT 'Presidência',
  p_usuario_id UUID DEFAULT NULL,
  p_descricao TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member RECORD;
  v_cf JSONB;
  v_hist JSONB;
  v_novo_item JSONB;
  v_now TIMESTAMPTZ := clock_timestamp();
  v_now_iso TEXT := to_char(v_now, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_today TEXT := to_char(v_now, 'YYYY-MM-DD');
  v_ja_existe BOOLEAN := FALSE;
  v_elem JSONB;
BEGIN
  -- Validação de existência e tenant isolation
  SELECT id, status, is_active, custom_fields
  INTO v_member
  FROM public.members
  WHERE id = p_member_id AND ministry_id = p_ministry_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Membro % não encontrado no ministério %', p_member_id, p_ministry_id;
  END IF;

  v_cf := COALESCE(v_member.custom_fields, '{}'::jsonb);
  v_hist := COALESCE(v_cf->'historico_processos', v_cf->'historicoProcessos', '[]'::jsonb);

  IF jsonb_typeof(v_hist) != 'array' THEN
    v_hist := '[]'::jsonb;
  END IF;

  -- Checagem de idempotência
  FOR v_elem IN SELECT * FROM jsonb_array_elements(v_hist)
  LOOP
    IF v_elem->>'id' = p_evento_id THEN
      v_ja_existe := TRUE;
      EXIT;
    END IF;
    IF p_pedido_id IS NOT NULL AND v_elem->>'pedido_id' = p_pedido_id::text AND v_elem->>'tipo_evento' = p_tipo_evento THEN
      v_ja_existe := TRUE;
      EXIT;
    END IF;
    IF p_documento_id IS NOT NULL AND v_elem->>'documento_id' = p_documento_id AND v_elem->>'tipo_evento' = p_tipo_evento THEN
      v_ja_existe := TRUE;
      EXIT;
    END IF;
  END LOOP;

  IF v_ja_existe THEN
    -- Se já existe, apenas sincroniza status caso solicitado
    IF p_novo_status_membro IS NOT NULL AND v_member.status IS DISTINCT FROM p_novo_status_membro THEN
      UPDATE public.members
      SET
        status = p_novo_status_membro,
        is_active = (p_novo_status_membro = 'ativo'),
        updated_at = v_now_iso
      WHERE id = p_member_id AND ministry_id = p_ministry_id;
    END IF;

    RETURN jsonb_build_object(
      'sucesso', TRUE,
      'evento_id', p_evento_id,
      'ja_registrado', TRUE
    );
  END IF;

  -- Monta novo item histórico estruturado
  v_novo_item := jsonb_build_object(
    'id', p_evento_id,
    'processo_id', COALESCE(p_documento_id, p_pedido_id::text, p_evento_id),
    'pedido_id', p_pedido_id,
    'documento_id', p_documento_id,
    'numero_documento', p_numero_documento,
    'ministry_id', p_ministry_id,
    'member_id', p_member_id,
    'tipo_evento', p_tipo_evento,
    'tipo_documento', p_tipo_documento,
    'data', v_today,
    'data_hora', v_now_iso,
    'status_anterior', v_member.status,
    'status_resultante', COALESCE(p_novo_status_membro, v_member.status),
    'motivo', COALESCE(p_motivo, p_destino),
    'destino', p_destino,
    'observacoes', p_observacoes,
    'responsavel', p_responsavel,
    'usuario_id', p_usuario_id,
    'descricao', COALESCE(p_descricao, 'Registro de ' || COALESCE(p_tipo_documento, p_tipo_evento)),
    'criado_em', v_now_iso
  );

  v_hist := v_hist || jsonb_build_array(v_novo_item);

  -- Atualiza custom_fields garantindo dual-key compatibility
  v_cf := jsonb_set(v_cf, '{historico_processos}', v_hist, TRUE);
  v_cf := jsonb_set(v_cf, '{historicoProcessos}', v_hist, TRUE);

  IF p_novo_status_membro IS NOT NULL THEN
    UPDATE public.members
    SET
      status = p_novo_status_membro,
      is_active = (p_novo_status_membro = 'ativo'),
      custom_fields = v_cf,
      updated_at = v_now_iso
    WHERE id = p_member_id AND ministry_id = p_ministry_id;
  ELSE
    UPDATE public.members
    SET
      custom_fields = v_cf,
      updated_at = v_now_iso
    WHERE id = p_member_id AND ministry_id = p_ministry_id;
  END IF;

  RETURN jsonb_build_object(
    'sucesso', TRUE,
    'evento_id', p_evento_id,
    'ja_registrado', FALSE
  );
END;
$$;

COMMENT ON FUNCTION public.registrar_evento_historico_membro IS
'Registra de maneira atômica e idempotente eventos de deliberação de cartas, emissão documental ou reativação no histórico individual do membro.';
