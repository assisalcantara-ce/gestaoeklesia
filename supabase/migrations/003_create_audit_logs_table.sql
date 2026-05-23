-- Criar tabela de auditoria (idempotente)
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID REFERENCES public.ministries(id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
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

-- Índices para performance (idempotentes)
CREATE INDEX IF NOT EXISTS idx_audit_ministry ON public.audit_logs(ministry_id);
CREATE INDEX IF NOT EXISTS idx_audit_usuario ON public.audit_logs(usuario_id);
CREATE INDEX IF NOT EXISTS idx_audit_modulo ON public.audit_logs(modulo);
CREATE INDEX IF NOT EXISTS idx_audit_acao ON public.audit_logs(acao);
CREATE INDEX IF NOT EXISTS idx_audit_data ON public.audit_logs(data_criacao DESC);
CREATE INDEX IF NOT EXISTS idx_audit_ministry_data ON public.audit_logs(ministry_id, data_criacao DESC);
CREATE INDEX IF NOT EXISTS idx_audit_usuario_data ON public.audit_logs(usuario_id, data_criacao DESC);
CREATE INDEX IF NOT EXISTS idx_audit_tabela ON public.audit_logs(tabela_afetada, registro_id);

-- Habilitar RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Políticas (idempotentes)
DROP POLICY IF EXISTS "Usuários veem logs da sua empresa" ON public.audit_logs;
DROP POLICY IF EXISTS "Sistema registra ações" ON public.audit_logs;
DROP POLICY IF EXISTS "Admins visualizam todos os logs" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_select" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_insert" ON public.audit_logs;

CREATE POLICY "audit_logs_select"
  ON public.audit_logs
  FOR SELECT
  USING (
    ministry_id IN (
      SELECT ministry_id FROM public.ministry_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "audit_logs_insert"
  ON public.audit_logs
  FOR INSERT
  WITH CHECK (true);

-- Conceder permissões
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT SELECT ON public.audit_logs TO anon;
