-- Limpeza de campos legados do módulo de membros para convenção atual.
-- Objetivos:
-- 1) Fixar tipo de cadastro como "ministro" em members.
-- 2) Remover chaves legadas de custom_fields (dizimista/historico/tipoCadastro).
-- 3) Remover coluna legada dizimista, quando existir.

DO $$
BEGIN
  IF to_regclass('public.members') IS NOT NULL THEN
    -- Força convenção atual: cadastro apenas de ministro.
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'members'
        AND column_name = 'tipo_cadastro'
    ) THEN
      UPDATE public.members
      SET
        role = 'ministro',
        tipo_cadastro = 'ministro';
    ELSE
      UPDATE public.members
      SET role = 'ministro';
    END IF;

    -- Remove resíduos do custom_fields (sem falhar quando JSON não for objeto).
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'members'
        AND column_name = 'custom_fields'
    ) THEN
      UPDATE public.members
      SET custom_fields = CASE
        WHEN custom_fields IS NULL THEN NULL
        WHEN jsonb_typeof(custom_fields) = 'object' THEN
          custom_fields
            - 'dizimista'
            - 'historicoDizimos'
            - 'tipoCadastro'
            - 'tipo_cadastro'
        ELSE custom_fields
      END
      WHERE custom_fields IS NOT NULL;
    END IF;

    -- Remove coluna legada não utilizada na nova convenção.
    ALTER TABLE public.members DROP COLUMN IF EXISTS dizimista;
  END IF;
END $$;

DO $$
BEGIN
  -- Compatibilidade com bases legadas que ainda usam tabela public.membros.
  IF to_regclass('public.membros') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'membros'
        AND column_name = 'custom_fields'
    ) THEN
      UPDATE public.membros
      SET custom_fields = CASE
        WHEN custom_fields IS NULL THEN NULL
        WHEN jsonb_typeof(custom_fields) = 'object' THEN
          custom_fields
            - 'dizimista'
            - 'historicoDizimos'
            - 'tipoCadastro'
            - 'tipo_cadastro'
        ELSE custom_fields
      END
      WHERE custom_fields IS NOT NULL;
    END IF;

    ALTER TABLE public.membros DROP COLUMN IF EXISTS dizimista;
  END IF;
END $$;
