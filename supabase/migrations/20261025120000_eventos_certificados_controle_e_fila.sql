-- =============================================================================
-- Migration: 20261025120000_eventos_certificados_controle_e_fila.sql
-- Objetivo: Estrutura de auditoria, controle de histórico de emissão/envio de 
--           certificados e fila persistente para processamento assíncrono seguro
--           no Gestão Eklésia.
-- =============================================================================

BEGIN;

-- 1. Opção no cadastro de Eventos para envio automático pós-check-in (desativada por padrão)
ALTER TABLE public.eventos
  ADD COLUMN IF NOT EXISTS certificado_envio_auto_checkin BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Tabela de Histórico e Auditoria de Tentativas de Envio de Certificados
CREATE TABLE IF NOT EXISTS public.eventos_certificados_envios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  evento_id UUID NOT NULL REFERENCES public.eventos(id) ON DELETE CASCADE,
  inscricao_id UUID NOT NULL REFERENCES public.eventos_inscricoes(id) ON DELETE CASCADE,
  template_modelo_id VARCHAR(100) NOT NULL,
  
  -- Origem da operação
  origem VARCHAR(30) NOT NULL CHECK (origem IN ('individual', 'massa', 'checkin', 'segunda_via')),
  
  -- Destinatário e dados do disparo
  email_destinatario VARCHAR(255) NOT NULL,
  nome_participante VARCHAR(255) NOT NULL,
  
  -- Chave de idempotência única por operação para evitar duplicidade acidental
  idempotency_key VARCHAR(150) NOT NULL,
  
  -- Status da tentativa
  status VARCHAR(30) NOT NULL DEFAULT 'solicitado' 
    CHECK (status IN ('gerado', 'solicitado', 'aceito_provedor', 'entregue', 'falha')),
  
  -- Dados do provedor (Resend)
  resend_message_id VARCHAR(100),
  
  -- Detalhes de erro e motivo
  motivo_falha TEXT,
  
  -- Snapshot dos dados interpolados no momento da emissão
  dados_snapshot JSONB,
  
  -- Auditoria de usuário solicitante (nulo se automático por check-in)
  solicitado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Constraint de idempotência única por ministério para prevenir duplo envio idêntico
CREATE UNIQUE INDEX IF NOT EXISTS uq_eventos_certificados_idempotency
  ON public.eventos_certificados_envios(ministry_id, idempotency_key);

-- Índices de consulta e performance
CREATE INDEX IF NOT EXISTS idx_cert_envios_inscricao
  ON public.eventos_certificados_envios(inscricao_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cert_envios_evento_status
  ON public.eventos_certificados_envios(evento_id, status);

CREATE INDEX IF NOT EXISTS idx_cert_envios_ministry
  ON public.eventos_certificados_envios(ministry_id);


-- 3. Tabela de Fila Persistente para Processamento Assíncrono com Lock Concorrente
CREATE TABLE IF NOT EXISTS public.eventos_certificados_fila (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  evento_id UUID NOT NULL REFERENCES public.eventos(id) ON DELETE CASCADE,
  inscricao_id UUID NOT NULL REFERENCES public.eventos_inscricoes(id) ON DELETE CASCADE,
  
  template_modelo_id VARCHAR(100) NOT NULL,
  origem VARCHAR(30) NOT NULL CHECK (origem IN ('individual', 'massa', 'checkin', 'segunda_via')),
  email_destinatario VARCHAR(255) NOT NULL,
  nome_participante VARCHAR(255) NOT NULL,
  
  idempotency_key VARCHAR(150) NOT NULL,
  
  -- Máquina de estados da fila
  status VARCHAR(20) NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'processando', 'enviado', 'falhou')),
    
  tentativas INTEGER NOT NULL DEFAULT 0,
  max_tentativas INTEGER NOT NULL DEFAULT 3,
  
  -- Controle de concorrência e lease time (evita starvation ou duplicidade em serverless)
  locked_at TIMESTAMPTZ,
  locked_by VARCHAR(100),
  proxima_tentativa_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  ultimo_erro TEXT,
  resend_message_id VARCHAR(100),
  
  solicitado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Constraint: Apenas um item ativo ('pendente' ou 'processando') por inscrição simultaneamente
CREATE UNIQUE INDEX IF NOT EXISTS uq_certificados_fila_ativa_por_inscricao
  ON public.eventos_certificados_fila(inscricao_id)
  WHERE status IN ('pendente', 'processando');

-- Índice para busca rápida de lotes prontos para processamento
CREATE INDEX IF NOT EXISTS idx_cert_fila_polling
  ON public.eventos_certificados_fila(status, proxima_tentativa_em)
  WHERE status IN ('pendente', 'processando');

CREATE INDEX IF NOT EXISTS idx_cert_fila_ministry
  ON public.eventos_certificados_fila(ministry_id);


-- 4. Funções RPC Atômicas para Lock e Reserva de Tarefas na Fila (Row-Level Lock)
CREATE OR REPLACE FUNCTION public.reservar_lote_fila_certificados(
  p_worker_id VARCHAR(100),
  p_limite INTEGER DEFAULT 10,
  p_timeout_minutos INTEGER DEFAULT 5
)
RETURNS SETOF public.eventos_certificados_fila
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  WITH candidatos AS (
    SELECT id
    FROM public.eventos_certificados_fila
    WHERE 
      (status = 'pendente' AND proxima_tentativa_em <= NOW())
      OR (status = 'processando' AND locked_at < NOW() - (p_timeout_minutos || ' minutes')::INTERVAL)
    ORDER BY created_at ASC
    LIMIT p_limite
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.eventos_certificados_fila f
  SET 
    status = 'processando',
    locked_at = NOW(),
    locked_by = p_worker_id,
    tentativas = f.tentativas + 1,
    updated_at = NOW()
  FROM candidatos c
  WHERE f.id = c.id
  RETURNING f.*;
END;
$$;

-- Função atômica para conclusão ou falha de tarefa garantindo que apenas o worker detentor do lock finalize
CREATE OR REPLACE FUNCTION public.concluir_tarefa_fila_certificados(
  p_fila_id UUID,
  p_worker_id VARCHAR(100),
  p_status_final VARCHAR(20),
  p_resend_message_id VARCHAR(100) DEFAULT NULL,
  p_ultimo_erro TEXT DEFAULT NULL,
  p_reagendar_minutos INTEGER DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_afetados INTEGER;
BEGIN
  -- Se for reagendamento para pendente com backoff
  IF p_status_final = 'pendente' AND p_reagendar_minutos IS NOT NULL THEN
    UPDATE public.eventos_certificados_fila
    SET 
      status = 'pendente',
      locked_at = NULL,
      locked_by = NULL,
      proxima_tentativa_em = NOW() + (p_reagendar_minutos || ' minutes')::INTERVAL,
      ultimo_erro = COALESCE(p_ultimo_erro, ultimo_erro),
      updated_at = NOW()
    WHERE id = p_fila_id AND locked_by = p_worker_id;
  ELSE
    UPDATE public.eventos_certificados_fila
    SET 
      status = p_status_final,
      locked_at = NULL,
      locked_by = NULL,
      resend_message_id = COALESCE(p_resend_message_id, resend_message_id),
      ultimo_erro = COALESCE(p_ultimo_erro, ultimo_erro),
      updated_at = NOW()
    WHERE id = p_fila_id AND locked_by = p_worker_id;
  END IF;

  GET DIAGNOSTICS v_afetados = ROW_COUNT;
  RETURN v_afetados > 0;
END;
$$;


-- 5. Habilitar RLS e Políticas de Segurança
ALTER TABLE public.eventos_certificados_envios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eventos_certificados_fila ENABLE ROW LEVEL SECURITY;

-- Políticas para eventos_certificados_envios
DROP POLICY IF EXISTS cert_envios_select ON public.eventos_certificados_envios;
CREATE POLICY cert_envios_select ON public.eventos_certificados_envios
  FOR SELECT USING (
    ministry_id IN (
      SELECT mu.ministry_id FROM public.ministry_users mu WHERE mu.user_id = auth.uid()
    )
    OR ministry_id IN (
      SELECT m.id FROM public.ministries m WHERE m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS cert_envios_insert ON public.eventos_certificados_envios;
CREATE POLICY cert_envios_insert ON public.eventos_certificados_envios
  FOR INSERT WITH CHECK (
    ministry_id IN (
      SELECT mu.ministry_id FROM public.ministry_users mu WHERE mu.user_id = auth.uid()
    )
    OR ministry_id IN (
      SELECT m.id FROM public.ministries m WHERE m.user_id = auth.uid()
    )
  );

-- Políticas para eventos_certificados_fila
DROP POLICY IF EXISTS cert_fila_select ON public.eventos_certificados_fila;
CREATE POLICY cert_fila_select ON public.eventos_certificados_fila
  FOR SELECT USING (
    ministry_id IN (
      SELECT mu.ministry_id FROM public.ministry_users mu WHERE mu.user_id = auth.uid()
    )
    OR ministry_id IN (
      SELECT m.id FROM public.ministries m WHERE m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS cert_fila_all_admin ON public.eventos_certificados_fila;
CREATE POLICY cert_fila_all_admin ON public.eventos_certificados_fila
  FOR ALL USING (
    ministry_id IN (
      SELECT mu.ministry_id FROM public.ministry_users mu WHERE mu.user_id = auth.uid()
    )
    OR ministry_id IN (
      SELECT m.id FROM public.ministries m WHERE m.user_id = auth.uid()
    )
  );

COMMIT;
