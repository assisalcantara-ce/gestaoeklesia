-- Adiciona campo simples "dirigente" na tabela de congregações (Divisão 03)
-- Compatível com bases legadas (best-effort)

DO $$
BEGIN
  IF to_regclass('public.congregacoes') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'congregacoes'
        AND column_name = 'dirigente'
    ) THEN
      ALTER TABLE public.congregacoes ADD COLUMN dirigente text;
    END IF;
  END IF;
END $$;
