-- Migração: Tokens de Acesso Público para Relatório Espiritual
CREATE TABLE IF NOT EXISTS public.relatorio_espiritual_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  congregacao_id UUID REFERENCES public.congregacoes(id) ON DELETE CASCADE,
  token VARCHAR(100) UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  
  CONSTRAINT unique_ministry_congregacao UNIQUE (ministry_id, congregacao_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_relatorio_esp_tokens_token ON public.relatorio_espiritual_tokens(token);

-- Habilitar RLS
ALTER TABLE public.relatorio_espiritual_tokens ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
DROP POLICY IF EXISTS relatorio_esp_tokens_select_anon ON public.relatorio_espiritual_tokens;
DROP POLICY IF EXISTS relatorio_esp_tokens_all_admin ON public.relatorio_espiritual_tokens;

-- Permite acesso anônimo para ler o token (usado no formulário público)
CREATE POLICY relatorio_esp_tokens_select_anon
  ON public.relatorio_espiritual_tokens FOR SELECT
  USING (is_active = true);

-- Permite gestão completa para usuários autenticados do mesmo ministério
CREATE POLICY relatorio_esp_tokens_all_admin
  ON public.relatorio_espiritual_tokens FOR ALL
  USING (
    ministry_id IN (
      SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    )
  );

-- Ajustar política de INSERT na tabela de registros espirituais para permitir inserção pública (anônima)
-- se o token enviado na requisição for válido (vamos gerenciar via API ou RLS).
-- Mas para manter a segurança simples, o próprio formulário público pode usar a chave anon do Supabase 
-- para inserir registros espirituais na tabela pública.
-- Então precisamos criar uma política na tabela relatorio_espiritual_registros para permitir INSERT anônimo.
DROP POLICY IF EXISTS relatorio_espiritual_insert_public ON public.relatorio_espiritual_registros;

CREATE POLICY relatorio_espiritual_insert_public
  ON public.relatorio_espiritual_registros FOR INSERT
  WITH CHECK (true); -- Permitir inserção anônima. A validação do token será feita no servidor/API ou no código JS antes do insert.
