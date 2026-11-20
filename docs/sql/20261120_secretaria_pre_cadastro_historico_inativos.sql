-- ==============================================================================
-- ATUALIZAÇÃO SEGURA: SUPORTE AO STATUS 'INATIVO' E HISTÓRICO ATÔMICO
-- Arquivo: docs/sql/20261120_secretaria_pre_cadastro_historico_inativos.sql
-- Módulo: Secretaria -> Central de Pré-Cadastros
-- Destino: Supabase Cloud Oficial (qspueosxkolmwvibhzkt)
-- Data: 2026-11-20
-- ==============================================================================
-- ATENÇÃO: NÃO EXECUTAR DIRETAMENTE. APLICAÇÃO CONDICIONADA À APROVAÇÃO EXPLÍCITA.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. PRÉ-CONDIÇÕES (Validação de Dependências)
-- ------------------------------------------------------------------------------
DO $$
BEGIN
    -- Validar existência da tabela member_pre_registrations
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'member_pre_registrations'
    ) THEN
        RAISE EXCEPTION 'Pré-condição falhou: Tabela public.member_pre_registrations não existe.';
    END IF;

    -- Validar existência da tabela members
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'members'
    ) THEN
        RAISE EXCEPTION 'Pré-condição falhou: Tabela public.members não existe.';
    END IF;

    -- Validar existência da função de alocação de matrícula
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc
        WHERE proname = 'alocar_proxima_matricula_membro'
    ) THEN
        RAISE EXCEPTION 'Pré-condição falhou: Função public.alocar_proxima_matricula_membro não existe.';
    END IF;

    RAISE NOTICE '✓ Pré-condições validadas com sucesso para o SQL aditivo.';
END $$;

-- ------------------------------------------------------------------------------
-- 2. ATUALIZAÇÃO DA CONSTRAINT DE STATUS
-- ------------------------------------------------------------------------------
-- Preserva todos os registros existentes: 'pendente', 'aprovado', 'rejeitado', 'devolvido'
-- e adiciona suporte ao status 'inativo'
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_member_pre_reg_status'
    ) THEN
        ALTER TABLE public.member_pre_registrations
            DROP CONSTRAINT chk_member_pre_reg_status;
    END IF;

    ALTER TABLE public.member_pre_registrations
        ADD CONSTRAINT chk_member_pre_reg_status
        CHECK (status IN ('pendente', 'aprovado', 'inativo', 'rejeitado', 'devolvido'));

    RAISE NOTICE '✓ Constraint chk_member_pre_reg_status atualizada com sucesso para aceitar inativo.';
END $$;

-- ------------------------------------------------------------------------------
-- 3. ATUALIZAÇÃO DA RPC aprovar_member_pre_registration_rpc
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.aprovar_member_pre_registration_rpc(
    p_pre_reg_id UUID,
    p_ministry_id UUID,
    p_analisado_por UUID,
    p_tipo_cadastro VARCHAR DEFAULT 'membro',
    p_cargo_ministerial VARCHAR DEFAULT NULL,
    p_matricula_sugerida VARCHAR DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_pre_reg RECORD;
    v_clean_cpf VARCHAR(14);
    v_target_member_id UUID;
    v_matricula_final VARCHAR(20);
    v_tipo_final VARCHAR(50);
    v_cargo_final VARCHAR(255);
    v_cf JSONB;
    v_cong_nome TEXT;
    v_campo_nome TEXT;
    v_campo_id UUID;
    v_max_members INTEGER := 0;
    v_total_membros INTEGER := 0;
    v_agora TIMESTAMPTZ := clock_timestamp();
    v_evento_historico JSONB;
    v_historico_existente JSONB;
    v_origem_label TEXT;
    v_operador_nome TEXT := 'Secretaria';
BEGIN
    -- 1. Bloqueio exclusivo em linha (SELECT FOR UPDATE)
    SELECT * INTO v_pre_reg
    FROM public.member_pre_registrations
    WHERE id = p_pre_reg_id
      AND ministry_id = p_ministry_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'code', 'NOT_FOUND',
            'error', 'Solicitação de pré-cadastro não encontrada no ministério.'
        );
    END IF;

    IF v_pre_reg.status = 'aprovado' THEN
        RETURN jsonb_build_object(
            'success', false,
            'code', 'ALREADY_APPROVED',
            'error', 'Esta solicitação já foi aprovada anteriormente e não pode ser reprocessada.',
            'member_id', v_pre_reg.existing_member_id
        );
    END IF;

    v_clean_cpf := regexp_replace(v_pre_reg.cpf, '\D', '', 'g');

    -- Determinar rótulo de origem
    IF v_pre_reg.origem = 'app_membro' THEN
        v_origem_label := 'App do Membro';
    ELSE
        v_origem_label := 'Link Público';
    END IF;

    -- Obter nome do operador se disponível
    IF p_analisado_por IS NOT NULL THEN
        SELECT COALESCE(NULLIF(trim(raw_user_meta_data->>'full_name'), ''), email, 'Secretaria')
        INTO v_operador_nome
        FROM auth.users
        WHERE id = p_analisado_por;
    END IF;
    IF v_operador_nome IS NULL THEN
        v_operador_nome := 'Secretaria';
    END IF;

    -- CASO A: APROVAÇÃO DE ATUALIZAÇÃO CADASTRAL
    IF v_pre_reg.tipo_solicitacao = 'atualizacao' THEN
        v_target_member_id := v_pre_reg.existing_member_id;

        IF v_target_member_id IS NULL THEN
            SELECT id INTO v_target_member_id
            FROM public.members
            WHERE ministry_id = p_ministry_id
              AND regexp_replace(cpf, '\D', '', 'g') = v_clean_cpf
            LIMIT 1;
        END IF;

        IF v_target_member_id IS NULL THEN
            RETURN jsonb_build_object(
                'success', false,
                'code', 'TARGET_MEMBER_NOT_FOUND',
                'error', 'Membro oficial para atualização não encontrado no ministério.'
            );
        END IF;

        -- Buscar custom_fields atual para anexar ao histórico
        SELECT COALESCE(custom_fields, '{}'::jsonb) INTO v_cf
        FROM public.members
        WHERE id = v_target_member_id AND ministry_id = p_ministry_id;

        v_historico_existente := COALESCE(v_cf->'historico_processos', '[]'::jsonb);
        IF jsonb_typeof(v_historico_existente) <> 'array' THEN
            v_historico_existente := '[]'::jsonb;
        END IF;

        -- Montar evento de histórico
        v_evento_historico := jsonb_build_object(
            'id', 'pre_reg_' || p_pre_reg_id::text,
            'processo_id', p_pre_reg_id::text,
            'pre_reg_id', p_pre_reg_id::text,
            'tipo_evento', 'atualizacao_cadastral',
            'resultado', 'Atualização cadastral aprovada',
            'origem', 'pre_cadastro',
            'origem_solicitacao', COALESCE(v_pre_reg.origem, 'link_publico'),
            'origem_descricao', v_origem_label,
            'data', to_char(v_agora, 'YYYY-MM-DD'),
            'data_hora', v_agora,
            'data_solicitacao_original', v_pre_reg.created_at,
            'responsavel', v_operador_nome,
            'operador_id', p_analisado_por,
            'status_resultante', 'ativo',
            'descricao', 'Atualização cadastral aprovada pela Secretaria. Origem: ' || v_origem_label || '.'
        );

        v_historico_existente := v_historico_existente || jsonb_build_array(v_evento_historico);
        v_cf := jsonb_set(v_cf, '{historico_processos}', v_historico_existente, true);
        v_cf := jsonb_set(v_cf, '{historicoProcessos}', v_historico_existente, true);

        -- Aplicar dados aprovados
        UPDATE public.members
        SET
            nome_pai = COALESCE(NULLIF(trim(v_pre_reg.nome_pai), ''), nome_pai),
            nome_mae = COALESCE(NULLIF(trim(v_pre_reg.nome_mae), ''), nome_mae),
            rg = COALESCE(NULLIF(trim(v_pre_reg.rg), ''), rg),
            orgao_emissor = COALESCE(NULLIF(trim(v_pre_reg.orgao_emissor), ''), orgao_emissor),
            data_batismo_aguas = COALESCE(v_pre_reg.data_batismo_aguas, data_batismo_aguas),
            email = COALESCE(NULLIF(lower(trim(v_pre_reg.email)), ''), email),
            phone = COALESCE(NULLIF(trim(v_pre_reg.phone), ''), phone),
            celular = COALESCE(NULLIF(trim(v_pre_reg.celular), ''), celular),
            whatsapp = COALESCE(NULLIF(trim(v_pre_reg.whatsapp), ''), whatsapp),
            data_nascimento = COALESCE(v_pre_reg.data_nascimento, data_nascimento),
            sexo = COALESCE(NULLIF(trim(v_pre_reg.sexo), ''), sexo),
            estado_civil = COALESCE(NULLIF(trim(v_pre_reg.estado_civil), ''), estado_civil),
            nome_conjuge = COALESCE(NULLIF(trim(v_pre_reg.nome_conjuge), ''), nome_conjuge),
            cpf_conjuge = COALESCE(NULLIF(trim(v_pre_reg.cpf_conjuge), ''), cpf_conjuge),
            data_nascimento_conjuge = COALESCE(v_pre_reg.data_nascimento_conjuge, data_nascimento_conjuge),
            profissao = COALESCE(NULLIF(trim(v_pre_reg.profissao), ''), profissao),
            cep = COALESCE(NULLIF(trim(v_pre_reg.cep), ''), cep),
            logradouro = COALESCE(NULLIF(trim(v_pre_reg.logradouro), ''), logradouro),
            numero = COALESCE(NULLIF(trim(v_pre_reg.numero), ''), numero),
            bairro = COALESCE(NULLIF(trim(v_pre_reg.bairro), ''), bairro),
            complemento = COALESCE(NULLIF(trim(v_pre_reg.complemento), ''), complemento),
            cidade = COALESCE(NULLIF(trim(v_pre_reg.cidade), ''), cidade),
            estado = COALESCE(NULLIF(trim(v_pre_reg.estado), ''), estado),
            escolaridade = COALESCE(NULLIF(trim(v_pre_reg.escolaridade), ''), escolaridade),
            nacionalidade = COALESCE(NULLIF(trim(v_pre_reg.nacionalidade), ''), nacionalidade),
            naturalidade = COALESCE(NULLIF(trim(v_pre_reg.naturalidade), ''), naturalidade),
            uf_naturalidade = COALESCE(NULLIF(trim(v_pre_reg.uf_naturalidade), ''), uf_naturalidade),
            congregacao_id = COALESCE(v_pre_reg.congregacao_id, congregacao_id),
            foto_url = COALESCE(NULLIF(trim(v_pre_reg.foto_url), ''), foto_url),
            custom_fields = v_cf,
            updated_at = v_agora
        WHERE id = v_target_member_id
          AND ministry_id = p_ministry_id;

        -- Marcar pré-cadastro como aprovado
        UPDATE public.member_pre_registrations
        SET status = 'aprovado',
            existing_member_id = v_target_member_id,
            analisado_por = p_analisado_por,
            analisado_em = v_agora,
            updated_at = v_agora
        WHERE id = p_pre_reg_id;

        RETURN jsonb_build_object(
            'success', true,
            'action', 'atualizacao',
            'member_id', v_target_member_id,
            'message', 'Atualização cadastral homologada com sucesso e histórico registrado.'
        );
    END IF;

    -- CASO B: APROVAÇÃO DE NOVO CADASTRO DE MEMBRO
    -- 1. Verificar limite do plano
    SELECT sp.max_members INTO v_max_members
    FROM public.ministries m
    LEFT JOIN public.subscription_plans sp ON sp.id = m.subscription_plan_id
    WHERE m.id = p_ministry_id;

    IF v_max_members > 0 THEN
        SELECT count(*) INTO v_total_membros
        FROM public.members
        WHERE ministry_id = p_ministry_id;

        IF v_total_membros >= v_max_members THEN
            RETURN jsonb_build_object(
                'success', false,
                'code', 'PLAN_LIMIT_REACHED',
                'error', 'Limite de membros do plano da instituição atingido.'
            );
        END IF;
    END IF;

    -- 2. Resolver tipo e cargo
    v_tipo_final := COALESCE(NULLIF(trim(p_tipo_cadastro), ''), NULLIF(trim(v_pre_reg.tipo_cadastro), ''), 'membro');
    IF v_tipo_final NOT IN ('membro', 'congregado', 'ministro', 'crianca') THEN
        v_tipo_final := 'membro';
    END IF;

    v_cargo_final := NULL;
    IF v_tipo_final = 'ministro' THEN
        v_cargo_final := COALESCE(NULLIF(trim(p_cargo_ministerial), ''), NULLIF(trim(v_pre_reg.cargo_ministerial), ''));
    END IF;

    -- 3. Resolver Matrícula Sequencial Atômica
    IF p_matricula_sugerida IS NOT NULL AND trim(p_matricula_sugerida) <> '' THEN
        v_matricula_final := LPAD(regexp_replace(p_matricula_sugerida, '\D', '', 'g'), 3, '0');
        IF EXISTS (SELECT 1 FROM public.members WHERE ministry_id = p_ministry_id AND matricula = v_matricula_final) THEN
            v_matricula_final := public.alocar_proxima_matricula_membro(p_ministry_id);
        END IF;
    ELSE
        v_matricula_final := public.alocar_proxima_matricula_membro(p_ministry_id);
    END IF;

    -- Obter nomes de congregação e campo
    IF v_pre_reg.congregacao_id IS NOT NULL THEN
        SELECT nome, campo_id INTO v_cong_nome, v_campo_id
        FROM public.congregacoes
        WHERE id = v_pre_reg.congregacao_id;
    END IF;

    IF v_pre_reg.campo_id IS NOT NULL THEN
        v_campo_id := v_pre_reg.campo_id;
    END IF;

    IF v_campo_id IS NOT NULL THEN
        SELECT nome INTO v_campo_nome
        FROM public.campos
        WHERE id = v_campo_id;
    END IF;

    -- Evento inicial de histórico permanente do membro
    v_evento_historico := jsonb_build_object(
        'id', 'pre_reg_' || p_pre_reg_id::text,
        'processo_id', p_pre_reg_id::text,
        'pre_reg_id', p_pre_reg_id::text,
        'tipo_evento', 'cadastro_efetivado',
        'resultado', 'Cadastro efetivado pela Secretaria',
        'origem', 'pre_cadastro',
        'origem_solicitacao', COALESCE(v_pre_reg.origem, 'link_publico'),
        'origem_descricao', v_origem_label,
        'data', to_char(v_agora, 'YYYY-MM-DD'),
        'data_hora', v_agora,
        'data_solicitacao_original', v_pre_reg.created_at,
        'responsavel', v_operador_nome,
        'operador_id', p_analisado_por,
        'classificacao_aprovada', v_tipo_final,
        'cargo_ministerial', v_cargo_final,
        'matricula', v_matricula_final,
        'status_resultante', 'ativo',
        'descricao', 'Cadastro efetivado pela Secretaria. Origem: ' || v_origem_label || '. Classificação: ' || v_tipo_final || '. Matrícula: ' || v_matricula_final || '.'
    );

    -- Montar custom_fields com histórico permanente
    v_cf := jsonb_build_object(
        'supervisao', v_cong_nome,
        'campo', v_campo_nome,
        'congregacao_id', COALESCE(v_pre_reg.congregacao_id::text, ''),
        'historico_processos', jsonb_build_array(v_evento_historico),
        'historicoProcessos', jsonb_build_array(v_evento_historico)
    );
    IF v_campo_id IS NOT NULL THEN
        v_cf := v_cf || jsonb_build_object('campo_id', v_campo_id::text);
    END IF;

    -- 4. Inserir em members
    INSERT INTO public.members (
        ministry_id,
        congregacao_id,
        custom_fields,
        matricula,
        name,
        cpf,
        nome_pai,
        nome_mae,
        rg,
        orgao_emissor,
        data_batismo_aguas,
        email,
        phone,
        celular,
        whatsapp,
        data_nascimento,
        sexo,
        estado_civil,
        nome_conjuge,
        cpf_conjuge,
        data_nascimento_conjuge,
        profissao,
        cep,
        logradouro,
        numero,
        bairro,
        complemento,
        cidade,
        estado,
        escolaridade,
        nacionalidade,
        naturalidade,
        uf_naturalidade,
        foto_url,
        tipo_cadastro,
        role,
        cargo_ministerial,
        status,
        member_since
    ) VALUES (
        p_ministry_id,
        v_pre_reg.congregacao_id,
        v_cf,
        v_matricula_final,
        v_pre_reg.name,
        v_clean_cpf,
        NULLIF(trim(v_pre_reg.nome_pai), ''),
        NULLIF(trim(v_pre_reg.nome_mae), ''),
        NULLIF(trim(v_pre_reg.rg), ''),
        NULLIF(trim(v_pre_reg.orgao_emissor), ''),
        v_pre_reg.data_batismo_aguas,
        NULLIF(lower(trim(v_pre_reg.email)), ''),
        NULLIF(trim(v_pre_reg.phone), ''),
        NULLIF(trim(v_pre_reg.celular), ''),
        NULLIF(trim(v_pre_reg.whatsapp), ''),
        v_pre_reg.data_nascimento,
        NULLIF(trim(v_pre_reg.sexo), ''),
        NULLIF(trim(v_pre_reg.estado_civil), ''),
        NULLIF(trim(v_pre_reg.nome_conjuge), ''),
        NULLIF(trim(v_pre_reg.cpf_conjuge), ''),
        v_pre_reg.data_nascimento_conjuge,
        NULLIF(trim(v_pre_reg.profissao), ''),
        NULLIF(trim(v_pre_reg.cep), ''),
        NULLIF(trim(v_pre_reg.logradouro), ''),
        NULLIF(trim(v_pre_reg.numero), ''),
        NULLIF(trim(v_pre_reg.bairro), ''),
        NULLIF(trim(v_pre_reg.complemento), ''),
        NULLIF(trim(v_pre_reg.cidade), ''),
        NULLIF(trim(v_pre_reg.estado), ''),
        NULLIF(trim(v_pre_reg.escolaridade), ''),
        NULLIF(trim(v_pre_reg.nacionalidade), ''),
        NULLIF(trim(v_pre_reg.naturalidade), ''),
        NULLIF(trim(v_pre_reg.uf_naturalidade), ''),
        NULLIF(trim(v_pre_reg.foto_url), ''),
        v_tipo_final,
        v_tipo_final,
        v_cargo_final,
        'active',
        CURRENT_DATE
    )
    RETURNING id INTO v_target_member_id;

    -- 5. Marcar pré-cadastro como aprovado
    UPDATE public.member_pre_registrations
    SET status = 'aprovado',
        existing_member_id = v_target_member_id,
        analisado_por = p_analisado_por,
        analisado_em = v_agora,
        updated_at = v_agora
    WHERE id = p_pre_reg_id;

    RETURN jsonb_build_object(
        'success', true,
        'action', 'novo_cadastro',
        'member_id', v_target_member_id,
        'matricula', v_matricula_final,
        'message', 'Novo membro homologado com sucesso e histórico permanente registrado.'
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.aprovar_member_pre_registration_rpc FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.aprovar_member_pre_registration_rpc FROM anon;
GRANT EXECUTE ON FUNCTION public.aprovar_member_pre_registration_rpc TO authenticated, service_role;

COMMIT;
