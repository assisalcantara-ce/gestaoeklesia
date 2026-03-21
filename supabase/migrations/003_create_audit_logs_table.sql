-- Criar tabela de auditoria
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  usuario_email VARCHAR(255),
  acao VARCHAR(50) NOT NULL, -- criar, editar, deletar, visualizar, exportar, etc
  modulo VARCHAR(100) NOT NULL, -- suporte, usuarios, ministerios, financeiro, etc
  area VARCHAR(100), -- subárea do módulo (ex: tickets, membros, pagamentos)
  tabela_afetada VARCHAR(100),
  registro_id UUID, -- ID do registro que foi afetado
  descricao TEXT, -- descrição legível da ação
  dados_anteriores JSONB, -- valor anterior (para UPDATE)
  dados_novos JSONB, -- novo valor (para CREATE/UPDATE)
  ip_address INET,
  user_agent TEXT,
  status VARCHAR(20) DEFAULT 'sucesso', -- sucesso, erro, aviso
  mensagem_erro TEXT,
  data_criacao TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT valid_acao CHECK (acao IN ('criar', 'editar', 'deletar', 'visualizar', 'exportar', 'importar', 'responder', 'atualizar_status', 'atualizar_permissoes', 'login', 'logout', 'download', 'upload', 'outro')),
  CONSTRAINT valid_status CHECK (status IN ('sucesso', 'erro', 'aviso'))
);

-- Índices para performance
CREATE INDEX idx_audit_empresa ON public.audit_logs(empresa_id);
CREATE INDEX idx_audit_usuario ON public.audit_logs(usuario_id);
CREATE INDEX idx_audit_modulo ON public.audit_logs(modulo);
CREATE INDEX idx_audit_acao ON public.audit_logs(acao);
CREATE INDEX idx_audit_data ON public.audit_logs(data_criacao DESC);
CREATE INDEX idx_audit_empresa_data ON public.audit_logs(empresa_id, data_criacao DESC);
CREATE INDEX idx_audit_usuario_data ON public.audit_logs(usuario_id, data_criacao DESC);
CREATE INDEX idx_audit_tabela ON public.audit_logs(tabela_afetada, registro_id);

-- Habilitar RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Política: Usuários veem logs da sua empresa
CREATE POLICY "Usuários veem logs da sua empresa"
  ON public.audit_logs
  FOR SELECT
  USING (
    -- Usuário vê logs se está na mesma empresa
    empresa_id IN (
      SELECT empresa_id FROM public.usuario_empresas 
      WHERE usuario_id = auth.uid()
    )
  );

-- Política: Sistema cria logs
CREATE POLICY "Sistema registra ações"
  ON public.audit_logs
  FOR INSERT
  WITH CHECK (true);

-- Política: Admins podem visualizar qualquer log
CREATE POLICY "Admins visualizam todos os logs"
  ON public.audit_logs
  FOR SELECT
  USING (
    -- Se é admin da empresa, vê todos os logs da empresa
    EXISTS (
      SELECT 1 FROM public.usuario_empresas ue
      WHERE ue.usuario_id = auth.uid() 
      AND ue.empresa_id = audit_logs.empresa_id
      AND ue.eh_administrador = true
    )
  );

-- Conceder permissões
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT SELECT ON public.audit_logs TO anon;

-- Função para registrar ação (será chamada de app)
-- Esta função será abstrata pois será chamada via API
