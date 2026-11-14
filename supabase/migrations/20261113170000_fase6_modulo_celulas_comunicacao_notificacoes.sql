-- ==============================================================================
-- MÓDULO CÉLULAS — LOTE 6: COMUNICAÇÃO MINISTERIAL E NOTIFICAÇÕES
-- Especificação: docs/GESTAO_EKLESIA_MODULO_CELULAS_ESPECIFICACAO_V1.md
-- Seções: 13 (Comunicação Ministerial)
-- ==============================================================================
-- Características da Implantação Segura:
-- 1. Transacional com lock_timeout e statement_timeout para proteção contra locks.
-- 2. Operações 100% aditivas e idempotentes (CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT EXISTS).
-- 3. RLS em todas as novas tabelas com isolamento estrito por ministry_id e congregação.
-- 4. Funções helpers SECURITY DEFINER de autorização integradas aos lotes anteriores.
-- 5. Canais segregados: mural/comunicados internos, lembretes de reunião e links para WhatsApp manual.
-- 6. Registro auditável de mensagens e templates padronizados.
-- ==============================================================================

BEGIN;

-- 1. Timeouts de segurança para evitar contenção de locks em produção
SET LOCAL lock_timeout = '4s';
SET LOCAL statement_timeout = '30s';

-- ------------------------------------------------------------------------------
-- 2. Tabela de Comunicados das Células (celulas_comunicados)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.celulas_comunicados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  congregacao_id UUID REFERENCES public.congregacoes(id) ON DELETE SET NULL,
  rede_id UUID REFERENCES public.celulas_redes(id) ON DELETE SET NULL,
  celula_id UUID REFERENCES public.celulas(id) ON DELETE CASCADE,

  -- Destinatários e escopo do público
  publico_alvo VARCHAR(30) NOT NULL DEFAULT 'todos' CHECK (publico_alvo IN ('todos', 'lideres', 'supervisores', 'participantes', 'anfitrioes')),
  
  titulo VARCHAR(255) NOT NULL,
  conteudo TEXT NOT NULL,
  prioridade VARCHAR(20) NOT NULL DEFAULT 'normal' CHECK (prioridade IN ('baixa', 'normal', 'alta', 'urgente')),
  
  -- Publicação e vigência
  status VARCHAR(30) NOT NULL DEFAULT 'publicado' CHECK (status IN ('rascunho', 'publicado', 'arquivado')),
  data_expiracao DATE,

  autor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_celulas_comun_ministry ON public.celulas_comunicados(ministry_id);
CREATE INDEX IF NOT EXISTS idx_celulas_comun_congregacao ON public.celulas_comunicados(congregacao_id);
CREATE INDEX IF NOT EXISTS idx_celulas_comun_rede ON public.celulas_comunicados(rede_id);
CREATE INDEX IF NOT EXISTS idx_celulas_comun_celula ON public.celulas_comunicados(celula_id);
CREATE INDEX IF NOT EXISTS idx_celulas_comun_status ON public.celulas_comunicados(status);

-- ------------------------------------------------------------------------------
-- 3. Tabela de Modelos / Templates de Mensagens (celulas_templates_mensagens)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.celulas_templates_mensagens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  
  tipo VARCHAR(50) NOT NULL CHECK (tipo IN ('lembrete_reuniao', 'boas_vindas', 'apoio_pastoral', 'chamada_estudo', 'comunicado_geral')),
  titulo VARCHAR(150) NOT NULL,
  corpo_texto TEXT NOT NULL,
  variaveis_disponiveis TEXT[], -- ex: ['{nome}', '{celula}', '{dia}', '{horario}', '{endereco}']
  
  is_ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_celulas_templ_ministry ON public.celulas_templates_mensagens(ministry_id);
CREATE INDEX IF NOT EXISTS idx_celulas_templ_tipo ON public.celulas_templates_mensagens(tipo);

-- ------------------------------------------------------------------------------
-- 4. Tabela de Registro de Disparos / Tentativas de Mensagens (celulas_mensagens_logs)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.celulas_mensagens_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  congregacao_id UUID REFERENCES public.congregacoes(id) ON DELETE SET NULL,
  celula_id UUID REFERENCES public.celulas(id) ON DELETE SET NULL,
  
  canal VARCHAR(30) NOT NULL DEFAULT 'whatsapp_manual' CHECK (canal IN ('whatsapp_manual', 'notificacao_app', 'email', 'sms')),
  destinatario_nome VARCHAR(255) NOT NULL,
  destinatario_contato VARCHAR(100), -- telefone ou email
  
  conteudo_enviado TEXT NOT NULL,
  status_envio VARCHAR(30) NOT NULL DEFAULT 'preparado' CHECK (status_envio IN ('preparado', 'enviado', 'falha')),
  
  enviado_por_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_celulas_msg_ministry ON public.celulas_mensagens_logs(ministry_id);
CREATE INDEX IF NOT EXISTS idx_celulas_msg_celula ON public.celulas_mensagens_logs(celula_id);
CREATE INDEX IF NOT EXISTS idx_celulas_msg_status ON public.celulas_mensagens_logs(status_envio);

-- ------------------------------------------------------------------------------
-- 5. Habilitação de RLS e Políticas de Segurança (Lote 6)
-- ------------------------------------------------------------------------------
ALTER TABLE public.celulas_comunicados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.celulas_templates_mensagens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.celulas_mensagens_logs ENABLE ROW LEVEL SECURITY;

-- --- celulas_comunicados ---
DROP POLICY IF EXISTS "celulas_comunicados_select" ON public.celulas_comunicados;
CREATE POLICY "celulas_comunicados_select" ON public.celulas_comunicados
  FOR SELECT TO authenticated USING (
    -- 1. Gestores globais com permissão de escrita visualizam todos
    public.celulas_has_global_write(ministry_id)
    OR (
      -- 2. Usuários vinculados à congregação específica do comunicado
      congregacao_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.ministry_users mu
        WHERE mu.user_id = auth.uid()
          AND mu.ministry_id = public.celulas_comunicados.ministry_id
          AND mu.congregacao_id = public.celulas_comunicados.congregacao_id
          AND COALESCE(mu.is_active, true) = true
          AND (
            -- Segmentação de audiência: comunicados para 'lideres', 'supervisores' ou 'anfitrioes'
            -- só são visíveis para quem possui perfil compatível em ministry_users
            public.celulas_comunicados.publico_alvo IN ('todos', 'participantes')
            OR LOWER(COALESCE(mu.role, '')) IN (
              'admin', 'administrador', 'pastor', 'secretario_geral', 'supervisor', 
              'coordenador', 'lider', 'secretaria_local', 'admin_local'
            )
          )
      )
    )
    OR (
      -- 3. Comunicados gerais do ministério para todas as congregações/células
      congregacao_id IS NULL AND celula_id IS NULL AND status = 'publicado' AND EXISTS (
        SELECT 1 FROM public.ministry_users mu
        WHERE mu.user_id = auth.uid() 
          AND mu.ministry_id = public.celulas_comunicados.ministry_id
          AND COALESCE(mu.is_active, true) = true
          AND (
            public.celulas_comunicados.publico_alvo IN ('todos', 'participantes')
            OR LOWER(COALESCE(mu.role, '')) IN (
              'admin', 'administrador', 'pastor', 'secretario_geral', 'supervisor', 
              'coordenador', 'lider', 'secretaria_local', 'admin_local'
            )
          )
      )
    )
  );

DROP POLICY IF EXISTS "celulas_comunicados_insert" ON public.celulas_comunicados;
CREATE POLICY "celulas_comunicados_insert" ON public.celulas_comunicados
  FOR INSERT TO authenticated WITH CHECK (
    public.celulas_has_local_write(ministry_id, congregacao_id)
  );

DROP POLICY IF EXISTS "celulas_comunicados_update" ON public.celulas_comunicados;
CREATE POLICY "celulas_comunicados_update" ON public.celulas_comunicados
  FOR UPDATE TO authenticated USING (
    public.celulas_has_local_write(ministry_id, congregacao_id)
  ) WITH CHECK (
    public.celulas_has_local_write(ministry_id, congregacao_id)
  );

DROP POLICY IF EXISTS "celulas_comunicados_delete" ON public.celulas_comunicados;
CREATE POLICY "celulas_comunicados_delete" ON public.celulas_comunicados
  FOR DELETE TO authenticated USING (
    public.celulas_has_global_write(ministry_id)
  );

-- --- celulas_templates_mensagens ---
DROP POLICY IF EXISTS "celulas_templates_select" ON public.celulas_templates_mensagens;
CREATE POLICY "celulas_templates_select" ON public.celulas_templates_mensagens
  FOR SELECT TO authenticated USING (
    ministry_id IN (
      SELECT mu.ministry_id FROM public.ministry_users mu
      WHERE mu.user_id = auth.uid() AND COALESCE(mu.is_active, true) = true
    )
  );

DROP POLICY IF EXISTS "celulas_templates_modify" ON public.celulas_templates_mensagens;
CREATE POLICY "celulas_templates_modify" ON public.celulas_templates_mensagens
  FOR ALL TO authenticated USING (
    public.celulas_has_global_write(ministry_id)
  ) WITH CHECK (
    public.celulas_has_global_write(ministry_id)
  );

-- --- celulas_mensagens_logs ---
DROP POLICY IF EXISTS "celulas_msg_logs_select" ON public.celulas_mensagens_logs;
CREATE POLICY "celulas_msg_logs_select" ON public.celulas_mensagens_logs
  FOR SELECT TO authenticated USING (
    public.celulas_has_global_write(ministry_id)
    OR (
      congregacao_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.ministry_users mu
        WHERE mu.user_id = auth.uid()
          AND mu.ministry_id = public.celulas_mensagens_logs.ministry_id
          AND mu.congregacao_id = public.celulas_mensagens_logs.congregacao_id
          AND COALESCE(mu.is_active, true) = true
      )
    )
  );

DROP POLICY IF EXISTS "celulas_msg_logs_insert" ON public.celulas_mensagens_logs;
CREATE POLICY "celulas_msg_logs_insert" ON public.celulas_mensagens_logs
  FOR INSERT TO authenticated WITH CHECK (
    public.celulas_has_local_write(ministry_id, congregacao_id)
  );

COMMIT;
