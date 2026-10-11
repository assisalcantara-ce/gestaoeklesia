-- ==============================================================================
-- SCRIPT DE REGULARIZAÇÃO EM LOTE DE MATRÍCULAS - ASSEMBLEIA DE DEUS ANANINDEUA
-- ==============================================================================
-- Tenant ID: '835069e8-4131-4633-b185-aeb4d0450847'
-- Arquivo: docs/sql_regularizacao_matriculas_ananindeua.sql
--
-- CARACTERÍSTICAS TÉCNICAS E DE SEGURANÇA:
-- 1. Execução 100% autossuficiente e atômica em bloco único BEGIN ... COMMIT.
-- 2. Sintaxe SQL padrão estrita:
--    - Atribuição direta por subquery (v_tenant_name := (SELECT name FROM public.ministries ...))
--      eliminando qualquer risco de o parser interpretar 'SELECT ... INTO' como criação de tabela.
-- 3. Rastreamento e pós-validação em memória (ARRAY de UUIDs).
-- 4. Coordenação de concorrência obrigatória com a RPC (Row Lock FOR UPDATE + Advisory Lock).
-- 5. Gravação determinística (created_at ASC, id ASC) e sem sobrescrever dados externos.
-- 6. Pós-validações explícitas de integridade e duplicidades.
-- 7. Consulta final determinística retornando os registros regularizados via variável transacional.
--
-- ATENÇÃO: NÃO EXECUTA AUTOMATICAMENTE. PREPARADO PARA REVISÃO E APLICAÇÃO MANUAL NO SUPABASE.
-- ==============================================================================

BEGIN;

DO $REGULARIZAR$
DECLARE
    c_tenant_id CONSTANT uuid := '835069e8-4131-4633-b185-aeb4d0450847';
    v_tenant_name text;
    v_total_membros integer;
    v_total_pendentes integer;
    v_qtd_nao_numericas integer := 0;
    v_max_matricula_atual integer := 0;
    v_conflitos_faixa integer := 0;
    v_proximo_num integer;
    v_formatted_matricula text;
    v_contador_atualizados integer := 0;
    r_member RECORD;
    v_updated_ids uuid[] := ARRAY[]::uuid[];
    v_pendencias_restantes integer := 0;
    v_duplicidades_faixa integer := 0;
    v_duplicidades_com_existentes integer := 0;
    v_lock_adquirido boolean := false;
BEGIN
    -- -------------------------------------------------------------------------
    -- 1. COORDENAÇÃO OBRIGATÓRIA DE CONCORRÊNCIA COM A RPC (SEM FALLBACK)
    -- -------------------------------------------------------------------------
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'members_sequencias_matricula'
    ) THEN
        RAISE EXCEPTION 'ABORTADO: A tabela public.members_sequencias_matricula não existe. Aplique a migração da RPC antes de executar este script.';
    END IF;

    -- Garante que o registro de sequência do tenant exista
    INSERT INTO public.members_sequencias_matricula (ministry_id, ultima_matricula)
    VALUES (c_tenant_id, 0)
    ON CONFLICT (ministry_id) DO NOTHING;

    -- Bloqueio exclusivo de linha (FOR UPDATE) compartilhado com a RPC
    BEGIN
        PERFORM 1
        FROM public.members_sequencias_matricula
        WHERE ministry_id = c_tenant_id
        FOR UPDATE;
        
        v_lock_adquirido := true;
    EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'ABORTADO: Não foi possível adquirir o bloqueio de linha em public.members_sequencias_matricula para o tenant %. Causa: %', c_tenant_id, SQLERRM;
    END;

    IF NOT v_lock_adquirido THEN
        RAISE EXCEPTION 'ABORTADO: Bloqueio de concorrência com a RPC não foi adquirido.';
    END IF;

    -- Advisory lock transacional no nível de tenant
    PERFORM pg_advisory_xact_lock(hashtext('members_matricula_tenant_' || c_tenant_id::text));

    -- -------------------------------------------------------------------------
    -- 2. PRÉ-VALIDAÇÃO: Existência do Tenant (Atribuição direta por subquery)
    -- -------------------------------------------------------------------------
    v_tenant_name := (
        SELECT name
        FROM public.ministries
        WHERE id = c_tenant_id
    );

    IF v_tenant_name IS NULL THEN
        RAISE EXCEPTION 'ABORTADO: Ministério ID % não encontrado.', c_tenant_id;
    END IF;

    RAISE NOTICE '==================================================================';
    RAISE NOTICE 'INICIANDO REGULARIZAÇÃO ATÔMICA DE MATRÍCULAS: %', v_tenant_name;
    RAISE NOTICE 'Tenant ID: %', c_tenant_id;
    RAISE NOTICE 'Bloqueio de linha FOR UPDATE adquirido com sucesso.';
    RAISE NOTICE '==================================================================';

    -- -------------------------------------------------------------------------
    -- 3. PRÉ-VALIDAÇÃO: Contagem Geral e Identificação de Pendentes
    -- -------------------------------------------------------------------------
    v_total_membros := (
        SELECT COUNT(*)
        FROM public.members
        WHERE ministry_id = c_tenant_id
    );

    v_total_pendentes := (
        SELECT COUNT(*)
        FROM public.members
        WHERE ministry_id = c_tenant_id
          AND (matricula IS NULL OR trim(matricula) = '' OR trim(matricula) = '-')
    );

    RAISE NOTICE 'Total de membros no tenant: %', v_total_membros;
    RAISE NOTICE 'Total de membros sem matrícula identificados: %', v_total_pendentes;

    IF v_total_pendentes = 0 THEN
        RAISE NOTICE 'Nenhum membro sem matrícula pendente neste ministério. Nada a processar.';
        RETURN;
    END IF;

    -- -------------------------------------------------------------------------
    -- 4. PRÉ-VALIDAÇÃO: Auditoria de Formato das Matrículas Preexistentes
    -- -------------------------------------------------------------------------
    v_qtd_nao_numericas := (
        SELECT COUNT(*)
        FROM public.members
        WHERE ministry_id = c_tenant_id
          AND matricula IS NOT NULL
          AND trim(matricula) <> ''
          AND trim(matricula) <> '-'
          AND trim(matricula) !~ '^\d+$'
    );

    IF v_qtd_nao_numericas > 0 THEN
        RAISE NOTICE 'AVISO DE AUDITORIA: % matrícula(s) preexistente(s) não puramente numéricas.', v_qtd_nao_numericas;
    END IF;

    -- -------------------------------------------------------------------------
    -- 5. CÁLCULO ESTRITO DO MAIOR NÚMERO EXISTENTE (Apenas ^\d+$)
    -- -------------------------------------------------------------------------
    v_max_matricula_atual := (
        SELECT COALESCE(MAX(CAST(trim(matricula) AS integer)), 0)
        FROM public.members
        WHERE ministry_id = c_tenant_id
          AND matricula IS NOT NULL
          AND trim(matricula) <> ''
          AND trim(matricula) <> '-'
          AND trim(matricula) ~ '^\d+$'
    );

    RAISE NOTICE 'Maior matrícula numérica válida preexistente: %', v_max_matricula_atual;

    -- -------------------------------------------------------------------------
    -- 6. PRÉ-VALIDAÇÃO: Confirmação de que a Faixa a Atribuir está 100% Livre
    -- -------------------------------------------------------------------------
    v_conflitos_faixa := (
        SELECT COUNT(*)
        FROM public.members
        WHERE ministry_id = c_tenant_id
          AND matricula IS NOT NULL
          AND trim(matricula) ~ '^\d+$'
          AND CAST(trim(matricula) AS integer) BETWEEN (v_max_matricula_atual + 1) AND (v_max_matricula_atual + v_total_pendentes)
    );

    IF v_conflitos_faixa > 0 THEN
        RAISE EXCEPTION 'ABORTADO: Conflito detectado! % registro(s) ocupam números na faixa projetada (% a %).',
            v_conflitos_faixa, (v_max_matricula_atual + 1), (v_max_matricula_atual + v_total_pendentes);
    END IF;

    RAISE NOTICE 'Faixa projetada confirmada como 100%% livre: % até %', 
        lpad((v_max_matricula_atual + 1)::text, 3, '0'), 
        lpad((v_max_matricula_atual + v_total_pendentes)::text, 3, '0');

    -- -------------------------------------------------------------------------
    -- 7. ATRIBUIÇÃO DETERMINÍSTICA E RASTREAMENTO EM MEMÓRIA (ARRAY)
    -- -------------------------------------------------------------------------
    v_proximo_num := v_max_matricula_atual;

    FOR r_member IN
        SELECT id, name, created_at
        FROM public.members
        WHERE ministry_id = c_tenant_id
          AND (matricula IS NULL OR trim(matricula) = '' OR trim(matricula) = '-')
        ORDER BY created_at ASC, id ASC
    LOOP
        v_proximo_num := v_proximo_num + 1;
        v_formatted_matricula := lpad(v_proximo_num::text, 3, '0');

        -- Atualiza garantindo que o registro continua pendente no momento do UPDATE
        UPDATE public.members
        SET matricula = v_formatted_matricula,
            updated_at = timezone('utc'::text, now())
        WHERE id = r_member.id
          AND ministry_id = c_tenant_id
          AND (matricula IS NULL OR trim(matricula) = '' OR trim(matricula) = '-');

        IF NOT FOUND THEN
            RAISE EXCEPTION 'ABORTADO: Membro ID % teve sua matrícula alterada externamente durante a transação.', r_member.id;
        END IF;

        -- Rastreamento em memória (array)
        v_updated_ids := array_append(v_updated_ids, r_member.id);
        v_contador_atualizados := v_contador_atualizados + 1;
    END LOOP;

    -- Confirma se a quantidade atualizada coincide rigorosamente com os pendentes identificados
    IF v_contador_atualizados <> v_total_pendentes THEN
        RAISE EXCEPTION 'ABORTADO: Divergência na contagem! Pendentes iniciais: %, Atualizados: %',
            v_total_pendentes, v_contador_atualizados;
    END IF;

    -- -------------------------------------------------------------------------
    -- 8. SINCRONIZAÇÃO OBRIGATÓRIA DA SEQUÊNCIA DO TENANT
    -- -------------------------------------------------------------------------
    UPDATE public.members_sequencias_matricula
    SET ultima_matricula = GREATEST(ultima_matricula, v_proximo_num),
        updated_at = timezone('utc'::text, now())
    WHERE ministry_id = c_tenant_id;

    -- -------------------------------------------------------------------------
    -- 9. PÓS-VALIDAÇÕES EXPLÍCITAS DE INTEGRIDADE E DUPLICIDADE
    -- -------------------------------------------------------------------------
    -- A) Confirma se ainda restou algum membro pendente no tenant
    v_pendencias_restantes := (
        SELECT COUNT(*)
        FROM public.members
        WHERE ministry_id = c_tenant_id
          AND (matricula IS NULL OR trim(matricula) = '' OR trim(matricula) = '-')
    );

    IF v_pendencias_restantes > 0 THEN
        RAISE EXCEPTION 'ABORTADO: Inconsistência pós-execução! Ainda restam % membros pendentes.', v_pendencias_restantes;
    END IF;

    -- B) Confirma ausência de colisões internas entre as matrículas geradas
    v_duplicidades_faixa := (
        SELECT COUNT(*)
        FROM (
            SELECT matricula
            FROM public.members
            WHERE id = ANY(v_updated_ids)
            GROUP BY matricula
            HAVING COUNT(*) > 1
        ) dup
    );

    IF v_duplicidades_faixa > 0 THEN
        RAISE EXCEPTION 'ABORTADO: Inconsistência pós-execução! Colisão detectada entre as matrículas geradas no lote.';
    END IF;

    -- C) Confirma ausência de duplicidades entre as matrículas geradas e as matrículas preexistentes
    v_duplicidades_com_existentes := (
        SELECT COUNT(*)
        FROM public.members m_outros
        JOIN public.members m_atualizados ON m_atualizados.matricula = m_outros.matricula
        WHERE m_atualizados.id = ANY(v_updated_ids)
          AND m_outros.ministry_id = c_tenant_id
          AND NOT (m_outros.id = ANY(v_updated_ids))
    );

    IF v_duplicidades_com_existentes > 0 THEN
        RAISE EXCEPTION 'ABORTADO: Colisão pós-execução! Uma ou mais matrículas geradas já pertenciam a membros preexistentes do tenant.';
    END IF;

    -- Exporta os IDs processados na sessão transacional para a consulta final
    PERFORM set_config('app.regularizados_ananindeua_ids', array_to_string(v_updated_ids, ','), true);

    RAISE NOTICE '==================================================================';
    RAISE NOTICE 'REGULARIZAÇÃO FINALIZADA COM SUCESSO!';
    RAISE NOTICE 'Membros atualizados: %', v_contador_atualizados;
    RAISE NOTICE 'Faixa definitiva atribuída: % até %', 
        lpad((v_max_matricula_atual + 1)::text, 3, '0'), 
        lpad(v_proximo_num::text, 3, '0');
    RAISE NOTICE 'Pendências restantes no tenant: 0';
    RAISE NOTICE 'Duplicidades com existentes: 0';
    RAISE NOTICE '==================================================================';
END;
$REGULARIZAR$;

-- -----------------------------------------------------------------------------
-- 10. CONSULTA FINAL DETERMINÍSTICA BASEADA NOS IDS REGULARIZADOS NESTA TRANSAÇÃO
-- -----------------------------------------------------------------------------
SELECT 
    ROW_NUMBER() OVER (ORDER BY CAST(trim(m.matricula) AS integer) ASC) AS ordem,
    m.id AS member_id,
    m.matricula,
    m.name,
    m.tipo_cadastro,
    m.status,
    to_char(m.created_at, 'DD/MM/YYYY HH24:MI:SS') AS data_cadastro_original
FROM public.members m
WHERE m.ministry_id = '835069e8-4131-4633-b185-aeb4d0450847'
  AND m.id = ANY(string_to_array(nullif(current_setting('app.regularizados_ananindeua_ids', true), ''), ',')::uuid[])
ORDER BY CAST(trim(m.matricula) AS integer) ASC;

COMMIT;
