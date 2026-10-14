-- ==============================================================================
-- GESTÃO EKLÉSIA — MÓDULO DIRIGENTES (HISTÓRICO MINISTERIAL E EFETIVAÇÃO ATÔMICA)
-- Arquivo: supabase/migrations/20261014120000_dirigentes_historico_ministerial_efetivacao.sql
--
-- Descrição:
-- 1. Função RPC transacional para efetivação atômica de movimentação de dirigentes,
--    garantindo encerramento de mandato, posse da nova liderança, atualização de congregação,
--    e gravação obrigatória dos eventos no histórico ministerial individual de ambos os
--    obreiros (saída e posse) com rollback integral e idempotência estrita.
-- 2. Função RPC segura para busca de ministros elegíveis (apenas perfil de ministro ativo,
--    com isolamento multi-tenant).
--
-- Aplicação:
-- Manual via SQL Editor do Supabase Dashboard (não executar automaticamente).
-- ==============================================================================

BEGIN;

-- 1. FUNÇÃO: Buscar ministros elegíveis para assumir liderança congregacional
CREATE OR REPLACE FUNCTION public.buscar_ministros_elegiveis_dirigente(
  p_ministry_id UUID,
  p_termo TEXT,
  p_limite INT DEFAULT 15
)
RETURNS TABLE (
  id UUID,
  nome VARCHAR(255),
  matricula VARCHAR(50),
  cpf VARCHAR(20),
  cargo_ministerial VARCHAR(255),
  congregacao_id UUID,
  congregacao_nome VARCHAR(255),
  foto_url TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_termo_sanitizado TEXT;
BEGIN
  -- 1. Validar permissão multi-tenant
  IF NOT public.dirigentes_belongs_to_ministry(p_ministry_id) THEN
    RAISE EXCEPTION 'Acesso negado: Usuário não pertence ao ministério informado.';
  END IF;

  -- 2. Validar tamanho mínimo de 3 caracteres
  v_termo_sanitizado := trim(p_termo);
  IF length(v_termo_sanitizado) < 3 THEN
    RETURN;
  END IF;

  -- 3. Retornar somente pessoas com perfil ministerial de ministro ativo
  RETURN QUERY
  SELECT
    m.id,
    m.name AS nome,
    m.matricula,
    m.cpf,
    COALESCE(m.cargo_ministerial, 'Ministro') AS cargo_ministerial,
    m.congregacao_id,
    c.nome AS congregacao_nome,
    m.foto_url
  FROM public.members m
  LEFT JOIN public.congregacoes c ON c.id = m.congregacao_id AND c.ministry_id = p_ministry_id
  WHERE m.ministry_id = p_ministry_id
    AND m.status IN ('active', 'ativo')
    AND (m.role = 'ministro' OR m.tipo_cadastro = 'ministro')
    AND (m.role NOT IN ('membro', 'congregado', 'crianca', 'visitante') OR m.role IS NULL)
    AND (m.tipo_cadastro NOT IN ('membro', 'congregado', 'crianca', 'visitante') OR m.tipo_cadastro IS NULL)
    AND (
      m.name ILIKE '%' || v_termo_sanitizado || '%'
      OR m.matricula ILIKE '%' || v_termo_sanitizado || '%'
      OR m.cpf ILIKE '%' || v_termo_sanitizado || '%'
    )
  ORDER BY m.name ASC
  LIMIT LEAST(p_limite, 50);
END;
$$;

COMMENT ON FUNCTION public.buscar_ministros_elegiveis_dirigente(UUID, TEXT, INT) IS
'Retorna ministros elegíveis para liderança de congregação, com isolamento multi-tenant estrito.';

REVOKE EXECUTE ON FUNCTION public.buscar_ministros_elegiveis_dirigente(UUID, TEXT, INT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.buscar_ministros_elegiveis_dirigente(UUID, TEXT, INT) FROM anon;
GRANT EXECUTE ON FUNCTION public.buscar_ministros_elegiveis_dirigente(UUID, TEXT, INT) TO authenticated, service_role;


-- 2. FUNÇÃO RPC: Efetivação atômica de movimentação de dirigente e gravação no histórico ministerial
CREATE OR REPLACE FUNCTION public.efetivar_movimentacao_dirigente(
  p_ministry_id UUID,
  p_movimentacao_id UUID,
  p_user_id UUID,
  p_user_name TEXT,
  p_data_efetiva DATE DEFAULT CURRENT_DATE,
  p_divergencias TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_mov RECORD;
  v_cong_nome VARCHAR(255);
  v_obreiro_saindo_id UUID;
  v_obreiro_saindo_nome VARCHAR(255);
  v_obreiro_saindo_cargo VARCHAR(255);
  v_nova_desig_id UUID;
  v_is_acumulacao BOOLEAN := false;
  v_data_hora_real TIMESTAMPTZ := NOW();
  v_termo_valido BOOLEAN := false;
  v_hist_saida_item JSONB;
  v_hist_posse_item JSONB;
  v_cf_saindo JSONB;
  v_cf_novo JSONB;
BEGIN
  -- 1. Validar autorização: Presidência ou Admin
  IF NOT (public.dirigentes_is_admin_or_presidencia(p_ministry_id)) THEN
    RAISE EXCEPTION 'Acesso negado: Somente a Presidência ou Administrador podem efetivar movimentações de liderança.';
  END IF;

  -- 2. Carregar e bloquear a movimentação para controle de concorrência
  SELECT * INTO v_mov
  FROM public.dirigentes_movimentacoes
  WHERE id = p_movimentacao_id AND ministry_id = p_ministry_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Movimentação não encontrada ou pertencente a outro ministério.';
  END IF;

  -- Buscar nome da congregação destino
  SELECT nome INTO v_cong_nome
  FROM public.congregacoes
  WHERE id = v_mov.congregacao_destino_id AND ministry_id = p_ministry_id;

  IF v_cong_nome IS NULL THEN
    v_cong_nome := 'Congregação';
  END IF;

  -- 3. Validação de estado e idempotência da movimentação
  IF v_mov.status = 'efetivada' THEN
    -- Recupera a designação já gerada para essa movimentação (idempotência)
    SELECT id INTO v_nova_desig_id
    FROM public.dirigentes_designacoes
    WHERE ministry_id = p_ministry_id
      AND movimentacao_origem_id = v_mov.id
    ORDER BY created_at DESC
    LIMIT 1;

    RETURN jsonb_build_object(
      'sucesso', true,
      'ja_efetivada', true,
      'movimentacao_id', v_mov.id,
      'nova_designacao_id', v_nova_desig_id,
      'congregacao_id', v_mov.congregacao_destino_id,
      'congregacao_nome', v_cong_nome,
      'data_efetiva', v_mov.data_efetiva,
      'is_acumulacao', false,
      'obreiro_saindo_id', v_mov.dirigente_anterior_member_id,
      'obreiro_novo_id', v_mov.dirigente_novo_member_id
    );
  END IF;

  IF v_mov.status != 'aprovada' THEN
    RAISE EXCEPTION 'A movimentação precisa estar aprovada pela Presidência para ser efetivada.';
  END IF;

  -- 4. Validação patrimonial
  IF v_mov.requer_termo_patrimonial THEN
    IF v_mov.termo_patrimonial_id IS NULL THEN
      RAISE EXCEPTION 'A congregação possui patrimônio registrado. É obrigatório homologar o Termo de Transferência antes da efetivação.';
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM public.dirigentes_termos_patrimoniais
      WHERE id = v_mov.termo_patrimonial_id
        AND ministry_id = p_ministry_id
        AND movimentacao_id = p_movimentacao_id
        AND status_termo IN ('assinado_e_homologado', 'com_ressalvas')
    ) INTO v_termo_valido;

    IF NOT v_termo_valido THEN
      RAISE EXCEPTION 'O termo de transferência patrimonial precisa estar homologado para efetivar a movimentação.';
    END IF;
  END IF;

  -- 5. Validação do novo dirigente (deve ser ministro ativo do ministério)
  IF v_mov.dirigente_novo_member_id IS NULL THEN
    RAISE EXCEPTION 'Não é possível efetivar movimentação sem um ministro elegível vinculado (dirigente_novo_member_id obrigatório).';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.members
    WHERE id = v_mov.dirigente_novo_member_id
      AND ministry_id = p_ministry_id
      AND status IN ('active', 'ativo')
      AND (role = 'ministro' OR tipo_cadastro = 'ministro')
  ) THEN
    RAISE EXCEPTION 'O novo dirigente proposto não é um ministro ativo cadastrado neste ministério.';
  END IF;

  -- 6. Identificar dirigente anterior que está saindo
  v_obreiro_saindo_id := v_mov.dirigente_anterior_member_id;
  v_obreiro_saindo_nome := v_mov.dirigente_anterior_nome;
  v_obreiro_saindo_cargo := v_mov.dirigente_anterior_cargo;

  IF v_obreiro_saindo_id IS NULL THEN
    SELECT member_id, nome_dirigente, cargo_ministerial
    INTO v_obreiro_saindo_id, v_obreiro_saindo_nome, v_obreiro_saindo_cargo
    FROM public.dirigentes_designacoes
    WHERE ministry_id = p_ministry_id
      AND congregacao_id = v_mov.congregacao_destino_id
      AND status = 'ativo'
    LIMIT 1;
  END IF;

  -- 7. Verificar se o novo dirigente acumula outra congregação
  SELECT EXISTS (
    SELECT 1 FROM public.dirigentes_designacoes
    WHERE ministry_id = p_ministry_id
      AND status = 'ativo'
      AND congregacao_id != v_mov.congregacao_destino_id
      AND (
        (member_id IS NOT NULL AND member_id = v_mov.dirigente_novo_member_id)
        OR lower(trim(nome_dirigente)) = lower(trim(v_mov.dirigente_novo_nome))
      )
  ) INTO v_is_acumulacao;

  -- 8. Idempotência das designações: Verificar se já existe designação vinculada a esta movimentação
  SELECT id INTO v_nova_desig_id
  FROM public.dirigentes_designacoes
  WHERE ministry_id = p_ministry_id
    AND movimentacao_origem_id = v_mov.id
  LIMIT 1;

  IF v_nova_desig_id IS NOT NULL THEN
    UPDATE public.dirigentes_designacoes
    SET
      congregacao_id = v_mov.congregacao_destino_id,
      member_id = v_mov.dirigente_novo_member_id,
      nome_dirigente = v_mov.dirigente_novo_nome,
      cpf_dirigente = v_mov.dirigente_novo_cpf,
      cargo_ministerial = v_mov.dirigente_novo_cargo,
      matricula_dirigente = v_mov.dirigente_novo_matricula,
      tipo_designacao = CASE WHEN v_mov.tipo_movimentacao = 'substituicao_temporaria' THEN 'interino' ELSE 'titular' END,
      is_acumulacao = v_is_acumulacao,
      status = 'ativo',
      data_posse = p_data_efetiva,
      observacoes = v_mov.observacoes,
      updated_at = v_data_hora_real
    WHERE id = v_nova_desig_id;
  ELSE
    INSERT INTO public.dirigentes_designacoes (
      ministry_id,
      congregacao_id,
      member_id,
      nome_dirigente,
      cpf_dirigente,
      cargo_ministerial,
      matricula_dirigente,
      tipo_designacao,
      is_acumulacao,
      status,
      data_posse,
      movimentacao_origem_id,
      observacoes,
      created_at,
      updated_at
    ) VALUES (
      p_ministry_id,
      v_mov.congregacao_destino_id,
      v_mov.dirigente_novo_member_id,
      v_mov.dirigente_novo_nome,
      v_mov.dirigente_novo_cpf,
      v_mov.dirigente_novo_cargo,
      v_mov.dirigente_novo_matricula,
      CASE WHEN v_mov.tipo_movimentacao = 'substituicao_temporaria' THEN 'interino' ELSE 'titular' END,
      v_is_acumulacao,
      'ativo',
      p_data_efetiva,
      v_mov.id,
      v_mov.observacoes,
      v_data_hora_real,
      v_data_hora_real
    ) RETURNING id INTO v_nova_desig_id;
  END IF;

  -- 9. Encerrar designações ativas vigentes anteriores da congregação (preservando a nova)
  UPDATE public.dirigentes_designacoes
  SET
    status = 'concluido',
    data_termino = p_data_efetiva,
    motivo_saida = 'Substituído por movimentação: ' || v_mov.motivo,
    movimentacao_saida_id = v_mov.id,
    updated_at = v_data_hora_real
  WHERE ministry_id = p_ministry_id
    AND congregacao_id = v_mov.congregacao_destino_id
    AND status = 'ativo'
    AND id != v_nova_desig_id;

  -- 10. Sincronizar tabela congregacoes
  UPDATE public.congregacoes
  SET
    dirigente = v_mov.dirigente_novo_nome,
    dirigente_cargo = v_mov.dirigente_novo_cargo,
    dirigente_cpf = v_mov.dirigente_novo_cpf,
    dirigente_matricula = v_mov.dirigente_novo_matricula
  WHERE id = v_mov.congregacao_destino_id AND ministry_id = p_ministry_id;

  -- 11. Atualizar movimentação como efetivada
  UPDATE public.dirigentes_movimentacoes
  SET
    status = 'efetivada',
    data_efetiva = p_data_efetiva,
    divergencias_patrimoniais = COALESCE(p_divergencias, divergencias_patrimoniais),
    updated_at = v_data_hora_real
  WHERE id = v_mov.id;

  -- 12. Histórico ministerial individual: Obreiro que sai (se existir e for identificado)
  IF v_obreiro_saindo_id IS NOT NULL THEN
    v_hist_saida_item := jsonb_build_object(
      'id', 'hist_saida_' || v_mov.id::text || '_' || v_obreiro_saindo_id::text,
      'processo_id', v_mov.id::text,
      'movimentacao_id', v_mov.id::text,
      'ministry_id', p_ministry_id::text,
      'member_id', v_obreiro_saindo_id::text,
      'tipo_evento', 'saida_dirigente',
      'tipo_movimentacao', v_mov.tipo_movimentacao,
      'data', p_data_efetiva::text,
      'data_hora_efetivacao', v_data_hora_real::text,
      'local', v_cong_nome,
      'congregacao_nome', v_cong_nome,
      'cargo', COALESCE(v_obreiro_saindo_cargo, 'Dirigente'),
      'cargo_anterior', COALESCE(v_obreiro_saindo_cargo, 'Dirigente'),
      'justificativa', v_mov.motivo,
      'parecer', v_mov.motivo,
      'descricao', 'Término de mandato / Saída da função de dirigente da congregação ' || v_cong_nome,
      'responsavel', p_user_name,
      'usuario_id', p_user_id::text,
      'criado_em', v_data_hora_real::text
    );

    SELECT custom_fields INTO v_cf_saindo
    FROM public.members
    WHERE id = v_obreiro_saindo_id AND ministry_id = p_ministry_id
    FOR UPDATE;

    IF FOUND THEN
      IF v_cf_saindo IS NULL THEN
        v_cf_saindo := '{}'::jsonb;
      END IF;

      IF v_cf_saindo->'historico_processos' IS NULL OR jsonb_typeof(v_cf_saindo->'historico_processos') != 'array' THEN
        v_cf_saindo := jsonb_set(v_cf_saindo, '{historico_processos}', '[]'::jsonb);
      END IF;
      IF v_cf_saindo->'historicoProcessos' IS NULL OR jsonb_typeof(v_cf_saindo->'historicoProcessos') != 'array' THEN
        v_cf_saindo := jsonb_set(v_cf_saindo, '{historicoProcessos}', '[]'::jsonb);
      END IF;

      -- Inserir no histórico com garantia de não-duplicação (idempotência)
      IF NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements(v_cf_saindo->'historico_processos') AS elem
        WHERE elem->>'id' = v_hist_saida_item->>'id'
           OR (elem->>'movimentacao_id' = v_mov.id::text AND elem->>'tipo_evento' = 'saida_dirigente')
      ) THEN
        v_cf_saindo := jsonb_set(
          v_cf_saindo,
          '{historico_processos}',
          (v_cf_saindo->'historico_processos') || jsonb_build_array(v_hist_saida_item)
        );
        v_cf_saindo := jsonb_set(
          v_cf_saindo,
          '{historicoProcessos}',
          (v_cf_saindo->'historicoProcessos') || jsonb_build_array(v_hist_saida_item)
        );

        UPDATE public.members
        SET custom_fields = v_cf_saindo, updated_at = v_data_hora_real
        WHERE id = v_obreiro_saindo_id AND ministry_id = p_ministry_id;
      END IF;
    END IF;
  END IF;

  -- 13. Histórico ministerial individual: Obreiro que assume (obrigatório com rollback integral)
  v_hist_posse_item := jsonb_build_object(
    'id', 'hist_posse_' || v_mov.id::text || '_' || v_mov.dirigente_novo_member_id::text,
    'processo_id', v_mov.id::text,
    'movimentacao_id', v_mov.id::text,
    'ministry_id', p_ministry_id::text,
    'member_id', v_mov.dirigente_novo_member_id::text,
    'tipo_evento', 'posse_dirigente',
    'tipo_movimentacao', v_mov.tipo_movimentacao,
    'data', p_data_efetiva::text,
    'data_hora_efetivacao', v_data_hora_real::text,
    'local', v_cong_nome,
    'congregacao_nome', v_cong_nome,
    'cargo', COALESCE(v_mov.dirigente_novo_cargo, 'Dirigente'),
    'cargo_resultante', COALESCE(v_mov.dirigente_novo_cargo, 'Dirigente'),
    'justificativa', v_mov.motivo,
    'parecer', v_mov.motivo,
    'descricao', 'Posse e designação como Dirigente da congregação ' || v_cong_nome,
    'responsavel', p_user_name,
    'usuario_id', p_user_id::text,
    'criado_em', v_data_hora_real::text
  );

  SELECT custom_fields INTO v_cf_novo
  FROM public.members
  WHERE id = v_mov.dirigente_novo_member_id AND ministry_id = p_ministry_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Falha ao localizar cadastro ministerial do novo dirigente para atualização do histórico.';
  END IF;

  IF v_cf_novo IS NULL THEN
    v_cf_novo := '{}'::jsonb;
  END IF;

  IF v_cf_novo->'historico_processos' IS NULL OR jsonb_typeof(v_cf_novo->'historico_processos') != 'array' THEN
    v_cf_novo := jsonb_set(v_cf_novo, '{historico_processos}', '[]'::jsonb);
  END IF;
  IF v_cf_novo->'historicoProcessos' IS NULL OR jsonb_typeof(v_cf_novo->'historicoProcessos') != 'array' THEN
    v_cf_novo := jsonb_set(v_cf_novo, '{historicoProcessos}', '[]'::jsonb);
  END IF;

  -- Inserir no histórico se não existir (idempotência)
  IF NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(v_cf_novo->'historico_processos') AS elem
    WHERE elem->>'id' = v_hist_posse_item->>'id'
       OR (elem->>'movimentacao_id' = v_mov.id::text AND elem->>'tipo_evento' = 'posse_dirigente')
  ) THEN
    v_cf_novo := jsonb_set(
      v_cf_novo,
      '{historico_processos}',
      (v_cf_novo->'historico_processos') || jsonb_build_array(v_hist_posse_item)
    );
    v_cf_novo := jsonb_set(
      v_cf_novo,
      '{historicoProcessos}',
      (v_cf_novo->'historicoProcessos') || jsonb_build_array(v_hist_posse_item)
    );

    UPDATE public.members
    SET
      custom_fields = v_cf_novo,
      congregacao_id = v_mov.congregacao_destino_id,
      updated_at = v_data_hora_real
    WHERE id = v_mov.dirigente_novo_member_id AND ministry_id = p_ministry_id;
  END IF;

  RETURN jsonb_build_object(
    'sucesso', true,
    'movimentacao_id', v_mov.id,
    'nova_designacao_id', v_nova_desig_id,
    'congregacao_id', v_mov.congregacao_destino_id,
    'congregacao_nome', v_cong_nome,
    'data_efetiva', p_data_efetiva,
    'is_acumulacao', v_is_acumulacao,
    'obreiro_saindo_id', v_obreiro_saindo_id,
    'obreiro_novo_id', v_mov.dirigente_novo_member_id
  );
END;
$$;

COMMENT ON FUNCTION public.efetivar_movimentacao_dirigente(UUID, UUID, UUID, TEXT, DATE, TEXT) IS
'Efetiva atomicamente a movimentação de liderança, gerando registros históricos individuais nos perfis dos obreiros envolvidos, com rollback integral em caso de falha.';

REVOKE EXECUTE ON FUNCTION public.efetivar_movimentacao_dirigente(UUID, UUID, UUID, TEXT, DATE, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.efetivar_movimentacao_dirigente(UUID, UUID, UUID, TEXT, DATE, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.efetivar_movimentacao_dirigente(UUID, UUID, UUID, TEXT, DATE, TEXT) TO authenticated, service_role;

COMMIT;
