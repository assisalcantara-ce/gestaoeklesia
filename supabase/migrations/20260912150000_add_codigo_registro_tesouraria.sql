-- ============================================================================
-- Migration: 20260912150000_add_codigo_registro_tesouraria.sql
-- Adiciona a coluna codigo_registro na tabela tesouraria_lancamentos
-- com índice único condicional por ministry_id, tabela atômica de sequências
-- e funções de alocação concorrente-segura.
-- ============================================================================

BEGIN;

-- 1. Adiciona coluna codigo_registro se não existir
ALTER TABLE public.tesouraria_lancamentos
ADD COLUMN IF NOT EXISTS codigo_registro VARCHAR(60);

-- 2. Cria índice único parcial para garantir unicidade por ministry_id quando preenchido
-- (permite registros legados nulos/vazios sem colisão)
DROP INDEX IF EXISTS idx_tesouraria_lancamentos_codigo_registro;

CREATE UNIQUE INDEX IF NOT EXISTS idx_tesouraria_lancamentos_codigo_registro
ON public.tesouraria_lancamentos (ministry_id, upper(trim(codigo_registro)))
WHERE codigo_registro IS NOT NULL AND trim(codigo_registro) <> '';

-- 3. Tabela para controle atômico e concorrente de sequências por (ministry_id, ano)
CREATE TABLE IF NOT EXISTS public.tesouraria_sequencias_codigo (
  ministry_id UUID NOT NULL,
  ano INT NOT NULL,
  ultimo_numero INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY (ministry_id, ano)
);

-- Habilita RLS na tabela de sequências
ALTER TABLE public.tesouraria_sequencias_codigo ENABLE ROW LEVEL SECURITY;

-- 4. Função de Prévia / Sugestão (NÃO consome número da sequência)
CREATE OR REPLACE FUNCTION public.obter_previa_codigo_lancamento(
  p_ministry_id UUID,
  p_ano INT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_ano_prefix TEXT;
  v_pattern TEXT;
  v_max_tabela INT := 0;
  v_ultimo_seq INT := 0;
  v_proximo_num INT;
BEGIN
  v_ano_prefix := 'REG-' || p_ano || '-';
  v_pattern := '^REG-' || p_ano || '-([0-9]+)$';

  -- Lê a sequência atual gravada
  SELECT ultimo_numero INTO v_ultimo_seq
  FROM public.tesouraria_sequencias_codigo
  WHERE ministry_id = p_ministry_id AND ano = p_ano;

  -- Lê o maior número existente na tabela de lançamentos
  SELECT COALESCE(MAX(
    SUBSTRING(codigo_registro FROM '[0-9]+$')::INT
  ), 0)
  INTO v_max_tabela
  FROM public.tesouraria_lancamentos
  WHERE ministry_id = p_ministry_id
    AND codigo_registro ~ v_pattern;

  v_proximo_num := GREATEST(COALESCE(v_ultimo_seq, 0), v_max_tabela) + 1;
  RETURN v_ano_prefix || LPAD(v_proximo_num::TEXT, 6, '0');
END;
$$;

-- 5. Função de Alocação Atômica Definitiva (segura contra concorrência com lock em linha)
CREATE OR REPLACE FUNCTION public.alocar_proximo_codigo_lancamento(
  p_ministry_id UUID,
  p_ano INT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_ano_prefix TEXT;
  v_pattern TEXT;
  v_max_tabela INT := 0;
  v_novo_numero INT;
BEGIN
  v_ano_prefix := 'REG-' || p_ano || '-';
  v_pattern := '^REG-' || p_ano || '-([0-9]+)$';

  -- Garante que a linha exista (UPSERT idempotente)
  INSERT INTO public.tesouraria_sequencias_codigo (ministry_id, ano, ultimo_numero)
  VALUES (p_ministry_id, p_ano, 0)
  ON CONFLICT (ministry_id, ano) DO NOTHING;

  -- Bloqueia a linha da sequência exclusivamente (row-level lock) para este tenant e ano
  -- e calcula o próximo número considerando o maior entre a tabela de lançamentos e a sequência
  SELECT COALESCE(MAX(
    SUBSTRING(codigo_registro FROM '[0-9]+$')::INT
  ), 0)
  INTO v_max_tabela
  FROM public.tesouraria_lancamentos
  WHERE ministry_id = p_ministry_id
    AND codigo_registro ~ v_pattern;

  UPDATE public.tesouraria_sequencias_codigo
  SET ultimo_numero = GREATEST(ultimo_numero, v_max_tabela) + 1,
      updated_at = timezone('utc'::text, now())
  WHERE ministry_id = p_ministry_id AND ano = p_ano
  RETURNING ultimo_numero INTO v_novo_numero;

  RETURN v_ano_prefix || LPAD(v_novo_numero::TEXT, 6, '0');
END;
$$;

-- Compatibilidade com RPC anterior
CREATE OR REPLACE FUNCTION public.gerar_proximo_codigo_lancamento(
  p_ministry_id UUID,
  p_ano INT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN public.obter_previa_codigo_lancamento(p_ministry_id, p_ano);
END;
$$;

COMMIT;

