-- Garante colunas usadas no formulário de Igreja (Divisão 01) na tabela public.congregacoes.
-- Motivo: bases legadas podem ter `congregacoes` com schema incompleto.

DO $$
BEGIN
  IF to_regclass('public.congregacoes') IS NULL THEN
    RETURN;
  END IF;

  -- Endereço / localização
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='congregacoes' AND column_name='endereco') THEN
    ALTER TABLE public.congregacoes ADD COLUMN endereco text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='congregacoes' AND column_name='cidade') THEN
    ALTER TABLE public.congregacoes ADD COLUMN cidade varchar(100);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='congregacoes' AND column_name='uf') THEN
    ALTER TABLE public.congregacoes ADD COLUMN uf varchar(2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='congregacoes' AND column_name='cep') THEN
    ALTER TABLE public.congregacoes ADD COLUMN cep varchar(20);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='congregacoes' AND column_name='latitude') THEN
    ALTER TABLE public.congregacoes ADD COLUMN latitude double precision;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='congregacoes' AND column_name='longitude') THEN
    ALTER TABLE public.congregacoes ADD COLUMN longitude double precision;
  END IF;

  -- Status do imóvel
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='congregacoes' AND column_name='status_imovel') THEN
    ALTER TABLE public.congregacoes ADD COLUMN status_imovel text;
  END IF;

  -- Foto
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='congregacoes' AND column_name='foto_url') THEN
    ALTER TABLE public.congregacoes ADD COLUMN foto_url varchar(500);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='congregacoes' AND column_name='foto_bucket') THEN
    ALTER TABLE public.congregacoes ADD COLUMN foto_bucket text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='congregacoes' AND column_name='foto_path') THEN
    ALTER TABLE public.congregacoes ADD COLUMN foto_path text;
  END IF;

  -- Timestamps (best-effort)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='congregacoes' AND column_name='created_at') THEN
    ALTER TABLE public.congregacoes ADD COLUMN created_at timestamp default current_timestamp;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='congregacoes' AND column_name='updated_at') THEN
    ALTER TABLE public.congregacoes ADD COLUMN updated_at timestamp default current_timestamp;
  END IF;
END
$$;
