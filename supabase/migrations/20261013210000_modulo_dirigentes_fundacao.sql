-- ==============================================================================
-- GESTÃO EKLÉSIA — MÓDULO DIRIGENTES (FUNDAÇÃO COM BLINDAGEM DE SEGURANÇA E RLS)
-- Arquivo: supabase/migrations/20261013210000_modulo_dirigentes_fundacao.sql
--
-- Descrição:
-- Criação das estruturas essenciais com políticas RLS robustas baseadas na matriz
-- de permissões (Secretaria propõe; Presidência/Admin aprova e efetiva), integridade
-- multi-tenant estrita e proteção contra exclusão de histórico.
--
-- Tabelas:
-- 1. dirigentes_designacoes: Histórico de mandatos e lideranças vigentes.
-- 2. dirigentes_movimentacoes: Gestão de propostas, planejamento anual e movimentações.
-- 3. dirigentes_termos_patrimoniais: Termos formais de conferência e entrega de patrimônio.
--
-- Aplicação:
-- Manual via SQL Editor do Supabase Dashboard.
-- ==============================================================================

BEGIN;

-- 1. TABELA DE DESIGNAÇÕES E HISTÓRICO DE DIRIGENTES
CREATE TABLE IF NOT EXISTS public.dirigentes_designacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  congregacao_id UUID NOT NULL REFERENCES public.congregacoes(id) ON DELETE CASCADE,
  member_id UUID NULL REFERENCES public.members(id) ON DELETE SET NULL,

  -- Dados cadastrais do dirigente (desnormalizados para preservação histórica imutável)
  nome_dirigente VARCHAR(255) NOT NULL,
  cpf_dirigente VARCHAR(20) NULL,
  cargo_ministerial VARCHAR(100) NULL,
  matricula_dirigente VARCHAR(100) NULL,
  telefone VARCHAR(30) NULL,

  -- Tipo de designação e controle de acumulação
  tipo_designacao VARCHAR(50) NOT NULL DEFAULT 'titular', -- 'titular' | 'co_dirigente' | 'interino'
  is_acumulacao BOOLEAN NOT NULL DEFAULT false,

  -- Ciclo de vida da designação
  status VARCHAR(30) NOT NULL DEFAULT 'ativo', -- 'ativo' | 'concluido' | 'afastado' | 'revogado'
  data_posse DATE NOT NULL,
  data_termino DATE NULL,
  motivo_saida TEXT NULL,

  -- Vínculo com movimentações do sistema
  movimentacao_origem_id UUID NULL,
  movimentacao_saida_id UUID NULL,

  observacoes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dirigentes_designacoes_ministry_id
  ON public.dirigentes_designacoes(ministry_id);
CREATE INDEX IF NOT EXISTS idx_dirigentes_designacoes_congregacao_id
  ON public.dirigentes_designacoes(congregacao_id);
CREATE INDEX IF NOT EXISTS idx_dirigentes_designacoes_member_id
  ON public.dirigentes_designacoes(member_id);
CREATE INDEX IF NOT EXISTS idx_dirigentes_designacoes_status
  ON public.dirigentes_designacoes(status);
CREATE INDEX IF NOT EXISTS idx_dirigentes_designacoes_data_posse
  ON public.dirigentes_designacoes(data_posse);


-- 2. TABELA DE MOVIMENTAÇÕES E PROPOSTAS
CREATE TABLE IF NOT EXISTS public.dirigentes_movimentacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,

  -- Classificação da movimentação
  tipo_movimentacao VARCHAR(50) NOT NULL, -- 'rodizio_anual' | 'transferencia_extraordinaria' | 'substituicao_temporaria'
  status VARCHAR(30) NOT NULL DEFAULT 'rascunho', -- 'rascunho' | 'proposta' | 'aprovada' | 'efetivada' | 'rejeitada' | 'cancelada'
  ano_referencia INT NULL, -- Ex: 2026, 2027 (para rodízio anual)
  titulo VARCHAR(255) NULL,

  -- Congregações envolvidas
  congregacao_destino_id UUID NOT NULL REFERENCES public.congregacoes(id) ON DELETE CASCADE,
  congregacao_origem_id UUID NULL REFERENCES public.congregacoes(id) ON DELETE SET NULL,

  -- Novo Dirigente Proposto
  dirigente_novo_member_id UUID NULL REFERENCES public.members(id) ON DELETE SET NULL,
  dirigente_novo_nome VARCHAR(255) NOT NULL,
  dirigente_novo_cargo VARCHAR(100) NULL,
  dirigente_novo_cpf VARCHAR(20) NULL,
  dirigente_novo_matricula VARCHAR(100) NULL,

  -- Dirigente Atual / Anterior (Substituído)
  dirigente_anterior_member_id UUID NULL REFERENCES public.members(id) ON DELETE SET NULL,
  dirigente_anterior_nome VARCHAR(255) NULL,
  dirigente_anterior_cargo VARCHAR(100) NULL,

  -- Prazos e Motivo
  motivo TEXT NOT NULL,
  data_prevista DATE NOT NULL,
  data_efetiva DATE NULL,
  prazo_retorno DATE NULL, -- Para substituições temporárias

  -- Trilha de aprovação e governança (Secretaria propõe -> Presidência/Admin aprova)
  solicitante_user_id UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  solicitante_nome VARCHAR(255) NULL,
  aprovador_user_id UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  aprovador_nome VARCHAR(255) NULL,
  data_aprovacao TIMESTAMPTZ NULL,
  justificativa_aprovacao_rejeicao TEXT NULL,

  -- Integração com Patrimônio
  requer_termo_patrimonial BOOLEAN NOT NULL DEFAULT false,
  status_conferencia_patrimonial VARCHAR(40) NOT NULL DEFAULT 'nao_se_aplica', -- 'nao_se_aplica' | 'pendente' | 'conferido_sem_divergencias' | 'conferido_com_divergencias'
  termo_patrimonial_id UUID NULL,
  divergencias_patrimoniais TEXT NULL,

  observacoes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dirigentes_movimentacoes_ministry_id
  ON public.dirigentes_movimentacoes(ministry_id);
CREATE INDEX IF NOT EXISTS idx_dirigentes_movimentacoes_destino_id
  ON public.dirigentes_movimentacoes(congregacao_destino_id);
CREATE INDEX IF NOT EXISTS idx_dirigentes_movimentacoes_status
  ON public.dirigentes_movimentacoes(status);
CREATE INDEX IF NOT EXISTS idx_dirigentes_movimentacoes_tipo
  ON public.dirigentes_movimentacoes(tipo_movimentacao);
CREATE INDEX IF NOT EXISTS idx_dirigentes_movimentacoes_ano
  ON public.dirigentes_movimentacoes(ano_referencia);


-- 3. TABELA DE TERMOS DE TRANSFERÊNCIA PATRIMONIAL
CREATE TABLE IF NOT EXISTS public.dirigentes_termos_patrimoniais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  movimentacao_id UUID NOT NULL REFERENCES public.dirigentes_movimentacoes(id) ON DELETE CASCADE,
  congregacao_id UUID NOT NULL REFERENCES public.congregacoes(id) ON DELETE CASCADE,

  data_emissao DATE NOT NULL,
  dirigente_transmitente_nome VARCHAR(255) NOT NULL,
  dirigente_recebedor_nome VARCHAR(255) NOT NULL,
  secretario_geral_nome VARCHAR(255) NULL,

  total_itens INT NOT NULL DEFAULT 0,
  valor_total_estimado NUMERIC(14,2) NOT NULL DEFAULT 0,
  itens_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb, -- Congela a relação de todos os bens no ato da transferência

  divergencias_identificadas TEXT NULL,
  status_termo VARCHAR(30) NOT NULL DEFAULT 'pendente_assinaturas', -- 'pendente_assinaturas' | 'assinado_e_homologado' | 'com_ressalvas'

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dirigentes_termos_ministry_id
  ON public.dirigentes_termos_patrimoniais(ministry_id);
CREATE INDEX IF NOT EXISTS idx_dirigentes_termos_movimentacao_id
  ON public.dirigentes_termos_patrimoniais(movimentacao_id);
CREATE INDEX IF NOT EXISTS idx_dirigentes_termos_congregacao_id
  ON public.dirigentes_termos_patrimoniais(congregacao_id);


-- 4. FUNÇÕES DE AUTORIZAÇÃO DE DOMÍNIO (SECURITY DEFINER)
-- Verifica se o usuário atual é Proprietário do Ministério, Administrador ou Presidência
CREATE OR REPLACE FUNCTION public.dirigentes_is_admin_or_presidencia(p_ministry_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.ministries m
    WHERE m.id = p_ministry_id AND m.user_id = auth.uid()

    UNION ALL

    SELECT 1 FROM public.ministry_users mu
    WHERE mu.user_id = auth.uid()
      AND mu.ministry_id = p_ministry_id
      AND COALESCE(mu.is_active, true) = true
      AND (
        mu.role IN ('admin', 'super_admin', 'administrador', 'presidencia')
        OR (mu.permissions IS NOT NULL AND (
          mu.permissions @> '["ADMINISTRADOR"]'::jsonb
          OR mu.permissions @> '["PRESIDENCIA"]'::jsonb
          OR mu.permissions::text ILIKE '%ADMINISTRADOR%'
          OR mu.permissions::text ILIKE '%PRESIDENCIA%'
        ))
      )
  );
$$;

-- Verifica se o usuário atual tem perfil de Secretaria (ou superior) para propor movimentações
CREATE OR REPLACE FUNCTION public.dirigentes_is_secretaria_or_above(p_ministry_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.dirigentes_is_admin_or_presidencia(p_ministry_id)
  OR EXISTS (
    SELECT 1 FROM public.ministry_users mu
    WHERE mu.user_id = auth.uid()
      AND mu.ministry_id = p_ministry_id
      AND COALESCE(mu.is_active, true) = true
      AND (
        mu.role IN ('admin', 'super_admin', 'manager', 'administrador', 'presidencia', 'secretario_geral', 'auxiliar_secretaria')
        OR (mu.permissions IS NOT NULL AND (
          mu.permissions @> '["ADMINISTRADOR"]'::jsonb
          OR mu.permissions @> '["PRESIDENCIA"]'::jsonb
          OR mu.permissions @> '["SECRETARIO_GERAL"]'::jsonb
          OR mu.permissions @> '["AUXILIAR_SECRETARIA"]'::jsonb
          OR mu.permissions @> '["SECRETARIA"]'::jsonb
          OR mu.permissions::text ILIKE '%SECRETARIO_GERAL%'
          OR mu.permissions::text ILIKE '%AUXILIAR_SECRETARIA%'
          OR mu.permissions::text ILIKE '%SECRETARIA%'
        ))
      )
  );
$$;

-- Verifica se o usuário pertence ao ministério (para leitura geral)
CREATE OR REPLACE FUNCTION public.dirigentes_belongs_to_ministry(p_ministry_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.ministries m
    WHERE m.id = p_ministry_id AND m.user_id = auth.uid()

    UNION ALL

    SELECT 1 FROM public.ministry_users mu
    WHERE mu.user_id = auth.uid() 
      AND mu.ministry_id = p_ministry_id
      AND COALESCE(mu.is_active, true) = true
  );
$$;

-- Permissões de execução estritas nas funções de autorização
REVOKE EXECUTE ON FUNCTION public.dirigentes_is_admin_or_presidencia(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.dirigentes_is_admin_or_presidencia(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.dirigentes_is_admin_or_presidencia(UUID) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.dirigentes_is_secretaria_or_above(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.dirigentes_is_secretaria_or_above(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.dirigentes_is_secretaria_or_above(UUID) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.dirigentes_belongs_to_ministry(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.dirigentes_belongs_to_ministry(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.dirigentes_belongs_to_ministry(UUID) TO authenticated, service_role;


-- 5. TRIGGERS DE INTEGRIDADE MULTI-TENANT E REGRAS DE TRANSIÇÃO

-- 5.1. Validação Multi-tenant em dirigentes_designacoes
CREATE OR REPLACE FUNCTION public.trg_fn_dirigentes_designacoes_multitenant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Congregação deve pertencer ao mesmo ministério
  IF NOT EXISTS (
    SELECT 1 FROM public.congregacoes c
    WHERE c.id = NEW.congregacao_id AND c.ministry_id = NEW.ministry_id
  ) THEN
    RAISE EXCEPTION 'Violação multi-tenant: A congregação (%) não pertence ao ministério (%).', NEW.congregacao_id, NEW.ministry_id;
  END IF;

  -- Membro deve pertencer ao mesmo ministério se informado
  IF NEW.member_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.id = NEW.member_id AND m.ministry_id = NEW.ministry_id
  ) THEN
    RAISE EXCEPTION 'Violação multi-tenant: O membro (%) não pertence ao ministério (%).', NEW.member_id, NEW.ministry_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dirigentes_designacoes_multitenant ON public.dirigentes_designacoes;
CREATE TRIGGER trg_dirigentes_designacoes_multitenant
  BEFORE INSERT OR UPDATE ON public.dirigentes_designacoes
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fn_dirigentes_designacoes_multitenant();

REVOKE EXECUTE ON FUNCTION public.trg_fn_dirigentes_designacoes_multitenant() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trg_fn_dirigentes_designacoes_multitenant() FROM anon;
GRANT EXECUTE ON FUNCTION public.trg_fn_dirigentes_designacoes_multitenant() TO authenticated, service_role;


-- 5.2. Validação Multi-tenant e Regras de Transição em dirigentes_movimentacoes
CREATE OR REPLACE FUNCTION public.trg_fn_dirigentes_movimentacoes_regras()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tem_bens_patrimonio BOOLEAN := false;
BEGIN
  -- Congregação destino deve pertencer ao mesmo ministério
  IF NOT EXISTS (
    SELECT 1 FROM public.congregacoes c
    WHERE c.id = NEW.congregacao_destino_id AND c.ministry_id = NEW.ministry_id
  ) THEN
    RAISE EXCEPTION 'Violação multi-tenant: A congregação de destino (%) não pertence ao ministério (%).', NEW.congregacao_destino_id, NEW.ministry_id;
  END IF;

  -- Congregação origem deve pertencer ao mesmo ministério se informada
  IF NEW.congregacao_origem_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.congregacoes c
    WHERE c.id = NEW.congregacao_origem_id AND c.ministry_id = NEW.ministry_id
  ) THEN
    RAISE EXCEPTION 'Violação multi-tenant: A congregação de origem (%) não pertence ao ministério (%).', NEW.congregacao_origem_id, NEW.ministry_id;
  END IF;

  -- Novo dirigente (membro) deve pertencer ao mesmo ministério se informado
  IF NEW.dirigente_novo_member_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.id = NEW.dirigente_novo_member_id AND m.ministry_id = NEW.ministry_id
  ) THEN
    RAISE EXCEPTION 'Violação multi-tenant: O novo dirigente (%) não pertence ao ministério (%).', NEW.dirigente_novo_member_id, NEW.ministry_id;
  END IF;

  -- REGRA DE NEGÓCIO: Efetivação exige aprovação prévia e termo patrimonial homologado se houver bens
  IF TG_OP = 'UPDATE' AND NEW.status = 'efetivada' AND OLD.status <> 'efetivada' THEN
    -- Não pode efetivar se não tiver sido aprovada antes
    IF OLD.status <> 'aprovada' THEN
      RAISE EXCEPTION 'Transição inválida: A movimentação (%) deve ser aprovada pela Presidência antes de ser efetivada (status atual: %).', NEW.id, OLD.status;
    END IF;

    -- Consulta resiliente a patrimonio_itens: identifica bens ativos, emprestados ou em extravio (qualquer status diferente de 'baixado')
    -- Se a tabela patrimonio_itens ainda não existir no ambiente de instalação, preserva integridade sem quebrar a execução da migration
    IF to_regclass('public.patrimonio_itens') IS NOT NULL THEN
      EXECUTE 'SELECT EXISTS (
        SELECT 1 FROM public.patrimonio_itens p
        WHERE p.congregacao_id = $1
          AND p.ministry_id = $2
          AND COALESCE(LOWER(TRIM(p.status)), ''ativo'') <> ''baixado''
      )'
      INTO v_tem_bens_patrimonio
      USING NEW.congregacao_destino_id, NEW.ministry_id;
    END IF;

    -- Se congregação possui bens cadastrados OU movimentação foi sinalizada como requerente de termo:
    -- Exige termo patrimonial homologado estritamente vinculado à MESMA movimentação, à MESMA congregação e ao MESMO ministério
    IF NEW.requer_termo_patrimonial = true OR v_tem_bens_patrimonio = true THEN
      IF NEW.termo_patrimonial_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.dirigentes_termos_patrimoniais t
        WHERE t.id = NEW.termo_patrimonial_id
          AND t.movimentacao_id = NEW.id
          AND t.congregacao_id = NEW.congregacao_destino_id
          AND t.ministry_id = NEW.ministry_id
          AND t.status_termo IN ('assinado_e_homologado', 'com_ressalvas')
      ) THEN
        RAISE EXCEPTION 'Transição bloqueada: Esta congregação possui bens cadastrados no patrimônio. É obrigatório formalizar e homologar o Termo de Transferência Patrimonial vinculado a esta mesma movimentação, congregação e ministério antes de efetivar.';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dirigentes_movimentacoes_regras ON public.dirigentes_movimentacoes;
CREATE TRIGGER trg_dirigentes_movimentacoes_regras
  BEFORE INSERT OR UPDATE ON public.dirigentes_movimentacoes
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fn_dirigentes_movimentacoes_regras();

REVOKE EXECUTE ON FUNCTION public.trg_fn_dirigentes_movimentacoes_regras() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trg_fn_dirigentes_movimentacoes_regras() FROM anon;
GRANT EXECUTE ON FUNCTION public.trg_fn_dirigentes_movimentacoes_regras() TO authenticated, service_role;


-- 5.3. Validação Multi-tenant em dirigentes_termos_patrimoniais
CREATE OR REPLACE FUNCTION public.trg_fn_dirigentes_termos_multitenant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Movimentação deve pertencer ao mesmo ministério
  IF NOT EXISTS (
    SELECT 1 FROM public.dirigentes_movimentacoes m
    WHERE m.id = NEW.movimentacao_id AND m.ministry_id = NEW.ministry_id
  ) THEN
    RAISE EXCEPTION 'Violação multi-tenant: A movimentação (%) não pertence ao ministério (%).', NEW.movimentacao_id, NEW.ministry_id;
  END IF;

  -- Congregação deve pertencer ao mesmo ministério
  IF NOT EXISTS (
    SELECT 1 FROM public.congregacoes c
    WHERE c.id = NEW.congregacao_id AND c.ministry_id = NEW.ministry_id
  ) THEN
    RAISE EXCEPTION 'Violação multi-tenant: A congregação (%) não pertence ao ministério (%).', NEW.congregacao_id, NEW.ministry_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dirigentes_termos_multitenant ON public.dirigentes_termos_patrimoniais;
CREATE TRIGGER trg_dirigentes_termos_multitenant
  BEFORE INSERT OR UPDATE ON public.dirigentes_termos_patrimoniais
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fn_dirigentes_termos_multitenant();

REVOKE EXECUTE ON FUNCTION public.trg_fn_dirigentes_termos_multitenant() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trg_fn_dirigentes_termos_multitenant() FROM anon;
GRANT EXECUTE ON FUNCTION public.trg_fn_dirigentes_termos_multitenant() TO authenticated, service_role;


-- 5.4. Proteção contra Exclusão do Histórico
CREATE OR REPLACE FUNCTION public.trg_fn_proibir_delete_historico()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'Operação proibida: Exclusão de registros históricos de liderança e termos patrimoniais é vetada por integridade auditorial.';
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_proibir_delete_designacoes ON public.dirigentes_designacoes;
CREATE TRIGGER trg_proibir_delete_designacoes
  BEFORE DELETE ON public.dirigentes_designacoes
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fn_proibir_delete_historico();

DROP TRIGGER IF EXISTS trg_proibir_delete_termos ON public.dirigentes_termos_patrimoniais;
CREATE TRIGGER trg_proibir_delete_termos
  BEFORE DELETE ON public.dirigentes_termos_patrimoniais
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fn_proibir_delete_historico();

REVOKE EXECUTE ON FUNCTION public.trg_fn_proibir_delete_historico() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trg_fn_proibir_delete_historico() FROM anon;
GRANT EXECUTE ON FUNCTION public.trg_fn_proibir_delete_historico() TO authenticated, service_role;


-- 6. POLÍTICAS DE ROW LEVEL SECURITY (RLS) RIGOROSAS BASEADAS EM RBAC

ALTER TABLE public.dirigentes_designacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dirigentes_movimentacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dirigentes_termos_patrimoniais ENABLE ROW LEVEL SECURITY;

-- 6.1. dirigentes_designacoes RLS
DROP POLICY IF EXISTS dirigentes_designacoes_select_policy ON public.dirigentes_designacoes;
DROP POLICY IF EXISTS dirigentes_designacoes_insert_policy ON public.dirigentes_designacoes;
DROP POLICY IF EXISTS dirigentes_designacoes_update_policy ON public.dirigentes_designacoes;
DROP POLICY IF EXISTS dirigentes_designacoes_delete_policy ON public.dirigentes_designacoes;

-- Leitura: Qualquer membro autenticado do ministério
CREATE POLICY "dirigentes_designacoes_select_policy"
  ON public.dirigentes_designacoes FOR SELECT TO authenticated
  USING (public.dirigentes_belongs_to_ministry(ministry_id));

-- Inserção: Exclusiva para Presidência e Administrador
CREATE POLICY "dirigentes_designacoes_insert_policy"
  ON public.dirigentes_designacoes FOR INSERT TO authenticated
  WITH CHECK (public.dirigentes_is_admin_or_presidencia(ministry_id));

-- Atualização: Exclusiva para Presidência e Administrador
CREATE POLICY "dirigentes_designacoes_update_policy"
  ON public.dirigentes_designacoes FOR UPDATE TO authenticated
  USING (public.dirigentes_is_admin_or_presidencia(ministry_id))
  WITH CHECK (public.dirigentes_is_admin_or_presidencia(ministry_id));

-- Exclusão: Bloqueada para todos (imutabilidade do histórico)
CREATE POLICY "dirigentes_designacoes_delete_policy"
  ON public.dirigentes_designacoes FOR DELETE TO authenticated
  USING (false);


-- 6.2. dirigentes_movimentacoes RLS
DROP POLICY IF EXISTS dirigentes_movimentacoes_select_policy ON public.dirigentes_movimentacoes;
DROP POLICY IF EXISTS dirigentes_movimentacoes_insert_policy ON public.dirigentes_movimentacoes;
DROP POLICY IF EXISTS dirigentes_movimentacoes_update_policy ON public.dirigentes_movimentacoes;
DROP POLICY IF EXISTS dirigentes_movimentacoes_delete_policy ON public.dirigentes_movimentacoes;

-- Leitura: Qualquer membro autenticado do ministério
CREATE POLICY "dirigentes_movimentacoes_select_policy"
  ON public.dirigentes_movimentacoes FOR SELECT TO authenticated
  USING (public.dirigentes_belongs_to_ministry(ministry_id));

-- Inserção: Secretaria propõe (status = rascunho ou proposta); Presidência/Admin pode qualquer status
CREATE POLICY "dirigentes_movimentacoes_insert_policy"
  ON public.dirigentes_movimentacoes FOR INSERT TO authenticated
  WITH CHECK (
    public.dirigentes_is_secretaria_or_above(ministry_id)
    AND (
      status IN ('rascunho', 'proposta')
      OR public.dirigentes_is_admin_or_presidencia(ministry_id)
    )
  );

-- Atualização:
-- Presidência/Admin pode aprovar, efetivar ou alterar qualquer campo.
-- Secretaria pode alterar apenas propostas pendentes (rascunho ou proposta), sem poder aprovar nem efetivar diretamente.
CREATE POLICY "dirigentes_movimentacoes_update_policy"
  ON public.dirigentes_movimentacoes FOR UPDATE TO authenticated
  USING (
    public.dirigentes_is_admin_or_presidencia(ministry_id)
    OR (
      public.dirigentes_is_secretaria_or_above(ministry_id)
      AND status IN ('rascunho', 'proposta')
    )
  )
  WITH CHECK (
    public.dirigentes_is_admin_or_presidencia(ministry_id)
    OR (
      public.dirigentes_is_secretaria_or_above(ministry_id)
      AND status IN ('rascunho', 'proposta', 'cancelada')
    )
  );

-- Exclusão: Permitida apenas para propostas ainda não aprovadas (rascunho ou cancelada)
CREATE POLICY "dirigentes_movimentacoes_delete_policy"
  ON public.dirigentes_movimentacoes FOR DELETE TO authenticated
  USING (
    status IN ('rascunho', 'cancelada')
    AND (
      public.dirigentes_is_admin_or_presidencia(ministry_id)
      OR solicitante_user_id = auth.uid()
    )
  );


-- 6.3. dirigentes_termos_patrimoniais RLS
DROP POLICY IF EXISTS dirigentes_termos_select_policy ON public.dirigentes_termos_patrimoniais;
DROP POLICY IF EXISTS dirigentes_termos_insert_policy ON public.dirigentes_termos_patrimoniais;
DROP POLICY IF EXISTS dirigentes_termos_update_policy ON public.dirigentes_termos_patrimoniais;
DROP POLICY IF EXISTS dirigentes_termos_delete_policy ON public.dirigentes_termos_patrimoniais;

-- Leitura: Qualquer membro autenticado do ministério
CREATE POLICY "dirigentes_termos_select_policy"
  ON public.dirigentes_termos_patrimoniais FOR SELECT TO authenticated
  USING (public.dirigentes_belongs_to_ministry(ministry_id));

-- Inserção: Secretaria ou Presidência/Admin
CREATE POLICY "dirigentes_termos_insert_policy"
  ON public.dirigentes_termos_patrimoniais FOR INSERT TO authenticated
  WITH CHECK (public.dirigentes_is_secretaria_or_above(ministry_id));

-- Atualização: Exclusiva para Presidência e Administrador
CREATE POLICY "dirigentes_termos_update_policy"
  ON public.dirigentes_termos_patrimoniais FOR UPDATE TO authenticated
  USING (public.dirigentes_is_admin_or_presidencia(ministry_id))
  WITH CHECK (public.dirigentes_is_admin_or_presidencia(ministry_id));

-- Exclusão: Bloqueada para todos (documento patrimonial imutável)
CREATE POLICY "dirigentes_termos_delete_policy"
  ON public.dirigentes_termos_patrimoniais FOR DELETE TO authenticated
  USING (false);

COMMIT;
