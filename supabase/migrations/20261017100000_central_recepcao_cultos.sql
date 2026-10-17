-- Migração: Central de Recepção do Culto e Acesso Público Temporário
-- Módulo: Secretaria -> Cultos / Acolhimento
-- Arquivo: supabase/migrations/20261017100000_central_recepcao_cultos.sql
-- NOTA: Arquivo preparado para aplicação futura. Não executar automaticamente.

-- 1. Tokens de Acesso Seguro da Central de Recepção (Hash SHA-256)
CREATE TABLE IF NOT EXISTS public.culto_recepcao_tokens (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id       UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  congregacao_id    UUID NOT NULL REFERENCES public.congregacoes(id) ON DELETE CASCADE,
  culto_id          UUID NOT NULL REFERENCES public.culto_registros(id) ON DELETE CASCADE,
  token_hash        VARCHAR(64) NOT NULL UNIQUE,
  expira_em         TIMESTAMP WITH TIME ZONE NOT NULL,
  revogado_em       TIMESTAMP WITH TIME ZONE,
  revogado_por      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  criado_por        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ultimo_acesso_em  TIMESTAMP WITH TIME ZONE,
  created_at        TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
  updated_at        TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,

  CONSTRAINT unique_culto_recepcao_token UNIQUE (culto_id)
);

CREATE INDEX IF NOT EXISTS idx_culto_recepcao_tokens_hash     ON public.culto_recepcao_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_culto_recepcao_tokens_culto    ON public.culto_recepcao_tokens(culto_id);
CREATE INDEX IF NOT EXISTS idx_culto_recepcao_tokens_ministry ON public.culto_recepcao_tokens(ministry_id);

-- 2. Autoridades e Pastores Visitantes
CREATE TABLE IF NOT EXISTS public.culto_recepcao_autoridades (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id     UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  congregacao_id  UUID NOT NULL REFERENCES public.congregacoes(id) ON DELETE CASCADE,
  culto_id        UUID NOT NULL REFERENCES public.culto_registros(id) ON DELETE CASCADE,
  nome            VARCHAR(255) NOT NULL,
  cargo_funcao    VARCHAR(150) NOT NULL,
  instituicao     VARCHAR(255),
  observacoes     TEXT,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
  updated_at      TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
  deleted_at      TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_culto_recepcao_autoridades_culto ON public.culto_recepcao_autoridades(culto_id);
CREATE INDEX IF NOT EXISTS idx_culto_recepcao_autoridades_del   ON public.culto_recepcao_autoridades(deleted_at);

-- 3. Pedidos de Oração e Ações de Graças
CREATE TABLE IF NOT EXISTS public.culto_recepcao_oracoes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id     UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  congregacao_id  UUID NOT NULL REFERENCES public.congregacoes(id) ON DELETE CASCADE,
  culto_id        UUID NOT NULL REFERENCES public.culto_registros(id) ON DELETE CASCADE,
  nome            VARCHAR(255) NOT NULL,
  tipo            VARCHAR(50) DEFAULT 'pedido' NOT NULL, -- 'pedido' | 'acao_de_gracas'
  categoria       VARCHAR(100), -- Saúde, Família, Justiça, Finanças, Espiritual, Gratidão, Outro
  motivo          TEXT NOT NULL,
  observacoes     TEXT,
  is_privado      BOOLEAN DEFAULT false NOT NULL, -- Reservado para pastores / não lido publicamente
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
  updated_at      TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
  deleted_at      TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_culto_recepcao_oracoes_culto ON public.culto_recepcao_oracoes(culto_id);
CREATE INDEX IF NOT EXISTS idx_culto_recepcao_oracoes_del   ON public.culto_recepcao_oracoes(deleted_at);

-- 4. Avisos da Recepção do Culto
CREATE TABLE IF NOT EXISTS public.culto_recepcao_avisos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id     UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  congregacao_id  UUID NOT NULL REFERENCES public.congregacoes(id) ON DELETE CASCADE,
  culto_id        UUID NOT NULL REFERENCES public.culto_registros(id) ON DELETE CASCADE,
  titulo          VARCHAR(255) NOT NULL,
  conteudo        TEXT NOT NULL,
  ordem           INTEGER DEFAULT 1 NOT NULL,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
  updated_at      TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
  deleted_at      TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_culto_recepcao_avisos_culto ON public.culto_recepcao_avisos(culto_id);
CREATE INDEX IF NOT EXISTS idx_culto_recepcao_avisos_del   ON public.culto_recepcao_avisos(deleted_at);

-- 5. Famílias Recebidas
CREATE TABLE IF NOT EXISTS public.culto_recepcao_familias (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id         UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  congregacao_id      UUID NOT NULL REFERENCES public.congregacoes(id) ON DELETE CASCADE,
  culto_id            UUID NOT NULL REFERENCES public.culto_registros(id) ON DELETE CASCADE,
  responsavel         VARCHAR(255) NOT NULL,
  membros_familia     TEXT,
  total_membros       INTEGER DEFAULT 1 NOT NULL,
  origem              VARCHAR(255),
  contato             VARCHAR(50),
  intencao_congregar  BOOLEAN DEFAULT false NOT NULL,
  observacoes         TEXT,
  created_at          TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
  updated_at          TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
  deleted_at          TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_culto_recepcao_familias_culto ON public.culto_recepcao_familias(culto_id);
CREATE INDEX IF NOT EXISTS idx_culto_recepcao_familias_del   ON public.culto_recepcao_familias(deleted_at);

-- 6. Adição de deleted_at em culto_visitantes para exclusão lógica uniforme
ALTER TABLE public.culto_visitantes ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
CREATE INDEX IF NOT EXISTS idx_culto_visitantes_del ON public.culto_visitantes(deleted_at);

-- 7. Ativação de Row Level Security (RLS)
ALTER TABLE public.culto_recepcao_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.culto_recepcao_autoridades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.culto_recepcao_oracoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.culto_recepcao_avisos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.culto_recepcao_familias ENABLE ROW LEVEL SECURITY;

-- 8. Políticas de Acesso Administrativo por Tenant (RLS)
CREATE POLICY "culto_recepcao_tokens_tenant" ON public.culto_recepcao_tokens
  FOR ALL USING (
    ministry_id IN (
      SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    ) OR ministry_id IN (
      SELECT id FROM public.ministries WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "culto_recepcao_autoridades_tenant" ON public.culto_recepcao_autoridades
  FOR ALL USING (
    ministry_id IN (
      SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    ) OR ministry_id IN (
      SELECT id FROM public.ministries WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "culto_recepcao_oracoes_tenant" ON public.culto_recepcao_oracoes
  FOR ALL USING (
    ministry_id IN (
      SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    ) OR ministry_id IN (
      SELECT id FROM public.ministries WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "culto_recepcao_avisos_tenant" ON public.culto_recepcao_avisos
  FOR ALL USING (
    ministry_id IN (
      SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    ) OR ministry_id IN (
      SELECT id FROM public.ministries WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "culto_recepcao_familias_tenant" ON public.culto_recepcao_familias
  FOR ALL USING (
    ministry_id IN (
      SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    ) OR ministry_id IN (
      SELECT id FROM public.ministries WHERE user_id = auth.uid()
    )
  );
