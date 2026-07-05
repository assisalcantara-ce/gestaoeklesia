-- Migration: Criação da tabela system_integrity_logs
-- Tabela reutilizável por todos os módulos do Gestão Eklésia
-- para registrar inconsistências detectadas e corrigidas pelo SystemIntegrityService.

CREATE TABLE IF NOT EXISTS public.system_integrity_logs (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id   UUID        NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  module        VARCHAR(100) NOT NULL,                            -- Ex: "acolhimento", "tesouraria", "ebd"
  entity        VARCHAR(100) NOT NULL,                            -- Ex: "culto_registros"
  entity_id     UUID,                                             -- UUID do registro afetado (opcional)
  severity      VARCHAR(20)  NOT NULL DEFAULT 'warning'
                CHECK (severity IN ('warning', 'critical')),
  message       TEXT         NOT NULL,                            -- Descrição técnica/operacional
  resolved      BOOLEAN      NOT NULL DEFAULT false,
  resolved_at   TIMESTAMP WITH TIME ZONE,
  resolved_by   UUID         REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Índices para consultas do painel executivo
CREATE INDEX IF NOT EXISTS idx_system_integrity_ministry ON public.system_integrity_logs(ministry_id);
CREATE INDEX IF NOT EXISTS idx_system_integrity_module   ON public.system_integrity_logs(module);
CREATE INDEX IF NOT EXISTS idx_system_integrity_resolved ON public.system_integrity_logs(resolved);
CREATE INDEX IF NOT EXISTS idx_system_integrity_created  ON public.system_integrity_logs(created_at DESC);

-- Habilitar RLS
ALTER TABLE public.system_integrity_logs ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS baseadas no ministry_id do tenant
DROP POLICY IF EXISTS system_integrity_all ON public.system_integrity_logs;

CREATE POLICY system_integrity_all
  ON public.system_integrity_logs FOR ALL
  USING (
    ministry_id IN (
      SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    )
    OR
    ministry_id IN (
      SELECT id FROM public.ministries WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    ministry_id IN (
      SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    )
    OR
    ministry_id IN (
      SELECT id FROM public.ministries WHERE user_id = auth.uid()
    )
  );

-- Recarregar schema cache do PostgREST
NOTIFY pgrst, 'reload schema';
