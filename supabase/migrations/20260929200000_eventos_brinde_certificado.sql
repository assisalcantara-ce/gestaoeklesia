-- =============================================================================
-- Módulo Eventos: Benefícios Brinde (Controle de Distribuição e Concorrência) 
-- e Certificado (Integração com Modelos de Certificados)
-- =============================================================================

BEGIN;

-- 1. Campos na tabela eventos
ALTER TABLE public.eventos
  ADD COLUMN IF NOT EXISTS brinde_habilitado BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS brinde_distribuicao VARCHAR(30) NOT NULL DEFAULT 'todos',
  ADD COLUMN IF NOT EXISTS brinde_quantidade INTEGER,
  ADD COLUMN IF NOT EXISTS certificado_habilitado BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS certificado_modelo_id VARCHAR(100);

-- Sincronizar colunas anteriores se existirem
UPDATE public.eventos
SET 
  brinde_habilitado = COALESCE(brinde_habilitado, inclui_brinde, FALSE),
  certificado_habilitado = COALESCE(certificado_habilitado, inclui_certificado, FALSE)
WHERE brinde_habilitado IS FALSE OR certificado_habilitado IS FALSE;

-- Restrições em eventos
ALTER TABLE public.eventos DROP CONSTRAINT IF EXISTS eventos_brinde_distribuicao_valida;
ALTER TABLE public.eventos ADD CONSTRAINT eventos_brinde_distribuicao_valida
  CHECK (brinde_distribuicao IN ('todos', 'quantidade_limitada'));

ALTER TABLE public.eventos DROP CONSTRAINT IF EXISTS eventos_brinde_quantidade_valida;
ALTER TABLE public.eventos ADD CONSTRAINT eventos_brinde_quantidade_valida
  CHECK (brinde_quantidade IS NULL OR brinde_quantidade > 0);

-- 2. Campos na tabela eventos_inscricoes
ALTER TABLE public.eventos_inscricoes
  ADD COLUMN IF NOT EXISTS confirmado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS tem_brinde BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS brinde_entregue BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS brinde_entregue_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS brinde_entregue_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS certificado_emitido BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS certificado_snapshot JSONB;

-- Preencher confirmado_em histórico para inscrições já confirmadas
UPDATE public.eventos_inscricoes
SET confirmado_em = created_at
WHERE status = 'confirmado' AND confirmado_em IS NULL;

-- 3. Índices para performance e concorrência
CREATE INDEX IF NOT EXISTS idx_inscricoes_brinde_concedido
  ON public.eventos_inscricoes(evento_id, status, tem_brinde)
  WHERE status = 'confirmado' AND tem_brinde = TRUE;

CREATE INDEX IF NOT EXISTS idx_inscricoes_confirmado_em
  ON public.eventos_inscricoes(evento_id, status, confirmado_em ASC)
  WHERE status = 'confirmado';

-- 4. Função utilitária para checagem de elegibilidade do brinde
CREATE OR REPLACE FUNCTION public.inscricao_tem_brinde(p_evento_id UUID, p_inscricao_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tem BOOLEAN;
BEGIN
  SELECT tem_brinde INTO v_tem
  FROM public.eventos_inscricoes
  WHERE id = p_inscricao_id AND evento_id = p_evento_id;
  RETURN COALESCE(v_tem, FALSE);
END;
$$;

-- 5. Trigger transacional e atômico para controle de concorrência e ordem de confirmação
CREATE OR REPLACE FUNCTION public.trg_processar_brinde_inscricao()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_inclui_brinde BOOLEAN;
  v_brinde_distribuicao VARCHAR(30);
  v_brinde_quantidade INTEGER;
  v_qtd_concedida INTEGER;
BEGIN
  IF NEW.status = 'confirmado' THEN
    IF NEW.confirmado_em IS NULL THEN
      NEW.confirmado_em := NOW();
    END IF;

    -- Bloqueio FOR SHARE no evento para garantir leitura consistente sem dirty reads
    SELECT 
      COALESCE(brinde_habilitado, inclui_brinde, FALSE),
      COALESCE(brinde_distribuicao, 'todos'),
      brinde_quantidade
    INTO 
      v_inclui_brinde,
      v_brinde_distribuicao,
      v_brinde_quantidade
    FROM public.eventos
    WHERE id = NEW.evento_id
    FOR SHARE;

    IF v_inclui_brinde IS TRUE THEN
      IF v_brinde_distribuicao = 'todos' THEN
        NEW.tem_brinde := TRUE;
      ELSIF v_brinde_distribuicao = 'quantidade_limitada' AND v_brinde_quantidade > 0 THEN
        -- Conta quantas inscrições confirmadas já ganharam o benefício
        SELECT COUNT(*)
        INTO v_qtd_concedida
        FROM public.eventos_inscricoes
        WHERE evento_id = NEW.evento_id
          AND status = 'confirmado'
          AND tem_brinde = TRUE
          AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID);

        IF v_qtd_concedida < v_brinde_quantidade THEN
          NEW.tem_brinde := TRUE;
        ELSE
          NEW.tem_brinde := FALSE;
        END IF;
      ELSE
        NEW.tem_brinde := FALSE;
      END IF;
    ELSE
      NEW.tem_brinde := FALSE;
    END IF;
  ELSE
    NEW.tem_brinde := FALSE;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_eventos_inscricoes_brinde ON public.eventos_inscricoes;
CREATE TRIGGER trg_eventos_inscricoes_brinde
  BEFORE INSERT OR UPDATE OF status, evento_id
  ON public.eventos_inscricoes
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_processar_brinde_inscricao();

COMMIT;
