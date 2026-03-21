-- Fix RPC output shape for check_pre_registration_duplicate
-- Ensures response always includes { conflict: boolean, field?: 'email'|'cpf_cnpj' }

CREATE OR REPLACE FUNCTION public.check_pre_registration_duplicate(
  p_email text,
  p_cpf_cnpj text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_doc text;
BEGIN
  v_email := public.normalize_email(p_email);
  IF v_email IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.pre_registrations pr
    WHERE pr.status IN ('pending', 'active')
      AND public.normalize_email(pr.email) = v_email
    LIMIT 1
  ) THEN
    RETURN jsonb_build_object('conflict', true, 'field', 'email');
  END IF;

  v_doc := public.normalize_cpf_cnpj(p_cpf_cnpj);
  IF v_doc IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.pre_registrations pr
    WHERE pr.status IN ('pending', 'active')
      AND public.normalize_cpf_cnpj(pr.cpf_cnpj) = v_doc
    LIMIT 1
  ) THEN
    RETURN jsonb_build_object('conflict', true, 'field', 'cpf_cnpj');
  END IF;

  RETURN jsonb_build_object('conflict', false);
END;
$$;

REVOKE ALL ON FUNCTION public.check_pre_registration_duplicate(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_pre_registration_duplicate(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.check_pre_registration_duplicate(text, text) TO postgres;
