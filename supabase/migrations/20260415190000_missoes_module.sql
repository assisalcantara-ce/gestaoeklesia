-- =====================================================================
-- Módulo: Missões
-- =====================================================================

-- 1. Projetos Missionários
CREATE TABLE IF NOT EXISTS public.missoes_projetos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id     UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  nome            TEXT NOT NULL,
  descricao       TEXT,
  pais_regiao     TEXT,
  status          TEXT NOT NULL DEFAULT 'planejado'
                    CHECK (status IN ('planejado','em_andamento','concluido','suspenso')),
  data_inicio     DATE,
  data_fim        DATE,
  meta_arrecadacao NUMERIC(12,2),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Missionários
CREATE TABLE IF NOT EXISTS public.missoes_missionarios (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id          UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  nome                 TEXT NOT NULL,
  foto_url             TEXT,
  campo_atuacao        TEXT,
  tipo                 TEXT NOT NULL DEFAULT 'sustentado'
                         CHECK (tipo IN ('sustentado','voluntario','enviado')),
  data_envio           DATE,
  contato              TEXT,
  status               TEXT NOT NULL DEFAULT 'ativo'
                         CHECK (status IN ('ativo','afastado','retornou')),
  member_id            UUID REFERENCES public.members(id) ON DELETE SET NULL,
  valor_sustento_mensal NUMERIC(12,2),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Eventos de Missões
CREATE TABLE IF NOT EXISTS public.missoes_eventos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  titulo      TEXT NOT NULL,
  tipo        TEXT NOT NULL DEFAULT 'culto_missionario'
                CHECK (tipo IN ('culto_missionario','conferencia','retiro','campanha','outro')),
  data_evento DATE NOT NULL,
  local       TEXT,
  projeto_id  UUID REFERENCES public.missoes_projetos(id) ON DELETE SET NULL,
  descricao   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Arrecadações
CREATE TABLE IF NOT EXISTS public.missoes_arrecadacoes (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id      UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  projeto_id       UUID REFERENCES public.missoes_projetos(id) ON DELETE SET NULL,
  data             DATE NOT NULL,
  valor            NUMERIC(12,2) NOT NULL CHECK (valor > 0),
  forma            TEXT NOT NULL DEFAULT 'oferta'
                     CHECK (forma IN ('oferta','dizimo_especifico','doacao','campanha','outro')),
  descricao        TEXT,
  congregacao_id   UUID REFERENCES public.congregacoes(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_missoes_projetos_ministry ON public.missoes_projetos(ministry_id);
CREATE INDEX IF NOT EXISTS idx_missoes_missionarios_ministry ON public.missoes_missionarios(ministry_id);
CREATE INDEX IF NOT EXISTS idx_missoes_eventos_ministry ON public.missoes_eventos(ministry_id);
CREATE INDEX IF NOT EXISTS idx_missoes_arrecadacoes_ministry ON public.missoes_arrecadacoes(ministry_id);
CREATE INDEX IF NOT EXISTS idx_missoes_arrecadacoes_projeto ON public.missoes_arrecadacoes(projeto_id);

-- RLS
ALTER TABLE public.missoes_projetos      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.missoes_missionarios  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.missoes_eventos       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.missoes_arrecadacoes  ENABLE ROW LEVEL SECURITY;

-- Policies: acesso somente ao próprio ministério
CREATE POLICY "missoes_projetos_ministry_access" ON public.missoes_projetos
  USING (ministry_id IN (
    SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    UNION
    SELECT id FROM public.ministries WHERE user_id = auth.uid()
  ));

CREATE POLICY "missoes_missionarios_ministry_access" ON public.missoes_missionarios
  USING (ministry_id IN (
    SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    UNION
    SELECT id FROM public.ministries WHERE user_id = auth.uid()
  ));

CREATE POLICY "missoes_eventos_ministry_access" ON public.missoes_eventos
  USING (ministry_id IN (
    SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    UNION
    SELECT id FROM public.ministries WHERE user_id = auth.uid()
  ));

CREATE POLICY "missoes_arrecadacoes_ministry_access" ON public.missoes_arrecadacoes
  USING (ministry_id IN (
    SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    UNION
    SELECT id FROM public.ministries WHERE user_id = auth.uid()
  ));

-- Triggers para updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_missoes_projetos_updated_at') THEN
    CREATE TRIGGER trg_missoes_projetos_updated_at
      BEFORE UPDATE ON public.missoes_projetos
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_missoes_missionarios_updated_at') THEN
    CREATE TRIGGER trg_missoes_missionarios_updated_at
      BEFORE UPDATE ON public.missoes_missionarios
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_missoes_eventos_updated_at') THEN
    CREATE TRIGGER trg_missoes_eventos_updated_at
      BEFORE UPDATE ON public.missoes_eventos
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_missoes_arrecadacoes_updated_at') THEN
    CREATE TRIGGER trg_missoes_arrecadacoes_updated_at
      BEFORE UPDATE ON public.missoes_arrecadacoes
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;
