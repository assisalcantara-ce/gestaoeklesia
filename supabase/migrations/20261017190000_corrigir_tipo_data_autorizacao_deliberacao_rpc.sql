-- ==============================================================================
-- Migration: 20261017190000_corrigir_tipo_data_autorizacao_deliberacao_rpc.sql
-- Descrição: Corrige a incompatibilidade de tipos em deliberar_carta_presidencia_rpc
--            onde data_autorizacao (timestamptz) recebia a variável v_now_iso (text).
--            Ajusta para atribuir a variável nativa v_now (timestamptz) tanto no
--            fluxo de indeferimento ('rejeitar') quanto no de autorização ('autorizar').
--            Também ajusta updated_at na tabela members para v_now.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.deliberar_carta_presidencia_rpc(
  p_pedido_id UUID,
  p_ministry_id UUID,
  p_decisao TEXT,
  p_motivo_rejeicao TEXT DEFAULT NULL,
  p_autorizador_id UUID DEFAULT NULL,
  p_autorizador_nome TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_caller_id UUID := COALESCE(auth.uid(), p_autorizador_id);
  v_pedido RECORD;
  v_member RECORD;
  v_cf JSONB;
  v_hist JSONB;
  v_novo_item JSONB;
  v_now TIMESTAMPTZ := clock_timestamp();
  v_now_iso TEXT := to_char(v_now, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_today TEXT := to_char(v_now, 'YYYY-MM-DD');
  v_evento_id TEXT;
  v_ja_existe BOOLEAN := FALSE;
  v_elem JSONB;
  v_tipo_doc TEXT;
  v_desc TEXT;
BEGIN
  -- 1. Validação do chamador autenticado
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Acesso negado: Usuário não autenticado.';
  END IF;

  -- 2. Validação da autorização institucional (pertence ao tenant)
  IF NOT EXISTS (
    SELECT 1 FROM public.ministry_users
    WHERE ministry_id = p_ministry_id
      AND user_id = v_caller_id
      AND is_active = TRUE
  ) AND NOT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = v_caller_id
  ) THEN
    RAISE EXCEPTION 'Acesso negado: Usuário não possui autorização para este ministério.';
  END IF;

  -- 3. Lock pessimista no pedido de carta (garante consistência concorrente)
  SELECT *
  INTO v_pedido
  FROM public.carta_pedidos
  WHERE id = p_pedido_id AND ministry_id = p_ministry_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido de carta não encontrado ou pertencente a outro ministério.';
  END IF;

  IF v_pedido.status != 'pendente' THEN
    RAISE EXCEPTION 'Este pedido de carta já se encontra %.', v_pedido.status;
  END IF;

  -- 4. Fluxo de Rejeição / Indeferimento
  IF p_decisao = 'rejeitar' THEN
    IF p_motivo_rejeicao IS NULL OR TRIM(p_motivo_rejeicao) = '' THEN
      RAISE EXCEPTION 'O motivo do indeferimento da carta é obrigatório.';
    END IF;

    UPDATE public.carta_pedidos
    SET
      status = 'rejeitado',
      motivo_rejeicao = TRIM(p_motivo_rejeicao),
      autorizador_id = v_caller_id,
      autorizador_nome = COALESCE(p_autorizador_nome, 'Presidência'),
      data_autorizacao = v_now
    WHERE id = p_pedido_id AND ministry_id = p_ministry_id;

    RETURN jsonb_build_object(
      'sucesso', TRUE,
      'pedido_id', p_pedido_id,
      'status', 'rejeitado',
      'membro_inativado', FALSE
    );
  END IF;

  -- 5. Fluxo de Autorização
  IF p_decisao != 'autorizar' THEN
    RAISE EXCEPTION 'Decisão inválida: use "autorizar" ou "rejeitar".';
  END IF;

  UPDATE public.carta_pedidos
  SET
    status = 'autorizado',
    autorizador_id = v_caller_id,
    autorizador_nome = COALESCE(p_autorizador_nome, 'Presidência'),
    data_autorizacao = v_now
  WHERE id = p_pedido_id AND ministry_id = p_ministry_id;

  -- 6. Aplicação atômica do efeito institucional sobre o membro
  IF v_pedido.tipo_carta IN ('mudanca', 'desligamento') AND v_pedido.member_id IS NOT NULL THEN
    SELECT id, status, custom_fields
    INTO v_member
    FROM public.members
    WHERE id = v_pedido.member_id AND ministry_id = p_ministry_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Membro vinculado ao pedido (%) não encontrado no ministério %.', v_pedido.member_id, p_ministry_id;
    END IF;

    v_cf := COALESCE(v_member.custom_fields, '{}'::jsonb);
    v_hist := COALESCE(v_cf->'historico_processos', v_cf->'historicoProcessos', '[]'::jsonb);
    IF jsonb_typeof(v_hist) != 'array' THEN
      v_hist := '[]'::jsonb;
    END IF;

    v_evento_id := 'delib_' || p_pedido_id::text || '_carta_' || v_pedido.tipo_carta;

    FOR v_elem IN SELECT * FROM jsonb_array_elements(v_hist)
    LOOP
      IF v_elem->>'id' = v_evento_id OR (v_elem->>'pedido_id' = p_pedido_id::text AND v_elem->>'tipo_evento' = ('carta_' || v_pedido.tipo_carta)) THEN
        v_ja_existe := TRUE;
        EXIT;
      END IF;
    END LOOP;

    IF NOT v_ja_existe THEN
      v_tipo_doc := CASE WHEN v_pedido.tipo_carta = 'mudanca' THEN 'Carta de Mudança' ELSE 'Carta de Desligamento' END;
      v_desc := CASE
        WHEN v_pedido.tipo_carta = 'mudanca' THEN 'Carta de Mudança autorizada pela Presidência' || COALESCE(' para ' || v_pedido.destino, '') || '. Membro inativado no rol.'
        ELSE 'Carta de Desligamento autorizada pela Presidência. Membro inativado no rol.'
      END;

      v_novo_item := jsonb_build_object(
        'id', v_evento_id,
        'processo_id', p_pedido_id,
        'pedido_id', p_pedido_id,
        'ministry_id', p_ministry_id,
        'member_id', v_pedido.member_id,
        'tipo_evento', 'carta_' || v_pedido.tipo_carta,
        'tipo_documento', v_tipo_doc,
        'data', v_today,
        'data_hora', v_now_iso,
        'status_anterior', v_member.status,
        'status_resultante', 'inactive',
        'motivo', COALESCE(v_pedido.destino, 'Autorizado pela Presidência'),
        'destino', v_pedido.destino,
        'observacoes', v_pedido.observacoes,
        'responsavel', COALESCE(p_autorizador_nome, 'Presidência'),
        'usuario_id', v_caller_id,
        'descricao', v_desc,
        'criado_em', v_now_iso
      );

      v_hist := v_hist || jsonb_build_array(v_novo_item);
      v_cf := jsonb_set(v_cf, '{historico_processos}', v_hist, TRUE);
      v_cf := jsonb_set(v_cf, '{historicoProcessos}', v_hist, TRUE);

      UPDATE public.members
      SET
        status = 'inactive',
        custom_fields = v_cf,
        updated_at = v_now
      WHERE id = v_pedido.member_id AND ministry_id = p_ministry_id;
    ELSE
      UPDATE public.members
      SET
        status = 'inactive',
        updated_at = v_now
      WHERE id = v_pedido.member_id AND ministry_id = p_ministry_id;
    END IF;

    RETURN jsonb_build_object(
      'sucesso', TRUE,
      'pedido_id', p_pedido_id,
      'status', 'autorizado',
      'membro_inativado', TRUE,
      'membro_id', v_pedido.member_id,
      'evento_id', v_evento_id
    );
  END IF;

  RETURN jsonb_build_object(
    'sucesso', TRUE,
    'pedido_id', p_pedido_id,
    'status', 'autorizado',
    'membro_inativado', FALSE
  );
END;
$$;

-- Permissões de execução seguras e isoladas
REVOKE ALL ON FUNCTION public.deliberar_carta_presidencia_rpc FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.deliberar_carta_presidencia_rpc TO authenticated, service_role;

COMMENT ON FUNCTION public.deliberar_carta_presidencia_rpc IS
'Deliberação presidencial atômica de pedidos de cartas ministeriais com tipagem nativa timestamptz em data_autorizacao, inativação automática e gravação de histórico.';
