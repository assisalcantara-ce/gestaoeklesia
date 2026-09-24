-- ============================================================================
-- Migration: 20260924160000_create_homologar_processo_consagracao_rpc.sql
-- Descrição: Cria a função RPC homologar_processo_consagracao com atomicidade
--            transacional ACID nativa no PostgreSQL, validação multi-tenant,
--            bloqueio de linha (FOR UPDATE), idempotência consistente e
--            sincronização de cargo_ministerial, data_consagracao e dados_cargos.
--
-- Versão: 2 (revisada pós-auditoria técnica 2026-09-24)
-- Alterações:
--   [1] auth.uid() exigido incondicionalmente — chamadas sem sessão são rejeitadas.
--   [2] REVOKE EXECUTE de service_role — acesso restrito a authenticated.
--   [3] Idempotência consistente — retorna ERRO controlado (não sucesso) se processo
--       já está homologado mas dados ministeriais estão divergentes; nunca reprocessa.
--   [4] data_autorizacao e data_processo confirmados como DATE nativo — sem risco de
--       cast de string. COALESCE mantém precedência sem substituição silenciosa.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.homologar_processo_consagracao(
    p_process_id UUID,
    p_ministry_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_user_id         UUID;
    v_has_access      BOOLEAN;
    v_processo        RECORD;
    v_member          RECORD;
    v_tipo_registro   TEXT;
    v_is_progressao   BOOLEAN;
    v_cargo_novo      TEXT;
    v_data_efetiva    DATE;
    v_current_dados_cargos   JSONB;
    v_existing_cargo_data    JSONB;
    v_next_dados_cargos      JSONB;
    v_current_custom_fields  JSONB;
    v_next_custom_fields     JSONB;
    v_now_iso         TEXT;
    v_existing_data_consagracao TEXT;
BEGIN
    -- =========================================================================
    -- 1. Validar parâmetros de entrada
    -- =========================================================================
    IF p_process_id IS NULL OR p_ministry_id IS NULL THEN
        RAISE EXCEPTION 'Parâmetros inválidos: p_process_id e p_ministry_id são obrigatórios.';
    END IF;

    -- =========================================================================
    -- 2. Autenticação obrigatória — auth.uid() NUNCA pode ser NULL
    --    Correção auditoria [1]: validação incondicional, sem brecha para service_role.
    -- =========================================================================
    v_user_id := auth.uid();

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Autenticação necessária: esta operação requer uma sessão de usuário válida.';
    END IF;

    SELECT (
        EXISTS (
            SELECT 1 FROM public.ministry_users mu
            WHERE mu.user_id = v_user_id
              AND mu.ministry_id = p_ministry_id
        )
        OR EXISTS (
            SELECT 1 FROM public.ministries m
            WHERE m.id = p_ministry_id
              AND m.user_id = v_user_id
        )
    ) INTO v_has_access;

    IF NOT v_has_access THEN
        RAISE EXCEPTION 'Acesso negado: usuário não possui permissão para homologar processos neste ministério.';
    END IF;

    -- =========================================================================
    -- 3. Obter e bloquear o registro do processo (FOR UPDATE serializa chamadas
    --    concorrentes para o mesmo processo — sem deadlock possível aqui)
    -- =========================================================================
    SELECT * INTO v_processo
    FROM public.consagracao_registros
    WHERE id = p_process_id
      AND ministry_id = p_ministry_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Processo de consagração não encontrado para o ministério informado.';
    END IF;

    v_tipo_registro := LOWER(COALESCE(v_processo.tipo_registro, ''));
    v_is_progressao := (
        v_tipo_registro = 'progressao' OR
        v_tipo_registro = 'existente'  OR
        v_tipo_registro = 'ministro'
    );

    -- =========================================================================
    -- 4. Idempotência consistente
    --    Correção auditoria [3]: processos já homologados são verificados quanto
    --    à consistência com o cadastro ministerial. Se houver divergência,
    --    retorna ERRO controlado — nunca reprocessa nem mascara inconsistências.
    -- =========================================================================
    IF v_processo.status_processo = 'homologar' THEN
        IF v_is_progressao AND v_processo.member_id IS NOT NULL THEN
            -- Verificar se o cadastro ministerial está consistente
            SELECT cargo_ministerial INTO v_member
            FROM public.members
            WHERE id = v_processo.member_id
              AND ministry_id = p_ministry_id;

            IF NOT FOUND THEN
                RETURN jsonb_build_object(
                    'success', false,
                    'already_homologado', true,
                    'divergencia', true,
                    'message', 'Processo já homologado, mas ministro vinculado não encontrado no cadastro. Verifique a integridade dos dados.'
                );
            END IF;

            -- cargo_ministerial esperado: UPPER(TRIM(cargo_pretendido))
            IF UPPER(TRIM(COALESCE(v_processo.cargo_pretendido, ''))) <> UPPER(TRIM(COALESCE(v_member.cargo_ministerial, ''))) THEN
                RETURN jsonb_build_object(
                    'success', false,
                    'already_homologado', true,
                    'divergencia', true,
                    'message', 'Processo já marcado como homologado, mas cargo ministerial do ministro diverge do cargo pretendido no processo. Revise manualmente os dados antes de prosseguir.'
                );
            END IF;
        END IF;

        -- Processo homologado e consistente (ou não-progressão): retorno seguro
        RETURN jsonb_build_object(
            'success', true,
            'already_homologado', true,
            'divergencia', false,
            'message', 'Processo já se encontra homologado.',
            'status', 'homologar',
            'process_id', v_processo.id,
            'member_id', v_processo.member_id
        );
    END IF;

    -- =========================================================================
    -- 5. Timestamp ISO para metadados de auditoria
    -- =========================================================================
    v_now_iso := to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');

    -- =========================================================================
    -- 6. Tratamento de Progressão Ministerial
    -- =========================================================================
    IF v_is_progressao THEN
        IF v_processo.member_id IS NULL THEN
            RAISE EXCEPTION 'Não é possível homologar: processo de progressão sem ministro vinculado.';
        END IF;

        IF v_processo.cargo_pretendido IS NULL OR TRIM(v_processo.cargo_pretendido) = '' THEN
            RAISE EXCEPTION 'Não é possível homologar: cargo pretendido não informado no processo.';
        END IF;

        -- Bloquear o registro do ministro (FOR UPDATE — serializa edições concorrentes)
        SELECT * INTO v_member
        FROM public.members
        WHERE id = v_processo.member_id
          AND ministry_id = p_ministry_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Ministro vinculado não encontrado no ministério atual.';
        END IF;

        v_cargo_novo := UPPER(TRIM(v_processo.cargo_pretendido));

        -- Determinar data efetiva
        -- data_autorizacao e data_processo são colunas DATE nativas na tabela.
        -- Precedência: data_autorizacao > data_processo > CURRENT_DATE (sem cast inseguro).
        -- Correção auditoria [4]: confirmado tipo DATE, COALESCE direto e seguro.
        v_data_efetiva := COALESCE(
            v_processo.data_autorizacao,
            v_processo.data_processo,
            CURRENT_DATE
        );

        -- Preparar dados_cargos preservando todos os marcos históricos anteriores
        v_current_dados_cargos := COALESCE(v_member.dados_cargos, '{}'::JSONB);
        IF jsonb_typeof(v_current_dados_cargos) <> 'object' THEN
            v_current_dados_cargos := '{}'::JSONB;
        END IF;

        v_existing_cargo_data := COALESCE(v_current_dados_cargos->v_cargo_novo, '{}'::JSONB);
        IF jsonb_typeof(v_existing_cargo_data) <> 'object' THEN
            v_existing_cargo_data := '{}'::JSONB;
        END IF;

        -- Preserva data histórica existente no cargo; usa v_data_efetiva somente se ausente
        v_existing_data_consagracao := v_existing_cargo_data->>'dataConsagracaoRecebimento';
        IF v_existing_data_consagracao IS NULL OR TRIM(v_existing_data_consagracao) = '' THEN
            v_existing_data_consagracao := to_char(v_data_efetiva, 'YYYY-MM-DD');
        END IF;

        v_next_dados_cargos := jsonb_set(
            v_current_dados_cargos,
            ARRAY[v_cargo_novo],
            jsonb_build_object(
                'dataConsagracaoRecebimento', v_existing_data_consagracao,
                'localConsagracao', COALESCE(v_existing_cargo_data->>'localConsagracao', ''),
                'localOrigem',     COALESCE(v_existing_cargo_data->>'localOrigem', '')
            ),
            true  -- cria a chave se não existir
        );

        -- Preparar custom_fields preservando todos os campos de outros módulos
        v_current_custom_fields := COALESCE(v_member.custom_fields, '{}'::JSONB);
        IF jsonb_typeof(v_current_custom_fields) <> 'object' THEN
            v_current_custom_fields := '{}'::JSONB;
        END IF;

        v_next_custom_fields := v_current_custom_fields || jsonb_build_object(
            'consagracaoStatus',           NULL,
            'consagracaoCargoPretendido',  NULL,
            'consagracaoCargoOcupado',     NULL,
            'consagracaoAtualizadoEm',     v_now_iso,
            'ultimoProcessoHomologadoId',  v_processo.id,
            'ultimoProcessoHomologadoData', v_now_iso
        );

        -- Atualizar membro — dentro da mesma transação
        UPDATE public.members
        SET cargo_ministerial = v_cargo_novo,
            data_consagracao  = v_data_efetiva,
            dados_cargos      = v_next_dados_cargos,
            custom_fields     = v_next_custom_fields,
            updated_at        = NOW()
        WHERE id             = v_member.id
          AND ministry_id    = p_ministry_id;

    END IF;

    -- =========================================================================
    -- 7. Marcar processo como homologado — última operação da transação
    -- =========================================================================
    UPDATE public.consagracao_registros
    SET status_processo = 'homologar',
        updated_at      = NOW()
    WHERE id          = v_processo.id
      AND ministry_id = p_ministry_id;

    RETURN jsonb_build_object(
        'success',         true,
        'already_homologado', false,
        'divergencia',     false,
        'message',         'Processo homologado e cadastro ministerial sincronizado com sucesso.',
        'status',          'homologar',
        'process_id',      v_processo.id,
        'member_id',       v_processo.member_id
    );
END;
$$;

-- ============================================================================
-- Privilégios de execução
-- Correção auditoria [2]: service_role removido — acesso restrito a authenticated.
-- Qualquer processo administrativo interno que necessite desta RPC deve ser
-- realizado via sessão autenticada de usuário com acesso ao ministério.
-- ============================================================================
REVOKE ALL ON FUNCTION public.homologar_processo_consagracao(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.homologar_processo_consagracao(UUID, UUID) FROM service_role;
GRANT EXECUTE ON FUNCTION public.homologar_processo_consagracao(UUID, UUID) TO authenticated;

COMMENT ON FUNCTION public.homologar_processo_consagracao(UUID, UUID) IS
'Versão 2. Homologa atomicamente um processo de consagração e sincroniza cargo, data e histórico em public.members (somente para progressões). Exige auth.uid() válido. Retorna erro controlado se processo já homologado apresentar divergência no cadastro ministerial.';
