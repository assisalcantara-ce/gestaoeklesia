-- ═══════════════════════════════════════════════════════════════════════════════
-- Módulo Reuniões Ministeriais (Controle de Presença, Faltas e Advertências)
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─── 1. Helper Functions de Acesso e Permissão para Reuniões ─────────────────
CREATE OR REPLACE FUNCTION public.reunioes_user_has_access(p_ministry_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.ministries m
    WHERE m.id = p_ministry_id
      AND m.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public.ministry_users mu
    WHERE mu.user_id = auth.uid()
      AND mu.ministry_id = p_ministry_id
      AND (
        lower(coalesce(mu.role, '')) IN ('admin', 'administrador', 'manager', 'pastor', 'secretario', 'secretario_geral')
        OR coalesce(mu.permissions, '[]'::jsonb) @> '["ADMINISTRADOR"]'::jsonb
        OR coalesce(mu.permissions, '[]'::jsonb) @> '["REUNIOES"]'::jsonb
        OR coalesce(mu.permissions, '[]'::jsonb) @> '["SECRETARIA"]'::jsonb
        OR coalesce(mu.permissions, '[]'::jsonb) @> '["PRESIDENCIA"]'::jsonb
      )
  );
$$;

-- ─── 2. Tabela: reunioes ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reunioes (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id            UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  congregacao_id         UUID REFERENCES public.congregacoes(id) ON DELETE SET NULL,
  titulo                 TEXT NOT NULL,
  pauta                  TEXT,
  local                  TEXT NOT NULL,
  data_reuniao           DATE NOT NULL,
  horario_inicio         TIME NOT NULL,
  horario_limite_entrada TIME NOT NULL,
  limite_checkin_em      TIMESTAMPTZ NOT NULL,
  status                 VARCHAR(20) NOT NULL DEFAULT 'agendada'
                         CHECK (status IN ('agendada', 'em_andamento', 'encerrada', 'cancelada')),
  iniciada_em            TIMESTAMPTZ,
  iniciada_por           UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  encerrada_em           TIMESTAMPTZ,
  encerrada_por          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  total_esperados        INTEGER NOT NULL DEFAULT 0,
  total_presentes        INTEGER NOT NULL DEFAULT 0,
  total_ausentes         INTEGER NOT NULL DEFAULT 0,
  total_justificados     INTEGER NOT NULL DEFAULT 0,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reunioes_ministry_data ON public.reunioes(ministry_id, data_reuniao DESC);
CREATE INDEX IF NOT EXISTS idx_reunioes_status ON public.reunioes(ministry_id, status);

-- ─── 3. Tabela: reunioes_participantes (Snapshot de Ministros Convocados) ────
CREATE TABLE IF NOT EXISTS public.reunioes_participantes (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reuniao_id                  UUID NOT NULL REFERENCES public.reunioes(id) ON DELETE CASCADE,
  ministry_id                 UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  member_id                   UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  nome_ministro_snapshot      TEXT NOT NULL,
  cargo_snapshot              TEXT NOT NULL,
  congregacao_id_snapshot     UUID REFERENCES public.congregacoes(id) ON DELETE SET NULL,
  nome_congregacao_snapshot   TEXT,
  area_snapshot               TEXT,
  carteirinha_numero_snapshot TEXT,
  unique_id_snapshot          TEXT,
  status_presenca             VARCHAR(20) NOT NULL DEFAULT 'pendente'
                              CHECK (status_presenca IN ('pendente', 'presente', 'falta', 'falta_justificada')),
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (reuniao_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_reunioes_part_reuniao ON public.reunioes_participantes(reuniao_id, status_presenca);
CREATE INDEX IF NOT EXISTS idx_reunioes_part_member ON public.reunioes_participantes(member_id);
CREATE INDEX IF NOT EXISTS idx_reunioes_part_unique_id ON public.reunioes_participantes(reuniao_id, unique_id_snapshot);

-- ─── 4. Tabela: reunioes_checkins (Presenças Registradas via QR Code) ────────
CREATE TABLE IF NOT EXISTS public.reunioes_checkins (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reuniao_id        UUID NOT NULL REFERENCES public.reunioes(id) ON DELETE CASCADE,
  participante_id   UUID NOT NULL REFERENCES public.reunioes_participantes(id) ON DELETE CASCADE,
  member_id         UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  ministry_id       UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  data_hora_checkin TIMESTAMPTZ NOT NULL DEFAULT now(),
  metodo_leitura    VARCHAR(30) NOT NULL DEFAULT 'qrcode_carteirinha'
                    CHECK (metodo_leitura IN ('qrcode_carteirinha', 'manual_secretaria', 'busca_nome')),
  registrado_por    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  dispositivo_info  TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (reuniao_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_reunioes_checkins_reuniao ON public.reunioes_checkins(reuniao_id, data_hora_checkin DESC);
CREATE INDEX IF NOT EXISTS idx_reunioes_checkins_member ON public.reunioes_checkins(member_id);

-- ─── 5. Tabela: reunioes_faltas (Registro Oficial de Ausências) ───────────────
CREATE TABLE IF NOT EXISTS public.reunioes_faltas (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reuniao_id         UUID NOT NULL REFERENCES public.reunioes(id) ON DELETE CASCADE,
  participante_id    UUID NOT NULL REFERENCES public.reunioes_participantes(id) ON DELETE CASCADE,
  member_id          UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  ministry_id        UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  data_geracao_falta TIMESTAMPTZ NOT NULL DEFAULT now(),
  situacao           VARCHAR(20) NOT NULL DEFAULT 'registrada'
                     CHECK (situacao IN ('registrada', 'justificada', 'abonada')),
  gerada_por         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (reuniao_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_reunioes_faltas_reuniao ON public.reunioes_faltas(reuniao_id, situacao);
CREATE INDEX IF NOT EXISTS idx_reunioes_faltas_member ON public.reunioes_faltas(member_id, data_geracao_falta DESC);

-- ─── 6. Tabela: reunioes_justificativas (Auditoria de Justificativas) ─────────
CREATE TABLE IF NOT EXISTS public.reunioes_justificativas (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  falta_id            UUID NOT NULL REFERENCES public.reunioes_faltas(id) ON DELETE CASCADE,
  reuniao_id          UUID NOT NULL REFERENCES public.reunioes(id) ON DELETE CASCADE,
  member_id           UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  ministry_id         UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  tipo_justificativa  VARCHAR(30) NOT NULL DEFAULT 'outros'
                      CHECK (tipo_justificativa IN ('antecipada', 'no_checkin', 'manuscrita_secretaria', 'atestado_medico', 'trabalho', 'viagem', 'outros')),
  motivo              TEXT NOT NULL,
  anexo_documento_url TEXT,
  registrado_em       TIMESTAMPTZ NOT NULL DEFAULT now(),
  registrado_por      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  aprovado_por        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reunioes_just_falta ON public.reunioes_justificativas(falta_id);
CREATE INDEX IF NOT EXISTS idx_reunioes_just_reuniao ON public.reunioes_justificativas(reuniao_id);
CREATE INDEX IF NOT EXISTS idx_reunioes_just_member ON public.reunioes_justificativas(member_id);

-- ─── 7. Tabela: reunioes_advertencias (Controle e Despacho de Cartas) ─────────
CREATE TABLE IF NOT EXISTS public.reunioes_advertencias (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  falta_id           UUID NOT NULL REFERENCES public.reunioes_faltas(id) ON DELETE CASCADE,
  reuniao_id         UUID NOT NULL REFERENCES public.reunioes(id) ON DELETE CASCADE,
  member_id          UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  ministry_id        UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  numero_protocolo   VARCHAR(60) NOT NULL,
  pdf_url            TEXT,
  email_destinatario TEXT,
  status_envio       VARCHAR(20) NOT NULL DEFAULT 'gerada'
                     CHECK (status_envio IN ('pendente', 'gerada', 'enviada', 'erro_envio', 'entregue_manual')),
  enviada_em         TIMESTAMPTZ,
  erro_mensagem      TEXT,
  entregue_em_maos   BOOLEAN NOT NULL DEFAULT false,
  recebido_por_nome  TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (falta_id)
);

CREATE INDEX IF NOT EXISTS idx_reunioes_adv_reuniao ON public.reunioes_advertencias(reuniao_id, status_envio);
CREATE INDEX IF NOT EXISTS idx_reunioes_adv_member ON public.reunioes_advertencias(member_id);
CREATE INDEX IF NOT EXISTS idx_reunioes_adv_status ON public.reunioes_advertencias(status_envio);

-- ─── 8. Tabela: reunioes_painel_tokens (Tokens Seguros para Telão/TV) ─────────
CREATE TABLE IF NOT EXISTS public.reunioes_painel_tokens (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reuniao_id       UUID NOT NULL REFERENCES public.reunioes(id) ON DELETE CASCADE,
  ministry_id      UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  token_hash       TEXT NOT NULL UNIQUE,
  status           VARCHAR(30) NOT NULL DEFAULT 'ativo'
                   CHECK (status IN ('ativo', 'expirado', 'revogado', 'inativado_encerramento')),
  expira_em        TIMESTAMPTZ NOT NULL,
  revogado_em      TIMESTAMPTZ,
  revogado_por     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ultimo_acesso_em TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reunioes_tokens_hash ON public.reunioes_painel_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_reunioes_tokens_reuniao ON public.reunioes_painel_tokens(reuniao_id, status);

-- ─── 9. Tabela: reunioes_auditoria (Trilha de Auditoria Administrativa) ───────
CREATE TABLE IF NOT EXISTS public.reunioes_auditoria (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id     UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  reuniao_id      UUID REFERENCES public.reunioes(id) ON DELETE SET NULL,
  usuario_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  acao            VARCHAR(60) NOT NULL,
  tabela_afetada  VARCHAR(60) NOT NULL,
  registro_id     UUID NOT NULL,
  estado_anterior JSONB,
  estado_novo     JSONB,
  ip_address      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reunioes_auditoria_reuniao ON public.reunioes_auditoria(reuniao_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reunioes_auditoria_ministry ON public.reunioes_auditoria(ministry_id, created_at DESC);

-- ─── 10. RPC: Procedimento Transacional de Encerramento da Reunião ───────────
CREATE OR REPLACE FUNCTION public.encerrar_reuniao_ministerial(
  p_reuniao_id UUID,
  p_user_id    UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reuniao            RECORD;
  v_ministry_id        UUID;
  v_total_esperados    INTEGER := 0;
  v_total_presentes    INTEGER := 0;
  v_total_ausentes     INTEGER := 0;
  v_total_justificados INTEGER := 0;
  v_part               RECORD;
  v_falta_id           UUID;
  v_ano                TEXT;
  v_seq                INTEGER := 0;
  v_protocolo          TEXT;
BEGIN
  -- 1. Validar e travar a reunião para encerramento
  SELECT * INTO v_reuniao
  FROM public.reunioes
  WHERE id = p_reuniao_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Reunião não encontrada.');
  END IF;

  IF v_reuniao.status = 'encerrada' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Reunião já se encontra encerrada.');
  END IF;

  v_ministry_id := v_reuniao.ministry_id;
  v_ano := to_char(coalesce(v_reuniao.data_reuniao, CURRENT_DATE), 'YYYY');

  -- 2. Processar ausentes: converter pendentes em falta e inserir em reunioes_faltas
  FOR v_part IN
    SELECT rp.*
    FROM public.reunioes_participantes rp
    WHERE rp.reuniao_id = p_reuniao_id
      AND rp.status_presenca = 'pendente'
    FOR UPDATE
  LOOP
    -- Atualizar participante para falta
    UPDATE public.reunioes_participantes
    SET status_presenca = 'falta'
    WHERE id = v_part.id;

    -- Inserir falta oficial
    INSERT INTO public.reunioes_faltas (
      reuniao_id,
      participante_id,
      member_id,
      ministry_id,
      data_geracao_falta,
      situacao,
      gerada_por
    )
    VALUES (
      p_reuniao_id,
      v_part.id,
      v_part.member_id,
      v_ministry_id,
      now(),
      'registrada',
      p_user_id
    )
    ON CONFLICT (reuniao_id, member_id) DO UPDATE
      SET situacao = 'registrada', updated_at = now()
    RETURNING id INTO v_falta_id;

    -- Gerar protocolo da advertência
    v_seq := v_seq + 1;
    v_protocolo := 'ADV-' || v_ano || '/' || lpad(v_seq::text, 4, '0') || '-' || substr(replace(v_part.member_id::text, '-', ''), 1, 6);

    -- Inserir advertência pendente de despacho
    INSERT INTO public.reunioes_advertencias (
      falta_id,
      reuniao_id,
      member_id,
      ministry_id,
      numero_protocolo,
      status_envio
    )
    VALUES (
      v_falta_id,
      p_reuniao_id,
      v_part.member_id,
      v_ministry_id,
      v_protocolo,
      'gerada'
    )
    ON CONFLICT (falta_id) DO NOTHING;
  END LOOP;

  -- 3. Calcular métricas finais consolidadas
  SELECT count(*) INTO v_total_esperados
  FROM public.reunioes_participantes
  WHERE reuniao_id = p_reuniao_id;

  SELECT count(*) INTO v_total_presentes
  FROM public.reunioes_participantes
  WHERE reuniao_id = p_reuniao_id AND status_presenca = 'presente';

  SELECT count(*) INTO v_total_ausentes
  FROM public.reunioes_participantes
  WHERE reuniao_id = p_reuniao_id AND status_presenca IN ('falta', 'falta_justificada');

  SELECT count(*) INTO v_total_justificados
  FROM public.reunioes_participantes
  WHERE reuniao_id = p_reuniao_id AND status_presenca = 'falta_justificada';

  -- 4. Atualizar registro da reunião para encerrada
  UPDATE public.reunioes
  SET status             = 'encerrada',
      encerrada_em       = now(),
      encerrada_por      = p_user_id,
      total_esperados    = v_total_esperados,
      total_presentes    = v_total_presentes,
      total_ausentes     = v_total_ausentes,
      total_justificados = v_total_justificados,
      updated_at         = now()
  WHERE id = p_reuniao_id;

  -- 5. Inativar tokens do painel público
  UPDATE public.reunioes_painel_tokens
  SET status = 'inativado_encerramento'
  WHERE reuniao_id = p_reuniao_id
    AND status = 'ativo';

  -- 6. Gravar auditoria
  INSERT INTO public.reunioes_auditoria (
    ministry_id,
    reuniao_id,
    usuario_id,
    acao,
    tabela_afetada,
    registro_id,
    estado_anterior,
    estado_novo
  )
  VALUES (
    v_ministry_id,
    p_reuniao_id,
    p_user_id,
    'ENCERRAR_REUNIAO',
    'reunioes',
    p_reuniao_id,
    jsonb_build_object('status', v_reuniao.status),
    jsonb_build_object(
      'status', 'encerrada',
      'total_esperados', v_total_esperados,
      'total_presentes', v_total_presentes,
      'total_ausentes', v_total_ausentes,
      'total_justificados', v_total_justificados
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'reuniao_id', p_reuniao_id,
    'total_esperados', v_total_esperados,
    'total_presentes', v_total_presentes,
    'total_ausentes', v_total_ausentes,
    'total_justificados', v_total_justificados
  );
END;
$$;

-- ─── 11. Políticas RLS (Row Level Security) ──────────────────────────────────
ALTER TABLE public.reunioes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reunioes_participantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reunioes_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reunioes_faltas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reunioes_justificativas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reunioes_advertencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reunioes_painel_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reunioes_auditoria ENABLE ROW LEVEL SECURITY;

-- reunioes
DROP POLICY IF EXISTS reunioes_all ON public.reunioes;
CREATE POLICY reunioes_all ON public.reunioes
  FOR ALL USING (public.reunioes_user_has_access(ministry_id))
  WITH CHECK (public.reunioes_user_has_access(ministry_id));

-- reunioes_participantes
DROP POLICY IF EXISTS reunioes_part_all ON public.reunioes_participantes;
CREATE POLICY reunioes_part_all ON public.reunioes_participantes
  FOR ALL USING (public.reunioes_user_has_access(ministry_id))
  WITH CHECK (public.reunioes_user_has_access(ministry_id));

-- reunioes_checkins
DROP POLICY IF EXISTS reunioes_checkins_all ON public.reunioes_checkins;
CREATE POLICY reunioes_checkins_all ON public.reunioes_checkins
  FOR ALL USING (public.reunioes_user_has_access(ministry_id))
  WITH CHECK (public.reunioes_user_has_access(ministry_id));

-- reunioes_faltas
DROP POLICY IF EXISTS reunioes_faltas_all ON public.reunioes_faltas;
CREATE POLICY reunioes_faltas_all ON public.reunioes_faltas
  FOR ALL USING (public.reunioes_user_has_access(ministry_id))
  WITH CHECK (public.reunioes_user_has_access(ministry_id));

-- reunioes_justificativas
DROP POLICY IF EXISTS reunioes_just_all ON public.reunioes_justificativas;
CREATE POLICY reunioes_just_all ON public.reunioes_justificativas
  FOR ALL USING (public.reunioes_user_has_access(ministry_id))
  WITH CHECK (public.reunioes_user_has_access(ministry_id));

-- reunioes_advertencias
DROP POLICY IF EXISTS reunioes_adv_all ON public.reunioes_advertencias;
CREATE POLICY reunioes_adv_all ON public.reunioes_advertencias
  FOR ALL USING (public.reunioes_user_has_access(ministry_id))
  WITH CHECK (public.reunioes_user_has_access(ministry_id));

-- reunioes_painel_tokens
DROP POLICY IF EXISTS reunioes_tokens_all ON public.reunioes_painel_tokens;
CREATE POLICY reunioes_tokens_all ON public.reunioes_painel_tokens
  FOR ALL USING (public.reunioes_user_has_access(ministry_id))
  WITH CHECK (public.reunioes_user_has_access(ministry_id));

-- reunioes_auditoria
DROP POLICY IF EXISTS reunioes_auditoria_all ON public.reunioes_auditoria;
CREATE POLICY reunioes_auditoria_all ON public.reunioes_auditoria
  FOR ALL USING (public.reunioes_user_has_access(ministry_id))
  WITH CHECK (public.reunioes_user_has_access(ministry_id));

COMMIT;
