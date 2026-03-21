-- ============================================
-- EMPLOYEES TABLE - SQL SCRIPT
-- ============================================

-- Criar tabela employees
CREATE TABLE IF NOT EXISTS public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  
  -- Informações profissionais
  grupo VARCHAR(100) NOT NULL,
  funcao VARCHAR(100) NOT NULL,
  data_admissao DATE NOT NULL,
  
  -- Contato
  email VARCHAR(255),
  telefone VARCHAR(20),
  whatsapp VARCHAR(20),
  
  -- Documentação
  rg VARCHAR(20),
  
  -- Endereço
  endereco VARCHAR(500),
  cep VARCHAR(20),
  bairro VARCHAR(100),
  cidade VARCHAR(100),
  uf VARCHAR(2),
  
  -- Dados financeiros
  banco VARCHAR(50),
  agencia VARCHAR(20),
  conta_corrente VARCHAR(20),
  pix VARCHAR(255),
  
  -- Informações adicionais
  obs TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'ATIVO',
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT valid_status CHECK (status IN ('ATIVO', 'INATIVO'))
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_employees_ministry_id ON public.employees(ministry_id);
CREATE INDEX IF NOT EXISTS idx_employees_member_id ON public.employees(member_id);
CREATE INDEX IF NOT EXISTS idx_employees_status ON public.employees(status);
CREATE INDEX IF NOT EXISTS idx_employees_grupo ON public.employees(grupo);

-- Habilitar RLS
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Funcionários isolados por ministry"
  ON public.employees FOR SELECT
  USING (
    ministry_id IN (
      SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Funcionários podem ser inseridos no seu ministry"
  ON public.employees FOR INSERT
  WITH CHECK (
    ministry_id IN (
      SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Funcionários podem ser atualizados no seu ministry"
  ON public.employees FOR UPDATE
  USING (
    ministry_id IN (
      SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    ministry_id IN (
      SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Funcionários podem ser deletados no seu ministry"
  ON public.employees FOR DELETE
  USING (
    ministry_id IN (
      SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    )
  );

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_employees_updated_at ON public.employees;
CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON public.employees
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- View: Funcionários com informações do membro
DROP VIEW IF EXISTS public.employees_with_member_info CASCADE;
CREATE VIEW public.employees_with_member_info AS
SELECT
  e.*,
  m.name AS member_name,
  m.cpf AS member_cpf,
  m.phone AS member_phone,
  m.email AS member_email,
  m.birth_date AS member_birth_date
FROM public.employees e
LEFT JOIN public.members m ON e.member_id = m.id;

ALTER VIEW public.employees_with_member_info OWNER TO postgres;

-- Atualizar view ministries_with_stats para contar funcionários
DROP VIEW IF EXISTS public.ministries_with_stats CASCADE;
CREATE VIEW public.ministries_with_stats AS
SELECT
  m.*,
  COUNT(DISTINCT mem.id) AS total_members,
  COUNT(DISTINCT e.id) AS total_employees
FROM public.ministries m
LEFT JOIN public.members mem ON m.id = mem.ministry_id
LEFT JOIN public.employees e ON m.id = e.ministry_id
GROUP BY m.id;

ALTER VIEW public.ministries_with_stats OWNER TO postgres;
