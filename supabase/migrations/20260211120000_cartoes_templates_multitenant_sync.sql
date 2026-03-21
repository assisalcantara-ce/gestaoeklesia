-- Alinhamento do módulo de Cartões com Supabase (multi-tenant)
-- - Adiciona colunas para chave estável do template e controle de ativo por tipo
-- - Adiciona índices/constraints para evitar duplicatas
-- - Habilita RLS de escrita para admins/managers do ministry

BEGIN;

-- ================================
-- CARTOES_TEMPLATES: colunas extras
-- ================================

ALTER TABLE public.cartoes_templates
  ADD COLUMN IF NOT EXISTS template_key TEXT,
  ADD COLUMN IF NOT EXISTS tipo_cadastro TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT false;

-- Backfill para bases existentes
UPDATE public.cartoes_templates
SET template_key = COALESCE(template_key, id::text)
WHERE template_key IS NULL;

UPDATE public.cartoes_templates
SET tipo_cadastro = COALESCE(tipo_cadastro, 'membro')
WHERE tipo_cadastro IS NULL;

ALTER TABLE public.cartoes_templates
  ALTER COLUMN template_key SET NOT NULL,
  ALTER COLUMN tipo_cadastro SET NOT NULL;

-- Evita duplicar template por ministry
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'cartoes_templates_unique_key_per_ministry'
  ) THEN
    ALTER TABLE public.cartoes_templates
      ADD CONSTRAINT cartoes_templates_unique_key_per_ministry
      UNIQUE (ministry_id, template_key);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_cartoes_templates_ministry_tipo
  ON public.cartoes_templates(ministry_id, tipo_cadastro);

-- Garante apenas 1 ativo por (ministry_id, tipo_cadastro)
CREATE UNIQUE INDEX IF NOT EXISTS cartoes_templates_unique_active_per_tipo
  ON public.cartoes_templates(ministry_id, tipo_cadastro)
  WHERE is_active;

-- ================================
-- RLS: políticas de escrita
-- ================================

-- Leitura já existe no schema inicial.
-- Escrita: apenas admins/managers do ministry.

DROP POLICY IF EXISTS "Templates podem ser gerenciados por admins/managers" ON public.cartoes_templates;
DROP POLICY IF EXISTS "Templates podem ser criados por admins/managers" ON public.cartoes_templates;
DROP POLICY IF EXISTS "Templates podem ser atualizados por admins/managers" ON public.cartoes_templates;
DROP POLICY IF EXISTS "Templates podem ser deletados por admins/managers" ON public.cartoes_templates;

CREATE POLICY "Templates podem ser criados por admins/managers"
  ON public.cartoes_templates
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.ministry_users mu
      WHERE mu.user_id = auth.uid()
        AND mu.ministry_id = cartoes_templates.ministry_id
        AND mu.role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Templates podem ser atualizados por admins/managers"
  ON public.cartoes_templates
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.ministry_users mu
      WHERE mu.user_id = auth.uid()
        AND mu.ministry_id = cartoes_templates.ministry_id
        AND mu.role IN ('admin', 'manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.ministry_users mu
      WHERE mu.user_id = auth.uid()
        AND mu.ministry_id = cartoes_templates.ministry_id
        AND mu.role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Templates podem ser deletados por admins/managers"
  ON public.cartoes_templates
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.ministry_users mu
      WHERE mu.user_id = auth.uid()
        AND mu.ministry_id = cartoes_templates.ministry_id
        AND mu.role IN ('admin', 'manager')
    )
  );

COMMIT;
