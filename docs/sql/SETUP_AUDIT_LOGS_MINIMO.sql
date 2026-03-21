-- ════════════════════════════════════════════════════════════════
-- SETUP AUDIT LOGS - VERSÃO MÍNIMA (ZERO DEPENDENCIES)
-- ════════════════════════════════════════════════════════════════

-- 1. REMOVER TUDO ANTERIOR (se existir)
DROP POLICY IF EXISTS "users_view_own_audit_logs" ON public.audit_logs;
DROP POLICY IF EXISTS "users_create_audit_logs" ON public.audit_logs;
DROP POLICY IF EXISTS "users_update_own_audit_logs" ON public.audit_logs;
DROP POLICY IF EXISTS "admins_view_all_audit_logs" ON public.audit_logs;
DROP TABLE IF EXISTS public.audit_logs CASCADE;

-- 2. CRIAR TABELA (estrutura simples)
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID,
  usuario_email VARCHAR(255),
  acao VARCHAR(50) NOT NULL,
  modulo VARCHAR(100) NOT NULL,
  area VARCHAR(100),
  tabela_afetada VARCHAR(100),
  registro_id UUID,
  descricao TEXT,
  dados_anteriores JSONB,
  dados_novos JSONB,
  ip_address INET,
  user_agent TEXT,
  status VARCHAR(20) DEFAULT 'sucesso',
  mensagem_erro TEXT,
  data_criacao TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. ÍNDICES (melhor performance)
CREATE INDEX idx_audit_usuario ON public.audit_logs(usuario_id);
CREATE INDEX idx_audit_modulo ON public.audit_logs(modulo);
CREATE INDEX idx_audit_acao ON public.audit_logs(acao);
CREATE INDEX idx_audit_data ON public.audit_logs(data_criacao DESC);
CREATE INDEX idx_audit_usuario_data ON public.audit_logs(usuario_id, data_criacao DESC);

-- 4. RLS HABILITADO
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 5. POLICIES (APENAS O ESSENCIAL)
-- Policy 1: Usuários veem seus próprios logs
CREATE POLICY "users_view_own_audit_logs"
  ON public.audit_logs
  FOR SELECT
  USING (usuario_id = auth.uid());

-- Policy 2: Qualquer um autenticado pode inserir (logs são gerados pelo sistema)
CREATE POLICY "users_create_audit_logs"
  ON public.audit_logs
  FOR INSERT
  WITH CHECK (true);

-- 6. PERMISSÕES
ALTER TABLE public.audit_logs OWNER TO postgres;
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT SELECT, INSERT ON public.audit_logs TO anon;

-- ✅ CONCLUSÃO
SELECT 'Tabela audit_logs criada com sucesso (versão mínima)!' AS resultado;
