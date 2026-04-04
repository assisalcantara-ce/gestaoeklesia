-- Adiciona coluna de histórico de notas/comentários nos tickets da landing
ALTER TABLE public.support_tickets_landing
  ADD COLUMN IF NOT EXISTS notes JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.support_tickets_landing.notes IS 'Histórico de comentários internos: [{text, created_at, admin_label}]';
