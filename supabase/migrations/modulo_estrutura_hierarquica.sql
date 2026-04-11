-- ============================================================
-- MÓDULO ESTRUTURA HIERÁRQUICA — Gestão Eklesia
-- Depende de: modulo_usuarios.sql, patch_001_rls_fix.sql
-- Tabelas: supervisoes (ALTER), campos (CREATE), congregacoes (ALTER)
-- ============================================================

-- ============================================================
-- 1. EXPANDIR supervisoes
--    Adicionar colunas que o código usa mas não existiam na
--    migration inicial (modulo_usuarios.sql era simplificada)
-- ============================================================

-- Código sequencial único por ministério
ALTER TABLE public.supervisoes
  ADD COLUMN IF NOT EXISTS codigo INTEGER,
  ADD COLUMN IF NOT EXISTS uf     VARCHAR(2);

-- Supervisor vinculado (FK para members será adicionada no módulo membros)
ALTER TABLE public.supervisoes
  ADD COLUMN IF NOT EXISTS supervisor_member_id      UUID,
  ADD COLUMN IF NOT EXISTS supervisor_matricula      VARCHAR(100),
  ADD COLUMN IF NOT EXISTS supervisor_nome           VARCHAR(255),
  ADD COLUMN IF NOT EXISTS supervisor_cpf            VARCHAR(20),
  ADD COLUMN IF NOT EXISTS supervisor_data_nascimento DATE,
  ADD COLUMN IF NOT EXISTS supervisor_cargo          VARCHAR(100),
  ADD COLUMN IF NOT EXISTS supervisor_celular        VARCHAR(30);

-- Índice único para evitar código duplicado por ministério
CREATE UNIQUE INDEX IF NOT EXISTS idx_supervisoes_ministry_codigo_unique
  ON public.supervisoes (ministry_id, codigo)
  WHERE codigo IS NOT NULL;

-- Corrigir UNIQUE existente: (ministry_id, nome) era criado em modulo_usuarios.sql
-- Remover para substituir por índice mais flexível
ALTER TABLE public.supervisoes
  DROP CONSTRAINT IF EXISTS supervisoes_ministry_id_nome_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_supervisoes_ministry_nome_unique
  ON public.supervisoes (ministry_id, LOWER(nome));

-- ============================================================
-- 2. CRIAR tabela campos (2ª divisão — ex: Campo, Setor, Grupo)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.campos (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id      UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  supervisao_id    UUID REFERENCES public.supervisoes(id) ON DELETE SET NULL,

  nome             VARCHAR(255) NOT NULL,
  is_sede          BOOLEAN NOT NULL DEFAULT false,

  -- Pastor/responsável pelo campo
  pastor_member_id UUID,           -- FK para members (adicionada no módulo membros)
  pastor_nome      VARCHAR(255),
  pastor_data_posse DATE,

  -- Localização (opcional)
  cep              VARCHAR(20),
  municipio        VARCHAR(100),
  uf               VARCHAR(2),

  is_active        BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT campos_ministry_nome_unique UNIQUE (ministry_id, nome)
);

CREATE INDEX IF NOT EXISTS idx_campos_ministry_id   ON public.campos(ministry_id);
CREATE INDEX IF NOT EXISTS idx_campos_supervisao_id ON public.campos(supervisao_id);
CREATE INDEX IF NOT EXISTS idx_campos_is_active     ON public.campos(is_active);

ALTER TABLE public.campos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "campos_select"  ON public.campos;
DROP POLICY IF EXISTS "campos_insert"  ON public.campos;
DROP POLICY IF EXISTS "campos_update"  ON public.campos;
DROP POLICY IF EXISTS "campos_delete"  ON public.campos;

CREATE POLICY "campos_select"
  ON public.campos FOR SELECT
  TO authenticated
  USING (
    ministry_id IN (
      SELECT public.get_owned_ministry_ids()
      UNION
      SELECT public.get_linked_ministry_ids()
    )
  );

CREATE POLICY "campos_insert"
  ON public.campos FOR INSERT
  TO authenticated
  WITH CHECK (ministry_id IN (SELECT public.get_owned_ministry_ids()));

CREATE POLICY "campos_update"
  ON public.campos FOR UPDATE
  TO authenticated
  USING (ministry_id IN (
    SELECT public.get_owned_ministry_ids()
    UNION
    SELECT public.get_linked_ministry_ids()
  ));

CREATE POLICY "campos_delete"
  ON public.campos FOR DELETE
  TO authenticated
  USING (ministry_id IN (SELECT public.get_owned_ministry_ids()));

DROP TRIGGER IF EXISTS campos_updated_at ON public.campos;
CREATE TRIGGER campos_updated_at
  BEFORE UPDATE ON public.campos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 3. EXPANDIR congregacoes
--    Adicionar colunas que o código usa mas não existiam na
--    migration inicial
-- ============================================================

-- Vínculo com a 2ª divisão (campo)
ALTER TABLE public.congregacoes
  ADD COLUMN IF NOT EXISTS campo_id UUID REFERENCES public.campos(id) ON DELETE SET NULL;

-- Dados do dirigente local
ALTER TABLE public.congregacoes
  ADD COLUMN IF NOT EXISTS dirigente           VARCHAR(255),
  ADD COLUMN IF NOT EXISTS dirigente_cpf       VARCHAR(20),
  ADD COLUMN IF NOT EXISTS dirigente_cargo     VARCHAR(100),
  ADD COLUMN IF NOT EXISTS dirigente_matricula VARCHAR(100);

-- Dados de localização completos
ALTER TABLE public.congregacoes
  ADD COLUMN IF NOT EXISTS municipio      VARCHAR(100),
  ADD COLUMN IF NOT EXISTS status_imovel  VARCHAR(20)
    CHECK (status_imovel IN ('PROPRIO', 'ALUGADO', 'CEDIDO'));

-- Foto da congregação (storage Supabase)
ALTER TABLE public.congregacoes
  ADD COLUMN IF NOT EXISTS foto_url    TEXT,
  ADD COLUMN IF NOT EXISTS foto_bucket VARCHAR(100),
  ADD COLUMN IF NOT EXISTS foto_path   TEXT;

-- Remover UNIQUE antiga com supervisao_id (muito restritiva) e criar simples por nome
ALTER TABLE public.congregacoes
  DROP CONSTRAINT IF EXISTS congregacoes_ministry_id_supervisao_id_nome_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_congregacoes_ministry_nome_unique
  ON public.congregacoes (ministry_id, LOWER(nome));

CREATE INDEX IF NOT EXISTS idx_congregacoes_campo_id ON public.congregacoes(campo_id);

-- ============================================================
-- 4. COMPLETAR RLS de supervisoes e congregacoes
--    (modulo_usuarios.sql criou apenas SELECT — precisamos
--     INSERT/UPDATE/DELETE para o módulo funcionar)
-- ============================================================

-- supervisoes
DROP POLICY IF EXISTS "supervisoes_insert" ON public.supervisoes;
DROP POLICY IF EXISTS "supervisoes_update" ON public.supervisoes;
DROP POLICY IF EXISTS "supervisoes_delete" ON public.supervisoes;

CREATE POLICY "supervisoes_insert"
  ON public.supervisoes FOR INSERT
  TO authenticated
  WITH CHECK (ministry_id IN (SELECT public.get_owned_ministry_ids()));

CREATE POLICY "supervisoes_update"
  ON public.supervisoes FOR UPDATE
  TO authenticated
  USING (
    ministry_id IN (
      SELECT public.get_owned_ministry_ids()
      UNION
      SELECT public.get_linked_ministry_ids()
    )
  );

CREATE POLICY "supervisoes_delete"
  ON public.supervisoes FOR DELETE
  TO authenticated
  USING (ministry_id IN (SELECT public.get_owned_ministry_ids()));

-- congregacoes
DROP POLICY IF EXISTS "congregacoes_insert" ON public.congregacoes;
DROP POLICY IF EXISTS "congregacoes_update" ON public.congregacoes;
DROP POLICY IF EXISTS "congregacoes_delete" ON public.congregacoes;

CREATE POLICY "congregacoes_insert"
  ON public.congregacoes FOR INSERT
  TO authenticated
  WITH CHECK (ministry_id IN (SELECT public.get_owned_ministry_ids()));

CREATE POLICY "congregacoes_update"
  ON public.congregacoes FOR UPDATE
  TO authenticated
  USING (
    ministry_id IN (
      SELECT public.get_owned_ministry_ids()
      UNION
      SELECT public.get_linked_ministry_ids()
    )
  );

CREATE POLICY "congregacoes_delete"
  ON public.congregacoes FOR DELETE
  TO authenticated
  USING (ministry_id IN (SELECT public.get_owned_ministry_ids()));

-- ============================================================
-- 5. STORAGE BUCKET — fotos das congregações
--    Execute separadamente no painel Supabase > Storage
--    OU via este SQL (requer extensão storage habilitada)
-- ============================================================
-- Nota: Se o bucket já existir, este INSERT será ignorado.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'congregacoes-fotos',
  'congregacoes-fotos',
  true,
  5242880,   -- 5 MB
  ARRAY['image/jpeg','image/png','image/webp','image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Policy de upload: qualquer usuário autenticado com ministério pode fazer upload
DROP POLICY IF EXISTS "congregacoes_fotos_upload" ON storage.objects;
CREATE POLICY "congregacoes_fotos_upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'congregacoes-fotos');

-- Policy de leitura: público (as fotos são exibidas em cartões/fichas)
DROP POLICY IF EXISTS "congregacoes_fotos_read" ON storage.objects;
CREATE POLICY "congregacoes_fotos_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'congregacoes-fotos');

-- Policy de remoção: apenas quem fez upload (path contém ministryId)
DROP POLICY IF EXISTS "congregacoes_fotos_delete" ON storage.objects;
CREATE POLICY "congregacoes_fotos_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'congregacoes-fotos');

-- ============================================================
-- FIM DO SCRIPT
-- ============================================================
