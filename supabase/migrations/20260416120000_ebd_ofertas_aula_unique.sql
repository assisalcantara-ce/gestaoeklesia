-- Adiciona constraint UNIQUE em ebd_ofertas.aula_id
-- Necessário para que o upsert com onConflict: 'aula_id' funcione corretamente.
-- Remove duplicatas (mantém o registro mais recente por aula) antes de criar a constraint.

DELETE FROM public.ebd_ofertas o
WHERE id NOT IN (
  SELECT DISTINCT ON (aula_id) id
  FROM public.ebd_ofertas
  WHERE aula_id IS NOT NULL
  ORDER BY aula_id, created_at DESC
)
AND aula_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ebd_oferta_aula_unica'
      AND conrelid = 'public.ebd_ofertas'::regclass
  ) THEN
    ALTER TABLE public.ebd_ofertas ADD CONSTRAINT ebd_oferta_aula_unica UNIQUE (aula_id);
  END IF;
END $$;
