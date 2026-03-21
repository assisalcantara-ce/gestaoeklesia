-- Garante compatibilidade com bases legadas que já tinham supervisoes/congregacoes
-- sem o padrão multi-tenant (ministry_id). Faz backfill automático quando houver
-- apenas 1 ministry no banco.

DO $$
DECLARE
  v_ministry_id uuid;
  v_ministry_count int;
BEGIN
  -- Se a tabela ministries não existir, não há como reparar.
  IF to_regclass('public.ministries') IS NULL THEN
    RAISE NOTICE 'Tabela public.ministries não existe; pulando ensure_divisoes_multitenant_columns.';
    RETURN;
  END IF;

  SELECT COUNT(*) INTO v_ministry_count FROM public.ministries;
  IF v_ministry_count = 1 THEN
    SELECT id INTO v_ministry_id FROM public.ministries LIMIT 1;
  ELSE
    v_ministry_id := NULL;
  END IF;

  -- SUPERVISOES
  IF to_regclass('public.supervisoes') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.supervisoes ADD COLUMN IF NOT EXISTS ministry_id uuid';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_supervisoes_ministry_id ON public.supervisoes(ministry_id)';
    IF v_ministry_id IS NOT NULL THEN
      EXECUTE format('UPDATE public.supervisoes SET ministry_id = %L WHERE ministry_id IS NULL', v_ministry_id);
      EXECUTE 'ALTER TABLE public.supervisoes ALTER COLUMN ministry_id SET NOT NULL';
      BEGIN
        EXECUTE 'ALTER TABLE public.supervisoes ADD CONSTRAINT supervisoes_ministry_id_fkey FOREIGN KEY (ministry_id) REFERENCES public.ministries(id) ON DELETE CASCADE';
      EXCEPTION WHEN duplicate_object THEN
        -- constraint já existe
      END;
    ELSE
      RAISE NOTICE 'Há % ministries; não foi possível backfill de supervisoes.ministry_id automaticamente.', v_ministry_count;
    END IF;
  END IF;

  -- CONGREGACOES
  IF to_regclass('public.congregacoes') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.congregacoes ADD COLUMN IF NOT EXISTS ministry_id uuid';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_congregacoes_ministry_id ON public.congregacoes(ministry_id)';
    IF v_ministry_id IS NOT NULL THEN
      EXECUTE format('UPDATE public.congregacoes SET ministry_id = %L WHERE ministry_id IS NULL', v_ministry_id);
      EXECUTE 'ALTER TABLE public.congregacoes ALTER COLUMN ministry_id SET NOT NULL';
      BEGIN
        EXECUTE 'ALTER TABLE public.congregacoes ADD CONSTRAINT congregacoes_ministry_id_fkey FOREIGN KEY (ministry_id) REFERENCES public.ministries(id) ON DELETE CASCADE';
      EXCEPTION WHEN duplicate_object THEN
        -- constraint já existe
      END;
    ELSE
      RAISE NOTICE 'Há % ministries; não foi possível backfill de congregacoes.ministry_id automaticamente.', v_ministry_count;
    END IF;
  END IF;
END
$$;
