-- ============================================
-- MIGRAÇÕES PARA MÓDULO CONFIGURAÇÕES
-- ============================================
--
-- Este arquivo consolida as migrações para as 3 áreas:
-- 1. Perfil da Instituição
-- 2. Identidade Visual - Logomarca
-- 3. Nomenclaturas da Organização
--
-- Data de criação: 21 de março de 2026
-- Sequência: Execute após Initial Schema (20260102200944)
--
-- ============================================

-- ============================================
-- 1. PERFIL DA INSTITUIÇÃO
-- ============================================
--
-- A tabela `public.ministries` já contém os campos necessários:
-- - name (VARCHAR 255) - Nome da instituição
-- - cnpj_cpf (VARCHAR 20) - CNPJ/CPF
-- - email_admin (VARCHAR 255) - Email administrativo
-- - phone (VARCHAR 20) - Telefone
-- - website (VARCHAR 255) - Website
-- - description (TEXT) - Descrição
-- - timezone (VARCHAR 50) - Fuso horário (padrão: America/Sao_Paulo)
-- - logo_url (VARCHAR 500) - URL da logomarca
-- - created_at / updated_at - Timestamps
--
-- Estes campos já estão na Initial Schema e prontos para uso.
--
-- Exemplo de UPDATE para Perfil da Instituição:
-- 
--   UPDATE public.ministries
--   SET 
--     name = 'Minha Instituição',
--     cnpj_cpf = '00.000.000/0001-00',
--     email_admin = 'contato@instituicao.local',
--     phone = '(11) 99999-9999',
--     website = 'https://instituicao.com.br',
--     description = 'Descrição da instituição',
--     timezone = 'America/Sao_Paulo'
--   WHERE id = 'seu_ministry_id_aqui';
--

-- ============================================
-- 2. IDENTIDADE VISUAL - LOGOMARCA
-- ============================================
--
-- Coluna já existe em `public.ministries`:
-- - logo_url (VARCHAR 500) - URL da logomarca armazenada
--
-- Campo está em RLS e pode ser atualizado pelo owner:
--
--   UPDATE public.ministries
--   SET logo_url = 'https://seu-storage.supabase.co/logo.png'
--   WHERE id = 'seu_ministry_id_aqui';
--
-- Nota: O armazenamento da imagem deve ser feito via Supabase Storage
-- e apenas a URL é salva neste campo.

-- ============================================
-- 3. NOMENCLATURAS DA ORGANIZAÇÃO
-- ============================================
--
-- Tabela CONFIGURATIONS (já criada em Initial Schema)
-- Contém campo `nomenclaturas` em JSONB

-- Verificar se tabela configurations existe (criar se necessário)
CREATE TABLE IF NOT EXISTS public.configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID NOT NULL UNIQUE REFERENCES public.ministries(id) ON DELETE CASCADE,
  
  -- Nomenclaturas dinâmicas (customizáveis por ministry)
  nomenclaturas JSONB DEFAULT '{
    "member": "Membro",
    "members": "Membros",
    "role": "Cargo",
    "roles": "Cargos",
    "division": "Divisão",
    "divisions": "Divisões"
  }'::jsonb,
  
  -- Configurações de notificação
  notification_settings JSONB DEFAULT '{}'::jsonb,
  
  -- Configurações de relatório
  report_settings JSONB DEFAULT '{}'::jsonb,
  
  -- Dados customizados
  custom_fields JSONB DEFAULT '[]'::jsonb,
  
  -- Perfil da Igreja (opcional, para armazenar logo_url aqui também)
  church_profile JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Criar índices se não existirem
CREATE INDEX IF NOT EXISTS idx_configurations_ministry_id 
  ON public.configurations(ministry_id);

-- Habilitar RLS
ALTER TABLE public.configurations ENABLE ROW LEVEL SECURITY;

-- Dropar políticas antigas se existirem
DROP POLICY IF EXISTS "Configurações isoladas por ministry" ON public.configurations;
DROP POLICY IF EXISTS "Configurações podem ser atualizadas pelo ministry" ON public.configurations;
DROP POLICY IF EXISTS "configurations_select" ON public.configurations;
DROP POLICY IF EXISTS "configurations_insert" ON public.configurations;
DROP POLICY IF EXISTS "configurations_update" ON public.configurations;

-- Criar políticas de acesso (SELECT, INSERT, UPDATE)
CREATE POLICY "configurations_select"
  ON public.configurations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ministry_users mu
      WHERE mu.user_id = auth.uid()
      AND mu.ministry_id = public.configurations.ministry_id
    )
    OR EXISTS (
      SELECT 1 FROM public.ministries m
      WHERE m.id = public.configurations.ministry_id
      AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "configurations_insert"
  ON public.configurations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.ministry_users mu
      WHERE mu.user_id = auth.uid()
      AND mu.ministry_id = public.configurations.ministry_id
    )
    OR EXISTS (
      SELECT 1 FROM public.ministries m
      WHERE m.id = public.configurations.ministry_id
      AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "configurations_update"
  ON public.configurations
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ministry_users mu
      WHERE mu.user_id = auth.uid()
      AND mu.ministry_id = public.configurations.ministry_id
    )
    OR EXISTS (
      SELECT 1 FROM public.ministries m
      WHERE m.id = public.configurations.ministry_id
      AND m.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.ministry_users mu
      WHERE mu.user_id = auth.uid()
      AND mu.ministry_id = public.configurations.ministry_id
    )
    OR EXISTS (
      SELECT 1 FROM public.ministries m
      WHERE m.id = public.configurations.ministry_id
      AND m.user_id = auth.uid()
    )
  );

-- ============================================
-- EXEMPLOS DE USO - NOMENCLATURAS
-- ============================================
--
-- 1. ATUALIZAR NOMENCLATURAS DE UM MINISTRY:
--
--    UPDATE public.configurations
--    SET nomenclaturas = jsonb_build_object(
--      'member', 'Membro',
--      'members', 'Membros',
--      'role', 'Cargo',
--      'roles', 'Cargos',
--      'division', 'Supervisão',
--      'divisions', 'Supervisões'
--    )
--    WHERE ministry_id = 'seu_ministry_id_aqui';
--
-- 2. INSERIR CONFIGURATION INICIAL PARA NOVO MINISTRY:
--
--    INSERT INTO public.configurations (
--      ministry_id,
--      nomenclaturas,
--      notification_settings,
--      report_settings,
--      custom_fields
--    )
--    VALUES (
--      'novo_ministry_id',
--      '{
--        "member": "Membro",
--        "members": "Membros",
--        "role": "Cargo",
--        "roles": "Cargos",
--        "division": "Divisão",
--        "divisions": "Divisões"
--      }'::jsonb,
--      '{}'::jsonb,
--      '{}'::jsonb,
--      '[]'::jsonb
--    );
--
-- 3. CONSULTAR NOMENCLATURAS DE UM MINISTRY:
--
--    SELECT nomenclaturas
--    FROM public.configurations
--    WHERE ministry_id = 'seu_ministry_id_aqui';
--
-- 4. ADICIONAR CAMPOS CUSTOMIZADOS:
--
--    UPDATE public.configurations
--    SET custom_fields = custom_fields || '
--      [
--        {
--          "id": "1",
--          "name": "Meu Campo",
--          "type": "text",
--          "required": false
--        }
--      ]'::jsonb
--    WHERE ministry_id = 'seu_ministry_id_aqui';
--

-- ============================================
-- TRIGGER PARA ATUALIZAR UPDATED_AT
-- ============================================

CREATE OR REPLACE FUNCTION update_configurations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_configurations_updated_at ON public.configurations;
CREATE TRIGGER trigger_configurations_updated_at
  BEFORE UPDATE ON public.configurations
  FOR EACH ROW
  EXECUTE FUNCTION update_configurations_updated_at();

-- ============================================
-- FIM MIGRAÇÕES CONFIGURAÇÕES
-- ============================================
-- Se chegou aqui sem erro, as migrações foram bem-sucedidas!
--
-- Próximos passos:
-- 1. Verifique se as tabelas foram criadas corretamente
-- 2. Use os exemplos acima para atualizar dados via API
-- 3. Verifique RLS policies com SELECT * FROM public.configurations
--
-- ============================================
