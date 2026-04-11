-- ============================================================
-- MODULO FUNCIONÁRIOS
-- Tabela: employees
-- View:   employees_with_member_info
-- Depende de: ministries, members, ministry_users
-- Idempotente: pode ser reexecutado sem erros
-- ============================================================

-- ============================================================
-- TABELA: employees
-- ============================================================
CREATE TABLE IF NOT EXISTS public.employees (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id     UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  member_id       UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  grupo           VARCHAR(100) NOT NULL,
  funcao          VARCHAR(100) NOT NULL,
  data_admissao   DATE NOT NULL,
  email           VARCHAR(255),
  telefone        VARCHAR(20),
  whatsapp        VARCHAR(20),
  rg              VARCHAR(20),
  endereco        VARCHAR(500),
  cep             VARCHAR(20),
  bairro          VARCHAR(100),
  cidade          VARCHAR(100),
  uf              VARCHAR(2),
  banco           VARCHAR(50),
  agencia         VARCHAR(20),
  conta_corrente  VARCHAR(20),
  pix             VARCHAR(255),
  obs             TEXT,
  status          VARCHAR(50) NOT NULL DEFAULT 'ATIVO',
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT employees_valid_status_check
    CHECK (status IN ('ATIVO', 'INATIVO'))
);

-- ============================================================
-- TRIGGER: updated_at automático
-- Reutiliza update_updated_at_column() do schema inicial
-- Se a função não existir, cria localmente
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_employees_updated_at ON public.employees;
CREATE TRIGGER trg_employees_updated_at
  BEFORE UPDATE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- ÍNDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_employees_ministry_id
  ON public.employees (ministry_id);

CREATE INDEX IF NOT EXISTS idx_employees_member_id
  ON public.employees (member_id);

CREATE INDEX IF NOT EXISTS idx_employees_status
  ON public.employees (status);

CREATE INDEX IF NOT EXISTS idx_employees_grupo
  ON public.employees (grupo);

-- ============================================================
-- RLS (Row Level Security)
-- Padrão owner-fallback: verifica ministry_users OU dono direto
-- Não usa SECURITY DEFINER functions para evitar conflitos
-- ============================================================
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS employees_select ON public.employees;
CREATE POLICY employees_select ON public.employees
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.ministry_users mu
      WHERE mu.user_id = auth.uid()
        AND mu.ministry_id = public.employees.ministry_id
    )
    OR EXISTS (
      SELECT 1 FROM public.ministries m
      WHERE m.id = public.employees.ministry_id
        AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS employees_insert ON public.employees;
CREATE POLICY employees_insert ON public.employees
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.ministry_users mu
      WHERE mu.user_id = auth.uid()
        AND mu.ministry_id = public.employees.ministry_id
    )
    OR EXISTS (
      SELECT 1 FROM public.ministries m
      WHERE m.id = public.employees.ministry_id
        AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS employees_update ON public.employees;
CREATE POLICY employees_update ON public.employees
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.ministry_users mu
      WHERE mu.user_id = auth.uid()
        AND mu.ministry_id = public.employees.ministry_id
    )
    OR EXISTS (
      SELECT 1 FROM public.ministries m
      WHERE m.id = public.employees.ministry_id
        AND m.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.ministry_users mu
      WHERE mu.user_id = auth.uid()
        AND mu.ministry_id = public.employees.ministry_id
    )
    OR EXISTS (
      SELECT 1 FROM public.ministries m
      WHERE m.id = public.employees.ministry_id
        AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS employees_delete ON public.employees;
CREATE POLICY employees_delete ON public.employees
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.ministry_users mu
      WHERE mu.user_id = auth.uid()
        AND mu.ministry_id = public.employees.ministry_id
    )
    OR EXISTS (
      SELECT 1 FROM public.ministries m
      WHERE m.id = public.employees.ministry_id
        AND m.user_id = auth.uid()
    )
  );

-- ============================================================
-- PERMISSÕES
-- ============================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employees TO authenticated;

-- ============================================================
-- VIEW: employees_with_member_info
-- Junta employees com dados básicos do membro vinculado
-- ============================================================
DROP VIEW IF EXISTS public.employees_with_member_info;
CREATE VIEW public.employees_with_member_info AS
SELECT
  e.id,
  e.ministry_id,
  e.member_id,
  e.grupo,
  e.funcao,
  e.data_admissao,
  e.email,
  e.telefone,
  e.whatsapp,
  e.rg,
  e.endereco,
  e.cep,
  e.bairro,
  e.cidade,
  e.uf,
  e.banco,
  e.agencia,
  e.conta_corrente,
  e.pix,
  e.obs,
  e.status,
  e.created_at,
  e.updated_at,
  m.name            AS member_name,
  m.cpf             AS member_cpf,
  m.phone           AS member_phone,
  m.data_nascimento AS member_birth_date
FROM public.employees e
LEFT JOIN public.members m ON e.member_id = m.id;

GRANT SELECT ON public.employees_with_member_info TO authenticated;

-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON TABLE public.employees IS
  'Funcionários/colaboradores do ministério. Vinculados a um membro cadastrado. Multi-tenant com RLS.';

COMMENT ON VIEW public.employees_with_member_info IS
  'View de funcionários com dados básicos do membro vinculado (nome, CPF, telefone, nascimento).';
