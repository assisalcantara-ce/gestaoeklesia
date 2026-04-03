-- ============================================
-- Fix: adicionar congregacao_id e supervisao_id em ministry_users
-- (colunas que deveriam ter sido criadas em 20260115_create_supervisao_table.sql)
-- ============================================

-- Garante que a tabela supervisoes existe antes de referenciar
CREATE TABLE IF NOT EXISTS public.supervisoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  nome VARCHAR(255) NOT NULL,
  descricao TEXT,
  cidade VARCHAR(100),
  endereco TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(ministry_id, nome)
);

CREATE INDEX IF NOT EXISTS idx_supervisoes_ministry_id ON public.supervisoes(ministry_id);

-- Garante que a tabela congregacoes existe antes de referenciar
CREATE TABLE IF NOT EXISTS public.congregacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  supervisao_id UUID REFERENCES public.supervisoes(id) ON DELETE SET NULL,
  nome VARCHAR(255) NOT NULL,
  endereco TEXT,
  cidade VARCHAR(100),
  uf VARCHAR(2),
  cep VARCHAR(20),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(ministry_id, supervisao_id, nome)
);

CREATE INDEX IF NOT EXISTS idx_congregacoes_ministry_id ON public.congregacoes(ministry_id);
CREATE INDEX IF NOT EXISTS idx_congregacoes_is_active ON public.congregacoes(is_active);

-- Adicionar as colunas em ministry_users (operação idempotente)
ALTER TABLE public.ministry_users
  ADD COLUMN IF NOT EXISTS supervisao_id UUID REFERENCES public.supervisoes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS congregacao_id UUID REFERENCES public.congregacoes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ministry_users_supervisao_id ON public.ministry_users(supervisao_id);
CREATE INDEX IF NOT EXISTS idx_ministry_users_congregacao_id ON public.ministry_users(congregacao_id);
