-- Migration: 20260910200000_regularizacao_contratual_atomicidade.sql

-- 1. Adicionar coluna contrato_substituido_id em tenant_contratos
ALTER TABLE public.tenant_contratos
  ADD COLUMN IF NOT EXISTS contrato_substituido_id UUID REFERENCES public.tenant_contratos(id) ON DELETE SET NULL;

-- 2. Atualizar o CHECK constraint de status para permitir 'SUBSTITUIDO'
DO $$
BEGIN
  ALTER TABLE public.tenant_contratos DROP CONSTRAINT IF EXISTS tenant_contratos_status_check;
  ALTER TABLE public.tenant_contratos DROP CONSTRAINT IF EXISTS chk_tenant_contratos_status;
  
  ALTER TABLE public.tenant_contratos
    ADD CONSTRAINT chk_tenant_contratos_status
    CHECK (status IN ('RASCUNHO', 'AGUARDANDO_ASSINATURA', 'ATIVO', 'CANCELADO', 'EXPIRADO', 'RESCINDIDO', 'SUBSTITUIDO'));
END $$;

-- 3. Criar a função RPC de regularização contratual atômica e idempotente
CREATE OR REPLACE FUNCTION public.regularizar_contrato_tenant(
  p_ministry_id UUID,
  p_user_id UUID,
  p_documento_id UUID,
  p_versao_documento VARCHAR(20),
  p_versao_aceita VARCHAR(50),
  p_hash_documento VARCHAR(64),
  p_plano_contratado VARCHAR(50),
  p_valor_mensal NUMERIC(10,2),
  p_conteudo_customizado TEXT,
  p_numero_contrato VARCHAR(50),
  p_ip_address VARCHAR(45),
  p_user_agent TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_legado_id UUID;
  v_novo_contrato_id UUID;
  v_novo_aceite_id UUID;
BEGIN
  -- Trava exclusiva por tenant contra requisições concorrentes
  PERFORM pg_advisory_xact_lock(hashtext(p_ministry_id::text));

  -- Idempotência: Checar se o tenant já possui contrato ativo materializado e íntegro
  SELECT id INTO v_novo_contrato_id
    FROM public.tenant_contratos
   WHERE ministry_id = p_ministry_id
     AND status = 'ATIVO'
     AND snapshot_status = 'INTEGRO_IMUTAVEL'
     AND conteudo_customizado IS NOT NULL
     AND TRIM(conteudo_customizado) <> ''
   LIMIT 1;

  IF v_novo_contrato_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'ja_regularizado', true,
      'contrato_id', v_novo_contrato_id,
      'mensagem', 'Tenant já possui contrato ativo materializado íntegro.'
    );
  END IF;

  -- Localizar o contrato legado ativo atual (se houver)
  SELECT id INTO v_legado_id
    FROM public.tenant_contratos
   WHERE ministry_id = p_ministry_id
     AND status = 'ATIVO'
   ORDER BY created_at DESC
   LIMIT 1;

  -- Registrar o novo aceite em tenant_aceites com versao_aceita regularizada
  INSERT INTO public.tenant_aceites (
    ministry_id,
    user_id,
    documento_id,
    versao_aceita,
    hash_documento,
    ip_address,
    user_agent,
    payload_aceite,
    aceito_em,
    created_at
  ) VALUES (
    p_ministry_id,
    p_user_id,
    p_documento_id,
    p_versao_aceita,
    p_hash_documento,
    p_ip_address,
    p_user_agent,
    jsonb_build_object(
      'origem', 'REGULARIZACAO_CONTRATUAL',
      'contrato_legado_id', v_legado_id,
      'timestamp', NOW()
    ),
    NOW(),
    NOW()
  ) RETURNING id INTO v_novo_aceite_id;

  -- Inserir o novo contrato materializado ativo com governança
  INSERT INTO public.tenant_contratos (
    ministry_id,
    documento_base_id,
    versao_documento,
    hash_documento,
    plano_contratado,
    valor_mensal,
    conteudo_customizado,
    numero_contrato,
    status,
    snapshot_status,
    origem_snapshot,
    integridade_verificada,
    data_inicio,
    assinado_em,
    assinado_por,
    contrato_substituido_id,
    created_at,
    updated_at
  ) VALUES (
    p_ministry_id,
    p_documento_id,
    p_versao_documento,
    p_hash_documento,
    p_plano_contratado,
    p_valor_mensal,
    p_conteudo_customizado,
    p_numero_contrato,
    'ATIVO',
    'INTEGRO_IMUTAVEL',
    'CELEBRACAO_ORIGINAL',
    true,
    NOW(),
    NOW(),
    p_user_id,
    v_legado_id,
    NOW(),
    NOW()
  ) RETURNING id INTO v_novo_contrato_id;

  -- Se existia um contrato legado ativo, alterar apenas seu status para 'SUBSTITUIDO' (sem alterar snapshot ou hash)
  IF v_legado_id IS NOT NULL THEN
    UPDATE public.tenant_contratos
       SET status = 'SUBSTITUIDO',
           updated_at = NOW()
     WHERE id = v_legado_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'ja_regularizado', false,
    'contrato_id', v_novo_contrato_id,
    'aceite_id', v_novo_aceite_id,
    'legado_substituido_id', v_legado_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.regularizar_contrato_tenant TO authenticated, service_role;
