-- ═══════════════════════════════════════════════════════════════════════════════
-- Migração: Módulo de Cuidado Pastoral e Pedidos de Oração Mobile
-- Tabela: pastoral_pedidos_oracao
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE TABLE IF NOT EXISTS public.pastoral_pedidos_oracao (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id          UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  member_id            UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  congregacao_id       UUID REFERENCES public.congregacoes(id) ON DELETE SET NULL,
  
  -- Dados enviados pelo membro
  assunto              VARCHAR(255) NOT NULL,
  descricao            TEXT NOT NULL,
  tipo                 VARCHAR(50) NOT NULL DEFAULT 'oracao', -- 'oracao' | 'atendimento' | 'visita' | 'outro'
  sigiloso             BOOLEAN NOT NULL DEFAULT true,
  data_preferencial    DATE,
  
  -- Workflow e controle pastoral
  status               VARCHAR(50) NOT NULL DEFAULT 'recebido', -- 'recebido' | 'em_oracao' | 'em_atendimento' | 'concluido'
  
  -- 🔴 Campos exclusivamente internos/pastorais (NUNCA expostos na API mobile)
  observacoes_internas TEXT,
  atendido_por         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  atendido_em          TIMESTAMPTZ,
  
  created_at           TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at           TIMESTAMPTZ DEFAULT now() NOT NULL,

  CONSTRAINT pastoral_pedidos_tipo CHECK (tipo IN ('oracao', 'atendimento', 'visita', 'outro')),
  CONSTRAINT pastoral_pedidos_status CHECK (status IN ('recebido', 'em_oracao', 'em_atendimento', 'concluido'))
);

-- Índices de consulta e performance
CREATE INDEX IF NOT EXISTS idx_pastoral_pedidos_member ON public.pastoral_pedidos_oracao(ministry_id, member_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pastoral_pedidos_status ON public.pastoral_pedidos_oracao(ministry_id, status);
CREATE INDEX IF NOT EXISTS idx_pastoral_pedidos_cong ON public.pastoral_pedidos_oracao(ministry_id, congregacao_id);

-- Ativação de RLS
ALTER TABLE public.pastoral_pedidos_oracao ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
DROP POLICY IF EXISTS "pastoral_pedidos_select" ON public.pastoral_pedidos_oracao;
DROP POLICY IF EXISTS "pastoral_pedidos_insert" ON public.pastoral_pedidos_oracao;
DROP POLICY IF EXISTS "pastoral_pedidos_update" ON public.pastoral_pedidos_oracao;

-- Leitura: Membro vê seus próprios pedidos OU equipe do ministério
CREATE POLICY "pastoral_pedidos_select" ON public.pastoral_pedidos_oracao FOR SELECT USING (
  -- Membro autenticado visualizando seus próprios registros
  member_id IN (
    SELECT id FROM public.members WHERE auth_user_id = auth.uid()
  )
  OR
  -- Usuário administrativo/pastoral do ministério
  ministry_id IN (
    SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    UNION
    SELECT id FROM public.ministries WHERE user_id = auth.uid()
  )
);

-- Inserção: Membro pode criar para si mesmo
CREATE POLICY "pastoral_pedidos_insert" ON public.pastoral_pedidos_oracao FOR INSERT WITH CHECK (
  member_id IN (
    SELECT id FROM public.members WHERE auth_user_id = auth.uid()
  )
  OR
  ministry_id IN (
    SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    UNION
    SELECT id FROM public.ministries WHERE user_id = auth.uid()
  )
);

-- Atualização: Apenas administradores/pastores do ministério
CREATE POLICY "pastoral_pedidos_update" ON public.pastoral_pedidos_oracao FOR UPDATE USING (
  ministry_id IN (
    SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    UNION
    SELECT id FROM public.ministries WHERE user_id = auth.uid()
  )
);

COMMIT;
