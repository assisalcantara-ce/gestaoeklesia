-- ==============================================================================
-- FASE 1: FUNDAÇÃO E ACOLHIMENTO DO DISCIPULADO (IMPLANTAÇÃO SEGURA EM PRODUÇÃO)
-- Projeto Supabase Alvo: qspueosxkolmwvibhzkt (Gestão Eklésia Produção)
-- ==============================================================================
-- Características da Implantação Segura:
-- 1. Transacional com lock_timeout e statement_timeout para proteção contra lock de DDL.
-- 2. Concorrência atômica no cadastro de novo membro via INSERT ON CONFLICT (ministry_id, cpf).
-- 3. RLS de INSERT, UPDATE e DELETE restritos aos perfis autorizados e escopo de congregação:
--    - Permissão Global: Owner ou ministry_users com cargo geral (admin, secretario_geral, pastor, etc.)
--    - Permissão Local: ministry_users restritos a uma congregacao só podem manipular discípulos da mesma congregação.
-- 4. Blindagem anti-bypass na RPC SECURITY DEFINER:
--    - Impede que operador com congregacao_id restrito contorne enviando p_congregacao_id = NULL.
--    - Se p_congregacao_id for NULL ou diferente da congregação do operador restrito, a transação aborta.
-- 5. Operações 100% aditivas e retrocompatíveis (preservando cultos e recepção).
-- ==============================================================================

BEGIN;

-- 1. Configurações de timeout na sessão de migração (evita filas de espera e locks prolongados)
SET LOCAL lock_timeout = '4s';
SET LOCAL statement_timeout = '30s';

-- 2. Adicionar colunas de conversão/integração em public.culto_visitantes (operacao rapida de metadados)
ALTER TABLE public.culto_visitantes
  ADD COLUMN IF NOT EXISTS converted_to_member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS converted_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_culto_visitantes_converted
  ON public.culto_visitantes(converted_to_member_id)
  WHERE converted_to_member_id IS NOT NULL;

-- 3. Tabela de Jornadas de Discipulado
CREATE TABLE IF NOT EXISTS public.discipulado_jornadas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  congregacao_id UUID REFERENCES public.congregacoes(id) ON DELETE SET NULL,
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  responsavel_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
  
  -- Origem da conversão / acolhimento
  visitante_origem_id UUID REFERENCES public.culto_visitantes(id) ON DELETE SET NULL,
  origem VARCHAR(50) NOT NULL DEFAULT 'culto', -- 'culto', 'acolhimento', 'evangelismo', 'indicacao', 'outro'
  
  -- Fases canônicas do discipulado
  fase VARCHAR(50) NOT NULL DEFAULT 'primeiros_passos',
  -- 'primeiros_passos' (Boas-vindas/Decisão)
  -- 'fundamentos'      (Doutrina básica e oração)
  -- 'preparacao_batismo' (Candidato ao batismo)
  -- 'integracao'       (Engajamento em ministérios/célula)
  
  -- Status da Jornada
  status VARCHAR(30) NOT NULL DEFAULT 'ativo', -- 'ativo', 'concluido', 'pausado', 'desistente'
  
  -- Datas de marco
  data_decisao DATE NOT NULL DEFAULT CURRENT_DATE,
  data_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
  data_conclusao DATE,
  
  -- Observações e anotações pastorais
  motivo_status TEXT,
  observacoes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

-- Constraint condicional: Apenas 1 jornada ATIVA por membro (permite histórico de concluídas/desistentes)
CREATE UNIQUE INDEX IF NOT EXISTS uq_discipulado_membro_ativo
  ON public.discipulado_jornadas(ministry_id, member_id)
  WHERE status = 'ativo';

CREATE INDEX IF NOT EXISTS idx_discipulado_jornadas_tenant
  ON public.discipulado_jornadas(ministry_id, congregacao_id);

CREATE INDEX IF NOT EXISTS idx_discipulado_jornadas_member
  ON public.discipulado_jornadas(member_id);

CREATE INDEX IF NOT EXISTS idx_discipulado_jornadas_fase
  ON public.discipulado_jornadas(ministry_id, fase);

-- 4. Tabela de Contatos e Interações do Discipulado
CREATE TABLE IF NOT EXISTS public.discipulado_contatos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  jornada_id UUID NOT NULL REFERENCES public.discipulado_jornadas(id) ON DELETE CASCADE,
  responsavel_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
  
  tipo VARCHAR(50) NOT NULL DEFAULT 'visita', -- 'visita', 'ligacao', 'whatsapp', 'oracao', 'encontro_presencial'
  data_contato DATE NOT NULL DEFAULT CURRENT_DATE,
  resumo VARCHAR(255) NOT NULL,
  detalhes TEXT,
  proximo_passo TEXT,
  data_proximo_contato DATE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_discipulado_contatos_jornada
  ON public.discipulado_contatos(jornada_id, data_contato DESC);

-- 5. Funções Auxiliares de Verificação de Autorização RLS (Discipulado)
CREATE OR REPLACE FUNCTION public.discipulado_has_global_write(p_ministry_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.ministries m
    WHERE m.id = p_ministry_id AND m.user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.ministry_users mu
    WHERE mu.user_id = auth.uid()
      AND mu.ministry_id = p_ministry_id
      AND COALESCE(mu.is_active, true) = true
      AND mu.congregacao_id IS NULL
      AND LOWER(COALESCE(mu.role, '')) IN (
        'admin', 'administrador', 'secretario_geral', 'auxiliar_secretaria',
        'secretaria', 'pastor', 'supervisor', 'operador'
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.discipulado_has_local_write(p_ministry_id UUID, p_congregacao_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.discipulado_has_global_write(p_ministry_id)
  OR (
    p_congregacao_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.ministry_users mu
      WHERE mu.user_id = auth.uid()
        AND mu.ministry_id = p_ministry_id
        AND mu.congregacao_id = p_congregacao_id
        AND COALESCE(mu.is_active, true) = true
        AND LOWER(COALESCE(mu.role, '')) IN (
          'admin', 'administrador', 'secretaria_local', 'admin_local',
          'auxiliar_secretaria', 'secretaria', 'pastor', 'supervisor', 'operador'
        )
    )
  );
$$;

-- 6. Habilitar RLS (Row Level Security)
ALTER TABLE public.discipulado_jornadas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discipulado_contatos ENABLE ROW LEVEL SECURITY;

-- Políticas de Acesso para discipulado_jornadas:
-- SELECT: visível a membros com vínculo ativo no ministério ou proprietário (com filtro de congregação para locais)
DROP POLICY IF EXISTS "discipulado_jornadas_tenant_select" ON public.discipulado_jornadas;
CREATE POLICY "discipulado_jornadas_tenant_select" ON public.discipulado_jornadas
  FOR SELECT TO authenticated USING (
    public.discipulado_has_global_write(ministry_id)
    OR (
      congregacao_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.ministry_users mu
        WHERE mu.user_id = auth.uid()
          AND mu.ministry_id = public.discipulado_jornadas.ministry_id
          AND mu.congregacao_id = public.discipulado_jornadas.congregacao_id
          AND COALESCE(mu.is_active, true) = true
      )
    )
  );

-- INSERT: Restrito a perfis autorizados (globais ou da congregação correspondente)
DROP POLICY IF EXISTS "discipulado_jornadas_tenant_insert" ON public.discipulado_jornadas;
CREATE POLICY "discipulado_jornadas_tenant_insert" ON public.discipulado_jornadas
  FOR INSERT TO authenticated WITH CHECK (
    public.discipulado_has_local_write(ministry_id, congregacao_id)
  );

-- UPDATE: Restrito a perfis autorizados
DROP POLICY IF EXISTS "discipulado_jornadas_tenant_update" ON public.discipulado_jornadas;
CREATE POLICY "discipulado_jornadas_tenant_update" ON public.discipulado_jornadas
  FOR UPDATE TO authenticated USING (
    public.discipulado_has_local_write(ministry_id, congregacao_id)
  ) WITH CHECK (
    public.discipulado_has_local_write(ministry_id, congregacao_id)
  );

-- DELETE: Apenas administradores globais ou proprietários podem remover jornadas
DROP POLICY IF EXISTS "discipulado_jornadas_tenant_delete" ON public.discipulado_jornadas;
CREATE POLICY "discipulado_jornadas_tenant_delete" ON public.discipulado_jornadas
  FOR DELETE TO authenticated USING (
    public.discipulado_has_global_write(ministry_id)
  );

-- Políticas de Acesso para discipulado_contatos:
DROP POLICY IF EXISTS "discipulado_contatos_tenant_select" ON public.discipulado_contatos;
CREATE POLICY "discipulado_contatos_tenant_select" ON public.discipulado_contatos
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.discipulado_jornadas dj
      WHERE dj.id = public.discipulado_contatos.jornada_id
        AND (
          public.discipulado_has_global_write(dj.ministry_id)
          OR (
            dj.congregacao_id IS NOT NULL AND EXISTS (
              SELECT 1 FROM public.ministry_users mu
              WHERE mu.user_id = auth.uid()
                AND mu.ministry_id = dj.ministry_id
                AND mu.congregacao_id = dj.congregacao_id
                AND COALESCE(mu.is_active, true) = true
            )
          )
        )
    )
  );

DROP POLICY IF EXISTS "discipulado_contatos_tenant_insert" ON public.discipulado_contatos;
CREATE POLICY "discipulado_contatos_tenant_insert" ON public.discipulado_contatos
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.discipulado_jornadas dj
      WHERE dj.id = public.discipulado_contatos.jornada_id
        AND public.discipulado_has_local_write(dj.ministry_id, dj.congregacao_id)
    )
  );

DROP POLICY IF EXISTS "discipulado_contatos_tenant_update" ON public.discipulado_contatos;
CREATE POLICY "discipulado_contatos_tenant_update" ON public.discipulado_contatos
  FOR UPDATE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.discipulado_jornadas dj
      WHERE dj.id = public.discipulado_contatos.jornada_id
        AND public.discipulado_has_local_write(dj.ministry_id, dj.congregacao_id)
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.discipulado_jornadas dj
      WHERE dj.id = public.discipulado_contatos.jornada_id
        AND public.discipulado_has_local_write(dj.ministry_id, dj.congregacao_id)
    )
  );

DROP POLICY IF EXISTS "discipulado_contatos_tenant_delete" ON public.discipulado_contatos;
CREATE POLICY "discipulado_contatos_tenant_delete" ON public.discipulado_contatos
  FOR DELETE TO authenticated USING (
    public.discipulado_has_global_write(ministry_id)
  );

-- ==============================================================================
-- 7. PROCEDIMENTO ATÔMICO DE TRANSAÇÃO: iniciar_jornada_discipulado_rpc
-- Garante Atomicidade ACID no PostgreSQL:
-- 1. Validação estrita de autenticação (auth.uid()) e status do usuário ativo
-- 2. Verificação de permissão institucional e congregação autorizada
--    * Anti-Bypass: Operador restrito a uma congregação NUNCA pode enviar p_congregacao_id = NULL
-- 3. Tratamento robusto de concorrência com INSERT ... ON CONFLICT (ministry_id, cpf)
-- 4. Inviolabilidade do tipo de cadastro (se membro ou ministro, NÃO rebaixa)
-- 5. Verificação de unicidade de jornada ativa (impede múltiplas simultâneas)
-- 6. Criação da jornada em discipulado_jornadas
-- 7. Vínculo explícito no visitante em culto_visitantes (sem usar deleted_at)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.iniciar_jornada_discipulado_rpc(
  p_ministry_id UUID,
  p_cpf VARCHAR(20),
  p_nome VARCHAR(255),
  p_telefone VARCHAR(20) DEFAULT NULL,
  p_congregacao_id UUID DEFAULT NULL,
  p_responsavel_id UUID DEFAULT NULL,
  p_visitante_id UUID DEFAULT NULL,
  p_data_nascimento DATE DEFAULT NULL,
  p_sexo VARCHAR(20) DEFAULT NULL,
  p_bairro VARCHAR(100) DEFAULT NULL,
  p_cidade VARCHAR(100) DEFAULT NULL,
  p_estado VARCHAR(2) DEFAULT NULL,
  p_cep VARCHAR(20) DEFAULT NULL,
  p_logradouro VARCHAR(255) DEFAULT NULL,
  p_numero VARCHAR(50) DEFAULT NULL,
  p_data_decisao DATE DEFAULT CURRENT_DATE,
  p_observacoes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_clean_cpf VARCHAR(11);
  v_caller_user_id UUID;
  v_caller_mu public.ministry_users%ROWTYPE;
  v_is_owner BOOLEAN := FALSE;
  v_membro_existente public.members%ROWTYPE;
  v_member_id UUID;
  v_is_novo_member BOOLEAN := FALSE;
  v_tipo_cadastro_final VARCHAR(50) := 'congregado';
  v_jornada_ativa_id UUID;
  v_nova_jornada_id UUID;
  v_visitante_vinculado BOOLEAN := FALSE;
  v_vis_rec public.culto_visitantes%ROWTYPE;
  v_resp_rec public.members%ROWTYPE;
  v_cong_rec public.congregacoes%ROWTYPE;
  v_target_congregacao_id UUID;
BEGIN
  -- 0. Validação de autenticação básica do chamador (auth.uid())
  v_caller_user_id := auth.uid();
  IF v_caller_user_id IS NULL THEN
    RAISE EXCEPTION 'Acesso negado: Usuário não autenticado.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- 1. Validações preliminares de parâmetros obrigatórios
  IF p_ministry_id IS NULL THEN
    RAISE EXCEPTION 'ID do ministério é obrigatório.' USING ERRCODE = 'check_violation';
  END IF;

  IF p_nome IS NULL OR trim(p_nome) = '' THEN
    RAISE EXCEPTION 'O nome do novo convertido é obrigatório.' USING ERRCODE = 'check_violation';
  END IF;

  -- Higienização do CPF
  v_clean_cpf := regexp_replace(COALESCE(p_cpf, ''), '\D', '', 'g');
  IF length(v_clean_cpf) <> 11 THEN
    RAISE EXCEPTION 'CPF deve conter exatamente 11 dígitos numéricos.' USING ERRCODE = 'check_violation';
  END IF;

  -- Rejeição sumária de dígitos repetidos (ex: 111.111.111-11, 000.000.000-00, etc.)
  IF v_clean_cpf ~ '^(\d)\1{10}$' THEN
    RAISE EXCEPTION 'CPF inválido: dígitos repetidos não são aceitos.' USING ERRCODE = 'check_violation';
  END IF;

  -- 2. Validação de vínculo e perfil do chamador (Prevenção contra spoofing e usuários inativos)
  SELECT EXISTS (
    SELECT 1 FROM public.ministries WHERE id = p_ministry_id AND user_id = v_caller_user_id
  ) INTO v_is_owner;

  IF NOT v_is_owner THEN
    SELECT * INTO v_caller_mu
    FROM public.ministry_users
    WHERE user_id = v_caller_user_id 
      AND ministry_id = p_ministry_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Acesso negado: O usuário não possui vínculo com este ministério.'
        USING ERRCODE = 'insufficient_privilege';
    END IF;

    -- Bloqueio estrito de usuário inativo
    IF COALESCE(v_caller_mu.is_active, true) = false THEN
      RAISE EXCEPTION 'Acesso negado: O cadastro do usuário encontra-se desativado.'
        USING ERRCODE = 'insufficient_privilege';
    END IF;

    -- Validação de Perfil Autorizado para gerenciar discipulado
    IF LOWER(COALESCE(v_caller_mu.role, '')) NOT IN (
      'admin', 'administrador', 'secretario_geral', 'auxiliar_secretaria',
      'secretaria', 'secretaria_local', 'admin_local', 'pastor', 'supervisor', 'operador'
    ) THEN
      RAISE EXCEPTION 'Acesso negado: Perfil do usuário (%) não possui autorização para discipulado.', v_caller_mu.role
        USING ERRCODE = 'insufficient_privilege';
    END IF;

    -- Validação de Restrição de Congregação (Escopo Local) com PROTEÇÃO ANTI-BYPASS:
    -- Se o operador tiver congregacao_id fixada, ele NUNCA pode enviar NULL nem congregação diferente.
    IF v_caller_mu.congregacao_id IS NOT NULL THEN
      IF p_congregacao_id IS NULL THEN
        RAISE EXCEPTION 'Violação de escopo: Operador restrito à congregação % não pode cadastrar registros com congregação nula.',
          v_caller_mu.congregacao_id
          USING ERRCODE = 'insufficient_privilege';
      END IF;

      IF p_congregacao_id <> v_caller_mu.congregacao_id THEN
        RAISE EXCEPTION 'Violação de escopo: Usuário restrito à congregação % não pode registrar em %.',
          v_caller_mu.congregacao_id, p_congregacao_id
          USING ERRCODE = 'insufficient_privilege';
      END IF;
      v_target_congregacao_id := v_caller_mu.congregacao_id;
    ELSE
      v_target_congregacao_id := p_congregacao_id;
    END IF;
  ELSE
    v_target_congregacao_id := p_congregacao_id;
  END IF;

  -- 3. Validação de integridade e isolamento multi-tenant de TODOS os relacionamentos
  -- A. Congregação informada
  IF v_target_congregacao_id IS NOT NULL THEN
    SELECT * INTO v_cong_rec FROM public.congregacoes
    WHERE id = v_target_congregacao_id AND ministry_id = p_ministry_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Congregação informada não existe ou não pertence a este ministério.' 
        USING ERRCODE = 'integrity_constraint_violation';
    END IF;
  END IF;

  -- B. Responsável / Discipulador informado (deve ser membro do mesmo ministério e ativo)
  IF p_responsavel_id IS NOT NULL THEN
    SELECT * INTO v_resp_rec FROM public.members
    WHERE id = p_responsavel_id AND ministry_id = p_ministry_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Responsável informado não existe ou não pertence a este ministério.' 
        USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    IF LOWER(COALESCE(v_resp_rec.status, '')) IN ('inactive', 'inativo', 'deceased', 'transferred') THEN
      RAISE EXCEPTION 'O responsável informado não possui cadastro ativo na igreja.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  -- C. Visitante de Origem informado
  IF p_visitante_id IS NOT NULL THEN
    SELECT * INTO v_vis_rec FROM public.culto_visitantes
    WHERE id = p_visitante_id AND ministry_id = p_ministry_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Visitante informado não existe ou não pertence a este ministério.' 
        USING ERRCODE = 'integrity_constraint_violation';
    END IF;
  END IF;

  -- 4. Cadastro ou Recuperação Concorrente Segura em members
  SELECT * INTO v_membro_existente
  FROM public.members
  WHERE ministry_id = p_ministry_id
    AND regexp_replace(COALESCE(cpf, ''), '\D', '', 'g') = v_clean_cpf
  FOR UPDATE;

  IF FOUND THEN
    v_member_id := v_membro_existente.id;
    v_is_novo_member := FALSE;

    -- Regra Canônica: Membro ou Ministro NUNCA é rebaixado
    IF LOWER(COALESCE(v_membro_existente.tipo_cadastro, '')) IN ('membro', 'ministro') THEN
      v_tipo_cadastro_final := LOWER(v_membro_existente.tipo_cadastro);
    ELSE
      v_tipo_cadastro_final := 'congregado';
    END IF;
  ELSE
    -- Inserção segura contra concorrência via ON CONFLICT (ministry_id, cpf)
    INSERT INTO public.members (
      ministry_id,
      congregacao_id,
      name,
      cpf,
      phone,
      celular,
      whatsapp,
      tipo_cadastro,
      status,
      bairro,
      cidade,
      state,
      zipcode,
      address,
      birth_date,
      gender
    ) VALUES (
      p_ministry_id,
      v_target_congregacao_id,
      trim(p_nome),
      v_clean_cpf,
      p_telefone,
      p_telefone,
      p_telefone,
      'congregado',
      'active',
      p_bairro,
      p_cidade,
      p_estado,
      p_cep,
      p_logradouro,
      p_data_nascimento,
      p_sexo
    )
    ON CONFLICT (ministry_id, cpf) DO UPDATE
      SET updated_at = timezone('utc', now())
    RETURNING id, tipo_cadastro INTO v_member_id, v_tipo_cadastro_final;

    IF NOT FOUND THEN
      SELECT id, tipo_cadastro INTO v_member_id, v_tipo_cadastro_final
      FROM public.members
      WHERE ministry_id = p_ministry_id AND cpf = v_clean_cpf;
      v_is_novo_member := FALSE;
    ELSE
      v_is_novo_member := TRUE;
    END IF;

    IF LOWER(COALESCE(v_tipo_cadastro_final, '')) IN ('membro', 'ministro') THEN
      v_tipo_cadastro_final := LOWER(v_tipo_cadastro_final);
    ELSE
      v_tipo_cadastro_final := 'congregado';
    END IF;
  END IF;

  -- 5. Bloqueio de múltiplas jornadas ativas simultâneas (Locking pessimista)
  SELECT id INTO v_jornada_ativa_id
  FROM public.discipulado_jornadas
  WHERE ministry_id = p_ministry_id
    AND member_id = v_member_id
    AND status = 'ativo'
  FOR UPDATE;

  IF v_jornada_ativa_id IS NOT NULL THEN
    RAISE EXCEPTION 'Este discípulo já possui uma jornada de discipulado ATIVA em andamento.' 
      USING ERRCODE = 'check_violation';
  END IF;

  -- 6. Criação da Jornada
  INSERT INTO public.discipulado_jornadas (
    ministry_id,
    congregacao_id,
    member_id,
    responsavel_id,
    visitante_origem_id,
    origem,
    fase,
    status,
    data_decisao,
    data_inicio,
    observacoes
  ) VALUES (
    p_ministry_id,
    v_target_congregacao_id,
    v_member_id,
    p_responsavel_id,
    p_visitante_id,
    CASE WHEN p_visitante_id IS NOT NULL THEN 'acolhimento' ELSE 'culto' END,
    'primeiros_passos',
    'ativo',
    COALESCE(p_data_decisao, CURRENT_DATE),
    CURRENT_DATE,
    p_observacoes
  )
  RETURNING id INTO v_nova_jornada_id;

  -- 7. Vínculo explícito no visitante (SEM usar deleted_at)
  IF p_visitante_id IS NOT NULL THEN
    UPDATE public.culto_visitantes
    SET converted_to_member_id = v_member_id,
        converted_at = timezone('utc', now())
    WHERE id = p_visitante_id
      AND ministry_id = p_ministry_id;
    v_visitante_vinculado := TRUE;
  ELSIF p_telefone IS NOT NULL AND length(regexp_replace(p_telefone, '\D', '', 'g')) >= 8 THEN
    UPDATE public.culto_visitantes
    SET converted_to_member_id = v_member_id,
        converted_at = timezone('utc', now())
    WHERE ministry_id = p_ministry_id
      AND converted_to_member_id IS NULL
      AND regexp_replace(COALESCE(telefone, ''), '\D', '', 'g') = regexp_replace(p_telefone, '\D', '', 'g');
    IF FOUND THEN
      v_visitante_vinculado := TRUE;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'sucesso', TRUE,
    'member_id', v_member_id,
    'jornada_id', v_nova_jornada_id,
    'is_novo_member', v_is_novo_member,
    'tipo_cadastro_final', v_tipo_cadastro_final,
    'visitante_vinculado', v_visitante_vinculado,
    'mensagem', 'Jornada de discipulado iniciada com sucesso em transação atômica.'
  );
END;
$$;

-- 8. Permissões de Execução (Hardening)
REVOKE ALL ON FUNCTION public.iniciar_jornada_discipulado_rpc FROM PUBLIC;
REVOKE ALL ON FUNCTION public.iniciar_jornada_discipulado_rpc FROM anon;
GRANT EXECUTE ON FUNCTION public.iniciar_jornada_discipulado_rpc TO authenticated;
GRANT EXECUTE ON FUNCTION public.iniciar_jornada_discipulado_rpc TO service_role;

REVOKE ALL ON FUNCTION public.discipulado_has_global_write FROM PUBLIC;
REVOKE ALL ON FUNCTION public.discipulado_has_global_write FROM anon;
GRANT EXECUTE ON FUNCTION public.discipulado_has_global_write TO authenticated;
GRANT EXECUTE ON FUNCTION public.discipulado_has_global_write TO service_role;

REVOKE ALL ON FUNCTION public.discipulado_has_local_write FROM PUBLIC;
REVOKE ALL ON FUNCTION public.discipulado_has_local_write FROM anon;
GRANT EXECUTE ON FUNCTION public.discipulado_has_local_write TO authenticated;
GRANT EXECUTE ON FUNCTION public.discipulado_has_local_write TO service_role;

COMMIT;
