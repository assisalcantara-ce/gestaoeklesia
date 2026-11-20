-- ==============================================================================
-- Migration: Criação da tabela member_pre_registrations e RPC de Aprovação Atômica
-- Data: 2026-11-19
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.member_pre_registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
    tipo_solicitacao VARCHAR(30) NOT NULL DEFAULT 'novo_cadastro', -- 'novo_cadastro' ou 'atualizacao'
    existing_member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'pendente', -- 'pendente', 'aprovado', 'rejeitado', 'devolvido'
    
    -- Identificação básica
    name VARCHAR(255) NOT NULL,
    cpf VARCHAR(20) NOT NULL,
    rg VARCHAR(30),
    orgao_emissor VARCHAR(50),
    data_nascimento DATE,
    sexo VARCHAR(30),
    tipo_sanguineo VARCHAR(10),
    escolaridade VARCHAR(100),
    estado_civil VARCHAR(50),
    
    -- Família e Filiação
    nome_pai VARCHAR(255),
    nome_mae VARCHAR(255),
    nome_conjuge VARCHAR(255),
    cpf_conjuge VARCHAR(20),
    data_nascimento_conjuge DATE,
    
    -- Origem
    nacionalidade VARCHAR(100),
    naturalidade VARCHAR(100),
    uf_naturalidade VARCHAR(2),
    
    -- Eclesiástico / Dados Ministeriais sugeridos
    tipo_cadastro VARCHAR(50) DEFAULT 'membro', -- 'membro', 'congregado', 'ministro'
    cargo_ministerial VARCHAR(255),
    data_batismo_aguas DATE,
    
    -- Vínculo Institucional
    congregacao_id UUID REFERENCES public.congregacoes(id) ON DELETE SET NULL,
    campo_id UUID REFERENCES public.campos(id) ON DELETE SET NULL,
    
    -- Endereço
    cep VARCHAR(10),
    logradouro VARCHAR(255),
    numero VARCHAR(20),
    bairro VARCHAR(100),
    complemento VARCHAR(255),
    cidade VARCHAR(100),
    estado VARCHAR(2),
    
    -- Contato
    email VARCHAR(255),
    phone VARCHAR(30),
    celular VARCHAR(30),
    whatsapp VARCHAR(30),
    profissao VARCHAR(255),
    foto_url TEXT,
    
    -- Auditoria e Metadados do Pré-cadastro
    origem VARCHAR(50) NOT NULL DEFAULT 'link_publico',
    motivo_rejeicao TEXT,
    analisado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    analisado_em TIMESTAMPTZ,
    dados_adicionais JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),

    -- Restrições
    CONSTRAINT chk_member_pre_reg_tipo_solicitacao CHECK (tipo_solicitacao IN ('novo_cadastro', 'atualizacao')),
    CONSTRAINT chk_member_pre_reg_status CHECK (status IN ('pendente', 'aprovado', 'rejeitado', 'devolvido'))
);

-- Índices de consulta e isolamento
CREATE INDEX IF NOT EXISTS idx_member_pre_reg_ministry_status 
    ON public.member_pre_registrations(ministry_id, status);

CREATE INDEX IF NOT EXISTS idx_member_pre_reg_ministry_cpf 
    ON public.member_pre_registrations(ministry_id, cpf);

CREATE INDEX IF NOT EXISTS idx_member_pre_reg_existing_member 
    ON public.member_pre_registrations(existing_member_id)
    WHERE existing_member_id IS NOT NULL;

-- RLS (Row Level Security)
ALTER TABLE public.member_pre_registrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for member_pre_registrations"
    ON public.member_pre_registrations
    FOR ALL
    USING (
        ministry_id IN (
            SELECT ministry_id FROM public.ministry_users 
            WHERE user_id = auth.uid()
        )
    )
    WITH CHECK (
        ministry_id IN (
            SELECT ministry_id FROM public.ministry_users 
            WHERE user_id = auth.uid()
        )
    );

-- ==============================================================================
-- FUNÇÃO ATÔMICA TRANSACIONAL: aprovar_member_pre_registration_rpc
-- Garante row lock exclusivo (FOR UPDATE), idempotência contra concorrência e
-- persistência atômica da ficha em members + aprovação do pré-cadastro.
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.aprovar_member_pre_registration_rpc(
    p_pre_reg_id UUID,
    p_ministry_id UUID,
    p_analisado_por UUID,
    p_tipo_cadastro VARCHAR,
    p_cargo_ministerial VARCHAR,
    p_matricula_sugerida VARCHAR DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_calling_user UUID;
    v_has_access BOOLEAN := false;
    v_pre_reg RECORD;
    v_clean_cpf VARCHAR;
    v_member_existente_id UUID;
    v_target_member_id UUID;
    v_matricula_final VARCHAR;
    v_max_members INTEGER := 0;
    v_total_membros INTEGER := 0;
    v_cong_nome VARCHAR := '';
    v_campo_nome VARCHAR := '';
    v_campo_id UUID;
    v_agora TIMESTAMPTZ := TIMEZONE('utc', NOW());
    v_cf JSONB := '{}'::jsonb;
    v_tipo_final VARCHAR;
    v_cargo_final VARCHAR;
BEGIN
    IF p_pre_reg_id IS NULL OR p_ministry_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'code', 'INVALID_PARAMS', 'error', 'IDs são obrigatórios.');
    END IF;

    -- 0. VALIDAÇÃO DE AUTORIZAÇÃO DIRETA NO BANCO (Defesa em Profundidade)
    -- Se chamada com sessão autenticada de usuário (authenticated),
    -- valida se o usuário pertence ao ministério e tem perfil de Secretaria/Admin.
    -- Se chamada com service_role (backend server-side), auth.uid() é nulo e a validação do server prevalece.
    v_calling_user := auth.uid();
    IF v_calling_user IS NOT NULL THEN
        SELECT EXISTS (
            SELECT 1 FROM public.ministries m
            WHERE m.id = p_ministry_id AND m.user_id = v_calling_user
            UNION ALL
            SELECT 1 FROM public.ministry_users mu
            WHERE mu.user_id = v_calling_user
              AND mu.ministry_id = p_ministry_id
              AND COALESCE(mu.is_active, true) = true
              AND (
                mu.role IN ('admin', 'super_admin', 'manager', 'administrador', 'secretario_geral', 'auxiliar_secretaria')
                OR (mu.permissions IS NOT NULL AND (
                  mu.permissions @> '["ADMINISTRADOR"]'::jsonb
                  OR mu.permissions @> '["SECRETARIO_GERAL"]'::jsonb
                  OR mu.permissions @> '["AUXILIAR_SECRETARIA"]'::jsonb
                  OR mu.permissions @> '["SECRETARIA"]'::jsonb
                  OR mu.permissions::text ILIKE '%SECRETARIO_GERAL%'
                  OR mu.permissions::text ILIKE '%AUXILIAR_SECRETARIA%'
                  OR mu.permissions::text ILIKE '%SECRETARIA%'
                ))
              )
        ) INTO v_has_access;

        IF NOT v_has_access THEN
            RETURN jsonb_build_object(
                'success', false,
                'code', 'FORBIDDEN',
                'error', 'Acesso negado: o usuário não possui permissão para aprovar cadastros neste ministério.'
            );
        END IF;
    END IF;

    -- 1. ROW LOCK EXCLUSIVO NA SOLICITAÇÃO (Impede concorrência simultânea)
    SELECT * INTO v_pre_reg
    FROM public.member_pre_registrations
    WHERE id = p_pre_reg_id
      AND ministry_id = p_ministry_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'code', 'NOT_FOUND', 'error', 'Solicitação de pré-cadastro não encontrada.');
    END IF;

    -- 2. VERIFICAÇÃO DE IDEMPOTÊNCIA
    IF v_pre_reg.status = 'aprovado' THEN
        RETURN jsonb_build_object(
            'success', false,
            'code', 'ALREADY_APPROVED',
            'error', 'Esta solicitação já foi aprovada anteriormente e não pode ser reprocessada.',
            'member_id', v_pre_reg.existing_member_id
        );
    END IF;

    v_clean_cpf := regexp_replace(v_pre_reg.cpf, '\D', '', 'g');

    -- Resolver congregação e campo
    IF v_pre_reg.congregacao_id IS NOT NULL THEN
        SELECT c.nome, c.campo_id INTO v_cong_nome, v_campo_id
        FROM public.congregacoes c
        WHERE c.id = v_pre_reg.congregacao_id
          AND c.ministry_id = p_ministry_id;

        IF v_campo_id IS NOT NULL THEN
            SELECT cp.nome INTO v_campo_nome
            FROM public.campos cp
            WHERE cp.id = v_campo_id
              AND cp.ministry_id = p_ministry_id;
        END IF;
    END IF;

    -- CASO A: ATUALIZAÇÃO DE MEMBRO OFICIAL PREEXISTENTE
    v_target_member_id := v_pre_reg.existing_member_id;
    IF v_target_member_id IS NULL AND v_pre_reg.tipo_solicitacao = 'atualizacao' THEN
        SELECT id INTO v_target_member_id
        FROM public.members
        WHERE ministry_id = p_ministry_id
          AND (cpf = v_clean_cpf OR regexp_replace(cpf, '\D', '', 'g') = v_clean_cpf)
        LIMIT 1;
    END IF;

    IF v_pre_reg.tipo_solicitacao = 'atualizacao' AND v_target_member_id IS NOT NULL THEN
        -- Atualizar somente os campos cadastrais revisados na ficha oficial existente
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
            'message', 'Atualização cadastral homologada com sucesso na mesma transação.'
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
        -- Verificar se a matrícula já existe
        IF EXISTS (SELECT 1 FROM public.members WHERE ministry_id = p_ministry_id AND matricula = v_matricula_final) THEN
            v_matricula_final := public.alocar_proxima_matricula_membro(p_ministry_id);
        END IF;
    ELSE
        v_matricula_final := public.alocar_proxima_matricula_membro(p_ministry_id);
    END IF;

    -- Montar custom_fields
    v_cf := jsonb_build_object(
        'supervisao', v_cong_nome,
        'campo', v_campo_nome,
        'congregacao_id', COALESCE(v_pre_reg.congregacao_id::text, '')
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
        'message', 'Novo membro homologado com sucesso na mesma transação atômica.'
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.aprovar_member_pre_registration_rpc FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.aprovar_member_pre_registration_rpc FROM anon;
GRANT EXECUTE ON FUNCTION public.aprovar_member_pre_registration_rpc TO authenticated, service_role;
