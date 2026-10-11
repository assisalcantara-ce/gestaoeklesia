-- ==============================================================================
-- PROPOSTA DE SCRIPT SQL PARA REGULARIZAÇÃO EM LOTE DE MATRÍCULAS PENDENTES
-- ATENÇÃO: ESTE ARQUIVO É APENAS PARA REVISÃO. NÃO EXECUTA AUTOMATICAMENTE.
-- ==============================================================================
--
-- Regras aplicadas:
-- 1. Itera apenas sobre membros cujo campo 'matricula' está nulo ou vazio.
-- 2. Ordena pela data de criação original (created_at ASC) para manter a cronologia.
-- 3. Inicia a contagem a partir de (MAIOR_MATRICULA_ATUAL + 1) de cada ministério.
-- 4. Formata com lpad para manter no mínimo 3 dígitos (ex: '001', '501', etc.).
-- 5. Não altera nenhum membro que já possua matrícula definida.
--
-- ==============================================================================

DO $$
DECLARE
    r_ministry RECORD;
    r_member RECORD;
    v_current_max integer;
    v_next_num integer;
    v_formatted_matricula text;
BEGIN
    -- Itera sobre cada ministério que possui membros pendentes
    FOR r_ministry IN 
        SELECT DISTINCT m.ministry_id, min.name AS ministry_name
        FROM public.members m
        JOIN public.ministries min ON min.id = m.ministry_id
        WHERE m.matricula IS NULL OR trim(m.matricula) = ''
    LOOP
        -- 1. Localiza a maior matrícula numérica atual do ministério
        SELECT COALESCE(MAX(CAST(NULLIF(regexp_replace(matricula, '\D', '', 'g'), '') AS integer)), 0)
        INTO v_current_max
        FROM public.members
        WHERE ministry_id = r_ministry.ministry_id;

        v_next_num := v_current_max;

        RAISE NOTICE 'Processando Ministério: % (ID: %). Maior matrícula atual: %', 
            r_ministry.ministry_name, r_ministry.ministry_id, v_current_max;

        -- 2. Atualiza os membros pendentes na ordem cronológica de cadastro
        FOR r_member IN
            SELECT id, name, created_at
            FROM public.members
            WHERE ministry_id = r_ministry.ministry_id
              AND (matricula IS NULL OR trim(matricula) = '')
            ORDER BY created_at ASC
        LOOP
            v_next_num := v_next_num + 1;
            v_formatted_matricula := lpad(v_next_num::text, 3, '0');

            UPDATE public.members
            SET matricula = v_formatted_matricula
            WHERE id = r_member.id;

            RAISE NOTICE '  -> Membro: % (ID: %) regularizado com matrícula: %', 
                r_member.name, r_member.id, v_formatted_matricula;
        END LOOP;
    END LOOP;
END;
$$;
