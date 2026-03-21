-- Prevent duplicate pre-registrations by email/CPF/CNPJ
-- - email: case-insensitive (lower(trim()))
-- - cpf_cnpj: digits-only
-- Enforced for statuses: pending, active

CREATE OR REPLACE FUNCTION public.normalize_email(p_email text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NULLIF(lower(btrim(p_email)), '');
$$;

CREATE OR REPLACE FUNCTION public.normalize_cpf_cnpj(p_doc text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NULLIF(regexp_replace(p_doc, '\\D', '', 'g'), '');
$$;

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

CREATE OR REPLACE FUNCTION public.prevent_duplicate_pre_registrations()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_email text;
  v_doc text;
BEGIN
  -- Only enforce for active/pending workflows.
  IF COALESCE(NEW.status, '') NOT IN ('pending', 'active') THEN
    RETURN NEW;
  END IF;

  v_email := public.normalize_email(NEW.email);
  IF v_email IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext('pre_reg:email:' || v_email));

    IF EXISTS (
      SELECT 1
      FROM public.pre_registrations pr
      WHERE pr.id IS DISTINCT FROM NEW.id
        AND pr.status IN ('pending', 'active')
        AND public.normalize_email(pr.email) = v_email
      LIMIT 1
    ) THEN
      RAISE EXCEPTION USING
        ERRCODE = '23505',
        MESSAGE = 'Já existe um pré-cadastro em andamento para este email.';
    END IF;
  END IF;

  v_doc := public.normalize_cpf_cnpj(NEW.cpf_cnpj);
  IF v_doc IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext('pre_reg:doc:' || v_doc));

    IF EXISTS (
      SELECT 1
      FROM public.pre_registrations pr
      WHERE pr.id IS DISTINCT FROM NEW.id
        AND pr.status IN ('pending', 'active')
        AND public.normalize_cpf_cnpj(pr.cpf_cnpj) = v_doc
      LIMIT 1
    ) THEN
      RAISE EXCEPTION USING
        ERRCODE = '23505',
        MESSAGE = 'Já existe um pré-cadastro em andamento para este CPF/CNPJ.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pre_registrations_prevent_duplicates ON public.pre_registrations;

CREATE TRIGGER trg_pre_registrations_prevent_duplicates
BEFORE INSERT OR UPDATE OF email, cpf_cnpj, status
ON public.pre_registrations
FOR EACH ROW
EXECUTE FUNCTION public.prevent_duplicate_pre_registrations();
