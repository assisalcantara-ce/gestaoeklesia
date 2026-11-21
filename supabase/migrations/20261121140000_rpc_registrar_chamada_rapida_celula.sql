-- ==============================================================================
-- Migration: 20261121140000_rpc_registrar_chamada_rapida_celula.sql
-- Descrição: RPC transacional atômica para registro e finalização de chamada rápida
--            de células com bloqueio pessimista (FOR UPDATE) anti-concorrência.
-- Segurança: SECURITY DEFINER, search_path fixo, REVOKE de public/anon/authenticated.
-- Execução: Exclusivamente via backend com service_role / postgres.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.registrar_chamada_rapida_celula(
  p_token_hash TEXT,
  p_tema_estudo TEXT DEFAULT NULL,
  p_observacoes TEXT DEFAULT NULL,
  p_presentes_membros INTEGER DEFAULT 0,
  p_presentes_visitantes INTEGER DEFAULT 0,
  p_presentes_criancas INTEGER DEFAULT 0,
  p_conversoes_decisoes INTEGER DEFAULT 0,
  p_reconciliacoes INTEGER DEFAULT 0,
  p_testemunhos INTEGER DEFAULT 0,
  p_pedidos_oracao INTEGER DEFAULT 0,
  p_valor_oferta NUMERIC(10,2) DEFAULT 0.00,
  p_frequencias JSONB DEFAULT '[]'::JSONB,
  p_finalizar BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_token RECORD;
  v_celula RECORD;
  v_reuniao RECORD;
  v_reuniao_id UUID;
  v_total_presentes INTEGER;
  v_status_reuniao VARCHAR(30);
  v_now TIMESTAMPTZ := clock_timestamp();
  v_freq RECORD;
BEGIN
  -- 1. Validar e travar o registro do token com lock pessimista (FOR UPDATE)
  -- Impede concorrência e race condition caso múltiplas submissões ocorram em paralelo
  SELECT *
    INTO v_token
    FROM public.celulas_chamada_tokens
   WHERE token_hash = p_token_hash
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Link de chamada rápida não encontrado ou inválido.'
      USING ERRCODE = 'P0002';
  END IF;

  -- 2. Validar integridade e ciclo de vida do token
  IF v_token.status = 'revogado' THEN
    RAISE EXCEPTION 'Este link de chamada foi revogado.'
      USING ERRCODE = '22023';
  END IF;

  IF v_token.status = 'finalizado' THEN
    RAISE EXCEPTION 'Esta chamada já foi finalizada e não pode ser reenviada pelo link.'
      USING ERRCODE = '22023';
  END IF;

  IF v_token.expires_at < v_now THEN
    RAISE EXCEPTION 'Este link de chamada expirou.'
      USING ERRCODE = '22023';
  END IF;

  -- 3. Validar célula pertencente ao ministério do token
  SELECT id, ministry_id, congregacao_id, horario, modalidade
    INTO v_celula
    FROM public.celulas
   WHERE id = v_token.celula_id
     AND ministry_id = v_token.ministry_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Célula vinculada ao token não encontrada ou inconsistente.'
      USING ERRCODE = 'P0002';
  END IF;

  -- 4. Tratar reunião associada (se já existir, travar com FOR UPDATE)
  IF v_token.reuniao_id IS NOT NULL THEN
    SELECT *
      INTO v_reuniao
      FROM public.celulas_reunioes
     WHERE id = v_token.reuniao_id
       AND ministry_id = v_token.ministry_id
       FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Reunião vinculada ao token não foi localizada.'
        USING ERRCODE = 'P0002';
    END IF;

    IF v_reuniao.status = 'finalizada' THEN
      RAISE EXCEPTION 'Esta reunião já foi finalizada e homologada no sistema.'
        USING ERRCODE = '22023';
    END IF;

    v_reuniao_id := v_reuniao.id;
  END IF;

  -- 5. Definir status e calcular total de presentes
  IF p_finalizar THEN
    v_status_reuniao := 'finalizada';
  ELSE
    v_status_reuniao := 'em_andamento';
  END IF;

  v_total_presentes := COALESCE(p_presentes_membros, 0) + COALESCE(p_presentes_visitantes, 0);

  -- 6. Upsert/Update da Reunião de forma atômica
  IF v_reuniao_id IS NOT NULL THEN
    UPDATE public.celulas_reunioes
       SET tema_estudo = COALESCE(NULLIF(TRIM(p_tema_estudo), ''), tema_estudo),
           observacoes = COALESCE(NULLIF(TRIM(p_observacoes), ''), observacoes),
           status = v_status_reuniao,
           presentes_membros = COALESCE(p_presentes_membros, 0),
           presentes_visitantes = COALESCE(p_presentes_visitantes, 0),
           presentes_criancas = COALESCE(p_presentes_criancas, 0),
           conversoes_decisoes = COALESCE(p_conversoes_decisoes, 0),
           reconciliacoes = COALESCE(p_reconciliacoes, 0),
           testemunhos = COALESCE(p_testemunhos, 0),
           pedidos_oracao = COALESCE(p_pedidos_oracao, 0),
           valor_oferta = COALESCE(p_valor_oferta, 0.00),
           finalizada_em = CASE WHEN p_finalizar THEN v_now ELSE finalizada_em END,
           updated_at = v_now
     WHERE id = v_reuniao_id;
  ELSE
    INSERT INTO public.celulas_reunioes (
      ministry_id,
      celula_id,
      congregacao_id,
      data_reuniao,
      horario_inicio,
      modalidade,
      status,
      tema_estudo,
      observacoes,
      presentes_membros,
      presentes_visitantes,
      presentes_criancas,
      conversoes_decisoes,
      reconciliacoes,
      testemunhos,
      pedidos_oracao,
      valor_oferta,
      finalizada_em,
      created_at,
      updated_at
    ) VALUES (
      v_token.ministry_id,
      v_celula.id,
      v_celula.congregacao_id,
      CURRENT_DATE,
      COALESCE(v_celula.horario, '20:00:00'::TIME),
      COALESCE(v_celula.modalidade, 'presencial'),
      v_status_reuniao,
      NULLIF(TRIM(p_tema_estudo), ''),
      NULLIF(TRIM(p_observacoes), ''),
      COALESCE(p_presentes_membros, 0),
      COALESCE(p_presentes_visitantes, 0),
      COALESCE(p_presentes_criancas, 0),
      COALESCE(p_conversoes_decisoes, 0),
      COALESCE(p_reconciliacoes, 0),
      COALESCE(p_testemunhos, 0),
      COALESCE(p_pedidos_oracao, 0),
      COALESCE(p_valor_oferta, 0.00),
      CASE WHEN p_finalizar THEN v_now ELSE NULL END,
      v_now,
      v_now
    ) RETURNING id INTO v_reuniao_id;

    -- Vincular a reunião recém-criada ao token
    UPDATE public.celulas_chamada_tokens
       SET reuniao_id = v_reuniao_id,
           updated_at = v_now
     WHERE id = v_token.id;
  END IF;

  -- 7. Gravação das frequências nominais (Atomic Delete + Bulk Insert)
  IF p_frequencias IS NOT NULL AND jsonb_array_length(p_frequencias) > 0 THEN
    DELETE FROM public.celulas_frequencias
     WHERE reuniao_id = v_reuniao_id
       AND ministry_id = v_token.ministry_id;

    INSERT INTO public.celulas_frequencias (
      ministry_id,
      reuniao_id,
      celula_id,
      member_id,
      nome_participante,
      tipo_participante,
      presente,
      justificativa_ausencia,
      created_at
    )
    SELECT
      v_token.ministry_id,
      v_reuniao_id,
      v_celula.id,
      CASE 
        WHEN (item->>'member_id') ~ '^[0-9a-fA-F-]{36}$' THEN (item->>'member_id')::UUID 
        ELSE NULL 
      END,
      COALESCE(NULLIF(TRIM(item->>'nome_participante'), ''), 'Participante'),
      COALESCE(NULLIF(TRIM(item->>'tipo_participante'), ''), 'membro'),
      COALESCE((item->>'presente')::BOOLEAN, false),
      NULLIF(TRIM(item->>'justificativa_ausencia'), ''),
      v_now
    FROM jsonb_array_elements(p_frequencias) AS item;
  END IF;

  -- 8. Se finalizado, atualizar o status do token de chamada
  IF p_finalizar THEN
    UPDATE public.celulas_chamada_tokens
       SET status = 'finalizado',
           updated_at = v_now
     WHERE id = v_token.id;
  END IF;

  -- 9. Retorno transacional consolidado
  RETURN jsonb_build_object(
    'reuniao_id', v_reuniao_id,
    'status', v_status_reuniao,
    'total_presentes', v_total_presentes,
    'finalizada', p_finalizar
  );
END;
$$;

-- Permissões estritas de segurança:
-- Revoga execução pública e concede estritamente ao service_role e postgres
REVOKE ALL ON FUNCTION public.registrar_chamada_rapida_celula(
  TEXT, TEXT, TEXT, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, NUMERIC, JSONB, BOOLEAN
) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.registrar_chamada_rapida_celula(
  TEXT, TEXT, TEXT, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, NUMERIC, JSONB, BOOLEAN
) FROM anon;

REVOKE ALL ON FUNCTION public.registrar_chamada_rapida_celula(
  TEXT, TEXT, TEXT, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, NUMERIC, JSONB, BOOLEAN
) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.registrar_chamada_rapida_celula(
  TEXT, TEXT, TEXT, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, NUMERIC, JSONB, BOOLEAN
) TO service_role;

GRANT EXECUTE ON FUNCTION public.registrar_chamada_rapida_celula(
  TEXT, TEXT, TEXT, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, NUMERIC, JSONB, BOOLEAN
) TO postgres;
