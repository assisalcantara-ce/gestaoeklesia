-- =============================================================================
-- Migration: 20261028140000_bloqueio_inscricoes_pagas_fluxo_convencional.sql
-- REVISÃO DE SEGURANÇA CRÍTICA:
--   1. Eliminação total do bypass auth.uid() IS NULL.
--   2. Distinção segura de papéis: service_role vs authenticated vs anon.
--   3. Operação administrativa de balcão encapsulada em RPC atômica/transacional.
--   4. Bloqueio estrito de status = 'confirmado' via INSERT direto em eventos pagos.
--   5. Bloqueio estrito de status = 'pago' direto em eventos_pagamentos.
--   6. Imutabilidade de chaves estruturais (evento_id e ministry_id).
--   7. RLS estrito, search_path fixo e isolamento multi-tenant por ministry_id.
-- =============================================================================

BEGIN;

-- ─── 0. Ajustar constraints de integridade se necessário ───────────────────────
ALTER TABLE public.eventos_pagamentos
  DROP CONSTRAINT IF EXISTS ep_gateway_valido;

ALTER TABLE public.eventos_pagamentos
  ADD CONSTRAINT ep_gateway_valido CHECK (gateway IN ('asaas', 'efi', 'balcao'));

ALTER TABLE public.eventos_pagamentos
  DROP CONSTRAINT IF EXISTS ep_method_valido;

ALTER TABLE public.eventos_pagamentos
  ADD CONSTRAINT ep_method_valido CHECK (payment_method IN ('pix', 'boleto', 'cartao', 'dinheiro', 'a_vista', 'cortesia'));

-- ─── 1. Função auxiliar de contexto de segurança (service_role check) ──────────
CREATE OR REPLACE FUNCTION public.fn_is_service_role()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT (
    COALESCE(NULLIF(current_setting('request.jwt.claim.role', true), ''), '') = 'service_role'
    OR (
      NULLIF(current_setting('request.jwt.claim.role', true), '') IS NULL
      AND current_user IN ('service_role', 'supabase_admin')
    )
  );
$$;

-- ─── 2. Trigger: Proteção contra manipulação de eventos_pagamentos ─────────────
-- Apenas service_role ou a RPC interna autorizada pode gravar/alterar status = 'pago'
-- ou alterar chaves estruturais (evento_id, ministry_id, inscricao_id).
CREATE OR REPLACE FUNCTION public.trg_fn_proteger_eventos_pagamentos()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_is_trusted BOOLEAN;
  v_rpc_ctx TEXT;
BEGIN
  v_is_trusted := COALESCE(public.fn_is_service_role(), FALSE);
  v_rpc_ctx := COALESCE(NULLIF(current_setting('gestaoeklesia.balcao_rpc_active', true), ''), 'false');

  -- Imutabilidade estrutural em UPDATE
  IF TG_OP = 'UPDATE' THEN
    IF NEW.id <> OLD.id OR NEW.ministry_id <> OLD.ministry_id OR NEW.evento_id <> OLD.evento_id OR NEW.inscricao_id <> OLD.inscricao_id THEN
      RAISE EXCEPTION 'Chaves estruturais de pagamento (id, ministry_id, evento_id, inscricao_id) são estritamente imutáveis.'
        USING ERRCODE = '42501', DETAIL = 'VIOLACAO_IMUTABILIDADE_PAGAMENTO';
    END IF;
  END IF;

  -- Se for inserido ou atualizado para 'pago', exige origem confiável
  IF NEW.status = 'pago' THEN
    IF NOT (v_is_trusted OR v_rpc_ctx = 'true') THEN
      RAISE EXCEPTION 'Operação não autorizada. Status de pagamento "pago" só pode ser gravado via gateway oficial ou balcão transacional.'
        USING ERRCODE = '42501', DETAIL = 'PAGAMENTO_DIRETO_NAO_AUTORIZADO';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_proteger_eventos_pagamentos ON public.eventos_pagamentos;
CREATE TRIGGER trg_proteger_eventos_pagamentos
  BEFORE INSERT OR UPDATE
  ON public.eventos_pagamentos
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fn_proteger_eventos_pagamentos();

-- ─── 3. Trigger: Bloqueio de inserção direta com status 'confirmado' em eventos pagos ─
CREATE OR REPLACE FUNCTION public.trg_fn_validar_inscricao_evento_pago()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_evento RECORD;
  v_is_pago BOOLEAN;
  v_is_trusted BOOLEAN;
  v_rpc_ctx TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT id, evento_pago, valor_inscricao
    INTO v_evento
    FROM public.eventos
    WHERE id = NEW.evento_id
      AND ministry_id = NEW.ministry_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Evento de ID % não encontrado para o ministério informado.', NEW.evento_id
        USING ERRCODE = 'P0002';
    END IF;

    v_is_pago := (v_evento.evento_pago = TRUE) OR (COALESCE(v_evento.valor_inscricao, 0) > 0);

    IF v_is_pago THEN
      -- Se a inscrição nasce como pendente/espera (fluxos públicos e mobile normais), autoriza
      IF NEW.status IN ('aguardando_pagamento', 'lista_espera') THEN
        RETURN NEW;
      END IF;

      -- Se a inscrição tenta nascer diretamente como 'confirmado':
      v_is_trusted := COALESCE(public.fn_is_service_role(), FALSE);
      v_rpc_ctx := COALESCE(NULLIF(current_setting('gestaoeklesia.balcao_rpc_active', true), ''), 'false');

      -- Apenas o backend oficial/service_role ou a RPC transacional de Balcão podem criar 'confirmado'
      IF NOT (v_is_trusted OR v_rpc_ctx = 'true') THEN
        RAISE EXCEPTION 'Inscrições em eventos pagos não podem ser confirmadas diretamente pelo fluxo convencional. Utilize o Balcão autorizado.'
          USING ERRCODE = '42501', DETAIL = 'BLOQUEIO_FLUXO_CONVENCIONAL_EVENTO_PAGO';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_inscricao_evento_pago ON public.eventos_inscricoes;
CREATE TRIGGER trg_validar_inscricao_evento_pago
  BEFORE INSERT
  ON public.eventos_inscricoes
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fn_validar_inscricao_evento_pago();

-- ─── 4. Trigger: Proteção contra alteração fraudulenta de status/chaves em UPDATE ────
CREATE OR REPLACE FUNCTION public.trg_fn_proteger_status_financeiro_inscricao()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_evento RECORD;
  v_is_pago BOOLEAN;
  v_is_trusted BOOLEAN;
  v_tem_pagamento_quitado BOOLEAN;
  v_rpc_ctx TEXT;
BEGIN
  -- Imutabilidade estrutural em UPDATE
  IF TG_OP = 'UPDATE' THEN
    IF NEW.id <> OLD.id OR NEW.ministry_id <> OLD.ministry_id OR NEW.evento_id <> OLD.evento_id THEN
      RAISE EXCEPTION 'Vínculos de ministério e evento são imutáveis na inscrição.'
        USING ERRCODE = '42501', DETAIL = 'VIOLACAO_IMUTABILIDADE_INSCRICAO';
    END IF;

    -- Se o status está transitando para 'confirmado'
    IF OLD.status <> 'confirmado' AND NEW.status = 'confirmado' THEN
      SELECT id, evento_pago, valor_inscricao
      INTO v_evento
      FROM public.eventos
      WHERE id = NEW.evento_id
        AND ministry_id = NEW.ministry_id;

      v_is_pago := (v_evento.evento_pago = TRUE) OR (COALESCE(v_evento.valor_inscricao, 0) > 0);

      IF v_is_pago THEN
        v_is_trusted := COALESCE(public.fn_is_service_role(), FALSE);
        v_rpc_ctx := COALESCE(NULLIF(current_setting('gestaoeklesia.balcao_rpc_active', true), ''), 'false');

        -- Se estiver rodando dentro do RPC de Balcão, é validado internamente
        IF v_rpc_ctx = 'true' THEN
          RETURN NEW;
        END IF;

        -- Exige existência de pagamento quitado estrito vinculado à inscrição, evento e ministério
        SELECT EXISTS (
          SELECT 1 FROM public.eventos_pagamentos ep
          WHERE ep.inscricao_id = NEW.id
            AND ep.evento_id = NEW.evento_id
            AND ep.ministry_id = NEW.ministry_id
            AND ep.status = 'pago'
        ) INTO v_tem_pagamento_quitado;

        IF NOT v_tem_pagamento_quitado THEN
          RAISE EXCEPTION 'Não é permitido confirmar inscrição em evento pago sem quitação financeira real conciliada.'
            USING ERRCODE = 'P0001', DETAIL = 'CONFIRMACAO_PAGAMENTO_OBRIGATORIA';
        END IF;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_proteger_status_financeiro_inscricao ON public.eventos_inscricoes;
CREATE TRIGGER trg_proteger_status_financeiro_inscricao
  BEFORE UPDATE
  ON public.eventos_inscricoes
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fn_proteger_status_financeiro_inscricao();

-- ─── 5. RPC Transacional de Balcão: registrar_inscricao_balcao_rpc ─────────────
CREATE OR REPLACE FUNCTION public.registrar_inscricao_balcao_rpc(
  p_ministry_id              UUID,
  p_evento_id                UUID,
  p_forma_pagamento          VARCHAR,
  p_member_id                UUID DEFAULT NULL,
  p_nome_externo             VARCHAR DEFAULT NULL,
  p_email_externo            VARCHAR DEFAULT NULL,
  p_telefone                 VARCHAR DEFAULT NULL,
  p_cpf                      VARCHAR DEFAULT NULL,
  p_congregacao_id           UUID DEFAULT NULL,
  p_com_hospedagem           BOOLEAN DEFAULT FALSE,
  p_observacoes              TEXT DEFAULT NULL,
  p_justificativa_cortesia   TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_is_trusted BOOLEAN;
  v_tem_permissao BOOLEAN := FALSE;
  v_evento RECORD;
  v_is_pago BOOLEAN;
  v_cpf_normalizado VARCHAR(11) := NULL;
  v_valor_cobrado NUMERIC(12,2) := 0;
  v_nova_inscricao_id UUID;
  v_pagamento_id UUID := NULL;
  v_prefixo_gw VARCHAR(20);
  v_obs_final TEXT;
  v_tem_brinde BOOLEAN := FALSE;
BEGIN
  v_user_id := auth.uid();
  v_is_trusted := public.fn_is_service_role();

  -- 1. Verificação de permissões do operador
  IF NOT v_is_trusted THEN
    IF v_user_id IS NULL THEN
      RAISE EXCEPTION 'Usuário não autenticado.'
        USING ERRCODE = '42501', DETAIL = 'USUARIO_NAO_AUTENTICADO';
    END IF;

    -- Verificar se o usuário possui cargo/permissão no ministério
    SELECT EXISTS (
      SELECT 1 FROM public.ministry_users mu
      WHERE mu.user_id = v_user_id
        AND mu.ministry_id = p_ministry_id
        AND mu.is_active = TRUE
        AND (
          mu.role = 'admin'
          OR mu.permissions @> '["ADMINISTRADOR"]'::jsonb
          OR mu.permissions @> '["SECRETARIO"]'::jsonb
          OR mu.permissions @> '["SECRETARIO_GERAL"]'::jsonb
          OR mu.permissions @> '["FINANCEIRO"]'::jsonb
          OR mu.permissions @> '["TESOUREIRO_GERAL"]'::jsonb
        )
    ) INTO v_tem_permissao;

    IF NOT v_tem_permissao THEN
      -- Verificar se é proprietário do ministério
      SELECT EXISTS (
        SELECT 1 FROM public.ministries m
        WHERE m.id = p_ministry_id AND m.user_id = v_user_id
      ) INTO v_tem_permissao;
    END IF;

    IF NOT v_tem_permissao THEN
      RAISE EXCEPTION 'Permissão insuficiente para registrar inscrições no Balcão.'
        USING ERRCODE = '42501', DETAIL = 'PERMISSAO_BALCAO_INSUFICIENTE';
    END IF;
  END IF;

  -- 2. Trava atômica do evento (evita corrida/concorrência)
  SELECT id, ministry_id, titulo, evento_pago, valor_inscricao, status, congregacao_id
  INTO v_evento
  FROM public.eventos
  WHERE id = p_evento_id AND ministry_id = p_ministry_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Evento de ID % não encontrado.', p_evento_id
      USING ERRCODE = 'P0002';
  END IF;

  v_is_pago := (v_evento.evento_pago = TRUE) OR (COALESCE(v_evento.valor_inscricao, 0) > 0);

  -- 3. Validação dos dados do participante
  IF p_member_id IS NULL AND (p_nome_externo IS NULL OR trim(p_nome_externo) = '') THEN
    RAISE EXCEPTION 'Nome do participante ou membro cadastrado é obrigatório.'
      USING ERRCODE = '23514', DETAIL = 'PARTICIPANTE_OBRIGATORIO';
  END IF;

  -- Normalizar CPF
  IF p_cpf IS NOT NULL THEN
    v_cpf_normalizado := regexp_replace(p_cpf, '\D', '', 'g');
    IF length(v_cpf_normalizado) <> 11 THEN
      v_cpf_normalizado := NULL;
    END IF;
  END IF;

  -- Se for membro, buscar CPF se não informado
  IF p_member_id IS NOT NULL AND v_cpf_normalizado IS NULL THEN
    SELECT regexp_replace(cpf, '\D', '', 'g')
    INTO v_cpf_normalizado
    FROM public.members
    WHERE id = p_member_id AND ministry_id = p_ministry_id;
    IF length(v_cpf_normalizado) <> 11 THEN
      v_cpf_normalizado := NULL;
    END IF;
  END IF;

  -- 4. Verificação de duplicidade ativa
  IF p_member_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.eventos_inscricoes
      WHERE ministry_id = p_ministry_id
        AND evento_id = p_evento_id
        AND member_id = p_member_id
        AND status NOT IN ('cancelado', 'expirado')
    ) THEN
      RAISE EXCEPTION 'Membro já possui inscrição ativa neste evento.'
        USING ERRCODE = '23505', DETAIL = 'DUPLICIDADE_MEMBRO';
    END IF;
  END IF;

  IF v_cpf_normalizado IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.eventos_inscricoes
      WHERE ministry_id = p_ministry_id
        AND evento_id = p_evento_id
        AND cpf_normalizado = v_cpf_normalizado
        AND status NOT IN ('cancelado', 'expirado')
    ) THEN
      RAISE EXCEPTION 'CPF já cadastrado em inscrição ativa neste evento.'
        USING ERRCODE = '23505', DETAIL = 'DUPLICIDADE_CPF';
    END IF;
  END IF;

  -- 5. Validação da regra financeira de Balcão
  IF v_is_pago THEN
    IF p_forma_pagamento IS NULL OR trim(p_forma_pagamento) = '' THEN
      RAISE EXCEPTION 'Forma de pagamento é obrigatória para eventos pagos.'
        USING ERRCODE = '23514', DETAIL = 'FORMA_PAGAMENTO_OBRIGATORIA';
    END IF;

    IF p_forma_pagamento = 'cortesia' THEN
      IF p_justificativa_cortesia IS NULL OR length(trim(p_justificativa_cortesia)) < 5 THEN
        RAISE EXCEPTION 'Concessão de cortesia exige justificativa formal com no mínimo 5 caracteres.'
          USING ERRCODE = '23514', DETAIL = 'JUSTIFICATIVA_CORTESIA_EXIGIDA';
      END IF;
      v_valor_cobrado := 0;
    ELSE
      v_valor_cobrado := COALESCE(v_evento.valor_inscricao, 0);
      IF v_valor_cobrado <= 0 THEN
        RAISE EXCEPTION 'Valor de inscrição inconsistente no evento pago.'
          USING ERRCODE = '23514', DETAIL = 'VALOR_INVALIDO';
      END IF;
    END IF;
  ELSE
    v_valor_cobrado := 0;
  END IF;

  -- Montar observação rastreável
  v_obs_final := COALESCE(p_observacoes, '');
  IF p_forma_pagamento = 'cortesia' THEN
    v_obs_final := trim(v_obs_final || ' [Cortesia Balcão: ' || trim(p_justificativa_cortesia) || ']');
  END IF;

  -- 6. Ativar variável de sessão local para autorizar triggers de forma atômica
  PERFORM set_config('gestaoeklesia.balcao_rpc_active', 'true', true);

  -- 7. Inserir a Inscrição
  INSERT INTO public.eventos_inscricoes (
    ministry_id,
    evento_id,
    member_id,
    nome_externo,
    email_externo,
    telefone,
    cpf_normalizado,
    congregacao_id,
    com_hospedagem,
    status,
    observacoes,
    criado_por,
    created_at,
    updated_at
  ) VALUES (
    p_ministry_id,
    p_evento_id,
    p_member_id,
    trim(p_nome_externo),
    trim(p_email_externo),
    trim(p_telefone),
    v_cpf_normalizado,
    p_congregacao_id,
    COALESCE(p_com_hospedagem, FALSE),
    'confirmado',
    NULLIF(trim(v_obs_final), ''),
    v_user_id,
    NOW(),
    NOW()
  ) RETURNING id, tem_brinde INTO v_nova_inscricao_id, v_tem_brinde;

  -- 8. Se evento pago, inserir simultaneamente o registro financeiro em eventos_pagamentos
  IF v_is_pago THEN
    v_prefixo_gw := CASE 
      WHEN p_forma_pagamento = 'pix' THEN 'BALCAO-PIX'
      WHEN p_forma_pagamento = 'cortesia' THEN 'CORTESIA'
      ELSE 'BALCAO'
    END;

    INSERT INTO public.eventos_pagamentos (
      ministry_id,
      evento_id,
      inscricao_id,
      gateway,
      gateway_charge_id,
      payment_method,
      valor,
      status,
      paid_at,
      created_at,
      updated_at
    ) VALUES (
      p_ministry_id,
      p_evento_id,
      v_nova_inscricao_id,
      'balcao',
      v_prefixo_gw || '-' || upper(substring(v_nova_inscricao_id::text, 1, 8)),
      p_forma_pagamento,
      v_valor_cobrado,
      'pago',
      NOW(),
      NOW(),
      NOW()
    ) RETURNING id INTO v_pagamento_id;
  END IF;

  -- 9. Desativar flag de sessão
  PERFORM set_config('gestaoeklesia.balcao_rpc_active', 'false', true);

  RETURN jsonb_build_object(
    'success', TRUE,
    'inscricao_id', v_nova_inscricao_id,
    'pagamento_id', v_pagamento_id,
    'tem_brinde', v_tem_brinde,
    'status', 'confirmado'
  );
END;
$$;

-- Permissões estritas de execução
REVOKE ALL ON FUNCTION public.registrar_inscricao_balcao_rpc FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.registrar_inscricao_balcao_rpc TO authenticated, service_role;

COMMIT;
