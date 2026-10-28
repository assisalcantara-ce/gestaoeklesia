-- =============================================================================
-- Migration: 20261028120000_eventos_inscricoes_bloqueio_duplicidade.sql
-- Objetivo: Impedir inscrições duplicadas de um mesmo participante no mesmo evento,
--           suportando tanto membros cadastrados (por member_id) quanto participantes
--           externos (por CPF normalizado somente dígitos), com proteção atômica
--           no PostgreSQL e respeitando cancelamentos / expirações.
-- =============================================================================

BEGIN;

-- 1. Adicionar coluna cpf_normalizado na tabela eventos_inscricoes (caso não exista)
ALTER TABLE public.eventos_inscricoes
  ADD COLUMN IF NOT EXISTS cpf_normalizado VARCHAR(14);

-- 2. Função auxiliar para extrair somente dígitos (se não existir)
CREATE OR REPLACE FUNCTION public.extrair_somente_digitos(p_texto text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT regexp_replace(COALESCE(p_texto, ''), '\D', '', 'g');
$$;

-- 3. Preencher cpf_normalizado a partir de members.cpf (para membros cadastrados)
UPDATE public.eventos_inscricoes ei
SET cpf_normalizado = public.extrair_somente_digitos(m.cpf)
FROM public.members m
WHERE ei.member_id = m.id
  AND m.cpf IS NOT NULL
  AND ei.cpf_normalizado IS NULL
  AND length(public.extrair_somente_digitos(m.cpf)) = 11;

-- 4. Preencher cpf_normalizado a partir das observações estruturadas (ex: "CPF: 123.456.789-00")
UPDATE public.eventos_inscricoes ei
SET cpf_normalizado = public.extrair_somente_digitos(
  substring(ei.observacoes from 'CPF:\s*([0-9\.\-]+)')
)
WHERE ei.cpf_normalizado IS NULL
  AND ei.observacoes ILIKE '%CPF:%'
  AND length(public.extrair_somente_digitos(substring(ei.observacoes from 'CPF:\s*([0-9\.\-]+)'))) = 11;

-- 5. Trigger para manter cpf_normalizado sempre sincronizado e preenchido em novos inserts/updates
CREATE OR REPLACE FUNCTION public.trg_fn_sincronizar_cpf_inscricao()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_cpf_membro text;
BEGIN
  -- Se member_id foi informado e cpf_normalizado ainda não foi explicitado, busca no cadastro do membro
  IF NEW.member_id IS NOT NULL AND (NEW.cpf_normalizado IS NULL OR NEW.cpf_normalizado = '') THEN
    SELECT public.extrair_somente_digitos(cpf) INTO v_cpf_membro
    FROM public.members
    WHERE id = NEW.member_id;

    IF v_cpf_membro IS NOT NULL AND length(v_cpf_membro) = 11 THEN
      NEW.cpf_normalizado := v_cpf_membro;
    END IF;
  END IF;

  -- Se cpf_normalizado não veio mas está nas observações (ex: Balcão ou Administrativo)
  IF (NEW.cpf_normalizado IS NULL OR NEW.cpf_normalizado = '') AND NEW.observacoes IS NOT NULL THEN
    v_cpf_membro := public.extrair_somente_digitos(substring(NEW.observacoes from 'CPF:\s*([0-9\.\-]+)'));
    IF v_cpf_membro IS NOT NULL AND length(v_cpf_membro) = 11 THEN
      NEW.cpf_normalizado := v_cpf_membro;
    END IF;
  END IF;

  -- Se o campo foi passado com máscara, normaliza para somente dígitos
  IF NEW.cpf_normalizado IS NOT NULL AND NEW.cpf_normalizado <> '' THEN
    NEW.cpf_normalizado := public.extrair_somente_digitos(NEW.cpf_normalizado);
    IF length(NEW.cpf_normalizado) = 0 THEN
      NEW.cpf_normalizado := NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sincronizar_cpf_inscricao ON public.eventos_inscricoes;
CREATE TRIGGER trg_sincronizar_cpf_inscricao
  BEFORE INSERT OR UPDATE OF member_id, observacoes, cpf_normalizado
  ON public.eventos_inscricoes
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fn_sincronizar_cpf_inscricao();

-- 6. Atualizar a restrição de unicidade para member_id ativo por evento
-- A constraint original `UNIQUE (evento_id, member_id)` impedia nova inscrição mesmo após cancelamento.
-- Substituímos por um índice parcial único que ignora inscrições 'cancelado' e 'expirado'.
ALTER TABLE public.eventos_inscricoes
  DROP CONSTRAINT IF EXISTS eventos_inscricoes_evento_id_member_id_key;

DROP INDEX IF EXISTS idx_inscricoes_evento_member_ativo;
CREATE UNIQUE INDEX idx_inscricoes_evento_member_ativo
  ON public.eventos_inscricoes (ministry_id, evento_id, member_id)
  WHERE member_id IS NOT NULL AND status NOT IN ('cancelado', 'expirado');

-- 7. Índice parcial único para participante por CPF normalizado (externo ou membro)
DROP INDEX IF EXISTS idx_inscricoes_evento_cpf_ativo;
CREATE UNIQUE INDEX idx_inscricoes_evento_cpf_ativo
  ON public.eventos_inscricoes (ministry_id, evento_id, cpf_normalizado)
  WHERE cpf_normalizado IS NOT NULL AND status NOT IN ('cancelado', 'expirado');

-- 8. Índice de apoio para busca de duplicidade por CPF
CREATE INDEX IF NOT EXISTS idx_inscricoes_cpf_normalizado
  ON public.eventos_inscricoes (ministry_id, cpf_normalizado);

COMMIT;
