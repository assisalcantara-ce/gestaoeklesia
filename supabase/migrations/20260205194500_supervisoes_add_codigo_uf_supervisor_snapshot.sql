-- Adiciona campos necessários ao cadastro de Supervisões (Divisão 1)
-- ID (código), UF e snapshot do supervisor (busca por CPF)

ALTER TABLE public.supervisoes
  ADD COLUMN IF NOT EXISTS codigo INTEGER,
  ADD COLUMN IF NOT EXISTS uf VARCHAR(2),
  ADD COLUMN IF NOT EXISTS supervisor_member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS supervisor_matricula VARCHAR(50),
  ADD COLUMN IF NOT EXISTS supervisor_nome VARCHAR(255),
  ADD COLUMN IF NOT EXISTS supervisor_cpf VARCHAR(20),
  ADD COLUMN IF NOT EXISTS supervisor_data_nascimento DATE,
  ADD COLUMN IF NOT EXISTS supervisor_cargo VARCHAR(100),
  ADD COLUMN IF NOT EXISTS supervisor_celular VARCHAR(20);

-- Índices/constraints
CREATE UNIQUE INDEX IF NOT EXISTS idx_supervisoes_ministry_codigo_unique
  ON public.supervisoes (ministry_id, codigo)
  WHERE codigo IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_supervisoes_supervisor_member_id
  ON public.supervisoes (supervisor_member_id);
