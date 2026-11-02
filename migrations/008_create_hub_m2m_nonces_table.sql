-- ==============================================================================
-- PROMPT 51: TABELA ATÔMICA COMPARTILHADA PARA PROTEÇÃO ANTI-REPLAY M2M
-- Arquivo para aprovação manual (Não executar automaticamente)
-- ==============================================================================

-- 1. Criação da tabela de nonces
CREATE TABLE IF NOT EXISTS public.hub_m2m_nonces (
    nonce TEXT PRIMARY KEY,
    key_id TEXT NOT NULL,
    correlation_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '10 minutes')
);

-- 2. Índice B-Tree de alta performance para expiração e limpeza
CREATE INDEX IF NOT EXISTS idx_hub_m2m_nonces_expires_at ON public.hub_m2m_nonces (expires_at);

-- 3. Habilitação de Row Level Security (RLS)
ALTER TABLE public.hub_m2m_nonces ENABLE ROW LEVEL SECURITY;

-- 4. Revogação de acesso público / anon e usuários autenticados comuns
REVOKE ALL ON public.hub_m2m_nonces FROM anon, authenticated, public;

-- 5. Concessão de privilégios estritos apenas para service_role (usado pelo gateway backend)
GRANT ALL ON public.hub_m2m_nonces TO service_role;

-- 6. Política RLS estrita para service_role
DROP POLICY IF EXISTS "service_role_manage_m2m_nonces" ON public.hub_m2m_nonces;
CREATE POLICY "service_role_manage_m2m_nonces"
    ON public.hub_m2m_nonces
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- 7. Função de limpeza de nonces expirados (idempotente e segura)
CREATE OR REPLACE FUNCTION public.cleanup_expired_hub_m2m_nonces()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    DELETE FROM public.hub_m2m_nonces
    WHERE expires_at < NOW();
END;
$$;

-- 8. Comentários para governança e catálogo de dados
COMMENT ON TABLE public.hub_m2m_nonces IS 'Registro atômico de nonces M2M para garantia de anti-replay distribuído entre instâncias do Gestão Eklésia e Alcântara Hub.';
COMMENT ON COLUMN public.hub_m2m_nonces.nonce IS 'Identificador criptográfico único de uso único (UUID v4 ou equivalente).';
COMMENT ON COLUMN public.hub_m2m_nonces.key_id IS 'Identificador da chave M2M do Hub.';
COMMENT ON COLUMN public.hub_m2m_nonces.correlation_id IS 'Identificador de correlação para rastreabilidade de ponta a ponta.';
COMMENT ON COLUMN public.hub_m2m_nonces.expires_at IS 'Data/hora de expiração do nonce (padrão 10 minutos após emissão).';

-- NOTA: O agendamento opcional pode ser ativado caso pg_cron esteja disponível no Supabase:
-- SELECT cron.schedule('cleanup-hub-m2m-nonces-job', '*/15 * * * *', 'SELECT public.cleanup_expired_hub_m2m_nonces();');
