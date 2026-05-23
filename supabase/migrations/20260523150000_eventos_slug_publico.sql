-- =============================================================================
-- Fase 3: Eventos Públicos — slug + índices de inscrição pública
-- =============================================================================

-- 1. Adicionar coluna slug em eventos
ALTER TABLE public.eventos ADD COLUMN IF NOT EXISTS slug VARCHAR(255);

-- 2. Função para gerar slug a partir do título
CREATE OR REPLACE FUNCTION public.slugify(texto TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  resultado TEXT;
BEGIN
  -- Converter para minúsculas
  resultado := lower(texto);
  -- Substituir acentos comuns (from=25 chars, to=25 chars — mapeamento 1:1)
  resultado := translate(resultado,
    'áàãâäéèêëíìîïóòõôöúùûüçñý',
    'aaaaaeeeeiiiiooooouuuucny'
  );
  -- Remover caracteres não alfanuméricos (exceto hifens e espaços)
  resultado := regexp_replace(resultado, '[^a-z0-9\s-]', '', 'g');
  -- Substituir espaços e múltiplos hifens por um único hífen
  resultado := regexp_replace(resultado, '[\s-]+', '-', 'g');
  -- Remover hifens no início e fim
  resultado := trim(both '-' from resultado);
  -- Truncar em 200 chars
  resultado := left(resultado, 200);
  RETURN resultado;
END;
$$;

-- 3. Função para gerar slug único para evento
CREATE OR REPLACE FUNCTION public.generate_evento_slug(p_titulo TEXT, p_evento_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  base_slug TEXT;
  candidate TEXT;
  counter INT := 2;
BEGIN
  base_slug := public.slugify(p_titulo);
  candidate := base_slug;

  -- Verificar unicidade (excluindo o próprio evento no caso de update)
  WHILE EXISTS (
    SELECT 1 FROM public.eventos
    WHERE slug = candidate
    AND (p_evento_id IS NULL OR id <> p_evento_id)
  ) LOOP
    candidate := base_slug || '-' || counter;
    counter := counter + 1;
    IF counter > 999 THEN
      -- Fallback com parte do UUID
      candidate := base_slug || '-' || left(p_evento_id::TEXT, 8);
      EXIT;
    END IF;
  END LOOP;

  RETURN candidate;
END;
$$;

-- 4. Trigger para auto-gerar slug no INSERT se não informado
CREATE OR REPLACE FUNCTION public.trg_evento_set_slug()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.slug IS NULL OR trim(NEW.slug) = '' THEN
    NEW.slug := public.generate_evento_slug(NEW.titulo, NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_evento_set_slug ON public.eventos;
CREATE TRIGGER trg_evento_set_slug
  BEFORE INSERT ON public.eventos
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_evento_set_slug();

-- 5. Gerar slugs para eventos existentes — loop individual para garantir unicidade
--    (UPDATE batch usa snapshot inicial, dois eventos com mesmo título gerariam slug duplicado)
DO $$
DECLARE
  ev RECORD;
BEGIN
  FOR ev IN
    SELECT id, titulo FROM public.eventos WHERE slug IS NULL OR trim(slug) = '' ORDER BY created_at
  LOOP
    UPDATE public.eventos
      SET slug = public.generate_evento_slug(ev.titulo, ev.id)
      WHERE id = ev.id;
  END LOOP;
END;
$$;

-- 6. Tornar slug único e obrigatório (após preencher todos)
ALTER TABLE public.eventos ALTER COLUMN slug SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_eventos_slug ON public.eventos(slug);

-- 7. Índice parcial único: (evento_id, email_externo) para evitar inscrição duplicada
CREATE UNIQUE INDEX IF NOT EXISTS idx_inscricoes_evento_email
  ON public.eventos_inscricoes(evento_id, email_externo)
  WHERE email_externo IS NOT NULL;

-- 8. Índice auxiliar para busca por email externo
CREATE INDEX IF NOT EXISTS idx_inscricoes_email_externo
  ON public.eventos_inscricoes(email_externo)
  WHERE email_externo IS NOT NULL;
