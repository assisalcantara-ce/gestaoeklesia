-- Garante colunas de vínculo em bases legadas.
-- Motivo: CREATE TABLE IF NOT EXISTS não altera tabela existente.

DO $$
BEGIN
  IF to_regclass('public.congregacoes') IS NOT NULL THEN
    -- supervisao_id
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'congregacoes'
        AND column_name = 'supervisao_id'
    ) THEN
      ALTER TABLE public.congregacoes ADD COLUMN supervisao_id uuid;
    END IF;

    -- campo_id
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'congregacoes'
        AND column_name = 'campo_id'
    ) THEN
      ALTER TABLE public.congregacoes ADD COLUMN campo_id uuid;
    END IF;

    -- Índices (best-effort)
    BEGIN
      CREATE INDEX IF NOT EXISTS idx_congregacoes_supervisao_id ON public.congregacoes(supervisao_id);
    EXCEPTION WHEN others THEN
      -- noop
    END;

    BEGIN
      CREATE INDEX IF NOT EXISTS idx_congregacoes_campo_id ON public.congregacoes(campo_id);
    EXCEPTION WHEN others THEN
      -- noop
    END;

    -- FK (best-effort / condicional)
    IF to_regclass('public.supervisoes') IS NOT NULL THEN
      BEGIN
        ALTER TABLE public.congregacoes
          ADD CONSTRAINT congregacoes_supervisao_id_fkey
          FOREIGN KEY (supervisao_id) REFERENCES public.supervisoes(id) ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN
        -- noop
      WHEN others THEN
        -- noop
      END;
    END IF;

    IF to_regclass('public.campos') IS NOT NULL THEN
      BEGIN
        ALTER TABLE public.congregacoes
          ADD CONSTRAINT congregacoes_campo_id_fkey
          FOREIGN KEY (campo_id) REFERENCES public.campos(id) ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN
        -- noop
      WHEN others THEN
        -- noop
      END;
    END IF;
  END IF;
END
$$;
