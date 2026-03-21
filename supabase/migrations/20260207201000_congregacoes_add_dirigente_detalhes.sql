-- Captura dados do dirigente (CPF, Cargo, Matrícula) na tabela de congregações
-- Compatível com bases legadas (best-effort)

DO $$
BEGIN
  IF to_regclass('public.congregacoes') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'congregacoes'
        AND column_name = 'dirigente_cpf'
    ) THEN
      ALTER TABLE public.congregacoes ADD COLUMN dirigente_cpf text;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'congregacoes'
        AND column_name = 'dirigente_cargo'
    ) THEN
      ALTER TABLE public.congregacoes ADD COLUMN dirigente_cargo text;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'congregacoes'
        AND column_name = 'dirigente_matricula'
    ) THEN
      ALTER TABLE public.congregacoes ADD COLUMN dirigente_matricula text;
    END IF;
  END IF;
END $$;
