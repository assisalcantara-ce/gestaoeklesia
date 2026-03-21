-- Garante permissões de acesso para as tabelas de Divisões (RLS ainda controla o que cada usuário pode ver/alterar)
-- Motivo: sem GRANT explícito, o client pode receber "permission denied" mesmo com policies.

DO $$
BEGIN
  IF to_regclass('public.supervisoes') IS NOT NULL THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.supervisoes TO authenticated;
  END IF;

  IF to_regclass('public.campos') IS NOT NULL THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.campos TO authenticated;
  END IF;

  IF to_regclass('public.congregacoes') IS NOT NULL THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.congregacoes TO authenticated;
  END IF;
END $$;
