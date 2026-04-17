-- =============================================================================
-- 006_create_carta_pedidos.sql
-- Tabela de pedidos de cartas ministeriais com fluxo de autorização
-- =============================================================================

-- Habilitar pgcrypto se necessário
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------------------------------------------------------
-- 1. TABELA carta_pedidos
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.carta_pedidos (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id         UUID          NOT NULL,
  congregacao_id      UUID,

  -- Quem solicitou
  solicitante_id      UUID          NOT NULL,
  solicitante_nome    VARCHAR(255),

  -- Dados do membro
  member_id           UUID,                          -- FK opcional para members(id)
  membro_nome         VARCHAR(255)  NOT NULL,
  membro_cargo        VARCHAR(255),

  -- Dados da carta
  tipo_carta          VARCHAR(50)   NOT NULL,         -- 'mudanca' | 'transito' | 'desligamento' | 'recomendacao'
  destino             VARCHAR(255),                   -- cidade/estado de destino
  observacoes         TEXT,

  -- Fluxo de autorização
  status              VARCHAR(20)   NOT NULL DEFAULT 'pendente',  -- 'pendente' | 'autorizado' | 'rejeitado'
  autorizador_id      UUID,
  autorizador_nome    VARCHAR(255),
  data_autorizacao    TIMESTAMPTZ,
  motivo_rejeicao     TEXT,

  -- Auditoria
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT carta_pedidos_status_check
    CHECK (status IN ('pendente', 'autorizado', 'rejeitado')),

  CONSTRAINT carta_pedidos_tipo_check
    CHECK (tipo_carta IN ('mudanca', 'transito', 'desligamento', 'recomendacao'))
);

COMMENT ON TABLE public.carta_pedidos IS
  'Pedidos de cartas ministeriais. Operadores solicitam; admins/supervisores autorizam.';

-- -----------------------------------------------------------------------------
-- 2. ÍNDICES
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_carta_pedidos_ministry
  ON public.carta_pedidos (ministry_id);

CREATE INDEX IF NOT EXISTS idx_carta_pedidos_solicitante
  ON public.carta_pedidos (solicitante_id);

CREATE INDEX IF NOT EXISTS idx_carta_pedidos_status
  ON public.carta_pedidos (ministry_id, status);

CREATE INDEX IF NOT EXISTS idx_carta_pedidos_created
  ON public.carta_pedidos (ministry_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- 3. TRIGGER updated_at
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.carta_pedidos_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_carta_pedidos_updated_at
  BEFORE UPDATE ON public.carta_pedidos
  FOR EACH ROW EXECUTE FUNCTION public.carta_pedidos_set_updated_at();

-- -----------------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY
-- -----------------------------------------------------------------------------
ALTER TABLE public.carta_pedidos ENABLE ROW LEVEL SECURITY;

-- Admins e supervisores veem todos os pedidos do seu ministério
CREATE POLICY "carta_pedidos_admin_select"
  ON public.carta_pedidos FOR SELECT
  USING (
    ministry_id IN (
      SELECT ministry_id FROM public.ministry_users
      WHERE user_id = auth.uid()
    )
  );

-- Qualquer usuário do ministério pode inserir (operador cria seu pedido)
CREATE POLICY "carta_pedidos_insert"
  ON public.carta_pedidos FOR INSERT
  WITH CHECK (
    ministry_id IN (
      SELECT ministry_id FROM public.ministry_users
      WHERE user_id = auth.uid()
    )
    AND solicitante_id = auth.uid()
  );

-- Apenas admins/supervisores podem atualizar (autorizar/rejeitar)
CREATE POLICY "carta_pedidos_update"
  ON public.carta_pedidos FOR UPDATE
  USING (
    ministry_id IN (
      SELECT ministry_id FROM public.ministry_users
      WHERE user_id = auth.uid()
        AND (
          role IN ('admin', 'manager')
          OR permissions @> '["ADMINISTRADOR"]'::jsonb
          OR permissions @> '["SUPERVISOR"]'::jsonb
        )
    )
  );
