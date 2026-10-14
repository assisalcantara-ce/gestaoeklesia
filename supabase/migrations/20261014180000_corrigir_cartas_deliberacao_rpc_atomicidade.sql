-- ==============================================================================
-- Migração: Correção de Schema, Atomicidade Transacional e Segurança em Cartas
-- Arquivo: 20261014180000_corrigir_cartas_deliberacao_rpc_atomicidade.sql
-- NOTA: Preparada para aplicação manual sem alterar migrations anteriores.
-- ==============================================================================

-- 1. CORREÇÃO DA FUNÇÃO public.registrar_evento_historico_membro
-- Remove referências à coluna inexistente is_active e normaliza status para 'active'/'inactive'.
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
SET search_path = public, auth
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
  v_status_normalizado TEXT := NULL;
BEGIN
  -- 1. Validação de autenticação básica
  IF auth.uid() IS NULL AND p_usuario_id IS NULL THEN
    RAISE EXCEPTION 'Acesso negado: Usuário não autenticado.';
  END IF;

  -- 2. Normalização do status compatível com a tabela members ('active' / 'inactive')
  IF p_novo_status_membro IS NOT NULL THEN
    IF LOWER(p_novo_status_membro) IN ('inativo', 'inactive') THEN
      v_status_normalizado := 'inactive';
    ELSIF LOWER(p_novo_status_membro) IN ('ativo', 'active') THEN
      v_status_normalizado := 'active';
    ELSE
      v_status_normalizado := p_novo_status_membro;
    END IF;
  END IF;

  -- 3. Validação de existência e lock pessimista no membro (isolamento por tenant)
  SELECT id, status, custom_fields
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

  -- 4. Verificação de idempotência estrita
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
    -- Se já registrado, apenas garante que o status está alinhado caso solicitado
    IF v_status_normalizado IS NOT NULL AND v_member.status IS DISTINCT FROM v_status_normalizado THEN
      UPDATE public.members
      SET
        status = v_status_normalizado,
        updated_at = v_now_iso
      WHERE id = p_member_id AND ministry_id = p_ministry_id;
    END IF;

    RETURN jsonb_build_object(
      'sucesso', TRUE,
      'evento_id', p_evento_id,
      'ja_registrado', TRUE
    );
  END IF;

  -- 5. Estruturação do evento histórico
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
    'status_resultante', COALESCE(v_status_normalizado, v_member.status),
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

  IF v_status_normalizado IS NOT NULL THEN
    UPDATE public.members
    SET
      status = v_status_normalizado,
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

-- Restrição de permissões da RPC registrar_evento_historico_membro
REVOKE ALL ON FUNCTION public.registrar_evento_historico_membro FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_evento_historico_membro TO authenticated, service_role;

COMMENT ON FUNCTION public.registrar_evento_historico_membro IS
'Registra eventos no histórico do membro sem referenciar is_active e com isolamento multi-tenant.';


-- 2. NOVA RPC TRANSACIONAL: public.deliberar_carta_presidencia_rpc
-- Executa a deliberação, inativação e histórico em uma única transação atômica do PostgreSQL.
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
      data_autorizacao = v_now_iso
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
    data_autorizacao = v_now_iso
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
        updated_at = v_now_iso
      WHERE id = v_pedido.member_id AND ministry_id = p_ministry_id;
    ELSE
      UPDATE public.members
      SET
        status = 'inactive',
        updated_at = v_now_iso
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

-- Restrição de permissões da RPC deliberar_carta_presidencia_rpc
REVOKE ALL ON FUNCTION public.deliberar_carta_presidencia_rpc FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.deliberar_carta_presidencia_rpc TO authenticated, service_role;

COMMENT ON FUNCTION public.deliberar_carta_presidencia_rpc IS
'Deliberação presidencial atômica de pedidos de cartas ministeriais com inativação automática e gravação de histórico.';
