-- ==============================================================================
-- MIGRATION: 20261029140000_modulo_escala_pregadores.sql
-- Módulo: Secretaria → Escala de Pregadores (Etapa 1 - Banco de Dados)
-- ==============================================================================
-- Descrição:
-- 1. Criação da tabela public.agenda_escala_pregadores para designação de pregadores
--    exclusivamente a partir de eventos reais existentes em public.agenda_eventos.
-- 2. Integridade estrita de tenant (ministry_id) entre escala, evento e ministro.
-- 3. Prevenção no motor do banco de atribuições ativas duplicadas por evento.
-- 4. Prevenção transacional contra choques de horário do mesmo ministro.
-- 5. Preservação histórica permanente de substituições e cancelamentos com snapshots imutáveis.
-- 6. Políticas de RLS estritas com isolamento entre Secretaria-Geral e Secretaria Local.
-- 7. Nenhuma permissão pública (anônima) concedida.
-- ==============================================================================

BEGIN;

-- 1. TABELA PRINCIPAL
CREATE TABLE IF NOT EXISTS public.agenda_escala_pregadores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  
  -- Vínculo Estrito com o Evento Real da Agenda Oficial
  agenda_evento_id UUID REFERENCES public.agenda_eventos(id) ON DELETE SET NULL,
  
  -- Pregador Oficial: Exclusivamente Ministro de public.members
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE RESTRICT,

  -- Ciclo de Vida da Atribuição
  status TEXT NOT NULL DEFAULT 'escalado'
    CHECK (status IN ('escalado', 'confirmado', 'substituido', 'cancelado')),

  -- Snapshots Históricos Imutáveis (Preservados mesmo se o evento for excluído da Agenda)
  evento_titulo_snapshot TEXT NOT NULL,
  evento_data_inicio_snapshot TIMESTAMPTZ NOT NULL,
  evento_data_fim_snapshot TIMESTAMPTZ,
  evento_church_id_snapshot UUID REFERENCES public.congregacoes(id) ON DELETE SET NULL,
  evento_local_snapshot TEXT,

  -- Rastreabilidade de Substituição e Cancelamento
  motivo_alteracao TEXT,
  substituido_por_member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
  data_alteracao TIMESTAMPTZ,

  -- Dados Homiléticos Opcionais
  tema_mensagem TEXT,
  texto_biblico TEXT,
  observacoes TEXT,

  -- Auditoria
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. ÍNDICES DE PERFORMANCE E INTEGRIDADE
-- Regra de Ouro: Exatamente UMA atribuição ATIVA por evento na Agenda
CREATE UNIQUE INDEX IF NOT EXISTS uq_escala_evento_ativa 
  ON public.agenda_escala_pregadores(agenda_evento_id) 
  WHERE status IN ('escalado', 'confirmado');

CREATE INDEX IF NOT EXISTS idx_escala_ministry_status 
  ON public.agenda_escala_pregadores(ministry_id, status);

CREATE INDEX IF NOT EXISTS idx_escala_ministro_busca 
  ON public.agenda_escala_pregadores(ministry_id, member_id, evento_data_inicio_snapshot DESC);

CREATE INDEX IF NOT EXISTS idx_escala_evento_fk 
  ON public.agenda_escala_pregadores(agenda_evento_id);

-- 3. TRIGGER FUNCTION: VALIDAÇÃO DE INTEGRIDADE, ELEGIBILIDADE E CONFLITOS DE HORÁRIO
CREATE OR REPLACE FUNCTION public.fn_validar_escala_pregadores()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_evento RECORD;
  v_membro RECORD;
  v_conflito RECORD;
  v_data_inicio TIMESTAMPTZ;
  v_data_fim TIMESTAMPTZ;
  v_is_service_role BOOLEAN;
BEGIN
  v_is_service_role := (current_setting('role', true) = 'service_role');

  -- A. OBRIGATORIEDADE DE EVENTO REAL NA CRIAÇÃO OU REATIVAÇÃO
  IF NEW.agenda_evento_id IS NULL AND NEW.status IN ('escalado', 'confirmado') THEN
    RAISE EXCEPTION 'A escala de pregador deve estar vinculada a um evento real da Agenda Oficial.'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Se possui evento vinculado, consulta os dados reais atuais da Agenda
  IF NEW.agenda_evento_id IS NOT NULL THEN
    SELECT id, ministry_id, church_id, titulo, data_inicio, data_fim, local, status
    INTO v_evento
    FROM public.agenda_eventos
    WHERE id = NEW.agenda_evento_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'O evento informado para a escala não existe na Agenda Oficial.'
        USING ERRCODE = 'foreign_key_violation';
    END IF;

    -- B. INTEGRIDADE DE TENANT (ministry_id)
    IF v_evento.ministry_id <> NEW.ministry_id THEN
      RAISE EXCEPTION 'Violação de isolamento: O evento pertence a outro ministério.'
        USING ERRCODE = 'integrity_constraint_violation';
    END IF;

    -- Não permite escalar em evento cancelado
    IF v_evento.status = 'cancelado' AND NEW.status IN ('escalado', 'confirmado') THEN
      RAISE EXCEPTION 'Não é permitido escalar pregadores para um evento cancelado na Agenda.'
        USING ERRCODE = 'check_violation';
    END IF;

    -- Preenche os snapshots automaticamente com os dados oficiais da Agenda
    NEW.evento_titulo_snapshot := v_evento.titulo;
    NEW.evento_data_inicio_snapshot := v_evento.data_inicio;
    NEW.evento_data_fim_snapshot := COALESCE(v_evento.data_fim, v_evento.data_inicio + interval '2 hours');
    NEW.evento_church_id_snapshot := v_evento.church_id;
    NEW.evento_local_snapshot := v_evento.local;
  END IF;

  v_data_inicio := NEW.evento_data_inicio_snapshot;
  v_data_fim := COALESCE(NEW.evento_data_fim_snapshot, v_data_inicio + interval '2 hours');

  -- C. VALIDAÇÃO DE ELEGIBILIDADE MINISTERIAL DO PREGADOR
  SELECT id, ministry_id, name, status, role, tipo_cadastro, cargo_ministerial
  INTO v_membro
  FROM public.members
  WHERE id = NEW.member_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'O ministro informado não existe no cadastro de membros.'
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  IF v_membro.ministry_id <> NEW.ministry_id THEN
    RAISE EXCEPTION 'Violação de isolamento: O ministro pertence a outro ministério.'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  -- Valida se é ministro ativo
  IF LOWER(COALESCE(v_membro.status, '')) NOT IN ('active', 'ativo') THEN
    RAISE EXCEPTION 'O ministro % encontra-se com cadastro inativo ou não regularizado.', v_membro.name
      USING ERRCODE = 'check_violation';
  END IF;

  IF LOWER(COALESCE(v_membro.role, '')) <> 'ministro' AND LOWER(COALESCE(v_membro.tipo_cadastro, '')) <> 'ministro' THEN
    RAISE EXCEPTION 'O membro % não possui o perfil oficial de ministro habilitado para escala.', v_membro.name
      USING ERRCODE = 'check_violation';
  END IF;

  -- D. VALIDAÇÃO DO MINISTRO SUBSTITUTO (se houver)
  IF NEW.substituido_por_member_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.members 
      WHERE id = NEW.substituido_por_member_id 
        AND ministry_id = NEW.ministry_id
        AND LOWER(status) IN ('active', 'ativo')
        AND (LOWER(role) = 'ministro' OR LOWER(tipo_cadastro) = 'ministro')
    ) THEN
      RAISE EXCEPTION 'O ministro substituto indicado é inválido, inativo ou não possui perfil ministerial.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  -- E. PREVENÇÃO TRANSACIONAL DE CHOQUE DE HORÁRIO DO MESMO MINISTRO
  -- Somente valida se a escala for ativa ('escalado' ou 'confirmado')
  IF NEW.status IN ('escalado', 'confirmado') THEN
    -- Bloqueio consultivo transacional no ministro para serialização estrita em operações concorrentes
    PERFORM pg_advisory_xact_lock(hashtext('escala:ministro:' || NEW.member_id::text));

    -- Consulta usando os horários ATUAIS de agenda_eventos para eventos ativos,
    -- recorrendo ao snapshot apenas quando o evento foi excluído da agenda (agenda_evento_id IS NULL)
    SELECT 
      ep.id, 
      COALESCE(ae.titulo, ep.evento_titulo_snapshot) AS evento_titulo,
      COALESCE(ae.data_inicio, ep.evento_data_inicio_snapshot) AS conflito_data_inicio
    INTO v_conflito
    FROM public.agenda_escala_pregadores ep
    LEFT JOIN public.agenda_eventos ae ON ae.id = ep.agenda_evento_id
    WHERE ep.ministry_id = NEW.ministry_id
      AND ep.member_id = NEW.member_id
      AND ep.status IN ('escalado', 'confirmado')
      AND ep.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND (ae.id IS NULL OR ae.status <> 'cancelado') -- Ignora eventos cancelados na Agenda
      AND (
        COALESCE(ae.data_inicio, ep.evento_data_inicio_snapshot) < v_data_fim
        AND COALESCE(ae.data_fim, ae.data_inicio + interval '2 hours', ep.evento_data_fim_snapshot, ep.evento_data_inicio_snapshot + interval '2 hours') > v_data_inicio
      )
    LIMIT 1;

    IF FOUND THEN
      RAISE EXCEPTION 'Choque de horário: O ministro % já está escalado para o evento "%" em %.',
        v_membro.name, v_conflito.evento_titulo, 
        to_char(timezone('America/Belem', v_conflito.conflito_data_inicio), 'DD/MM/YYYY HH24:MI')
        USING ERRCODE = 'exclusion_violation';
    END IF;
  END IF;

  NEW.updated_at := timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_escala_pregadores ON public.agenda_escala_pregadores;
CREATE TRIGGER trg_validar_escala_pregadores
  BEFORE INSERT OR UPDATE ON public.agenda_escala_pregadores
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_validar_escala_pregadores();

-- 4. SINCRONIZAÇÃO DE SNAPSHOTS QUANDO A AGENDA FOR ALTERADA
CREATE OR REPLACE FUNCTION public.fn_sync_escala_on_agenda_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Se o evento da agenda for alterado (título, datas, congregação, local ou status)
  IF (OLD.titulo IS DISTINCT FROM NEW.titulo) OR
     (OLD.data_inicio IS DISTINCT FROM NEW.data_inicio) OR
     (OLD.data_fim IS DISTINCT FROM NEW.data_fim) OR
     (OLD.church_id IS DISTINCT FROM NEW.church_id) OR
     (OLD.local IS DISTINCT FROM NEW.local) THEN

    UPDATE public.agenda_escala_pregadores
    SET 
      evento_titulo_snapshot = NEW.titulo,
      evento_data_inicio_snapshot = NEW.data_inicio,
      evento_data_fim_snapshot = COALESCE(NEW.data_fim, NEW.data_inicio + interval '2 hours'),
      evento_church_id_snapshot = NEW.church_id,
      evento_local_snapshot = NEW.local,
      updated_at = timezone('utc'::text, now())
    WHERE agenda_evento_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_escala_on_agenda_update ON public.agenda_eventos;
CREATE TRIGGER trg_sync_escala_on_agenda_update
  AFTER UPDATE ON public.agenda_eventos
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_sync_escala_on_agenda_update();

-- 5. HABILITAÇÃO DE ROW LEVEL SECURITY (RLS)
ALTER TABLE public.agenda_escala_pregadores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "escala_pregadores_select" ON public.agenda_escala_pregadores;
CREATE POLICY "escala_pregadores_select" ON public.agenda_escala_pregadores
FOR SELECT
USING (
  -- Tenant matching
  (
    ministry_id IN (
      SELECT mu.ministry_id 
      FROM public.ministry_users mu 
      WHERE mu.user_id = auth.uid() 
        AND COALESCE(mu.is_active, true) = true
      UNION
      SELECT m.id 
      FROM public.ministries m 
      WHERE m.user_id = auth.uid()
    )
  )
  AND (
    -- Administrador / Presidência / Secretaria-Geral vê todas as escalas do tenant
    public.is_agenda_admin_or_geral(ministry_id)
    OR
    -- Secretaria Local vê apenas escalas da sua congregação oficial
    (
      evento_church_id_snapshot IS NOT NULL
      AND public.is_user_authorized_church(ministry_id, evento_church_id_snapshot)
    )
  )
);

DROP POLICY IF EXISTS "escala_pregadores_insert" ON public.agenda_escala_pregadores;
CREATE POLICY "escala_pregadores_insert" ON public.agenda_escala_pregadores
FOR INSERT
WITH CHECK (
  (
    ministry_id IN (
      SELECT mu.ministry_id 
      FROM public.ministry_users mu 
      WHERE mu.user_id = auth.uid() 
        AND COALESCE(mu.is_active, true) = true
      UNION
      SELECT m.id 
      FROM public.ministries m 
      WHERE m.user_id = auth.uid()
    )
  )
  AND (
    public.is_agenda_admin_or_geral(ministry_id)
    OR
    (
      -- Secretaria Local só pode inserir em eventos da sua congregação
      EXISTS (
        SELECT 1 FROM public.agenda_eventos ae
        WHERE ae.id = agenda_evento_id
          AND ae.church_id IS NOT NULL
          AND public.is_user_authorized_church(ae.ministry_id, ae.church_id)
      )
    )
  )
);

DROP POLICY IF EXISTS "escala_pregadores_update" ON public.agenda_escala_pregadores;
CREATE POLICY "escala_pregadores_update" ON public.agenda_escala_pregadores
FOR UPDATE
USING (
  (
    ministry_id IN (
      SELECT mu.ministry_id 
      FROM public.ministry_users mu 
      WHERE mu.user_id = auth.uid() 
        AND COALESCE(mu.is_active, true) = true
      UNION
      SELECT m.id 
      FROM public.ministries m 
      WHERE m.user_id = auth.uid()
    )
  )
  AND (
    public.is_agenda_admin_or_geral(ministry_id)
    OR
    (
      evento_church_id_snapshot IS NOT NULL
      AND public.is_user_authorized_church(ministry_id, evento_church_id_snapshot)
    )
  )
)
WITH CHECK (
  (
    ministry_id IN (
      SELECT mu.ministry_id 
      FROM public.ministry_users mu 
      WHERE mu.user_id = auth.uid() 
        AND COALESCE(mu.is_active, true) = true
      UNION
      SELECT m.id 
      FROM public.ministries m 
      WHERE m.user_id = auth.uid()
    )
  )
  AND (
    public.is_agenda_admin_or_geral(ministry_id)
    OR
    (
      evento_church_id_snapshot IS NOT NULL
      AND public.is_user_authorized_church(ministry_id, evento_church_id_snapshot)
    )
  )
);

DROP POLICY IF EXISTS "escala_pregadores_delete" ON public.agenda_escala_pregadores;
CREATE POLICY "escala_pregadores_delete" ON public.agenda_escala_pregadores
FOR DELETE
USING (
  (
    ministry_id IN (
      SELECT mu.ministry_id 
      FROM public.ministry_users mu 
      WHERE mu.user_id = auth.uid() 
        AND COALESCE(mu.is_active, true) = true
      UNION
      SELECT m.id 
      FROM public.ministries m 
      WHERE m.user_id = auth.uid()
    )
  )
  AND (
    public.is_agenda_admin_or_geral(ministry_id)
    OR
    (
      evento_church_id_snapshot IS NOT NULL
      AND public.is_user_authorized_church(ministry_id, evento_church_id_snapshot)
    )
  )
);

COMMIT;
