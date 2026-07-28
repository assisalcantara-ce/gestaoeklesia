-- Add departamento_id to fin_contas for department-level cashboxes
ALTER TABLE public.fin_contas
  ADD COLUMN IF NOT EXISTS departamento_id UUID REFERENCES public.departamentos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_fin_contas_departamento ON public.fin_contas(departamento_id);
