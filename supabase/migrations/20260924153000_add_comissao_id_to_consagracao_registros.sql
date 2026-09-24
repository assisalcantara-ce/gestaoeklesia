-- Migration: 20260924153000_add_comissao_id_to_consagracao_registros.sql
-- Módulo: Integração Consagração ↔ Comissões
-- Descrição: Adiciona comissao_id opcional em public.consagracao_registros com FK direta ON DELETE SET NULL e trigger de integridade multi-tenant.

DO $$
BEGIN
    -- 1. Adicionar coluna comissao_id de forma não destrutiva e segura para reexecuções
    IF to_regclass('public.consagracao_registros') IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
              AND table_name = 'consagracao_registros' 
              AND column_name = 'comissao_id'
        ) THEN
            ALTER TABLE public.consagracao_registros ADD COLUMN comissao_id UUID NULL;
        END IF;
    END IF;
END $$;

-- 2. Criar índice para performance em consultas de processos por comissão
CREATE INDEX IF NOT EXISTS idx_consagracao_registros_comissao_id 
    ON public.consagracao_registros(comissao_id);

-- 3. Adicionar Foreign Key direta com public.comissoes(id)
-- Utiliza ON DELETE SET NULL na coluna comissao_id, garantindo que a exclusão de uma comissão
-- apenas desvincule o processo (definindo comissao_id = NULL) e NUNCA altere ou anule o ministry_id.
DO $$
BEGIN
    IF to_regclass('public.consagracao_registros') IS NOT NULL AND to_regclass('public.comissoes') IS NOT NULL THEN
        -- Remove constraint anterior caso exista para permitir reexecução idempotente
        IF EXISTS (
            SELECT 1 
            FROM pg_constraint 
            WHERE conname = 'fk_consagracao_registros_comissao'
        ) THEN
            ALTER TABLE public.consagracao_registros DROP CONSTRAINT fk_consagracao_registros_comissao;
        END IF;

        ALTER TABLE public.consagracao_registros
            ADD CONSTRAINT fk_consagracao_registros_comissao
            FOREIGN KEY (comissao_id)
            REFERENCES public.comissoes(id)
            ON DELETE SET NULL;
    END IF;
END $$;

-- 4. Função e Trigger para validação estrita de Integridade Multi-Tenant no Banco
-- Garante que se comissao_id for informado, a comissão indicada existe e pertence exatamente ao mesmo ministry_id do processo
CREATE OR REPLACE FUNCTION public.check_consagracao_comissao_tenant_integrity()
RETURNS TRIGGER AS $$
DECLARE
    v_comissao_ministry_id UUID;
BEGIN
    -- Se comissao_id for nulo (processos legados ou sem comissão), a validação passa normalmente
    IF NEW.comissao_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Validar se a comissão existe e obter seu ministry_id
    SELECT ministry_id INTO v_comissao_ministry_id
    FROM public.comissoes
    WHERE id = NEW.comissao_id;

    IF v_comissao_ministry_id IS NULL THEN
        RAISE EXCEPTION 'Comissão indicada não existe.';
    END IF;

    IF v_comissao_ministry_id <> NEW.ministry_id THEN
        RAISE EXCEPTION 'Violação de integridade multi-tenant: a comissão selecionada pertence a outro ministério.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_consagracao_comissao_tenant_integrity ON public.consagracao_registros;
CREATE TRIGGER trg_consagracao_comissao_tenant_integrity
BEFORE INSERT OR UPDATE OF comissao_id, ministry_id ON public.consagracao_registros
FOR EACH ROW
EXECUTE FUNCTION public.check_consagracao_comissao_tenant_integrity();
