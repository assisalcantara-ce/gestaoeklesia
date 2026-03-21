-- ============================================
-- CONGREGAÇÕES (Igrejas): status do imóvel + foto
-- ============================================

ALTER TABLE public.congregacoes
ADD COLUMN IF NOT EXISTS status_imovel TEXT;

ALTER TABLE public.congregacoes
ADD COLUMN IF NOT EXISTS foto_url TEXT;

ALTER TABLE public.congregacoes
ADD COLUMN IF NOT EXISTS foto_bucket TEXT;

ALTER TABLE public.congregacoes
ADD COLUMN IF NOT EXISTS foto_path TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'congregacoes_status_imovel_check'
  ) THEN
    ALTER TABLE public.congregacoes
    ADD CONSTRAINT congregacoes_status_imovel_check
    CHECK (
      status_imovel IS NULL
      OR status_imovel IN ('PROPRIO', 'ALUGADO', 'CEDIDO')
    );
  END IF;
END $$;
